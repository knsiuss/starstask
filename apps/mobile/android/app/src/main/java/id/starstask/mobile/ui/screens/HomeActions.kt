package id.starstask.mobile.ui.screens

import androidx.compose.runtime.Composable
import id.starstask.mobile.data.CheckInResult
import id.starstask.mobile.data.Invitation
import id.starstask.mobile.data.SessionRow
import id.starstask.mobile.data.acceptPendingInvitation
import id.starstask.mobile.data.declineInvitation
import id.starstask.mobile.data.loadSessionById
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

// Invitation + check-in actions for Home. Extracted to keep HomeScreen <300 lines.

fun acceptInvitationAction(
    invitation: Invitation,
    invitations: List<Invitation>,
    onBusyChange: (String?) -> Unit,
    onFeedback: (String?) -> Unit,
    onInvitationsChange: (List<Invitation>) -> Unit,
    scope: CoroutineScope,
) {
    onBusyChange(invitation.id)
    onFeedback(null)
    scope.launch {
        try {
            acceptPendingInvitation(invitation.id)
            onInvitationsChange(invitations.filter { it.id != invitation.id })
            onFeedback("Joined ${invitation.className ?: "the class"}! You now have access to all its subjects.")
        } catch (_: Exception) {
            onFeedback("Could not accept this invitation. Please try again.")
        } finally {
            onBusyChange(null)
        }
    }
}

fun declineInvitationAction(
    invitation: Invitation,
    invitations: List<Invitation>,
    onBusyChange: (String?) -> Unit,
    onFeedback: (String?) -> Unit,
    onInvitationsChange: (List<Invitation>) -> Unit,
    scope: CoroutineScope,
) {
    onBusyChange(invitation.id)
    onFeedback(null)
    scope.launch {
        try {
            declineInvitation(invitation.id)
            onInvitationsChange(invitations.filter { it.id != invitation.id })
            onFeedback("Declined ${invitation.className ?: "the invitation"}.")
        } catch (_: Exception) {
            onFeedback("Could not decline this invitation. Please try again.")
        } finally {
            onBusyChange(null)
        }
    }
}

fun openSessionAction(
    sessionId: String,
    onLoaded: (SessionRow?) -> Unit,
    onError: (String) -> Unit,
    scope: CoroutineScope,
) {
    scope.launch {
        val row = runCatching { loadSessionById(sessionId) }.getOrNull()
        if (row != null) onLoaded(row) else onError("Could not open that session.")
    }
}

fun doCheckInAction(
    sessionId: String,
    onCheckIn: suspend (String) -> CheckInResult,
    onFeedback: (String) -> Unit,
    scope: CoroutineScope,
) {
    scope.launch {
        val result = onCheckIn(sessionId)
        onFeedback(result.message ?: if (result.ok) "Checked in." else "Check-in failed.")
    }
}
