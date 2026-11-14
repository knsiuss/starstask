package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.WorkspaceRequest
import id.starstask.mobile.data.formatCreatedDate
import id.starstask.mobile.data.requestFeedback
import id.starstask.mobile.data.requestStatusLabel
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.Muted
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Spacing

val SCHEDULE_STATUSES = listOf(
    "all" to "All statuses",
    "published" to "Published",
    "upcoming" to "Upcoming deadline",
    "overdue" to "Past deadline",
    "no_deadline" to "No deadline",
)

val REVIEW_STATUSES = listOf(
    "pending_review" to "Pending review",
    "rejected" to "Rejected",
    "draft" to "Draft",
)

val SORTS = listOf(
    "newest" to "Newest first",
    "oldest" to "Oldest first",
    "deadline" to "Nearest deadline",
)

data class AssignmentsTab(val label: String, val key: String, val count: Int)

@Composable
fun WorkspaceTabs(
    tab: String,
    onTabChange: (String) -> Unit,
    tabs: List<AssignmentsTab>,
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(end = Spacing.Md),
            horizontalArrangement = Arrangement.spacedBy(Spacing.Lg),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            tabs.forEach { spec ->
                val key = spec.key
                val active = key == tab
                Column(
                    modifier = Modifier
                        .clickable { onTabChange(key) }
                        .padding(horizontal = Spacing.Xl, vertical = Spacing.Lg),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.Sm),
                    ) {
                        Text(
                            spec.label,
                            color = if (active) Accent else MutedForeground,
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                            maxLines = 1,
                        )
                        Box(
                            modifier = Modifier
                                .background(
                                    if (active) AccentSoft else Muted,
                                    RoundedCornerShape(999.dp),
                                )
                                .padding(horizontal = Spacing.Md, vertical = Spacing.Xs),
                        ) {
                            Text(
                                spec.count.toString(),
                                color = if (active) Accent else MutedForeground,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                            )
                        }
                    }
                    Box(
                        modifier = Modifier
                            .padding(top = 8.dp)
                            .background(
                                if (active) Accent else androidx.compose.ui.graphics.Color.Transparent,
                                RoundedCornerShape(1.dp),
                            )
                            .padding(vertical = 1.dp)
                            .height(2.dp),
                    )
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(Border))
    }
}

@Composable
fun RequestsSection(
    manages: Boolean,
    myRequests: List<WorkspaceRequest>,
    managedRequests: List<WorkspaceRequest>,
    onReview: (WorkspaceRequest) -> Unit,
    onOpenApproved: (WorkspaceRequest) -> Unit,
) {
    if (!manages) {
        if (myRequests.isEmpty()) {
            WebEmptyState(title = "You haven't submitted any publication requests yet.", description = "Requests you send to a class admin will be tracked here.")
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
                myRequests.forEach { RequestCard(request = it, admin = false, onReview = {}, onView = onOpenApproved) }
            }
        }
        return
    }
    val toReview = managedRequests.filter { it.displayStatus == id.starstask.mobile.data.RequestDisplayStatus.PENDING }
    val decided = managedRequests.filter { it.displayStatus != id.starstask.mobile.data.RequestDisplayStatus.PENDING }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        WebSectionTitle("Requests to review")
        if (toReview.isEmpty()) {
            WebEmptyState(title = "No publication requests yet.", description = "Student requests will appear here when submitted.")
        } else {
            toReview.forEach { RequestCard(request = it, admin = true, onReview = onReview, onView = onOpenApproved) }
        }
        if (decided.isNotEmpty()) {
            WebSectionTitle("Recently decided")
            decided.forEach { RequestCard(request = it, admin = true, onReview = {}, onView = onOpenApproved) }
        }
        if (myRequests.isNotEmpty()) {
            WebSectionTitle("My requests")
            myRequests.forEach { RequestCard(request = it, admin = false, onReview = {}, onView = onOpenApproved) }
        }
    }
}

@Composable
fun RequestCard(
    request: WorkspaceRequest,
    admin: Boolean,
    onReview: (WorkspaceRequest) -> Unit,
    onView: (WorkspaceRequest) -> Unit,
) {
    val feedback = requestFeedback(request.status, request.rejectionReason)
    val submitted = formatCreatedDate(request.createdAt)
    val variant = when (request.displayStatus) {
        id.starstask.mobile.data.RequestDisplayStatus.PENDING -> BadgeVariant.WARNING
        id.starstask.mobile.data.RequestDisplayStatus.APPROVED -> BadgeVariant.SUCCESS
        id.starstask.mobile.data.RequestDisplayStatus.REJECTED -> BadgeVariant.DANGER
        id.starstask.mobile.data.RequestDisplayStatus.REVISION_REQUESTED -> BadgeVariant.WARNING
    }
    WebCard {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md), verticalAlignment = Alignment.CenterVertically) {
                StarsTaskBadge(label = requestStatusLabel(request.displayStatus), variant = variant)
                Text(
                    request.courseName + (request.classCode?.let { " · $it" } ?: ""),
                    color = MutedForeground,
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 1,
                    modifier = Modifier.weight(1f),
                )
                if (admin && !request.submitterName.isNullOrBlank()) {
                    Text("by ${request.submitterName}", color = MutedForeground, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                }
            }
            Text(request.title, color = Foreground, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(
                "${request.className} · ${request.deadline?.let { "Proposed ${formatCreatedDate(it)}" } ?: "No deadline proposed"} · Submitted $submitted",
                color = MutedForeground,
                style = MaterialTheme.typography.labelSmall,
            )
            if (admin && request.displayStatus == id.starstask.mobile.data.RequestDisplayStatus.PENDING) {
                WebButton(label = "Review", onClick = { onReview(request) }, variant = WebButtonVariant.SECONDARY)
            }
            if (request.displayStatus == id.starstask.mobile.data.RequestDisplayStatus.APPROVED) {
                WebButton(label = "View →", onClick = { onView(request) }, variant = WebButtonVariant.LINK)
            }
            if (!feedback.isNullOrBlank()) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xxs)) {
                    Text("Admin feedback", color = MutedForeground, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
                    Text(feedback, color = Foreground, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
fun PaginationRow(page: Int, totalPages: Int, onPage: (Int) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
    ) {
        Text("Page $page of $totalPages", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md), verticalAlignment = Alignment.CenterVertically) {
            WebButton(label = "Previous", onClick = { onPage((page - 1).coerceAtLeast(1)) }, variant = WebButtonVariant.SECONDARY, enabled = page > 1)
            WebButton(label = "Next", onClick = { onPage((page + 1).coerceAtMost(totalPages)) }, variant = WebButtonVariant.SECONDARY, enabled = page < totalPages)
        }
    }
}
