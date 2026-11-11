package id.starstask.mobile.ui.screens.classdir

// Set Schedule sheet: create a class session with a date + start/end time.
// All validation is server-side (create_discussion_session); the client owns
// only local input parsing.

import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.createSession
import id.starstask.mobile.ui.components.GradientPillButton
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun ClassSetScheduleSheet(
    clazzId: String,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
) {
    val palette = mockColors()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var dateText by remember { mutableStateOf(java.time.LocalDate.now().toString()) }
    var startTime by remember { mutableStateOf("09:00") }
    var endTime by remember { mutableStateOf("11:00") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun pickTime(initial: String, onPick: (String) -> Unit) {
        val (h, m) = initial.split(":").map { it.toIntOrNull() ?: 0 }
        TimePickerDialog(context, { _, hourOfDay, minute ->
            onPick("%02d:%02d".format(hourOfDay, minute))
        }, h, m, true).show()
    }

    ModalBottomSheet(
        onDismissRequest = { if (!busy) onDismiss() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = palette.card,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Set schedule",
                color = palette.ink,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 2.dp),
            )
            if (error != null) {
                WebAlert(message = error!!)
            }
            TextField(
                value = title,
                onValueChange = { title = it },
                singleLine = true,
                placeholder = { Text("Session title", color = palette.muted) },
                textStyle = androidx.compose.ui.text.TextStyle(color = palette.ink, fontSize = 15.sp),
                shape = RoundedCornerShape(14.dp),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = palette.chip,
                    unfocusedContainerColor = palette.chip,
                    focusedIndicatorColor = palette.accent,
                    unfocusedIndicatorColor = palette.cardBorder,
                    cursorColor = palette.accent,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(palette.chip)
                    .clickable {
                        android.app.DatePickerDialog(
                            context,
                            { _, yy, mm, dd -> dateText = "%04d-%02d-%02d".format(yy, mm + 1, dd) },
                            dateText.take(4).toIntOrNull() ?: 2026,
                            (dateText.substring(5, 7).toIntOrNull() ?: 1) - 1,
                            dateText.takeLast(2).toIntOrNull() ?: 1,
                        ).show()
                    }
                    .heightIn(min = 48.dp)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Lucide.CalendarDays, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
                Column {
                    Text("Date", color = palette.muted, fontSize = 11.sp)
                    Text(dateText, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(palette.chip)
                        .clickable { pickTime(startTime) { startTime = it } }
                        .heightIn(min = 48.dp)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Lucide.Clock, contentDescription = null, tint = palette.muted, modifier = Modifier.size(17.dp))
                    Column {
                        Text("Start", color = palette.muted, fontSize = 11.sp)
                        Text(startTime, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    }
                }
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(palette.chip)
                        .clickable { pickTime(endTime) { endTime = it } }
                        .heightIn(min = 48.dp)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Lucide.Clock, contentDescription = null, tint = palette.muted, modifier = Modifier.size(17.dp))
                    Column {
                        Text("End", color = palette.muted, fontSize = 11.sp)
                        Text(endTime, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
            GradientPillButton(
                label = if (busy) "Saving…" else "Save schedule",
                enabled = !busy && title.isNotBlank(),
                onClick = {
                    scope.launch {
                        busy = true
                        error = null
                        try {
                            val zone = java.time.ZoneId.systemDefault()
                            val start = java.time.LocalDateTime.parse("${dateText}T$startTime").atZone(zone).toInstant().toString()
                            val end = java.time.LocalDateTime.parse("${dateText}T$endTime").atZone(zone).toInstant().toString()
                            createSession(clazzId, title.trim(), start, end)
                            onSaved()
                        } catch (e: Exception) {
                            error = "Could not save the schedule."
                        }
                        busy = false
                    }
                },
                icon = Lucide.CalendarDays,
            )
        }
    }
}
