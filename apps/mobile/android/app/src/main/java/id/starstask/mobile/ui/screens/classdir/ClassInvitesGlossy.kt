package id.starstask.mobile.ui.screens.classdir

// Class invitations (admin). Creating one link returns the raw token exactly
// once — it is copied or noted by the admin and never shown again.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.CreatedInvite
import id.starstask.mobile.data.ManagedInvite
import id.starstask.mobile.data.createClassInvite
import id.starstask.mobile.data.listClassInvites
import id.starstask.mobile.data.revokeClassInvite
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch

@Composable
fun ClassInvitesGlossy(
    classId: String,
    className: String,
    onBack: () -> Unit,
) {
    val palette = mockColors()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current

    var reloadTick by remember { mutableIntStateOf(0) }
    var creating by remember { mutableStateOf(false) }
    var actionBusy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var created by remember { mutableStateOf<CreatedInvite?>(null) }
    var confirmRevoke by remember { mutableStateOf<ManagedInvite?>(null) }

    var expiresInDays by remember { mutableStateOf(7) }
    var maxUses by remember { mutableStateOf(1) }
    var emailRestriction by remember { mutableStateOf("") }

    val state by produceState(initialValue = InvitesState(), key1 = classId, key2 = reloadTick) {
        value = try {
            InvitesState(items = listClassInvites(classId), loading = false)
        } catch (_: Exception) {
            InvitesState(loading = false, failed = true)
        }
    }

    val inviteUrl = created?.let { "starstask://invite/${it.token}" }

    GlossyBackSurface(
        title = "Invitations",
        subtitle = "Links people can use to join $className.",
        onBack = onBack,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (error != null) WebAlert(message = error!!)

            if (creating) {
                CreateInviteCard(
                    expiresInDays = expiresInDays,
                    maxUses = maxUses,
                    emailRestriction = emailRestriction,
                    onExpiresChange = { expiresInDays = it },
                    onMaxUsesChange = { maxUses = it },
                    onEmailChange = { emailRestriction = it },
                    onCancel = { creating = false },
                    onCreate = {
                        scope.launch {
                            actionBusy = true
                            error = null
                            runCatching {
                                createClassInvite(
                                    classId = classId,
                                    expiresInDays = expiresInDays,
                                    maxUses = maxUses,
                                    emailRestriction = emailRestriction.trim().takeIf { it.isNotEmpty() },
                                )
                            }.onSuccess { created = it; creating = false; reloadTick++ }
                                .onFailure { error = userFacingMessage(it, "Could not create the invitation link.") }
                            actionBusy = false
                        }
                    },
                    busy = actionBusy,
                    palette = palette,
                )
            } else if (created == null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(palette.accentSofter)
                        .clickable { creating = true }
                        .heightIn(min = 56.dp)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Lucide.Link2, contentDescription = null, tint = palette.accent, modifier = Modifier.size(19.dp))
                        Text("Create invite link", color = palette.accent, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            when {
                state.loading -> GlossyLoadingRow()
                state.failed -> GlossyErrorRow("Could not load the invitations.", onRetry = { reloadTick++ })
                state.items.isEmpty() -> Text(
                    "No invitation links yet. Create one to share with people who should join.",
                    color = palette.muted,
                    fontSize = 13.sp,
                )
                else -> state.items.forEach { invite ->
                    InviteRow(
                        invite = invite,
                        palette = palette,
                        onRevoke = { confirmRevoke = invite },
                    )
                    GlossyHairline(palette)
                }
            }
        }
    }

    created?.let { invite ->
        AlertDialog(
            onDismissRequest = { created = null },
            title = { Text("Invite link created") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "This link is shown once. Copy it now — it cannot be recovered later.",
                        color = palette.riskFg,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(palette.chip)
                            .padding(12.dp),
                    ) {
                        Text(invite.token, color = palette.ink, fontSize = 12.sp, lineHeight = 17.sp)
                    }
                    Text(
                        "Expires ${id.starstask.mobile.data.formatDateShort(invite.expiresAt)} · ${invite.maxUses} use${if (invite.maxUses == 1) "" else "s"}",
                        color = palette.muted,
                        fontSize = 12.sp,
                    )
                }
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TextButton(onClick = { clipboard.setText(androidx.compose.ui.text.AnnotatedString(invite.token)) }) {
                        Text("Copy code")
                    }
                    TextButton(onClick = {
                        clipboard.setText(androidx.compose.ui.text.AnnotatedString(inviteUrl ?: invite.token))
                    }) {
                        Text("Copy link")
                    }
                    TextButton(onClick = { created = null }) {
                        Text("Done")
                    }
                }
            },
        )
    }

    confirmRevoke?.let { invite ->
        AlertDialog(
            onDismissRequest = { confirmRevoke = null },
            title = { Text("Revoke this invite?") },
            text = { Text("People who have not used it yet will no longer be able to join with it.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmRevoke = null
                    scope.launch {
                        actionBusy = true
                        val message = runCatching { revokeClassInvite(invite.id) }
                            .exceptionOrNull()
                            ?.let { err -> userFacingMessage(err, "Could not revoke the invite.") }
                        if (message != null) error = message
                        actionBusy = false
                        reloadTick++
                    }
                }) { Text("Revoke") }
            },
            dismissButton = {
                TextButton(onClick = { confirmRevoke = null }) { Text("Cancel") }
            },
        )
    }
}

