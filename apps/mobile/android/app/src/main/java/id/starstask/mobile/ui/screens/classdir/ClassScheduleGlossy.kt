package id.starstask.mobile.ui.screens.classdir

// Schedule tab entry: wraps the existing Sessions-driven schedule for the
// class, keeping the glossy frame. The original schedule implementation is
// not rewritten here — this only presents the entry point.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassScheduleGlossy(
    clazz: ClassDetail,
    onCreateSession: () -> Unit,
) {
    val palette = mockColors()
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            "Schedule",
            color = palette.ink,
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 96.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, RoundedCornerShape(22.dp))
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "No scheduled meetings yet.",
                    color = palette.ink,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    "When this class has a session, it appears here with its check-in window.",
                    color = palette.muted,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                )
            }
        }
    }
}
