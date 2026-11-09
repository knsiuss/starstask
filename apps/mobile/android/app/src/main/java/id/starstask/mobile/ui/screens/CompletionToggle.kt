package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.setAssignmentCompletion
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import kotlinx.coroutines.launch

// Translation of CompletionToggle.tsx: personal "done" mark, never a submission.

@Composable
fun CompletionToggle(
    userId: String,
    assignmentId: String,
    completed: Boolean,
    title: String,
    onChanged: (Boolean) -> Unit,
) {
    var current by remember(assignmentId, completed) { mutableStateOf(completed) }
    var failed by remember { mutableStateOf(false) }
    var pending by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun toggle() {
        if (pending || userId.isBlank()) return
        val next = !current
        pending = true
        failed = false
        scope.launch {
            try {
                setAssignmentCompletion(userId, assignmentId, next)
                current = next
                onChanged(next)
            } catch (_: Exception) {
                failed = true
            }
            pending = false
        }
    }

    val label = if (current) {
        "Remove your \"done\" mark from $title"
    } else {
        "Mark $title as done for yourself"
    }

    // Mockup: the row shows a bare ○/✓ circle — no text. The semantics stay:
    // tapping toggles this user's own completion mark.
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(28.dp)
            .clip(androidx.compose.foundation.shape.CircleShape)
            .border(
                1.dp,
                when {
                    failed -> Danger
                    current -> Accent
                    else -> Color(0xFFC7CCD6)
                },
                androidx.compose.foundation.shape.CircleShape,
            )
            .clickable(enabled = !pending, onClick = { toggle() }),
    ) {
        if (pending) {
            CircularProgressIndicator(
                modifier = Modifier.size(14.dp),
                strokeWidth = 2.dp,
                color = if (failed) Danger else Accent,
            )
        } else if (current) {
            Text(
                "✓",
                color = Accent,
            )
        }
    }
}
