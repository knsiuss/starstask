package id.starstask.mobile.data

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

/**
 * Attendance export mirroring web exports (report/recap). Data comes from the
 * already-loaded StudentAttendanceView (server-scoped), so the file always
 * matches what the student sees. No new API is invented.
 */

fun attendanceCsv(entries: List<AttendanceEntry>): String {
    fun esc(value: String): String = "\"" + value.replace("\"", "\"\"") + "\""
    val header = listOf(
        "session_id", "title", "class", "subject", "session_type",
        "starts_at", "ends_at", "checked_in_at", "status", "location", "note",
    ).joinToString(",") { esc(it) }
    val lines = entries.joinToString("\n") { entry ->
        listOf(
            entry.sessionId, entry.title, entry.className, entry.subjectName ?: "",
            entry.sessionType, entry.startsAt, entry.endsAt,
            entry.checkedInAt ?: "", entry.status, entry.location ?: "", entry.note ?: "",
        ).joinToString(",") { esc(it) }
    }
    return if (lines.isBlank()) header else "$header\n$lines"
}

fun shareAttendanceCsv(context: Context, entries: List<AttendanceEntry>) {
    val file = File(context.cacheDir, "attendance-export.csv")
    file.writeText(attendanceCsv(entries))
    shareFile(context, file, "text/csv", "Attendance export")
}

fun attendancePdfBytes(
    title: String,
    summary: AttendanceCounts,
    entries: List<AttendanceEntry>,
): ByteArray {
    val doc = PdfDocument()
    val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
    val page = doc.startPage(pageInfo)
    val canvas = page.canvas
    val regular = Paint().apply { textSize = 11f; typeface = Typeface.DEFAULT }
    val bold = Paint().apply { textSize = 14f; typeface = Typeface.DEFAULT_BOLD }
    var y = 48
    canvas.drawText(title, 36f, y.toFloat(), bold)
    y += 22
    canvas.drawText(
        "Present ${summary.present} · Late ${summary.late} · Absent ${summary.absent} · Not recorded ${summary.unrecorded} · Eligible ${summary.eligible} · ${formatAttendancePercentage(summary.percentage)}",
        36f, y.toFloat(), regular,
    )
    y += 18
    for (entry in entries.take(40)) {
        if (y > 800) break
        canvas.drawText("${entry.title} — ${entry.className} — ${entry.status}", 36f, y.toFloat(), regular)
        y += 16
    }
    doc.finishPage(page)
    val baos = java.io.ByteArrayOutputStream()
    doc.writeTo(baos)
    doc.close()
    return baos.toByteArray()
}

fun shareAttendancePdf(context: Context, title: String, summary: AttendanceCounts, entries: List<AttendanceEntry>) {
    val file = File(context.cacheDir, "attendance-export.pdf")
    file.writeBytes(attendancePdfBytes(title, summary, entries))
    shareFile(context, file, "application/pdf", "Attendance report")
}

private fun shareFile(context: Context, file: File, mime: String, chooserTitle: String) {
    val uri: Uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, chooserTitle).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    })
}
