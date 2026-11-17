package id.starstask.mobile.ui.components

// Shared shell top bar: hamburger, brand mark + wordmark, moon theme toggle,
// and a notification bell with the live unread badge. Hosted by the NavHost
// scaffold so every tab gets the same chrome.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import kotlinx.coroutines.launch
import id.starstask.mobile.data.setThemeMode
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.LocalDarkTheme
import id.starstask.mobile.ui.theme.mockColors

private val BadgeRed = Color(0xFFE5484D)

@Composable
fun StarsTaskTopBar(
    unreadCount: Int?,
    onOpenDrawer: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    val palette = mockColors()
    val isDark = LocalDarkTheme.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding(),
    ) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(palette.glassBar)
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        IconButton(onClick = onOpenDrawer, modifier = Modifier.size(44.dp)) {
            Icon(Lucide.Menu, contentDescription = "Menu", tint = palette.ink, modifier = Modifier.size(22.dp))
        }
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            BrandWordmark(heightDp = 22, onDark = isDark)
        }
        IconButton(
            onClick = { scope.launch { setThemeMode(context, if (isDark) "light" else "dark") } },
            modifier = Modifier.size(44.dp),
        ) {
            Icon(
                if (isDark) Lucide.Sun else Lucide.Moon,
                contentDescription = if (isDark) "Switch to light mode" else "Switch to dark mode",
                tint = palette.ink,
                modifier = Modifier.size(20.dp),
            )
        }
        IconButton(onClick = onOpenNotifications, modifier = Modifier.size(48.dp)) {
            BellWithBadge(
                unreadCount = unreadCount,
                tint = palette.ink,
                badgeColor = BadgeRed,
                badgeBorderColor = palette.card,
                modifier = Modifier.size(24.dp),
            )
        }
    }
    // Bottom hairline divider: the bar floats its content over page content.
    androidx.compose.foundation.layout.Box(
        modifier = Modifier.fillMaxWidth().height(1.dp).background(palette.hairline),
    )
    }
}
