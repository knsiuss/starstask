package id.starstask.mobile.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Attendance redesign palette (glossy iOS-light mock). Resolved like
 * [dashColors]: read [LocalDarkTheme], never a raw system setting, so the
 * user's DataStore toggle wins.
 */
data class MockPalette(
    val pageTop: Color,
    val pageBottom: Color,
    val card: Color,
    val cardBorder: Color,
    val hairline: Color,
    val chip: Color,
    val ink: Color,
    val muted: Color,
    val accent: Color,
    val accentSoft: Color,
    val accentSofter: Color,
    val dockBar: Color,
    val dockBorder: Color,
    val halo: Color,
    val goodBg: Color,
    val goodFg: Color,
    val riskBg: Color,
    val riskFg: Color,
    val fairBg: Color,
    val fairFg: Color,
    val skeleton: Color,
)

private val MockLight = MockPalette(
    pageTop = Color(0xFFE9EFFC),
    pageBottom = Color(0xFFF7F8FB),
    card = Color(0xFFFFFFFF),
    cardBorder = Color(0xFFE7EAF4),
    hairline = Color(0xFFEDEFF5),
    chip = Color(0xFFEDF0F7),
    ink = Color(0xFF111B33),
    muted = Color(0xFF6B7280),
    accent = Color(0xFF2F5BFF),
    accentSoft = Color(0xFFE4EBFF),
    accentSofter = Color(0xFFEEF2FF),
    dockBar = Color(0xFFFFFFFF),
    dockBorder = Color(0xFFEDEFF5),
    halo = Color(0xFFDCE7FF),
    goodBg = Color(0xFFE1E9FF),
    goodFg = Color(0xFF2F5BFF),
    riskBg = Color(0xFFFBE3E6),
    riskFg = Color(0xFFD64550),
    fairBg = Color(0xFFFBF3E4),
    fairFg = Color(0xFF8A5A1E),
    skeleton = Color(0xFFE4E8EF),
)

private val MockDark = MockPalette(
    pageTop = Color(0xFF0E1524),
    pageBottom = Color(0xFF12161F),
    card = Color(0xFF161D2B),
    cardBorder = Color(0xFF232C3F),
    hairline = Color(0xFF232C3F),
    chip = Color(0xFF1F2636),
    ink = Color(0xFFE8ECF6),
    muted = Color(0xFF9AA5B8),
    accent = Color(0xFF7EA0FF),
    accentSoft = Color(0xFF1F2A44),
    accentSofter = Color(0xFF1A2234),
    dockBar = Color(0xE6161D2B),
    dockBorder = Color(0xFF232C3F),
    halo = Color(0xFF182347),
    goodBg = Color(0xFF1E2B4A),
    goodFg = Color(0xFF9DBCFF),
    riskBg = Color(0xFF33202A),
    riskFg = Color(0xFFF1A5AE),
    fairBg = Color(0xFF332A1C),
    fairFg = Color(0xFFD9A441),
    skeleton = Color(0xFF1F2636),
)

@androidx.compose.runtime.Composable
fun mockColors(): MockPalette = if (LocalDarkTheme.current) MockDark else MockLight

@androidx.compose.runtime.Composable
fun mockPageBrush(): Brush {
    val palette = mockColors()
    return Brush.verticalGradient(listOf(palette.pageTop, palette.pageBottom))
}
