package id.starstask.mobile.ui.components

// Gradient pill CTA matching the pastel leave/dashboard redesign: a single
// diagonal blue brush, pill shape, and a soft accent shadow. Legacy WebButton
// stays flat, so this exists only for the hero CTAs.

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DashRadiusPillShape
import id.starstask.mobile.ui.theme.LocalDarkTheme

private val GradientStartLight = Color(0xFF4F8CFF)
private val GradientEndLight = Color(0xFF2F6BEF)
private val GradientStartDark = Color(0xFF3A5588)
private val GradientEndDark = Color(0xFF2F4470)
private val AccentShadow = Color(0xFF2F6BEF)

@Composable
fun GradientPillButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    enabled: Boolean = true,
    fillMaxWidth: Boolean = true,
) {
    val dark = LocalDarkTheme.current
    val brush = Brush.linearGradient(
        colors = if (dark) listOf(GradientStartDark, GradientEndDark) else listOf(GradientStartLight, GradientEndLight),
    )
    Row(
        modifier = modifier
            .then(if (fillMaxWidth) Modifier.fillMaxWidth() else Modifier)
            .shadow(
                elevation = if (dark) 0.dp else 8.dp,
                shape = DashRadiusPillShape,
                ambientColor = AccentShadow,
                spotColor = AccentShadow,
            )
            .clip(DashRadiusPillShape)
            .background(if (enabled) brush else Brush.linearGradient(listOf(Color(0xFFB9C6DE), Color(0xFFB9C6DE))))
            .clickable(enabled = enabled, onClick = onClick)
            .heightIn(min = 52.dp)
            .padding(horizontal = 24.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Box(
                modifier = Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.22f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
            }
        }
        Text(
            label,
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = if (icon != null) Modifier.padding(start = 10.dp) else Modifier,
            maxLines = 1,
        )
    }
}
