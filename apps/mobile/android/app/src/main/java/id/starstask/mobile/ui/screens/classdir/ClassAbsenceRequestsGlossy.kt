package id.starstask.mobile.ui.screens.classdir

// Absence requests push: every leave request filed against this class (not only
// pending ones), filterable by status. Tapping a row opens the existing review
// screen (LeaveRequestDetailScreen) via the scaffold.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.formatLeaveDateRange
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.loadClassLeaveRequests
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

private val STATUS_FILTERS = listOf(
    "submitted" to "Submitted",
    "approved" to "Approved",
    "revision_requested" to "Revision",
    "rejected" to "Rejected",
    "forwarded" to "Forwarded",
)

@Composable
fun ClassAbsenceRequestsGlossy(
    classId: String,
    onBack: () -> Unit,
    onOpenRequest: (String) -> Unit,
) {
    val palette = mockColors()
    var statusFilter by remember { mutableStateOf<String?>(null) }
    var reloadTick by remember { androidx.compose.runtime.mutableIntStateOf(0) }

    val state by produceState(initialValue = RequestsState(), key1 = classId, key2 = reloadTick) {
        value = try {
            RequestsState(requests = loadClassLeaveRequests(classId), loading = false)
        } catch (_: Exception) {
            RequestsState(loading = false, failed = true)
        }
    }

    val requests = state.requests
    val loading = state.loading
    val failed = state.failed

    val visible = if (statusFilter == null) requests else requests.filter { it.status == statusFilter }

    GlossyBackSurface(
        title = "Absence requests",
        subtitle = "Leave requests filed against this class. Newest first.",
        onBack = onBack,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            FilterChipRow(
                selected = statusFilter,
                counts = requests.groupingBy { it.status }.eachCount(),
                onSelect = { statusFilter = if (statusFilter == it) null else it },
                palette = palette,
            )
            when {
                loading -> GlossyLoadingRow()
                failed -> GlossyErrorRow("Could not load the absence requests.", onRetry = { reloadTick++ })
                visible.isEmpty() -> Text(
                    if (statusFilter == null) "No absence requests yet." else "No requests with this status.",
                    color = palette.muted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
                else -> visible.forEach { request ->
                    RequestRow(request = request, palette = palette, onClick = { onOpenRequest(request.id) })
                }
            }
        }
    }
}

@Composable
private fun FilterChipRow(
    selected: String?,
    counts: Map<String, Int>,
    onSelect: (String) -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        STATUS_FILTERS.forEach { (key, label) ->
            val active = selected == key
            val count = counts[key] ?: 0
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (active) palette.accent else palette.chip)
                    .clickable { onSelect(key) }
                    .padding(horizontal = 12.dp, vertical = 7.dp),
            ) {
                Text(
                    "$label${if (count > 0) " · $count" else ""}",
                    color = if (active) androidx.compose.ui.graphics.Color.White else palette.ink,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun RequestRow(
    request: LeaveRequest,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .clip(RoundedCornerShape(18.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(18.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val initials = request.studentName.split(" ")
            .mapNotNull { it.firstOrNull()?.uppercaseChar() }
            .take(2)
            .joinToString("")
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(palette.accentSofter),
            contentAlignment = Alignment.Center,
        ) {
            Text(initials.ifBlank { "?" }, color = palette.accent, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(request.studentName, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(formatLeaveDateRange(request.leaveStart, request.leaveEnd), color = palette.muted, fontSize = 12.sp)
            Text(leaveReasonLabel(request.reason), color = palette.muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        StatusPill(request.status, palette)
    }
}

@Composable
private fun StatusPill(status: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    val (label, bg, fg) = when (status) {
        "approved" -> Triple("Approved", palette.goodBg, palette.goodFg)
        "rejected" -> Triple("Rejected", palette.riskBg, palette.riskFg)
        "revision_requested" -> Triple("Revision", palette.fairBg, palette.fairFg)
        "forwarded" -> Triple("Forwarded", palette.accentSofter, palette.accent)
        else -> Triple("Pending", palette.chip, palette.muted)
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

private data class RequestsState(
    val requests: List<LeaveRequest> = emptyList(),
    val loading: Boolean = true,
    val failed: Boolean = false,
)
