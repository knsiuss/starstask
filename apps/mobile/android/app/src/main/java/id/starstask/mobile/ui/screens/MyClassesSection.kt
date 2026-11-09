package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.DashboardClass
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Band
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedFill
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Subtle

fun LazyListScope.myClassesSection(
    classes: List<DashboardClass>,
    onOpenClasses: () -> Unit,
    onClassClick: (DashboardClass) -> Unit = {},
) {
    item {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            WebSectionTitle("My classes")
            if (classes.isNotEmpty()) {
                Text(
                    "View all",
                    color = Accent,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.clickable(onClick = onOpenClasses),
                )
            }
        }
    }
    if (classes.isEmpty()) {
        item {
            WebCard {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Xl), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Surface)
                            .padding(horizontal = Spacing.Lg, vertical = Spacing.Md),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Lucide.GraduationCap,
                            contentDescription = null,
                            tint = MutedForeground,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("No active classes yet", style = MaterialTheme.typography.bodyMedium, color = Foreground)
                        Text(
                            "Join a class group using an invitation link or browse available public classes.",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    WebButton(label = "Browse classes", onClick = onOpenClasses, variant = WebButtonVariant.SECONDARY)
                }
            }
        }
    } else {
        items(classes, key = { it.id }) { clazz ->
            MyClassRow(clazz = clazz, onClick = { onClassClick(clazz) })
        }
    }
}

@Composable
fun MyClassRow(clazz: DashboardClass, onClick: (() -> Unit)? = null) {
    WebCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
            ClassLandscapeTile(index = Math.floorMod(clazz.id.hashCode(), 4))
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        clazz.name,
                        color = Foreground,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = androidx.compose.ui.unit.TextUnit(15f, androidx.compose.ui.unit.TextUnitType.Sp),
                            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                        ),
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (clazz.slug.isNotEmpty()) {
                        StarsTaskBadge(label = clazz.slug, variant = BadgeVariant.NEUTRAL)
                    }
                    if (clazz.isAdmin) {
                        StarsTaskBadge(label = "Class admin", variant = BadgeVariant.ACCENT)
                    }
                }
                if (clazz.adminName != null) {
                    Text("Admin: ${clazz.adminName}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    StarsTaskBadge(
                        label = "${clazz.subjectCount} subject${if (clazz.subjectCount == 1) "" else "s"}",
                        variant = BadgeVariant.NEUTRAL,
                    )
                    StarsTaskBadge(
                        label = "${clazz.taskCount} task${if (clazz.taskCount == 1) "" else "s"}",
                        variant = BadgeVariant.NEUTRAL,
                    )
                }
                if (clazz.semester.isNotEmpty() || clazz.academicYear.isNotEmpty()) {
                    Text("${clazz.semester} ${clazz.academicYear}".trim(), color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
            }
            Text("›", color = MutedForeground, style = MaterialTheme.typography.titleLarge)
        }
    }
}

/**
 * Brand landscape tile (web `hero-dashboard.svg` asset). The SVG was
 * raster-free transcribed into the Android vector drawable
 * `R.drawable.hero_dashboard`, so this renders the actual brand artwork;
 * each class shows a different horizontal crop, matching web
 * IMAGE_POSITIONS (0/33/66/100%).
 */
@Composable
fun ClassLandscapeTile(index: Int) {
    Box(
        modifier = Modifier
            .size(width = 56.dp, height = 56.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Band),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.Icon(
            imageVector = Lucide.GraduationCap,
            contentDescription = null,
            tint = Accent,
            modifier = Modifier.size(24.dp),
        )
    }
}
