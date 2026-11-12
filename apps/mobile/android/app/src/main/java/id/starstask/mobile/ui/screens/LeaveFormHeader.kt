package id.starstask.mobile.ui.screens

// Header + loading/error states for the leave form. Apple-clean large title
// with inline back, aligned to the pastel dashboard palette.

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import id.starstask.mobile.ui.components.StaggerDots
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun LeaveFormHeader(
    title: String,
    subtitle: String,
    onBack: () -> Unit,
) {
    val palette = mockColors()
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        IconButton(onClick = onBack) {
            Icon(Lucide.ArrowLeft, contentDescription = "Back", tint = palette.ink)
        }
        Text("Leave Requests", color = palette.ink, fontSize = 15.sp, modifier = Modifier.weight(1f))
    }
    Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp)) {
        Text(title, color = palette.ink, fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.SemiBold)
        Text(subtitle, color = palette.muted, fontSize = 15.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 2.dp))
    }
}

@Composable
fun LeaveFormLoading() {
    val palette = mockColors()
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Page), horizontalArrangement = Arrangement.Center) {
    }
}

@Composable
fun LeaveFormError(message: String) {
    WebAlert(message = message)
}

@Composable
fun LeaveFormEmpty(message: String) {
    val palette = mockColors()
    Text(message, color = palette.muted, fontSize = 15.sp, modifier = Modifier.padding(horizontal = 16.dp))
}

@Composable
fun LeaveFormNotEditable() {
    Text("This request can no longer be edited.", color = Danger, fontSize = 15.sp, modifier = Modifier.padding(horizontal = 16.dp))
}
