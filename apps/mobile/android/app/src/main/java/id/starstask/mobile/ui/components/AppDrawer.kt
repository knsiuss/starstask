package id.starstask.mobile.ui.components

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.starstask.mobile.R
import id.starstask.mobile.ui.navigation.DrawerDestination
import id.starstask.mobile.ui.navigation.accountDestinations
import id.starstask.mobile.ui.navigation.studyDestinations
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.StarsTaskTheme

/**
 * Drawer surface mirroring the web workspace sidebar
 * (`apps/web/src/components/layout/workspace-nav.tsx`): same groups, same
 * order, same active-item treatment (accent-soft fill, accent text).
 * The web label "Absence Requests" (route `/leave-requests`) is shown as
 * "Leave Requests" on Android per product naming; the route and backend
 * identifiers are unchanged.
 */
@Composable
fun StarsTaskDrawerContent(
    currentRoute: String?,
    isClassAdmin: Boolean,
    onDestinationClick: (DrawerDestination) -> Unit,
    onClose: () -> Unit,
    userId: String? = null,
    userEmail: String? = null,
    modifier: Modifier = Modifier,
) {
    var displayName by remember(userId) { mutableStateOf<String?>(null) }
    var avatarUrl by remember(userId) { mutableStateOf<String?>(null) }
    LaunchedEffect(userId) {
        if (userId != null) {
            runCatching { id.starstask.mobile.data.loadMyProfile() }.onSuccess { loaded ->
                displayName = loaded?.fullName?.takeIf { it.isNotBlank() } ?: loaded?.nickname
                avatarUrl = loaded?.avatarUrl
            }
        }
    }
    Surface(
        color = MaterialTheme.colorScheme.surface,
        modifier = modifier
            .fillMaxSize()
            .clickable { /* keep drawer body non-collapsing on stray taps */ },
    ) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.Xl, vertical = Spacing.Md),
    ) {
        DrawerHeader(onClose = onClose)
        DrawerSection(label = "Study") {
            studyDestinations.forEach { dest ->
                DrawerDestinationItem(
                    destination = dest,
                    selected = currentRoute == dest.route,
                    onClick = { onDestinationClick(dest) },
                )
            }
        }
        // Campus (University Info) removed.
        HorizontalDivider(
            modifier = Modifier.padding(vertical = Spacing.Md),
            color = androidx.compose.ui.graphics.Color.Transparent,
        )
        DrawerSection(label = "Account") {
            accountDestinations.forEach { dest ->
                DrawerDestinationItem(
                    destination = dest,
                    selected = currentRoute == dest.route,
                    onClick = { onDestinationClick(dest) },
                )
            }
        }
        DrawerAccountFooter(
            displayName = displayName ?: userEmail?.substringBefore("@") ?: "StarsTask member",
            email = userEmail,
            avatarUrl = avatarUrl,
            onClick = { onDestinationClick(DrawerDestination.PROFILE) },
        )
    }
    }
}

@Composable
private fun DrawerAccountFooter(
    displayName: String,
    email: String?,
    avatarUrl: String?,
    onClick: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    Spacer(Modifier.height(12.dp))
    HorizontalDivider(color = scheme.outline)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = Spacing.Xl),
    ) {
        id.starstask.mobile.ui.screens.AsyncAvatar(
            avatarUrl = avatarUrl,
            displayName = displayName,
            size = 36.dp,
        )
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                displayName,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = scheme.onSurface,
                maxLines = 1,
            )
            if (email != null) {
                Text(
                    email,
                    style = MaterialTheme.typography.bodySmall,
                    color = scheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
        }
        Icon(
            imageVector = Lucide.ArrowRight,
            contentDescription = null,
            tint = scheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun DrawerHeader(onClose: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 4.dp, top = 8.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(id = R.drawable.logo_mark),
            contentDescription = null,
            modifier = Modifier.size(32.dp),
        )
        Column(modifier = Modifier.padding(start = 10.dp)) {
            Text(
                "StarsTask",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = Foreground,
            )
            Text(
                "Academic workspace",
                style = MaterialTheme.typography.bodySmall,
                color = MutedForeground,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        IconButton(onClick = onClose) {
            Icon(
                imageVector = Lucide.X,
                contentDescription = "Close menu",
                tint = MutedForeground,
            )
        }
    }
}

@Composable
private fun DrawerSection(label: String, content: @Composable () -> Unit) {
    Text(
        label.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Medium,
        color = MutedForeground,
        modifier = Modifier.padding(start = 12.dp, top = 20.dp, bottom = 4.dp),
    )
    content()
}

@Composable
private fun DrawerDestinationItem(
    destination: DrawerDestination,
    selected: Boolean,
    onClick: () -> Unit,
) {
    NavigationDrawerItem(
        selected = selected,
        onClick = onClick,
        label = { Text(destination.label) },
        icon = {
            Icon(
                imageVector = destination.drawerIcon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
        },
        shape = RoundedCornerShape(8.dp),
        colors = NavigationDrawerItemDefaults.colors(
            selectedContainerColor = AccentSoft,
            selectedTextColor = Accent,
            selectedIconColor = Accent,
            unselectedTextColor = MutedForeground,
            unselectedIconColor = MutedForeground,
        ),
        modifier = Modifier.defaultMinSize(minHeight = 40.dp).padding(vertical = 1.dp),
    )
}

/** Maps each destination to its outline icon (web uses Lucide outline equivalents). */
val DrawerDestination.drawerIcon: ImageVector
    get() = icon

@Preview(showBackground = true)
@Composable
private fun DrawerPreview() {
    StarsTaskTheme {
        StarsTaskDrawerContent(
            currentRoute = DrawerDestination.LEAVE.route,
            isClassAdmin = true,
            onDestinationClick = {},
            onClose = {},
        )
    }
}
