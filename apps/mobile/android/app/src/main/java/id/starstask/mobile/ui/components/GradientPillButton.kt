package id.starstask.mobile.ui.components

// Glossy iOS-light CTA matching the workspace shell: solid accent with a
// soft halo shadow, generous radius. Legacy WebButton stays flat.

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.theme.LocalDarkTheme
import id.starstask.mobile.ui.theme.mockColors

private val DisabledBackground = Color(0xFFC9D2E4)
private val AccentHaloLight = Color(0xFF9DB4FF)

@Composable
fun GradientPillButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    fillMaxWidth: Boolean = true,
) {
    val dark = LocalDarkTheme.current
    val palette = mockColors()
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(22.dp)

    Row(
        modifier = modifier
            .then(if (fillMaxWidth) Modifier.fillMaxWidth() else Modifier)
            .shadow(
                elevation = if (dark) 0.dp else 14.dp,
                shape = shape,
                ambientColor = AccentHaloLight,
                spotColor = AccentHaloLight,
            )
            .clip(shape)
            .background(if (enabled) palette.accent else DisabledBackground)
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
