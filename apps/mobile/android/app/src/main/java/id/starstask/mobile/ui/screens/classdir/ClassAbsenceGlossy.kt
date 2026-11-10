package id.starstask.mobile.ui.screens.classdir

// Absence tab: personal attendance recap limited to this class (the web
// student UI is server-gated too — there is no member recap RPC), plus an
// admin-only inbox of leave requests awaiting review.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.formatLeaveDateRange
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.loadAttendanceHistory
import id.starstask.mobile.data.loadPendingLeaveForClass
import id.starstask.mobile.data.summarizeRecap
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassAbsenceGlossy(
    clazz: ClassDetail,
    userId: String,
    isAdmin: Boolean,
    onOpenLeaveRequest: (String) -> Unit,
    onExportRecap: () -> Unit,
) {
    val palette = mockColors()
    var present by remember { mutableStateOf(0) }
    var excused by remember { mutableStateOf(0) }
    var absent by remember { mutableStateOf(0) }
    var percentage by remember { mutableStateOf(0) }
    var pending by remember { mutableStateOf<List<LeaveRequest>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(clazz.id, userId, isAdmin) {
        loading = true
        error = null
        runCatching {
            val history = loadAttendanceHistory(userId).filter { it.className == clazz.name }
            val recap = summarizeRecap(history)
            present = recap.present
            excused = recap.excused
            absent = recap.absent
            percentage = recap.percentage
            if (isAdmin) pending = loadPendingLeaveForClass(clazz.id)
        }.onFailure {
            error = "Could not load absence data."
        }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        GlossyAbsenceTitle("Attendance", palette)
        if (error != null) {
            Text(error!!, color = palette.muted, fontSize = 13.sp)
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .padding(16.dp),
        ) {
            if (loading) {
                Box(modifier = Modifier.fillMaxWidth().padding(12.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = palette.accent)
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                        AbsenceCell(label = "Present", value = present.toString(), palette = palette)
                        AbsenceCell(label = "Excused", value = excused.toString(), palette = palette)
                        AbsenceCell(label = "Absent", value = absent.toString(), palette = palette)
                    }
                    Text(
                        "$percentage% present",
                        color = palette.ink,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (isAdmin) {
                        Row(
                            modifier = Modifier
                                .clip(androidx.compose.foundation.shape.RoundedCornerShape(14.dp))
                                .background(palette.accentSofter)
                                .clickable(onClick = onExportRecap)
                                .padding(horizontal = 12.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(Lucide.Download, contentDescription = null, tint = palette.accent, modifier = Modifier.size(15.dp))
                            Text("Export attendance recap", color = palette.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        if (isAdmin) {
            GlossyAbsenceTitle("Pending review", palette)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                    .background(palette.card)
                    .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp)),
            ) {
                if (!loading && pending.isEmpty()) {
                    Text("No requests waiting for review.", color = palette.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp))
                } else if (!loading) {
                    Column {
                        pending.forEachIndexed { index, request ->
                            if (index > 0) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(1.dp)
                                        .background(palette.hairline),
                                )
                            }
                            PendingLeaveRow(request = request, onOpen = { onOpenLeaveRequest(request.id) }, palette = palette)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AbsenceCell(label: String, value: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, color = palette.ink, fontSize = 20.sp, fontWeight = FontWeight.Bold, lineHeight = 22.sp)
        Text(label, color = palette.muted, fontSize = 11.sp)
    }
}

@Composable
private fun PendingLeaveRow(
    request: LeaveRequest,
    onOpen: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val initials = request.studentName.split(" ")
            .mapNotNull { it.firstOrNull()?.uppercaseChar() }
            .take(2)
            .joinToString("")
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(palette.accentSofter),
            contentAlignment = Alignment.Center,
        ) {
            Text(initials, color = palette.accent, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(request.studentName, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            Text(formatLeaveDateRange(request.leaveStart, request.leaveEnd), color = palette.muted, fontSize = 12.sp)
            Text(leaveReasonLabel(request.reason), color = palette.muted, fontSize = 11.sp)
        }
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun GlossyAbsenceTitle(text: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    Text(
        text,
        color = palette.ink,
        fontSize = 18.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 4.dp),
    )
}
