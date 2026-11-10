package id.starstask.mobile.ui.screens

// Hand-drawn empty-state illustration for the leave list: a document with a
// folded corner, three text lines, a blue clock badge, two sparkles, and a
// dashed swoosh. Pure Canvas so it tracks the pastel palette.

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun LeaveEmptyIllustration(modifier: Modifier = Modifier) {
    val palette = mockColors()
    val docStart = palette.card
    val docEnd = palette.accentSoft
    val fold = palette.accentSofter
    val line = palette.cardBorder
    val accent = palette.accent
    val spark = palette.accent

    Canvas(modifier = modifier.fillMaxWidth().height(170.dp)) {
        val cx = size.width / 2f
        val cy = size.height / 2f + 6.dp.toPx()
        val docW = 92.dp.toPx()
        val docH = 112.dp.toPx()
        val docLeft = cx - docW / 2f
        val docTop = cy - docH / 2f
        val radius = 18.dp.toPx()
        val foldSize = 26.dp.toPx()

        // Dashed swoosh ellipse behind the document.
        val swooshW = docW * 1.9f
        val swooshH = docH * 0.9f
        val dash = 9.dp.toPx()
        val gap = 7.dp.toPx()
        val strokeW = 2.dp.toPx()
        val swooshRect = androidx.compose.ui.geometry.Rect(
            left = cx - swooshW / 2f,
            top = cy - swooshH / 2f,
            right = cx + swooshW / 2f,
            bottom = cy + swooshH / 2f,
        )
        val circumference = 2f * Math.PI.toFloat() * ((swooshW + swooshH) / 4f)
        val segments = (circumference / (dash + gap)).toInt().coerceAtLeast(8)
        for (i in 0 until segments) {
            if (i % 2 != 0) continue
            val startAngle = (i * 360f / segments) + 18f
            val sweep = 360f / segments * 0.72f
            drawArc(
                color = accent.copy(alpha = 0.35f),
                startAngle = startAngle,
                sweepAngle = sweep,
                useCenter = false,
                topLeft = Offset(swooshRect.left, swooshRect.top),
                size = Size(swooshRect.width, swooshRect.height),
                style = Stroke(width = strokeW),
            )
        }

        // Document body with a soft vertical gradient.
        val docPath = Path().apply {
            moveTo(docLeft + radius, docTop)
            lineTo(docLeft + docW - foldSize, docTop)
            lineTo(docLeft + docW, docTop + foldSize)
            lineTo(docLeft + docW, docTop + docH - radius)
            quadraticTo(docLeft + docW, docTop + docH, docLeft + docW - radius, docTop + docH)
            lineTo(docLeft + radius, docTop + docH)
            quadraticTo(docLeft, docTop + docH, docLeft, docTop + docH - radius)
            lineTo(docLeft, docTop + radius)
            quadraticTo(docLeft, docTop, docLeft + radius, docTop)
            close()
        }
        drawPath(
            path = docPath,
            brush = Brush.verticalGradient(
                colors = listOf(docStart, docEnd),
                startY = docTop,
                endY = docTop + docH,
            ),
        )

        // Folded corner.
        val foldPath = Path().apply {
            moveTo(docLeft + docW - foldSize, docTop)
            lineTo(docLeft + docW, docTop + foldSize)
            lineTo(docLeft + docW - foldSize, docTop + foldSize)
            close()
        }
        drawPath(path = foldPath, color = fold)

        // Three text lines.
        val lineLeft = docLeft + 16.dp.toPx()
        val lineRight = docLeft + docW - 16.dp.toPx()
        val lineHeight = 6.dp.toPx()
        listOf(0.34f, 0.58f, 0.46f).forEachIndexed { index, fraction ->
            val y = docTop + docH * (0.38f + index * 0.16f)
            val lineWidth = (lineRight - lineLeft) * fraction
            drawRoundRect(
                color = line,
                topLeft = Offset(lineLeft, y),
                size = Size(lineWidth, lineHeight),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(lineHeight / 2f),
            )
        }

        // Clock badge, bottom-right of the document.
        val badgeRadius = 17.dp.toPx()
        val badgeCenter = Offset(docLeft + docW - 2.dp.toPx(), docTop + docH - 8.dp.toPx())
        drawCircle(color = accent, radius = badgeRadius, center = badgeCenter, style = Fill)
        drawCircle(
            color = Color.White.copy(alpha = 0.95f),
            radius = badgeRadius * 0.58f,
            center = badgeCenter,
            style = Stroke(width = 2.4.dp.toPx()),
        )
        drawLine(
            color = Color.White,
            start = badgeCenter,
            end = Offset(badgeCenter.x, badgeCenter.y - badgeRadius * 0.34f),
            strokeWidth = 2.4.dp.toPx(),
        )
        drawLine(
            color = Color.White,
            start = badgeCenter,
            end = Offset(badgeCenter.x + badgeRadius * 0.28f, badgeCenter.y + badgeRadius * 0.1f),
            strokeWidth = 2.4.dp.toPx(),
        )

        // Sparkles (four-point stars).
        drawSparkle(Offset(docLeft - 26.dp.toPx(), docTop + 18.dp.toPx()), 7.dp.toPx(), spark)
        drawSparkle(Offset(docLeft + docW + 20.dp.toPx(), docTop + 2.dp.toPx()), 6.dp.toPx(), spark)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawSparkle(
    center: Offset,
    radius: Float,
    color: Color,
) {
    val path = Path().apply {
        moveTo(center.x, center.y - radius)
        quadraticTo(center.x + radius * 0.16f, center.y - radius * 0.16f, center.x + radius, center.y)
        quadraticTo(center.x + radius * 0.16f, center.y + radius * 0.16f, center.x, center.y + radius)
        quadraticTo(center.x - radius * 0.16f, center.y + radius * 0.16f, center.x - radius, center.y)
        quadraticTo(center.x - radius * 0.16f, center.y - radius * 0.16f, center.x, center.y - radius)
        close()
    }
    drawPath(path = path, color = color)
}
