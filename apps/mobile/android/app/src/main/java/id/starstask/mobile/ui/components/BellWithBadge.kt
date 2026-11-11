package id.starstask.mobile.ui.components

// Shared notification bell with unread badge. The badge anchors to the top-end
// of the 22dp icon box and offsets outside it so the bell shape stays visible;
// a thin ring in the bar's surface color separates the two without a hard edge.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import id.starstask.mobile.ui.icons.Lucide

const val UNREAD_BADGE_CAP = 9

@Composable
fun BellWithBadge(
    unreadCount: Int?,
    tint: Color,
    badgeColor: Color,
    badgeBorderColor: Color,
    modifier: Modifier = Modifier,
) {
    val label = when {
        unreadCount == null || unreadCount <= 0 -> null
        unreadCount > UNREAD_BADGE_CAP -> "9+"
        else -> unreadCount.toString()
    }
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Lucide.Bell,
            contentDescription = "Notifications",
            tint = tint,
            modifier = Modifier.padding(0.dp),
        )
        if (label != null) {
            Row(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 8.dp, y = (-8).dp)
                    .height(18.dp)
                    .widthIn(min = 18.dp)
                    .clip(CircleShape)
                    .background(badgeColor)
                    .border(1.5.dp, badgeBorderColor, CircleShape)
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    label,
                    color = Color.White,
                    fontSize = 10.sp,
                    lineHeight = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
            }
        }
    }
}
