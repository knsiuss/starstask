package id.starstask.mobile.ui.components

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground

// Mirrors web components/ui/tab-strip.tsx: border-b, px-3 py-3 text-sm,
// active = border-b-2 accent + foreground, inactive = muted + transparent border.
@Composable
fun WebTabStrip(
    items: List<Pair<String, String>>, // label to key
    activeKey: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(androidx.compose.ui.graphics.Color.Transparent)
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items.forEach { (label, key) ->
            val active = key == activeKey
            Column(
                modifier = Modifier
                    .clickable { onSelect(key) }
                    .padding(horizontal = Spacing.Xl, vertical = Spacing.Lg),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    label,
                    color = if (active) Foreground else MutedForeground,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    maxLines = 1,
                )
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier.padding(top = 8.dp)
                        .fillMaxWidth()
                        .background(
                            if (active) Accent else androidx.compose.ui.graphics.Color.Transparent,
                            androidx.compose.foundation.shape.RoundedCornerShape(1.dp),
                        ),
                ) {
                    androidx.compose.foundation.layout.Box(modifier = Modifier.padding(vertical = 1.dp))
                }
            }
        }
    }
    androidx.compose.foundation.layout.Box(
        modifier = Modifier.fillMaxWidth().background(Border).padding(vertical = 0.25.dp),
    )
}
