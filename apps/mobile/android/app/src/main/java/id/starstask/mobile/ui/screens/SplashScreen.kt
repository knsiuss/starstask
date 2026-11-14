package id.starstask.mobile.ui.screens

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.DarkAccent
import id.starstask.mobile.ui.theme.DarkBackground
import id.starstask.mobile.ui.theme.DarkMutedForeground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Spacing

private const val SPLASH_IN_MS = 350
private const val SPLASH_OUT_MS = 280
private const val SPLASH_ENTER_STAGGER_MS = 90


/**
 * Animated branded splash shown while the auth session resolves.
 * Reveals the logo mark with a spring, then settles into a subtle
 * breathing glow. Honors [darkTheme] so it matches the app theme.
 */
@Composable
fun SplashScreen(
    onExit: () -> Unit = {},
    darkTheme: Boolean = false,
    holdMs: Long = 1_400L,
) {
    // Warm-paper base + navy bottom gives an immediately visible branded
    // gradient (was #FAFAF8 → #F2F5FB which reads as near-white on bright
    // displays and was indistinguishable from the blank window).
    val background = if (darkTheme) DarkBackground else Color(0xFFFBF8F0)
    val primary = if (darkTheme) DarkAccent else Accent
    // Logo box: pure white in light mode so the dark navy star reads
    // high-contrast (was AccentSoft #E8EDFA which washes out the logo).
    val secondary = if (darkTheme) MutedForeground else Color.White
    val caption = if (darkTheme) DarkMutedForeground else MutedForeground

    var entered by remember { mutableStateOf(false) }
    var exiting by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        entered = true
        kotlinx.coroutines.delay(holdMs)
        exiting = true
        kotlinx.coroutines.delay(SPLASH_OUT_MS.toLong())
        onExit()
    }

    val logoY by animateFloatAsState(
        targetValue = if (entered) 0f else 28f, // dp, not px — converted at use site
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow,
        ),
        label = "splash-logo-y",
    )
    val logoScale by animateFloatAsState(
        targetValue = when {
            exiting -> 0.94f
            entered -> 1f
            else -> 0.92f
        },
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow,
        ),
        label = "splash-logo-scale",
    )
    val logoAlpha by animateFloatAsState(
        targetValue = when {
            exiting -> 0f
            entered -> 1f
            else -> 0f
        },
        animationSpec = tween(SPLASH_IN_MS, easing = FastOutSlowInEasing),
        label = "splash-logo-alpha",
    )
    val textAlpha by animateFloatAsState(
        targetValue = when {
            exiting -> 0f
            entered -> 1f
            else -> 0f
        },
        animationSpec = tween(SPLASH_IN_MS, delayMillis = SPLASH_ENTER_STAGGER_MS, easing = FastOutSlowInEasing),
        label = "splash-text-alpha",
    )
    val glowAlpha by animateFloatAsState(
        targetValue = when {
            exiting -> 0f
            entered -> 1f
            else -> 0f
        },
        animationSpec = tween(600, easing = FastOutSlowInEasing),
        label = "splash-glow-alpha",
    )
    val glowScale by animateFloatAsState(
        targetValue = if (entered && !exiting) 1.06f else 1f,
        animationSpec = tween(700, easing = FastOutSlowInEasing),
        label = "splash-glow-scale",
    )

    val exitAlpha by animateFloatAsState(
        targetValue = if (exiting) 0f else 1f,
        animationSpec = tween(SPLASH_OUT_MS, easing = FastOutSlowInEasing),
        label = "splash-exit-alpha",
    )
    val exitY by animateFloatAsState(
        targetValue = if (exiting) -14f else 0f,
        animationSpec = tween(SPLASH_OUT_MS, easing = FastOutSlowInEasing),
        label = "splash-exit-y",
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        background,
                        if (darkTheme) Color(0xFF121A2A) else Color(0xFFB8CBF2),
                    ),
                ),
            )
            .alpha(exitAlpha)
            .offset(x = 0.dp, y = exitY.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(240.dp)
                .alpha(glowAlpha)
                .graphicsLayerScale(glowScale)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color(
                                red = primary.red,
                                green = primary.green,
                                blue = primary.blue,
                                alpha = if (darkTheme) 0.18f else 0.14f,
                            ),
                            Color.Transparent,
                        ),
                    ),
                    shape = RoundedCornerShape(50),
                ),
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .offset(x = 0.dp, y = logoY.dp)
                    .graphicsLayerScale(logoScale)
                    .alpha(logoAlpha)
                    .padding(horizontal = 28.dp),
                contentAlignment = Alignment.Center,
            ) {
                id.starstask.mobile.ui.components.BrandWordmark(heightDp = 72, onDark = darkTheme)
            }

            Spacer(Modifier.height(Spacing.Section))

            Text(
                text = "Tugas kuliah, satu tempat.",
                style = MaterialTheme.typography.bodyMedium,
                color = caption,
                modifier = Modifier.alpha(textAlpha),
            )
        }
    }
}

private fun Modifier.graphicsLayerScale(scale: Float): Modifier =
    this.then(Modifier.graphicsLayer {
        scaleX = scale
        scaleY = scale
    })
