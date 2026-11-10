package id.starstask.mobile.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Dashboard-only design tokens for the pastel home redesign. Two variants
 * resolved from [LocalDarkTheme]; every dashboard composable reads the
 * current [DashTokens] instead of hardcoded hex or legacy `AccentSoft`.
 * Legacy screens keep their old tokens — this set is scoped to the dashboard.
 */
data class DashPalette(
    val pageBackground: Color,
    val heroStart: Color,
    val heroEnd: Color,
    val heroText: Color,
    val heroMuted: Color,
    val card: Color,
    val cardBorder: Color,
    val text: Color,
    val muted: Color,
    val accent: Color,
    val chip: Color,
    val chipBorder: Color,
    val alertBackground: Color,
    val alertBorder: Color,
    val alertText: Color,
    val alertIconBackground: Color,
    val selectedDayStart: Color,
    val selectedDayEnd: Color,
    val tileBlueBackground: Color,
    val tileBlueForeground: Color,
    val tilePurpleBackground: Color,
    val tilePurpleForeground: Color,
    val tileGreenBackground: Color,
    val tileGreenForeground: Color,
    val sessionAccentBlue: Color,
    val sessionAccentPurple: Color,
    val sessionAccentGreen: Color,
)

private val DashLight = DashPalette(
    pageBackground = Color(0xFFEAF2FF),
    heroStart = Color(0xFFD6E4FF),
    heroEnd = Color(0xFFB8D0FF),
    heroText = Color(0xFF1B2B5C),
    heroMuted = Color(0xFF465A86),
    card = Color(0xFFFFFFFF),
    cardBorder = Color(0xFFDDE5F5),
    text = Color(0xFF1B2B5C),
    muted = Color(0xFF6B7A99),
    accent = Color(0xFF2F6BEF),
    chip = Color(0xFFFFFFFF),
    chipBorder = Color(0xFFDDE5F5),
    alertBackground = Color(0xFFFDE7EC),
    alertBorder = Color(0xFFF3C6D0),
    alertText = Color(0xFFC03A55),
    alertIconBackground = Color(0x1FC03A55),
    selectedDayStart = Color(0xFF5B8DEF),
    selectedDayEnd = Color(0xFF2F6BEF),
    tileBlueBackground = Color(0xFFE8EEFF),
    tileBlueForeground = Color(0xFF3A6FE0),
    tilePurpleBackground = Color(0xFFF1ECFF),
    tilePurpleForeground = Color(0xFF7C5DE0),
    tileGreenBackground = Color(0xFFE7F8EE),
    tileGreenForeground = Color(0xFF1F9E63),
    sessionAccentBlue = Color(0xFF4C8DFF),
    sessionAccentPurple = Color(0xFFA78BFA),
    sessionAccentGreen = Color(0xFF34C77B),
)

private val DashDark = DashPalette(
    pageBackground = Color(0xFF0E1626),
    heroStart = Color(0xFF1F2D47),
    heroEnd = Color(0xFF16233A),
    heroText = Color(0xFFE8EAED),
    heroMuted = Color(0xFF9AA3AF),
    card = Color(0xFF16203A),
    cardBorder = Color(0xFF2A3752),
    text = Color(0xFFE8EAED),
    muted = Color(0xFF9AA3AF),
    accent = Color(0xFF8FB0E8),
    chip = Color(0xFF1F2D47),
    chipBorder = Color(0xFF2A3752),
    alertBackground = Color(0xFF3A2226),
    alertBorder = Color(0xFF5A2F35),
    alertText = Color(0xFFE07A7A),
    alertIconBackground = Color(0x1FE07A7A),
    selectedDayStart = Color(0xFF3A5588),
    selectedDayEnd = Color(0xFF2F4470),
    tileBlueBackground = Color(0xFF1D2A44),
    tileBlueForeground = Color(0xFF8FB0E8),
    tilePurpleBackground = Color(0xFF241F3D),
    tilePurpleForeground = Color(0xFFB9A6FA),
    tileGreenBackground = Color(0xFF16301F),
    tileGreenForeground = Color(0xFF5CB98A),
    sessionAccentBlue = Color(0xFF8FB0E8),
    sessionAccentPurple = Color(0xFFC0B4FB),
    sessionAccentGreen = Color(0xFF5CB98A),
)

@androidx.compose.runtime.Composable
fun dashColors(): DashPalette = if (LocalDarkTheme.current) DashDark else DashLight

val DashRadiusSmall = androidx.compose.foundation.shape.RoundedCornerShape(14.dp)
val DashRadiusTile = androidx.compose.foundation.shape.RoundedCornerShape(18.dp)
val DashRadiusCard = androidx.compose.foundation.shape.RoundedCornerShape(22.dp)
val DashRadiusPill = androidx.compose.foundation.shape.RoundedCornerShape(999.dp)
