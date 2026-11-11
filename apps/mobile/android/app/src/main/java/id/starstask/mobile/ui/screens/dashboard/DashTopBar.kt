package id.starstask.mobile.ui.screens.dashboard

// Top bar for the pastel dashboard: hamburger, brand mark + wordmark, moon
// theme toggle, and a notification bell with the live unread badge.

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.components.BrandMark
import id.starstask.mobile.ui.icons.Lucide
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
            id.starstask.mobile.ui.components.BrandWordmark(heightDp = 22, onDark = isDark)
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
        IconButton(onClick = onOpenNotifications, modifier = Modifier.size(48.dp)) {
            id.starstask.mobile.ui.components.BellWithBadge(
                unreadCount = unreadCount,
                tint = palette.text,
                badgeColor = palette.badge,
                badgeBorderColor = palette.pageBackground,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}
