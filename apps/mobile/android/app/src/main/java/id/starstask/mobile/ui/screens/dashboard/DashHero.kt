package id.starstask.mobile.ui.screens.dashboard

// Pastel greeting hero for the redesigned dashboard. The big name is a
// display treatment of `displayName`; data comes from DashboardData and is
// never composed elsewhere. The pill CTA routes to the existing assignment
// request flow via onRequestTaskPublication.

import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.DashboardClass
import id.starstask.mobile.ui.components.BrandMark
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DashRadiusCard
import id.starstask.mobile.ui.theme.dashColors
import java.util.Locale

@Composable
fun DashHero(
    displayName: String?,
    classes: List<DashboardClass>,
    onRequestTaskPublication: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = dashColors()
    val shownName = displayName?.takeIf { it.isNotBlank() } ?: "Welcome"
    val now = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Jakarta"))
    val greeting = when (now.hour) {
        in 0..11 -> "Good morning,"
        in 12..17 -> "Good afternoon,"
        else -> "Good evening,"
    }
    val subtitle = "Here is your academic overview."
    val classLine = classes
        .map { it.classCode?.takeIf { code -> code.isNotBlank() } ?: it.name }
        .filter { it.isNotBlank() }
        .joinToString(" · ")

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(DashRadiusCard)
            .background(Brush.horizontalGradient(listOf(palette.heroStart, palette.heroEnd)))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(greeting, color = palette.heroMuted, fontSize = 15.sp, lineHeight = 20.sp)
                Text(
                    shownName.uppercase(Locale.US),
                    color = palette.heroText,
                    fontSize = 28.sp,
                    lineHeight = 34.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    letterSpacing = (-0.02).sp,
                    maxLines = 3,
                )
                if (classLine.isNotBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(top = 4.dp),
                    ) {
                        Text(
                            "CLASS",
                            color = palette.heroMuted,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.2.sp,
                        )
                        Text(
                            classLine,
                            color = palette.heroText,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        )
                    }
                }
            }
            BrandMark(sizeDp = 88)
        }

        Text(
            subtitle,
            color = palette.heroMuted,
            fontSize = 14.sp,
            lineHeight = 19.sp,
        )

        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(palette.card)
                .clickable(onClick = onRequestTaskPublication)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Lucide.CalendarDays, contentDescription = null, tint = palette.accent, modifier = Modifier.size(16.dp))
            Text(
                "Request Task Publication",
                color = palette.text,
                fontSize = 14.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                maxLines = 1,
            )
            Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
        }
    }
}
