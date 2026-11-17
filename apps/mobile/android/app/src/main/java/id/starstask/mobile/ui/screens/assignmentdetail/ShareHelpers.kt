package id.starstask.mobile.ui.screens.assignmentdetail

import id.starstask.mobile.data.AssignmentDetail
import id.starstask.mobile.data.formatDeadline
import java.net.URLEncoder

fun shareUrl(id: String, siteUrl: String): String =
    siteUrl.trimEnd('/') + "/assignments/" + id

/** Only http(s) URLs may open an external browser from in-app clickables. */
fun isHttpUrl(url: String): Boolean {
    return try {
        val scheme = java.net.URI(url).scheme?.lowercase()
        scheme == "http" || scheme == "https"
    } catch (_: Exception) {
        false
    }
}

fun whatsappShareUrl(detail: AssignmentDetail, siteUrl: String): String {
    val url = shareUrl(detail.id, siteUrl)
    val text = buildString {
        append(detail.title)
        if (!detail.deadline.isNullOrBlank()) {
            append(" · Due ").append(formatDeadline(detail.deadline!!))
        }
        append("\n").append(url)
    }
    return "https://wa.me/?text=" + URLEncoder.encode(text, "UTF-8").replace("+", "%20")
}
