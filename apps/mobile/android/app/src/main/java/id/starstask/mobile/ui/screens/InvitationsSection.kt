package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.components.WebSectionTitle
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.Invitation
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebAlertVariant
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCompactCard
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground

fun LazyListScope.invitationsSection(
    invitations: List<Invitation>,
    feedback: String?,
    busyId: String?,
    onAccept: (Invitation) -> Unit,
    onDecline: (Invitation) -> Unit,
) {
    if (invitations.isEmpty() && feedback == null) return
    item {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            Text("✉", color = Accent, style = MaterialTheme.typography.bodyMedium)
            WebSectionTitle("Pending invitations")
            StarsTaskBadge(label = "${invitations.size}", variant = BadgeVariant.ACCENT)
        }
    }
    item {
        Text(
            "Invitations to join class groups. Accepting adds you to the group and all its subjects.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
    }
    if (feedback != null) {
        item { WebAlert(message = feedback, variant = WebAlertVariant.INFO) }
    }
    items(invitations, key = { it.id }) { invitation ->
        val busy = busyId == invitation.id
        WebCompactCard(modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(invitation.className ?: "Class invitation", color = Foreground, style = MaterialTheme.typography.bodyMedium)
                        if (invitation.classSlug != null) {
                            Text(invitation.classSlug, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                Text("🛡 Invited by ${invitation.adminName ?: "Class Admin"}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                if (invitation.expiresAt != null) {
                    Text("🕐 Expires ${invitation.expiresAt!!.take(10)}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md), modifier = Modifier.fillMaxWidth()) {
                    WebButton(
                        label = if (busy) "…" else "✓ Accept",
                        onClick = { onAccept(invitation) },
                        modifier = Modifier.weight(1f),
                        enabled = busyId == null,
                    )
                    WebButton(
                        label = "✕ Decline",
                        onClick = { onDecline(invitation) },
                        variant = WebButtonVariant.SECONDARY,
                        enabled = busyId == null,
                    )
                }
            }
        }
    }
}
