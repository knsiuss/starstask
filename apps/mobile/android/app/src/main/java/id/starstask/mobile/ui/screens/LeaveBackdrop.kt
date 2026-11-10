package id.starstask.mobile.ui.screens

// Glossy iOS-light page backdrop for the leave surfaces: the same vertical
// page brush used by the workspace shell, with a faint halo ring top-right.

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.mockColors
import id.starstask.mobile.ui.theme.mockPageBrush

@Composable
fun LeaveBackdrop(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val palette = mockColors()
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(mockPageBrush())
            .drawWithContent {
                drawContent()

                val w = size.width
                val h = size.height

                drawCircle(
                    color = palette.halo.copy(alpha = 0.55f),
                    radius = w * 0.46f,
                    center = Offset(w * 1.0f, -h * 0.08f),
                    style = Stroke(width = 1.dp.toPx()),
                )
                drawCircle(
                    color = palette.halo.copy(alpha = 0.35f),
                    radius = w * 0.30f,
                    center = Offset(w * 1.05f, h * 0.02f),
                    style = Stroke(width = 1.dp.toPx()),
                )
            },
        content = content,
    )
}
