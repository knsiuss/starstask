package id.starstask.mobile.ui.screens.assignmentdetail

import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.AssignmentDetail

fun assignmentFrom(detail: AssignmentDetail): Assignment =
    Assignment(
        id = detail.id,
        title = detail.title,
        status = detail.status,
        deadline = detail.deadline,
        className = detail.className ?: detail.courseName,
    )

fun shareUrl(id: String, siteUrl: String): String =
    siteUrl.trimEnd('/') + "/assignments/" + id

fun shareText(detail: AssignmentDetail, siteUrl: String): String = buildString {
    append(detail.title)
    if (!detail.deadline.isNullOrBlank()) {
        append(" · Due ").append(id.starstask.mobile.data.formatDeadline(detail.deadline!!))
    }
    append("\n").append(shareUrl(detail.id, siteUrl))
}

fun whatsappShareUrl(detail: AssignmentDetail, siteUrl: String): String {
    val url = shareUrl(detail.id, siteUrl)
    val text = buildString {
        append(detail.title)
        if (!detail.deadline.isNullOrBlank()) {
            append(" · Due ").append(id.starstask.mobile.data.formatDeadline(detail.deadline!!))
        }
        append("\n").append(url)
    }
    return "https://wa.me/?text=" + java.net.URLEncoder.encode(text, "UTF-8").replace("+", "%20")
}
