package id.starstask.mobile.ui.screens

import androidx.compose.foundation.lazy.LazyListScope
import id.starstask.mobile.data.AcademicCard
import id.starstask.mobile.data.Invitation

// Bottom sections: invitations and academic identity.

fun LazyListScope.homeBottomSections(
    invitations: List<Invitation>,
    invitationFeedback: String?,
    invitationBusyId: String?,
    onAccept: (Invitation) -> Unit,
    onDecline: (Invitation) -> Unit,
    academicCard: AcademicCard?,
    onOpenUniversity: () -> Unit,
) {
    // Academic identity card intentionally not rendered on dashboard.
    if (invitations.isNotEmpty()) {
        invitationsSection(
            invitations = invitations,
            feedback = invitationFeedback,
            busyId = invitationBusyId,
            onAccept = onAccept,
            onDecline = onDecline,
        )
    }

}