private data class InvitesState(
    val items: List<ManagedInvite> = emptyList(),
    val loading: Boolean = true,
    val failed: Boolean = false,
)

@Composable
private fun CreateInviteCard(
    expiresInDays: Int,
    maxUses: Int,
    emailRestriction: String,
    onExpiresChange: (Int) -> Unit,
    onMaxUsesChange: (Int) -> Unit,
    onEmailChange: (String) -> Unit,
    onCancel: () -> Unit,
    onCreate: () -> Unit,
    busy: Boolean,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("Create invite link", color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)

        NumberChipRow(label = "Expiry", options = listOf(1, 7, 30, 90), selected = expiresInDays, suffix = "days", onSelect = onExpiresChange, palette = palette)
        NumberChipRow(label = "Max uses", options = listOf(1, 5, 20, 100), selected = maxUses, suffix = "", onSelect = onMaxUsesChange, palette = palette)

        OutlinedTextField(
            value = emailRestriction,
            onValueChange = onEmailChange,
            singleLine = true,
            label = { Text("Restrict to email (optional)") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
        )

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TextButton(onClick = onCancel, enabled = !busy) { Text("Cancel") }
            TextButton(onClick = onCreate, enabled = !busy) { Text(if (busy) "Creating…" else "Create link") }
        }
    }
}

@Composable
private fun NumberChipRow(
    label: String,
    options: List<Int>,
    selected: Int,
    suffix: String,
    onSelect: (Int) -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = palette.muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { option ->
                val active = selected == option
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (active) palette.accent else palette.chip)
                        .clickable { onSelect(option) }
                        .heightIn(min = 34.dp)
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                ) {
                    Text(
                        if (suffix.isBlank()) "$option" else "$option $suffix",
                        color = if (active) androidx.compose.ui.graphics.Color.White else palette.ink,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun InviteRow(
    invite: ManagedInvite,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onRevoke: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                invite.emailRestriction?.let { "Restricted to $it" } ?: "Open link",
                color = palette.ink,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                "${invite.usedCount}/${invite.maxUses} used · expires ${id.starstask.mobile.data.formatDateShort(invite.expiresAt)}",
                color = palette.muted,
                fontSize = 12.sp,
            )
            StatusChip(invite, palette)
        }
        if (invite.isActive) {
            Text(
                "Revoke",
                color = palette.riskFg,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .clickable(onClick = onRevoke)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}

@Composable
private fun StatusChip(invite: ManagedInvite, palette: id.starstask.mobile.ui.theme.MockPalette) {
    val (label, bg, fg) = when {
        invite.isRevoked -> Triple("Revoked", palette.riskBg, palette.riskFg)
        invite.isExpired -> Triple("Expired", palette.chip, palette.muted)
        else -> Triple("Active", palette.goodBg, palette.goodFg)
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 2.dp),
    ) {
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}
