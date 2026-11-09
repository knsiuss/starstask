package id.starstask.mobile.data

import android.content.Context
import android.util.Base64
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.math.BigInteger
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.interfaces.ECPrivateKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPrivateKeySpec
import java.security.spec.ECPublicKeySpec
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Native mirror of web E2EE DM key management
 * (apps/web/src/lib/crypto/e2ee.ts, key-backup.ts,
 * apps/web/src/app/api/dm/keys/me/route.ts):
 * - ECDH P-256 keypair per device; the private half stays on this device
 *   (app-private prefs, the native analogue of IndexedDB).
 * - Public key (base64 raw 65-byte uncompressed point) published to
 *   `dm_keys`, exactly like web exportPublicKey.
 * - Safety fingerprint: SHA-256 of the base64 key string, uppercase hex
 *   grouped by 4, first 29 chars (web getSafetyFingerprint).
 * - Backup: `v2:600000:salt:iv:cipher` (PBKDF2-HmacSHA256 600k + AES-GCM)
 *   in `dm_key_backup`; restore also accepts web's legacy 100k format,
 *   so backups are interchangeable between web and Android.
 */

private const val E2EE_PREFS = "starstask-e2ee"
private const val KEY_D = "self_d"
private const val KEY_X = "self_x"
private const val KEY_Y = "self_y"
private const val BACKUP_VERSION = "v2"
private const val CURRENT_ITERATIONS = 600_000
private const val LEGACY_ITERATIONS = 100_000
private const val MIN_PASSPHRASE_LENGTH = 12

class DeviceKeyPair(
    val privateKey: ECPrivateKey,
    val publicKey: ECPublicKey,
) {
    fun publicKeyBase64(): String =
        Base64.encodeToString(rawUncompressedPoint(publicKey), Base64.NO_WRAP)
}

private fun ecParameterSpec(): ECParameterSpec {
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

private fun rawUncompressedPoint(publicKey: ECPublicKey): ByteArray {
    val out = ByteArray(65)
    out[0] = 4
    fixed32(publicKey.w.affineX).copyInto(out, 1)
    fixed32(publicKey.w.affineY).copyInto(out, 33)
    return out
}

private fun buildPair(scalar: ByteArray, x: ByteArray, y: ByteArray): DeviceKeyPair {
    val spec = ecParameterSpec()
    val d = BigInteger(1, scalar)
    val privateKey = java.security.KeyFactory.getInstance("EC")
        .generatePrivate(ECPrivateKeySpec(d, spec)) as ECPrivateKey
    val point = ECPoint(BigInteger(1, x), BigInteger(1, y))
    val publicKey = java.security.KeyFactory.getInstance("EC")
        .generatePublic(ECPublicKeySpec(point, spec)) as ECPublicKey
    return DeviceKeyPair(privateKey, publicKey)
}

private fun loadDeviceKeyPair(context: Context): DeviceKeyPair? {
    val prefs = context.getSharedPreferences(E2EE_PREFS, Context.MODE_PRIVATE)
    val d = prefs.getString(KEY_D, null) ?: return null
    val x = prefs.getString(KEY_X, null) ?: return null
    val y = prefs.getString(KEY_Y, null) ?: return null
    return buildPair(
        Base64.decode(d, Base64.NO_WRAP),
        Base64.decode(x, Base64.NO_WRAP),
        Base64.decode(y, Base64.NO_WRAP),
    )
}

private fun storeDeviceKeyPair(context: Context, pair: DeviceKeyPair) {
    val prefs = context.getSharedPreferences(E2EE_PREFS, Context.MODE_PRIVATE)
    prefs.edit()
        .putString(KEY_D, Base64.encodeToString(fixed32(pair.privateKey.s), Base64.NO_WRAP))
        .putString(KEY_X, Base64.encodeToString(fixed32(pair.publicKey.w.affineX), Base64.NO_WRAP))
        .putString(KEY_Y, Base64.encodeToString(fixed32(pair.publicKey.w.affineY), Base64.NO_WRAP))
        .apply()
}

fun getOrCreateDeviceKeyPair(context: Context): DeviceKeyPair {
    loadDeviceKeyPair(context)?.let { return it }
    val generator = java.security.KeyPairGenerator.getInstance("EC")
    generator.initialize(ECGenParameterSpec("secp256r1"), SecureRandom())
    val generated = generator.generateKeyPair()
    val pair = DeviceKeyPair(
        privateKey = generated.private as ECPrivateKey,
        publicKey = generated.public as ECPublicKey,
    )
    storeDeviceKeyPair(context, pair)
    return pair
}

fun safetyFingerprint(publicKeyBase64: String): String {
    val hash = MessageDigest.getInstance("SHA-256").digest(publicKeyBase64.toByteArray(Charsets.UTF_8))
    val hex = hash.joinToString("") { "%02X".format(it) }
    return hex.chunked(4).joinToString("-").take(29)
}

suspend fun loadOwnPublicKey(userId: String): String? {
    val rows = SupabaseProvider.client.postgrest.from("dm_keys").select {
        filter { eq("user_id", userId) }
        limit(1)
    }.decodeJsonArray()
    return rows.firstOrNull()?.jsonObject?.get("public_key")?.jsonPrimitive?.contentOrNull()
}

private suspend fun publishPublicKey(userId: String, publicKeyBase64: String) {
    SupabaseProvider.client.postgrest.from("dm_keys").upsert(
        buildJsonObject {
            put("user_id", JsonPrimitive(userId))
            put("public_key", JsonPrimitive(publicKeyBase64))
        },
        request = { select() },
    )
}

/**
 * Mirrors web SecurityPrivacyPanel load(): read the published key; if none,
 * generate the device keypair, publish it, and return its public key.
 */
suspend fun ensurePublishedDeviceKey(context: Context, userId: String): String {
    loadOwnPublicKey(userId)?.let { return it }
    val pair = getOrCreateDeviceKeyPair(context)
    val pub = pair.publicKeyBase64()
    publishPublicKey(userId, pub)
    return pub
}

private fun pbkdfKey(passphrase: String, salt: ByteArray, iterations: Int): SecretKeySpec {
    val spec = PBEKeySpec(passphrase.toCharArray(), salt, iterations, 256)
    return SecretKeySpec(
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded,
        "AES",
    )
}

private fun aesGcmEncrypt(key: SecretKeySpec, iv: ByteArray, plain: ByteArray): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
    return cipher.doFinal(plain)
}

