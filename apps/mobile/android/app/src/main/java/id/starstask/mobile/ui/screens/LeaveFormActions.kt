package id.starstask.mobile.ui.screens

// Sticky footer actions for the leave form. Save draft is secondary
// (outlined) and Submit request is the gradient pill matching the list CTA.
// Busy state lives inside the buttons.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.components.GradientPillButton
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun LeaveFormActions(
    busy: Boolean,
    onSaveDraft: () -> Unit,
    onSubmit: () -> Unit,
) {
    val palette = mockColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(horizontal = Spacing.Section, vertical = Spacing.Md),
        horizontalArrangement = Arrangement.spacedBy(Spacing.Xl),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedButton(
            onClick = onSaveDraft,
            enabled = !busy,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = palette.ink),
            modifier = Modifier.weight(1f).heightIn(min = 50.dp),
        ) {
            if (busy) {
                id.starstask.mobile.ui.components.StaggerDots(color = palette.ink)
            } else {
                Text("Save draft", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        GradientPillButton(
            label = "Submit request",
            onClick = onSubmit,
            enabled = !busy,
            modifier = Modifier.weight(1f).heightIn(min = 50.dp),
        )
    }
}
