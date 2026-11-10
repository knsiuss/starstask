package id.starstask.mobile.ui.screens.dashboard

// Soft-pink pastel warning card for past-deadline tasks. "Review" routes to
// the existing assignments workspace (Review overdue flow) — not a new flow.

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DashRadiusCard
import id.starstask.mobile.ui.theme.dashColors

@Composable
fun DashAlertCard(
    pastDeadline: Int,
    onReview: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = dashColors()
    val label = if (pastDeadline == 1) "1 task past deadline" else "$pastDeadline tasks past deadline"
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(DashRadiusCard)
            .background(palette.alertBackground)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(palette.alertIconBackground),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.TriangleAlert, contentDescription = null, tint = palette.alertText, modifier = Modifier.size(22.dp))
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, color = palette.alertText, fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
            Text("Deadlines that have already passed in your classes.", color = palette.text, fontSize = 13.sp, lineHeight = 17.sp)
        }
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(palette.alertBackground)
                .clickable(onClick = onReview)
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Review", color = palette.alertText, fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
            Icon(Lucide.ChevronRight, contentDescription = "Review overdue tasks", tint = palette.alertText, modifier = Modifier.size(14.dp))
        }
    }
}
