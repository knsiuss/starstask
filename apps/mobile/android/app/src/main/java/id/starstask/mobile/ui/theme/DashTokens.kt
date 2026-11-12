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
    val tileGreenBackground: Color,
    val tileGreenForeground: Color,
    val sessionAccentBlue: Color,
    val badge: Color,
    val sessionAccentGreen: Color,
)

private val DashLight = DashPalette(
    pageBackground = Color(0xFFF2F2F7),
    heroStart = Color(0xFFFFFFFF),
    heroEnd = Color(0xFFFFFFFF),
    heroText = Color(0xFF1C1C1E),
    heroMuted = Color(0xFF8E8E93),
    card = Color(0xFFFFFFFF),
    cardBorder = Color(0x14000000),
    text = Color(0xFF1C1C1E),
    muted = Color(0xFF8E8E93),
    accent = Color(0xFF007AFF),
    chip = Color(0xFFFFFFFF),
    chipBorder = Color(0x1A000000),
    alertBackground = Color(0xFFFDEBE9),
    alertBorder = Color(0xFFF5C9C4),
    alertText = Color(0xFFFF3B30),
    alertIconBackground = Color(0x1AFF3B30),
    selectedDayStart = Color(0xFF0A84FF),
    selectedDayEnd = Color(0xFF007AFF),
    tileBlueBackground = Color(0x14007AFF),
    tileBlueForeground = Color(0xFF007AFF),
    tileGreenBackground = Color(0x1A30D158),
    tileGreenForeground = Color(0xFF30B158),
    sessionAccentBlue = Color(0xFF007AFF),
    badge = Color(0xFFFF3B30),
    sessionAccentGreen = Color(0xFF30D158),
)

private val DashDark = DashPalette(
    pageBackground = Color(0xFF000000),
    heroStart = Color(0xFF1C1C1E),
    heroEnd = Color(0xFF1C1C1E),
    heroText = Color(0xFFF2F2F7),
    heroMuted = Color(0xFF8E8E93),
    card = Color(0xFF1C1C1E),
    cardBorder = Color(0x1FFFFFFF),
    text = Color(0xFFF2F2F7),
    muted = Color(0xFF8E8E93),
    accent = Color(0xFF0A84FF),
    chip = Color(0xFF2C2C2E),
    chipBorder = Color(0x1FFFFFFF),
    alertBackground = Color(0xFF331F1F),
    alertBorder = Color(0xFF5A2F2F),
    alertText = Color(0xFFFF453A),
    alertIconBackground = Color(0x1FFF453A),
    selectedDayStart = Color(0xFF0A84FF),
    selectedDayEnd = Color(0xFF0A84FF),
    tileBlueBackground = Color(0x1F0A84FF),
    tileBlueForeground = Color(0xFF0A84FF),
    tileGreenBackground = Color(0x1430D158),
    tileGreenForeground = Color(0xFF30D158),
    sessionAccentBlue = Color(0xFF0A84FF),
    badge = Color(0xFFFF453A),
    sessionAccentGreen = Color(0xFF30D158),
)

@androidx.compose.runtime.Composable
fun dashColors(): DashPalette = if (LocalDarkTheme.current) DashDark else DashLight

val DashRadiusSmall = androidx.compose.foundation.shape.RoundedCornerShape(14.dp)
val DashRadiusTile = androidx.compose.foundation.shape.RoundedCornerShape(18.dp)
val DashRadiusCard = androidx.compose.foundation.shape.RoundedCornerShape(22.dp)
val DashRadiusPill = androidx.compose.foundation.shape.RoundedCornerShape(999.dp)
val DashRadiusSmallShape = DashRadiusSmall
val DashRadiusTileShape = DashRadiusTile
val DashRadiusCardShape = DashRadiusCard
val DashRadiusPillShape = DashRadiusPill

