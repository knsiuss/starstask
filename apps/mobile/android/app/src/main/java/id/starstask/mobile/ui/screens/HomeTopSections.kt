package id.starstask.mobile.ui.screens

import androidx.compose.foundation.lazy.LazyListScope
import id.starstask.mobile.data.DashboardData

// Top sections: header + attention banner + what's new.
// Web uses .rise-in with --rise-delay: 0/40/80ms stagger.
fun LazyListScope.homeTopSections(
    greeting: String,
    firstName: String,
    summaryParts: List<String>,
    dateLabel: String,
    now: java.time.ZonedDateTime,
    pastDeadline: Int,
    onReviewTasks: () -> Unit,
    showWhatsNew: Boolean,
    onDismissWhatsNew: () -> Unit,
) {
    item {
        DashboardHeader(
            greeting = greeting,
            name = firstName,
            summaryParts = summaryParts,
            dateLabel = dateLabel,
            now = now,
            modifier = id.starstask.mobile.ui.theme.RiseInModifier(delayMs = 0),
        )
    }
    if (pastDeadline > 0) {
        item {
            AttentionBanner(
                pastDeadline = pastDeadline,
                onReview = onReviewTasks,
                modifier = id.starstask.mobile.ui.theme.RiseInModifier(delayMs = 40),
            )
        }
    }
    if (showWhatsNew) {
        item {
            WhatsNewBanner(
                onDismiss = onDismissWhatsNew,
                modifier = id.starstask.mobile.ui.theme.RiseInModifier(delayMs = 80),
            )
        }
    }
}
