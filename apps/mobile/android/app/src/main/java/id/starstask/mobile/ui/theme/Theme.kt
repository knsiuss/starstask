package id.starstask.mobile.ui.theme

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp

/**
 * Effective theme flag for dashboard tokens. True system dark mode or a user
 * toggle in MainActivity. Composables here read this so dashboard dark mode
 * honours the override instead of the raw system setting.
 */
val LocalDarkTheme = androidx.compose.runtime.compositionLocalOf { false }

// Design tokens mirror apps/web/src/app/globals.css @theme.
// Web radii: --radius-sm 6dp, --radius-md 8dp, --radius-lg 12dp, rounded-xl
// 12dp and rounded-2xl 16dp (header) are the Tailwind utilities used on cards.
val RadiusCard = 12.dp
val RadiusPill = 999.dp

/**
 * Canonical spacing scale. Web uses the Tailwind 4px grid through utilities
 * (`gap-1` … `gap-5`, `p-3`, `p-5`, `mt-5`, `px-3/4/6`, `py-4/8`); Compose code
 * must take its dp values from here instead of literals so a page reads with a
 * single rhythm. The values below cover every dp currently used in `ui/`.
 */
object Spacing {
    val None = 0.dp
    val Xxs = 2.dp
    val Xs = 4.dp
    val Sm = 6.dp
    val Md = 8.dp
    val Lg = 10.dp
    val Xl = 12.dp
    val Xxl = 14.dp
    val Section = 16.dp
    val Block = 20.dp
    val Page = 24.dp

    /** Gap between two elements inside one card. */
    val Inner = Md

    /** Gap between two rows of cards (stat grid uses `gap-2.5`). */
    val CardGap = Lg

    /** Gap between a heading and the list directly below it. */
    val HeadingGap = Xl

    /** Gap between two macro sections (web `mt-5`). */
    val Sections = Block

    /** Horizontal page gutter (web `px-3 sm:px-6`). */
    val PageGutter = Section

    /** Vertical page inset (web `py-4 sm:py-8`). */
    val PageInset = Section

    val WebCardElevation = 1.dp
    val WebCompactCardPadding = 12.dp
}
val Background = Color(0xFFFAFAF8)
val Surface = Color(0xFFFFFFFF)
val Foreground = Color(0xFF292D34)
val Muted = Color(0xFFF0F1F3)
val MutedFill = Muted
val SoftFill = Color(0xFFEEF1F7)
val MutedForeground = Color(0xFF646B76)
val Subtle = Color(0xFFF7F7F5)
val Border = Color(0xFFE7E7E3)
val Accent = Color(0xFF45639E)
val AccentSoft = Color(0xFFE8EDFA)
val Band = Color(0xFFEEF3FC)
/* Dark navy surface for the mission section. Text pairs below are the only
   foregrounds verified against it (14.3:1 and 7.7:1). */
val Navy = Color(0xFF16203A)

/* Classes redesign v2 (web `ClassDirectoryCard` parity): pure-white cards
   on a light-grey page, no navy hero, soft accent-soft cover strip and
   stats row. Token set is intentionally minimal — only the muted tokens
   not already covered by the shared web-mirrored tokens above. */
val ClassesPage = Color(0xFFF5F6F8)
val ClassesCover = Color(0xFFE9EDF8)
val Success = Color(0xFF15803D)
val SuccessSoft = Color(0xFFECFDF5)
val Warning = Color(0xFF8A5A1E)
val WarningSoft = Color(0xFFFBF3E4)
val Danger = Color(0xFFA94A4A)
val DangerSoft = Color(0xFFFBEDED)
val Input = Color(0xFFDCDEE2)
val Hover = Color(0xFFF3F5F9)

// Dark tokens (globals.css dark @theme).
val DarkBackground = Color(0xFF0E1116)
val DarkSurface = Color(0xFF171C24)
val DarkForeground = Color(0xFFE8EAED)
val DarkMutedForeground = Color(0xFF9AA3AF)
val DarkBorder = Color(0xFF262F3D)
val DarkAccent = Color(0xFF8FB0E8)
val DarkMuted = Color(0xFF232A35)
val DarkSuccess = Color(0xFF5CB98A)
val DarkWarning = Color(0xFFD9A441)
val DarkDanger = Color(0xFFE07A7A)

// Assignments redesign tokens (premium minimal). Existing global tokens are
// untouched so Dashboard and other modules keep their current look.
val AssignmentBackground = Color(0xFFF7F8FA)
val AssignmentAccent = Color(0xFF526B9F)
val AssignmentForeground = Color(0xFF202534)
val AssignmentSecondary = Color(0xFF858B98)
val AssignmentBorder = Color(0xFFE9EBF0)

val StarsTaskShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(8.dp),
    large = RoundedCornerShape(12.dp),
    extraLarge = RoundedCornerShape(20.dp),
)

private val LightScheme = lightColorScheme(
    primary = Accent,
    onPrimary = Color.White,
    background = Background,
    surface = Surface,
    onBackground = Foreground,
    onSurface = Foreground,
    outline = Border,
)

private val DarkScheme = darkColorScheme(
    primary = DarkAccent,
    onPrimary = Color(0xFF0B1220),
    background = DarkBackground,
    surface = DarkSurface,
    onBackground = DarkForeground,
    onSurface = DarkForeground,
    outline = DarkBorder,
)

@Composable
fun StarsTaskTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    // enableEdgeToEdge paints the system bars with the windowBackground; keep
    // them in sync with the effective theme so dark mode doesn't expose a
    // light status bar above a dark page.
    val view = androidx.compose.ui.platform.LocalView.current
    if (!view.isInEditMode) {
        androidx.compose.runtime.SideEffect {
            val window = (view.context as? android.app.Activity)?.window ?: return@SideEffect
            val barColor = if (darkTheme) DarkBackground.toArgb() else Background.toArgb()
            window.statusBarColor = barColor
            window.navigationBarColor = barColor
            androidx.core.view.WindowCompat.getInsetsController(window, view)
                .isAppearanceLightStatusBars = !darkTheme
            androidx.core.view.WindowCompat.getInsetsController(window, view)
                .isAppearanceLightNavigationBars = !darkTheme
        }
    }
    androidx.compose.runtime.CompositionLocalProvider(LocalDarkTheme provides darkTheme) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkScheme else LightScheme,
            typography = StarsTaskTypography,
            shapes = StarsTaskShapes,
            content = content,
        )
    }
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true)
@Composable
private fun ThemePreview() {
    StarsTaskTheme {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier.padding(Spacing.Page),
        ) {
            androidx.compose.material3.Text(
                "StarsTask — theme preview",
                color = Foreground,
            )
        }
    }
}
