package id.starstask.mobile.ui.components

// Premium Apple-inspired success modal. Centered floating card over a dimmed
// backdrop; used after every confirmed backend success (create meeting,
// check-in, publish, review, moderate). Never shown on failure.

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DarkSuccess
import id.starstask.mobile.ui.theme.LocalDarkTheme
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun StartaskSuccessDialog(
    title: String,
    summary: String?,
    primaryLabel: String,
    onPrimary: () -> Unit,
    secondaryLabel: String = "Done",
    onDismiss: () -> Unit,
) {
    val palette = mockColors()
    val dark = LocalDarkTheme.current
    val accent = if (dark) DarkSuccess else Success
    val soft = if (dark) Color(0xFF16301F) else SuccessSoft
    val shape = RoundedCornerShape(12.dp)

    var enter by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { enter = true }
    val scale by animateFloatAsState(
        targetValue = if (enter) 1f else 0.82f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "successDialogScale",
    )
    val alpha by animateFloatAsState(
        targetValue = if (enter) 1f else 0f,
        animationSpec = tween(220),
        label = "successDialogAlpha",
    )

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.38f))
                .clickable(enabled = false) {},
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .widthIn(max = 400.dp)
                    .padding(24.dp)
                    .scale(scale)
                    .alpha(alpha)
                    .clip(shape)
                    .background(palette.card)
                    .border(1.dp, palette.cardBorder, shape)
                    .padding(horizontal = 24.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(soft),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Lucide.Check, contentDescription = null, tint = accent, modifier = Modifier.size(34.dp))
                }
                Text(
                    title,
                    color = palette.ink,
                    fontSize = 22.sp,
                    lineHeight = 27.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
                if (!summary.isNullOrBlank()) {
                    Text(
                        summary,
                        color = palette.muted,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        textAlign = TextAlign.Center,
                    )
                }
                Spacer(Modifier.size(4.dp))
                GradientPillButton(
                    label = primaryLabel,
                    onClick = onPrimary,
                    fillMaxWidth = true,
                )
                androidx.compose.material3.TextButton(onClick = onDismiss) {
                    Text(secondaryLabel, color = palette.muted, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}
