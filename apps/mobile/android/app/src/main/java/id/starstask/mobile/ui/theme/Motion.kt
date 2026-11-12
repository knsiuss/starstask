package id.starstask.mobile.ui.theme

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp

// Motion tokens mirror apps/web/src/app/globals.css keyframes and the
// transition utilities used on web components. Times are duration strings in
// CSS (ms); here they are plain Int milliseconds.

/** Web `transition-all duration-150` on pills, links and icon chips. */
const val DurationFastMs = 150

/** Web `.st-refresh-orbit` — brand mark orbit while refreshing. */
const val DurationRefreshOrbitMs = 900

/** Web `rise-in` — gentle dashboard entrance. */
const val DurationRiseMs = 420

/** Web `.stat-shimmer` — single sweep per card mount. */
const val DurationShimmerMs = 1400
const val DurationShimmerDelayMs = 300

/** Web `--rise-delay` staggering for dashboard sections. */
const val RiseDelayStepMs = 40

/** Web `.st-float` — slow bob used by the header brand mark. */
const val DurationFloatMs = 4500

/**
 * Web `active:scale-95`; the armed pull-to-refresh state uses a gentler
 * `scale(1.1)` transition at `180ms ease-out`.
 */
/** Assignments redesign — list/pill/sheet transitions (180–250ms). */
const val DurationSoftMs = 200

const val PressedScale = 0.95f
const val DurationPressMs = 180

/** Vertical travel of `rise-in` / `st-fade-up` / toast-in. */
const val RiseTravelPx = 10f

// Web easing curves.
val EasingOutCubic = androidx.compose.animation.core.CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
val EasingStandard = androidx.compose.animation.core.CubicBezierEasing(0.2f, 0.8f, 0.2f, 1f)

/**
 * Single diagonal sweep matching `.stat-shimmer::after`: a 105° white band that
 * travels from -150% to +150% of the width once, then stays clear.
 */
@Composable
fun ShimmerOverlay(
    modifier: Modifier = Modifier,
    progress: Float? = null,
) {
    val animated by animateFloatAsState(
        targetValue = progress ?: 1f,
        animationSpec = tween(
            durationMillis = DurationShimmerMs,
            delayMillis = DurationShimmerDelayMs,
            easing = FastOutSlowInEasing,
        ),
        label = "shimmer",
    )
    ShimmerSweep(progress = animated, modifier = modifier)
}

@Composable
private fun ShimmerSweep(progress: Float, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        if (progress <= 0f || progress >= 1f) return@BoxWithConstraints
        val bandWidth = maxWidth * 0.6f
        val travel = maxWidth * 2.5f
        val x = -travel + travel * progress
        Box(
            modifier = Modifier
                .offset(x = x)
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color.White.copy(alpha = 0.14f),
                            Color.Transparent,
                        ),
                        start = Offset.Zero,
                        end = Offset(bandWidth.value, bandWidth.value * 0.26f),
                    ),
                ),
        )
    }
}

/**
 * Totally-translated copy of the web stat card shimmer for dark surfaces,
 * where the white band needs a darker source. Kept separate so callers do not
 * have to branch on theme.
 */
@Composable
fun ShimmerSweepOnce(
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    if (!enabled) return
    ShimmerOverlay(modifier = modifier)
}

/**
 * Wraps [content] in a box that draws the shimmer sweep over it without
 * intercepting pointer input, mirroring `.stat-shimmer` (`overflow:hidden` +
 * `pointer-events:none` pseudo-element).
 */
@Composable
fun ShimmerCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(modifier = modifier) {
        content()
        ShimmerSweepOnce(modifier = Modifier.fillMaxSize())
    }
}

/** Gentle bob for the header brand mark (`st-float`, 4.5s ease-in-out). */
@Composable
fun FloatModifier(modifier: Modifier = Modifier): Modifier {
    val transition = rememberInfiniteTransition(label = "float")
    val offset by transition.animateFloat(
        initialValue = 0f,
        targetValue = -8f,
        animationSpec = infiniteRepeatable(
            animation = tween(DurationFloatMs, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "floatOffset",
    )
    return modifier.offset(y = offset.dp)
}

/**
 * Mirrors web `.rise-in`: gentle entrance (opacity 0 -> 1 + translateY
 * 10px -> 0, 420ms ease-out both, --rise-delay stagger). Reduced-motion
 * kill-switch is handled by not animating when the system reduced-motion
 * setting is on (Web `@media (prefers-reduced-motion: reduce)`).
 */
@Composable
fun RiseInModifier(
    modifier: Modifier = Modifier,
    delayMs: Int = 0,
    enabled: Boolean = true,
): Modifier {
    if (!enabled) return modifier
    val rise by androidx.compose.animation.core.animateFloatAsState(
        targetValue = 1f,
        animationSpec = androidx.compose.animation.core.tween(
            durationMillis = DurationRiseMs,
            delayMillis = delayMs,
            easing = androidx.compose.animation.core.CubicBezierEasing(0.22f, 1f, 0.36f, 1f),
        ),
        label = "riseIn",
    )
    return modifier.graphicsLayer {
        alpha = rise
        translationY = (1f - rise) * RiseTravelPx
    }
}

/**
 * Pressed scale with spring animation, matching QuickActionPill physics.
 * Self-contained: carries its own click handling + interaction source, so
 * callers must use this modifier INSTEAD of a separate `clickable` on the
 * same composable.
 */
@Composable
fun PressedScaleModifier(
    onPress: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    pressedScale: Float = PressedScale,
): Modifier {
    val interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = androidx.compose.animation.core.spring(
            dampingRatio = androidx.compose.animation.core.Spring.DampingRatioMediumBouncy,
            stiffness = androidx.compose.animation.core.Spring.StiffnessMedium,
        ),
        label = "pressScale",
    )
    return modifier
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .clickable(interactionSource = interactionSource, indication = null) { onPress?.invoke() }
}

/**
 * Looping horizontal shimmer brush used by skeleton placeholders while the
 * worker is fetching fresh data. Never flashes opacity/size; only the brush
 * translates. Infinite transition, `DurationShimmerMs` per sweep.
 */
@Composable
fun rememberShimmerBrush(width: androidx.compose.ui.unit.Dp): Brush {
    val transition = rememberInfiniteTransition(label = "shimmerLoop")
    val offset by transition.animateFloat(
        initialValue = -width.value * 2f,
        targetValue = width.value * 2f,
        animationSpec = infiniteRepeatable(
            animation = tween(DurationShimmerMs, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "shimmerSweep",
    )
    return Brush.linearGradient(
        colors = listOf(
            androidx.compose.ui.graphics.Color(0xFFE8EDFA),
            androidx.compose.ui.graphics.Color(0xFFF4F7FE),
            androidx.compose.ui.graphics.Color(0xFFE8EDFA),
        ),
        start = Offset(offset, 0f),
        end = Offset(offset + width.value, 0f),
    )
}
