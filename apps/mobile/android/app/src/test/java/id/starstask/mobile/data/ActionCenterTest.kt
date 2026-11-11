package id.starstask.mobile.data

import org.junit.Assert.assertEquals
import org.junit.Test

/** Regression for the raw-data-class leak in the Action center headline. */
class ActionCenterTest {

    @Test
    fun summary_zeroActions_readsNaturally() {
        val totals = ActionCenterTotals(0, 0, 0, 0, classes = 2, actions = 0)
        assertEquals("Nothing is waiting on you right now.", buildActionSummary(totals))
    }

    @Test
    fun summary_usesComputedCounts_notDataClassToString() {
        val totals = ActionCenterTotals(
            pendingSubmissions = 1,
            pendingLeave = 1,
            todaysSessions = 3,
            openReports = 0,
            classes = 1,
            actions = 5,
        )
        val summary = buildActionSummary(totals)
        assertEquals("5 actions across 1 class.", summary)
    }

    @Test
    fun summary_pluralizesClassesAndActions() {
        val totals = ActionCenterTotals(1, 1, 0, 0, classes = 3, actions = 2)
        assertEquals("2 actions across 3 classes.", buildActionSummary(totals))
    }
}
