package id.starstask.mobile.ui.screens.classdir

// Schedule tab: the class's recurring weekly timetable (class_course_schedules),
// grouped by day. Admins can still create one-off sessions from the header.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.ClassScheduleSlot
import id.starstask.mobile.data.loadClassSchedule
import id.starstask.mobile.data.weekdayLabel
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassScheduleGlossy(
    clazz: ClassDetail,
    onCreateSession: () -> Unit,
) {
    val palette = mockColors()
    val schedule by produceState(
        initialValue = emptyList<ClassScheduleSlot>(),
        key1 = clazz.id,
    ) {
        value = runCatching { loadClassSchedule(clazz.id) }.getOrDefault(emptyList())
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Schedule",
                color = palette.ink,
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            if (clazz.isAdmin) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(palette.chip)
                        .clickable(onClick = onCreateSession)
                        .heightIn(min = 34.dp)
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                ) {
                    Icon(Lucide.PlusCircle, contentDescription = null, tint = palette.accent, modifier = Modifier.size(16.dp))
                    Text("Set session", color = palette.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        if (schedule.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(palette.card)
                    .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
                    .padding(16.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "No weekly schedule yet.",
                        color = palette.ink,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        "A class admin can add the timetable from Manage class, or create a one-off session here.",
                        color = palette.muted,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                }
            }
            return@Column
        }

        schedule.groupBy { it.dayOfWeek }.toSortedMap().forEach { (day, slots) ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    weekdayLabel(day),
                    color = palette.muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(start = 4.dp),
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(palette.card)
                        .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp)),
                ) {
                    Column {
                        slots.forEachIndexed { index, slot ->
                            if (index > 0) GlossyHairline(palette)
                            SlotRow(slot = slot, palette = palette)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SlotRow(
    slot: ClassScheduleSlot,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(slot.startTime, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, lineHeight = 17.sp)
            Text(slot.endTime, color = palette.muted, fontSize = 11.sp, lineHeight = 13.sp)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                slot.subjectCode?.let { "$it · ${slot.subjectName}" } ?: slot.subjectName,
                color = palette.ink,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val detail = listOfNotNull(slot.room, slot.lecturerName).joinToString(" · ")
            if (detail.isNotBlank()) {
                Text(detail, color = palette.muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
