package id.starstask.mobile.ui.theme

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// Web design tokens (apps/web/src/app/globals.css @theme) — welcome mockup blues.
val Background = Color(0xFFEEF6FF)
val Surface = Color(0xFFFFFFFF)
val Foreground = Color(0xFF0F2A5C)
val MutedForeground = Color(0xFF64748B)
val Border = Color(0xFFCBD5E1)
val Accent = Color(0xFF2563EB)
val AccentSoft = Color(0xFFDBEAFE)
val Band = Color(0xFFEEF3FC)
val MutedFill = Color(0xFFF0F1F3)
val Subtle = Color(0xFFF7F7F5)
val DangerSoft = Color(0xFFFBEDED)
val SuccessSoft = Color(0xFFECFDF5)
val WarningSoft = Color(0xFFFBF3E4)
val Warning = Color(0xFF8A5A1E)
val Danger = Color(0xFFA94A4A)

private val LightScheme = lightColorScheme(
    primary = Accent,
    onPrimary = Color.White,
    background = Background,
    surface = Surface,
    onBackground = Foreground,
    onSurface = Foreground,
    outline = Border,
)

@Composable
fun StarsTaskTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = LightScheme, content = content)
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true)
@Composable
private fun ThemePreview() {
    StarsTaskTheme {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier.padding(24.dp),
        ) {
            androidx.compose.material3.Text(
                "StarsTask — theme preview",
                color = Foreground,
            )
        }
    }
}
