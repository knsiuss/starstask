package id.starstask.mobile.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

// SF Symbols-style set (Lucide ISC, downloaded as SVG, converted to ImageVector
// with the same 24dp / 2dp stroke / round caps-fingerprint as Lucide.kt so the
// UI stays visually identical while glyphs use the rounded iOS-like geometry.
private val strokeSpec = SolidColor(Color.Black)

object Ios {
    val ArrowDownUp: ImageVector by lazy {
        ImageVector.Builder(
            name = "ArrowDownUp",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m3 16 4 4 4-4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M7 20V4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m21 8-4-4-4 4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M17 4v16").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ArrowLeft: ImageVector by lazy {
        ImageVector.Builder(
            name = "ArrowLeft",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m12 19-7-7 7-7").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M19 12H5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ArrowRight: ImageVector by lazy {
        ImageVector.Builder(
            name = "ArrowRight",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M5 12h14").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m12 5 7 7-7 7").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Bell: ImageVector by lazy {
        ImageVector.Builder(
            name = "Bell",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M10.268 21a2 2 0 0 0 3.464 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val CalendarCheck: ImageVector by lazy {
        ImageVector.Builder(
            name = "CalendarCheck",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M8 2v3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 2v3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 5.0 3.0 h 14.0 a 2.0 2.0 0 0 1 2.0 2.0 v 14.0 a 2.0 2.0 0 0 1 -2.0 2.0 h -14.0 a 2.0 2.0 0 0 1 -2.0 -2.0 v -14.0 a 2.0 2.0 0 0 1 2.0 -2.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3 9h18").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m9 15 2 2 4-4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val CalendarClock: ImageVector by lazy {
        ImageVector.Builder(
            name = "CalendarClock",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M16 14v2.2l1.6 1").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 2v3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3 9h5.859").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 2v3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 10.0 16.0 a 6.0 6.0 0 1 0 12.0 0 a 6.0 6.0 0 1 0 -12.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val CalendarDays: ImageVector by lazy {
        ImageVector.Builder(
            name = "CalendarDays",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M8 2v3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 2v3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 5.0 3.0 h 14.0 a 2.0 2.0 0 0 1 2.0 2.0 v 14.0 a 2.0 2.0 0 0 1 -2.0 2.0 h -14.0 a 2.0 2.0 0 0 1 -2.0 -2.0 v -14.0 a 2.0 2.0 0 0 1 2.0 -2.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3 9h18").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 13h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 13h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 13h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 17h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 17h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 17h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val CalendarRange: ImageVector by lazy {
        ImageVector.Builder(
            name = "CalendarRange",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 5.0 3.0 h 14.0 a 2.0 2.0 0 0 1 2.0 2.0 v 14.0 a 2.0 2.0 0 0 1 -2.0 2.0 h -14.0 a 2.0 2.0 0 0 1 -2.0 -2.0 v -14.0 a 2.0 2.0 0 0 1 2.0 -2.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 2v3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3 9h18").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 2v3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M17 13h-6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M13 17H7").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M7 13h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M17 17h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Camera: ImageVector by lazy {
        ImageVector.Builder(
            name = "Camera",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 9.0 13.0 a 3.0 3.0 0 1 0 6.0 0 a 3.0 3.0 0 1 0 -6.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val CheckCheck: ImageVector by lazy {
        ImageVector.Builder(
            name = "CheckCheck",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M18 6 7 17l-5-5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m22 10-7.5 7.5L13 16").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Check: ImageVector by lazy {
        ImageVector.Builder(
            name = "Check",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M20 6 9 17l-5-5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ChevronDown: ImageVector by lazy {
        ImageVector.Builder(
            name = "ChevronDown",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m6 9 6 6 6-6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ChevronLeft: ImageVector by lazy {
        ImageVector.Builder(
            name = "ChevronLeft",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m15 18-6-6 6-6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ChevronRight: ImageVector by lazy {
        ImageVector.Builder(
            name = "ChevronRight",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m9 18 6-6-6-6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val CircleCheckBig: ImageVector by lazy {
        ImageVector.Builder(
            name = "CircleCheckBig",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M21.801 10A10 10 0 1 1 17 3.335").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m9 11 3 3L22 4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val CircleCheck: ImageVector by lazy {
        ImageVector.Builder(
            name = "CircleCheck",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 2.0 12.0 a 10.0 10.0 0 1 0 20.0 0 a 10.0 10.0 0 1 0 -20.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m16 9-5.5 5.5L8 12").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val CircleX: ImageVector by lazy {
        ImageVector.Builder(
            name = "CircleX",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 2.0 12.0 a 10.0 10.0 0 1 0 20.0 0 a 10.0 10.0 0 1 0 -20.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m15 9-6 6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m9 9 6 6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ClipboardList: ImageVector by lazy {
        ImageVector.Builder(
            name = "ClipboardList",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 9.0 2.0 h 6.0 a 1.0 1.0 0 0 1 1.0 1.0 v 2.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -6.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -2.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 11h4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 16h4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 11h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 16h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Clock: ImageVector by lazy {
        ImageVector.Builder(
            name = "Clock",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 2.0 12.0 a 10.0 10.0 0 1 0 20.0 0 a 10.0 10.0 0 1 0 -20.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 6v6l4 2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ExternalLink: ImageVector by lazy {
        ImageVector.Builder(
            name = "ExternalLink",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M15 3h6v6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M10 14 21 3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val FileText: ImageVector by lazy {
        ImageVector.Builder(
            name = "FileText",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M14 2v5a1 1 0 0 0 1 1h5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M10 9H8").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 13H8").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 17H8").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val GraduationCap: ImageVector by lazy {
        ImageVector.Builder(
            name = "GraduationCap",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M22 10v6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M6 12.5V16a6 3 0 0 0 12 0v-3.5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val History: ImageVector by lazy {
        ImageVector.Builder(
            name = "History",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3 3v5h5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 7v5l4 2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ImagePlus: ImageVector by lazy {
        ImageVector.Builder(
            name = "ImagePlus",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M16 5h6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M19 2v6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 7.0 9.0 a 2.0 2.0 0 1 0 4.0 0 a 2.0 2.0 0 1 0 -4.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Info: ImageVector by lazy {
        ImageVector.Builder(
            name = "Info",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 2.0 12.0 a 10.0 10.0 0 1 0 20.0 0 a 10.0 10.0 0 1 0 -20.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 16v-4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 8h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val LayoutDashboard: ImageVector by lazy {
        ImageVector.Builder(
            name = "LayoutDashboard",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 4.0 3.0 h 5.0 a 1.0 1.0 0 0 1 1.0 1.0 v 7.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -5.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -7.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 15.0 3.0 h 5.0 a 1.0 1.0 0 0 1 1.0 1.0 v 3.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -5.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -3.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 15.0 12.0 h 5.0 a 1.0 1.0 0 0 1 1.0 1.0 v 7.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -5.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -7.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 4.0 16.0 h 5.0 a 1.0 1.0 0 0 1 1.0 1.0 v 3.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -5.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -3.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val LayoutGrid: ImageVector by lazy {
        ImageVector.Builder(
            name = "LayoutGrid",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 4.0 3.0 h 5.0 a 1.0 1.0 0 0 1 1.0 1.0 v 5.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -5.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -5.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 15.0 3.0 h 5.0 a 1.0 1.0 0 0 1 1.0 1.0 v 5.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -5.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -5.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 15.0 14.0 h 5.0 a 1.0 1.0 0 0 1 1.0 1.0 v 5.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -5.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -5.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 4.0 14.0 h 5.0 a 1.0 1.0 0 0 1 1.0 1.0 v 5.0 a 1.0 1.0 0 0 1 -1.0 1.0 h -5.0 a 1.0 1.0 0 0 1 -1.0 -1.0 v -5.0 a 1.0 1.0 0 0 1 1.0 -1.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val List: ImageVector by lazy {
        ImageVector.Builder(
            name = "List",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M3 5h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3 12h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3 19h.01").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 5h13").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 12h13").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 19h13").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val LogOut: ImageVector by lazy {
        ImageVector.Builder(
            name = "LogOut",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m16 17 5-5-5-5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 12H9").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Mail: ImageVector by lazy {
        ImageVector.Builder(
            name = "Mail",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 4.0 4.0 h 16.0 a 2.0 2.0 0 0 1 2.0 2.0 v 12.0 a 2.0 2.0 0 0 1 -2.0 2.0 h -16.0 a 2.0 2.0 0 0 1 -2.0 -2.0 v -12.0 a 2.0 2.0 0 0 1 2.0 -2.0 z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val MapPin: ImageVector by lazy {
        ImageVector.Builder(
            name = "MapPin",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 9.0 10.0 a 3.0 3.0 0 1 0 6.0 0 a 3.0 3.0 0 1 0 -6.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Menu: ImageVector by lazy {
        ImageVector.Builder(
            name = "Menu",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M4 5h16").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M4 12h16").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M4 19h16").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val MessageCircle: ImageVector by lazy {
        ImageVector.Builder(
            name = "MessageCircle",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Moon: ImageVector by lazy {
        ImageVector.Builder(
            name = "Moon",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Paperclip: ImageVector by lazy {
        ImageVector.Builder(
            name = "Paperclip",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Pencil: ImageVector by lazy {
        ImageVector.Builder(
            name = "Pencil",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m15 5 4 4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Plus: ImageVector by lazy {
        ImageVector.Builder(
            name = "Plus",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M5 12h14").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 5v14").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val RefreshCw: ImageVector by lazy {
        ImageVector.Builder(
            name = "RefreshCw",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 3v5h-5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 16H3v5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val RotateCw: ImageVector by lazy {
        ImageVector.Builder(
            name = "RotateCw",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 3v5h-5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Search: ImageVector by lazy {
        ImageVector.Builder(
            name = "Search",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m21 21-4.34-4.34").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 3.0 11.0 a 8.0 8.0 0 1 0 16.0 0 a 8.0 8.0 0 1 0 -16.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Send: ImageVector by lazy {
        ImageVector.Builder(
            name = "Send",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m21.854 2.147-10.94 10.939").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Settings: ImageVector by lazy {
        ImageVector.Builder(
            name = "Settings",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 9.0 12.0 a 3.0 3.0 0 1 0 6.0 0 a 3.0 3.0 0 1 0 -6.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val ShieldCheck: ImageVector by lazy {
        ImageVector.Builder(
            name = "ShieldCheck",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m9 12 2 2 4-4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val SlidersHorizontal: ImageVector by lazy {
        ImageVector.Builder(
            name = "SlidersHorizontal",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M10 5H3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 19H3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M14 3v4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 17v4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 12h-9").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 19h-5").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M21 5h-7").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 10v4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 12H3").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Star: ImageVector by lazy {
        ImageVector.Builder(
            name = "Star",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Sun: ImageVector by lazy {
        ImageVector.Builder(
            name = "Sun",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M 8.0 12.0 a 4.0 4.0 0 1 0 8.0 0 a 4.0 4.0 0 1 0 -8.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 2v2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M12 20v2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m4.93 4.93 1.41 1.41").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m17.66 17.66 1.41 1.41").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M2 12h2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M20 12h2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m6.34 17.66-1.41 1.41").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m19.07 4.93-1.41 1.41").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Trash2: ImageVector by lazy {
        ImageVector.Builder(
            name = "Trash2",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M10 11v6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M14 11v6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M3 6h18").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val TrendingUp: ImageVector by lazy {
        ImageVector.Builder(
            name = "TrendingUp",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M16 7h6v6").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m22 7-8.5 8.5-5-5L2 17").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val UserCheck: ImageVector by lazy {
        ImageVector.Builder(
            name = "UserCheck",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("m16 11 2 2 4-4").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 5.0 7.0 a 4.0 4.0 0 1 0 8.0 0 a 4.0 4.0 0 1 0 -8.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val User: ImageVector by lazy {
        ImageVector.Builder(
            name = "User",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 8.0 7.0 a 4.0 4.0 0 1 0 8.0 0 a 4.0 4.0 0 1 0 -8.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val Users: ImageVector by lazy {
        ImageVector.Builder(
            name = "Users",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M16 3.128a4 4 0 0 1 0 7.744").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M22 21v-2a4 4 0 0 0-3-3.87").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("M 5.0 7.0 a 4.0 4.0 0 1 0 8.0 0 a 4.0 4.0 0 1 0 -8.0 0").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

    val X: ImageVector by lazy {
        ImageVector.Builder(
            name = "X",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
                addPath(
                    pathData = PathParser().parsePathString("M18 6 6 18").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
                addPath(
                    pathData = PathParser().parsePathString("m6 6 12 12").toNodes(),
                    stroke = strokeSpec,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                    pathFillType = PathFillType.NonZero,
                )
        }.build()
    }

}
