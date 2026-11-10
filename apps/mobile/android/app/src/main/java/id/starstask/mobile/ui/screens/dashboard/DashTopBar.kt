package id.starstask.mobile.ui.screens.dashboard

// Top bar for the pastel dashboard: hamburger, brand mark + wordmark, moon
// theme toggle, and a notification bell with the live unread badge.

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.background
import id.starstask.mobile.ui.components.BrandMark
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DashRadiusPill
import id.starstask.mobile.ui.theme.dashColors

@Composable
fun DashTopBar(
    isDark: Boolean,
    unreadCount: Int?,
    onOpenDrawer: () -> Unit,
    onToggleTheme: () -> Unit,
    onOpenNotifications: () -> Unit,
    showThemeToggle: Boolean = true,
) {
    val palette = dashColors()
    Row(
        modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        IconButton(onClick = onOpenDrawer, modifier = Modifier.size(44.dp)) {
            Icon(Lucide.Menu, contentDescription = "Menu", tint = palette.text, modifier = Modifier.size(22.dp))
        }
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            BrandMark(sizeDp = 28)
            Text("StarsTask", color = palette.text, fontSize = 20.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, maxLines = 1)
        }
        if (showThemeToggle) {
            IconButton(onClick = onToggleTheme, modifier = Modifier.size(44.dp)) {
                Icon(
                    if (isDark) Lucide.Sun else Lucide.Moon,
                    contentDescription = if (isDark) "Switch to light mode" else "Switch to dark mode",
                    tint = palette.text,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
        IconButton(onClick = onOpenNotifications, modifier = Modifier.size(44.dp)) {
            Box {
                Icon(Lucide.Bell, contentDescription = "Notifications", tint = palette.text, modifier = Modifier.size(22.dp))
                if (unreadCount != null && unreadCount > 0) {
                    val label = if (unreadCount > 9) "9+" else unreadCount.toString()
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .clip(DashRadiusPill)
                            .background(palette.badge)
                            .padding(horizontal = 5.dp, vertical = 2.dp),
                    ) {
                        Text(label, color = androidx.compose.ui.graphics.Color.White, fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                    }
                }
            }
        }
    }
}