private fun aesGcmDecrypt(key: SecretKeySpec, iv: ByteArray, cipherText: ByteArray): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
    return cipher.doFinal(cipherText)
}

suspend fun backupDeviceKey(context: Context, userId: String, passphrase: String) {
    require(passphrase.length >= MIN_PASSPHRASE_LENGTH) {
        "Passphrase must be at least $MIN_PASSPHRASE_LENGTH characters."
    }
    val pair = getOrCreateDeviceKeyPair(context)
    val jwkJson = buildJsonObject {
        put("d", Base64.encodeToString(fixed32(pair.privateKey.s), Base64.NO_WRAP))
        put("x", Base64.encodeToString(fixed32(pair.publicKey.w.affineX), Base64.NO_WRAP))
        put("y", Base64.encodeToString(fixed32(pair.publicKey.w.affineY), Base64.NO_WRAP))
    }.toString()
    val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
    val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
    val cipher = aesGcmEncrypt(pbkdfKey(passphrase, salt, CURRENT_ITERATIONS), iv, jwkJson.toByteArray(Charsets.UTF_8))
    val wrapped = listOf(
        BACKUP_VERSION,
        CURRENT_ITERATIONS.toString(),
        Base64.encodeToString(salt, Base64.NO_WRAP),
        Base64.encodeToString(iv, Base64.NO_WRAP),
        Base64.encodeToString(cipher, Base64.NO_WRAP),
    ).joinToString(":")
    SupabaseProvider.client.postgrest.from("dm_key_backup").upsert(
        buildJsonObject {
            put("user_id", JsonPrimitive(userId))
            put("wrapped_private_key", JsonPrimitive(wrapped))
            put("updated_at", JsonPrimitive(java.time.Instant.now().toString()))
        },
        request = { select() },
    )
}

suspend fun restoreDeviceKey(context: Context, userId: String, passphrase: String) {
    val rows = SupabaseProvider.client.postgrest.from("dm_key_backup").select {
        filter { eq("user_id", userId) }
        limit(1)
    }.decodeJsonArray()
    val wrapped = rows.firstOrNull()?.jsonObject?.get("wrapped_private_key")?.jsonPrimitive?.contentOrNull()
        ?: throw IllegalStateException("No backup found")
    val parts = wrapped.split(":")
    var iterations = LEGACY_ITERATIONS
    var saltB64: String? = parts.getOrNull(0)
    var ivB64: String? = parts.getOrNull(1)
    var cipherB64: String? = parts.getOrNull(2)
    if (parts.getOrNull(0) == BACKUP_VERSION) {
        iterations = parts.getOrNull(1)?.toIntOrNull()?.takeIf { it > 0 }
            ?: throw IllegalStateException("Invalid backup format")
        saltB64 = parts.getOrNull(2)
        ivB64 = parts.getOrNull(3)
        cipherB64 = parts.getOrNull(4)
    }
    if (saltB64 == null || ivB64 == null || cipherB64 == null) {
        throw IllegalStateException("Invalid backup format")
    }
    val plain = aesGcmDecrypt(
        pbkdfKey(passphrase, Base64.decode(saltB64, Base64.NO_WRAP), iterations),
        Base64.decode(ivB64, Base64.NO_WRAP),
        Base64.decode(cipherB64, Base64.NO_WRAP),
    )
    val jwk = kotlinx.serialization.json.Json.parseToJsonElement(plain.decodeToString()).jsonObject
    val pair = buildPair(
        Base64.decode(jwk["d"]!!.jsonPrimitive.content, Base64.NO_WRAP),
        Base64.decode(jwk["x"]!!.jsonPrimitive.content, Base64.NO_WRAP),
        Base64.decode(jwk["y"]!!.jsonPrimitive.content, Base64.NO_WRAP),
    )
    storeDeviceKeyPair(context, pair)
    publishPublicKey(userId, pair.publicKeyBase64())
}
