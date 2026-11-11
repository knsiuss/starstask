package id.starstask.mobile.ui.screens.classdir

// Attendance tab (class detail). Admin: create-session card, active meetings,
// quick actions (Attendance detail / Manage sessions / Absence requests),
// pending leave review inbox, all in the web workspace layout. Member: own
// recap scoped to this class, check-in for active meetings, recent history.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.AttendanceMeeting
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.formatLeaveDateRange
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.listAttendanceMeetings
import id.starstask.mobile.data.loadActiveAttendance
import id.starstask.mobile.data.loadClassRoster
import id.starstask.mobile.data.loadPendingLeaveForClass
import id.starstask.mobile.data.loadStudentAttendance
import id.starstask.mobile.data.loadAttendanceIdentity
import id.starstask.mobile.data.summarizeAttendance
import id.starstask.mobile.data.listClassCourses
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassAbsenceGlossy(
    clazz: ClassDetail,
    userId: String,
    isAdmin: Boolean,
    onOpenLeaveRequest: (String) -> Unit,
    onOpenAttendanceDetail: () -> Unit,
    onOpenManageSessions: () -> Unit,
    onOpenAbsenceRequests: () -> Unit,
    onOpenMeeting: (String) -> Unit,
) {
    if (isAdmin) {
        ClassAttendanceAdminView(
            clazz = clazz,
            onOpenLeaveRequest = onOpenLeaveRequest,
            onOpenAttendanceDetail = onOpenAttendanceDetail,
            onOpenManageSessions = onOpenManageSessions,
            onOpenAbsenceRequests = onOpenAbsenceRequests,
            onOpenMeeting = onOpenMeeting,
        )

    } else {
        ClassAbsenceMemberView(clazz = clazz, userId = userId, onOpenMeeting = onOpenMeeting)
    }
}

@Composable
private fun ClassAttendanceAdminView(
    clazz: ClassDetail,
    onOpenLeaveRequest: (String) -> Unit,
    onOpenAttendanceDetail: () -> Unit,
    onOpenManageSessions: () -> Unit,
    onOpenAbsenceRequests: () -> Unit,
    onOpenMeeting: (String) -> Unit,
) {
    val palette = mockColors()
    var createdTick by remember { mutableStateOf(0) }

    val courses by produceState(initialValue = emptyList<id.starstask.mobile.data.ClassCourse>(), key1 = clazz.id) {
        value = runCatching { listClassCourses(clazz.id, includeArchived = false) }.getOrDefault(emptyList())
    }
    val meetings by produceState(initialValue = emptyList<AttendanceMeeting>(), key1 = clazz.id, key2 = createdTick) {
        value = runCatching { listAttendanceMeetings(clazz.id) }.getOrDefault(emptyList())
    }
    val pending by produceState(initialValue = emptyList<LeaveRequest>(), key1 = clazz.id, key2 = createdTick) {
        value = runCatching { loadPendingLeaveForClass(clazz.id) }.getOrDefault(emptyList())
    }

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        GlossyAbsenceTitle("Attendance", palette)

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                            .background(palette.accentSofter),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Lucide.CalendarDays, contentDescription = null, tint = palette.accent, modifier = Modifier.size(20.dp))
                    }
                    Column {
                        Text("Create attendance session", color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text("One record per student per meeting.", color = palette.muted, fontSize = 12.sp)
                    }
                }
                ClassCreateAttendanceMeetingForm(
                    classId = clazz.id,
                    subjects = courses,
                    meetings = meetings,
                    onCreated = { createdTick++ },
                    onOpenMeeting = onOpenMeeting,
                )
            }
        }

        val active = meetings.filter { it.phase == "open" || it.phase == "scheduled" }.take(3)
        if (active.isNotEmpty()) {
            GlossyAbsenceTitle("Active sessions", palette)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                    .background(palette.card)
                    .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp)),
            ) {
                Column {
                    active.forEachIndexed { index, meeting ->
                        if (index > 0) GlossyDivider(palette)
                        ActiveMeetingRow(meeting = meeting, onClick = { onOpenMeeting(meeting.sessionId) }, palette = palette)
                    }
                }
            }
        }

        GlossyAbsenceTitle("Quick actions", palette)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp)),
        ) {
            Column {
                QuickActionRow(icon = Lucide.History, label = "Attendance detail", onClick = onOpenAttendanceDetail, palette = palette)
                GlossyDivider(palette)
                QuickActionRow(icon = Lucide.CalendarDays, label = "Manage sessions", onClick = onOpenManageSessions, palette = palette)
                GlossyDivider(palette)
                QuickActionRow(icon = Lucide.ClipboardList, label = "Absence requests", onClick = onOpenAbsenceRequests, palette = palette)
            }
        }

        GlossyAbsenceTitle("Pending review", palette)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp)),
        ) {
            if (pending.isEmpty()) {
                Text("No requests waiting for review.", color = palette.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp))
            } else {
                Column {
                    pending.forEachIndexed { index, request ->
                        if (index > 0) GlossyDivider(palette)
                        PendingLeaveRow(request = request, onOpen = { onOpenLeaveRequest(request.id) }, palette = palette)
                    }
                }
            }
        }
    }
}

