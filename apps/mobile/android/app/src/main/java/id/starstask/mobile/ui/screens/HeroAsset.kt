package id.starstask.mobile.ui.screens

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathData
import androidx.compose.ui.unit.dp

/**
 * Compose transcription of the web brand asset `hero-dashboard.svg`
 * (viewBox 1600x360): dawn sky, sun glow, three mountain ridges and the
 * foreground strip, with the SVG's exact stops and path geometry.
 */
val HeroDashboard: ImageVector
    get() {
        if (_HeroDashboard != null) return _HeroDashboard!!
        _HeroDashboard = ImageVector.Builder(
            name = "HeroDashboard",
            defaultWidth = 1600.dp,
            defaultHeight = 360.dp,
            viewportWidth = 1600f,
            viewportHeight = 360f,
        ).apply {
            addPath(
                fill = androidx.compose.ui.graphics.Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFFDCE8F8),
                        Color(0xFFEEF2F8),
                        Color(0xFFFBF8F2),
                    ),
                    startY = 0f,
                    endY = 360f,
                ),
                pathData = PathData {
                    moveTo(0f, 0f)
                    lineTo(1600f, 0f)
                    lineTo(1600f, 360f)
                    lineTo(0f, 360f)
                    close()
                },
            )
            addPath(
                fill = androidx.compose.ui.graphics.Brush.radialGradient(
                    colors = listOf(
                        Color(0xFFE6FFE8C8),
                        Color(0x59FFDFC0),
                        Color(0x00FFDFC0),
                    ),
                    center = androidx.compose.ui.geometry.Offset(1152f, 259.2f),
                    radius = 672f,
                ),
                pathData = PathData {
                    moveTo(0f, 0f)
                    lineTo(1600f, 0f)
                    lineTo(1600f, 360f)
                    lineTo(0f, 360f)
                    close()
                },
            )
            mountainRidge(
                points = listOf(232f, 178f, 214f, 150f, 226f, 186f, 240f, 170f, 226f, 168f, 232f, 180f, 236f, 190f, 230f, 196f),
                xs = listOf(0f, 120f, 214f, 318f, 430f, 520f, 636f, 760f, 864f, 980f, 1090f, 1200f, 1310f, 1420f, 1520f, 1600f),
                topColor = 0xFFB9C9DE,
                bottomColor = 0xFFD3DEEA,
                alpha = 0.75f,
            )
            mountainRidge(
                points = listOf(268f, 224f, 262f, 208f, 268f, 226f, 276f, 218f, 274f, 226f, 280f, 232f, 278f, 236f, 280f, 240f),
                xs = listOf(0f, 96f, 190f, 286f, 392f, 500f, 604f, 712f, 824f, 936f, 1044f, 1156f, 1264f, 1372f, 1480f, 1600f),
                topColor = 0xFF8FA6C4,
                bottomColor = 0xFFB5C6DA,
                alpha = 0.85f,
            )
            mountainRidge(
                points = listOf(312f, 276f, 306f, 264f, 312f, 280f, 318f, 278f, 316f, 282f, 320f, 284f, 318f, 288f, 316f, 292f),
                xs = listOf(0f, 110f, 206f, 308f, 414f, 524f, 636f, 748f, 860f, 972f, 1084f, 1196f, 1308f, 1420f, 1520f, 1600f),
                topColor = 0xFF6F88A8,
                bottomColor = 0xFF98ABC2,
                alpha = 0.9f,
            )
            addPath(
                fill = SolidColor(Color(0xE6F7F5F0)),
                pathData = PathData {
                    moveTo(0f, 336f)
                    quadTo(200f, 322f, 400f, 334f)
                    quadTo(600f, 346f, 800f, 332f)
                    quadTo(1000f, 318f, 1200f, 336f)
                    quadTo(1400f, 354f, 1600f, 330f)
                    lineTo(1600f, 360f)
                    lineTo(0f, 360f)
                    close()
                },
            )
        }.build()
        return _HeroDashboard!!
    }

private var _HeroDashboard: ImageVector? = null

private fun ImageVector.Builder.mountainRidge(
    points: List<Float>,
    xs: List<Float>,
    topColor: Long,
    bottomColor: Long,
    alpha: Float,
) {
    addPath(
        fill = androidx.compose.ui.graphics.Brush.verticalGradient(
            colors = listOf(
                Color(topColor).copy(alpha = alpha),
                Color(bottomColor).copy(alpha = alpha),
            ),
            startY = points.minOrNull() ?: 0f,
            endY = 360f,
        ),
        pathData = PathData {
            moveTo(xs.first(), points.first())
            xs.zip(points).drop(1).forEach { (x, y) -> lineTo(x, y) }
            lineTo(1600f, 360f)
            lineTo(0f, 360f)
            close()
        },
    )
}

