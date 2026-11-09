package id.starstask.mobile.ui.screens

// Sticky footer actions for the leave form. Save draft is secondary (outlined),
// Submit request is primary. Busy state lives inside the buttons.

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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.theme.AssignmentAccent
import id.starstask.mobile.ui.theme.AssignmentBorder
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.Spacing

@Composable
fun LeaveFormActions(
    busy: Boolean,
    onSaveDraft: () -> Unit,
    onSubmit: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(androidx.compose.ui.graphics.Color.White.copy(alpha = 0.95f))
            .border(0.5.dp, AssignmentBorder, RoundedCornerShape(0.dp))
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(horizontal = Spacing.Section, vertical = Spacing.Md),
        horizontalArrangement = Arrangement.spacedBy(Spacing.Xl),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedButton(
            onClick = onSaveDraft,
            enabled = !busy,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = AssignmentForeground),
            modifier = Modifier.weight(1f).heightIn(min = 50.dp),
        ) {
            if (busy) {
                CircularProgressIndicator(color = AssignmentForeground, modifier = Modifier.size(18.dp))
            } else {
                Text("Save draft", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Button(
            onClick = onSubmit,
            enabled = !busy,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AssignmentAccent, contentColor = androidx.compose.ui.graphics.Color.White),
            modifier = Modifier.weight(1f).heightIn(min = 50.dp),
        ) {
            if (busy) {
                CircularProgressIndicator(color = androidx.compose.ui.graphics.Color.White, modifier = Modifier.size(18.dp))
            } else {
                Text("Submit request", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
