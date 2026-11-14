package id.starstask.mobile.ui.screens.classdir

// Attendance detail push: per-course meeting counts, by-course breakdown,
// session list and member summary. Data comes from server-side aggregates
// (class_attendance_*_summary) joined in-memory; no client-side authz.

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
import androidx.compose.runtime.mutableIntStateOf
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
import id.starstask.mobile.data.AttendanceMeeting
import id.starstask.mobile.data.DirectoryClass
import id.starstask.mobile.data.listAttendanceMeetings
import id.starstask.mobile.data.listClassCourses
import id.starstask.mobile.data.loadClassRoster
import id.starstask.mobile.data.loadMemberAttendanceCounts
import id.starstask.mobile.data.loadSessionAttendanceCounts
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassAttendanceDetailGlossy(
    clazz: DirectoryClass,
    onBack: () -> Unit,
    onOpenMeeting: (String) -> Unit,
) {
    val palette = mockColors()

    var reloadTick by remember { mutableIntStateOf(0) }

    val state by produceState(
        initialValue = DetailState(),
        key1 = clazz.id,
        key2 = reloadTick,
    ) {
        value = try {
            val subjects = runCatching { listClassCourses(clazz.id, includeArchived = false) }.getOrDefault(emptyList())
            val meetings = runCatching { listAttendanceMeetings(clazz.id) }.getOrDefault(emptyList())
            val members = runCatching { loadMemberAttendanceCounts(clazz.id) }.getOrDefault(emptyList())
            val sessions = runCatching { loadSessionAttendanceCounts(clazz.id) }.getOrDefault(emptyList())
            val roster = runCatching { loadClassRoster(clazz.id) }.getOrDefault(emptyList())
            val nameById = roster.associate { it.id to it.name }
            DetailState(subjects = subjects, meetings = meetings, memberCounts = members, sessionCounts = sessions, memberNames = nameById, loading = false)
        } catch (_: Exception) {
            DetailState(loading = false, failed = true)
        }
    }

    GlossyBackSurface(
        title = "Attendance detail",
        subtitle = "Aggregates computed on the server across members and sessions.",
        onBack = onBack,
    ) {
        when {
            state.loading -> GlossyLoadingRow()
            state.failed -> GlossyErrorRow("Could not load the attendance detail.", onRetry = { reloadTick++ })
            else -> {
                Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    DetailSectionTitle("Courses", palette)
                    if (state.subjects.isEmpty()) {
                        Text("Add a course under the Courses tab to record attendance for it.", color = palette.muted, fontSize = 13.sp, lineHeight = 19.sp)
                    } else {
                        state.subjects.forEach { subject ->
                            val meetingCount = state.meetings.count { it.subjectId == subject.id }
                            DetailCard(palette) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(palette.accentSofter),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Icon(Lucide.BookOpen, contentDescription = null, tint = palette.accent, modifier = Modifier.size(20.dp))
                                    }
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(subject.code?.let { "$it · ${subject.name}" } ?: subject.name, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("$meetingCount meeting${if (meetingCount == 1) "" else "s"} recorded", color = palette.muted, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }

                    DetailSectionTitle("Meetings", palette)
                    if (state.meetings.isEmpty()) {
                        Text("No attendance meetings yet. Create one above.", color = palette.muted, fontSize = 13.sp)
                    } else {
                        state.meetings.sortedWith(compareBy({ it.subjectName }, { it.meetingNumber ?: 0 })).forEach { meeting ->
                            MeetingRow(meeting = meeting, palette = palette, onClick = { onOpenMeeting(meeting.sessionId) })
                        }
                    }

                    DetailSectionTitle("Members", palette)
                    if (state.memberCounts.isEmpty()) {
                        Text("No member attendance recorded.", color = palette.muted, fontSize = 13.sp)
                    } else {
                        state.memberCounts
                            .sortedBy { state.memberNames[it.userId]?.lowercase() ?: "" }
                            .forEach { row ->
                            val total = row.present + row.late + row.excused + row.absent + row.unrecorded
                            val attended = row.present + row.late
                            DetailCard(palette) {
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        state.memberNames[row.userId] ?: "Member",
                                        color = palette.ink,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        "$attended/$total attended · ${if (total > 0) Math.round(attended * 1000.0 / total) / 10.0 else 0.0}%",
                                        color = palette.muted,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        CountCell(label = "Present", value = (row.present + row.late).toString(), palette = palette)
                                        CountCell(label = "Excused", value = row.excused.toString(), palette = palette)
                                        CountCell(label = "Absent", value = row.absent.toString(), palette = palette)
                                        CountCell(label = "NR", value = row.unrecorded.toString(), palette = palette)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private data class DetailState(
    val subjects: List<id.starstask.mobile.data.ClassCourse> = emptyList(),
    val meetings: List<AttendanceMeeting> = emptyList(),
    val memberCounts: List<id.starstask.mobile.data.MemberAttendanceCounts> = emptyList(),
    val sessionCounts: List<id.starstask.mobile.data.SessionAttendanceCounts> = emptyList(),
    val memberNames: Map<String, String> = emptyMap(),
    val loading: Boolean = true,
    val failed: Boolean = false,
)

@Composable
private fun DetailCard(palette: id.starstask.mobile.ui.theme.MockPalette, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(14.dp),
    ) {
        content()
    }
}

@Composable
private fun DetailSectionTitle(text: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    Text(
        text,
        color = palette.ink,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 2.dp),
    )
}

@Composable
internal fun MeetingRow(
    meeting: AttendanceMeeting,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${meeting.subjectName} · Pertemuan ${meeting.meetingNumber ?: "—"}",
                color = palette.ink,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(formatMeetingDateTime(meeting.startsAt), color = palette.muted, fontSize = 12.sp)
            Text(
                "${meeting.present} present · ${meeting.late} late · ${meeting.excused} excused · ${meeting.absent} absent · ${meeting.notRecorded} not recorded",
                color = palette.muted,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun CountCell(label: String, value: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(value, color = palette.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text(label, color = palette.muted, fontSize = 10.sp)
    }
}
