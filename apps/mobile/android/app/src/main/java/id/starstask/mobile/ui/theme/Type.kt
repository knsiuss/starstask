package id.starstask.mobile.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import id.starstask.mobile.R

// Inter — same family as web (--font-inter in globals.css).
val Inter = FontFamily(
    Font(R.font.inter, FontWeight.Normal),
    Font(R.font.inter, FontWeight.Medium),
    Font(R.font.inter, FontWeight.SemiBold),
    Font(R.font.inter, FontWeight.Bold),
)

// Web sizes: greeting/summary 14sp, name 24sp, stat value 22sp,
// stat label 12sp, hint 11sp.
//
// Web headings use `tracking-tight` (-0.025em) and Tailwind line heights
// (leading-tight 1.25, leading-snug 1.375, leading-relaxed 1.625). Those are
// spelled out per style so a screen never reaches for an inline copy.
private val Tight = (-0.025).em

val SectionTitle = TextStyle(
    fontFamily = Inter,
    fontSize = 14.sp,
    fontWeight = FontWeight.SemiBold,
    letterSpacing = Tight,
    lineHeight = 20.sp,
)

val SectionTitleRail = TextStyle(
    fontFamily = Inter,
    fontSize = 15.sp,
    fontWeight = FontWeight.SemiBold,
    letterSpacing = Tight,
    lineHeight = 20.sp,
)

val SectionDescription = TextStyle(
    fontFamily = Inter,
    fontSize = 12.sp,
    fontWeight = FontWeight.Normal,
    lineHeight = 16.sp,
)

val CardTitle = TextStyle(
    fontFamily = Inter,
    fontSize = 16.sp,
    fontWeight = FontWeight.SemiBold,
    lineHeight = 22.sp,
)

val CardDescription = TextStyle(
    fontFamily = Inter,
    fontSize = 14.sp,
    fontWeight = FontWeight.Normal,
    lineHeight = 20.sp,
)

val StatValue = TextStyle(
    fontFamily = Inter,
    fontSize = 22.sp,
    fontWeight = FontWeight.SemiBold,
    letterSpacing = Tight,
    lineHeight = 22.sp,
    platformStyle = PlatformTextStyle(includeFontPadding = false),
    fontFeatureSettings = "tnum",
)

val StatLabel = TextStyle(
    fontFamily = Inter,
    fontSize = 12.sp,
    fontWeight = FontWeight.Medium,
    lineHeight = 16.sp,
)

val StatHint = TextStyle(
    fontFamily = Inter,
    fontSize = 11.sp,
    fontWeight = FontWeight.Normal,
    lineHeight = 14.sp,
)

val LinkText = TextStyle(
    fontFamily = Inter,
    fontSize = 12.sp,
    fontWeight = FontWeight.SemiBold,
    lineHeight = 16.sp,
)

val LinkActionText = TextStyle(
    fontFamily = Inter,
    fontSize = 14.sp,
    fontWeight = FontWeight.Medium,
    lineHeight = 20.sp,
)

val Greeting = TextStyle(
    fontFamily = Inter,
    fontSize = 14.sp,
    fontWeight = FontWeight.Medium,
    lineHeight = 20.sp,
)

val LargeTitle = TextStyle(
    fontFamily = Inter,
    fontSize = 30.sp,
    fontWeight = FontWeight.SemiBold,
    letterSpacing = Tight,
    lineHeight = 36.sp,
    platformStyle = PlatformTextStyle(includeFontPadding = false),
)

val DisplayName = TextStyle(
    fontFamily = Inter,
    fontSize = 22.sp,
    fontWeight = FontWeight.SemiBold,
    letterSpacing = Tight,
    lineHeight = 30.sp,
)

val Summary = TextStyle(
    fontFamily = Inter,
    fontSize = 14.sp,
    fontWeight = FontWeight.Normal,
    lineHeight = 23.sp,
)

val StarsTaskTypography = Typography(
    bodySmall = TextStyle(fontFamily = Inter, fontSize = 12.sp, fontWeight = FontWeight.Normal),
    bodyMedium = TextStyle(fontFamily = Inter, fontSize = 14.sp, fontWeight = FontWeight.Normal),
    bodyLarge = TextStyle(fontFamily = Inter, fontSize = 16.sp, fontWeight = FontWeight.Normal),
    labelSmall = TextStyle(fontFamily = Inter, fontSize = 11.sp, fontWeight = FontWeight.Medium),
    labelMedium = TextStyle(fontFamily = Inter, fontSize = 12.sp, fontWeight = FontWeight.Medium),
    titleSmall = TextStyle(fontFamily = Inter, fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = SectionTitle,
    titleLarge = TextStyle(fontFamily = Inter, fontSize = 20.sp, fontWeight = FontWeight.SemiBold),
    headlineSmall = StatValue,
    headlineMedium = DisplayName,
    headlineLarge = TextStyle(fontFamily = Inter, fontSize = 30.sp, fontWeight = FontWeight.SemiBold),
)
