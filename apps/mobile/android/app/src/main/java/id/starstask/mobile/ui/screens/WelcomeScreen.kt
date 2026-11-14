package id.starstask.mobile.ui.screens

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import id.starstask.mobile.ui.components.StaggerDots
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import id.starstask.mobile.R
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.DarkBackground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Spacing
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private const val WELCOME_IN_MS = 500
private const val WELCOME_STAGGER_MS = 70

/**
 * Branded welcome screen. Warm-paper → navy gradient, logo hero in a
 * white card with a soft blue glow, then a single Google CTA.
 * The loading state keeps the hero visible and shows a progress spinner
 * inside the button.
 */
@Composable
fun WelcomeScreen(
    darkTheme: Boolean = false,
    scope: kotlinx.coroutines.CoroutineScope,
    context: android.content.Context,
) {
    val background = if (darkTheme) DarkBackground else Color(0xFFFBF8F0)
    val bottom = if (darkTheme) Color(0xFF121A2A) else Color(0xFFB8CBF2)
    val primary = if (darkTheme) id.starstask.mobile.ui.theme.DarkAccent else Accent
    val caption = if (darkTheme) id.starstask.mobile.ui.theme.DarkMutedForeground else MutedForeground
    val titleColor = if (darkTheme) Color(0xFFE8EAED) else Color(0xFF292D34)

    var entered by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var signInError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        entered = true
    }

    val logoY by animateFloatAsState(
        targetValue = if (entered) 0f else 28f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow,
        ),
        label = "welcome-logo-y",
    )
    val logoScale by animateFloatAsState(
        targetValue = if (entered) 1f else 0.9f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow,
        ),
        label = "welcome-logo-scale",
    )
    val logoAlpha by animateFloatAsState(
        targetValue = if (entered) 1f else 0f,
        animationSpec = tween(WELCOME_IN_MS, easing = FastOutSlowInEasing),
        label = "welcome-logo-alpha",
    )
    val textAlpha by animateFloatAsState(
        targetValue = if (entered) 1f else 0f,
        animationSpec = tween(WELCOME_IN_MS, delayMillis = WELCOME_STAGGER_MS, easing = FastOutSlowInEasing),
        label = "welcome-text-alpha",
    )
    val buttonAlpha by animateFloatAsState(
        targetValue = if (entered) 1f else 0f,
        animationSpec = tween(WELCOME_IN_MS, delayMillis = WELCOME_STAGGER_MS * 2, easing = FastOutSlowInEasing),
        label = "welcome-button-alpha",
    )
    val trustAlpha by animateFloatAsState(
        targetValue = if (entered) 1f else 0f,
        animationSpec = tween(WELCOME_IN_MS, delayMillis = WELCOME_STAGGER_MS * 3, easing = FastOutSlowInEasing),
        label = "welcome-trust-alpha",
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(background, bottom),
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.Page),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(280.dp)
                    .alpha(logoAlpha)
                    .graphicsScale(logoScale)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                Color(
                                    red = primary.red,
                                    green = primary.green,
                                    blue = primary.blue,
                                    alpha = if (darkTheme) 0.20f else 0.18f,
                                ),
                                Color.Transparent,
                            ),
                        ),
                        shape = RoundedCornerShape(50),
                    ),
            )

            Box(
                modifier = Modifier
                    .offset { IntOffset(0, logoY.roundToInt()) }
                    .graphicsScale(logoScale)
                    .alpha(logoAlpha)
                    .shadow(16.dp, RoundedCornerShape(32.dp))
                    .clip(RoundedCornerShape(32.dp))
                    .background(Color.White)
                    .padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                id.starstask.mobile.ui.components.BrandWordmark(heightDp = 84, onDark = false)
            }

            Spacer(Modifier.height(Spacing.Section))

            Text(
                text = "Welcome Back",
                style = MaterialTheme.typography.headlineLarge,
                color = titleColor,
                modifier = Modifier.alpha(textAlpha),
            )

            Spacer(Modifier.height(Spacing.Xs))

            Text(
                text = "Pick up where you left off — keep your classes and tasks in one place.",
                color = caption,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.alpha(textAlpha),
            )

            Spacer(Modifier.height(Spacing.Page))

            Button(
                onClick = {
                    loading = true
                    signInError = null
                    scope.launch {
                        id.starstask.mobile.data.signInWithGoogleNative(context)?.let {
                            signInError = it
                        }
                        loading = false
                    }
                },
                enabled = !loading,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Accent,
                    contentColor = Color.White,
                ),
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(56.dp)
                    .alpha(buttonAlpha),
                shape = RoundedCornerShape(28.dp),
            ) {
                if (loading) {
                } else {
                    Text(
                        "Continue with Google",
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
            }

            Spacer(Modifier.height(Spacing.Section))

            if (signInError != null) {
                Text(
                    signInError!!,
                    color = Color(0xFFB42318),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.alpha(buttonAlpha),
                )
                Spacer(Modifier.height(Spacing.Md))
            }

            Row(
                modifier = Modifier.alpha(trustAlpha),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = id.starstask.mobile.ui.icons.Lucide.ShieldCheck,
                    contentDescription = null,
                    tint = primary,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    "Secure sign-in via Google · No password stored",
                    color = caption,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

private fun Modifier.graphicsScale(scale: Float): Modifier =
    this.then(Modifier.graphicsLayer {
        scaleX = scale
        scaleY = scale
    })
