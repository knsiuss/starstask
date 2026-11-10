package id.starstask.mobile.ui.screens

// Decorative page backdrop for the leave surfaces: pastel page background with
// a couple of translucent arcs in the top-right and a soft ring bottom-left.
// Drawn with Canvas so it needs no raster asset and adapts to dark mode.

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.dashColors

@Composable
fun LeaveBackdrop(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val palette = dashColors()
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(palette.pageBackground)
            .drawWithContent {
                drawContent()

                val w = size.width
                val h = size.height

                // Top-right arc stack (echoes the reference hero backdrop).
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(palette.heroEnd.copy(alpha = 0.85f), palette.heroEnd.copy(alpha = 0f)),
                    ),
                    radius = w * 0.72f,
                    center = androidx.compose.ui.geometry.Offset(w * 1.05f, -h * 0.08f),
                )
                drawCircle(
                    color = palette.accent.copy(alpha = 0.10f),
                    radius = w * 0.46f,
                    center = androidx.compose.ui.geometry.Offset(w * 1.0f, h * 0.02f),
                    style = Stroke(width = 1.dp.toPx()),
                )

                // Bottom-left soft ring, barely visible.
                drawCircle(
                    color = palette.accent.copy(alpha = 0.07f),
                    radius = w * 0.42f,
                    center = androidx.compose.ui.geometry.Offset(-w * 0.28f, h * 0.72f),
                    style = Stroke(width = 1.dp.toPx()),
                )
            },
        content = content,
    )
}
