package id.starstask.mobile.ui.screens.assignmentdetail

import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.FileOutputStream

// Built-in Android preview for assignment attachments (no new dependency).
fun decodeImagePreview(bytes: ByteArray): android.graphics.Bitmap? =
    runCatching { BitmapFactory.decodeByteArray(bytes, 0, bytes.size) }.getOrNull()

// Renders first page of the PDF at a readable width for inline display.
fun renderPdfFirstPage(bytes: ByteArray, targetWidthPx: Int = 1080): android.graphics.Bitmap? {
    val tmp = File.createTempFile("attach_preview", ".pdf")
    try {
        FileOutputStream(tmp).use { it.write(bytes) }
        val descriptor = ParcelFileDescriptor.open(tmp, ParcelFileDescriptor.MODE_READ_ONLY)
        descriptor.use { pfd ->
            val renderer = PdfRenderer(pfd)
            try {
                val page = renderer.openPage(0)
                return try {
                    val scale = targetWidthPx.toFloat() / page.width.coerceAtLeast(1)
                    val bitmap = android.graphics.Bitmap.createBitmap(
                        targetWidthPx,
                        (page.height * scale).toInt().coerceAtLeast(1),
                        android.graphics.Bitmap.Config.ARGB_8888,
                    )
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    bitmap
                } finally {
                    page.close()
                }
            } finally {
                renderer.close()
            }
        }
    } catch (_: Exception) {
        return null
    } finally {
        runCatching { tmp.delete() }
    }
}

fun decodePreview(bytes: ByteArray, mimeType: String?): android.graphics.Bitmap? =
    when (mimeType) {
        "application/pdf" -> renderPdfFirstPage(bytes)
        else -> decodeImagePreview(bytes)
    }
