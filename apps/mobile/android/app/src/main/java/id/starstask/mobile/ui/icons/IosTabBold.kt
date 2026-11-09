package id.starstask.mobile.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Bold SF-Symbols-style glyphs for the bottom tab bar.
 * Stroke width is 3.0 (vs 2.0 in Ios.kt) so the icons read as solid
 * at 24dp — the same visual weight as iOS tab bar icons.
 */
object IosTabBold {
    private val strokeSpec = SolidColor(Color.Black)
    private const val STROKE_W = 3f

    val Dashboard: ImageVector by lazy {
        ImageVector.Builder(
            name = "Dashboard",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
            addPath(
                pathData = PathParser().parsePathString("M4 4 h7 v7 H4 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M13 4 h7 v4 h-7 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M13 10 h7 v10 h-7 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M4 13 h7 v7 H4 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
        }.build()
    }

    val Assignments: ImageVector by lazy {
        ImageVector.Builder(
            name = "Assignments",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
            addPath(
                pathData = PathParser().parsePathString("M8 2 h8 a2 2 0 0 1 2 2 v2 H6 V4 a2 2 0 0 1 2-2 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M6 6 h12 v14 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2-2 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M9 12 h6").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M9 16 h4").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
        }.build()
    }

    val Attendance: ImageVector by lazy {
        ImageVector.Builder(
            name = "Attendance",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
            addPath(
                pathData = PathParser().parsePathString("M15 5 a3 3 0 1 0 -3-3 a3 3 0 0 0 3 3 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M10 22 H5 a2 2 0 0 1-2-2 v-2 a2 2 0 0 1 2-2 h2 a2 2 0 0 1 2 2 v2 M10 22 v-2").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M16 11 l2 2 l4-4").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
        }.build()
    }

    val Schedule: ImageVector by lazy {
        ImageVector.Builder(
            name = "Schedule",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
            addPath(
                pathData = PathParser().parsePathString("M5 3 h14 a2 2 0 0 1 2 2 v14 a2 2 0 0 1-2 2 H5 a2 2 0 0 1-2-2 V5 a2 2 0 0 1 2-2 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M3 9 h18").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M8 2 v3").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M16 2 v3").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
            addPath(
                pathData = PathParser().parsePathString("M7 13 h2 v2 H7 z M11 13 h2 v2 h-2 z M15 13 h2 v2 h-2 z M7 17 h2 v2 H7 z M11 17 h2 v2 h-2 z").toNodes(),
                stroke = strokeSpec,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                strokeLineMiter = 4f,
                strokeLineWidth = STROKE_W,
                pathFillType = PathFillType.NonZero,
            )
        }.build()
    }
}
