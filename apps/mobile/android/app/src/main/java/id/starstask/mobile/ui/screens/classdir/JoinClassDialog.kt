package id.starstask.mobile.ui.screens.classdir

// Join-by-code sheet for the My Classes screen. The raw token is never
// echoed back or logged; the server decides validity, expiry, usage limits,
// and the optional email restriction.

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.components.GradientPillButton
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinClassDialog(
    busy: Boolean,
    error: String?,
    onJoin: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val palette = mockColors()
    var code by remember { mutableStateOf("") }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = palette.card,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .padding(bottom = Spacing.Section),
            verticalArrangement = Arrangement.spacedBy(Spacing.Lg),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                Icon(Lucide.GraduationCap, contentDescription = null, tint = palette.accent, modifier = Modifier.size(24.dp))
                Column {
                    Text("Join a class", color = palette.ink, fontSize = 20.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                    Text("Enter the invitation code your lecturer shared.", color = palette.muted, fontSize = 13.sp)
                }
            }
            if (error != null) {
                WebAlert(message = error)
            }
            TextField(
                value = code,
                onValueChange = { code = it },
                singleLine = true,
                placeholder = { Text("Paste or type the code", color = palette.muted) },
                textStyle = androidx.compose.ui.text.TextStyle(color = palette.ink, fontSize = 17.sp),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go, autoCorrectEnabled = false, capitalization = androidx.compose.ui.text.input.KeyboardCapitalization.None),
                keyboardActions = KeyboardActions(onGo = {
                    if (code.isNotBlank() && !busy) onJoin(code)
                }),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = palette.chip,
                    unfocusedContainerColor = palette.chip,
                    focusedIndicatorColor = palette.accent,
                    unfocusedIndicatorColor = palette.cardBorder,
                    cursorColor = palette.accent,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            GradientPillButton(
                label = if (busy) "Joining…" else "Join class",
                onClick = { if (code.isNotBlank() && !busy) onJoin(code) },
                enabled = code.isNotBlank() && !busy,
                icon = Lucide.Plus,
            )
        }
    }
}
