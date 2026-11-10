package id.starstask.mobile.ui.components

// Shared shell top bar: hamburger, brand mark + wordmark, moon theme toggle,
// and a notification bell with the live unread badge. Hosted by the NavHost
// scaffold so every tab gets the same chrome.

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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

private const val UNREAD_BADGE_CAP = 9
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
    Row(
        modifier = Modifier.fillMaxWidth().statusBarsPadding().height(56.dp).padding(horizontal = 8.dp),
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
            BrandMark(sizeDp = 26)
            Text(
                "StarsTask",
                color = palette.ink,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
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
        IconButton(onClick = onOpenNotifications, modifier = Modifier.size(44.dp)) {
            Box {
                Icon(
                    Lucide.Bell,
                    contentDescription = "Notifications",
                    tint = palette.ink,
                    modifier = Modifier.size(22.dp),
                )
                if (unreadCount != null && unreadCount > 0) {
                    val label = if (unreadCount > UNREAD_BADGE_CAP) "9+" else unreadCount.toString()
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .clip(RoundedCornerShape(999.dp))
                            .background(BadgeRed)
                            .padding(horizontal = 5.dp, vertical = 2.dp),
                    ) {
                        Text(
                            label,
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}
