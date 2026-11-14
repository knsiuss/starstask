package id.starstask.mobile.data

// Server-side attendance export over the web pipeline. The Android client
// fetches the file the web app builds, with the same branding and audit
// logging the web export path uses.

import android.content.Context
import id.starstask.mobile.BuildConfig
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

private const val EXPORT_RECAP_PATH_SUFFIX = "/attendance/exports/recap"
private const val EXPORT_REPORT_PATH_SUFFIX = "/attendance/exports/report"
private const val EXPORT_CHECKLIST_PATH_SUFFIX = "/attendance/exports/checklist"

sealed class ExportFormat(val fileExt: String, val pathSuffix: String) {
    data object Pdf : ExportFormat("pdf", EXPORT_REPORT_PATH_SUFFIX)
    data object Xlsx : ExportFormat("xlsx", EXPORT_RECAP_PATH_SUFFIX)
    data object Checklist : ExportFormat("xlsx", EXPORT_CHECKLIST_PATH_SUFFIX)
}

data class ExportResult(val file: java.io.File, val mimeType: String)

/**
 * Downloads an attendance export for the given class.
 *
 * Requires a class manager on the web (requireClassManager) and a valid
 * native Supabase session (the web validates the bearer token). Returns the
 * written file on success, or throws a generic IOException otherwise: the
 * web error response is intentionally not surfaced verbatim.
 */
suspend fun downloadAttendanceExport(
    context: Context,
    classSlug: String,
    subjectId: String,
    format: ExportFormat,
): ExportResult {
    val accessToken = SupabaseProvider.client.auth.currentSessionOrNull()?.accessToken
        ?: throw IOException("Session expired.")

    val baseUrl = BuildConfig.SITE_URL.trimEnd('/')
    if (baseUrl.isBlank() || baseUrl.contains("your-site-url") || baseUrl.contains("localhost")) {
        throw IOException("Site URL not configured.")
    }

    val url = URL("$baseUrl/api/classes/$classSlug${format.pathSuffix}?subjectId=$subjectId")
    return withContext(Dispatchers.IO) {
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 60_000
            requestMethod = "GET"
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Accept", when (format) {
                ExportFormat.Pdf -> "application/pdf"
                ExportFormat.Xlsx -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                ExportFormat.Checklist -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            })
        }
        try {
            val status = try {
                connection.responseCode
            } catch (cause: IOException) {
                connection.disconnect()
                throw cause
            }

            if (status == HttpURLConnection.HTTP_OK) {
                val suggestedName = connection.getHeaderField("Content-Disposition")
                    ?.substringAfter("filename=")
                    ?.trim('"', ';', ' ')
                    ?.takeIf { it.isNotBlank() }
                    ?: "attendance-export.${format.fileExt}"
                val bytes = connection.inputStream.use { it.readBytes() }
                val file = java.io.File(
                    sharedReportsDir(context),
                    suggestedName.replace(Regex("[^A-Za-z0-9._-]"), "_"),
                )
                file.writeBytes(bytes)
                ExportResult(
                    file = file,
                    mimeType = if (format == ExportFormat.Pdf) "application/pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            } else {
                throw IOException("The export could not be completed.")
            }
        } finally {
            connection.disconnect()
        }
    }
}
