package id.starstask.mobile.ui.screens

// Status-only filter sheet for the leave list. Selections apply immediately
// on tap (the list filter is client-side), so there is no staged state or
// apply button.

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.imePadding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.leaveStatusLabel
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.dashColors

private val LeaveFilterStatuses = listOf(
    null,
    "submitted",
    "approved",
    "rejected",
    "draft",
    "forwarded",
    "cancelled",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveFilterSheet(
    selected: String?,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    val palette = dashColors()
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = palette.card,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(horizontal = 20.dp, vertical = 12.dp),
        ) {
            Text(
                "Filter by status",
                color = palette.text,
                fontSize = 20.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            LeaveFilterStatuses.forEach { status ->
                val active = status == selected
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable {
                            onSelect(status)
                            onDismiss()
                        }
                        .padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        if (status == null) "All" else leaveStatusLabel(status),
                        color = palette.text,
                        fontSize = 16.sp,
                        modifier = Modifier.weight(1f),
                    )
                    if (active) {
                        Icon(Lucide.Check, contentDescription = "Selected", tint = palette.accent, modifier = Modifier.size(20.dp))
                    }
                }
            }
        }
    }
}