@Composable
private fun ClassAbsenceMemberView(
    clazz: ClassDetail,
    userId: String,
    onOpenMeeting: (String) -> Unit,
) {
    val palette = mockColors()
    var reloadTick by remember { mutableStateOf(0) }
    val view by produceState(initialValue = null as id.starstask.mobile.data.StudentAttendanceView?, key1 = userId, key2 = reloadTick) {
        value = runCatching { loadStudentAttendance(userId) }.getOrNull()
    }
    val active by produceState(initialValue = emptyList<id.starstask.mobile.data.ActiveMeeting>(), key1 = userId, key2 = reloadTick) {
        value = runCatching {
            loadActiveAttendance(userId).filter { it.className == clazz.name }
        }.getOrDefault(emptyList())
    }
    val identity by produceState(initialValue = null as id.starstask.mobile.data.AttendanceIdentity?, key1 = userId) {
        value = runCatching { loadAttendanceIdentity(userId) }.getOrNull()
    }

    val classEntries = view?.entries?.filter { it.classId == clazz.id }.orEmpty()
    val counts = summarizeAttendance(classEntries.map { it.status })

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        GlossyAbsenceTitle("Attendance", palette)

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                    AbsenceCell(label = "Present", value = (counts.present + counts.late).toString(), palette = palette)
                    AbsenceCell(label = "Excused", value = (counts.excused + counts.sick).toString(), palette = palette)
                    AbsenceCell(label = "Absent", value = counts.absent.toString(), palette = palette)
                }
                Text(
                    counts.percentage?.let { "%.1f%% attended".format(it) } ?: "No eligible sessions yet",
                    color = palette.ink,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                if (counts.late > 0) {
                    Text("${counts.late} late in the last ${counts.eligible + counts.excused + counts.sick} sessions", color = palette.muted, fontSize = 12.sp)
                }
            }
        }

        if (active.isNotEmpty()) {
            GlossyAbsenceTitle("Check in", palette)
            active.forEach { meeting ->
                id.starstask.mobile.ui.screens.ActiveMeetingCard(
                    meeting = meeting,
                    identity = identity,
                    userId = userId,
                    onChanged = { reloadTick++ },
                    onOpenMeeting = onOpenMeeting,
                )
            }
        }

        GlossyAbsenceTitle("Recent attendance", palette)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp)),
        ) {
            if (classEntries.isEmpty()) {
                Text("No attendance records yet.", color = palette.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp))
            } else {
                Column {
                    classEntries.take(6).forEachIndexed { index, entry ->
                        if (index > 0) GlossyDivider(palette)
                        RecentAttendanceRow(entry = entry, palette = palette)
                    }
                }
            }
        }
    }
}

@Composable
private fun ActiveMeetingRow(
    meeting: AttendanceMeeting,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                .background(if (meeting.phase == "open") palette.goodBg else palette.chip),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.CalendarCheck, contentDescription = null, tint = if (meeting.phase == "open") palette.goodFg else palette.muted, modifier = Modifier.size(20.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${meeting.subjectName} · Pertemuan ${meeting.meetingNumber ?: "—"}",
                color = palette.ink,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                formatMeetingDateTime(meeting.startsAt) + if (meeting.location != null) " · ${meeting.location}" else "",
                color = palette.muted,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        PhaseChip(meeting.phase, palette)
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun RecentAttendanceRow(
    entry: id.starstask.mobile.data.AttendanceEntry,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(entry.subjectName ?: entry.title, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(formatMeetingDateTime(entry.startsAt), color = palette.muted, fontSize = 12.sp)
        }
        StatusPill(entry.status, palette)
    }
}

@Composable
private fun PhaseChip(phase: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    val (label, bg, fg) = when (phase) {
        "open" -> Triple("Open", palette.goodBg, palette.goodFg)
        "scheduled" -> Triple("Scheduled", palette.chip, palette.muted)
        "closed" -> Triple("Closed", palette.fairBg, palette.fairFg)
        else -> Triple("Finalized", palette.accentSofter, palette.accent)
    }
    Box(
        modifier = Modifier
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun StatusPill(status: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    val (label, bg, fg) = when (status) {
        "present" -> Triple("Present", palette.goodBg, palette.goodFg)
        "late" -> Triple("Late", palette.fairBg, palette.fairFg)
        "excused" -> Triple("Excused", palette.accentSofter, palette.accent)
        "sick" -> Triple("Sick", palette.accentSofter, palette.accent)
        "absent" -> Triple("Absent", palette.riskBg, palette.riskFg)
        else -> Triple("Unrecorded", palette.chip, palette.muted)
    }
    Box(
        modifier = Modifier
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

internal fun formatMeetingDateTime(iso: String): String = runCatching {
    val parsed = java.time.OffsetDateTime.parse(iso)
    java.time.format.DateTimeFormatter.ofPattern("d MMM · HH:mm", java.util.Locale("id", "ID")).format(parsed)
}.getOrElse { iso.take(16).replace('T', ' ') }

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
private fun QuickActionRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .heightIn(min = 52.dp)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, contentDescription = null, tint = palette.accent, modifier = Modifier.size(19.dp))
        Text(label, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun GlossyDivider(palette: id.starstask.mobile.ui.theme.MockPalette) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(palette.hairline),
    )
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
