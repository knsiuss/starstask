package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.starstask.mobile.R
import id.starstask.mobile.data.AcademicCard
import id.starstask.mobile.data.DashboardClass
import id.starstask.mobile.data.DashboardData
import id.starstask.mobile.data.DashboardSession
import id.starstask.mobile.data.Invitation
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.NextScheduleItem
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.ScheduleEntry
import id.starstask.mobile.data.acceptPendingInvitation
import id.starstask.mobile.data.declineInvitation
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.jakartaDate
import id.starstask.mobile.data.loadAcademicCard
import id.starstask.mobile.data.loadDashboard
import id.starstask.mobile.data.loadInvitations
import id.starstask.mobile.data.loadLeaveRequests
import id.starstask.mobile.data.loadNextSchedule
import id.starstask.mobile.data.loadNotifications
import id.starstask.mobile.data.loadSchedule
import id.starstask.mobile.ui.components.WebCompactCard
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Band
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedFill
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.StarsTaskTheme
import id.starstask.mobile.ui.theme.Subtle
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Warning
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun AttentionBanner(pastDeadline: Int, onReview: () -> Unit, modifier: Modifier = Modifier) {
    WebCompactCard(modifier = modifier.fillMaxWidth(), containerColor = DangerSoft) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Xl),
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Surface)
                    .padding(horizontal = Spacing.Md, vertical = Spacing.Sm),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Lucide.TriangleAlert,
                    contentDescription = null,
                    tint = Danger,
                    modifier = Modifier.size(18.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "$pastDeadline ${if (pastDeadline == 1) "task" else "tasks"} past deadline",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Foreground,
                )
                Text(
                    "Deadlines that have already passed in your classes. Worth checking whether any of them still accept late work.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(
                "Review overdue ›",
                color = Danger,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.clickable(onClick = onReview),
            )
        }
    }
}

@Composable
fun WhatsNewBanner(onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    WebCompactCard(modifier = modifier.fillMaxWidth(), containerColor = AccentSoft) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Surface)
                    .padding(horizontal = Spacing.Md, vertical = Spacing.Sm),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Lucide.Star,
                    contentDescription = null,
                    tint = Accent,
                    modifier = Modifier.size(18.dp),
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.Xxs)) {
                Text("What's new", style = MaterialTheme.typography.bodyMedium, color = Foreground)
                Text(
                    "Encrypted direct messages and GPS check-in are now on mobile.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    "Page transitions and loading skeletons — navigation no longer feels frozen.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    "GPS check-in failed? Your class admin can now mark you present manually.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(
                "✕",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.clickable(onClick = onDismiss),
            )
        }
    }
}

@Composable
fun AcademicIdentityCard(card: AcademicCard, onClick: (() -> Unit)? = null) {
    WebCompactCard(modifier = Modifier.fillMaxWidth(), onClick = onClick) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Xl), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Lucide.GraduationCap,
                contentDescription = null,
                tint = if (card.linked) Accent else MutedForeground,
                modifier = Modifier.size(24.dp),
            )
            Column(modifier = Modifier.weight(1f)) {
                if (card.linked) {
                    Text(
                        card.universityName + if (card.studentId != null) " - ${card.studentId}" else "",
                        color = Foreground,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        (card.homeClassName?.let { "Home class: $it" } ?: "No home class assigned yet") + " - View academic identity",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                } else {
                    Text("Not linked to a university yet", color = Foreground, style = MaterialTheme.typography.bodyMedium)
                    Text(
                        "Find your university and request access from its operator.",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

// UnpamWidget removed.

