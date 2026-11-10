package id.starstask.mobile.ui.navigation

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.theme.DurationSoftMs
import id.starstask.mobile.ui.theme.EasingOutCubic
import id.starstask.mobile.ui.theme.dashColors

/**
 * Floating tab bar. Translucent pill surface + soft shadow + rounded
 * active pill. Dock wraps its content instead of filling the screen width,
 * with a transparent gutter around it so content shows through; navigation
 * contract unchanged: currentRoute in, onNavigate(route) out, baseRoute()
 * matching, WindowInsets.navigationBars.
 */
@Composable
fun FloatingNavDock(
    currentRoute: String?,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = dashColors()
    val dockShape = RoundedCornerShape(30.dp)
    val pillShape = RoundedCornerShape(20.dp)
    val destinations = DrawerDestination.entries.filter { it.inBottomBar }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            modifier = Modifier
                .shadow(
                    elevation = 18.dp,
                    shape = dockShape,
                    clip = false,
                    spotColor = Color.Black.copy(alpha = 0.14f),
                    ambientColor = Color.Black.copy(alpha = 0.09f),
                )
                .clip(dockShape)
                .background(palette.card.copy(alpha = 0.78f))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            destinations.forEach { dest ->
                val selected = baseRoute(currentRoute) == baseRoute(dest.route)
                val pillColor by animateColorAsState(
                    targetValue = if (selected) palette.accent.copy(alpha = 0.14f) else Color.Transparent,
                    animationSpec = tween(DurationSoftMs, easing = EasingOutCubic),
                    label = "dockPill",
                )
                val tint by animateColorAsState(
                    targetValue = if (selected) palette.accent else palette.muted,
                    animationSpec = tween(DurationSoftMs, easing = EasingOutCubic),
                    label = "dockTint",
                )
                Column(
                    modifier = Modifier
                        .width(62.dp)
                        .heightIn(min = 52.dp)
                        .clip(pillShape)
                        .background(pillColor)
                        .clickable(onClickLabel = dest.bottomBarLabel) { onNavigate(dest.route) }
                        .padding(horizontal = 2.dp, vertical = 7.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Icon(
                        imageVector = dest.icon,
                        contentDescription = dest.bottomBarLabel,
                        tint = tint,
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        dest.bottomBarLabel,
                        color = tint,
                        fontSize = 10.sp,
                        lineHeight = 12.sp,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}
