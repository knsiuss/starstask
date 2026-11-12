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

// Apple-calm: grouped system background, white cards with near-invisible borders,
// one system blue, hairline separators.
private val MockLight = MockPalette(
    pageTop = Color(0xFFF2F2F7),
    pageBottom = Color(0xFFF2F2F7),
    card = Color(0xFFFFFFFF),
    cardBorder = Color(0x14000000),
    hairline = Color(0x0F000000),
    chip = Color(0xFFE9E9EB),
    ink = Color(0xFF1C1C1E),
    muted = Color(0xFF8E8E93),
    accent = Color(0xFF007AFF),
    accentSoft = Color(0x1A007AFF),
    accentSofter = Color(0x0D007AFF),
    dockBar = Color(0xF2FFFFFF),
    dockBorder = Color(0x1F000000),
    halo = Color(0x14007AFF),
    goodBg = Color(0x14007AFF),
    goodFg = Color(0xFF007AFF),
    riskBg = Color(0xFFFFE5E5),
    riskFg = Color(0xFFFF3B30),
    fairBg = Color(0xFFFFF4D6),
    fairFg = Color(0xFF9E6B00),
    skeleton = Color(0xFFE5E5EA),
)

private val MockDark = MockPalette(
    pageTop = Color(0xFF000000),
    pageBottom = Color(0xFF000000),
    card = Color(0xFF1C1C1E),
    cardBorder = Color(0x1FFFFFFF),
    hairline = Color(0x1FFFFFFF),
    chip = Color(0xFF2C2C2E),
    ink = Color(0xFFF2F2F7),
    muted = Color(0xFF8E8E93),
    accent = Color(0xFF0A84FF),
    accentSoft = Color(0x1F0A84FF),
    accentSofter = Color(0x140A84FF),
    dockBar = Color(0xC41C1C1E),
    dockBorder = Color(0x1FFFFFFF),
    halo = Color(0x140A84FF),
    goodBg = Color(0x1F0A84FF),
    goodFg = Color(0xFF0A84FF),
    riskBg = Color(0xFF331F1F),
    riskFg = Color(0xFFFF453A),
    fairBg = Color(0xFF332B12),
    fairFg = Color(0xFFFFD60A),
    skeleton = Color(0xFF2C2C2E),
)

@androidx.compose.runtime.Composable
fun mockColors(): MockPalette = if (LocalDarkTheme.current) MockDark else MockLight

@androidx.compose.runtime.Composable
fun mockPageBrush(): Brush {
    val palette = mockColors()
    return Brush.verticalGradient(listOf(palette.pageTop, palette.pageBottom))
}
