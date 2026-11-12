package id.starstask.mobile.ui.screens.classdir

// Class Info tab: plain labclared key/value rows, matching the layout of the
// previous Info tab but with glossy styling.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassInfoGlossy(clazz: ClassDetail) {
    val palette = mockColors()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Class Info",
            color = palette.ink,
            fontSize = 22.sp,
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
                InfoRow("Class code", clazz.classCode.ifBlank { "—" }, palette)
                HorizontalDivider(color = palette.hairline, modifier = Modifier.padding(start = 16.dp))
                InfoRow("Semester", clazz.semester.ifBlank { "—" }, palette)
                HorizontalDivider(color = palette.hairline, modifier = Modifier.padding(start = 16.dp))
                InfoRow("Academic year", clazz.academicYear.ifBlank { "—" }, palette)
                HorizontalDivider(color = palette.hairline, modifier = Modifier.padding(start = 16.dp))
                InfoRow("Members", clazz.memberCount.toString(), palette)
                HorizontalDivider(color = palette.hairline, modifier = Modifier.padding(start = 16.dp))
                InfoRow("Lecturer", clazz.lecturerName.ifBlank { "—" }, palette)
                HorizontalDivider(color = palette.hairline, modifier = Modifier.padding(start = 16.dp))
                InfoRow("Status", clazz.status.ifBlank { "active" }.replaceFirstChar { it.uppercase() }, palette)
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = palette.muted, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(
            value,
            color = palette.ink,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}
