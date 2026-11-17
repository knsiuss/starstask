package id.starstask.mobile.ui.screens.classdir

// Glossy tab strip: horizontally scrollable pills; active = white pill with
// accent border, ink text (Apple-clean approximation of the mock underline).

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassTabStripGlossy(
    items: List<Pair<String, String>>,
    activeKey: String,
    onSelect: (String) -> Unit,
) {
    val palette = mockColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items.forEach { (label, key) ->
            val active = activeKey == key
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (active) palette.card else androidx.compose.ui.graphics.Color.Transparent)
                    .border(1.dp, if (active) palette.accent else palette.cardBorder, RoundedCornerShape(999.dp))
                    .clickable { onSelect(key) }
                    .padding(horizontal = 16.dp, vertical = 10.dp),
            ) {
                Text(
                    label,
                    color = if (active) palette.accent else palette.muted,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
            }
        }
    }
}
