package id.starstask.mobile.ui.screens.classdir

// Glossy class-directory card for the My Classes list: code chip future
// layout, Active/Class Admin chips, stats from ClassOverview-style counts
// (real numbers from the directory loader), twin action rows for admins.

import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.DirectoryClass
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassesDirectoryCard(
    clazz: DirectoryClass,
    onOpen: () -> Unit,
    onManageClass: (() -> Unit)?,
    onPostAssignment: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val palette = mockColors()
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(22.dp))
            .clickable(onClick = onOpen),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            val code = clazz.classCode?.takeIf { it.isNotBlank() } ?: clazz.name.take(6).uppercase()
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(palette.accentSofter),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Lucide.GraduationCap, contentDescription = null, tint = palette.accent, modifier = Modifier.size(26.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    code.uppercase(),
                    color = palette.ink,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.4.sp,
                    maxLines = 1,
                )
                val meta = buildList {
                    if (clazz.semester.isNotBlank()) add(clazz.semester)
                    if (clazz.academicYear.isNotBlank()) add(clazz.academicYear)
                }.joinToString(" • ")
                if (meta.isNotBlank()) {
                    Text(meta, color = palette.muted, fontSize = 13.sp, maxLines = 1)
                }
            }
            Icon(Lucide.ChevronRight, contentDescription = "Open class", tint = palette.muted, modifier = Modifier.size(20.dp))
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            GlossyChip(text = "Active", dot = true, tint = palette.goodFg, background = palette.goodBg)
            if (clazz.isAdmin) {
                GlossyChip(text = "Class Admin", dot = false, tint = palette.accent, background = palette.accentSoft)
            }
        }

        HorizontalDividerHairline(color = palette.hairline)

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            DirectoryStat(label = "Subjects", value = clazz.subjectCount, accent = palette.accent, palette = palette)
            DirectoryStat(label = "Assignments", value = clazz.assignmentCount, accent = palette.accent, palette = palette)
            DirectoryStat(label = "Members", value = clazz.memberCount, accent = palette.accent, palette = palette)
        }

        if (onManageClass != null || onPostAssignment != null) {
            HorizontalDividerHairline(color = palette.hairline)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (onManageClass != null) {
                    ActionChip(
                        icon = Lucide.Settings,
                        label = "Manage Class",
                        onClick = onManageClass,
                        palette = palette,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (onManageClass != null && onPostAssignment != null) {
                    Box(
                        modifier = Modifier
                            .width(1.dp)
                            .height(24.dp)
                            .background(palette.hairline)
                            .align(Alignment.CenterVertically),
                    )
                }
                if (onPostAssignment != null) {
                    ActionChip(
                        icon = Lucide.Plus,
                        label = "Post Assignment",
                        onClick = onPostAssignment,
                        palette = palette,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
fun GlossyChip(text: String, dot: Boolean, tint: Color, background: Color) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(background)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (dot) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(tint),
            )
        }
        Text(text, color = tint, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun DirectoryStat(
    label: String,
    value: Int,
    accent: Color,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(value.toString(), color = palette.ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Text(label, color = palette.muted, fontSize = 12.sp)
    }
}

@Composable
private fun ActionChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(icon, contentDescription = null, tint = palette.accent, modifier = Modifier.size(16.dp))
        Text(label, color = palette.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
private fun HorizontalDividerHairline(color: Color) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(color),
    )
}
