package id.starstask.mobile.ui.screens

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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.AssignmentBorder
import id.starstask.mobile.ui.theme.SoftFill
import id.starstask.mobile.ui.theme.WarningSoft
import id.starstask.mobile.ui.theme.Warning

// Role gate: only class admin (canManage) can create attendance meetings.
// Non-admin tapping "New meeting" gets a notice — no fake form, no dead
// button. This mirrors web role.canManage in attendance/page.tsx.

@Composable
fun CourseAttendanceTabClean(
    isAdmin: Boolean,
    courseStatus: String,
    onNewMeeting: () -> Unit,
    onShowHistory: () -> Unit,
) {
    var showNotice by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Attendance", color = Foreground, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text(
                if (isAdmin) {
                    "Meetings of this course only. Each meeting is stored with this course."
                } else {
                    "Check in to open meetings of this course and review your own records."
                },
                color = MutedForeground,
                fontSize = 14.sp,
            )
        }

        if (!isAdmin) {
            Text(
                "Class attendance history",
                color = Accent,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.clickable { onShowHistory() },
            )
        }

        if (courseStatus == "archived") {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(WarningSoft)
                    .border(0.5.dp, Color(0xFFF3D4D9), RoundedCornerShape(20.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                Text(
                    "This course is archived. Its attendance history is still available, but new meetings cannot be created.",
                    color = Warning,
                    fontSize = 13.sp,
                )
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Attendance meetings",
                color = Foreground,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (isAdmin) Accent else SoftFill)
                    .clickable {
                        if (isAdmin) {
                            onNewMeeting()
                        } else {
                            showNotice = true
                        }
                    }
                    .padding(horizontal = 20.dp, vertical = 12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(
                        Lucide.PlusCircle,
                        contentDescription = null,
                        tint = if (isAdmin) Color.White else Foreground,
                        modifier = Modifier.size(16.dp),
                    )
                    Text(
                        "New meeting",
                        color = if (isAdmin) Color.White else Foreground,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        if (showNotice) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(SoftFill)
                    .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp))
                    .padding(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Only the class admin can create attendance.",
                    color = Foreground,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Your class admin creates meetings for this course. You can check in to meetings they open.",
                    color = MutedForeground,
                    fontSize = 13.sp,
                )
                Text(
                    "Dismiss",
                    color = Accent,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable { showNotice = false },
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp))
                .padding(horizontal = 24.dp, vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Lucide.CalendarDays, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(24.dp))
            Text("No attendance meetings yet", color = Foreground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Create the first meeting to start recording attendance per meeting.",
                color = MutedForeground,
                fontSize = 13.sp,
            )
        }
    }
}

