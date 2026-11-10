package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.ui.components.GradientPillButton
import id.starstask.mobile.ui.theme.DashRadiusCardShape
import id.starstask.mobile.ui.theme.dashColors

@Composable
fun LeaveStatsGrid(requests: List<LeaveRequest>) {
    val palette = dashColors()
    val stats = listOf(
        LeaveStat("Pending", requests.count { it.status == "submitted" }, Lucide.Clock, palette.tileBlueBackground, palette.tileBlueForeground),
        LeaveStat("Approved", requests.count { it.status == "approved" }, Lucide.CircleCheck, palette.tileGreenBackground, palette.tileGreenForeground),
        LeaveStat("Rejected", requests.count { it.status == "rejected" }, Lucide.XCircle, palette.alertBackground, palette.alertText),
        LeaveStat("Draft", requests.count { it.status == "draft" }, Lucide.FileText, palette.chip, palette.muted),
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(DashRadiusCardShape)
            .background(palette.card)
            .border(1.dp, palette.cardBorder, DashRadiusCardShape)
            .padding(vertical = Spacing.Block),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        stats.forEachIndexed { index, stat ->
            if (index > 0) {
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(44.dp)
                        .background(palette.cardBorder),
                )
            }
            LeaveStatCell(stat, modifier = Modifier.weight(1f))
        }
    }
}

data class LeaveStat(
    val label: String,
    val count: Int,
    val icon: ImageVector,
    val background: Color,
    val foreground: Color,
)

@Composable
private fun LeaveStatCell(stat: LeaveStat, modifier: Modifier = Modifier) {
    val palette = dashColors()
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(
            modifier = Modifier
                .clip(CircleShape)
                .background(stat.background)
                .size(28.dp),
            contentAlignment = Alignment.Center,
        ) {
            Icon(stat.icon, contentDescription = null, tint = stat.foreground, modifier = Modifier.size(15.dp))
        }
        Text(
            "${stat.count}",
            color = palette.text,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 22.sp,
        )
        Text(stat.label, color = palette.muted, fontSize = 12.sp, lineHeight = 14.sp)
    }
}

@Composable
fun LeaveEmptyState(onNewRequest: () -> Unit) {
    val palette = dashColors()
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        LeaveEmptyIllustration(modifier = Modifier.padding(vertical = Spacing.Md))
        Text(
            "No leave requests yet",
            color = palette.text,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "You haven't submitted any leave requests. Create a new request to get started.",
            color = palette.muted,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            textAlign = TextAlign.Center,
        )
        GradientPillButton(
            label = "New Leave Request",
            onClick = onNewRequest,
            icon = Lucide.Plus,
            modifier = Modifier.padding(top = Spacing.Md),
            fillMaxWidth = false,
        )
    }
}

@Composable
fun LeaveApprovalInfoCard() {
    val palette = dashColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(DashRadiusCardShape)
            .background(palette.tileBlueBackground)
            .padding(Spacing.Block),
        horizontalArrangement = Arrangement.spacedBy(Spacing.Lg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Lucide.Info,
            contentDescription = null,
            tint = palette.accent,
            modifier = Modifier.size(20.dp),
        )
        Text(
            "A requested leave must be approved by your lecturer. Once approved, you'll be notified and the leave will be recorded.",
            color = palette.muted,
            fontSize = 13.sp,
            lineHeight = 18.sp,
        )
    }
}
