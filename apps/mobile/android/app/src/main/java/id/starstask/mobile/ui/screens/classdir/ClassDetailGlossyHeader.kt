package id.starstask.mobile.ui.screens.classdir

// Glossy class detail header: back button row, big code/name, semester •
// academic year meta line, Active + Class Admin chips, admin-only actions
// (Manage Class / Post Assignment).

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassDetailGlossyHeader(
    clazz: ClassDetail,
    onBack: () -> Unit,
    onManageClass: (() -> Unit)?,
    onPostAssignment: () -> Unit,
    onInvites: (() -> Unit)? = null,
) {
    val palette = mockColors()
    val code = clazz.classCode.takeIf { it.isNotBlank() } ?: clazz.name.take(6).uppercase()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(palette.card)
                    .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Lucide.ArrowLeft, contentDescription = "Back", tint = palette.ink, modifier = Modifier.size(20.dp))
            }
        }
        Text(
            code.uppercase(),
            color = palette.ink,
            fontSize = 34.sp,
            lineHeight = 38.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
        )
        val meta = buildList {
            if (clazz.semester.isNotBlank()) add(clazz.semester)
            if (clazz.academicYear.isNotBlank()) add(clazz.academicYear)
        }.joinToString(" • ")
        if (meta.isNotBlank()) {
            Text(meta, color = palette.muted, fontSize = 15.sp, lineHeight = 20.sp)
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            GlossyChip(text = "Active", dot = true, tint = palette.goodFg, background = palette.goodBg)
            if (clazz.isAdmin) {
                GlossyChip(text = "Class Admin", dot = false, tint = palette.accent, background = palette.accentSoft)
            }
        }

        val showManage = onManageClass != null
        val showInvites = onInvites != null && clazz.isAdmin
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, palette.cardBorder, RoundedCornerShape(18.dp))
                .clip(RoundedCornerShape(18.dp))
                .background(palette.card)
                .heightIn(min = 52.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (showManage) {
                HeaderAction(
                    icon = Lucide.Settings,
                    label = "Manage Class",
                    onClick = onManageClass!!,
                    palette = palette,
                    modifier = Modifier.weight(1f),
                )
            }
            if (showManage) {
                Box(modifier = Modifier.height(26.dp).size(1.dp).background(palette.cardBorder))
            }
            if (showInvites) {
                HeaderAction(
                    icon = Lucide.Link2,
                    label = "Invites",
                    onClick = onInvites!!,
                    palette = palette,
                    modifier = Modifier.weight(1f),
                )
            }
            if (showInvites) {
                Box(modifier = Modifier.height(26.dp).size(1.dp).background(palette.cardBorder))
            }
            HeaderAction(
                icon = Lucide.Plus,
                label = "Post Assignment",
                onClick = onPostAssignment,
                palette = palette,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun HeaderAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .height(52.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = palette.ink, modifier = Modifier.size(18.dp))
        Text(label, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp))
    }
}
