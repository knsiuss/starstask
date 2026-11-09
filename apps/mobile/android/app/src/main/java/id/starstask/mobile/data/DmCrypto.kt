package id.starstask.mobile.data

import android.util.Base64
import java.math.BigInteger
import java.security.SecureRandom
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Native mirror of web E2EE DM v1/v2 (apps/web/src/lib/crypto/e2ee.ts):
 * - ECDH P-256 + HKDF-SHA256(salt "starstask-e2ee-v1", info "dm") -> AES-256-GCM
 * - Wire: `v2:base64(iv12):base64(cipher)` with AAD
 *   `starstask-dm-v2|conversationId|senderId|1`.
 * - v1 wires (no AAD, `iv:cipher`) still decrypt for backward compatibility.
 * Server only ever sees ciphertext; plaintext never leaves the device.
 */

private const val HKDF_SALT = "starstask-e2ee-v1"
private const val HKDF_INFO = "dm"
private const val KEY_EPOCH = 1
private const val IV_BYTES = 12

private fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

private fun unb64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

private fun ecSpec(): ECParameterSpec {
    val params = java.security.AlgorithmParameters.getInstance("EC")
    params.init(ECGenParameterSpec("secp256r1"))
    return params.getParameterSpec(ECParameterSpec::class.java)
}

private fun fixed32(value: BigInteger): ByteArray {
    val raw = value.toByteArray()
    if (raw.size == 33 && raw[0] == 0.toByte()) return raw.copyOfRange(1, 33)
    if (raw.size == 32) return raw
    val out = ByteArray(32)
    raw.copyInto(out, 32 - raw.size)
    return out
}

private fun importPeerPublicKey(base64: String): ECPublicKey {
    val raw = unb64(base64)
    require(raw.size == 65 && raw[0] == 4.toByte()) { "Invalid peer public key" }
    val spec = ecSpec()
    val point = ECPoint(BigInteger(1, raw.copyOfRange(1, 33)), BigInteger(1, raw.copyOfRange(33, 65)))
    return java.security.KeyFactory.getInstance("EC")
        .generatePublic(ECPublicKeySpec(point, spec)) as ECPublicKey
}

private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(key, "HmacSHA256"))
    return mac.doFinal(data)
}

// RFC 5869 HKDF-SHA256, L=32 (one expand block is enough).
private fun hkdfSha256(ikm: ByteArray, salt: ByteArray, info: ByteArray): ByteArray {
    val prk = hmacSha256(salt, ikm)
    val counter = byteArrayOf(1)
    return hmacSha256(prk, info + counter)
}

private fun deriveAesKey(self: DeviceKeyPair, peerPublicBase64: String): SecretKeySpec {
    val peer = importPeerPublicKey(peerPublicBase64)
    val agreement = KeyAgreement.getInstance("ECDH")
    agreement.init(self.privateKey)
    agreement.doPhase(peer, true)
    val shared = agreement.generateSecret()
    val raw = hkdfSha256(
        shared,
        HKDF_SALT.toByteArray(Charsets.UTF_8),
        HKDF_INFO.toByteArray(Charsets.UTF_8),
    )
    return SecretKeySpec(raw, "AES")
}

private fun buildAad(conversationId: String, senderId: String): ByteArray =
    "starstask-dm-v2|$conversationId|$senderId|$KEY_EPOCH".toByteArray(Charsets.UTF_8)

private data class ParsedWire(val version: Int, val iv: ByteArray, val cipher: ByteArray)

private fun parseWire(wire: String): ParsedWire? {
    val isV2 = wire.startsWith("v2:")
    val rest = if (isV2) wire.removePrefix("v2:") else wire
    val sep = rest.indexOf(':')
    if (sep <= 0) return null
    val ivPart = rest.substring(0, sep)
    val cipherPart = rest.substring(sep + 1)
    if (ivPart.isEmpty() || cipherPart.isEmpty() || cipherPart.contains(':')) return null
    return try {
        val iv = unb64(ivPart)
        val cipher = unb64(cipherPart)
        if (iv.size != IV_BYTES || cipher.isEmpty()) null
        else ParsedWire(if (isV2) 2 else 1, iv, cipher)
    } catch (_: Exception) {
        null
    }
}

fun isValidDmWire(wire: String): Boolean = parseWire(wire) != null

fun encryptDmMessage(
    self: DeviceKeyPair,
    peerPublicBase64: String,
    plaintext: String,
    conversationId: String,
    senderId: String,
): String {
    require(plaintext.length in 1..2000) { "Message must be 1-2000 characters." }
    val key = deriveAesKey(self, peerPublicBase64)
    val iv = ByteArray(IV_BYTES).also { SecureRandom().nextBytes(it) }
    val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
    cipher.updateAAD(buildAad(conversationId, senderId))
    val encrypted = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
    return "v2:${b64(iv)}:${b64(encrypted)}"
}

fun decryptDmMessage(
    self: DeviceKeyPair,
    peerPublicBase64: String,
    wire: String,
    conversationId: String,
    senderId: String,
): String {
    val parsed = parseWire(wire) ?: throw IllegalStateException("Invalid ciphertext format")
    if (parsed.version == 2 && conversationId.isBlank()) {
        throw IllegalStateException("Missing context for AAD-bound message")
    }
    val key = deriveAesKey(self, peerPublicBase64)
    val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(javax.crypto.Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, parsed.iv))
    // v1 legacy wires have no AAD.
    if (parsed.version == 2) cipher.updateAAD(buildAad(conversationId, senderId))
    return cipher.doFinal(parsed.cipher).toString(Charsets.UTF_8)
}
