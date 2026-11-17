package id.starstask.mobile.data

import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlin.time.Duration.Companion.minutes

/**
 * Client-side forwarding package, mirroring the web flow
 * (apps/web/src/features/leave/forwarding-service.ts) with one deliberate
 * difference: the PDF bytes are rendered natively instead of on the server.
 *
 * Order is preserved exactly: the package bytes exist BEFORE
 * `complete_leave_forwarding` is called, so a generation failure can never
 * leave a request falsely marked as forwarded. Summary = table only (works
 * without storage). Complete = table + evidence image pages; a PDF evidence
 * file or an unreadable file is listed on a final "Attachments not included"
 * page, never silently omitted (same rule as the web complete report).
 */

data class LeaveReportRow(
    val id: String,
    val reference: String,
    val studentName: String,
    val leaveStartDate: String,
    val leaveEndDate: String,
    val documentIssueDate: String?,
    val reasonCategory: String,
    val submittedAt: String?,
    val status: String,
    val cancellationNote: String?,
)

/** Rows for an explicit selection, scoped by class like web listLeaveReportRowsByIds. */
suspend fun loadLeaveReportRows(classId: String, requestIds: List<String>): List<LeaveReportRow> {
    if (requestIds.isEmpty()) return emptyList()
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("leave_requests").select {
        filter {
            eq("class_id", classId)
            isIn("id", requestIds)
        }
        order("leave_start_date", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
    }.decodeJsonArray()
    val names = profileDisplayNames(rows.mapNotNull { it.jsonObject["student_id"]?.jsonPrimitive?.contentOrNull() })
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        val start = obj["leave_start_date"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val end = obj["leave_end_date"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val reason = obj["reason_category"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        LeaveReportRow(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            reference = obj["reference"]?.jsonPrimitive?.contentOrNull() ?: "",
            studentName = names[obj["student_id"]?.jsonPrimitive?.contentOrNull()] ?: "Student",
            leaveStartDate = start,
            leaveEndDate = end,
            documentIssueDate = obj["document_issue_date"]?.jsonPrimitive?.contentOrNull(),
            reasonCategory = reason,
            submittedAt = obj["submitted_at"]?.jsonPrimitive?.contentOrNull(),
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            cancellationNote = obj["cancellation_note"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun downloadLeaveEvidenceBytes(storagePath: String): ByteArray? =
    runCatching {
        val url = SupabaseProvider.client.storage
            .from(LEAVE_EVIDENCE_BUCKET)
            .createSignedUrl(storagePath, 5.minutes)
        java.net.URL(url).openStream().use { it.readBytes() }
    }.getOrNull()

private const val PAGE_W = 595
private const val PAGE_H = 842
private const val MARGIN = 36
private const val HEADER_H = 22
private const val ROW_H = 16
private const val FOOTER = "StarsTask records the request and its status, not the evidence behind a decision."
private val COLUMNS = listOf(
    "Ref", "Student", "From", "To", "Days", "Doc date", "Reason", "Submitted", "Status", "Note",
)
private val COL_W = floatArrayOf(52f, 78f, 56f, 56f, 26f, 56f, 62f, 62f, 48f, 27f)

private class PageWriter(val document: PdfDocument, var pageNumber: Int = 0) {
    var page: PdfDocument.Page? = null
    var y = MARGIN + HEADER_H
    var currentPageNumber = 0

    fun beginPage(ifNeeded: Boolean) {
        if (page == null || (ifNeeded && y + ROW_H > PAGE_H - MARGIN)) {
            page?.let { document.finishPage(it) }
            currentPageNumber++
            pageNumber++
            page = document.startPage(
                PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, pageNumber).create(),
            )
            y = MARGIN + HEADER_H
            drawHeader(page!!.canvas)
        }
    }

    private fun drawHeader(canvas: android.graphics.Canvas) {
        val paint = Paint().apply { textSize = 9f; isFakeBoldText = true; color = android.graphics.Color.DKGRAY }
        var x = MARGIN.toFloat()
        COLUMNS.forEachIndexed { i, title ->
            canvas.drawText(title, x, (MARGIN + 12).toFloat(), paint)
            x += COL_W[i]
        }
        canvas.drawText("Page $currentPageNumber", (PAGE_W - MARGIN - 40).toFloat(), (PAGE_H - 12).toFloat(), paint)
    }

    fun row(cells: List<String>) {
        beginPage(true)
        val c = page!!.canvas
        val paint = Paint().apply { textSize = 8f; color = android.graphics.Color.BLACK }
        var x = MARGIN.toFloat()
        cells.forEachIndexed { i, value ->
            c.drawText(value.take(14), x, y.toFloat(), paint)
            x += COL_W[i]
        }
        y += ROW_H
    }

    fun text(line: String, bold: Boolean = false) {
        beginPage(true)
        val paint = Paint().apply { textSize = 10f; isFakeBoldText = bold; color = android.graphics.Color.BLACK }
        page!!.canvas.drawText(line.take(90), MARGIN.toFloat(), y.toFloat(), paint)
        y += 18
    }

    fun finish() {
        page?.let { document.finishPage(it) }
        page = null
    }
}

fun generateLeaveSummaryPdf(
    className: String,
    recipientName: String,
    generatedBy: String,
    rows: List<LeaveReportRow>,
): ByteArray {
    val document = PdfDocument()
    val writer = PageWriter(document)
    writer.text("Leave requests — $className", bold = true)
    writer.text("For $recipientName · Generated by $generatedBy")
    writer.text("")
    rows.forEach { row ->
        writer.row(
            listOf(
                row.reference,
                row.studentName,
                row.leaveStartDate,
                row.leaveEndDate,
                leaveDayCount(row.leaveStartDate, row.leaveEndDate).toString(),
                row.documentIssueDate ?: "",
                leaveReasonLabel(row.reasonCategory),
                row.submittedAt?.take(10) ?: "",
                leaveStatusLabel(row.status),
                row.cancellationNote ?: "",
            ),
        )
    }
    writer.text("")
    writer.text(FOOTER)
    writer.finish()
    val stream = java.io.ByteArrayOutputStream()
    document.writeTo(stream)
    document.close()
    return stream.toByteArray()
}

private fun embedPdfEvidence(
    document: PdfDocument,
    bytes: ByteArray,
    writer: PageWriter,
    row: LeaveReportRow,
    filename: String,
): Boolean = runCatching {
    val pfd = android.os.ParcelFileDescriptor.createPipe()
    // ParcelFileDescriptor has no direct in-memory read; render via temp file instead.
    val tmp = java.io.File.createTempFile("leave-evidence-", ".pdf")
    tmp.writeBytes(bytes)
    val fd = android.os.ParcelFileDescriptor.open(tmp, android.os.ParcelFileDescriptor.MODE_READ_ONLY)
    val renderer = android.graphics.pdf.PdfRenderer(fd)
    writer.finish()
    for (pageIndex in 0 until renderer.pageCount) {
        val src = renderer.openPage(pageIndex)
        val info = PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, pageIndex + 1).create()
        val page = document.startPage(info)
        val bitmap = android.graphics.Bitmap.createBitmap(src.width * 2, src.height * 2, android.graphics.Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.WHITE)
        src.render(bitmap, null, null, android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
        val paint = Paint().apply { textSize = 11f; isFakeBoldText = true }
        page.canvas.drawText("${row.reference} · ${row.studentName} · $filename · page ${pageIndex + 1}", MARGIN.toFloat(), (MARGIN + 10).toFloat(), paint)
        val maxW = (PAGE_W - 2 * MARGIN).toFloat()
        val maxH = (PAGE_H - 3 * MARGIN).toFloat()
        val scale = minOf(maxW / bitmap.width, maxH / bitmap.height)
        val w = bitmap.width * scale
        val h = bitmap.height * scale
        page.canvas.drawBitmap(bitmap, (PAGE_W - w) / 2, (PAGE_H - h) / 2, null)
        document.finishPage(page)
        src.close()
        bitmap.recycle()
    }
    renderer.close()
    fd.close()
    tmp.delete()
    true
}.getOrDefault(false)

data class CompletePdfResult(val bytes: ByteArray, val missing: List<String>)

/** Complete package: table + evidence image pages; unreadable/PDF files listed as missing. */
fun generateLeaveCompletePdf(
    className: String,
    recipientName: String,
    generatedBy: String,
    rows: List<LeaveReportRow>,
    evidenceByRequest: Map<String, List<Pair<String, ByteArray?>>>,
): CompletePdfResult {
    val document = PdfDocument()
    val writer = PageWriter(document)
    writer.text("Leave requests (complete package) — $className", bold = true)
    writer.text("For $recipientName · Generated by $generatedBy")
    writer.text("")
    rows.forEach { row ->
        writer.row(
            listOf(
                row.reference,
                row.studentName,
                row.leaveStartDate,
                row.leaveEndDate,
                leaveDayCount(row.leaveStartDate, row.leaveEndDate).toString(),
                row.documentIssueDate ?: "",
                leaveReasonLabel(row.reasonCategory),
                row.submittedAt?.take(10) ?: "",
                leaveStatusLabel(row.status),
                row.cancellationNote ?: "",
            ),
        )
    }
    writer.text("")
    writer.text(FOOTER)
    writer.text("")
    val missing = mutableListOf<String>()
    var attachedCount = 0
    rows.forEach { row ->
        (evidenceByRequest[row.id] ?: emptyList()).forEach { (filename, bytes) ->
            val isPdf = bytes != null && bytes.size >= 5 && bytes[0] == '%'.code.toByte() && bytes[1] == 'P'.code.toByte() && bytes[2] == 'D'.code.toByte() && bytes[3] == 'F'.code.toByte()
            if (bytes != null && isPdf && embedPdfEvidence(document, bytes, writer, row, filename)) {
                attachedCount++
                return@forEach
            }
            val bitmap = bytes?.let { runCatching { BitmapFactory.decodeByteArray(it, 0, it.size) }.getOrNull() }
            if (bitmap == null) {
                missing += "${row.reference} · $filename"
                return@forEach
            }
            writer.finish()
            val info = PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, 1).create()
            val page = document.startPage(info)
            val canvas = page.canvas
            val paint = Paint().apply { textSize = 11f; isFakeBoldText = true }
            canvas.drawText("${row.reference} · ${row.studentName} · $filename", MARGIN.toFloat(), (MARGIN + 10).toFloat(), paint)
            val maxW = (PAGE_W - 2 * MARGIN).toFloat()
            val maxH = (PAGE_H - 3 * MARGIN).toFloat()
            val scale = minOf(maxW / bitmap.width, maxH / bitmap.height)
            val w = bitmap.width * scale
            val h = bitmap.height * scale
            canvas.drawBitmap(bitmap, (PAGE_W - w) / 2, (PAGE_H - h) / 2, null)
            document.finishPage(page)
            attachedCount++
        }
    }
    if (missing.isNotEmpty()) {
        writer.text("Attachments not included", bold = true)
        writer.text("These files could not be added. This report is therefore not a complete evidence package.")
        missing.forEach { writer.text("• $it") }
    }
    if (attachedCount == 0 && missing.isEmpty()) {
        writer.text("No attachments were available to include.")
    }
    writer.finish()
    val stream = java.io.ByteArrayOutputStream()
    document.writeTo(stream)
    document.close()
    return CompletePdfResult(stream.toByteArray(), missing)
}

data class LeaveForwardingCompletion(val reference: String, val requestCount: Int)

/** Records the forwarding AFTER package bytes exist (web complete_leave_forwarding). */
suspend fun completeLeaveForwarding(
    classId: String,
    requestIds: List<String>,
    recipientName: String,
    recipientEmail: String?,
    reportReference: String,
    reportFormat: String,
    idempotencyKey: String,
): LeaveForwardingCompletion {
    val result = SupabaseProvider.client.postgrest.rpc(
        "complete_leave_forwarding",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_request_ids", kotlinx.serialization.json.JsonArray(requestIds.map { JsonPrimitive(it) }))
            put("p_recipient_name", JsonPrimitive(recipientName))
            put("p_recipient_email", recipientEmail?.let { JsonPrimitive(it) } ?: kotlinx.serialization.json.JsonNull)
            put("p_report_reference", JsonPrimitive(reportReference))
            put("p_report_format", JsonPrimitive(reportFormat))
            put("p_idempotency_key", JsonPrimitive(idempotencyKey))
        },
    )
    val record = result.decodeJsonArray().firstOrNull()?.jsonObject
        ?: throw IllegalStateException("Could not record the forwarding.")
    return LeaveForwardingCompletion(
        reference = record["reference"]?.jsonPrimitive?.contentOrNull() ?: "",
        requestCount = record["request_count"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
    )
}

fun leaveReportFilename(className: String, format: String): String {
    val safe = className.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').ifBlank { "class" }
    return "starstask-absence-$safe-$format.pdf"
}
