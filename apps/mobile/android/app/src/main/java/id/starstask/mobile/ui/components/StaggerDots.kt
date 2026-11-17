package id.starstask.mobile.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Three-dot "working" indicator for inline buttons. Staggered alpha/scale
 * pulse; reads as native, never as a spinner.
 */
@Composable
fun StaggerDots(
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
    dotSize: Dp = 4.dp,
) {
    val transition = rememberInfiniteTransition(label = "staggerDots")
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        listOf(0, 1, 2).forEach { index ->
            val pulse by transition.animateFloat(
                initialValue = 0.25f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = 620, delayMillis = index * 140),
                    repeatMode = RepeatMode.Reverse,
                ),
                label = "dotPulse$index",
            )
            Box(
                modifier = Modifier
                    .size(dotSize)
                    .scale(0.7f + pulse * 0.45f)
                    .alpha(pulse)
                    .clip(CircleShape)
                    .background(color, CircleShape),
            )
        }
    }
}
