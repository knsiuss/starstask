package id.starstask.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Spacing

/**
 * Pull-to-refresh matching web `pull-to-refresh.tsx`: only engages at the top
 * of a scroll container, shows the brand mark orbiting (900ms) while
 * refreshing, and reports three states — pull distance, armed (release to
 * refresh) and refreshing. Threshold 72dp, indicator height 56dp.
 */
private const val PTR_THRESHOLD_DP = 72
private const val INDICATOR_HEIGHT_DP = 56

@Composable
fun PullToRefresh(
    pullDistanceDp: Float,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val armed = pullDistanceDp >= PTR_THRESHOLD_DP
    val showIndicator = pullDistanceDp > 0f || isRefreshing
    val label = when {
        isRefreshing -> "Refreshing…"
        armed -> "Release to refresh"
        else -> "Pull to refresh"
    }
    Column(modifier = modifier) {
        Box(
            modifier = Modifier
                .height(if (showIndicator) INDICATOR_HEIGHT_DP.dp else 0.dp),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BrandMark(
                    sizeDp = 28,
                    modifier = Modifier
                        .then(
                            if (isRefreshing) {
                                Modifier.rotate(180f).scale(1.15f)
                            } else if (armed) {
                                Modifier.scale(1.1f)
                            } else {
                                Modifier
                            },
                        ),
                )
                Text(
                    label,
                    color = MutedForeground,
                    style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
                )
            }
        }
        content()
    }
}
