package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import id.starstask.mobile.data.MyProfile
import id.starstask.mobile.data.ProfileClass
import id.starstask.mobile.data.ProfileClasses
import id.starstask.mobile.data.checkPlatformAdmin
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.loadMyProfile
import id.starstask.mobile.data.loadProfileClasses
import id.starstask.mobile.data.saveBioOnly
import id.starstask.mobile.data.uploadProfileAvatar
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * Native profile screen. Layout follows the web profile (the functional
 * source of truth) with an original StarsTask presentation: X-inspired
 * cover + overlapping avatar, Instagram-inspired identity hierarchy.
 * Everything shown comes from `get_my_profile` and the class membership
 * queries in Profile.kt — nothing is hardcoded.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileHeader(
    profile: MyProfile,
    email: String?,
    activeCount: Int,
    joinedDate: String?,
    notice: String?,
    badgeText: String,
    onAvatarClick: () -> Unit,
    onEditClick: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val displayName = profile.fullName?.takeIf { it.isNotBlank() } ?: profile.nickname
    Box {
        // Cover: web has no cover storage, so this is a default StarsTask
        // visual only — there is intentionally no cover edit control.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
                .background(scheme.primary.copy(alpha = 0.08f)),
        ) {
            Box(
                modifier = Modifier
                    .size(220.dp)
                    .offset(x = (-60).dp, y = (-90).dp)
                    .clip(CircleShape)
                    .background(scheme.primary.copy(alpha = 0.14f)),
            )
            Box(
                modifier = Modifier
                    .size(150.dp)
                    .align(Alignment.BottomEnd)
                    .offset(x = 40.dp, y = 60.dp)
                    .clip(CircleShape)
                    .background(scheme.primary.copy(alpha = 0.2f)),
            )
        }
        Column(modifier = Modifier.padding(horizontal = Spacing.Block)) {
            AvatarWithBadge(
                avatarUrl = profile.avatarUrl,
                displayName = displayName,
                onClick = onAvatarClick,
                modifier = Modifier.offset(y = (-36).dp),
            )
            Column(modifier = Modifier.offset(y = (-24).dp)) {
                Text(
                    displayName,
                    style = MaterialTheme.typography.headlineSmall,
                    color = scheme.onBackground,
                )
                Text("@${profile.nickname}", color = scheme.onSurfaceVariant)
                if (email != null) Text(email, color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
                StarsTaskBadge(label = badgeText, variant = BadgeVariant.ACCENT)
                if (!profile.bio.isNullOrBlank()) {
                    Spacer(Modifier.height(10.dp))
                    Text(profile.bio, color = scheme.onBackground)
                }
                Spacer(Modifier.height(14.dp))
                WebButton(
                    label = "Edit profile",
                    onClick = onEditClick,
                    modifier = Modifier.fillMaxWidth(),
                    variant = WebButtonVariant.SECONDARY,
                    icon = Lucide.Pencil,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    buildString {
                        append(if (activeCount == 0) "No classes yet" else "$activeCount active ${if (activeCount == 1) "class" else "classes"}")
                        if (joinedDate != null) append(" · Joined $joinedDate")
                    },
                    color = scheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                if (notice != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(notice, color = scheme.primary, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
fun AvatarWithBadge(
    avatarUrl: String?,
    displayName: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scheme = MaterialTheme.colorScheme
    Box(modifier = modifier) {
        AsyncAvatar(avatarUrl = avatarUrl, displayName = displayName, size = 96.dp)
        Surface(
            color = id.starstask.mobile.ui.theme.Surface,
            shape = CircleShape,
            border = androidx.compose.foundation.BorderStroke(1.dp, scheme.outline),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 2.dp, y = 2.dp)
                .clickable(onClick = onClick),
        ) {
            Icon(
                Lucide.Camera,
                contentDescription = "Change profile photo",
                tint = scheme.onBackground,
                modifier = Modifier.padding(Spacing.Sm).size(16.dp),
            )
        }
    }
}

/** Loads a remote avatar without an extra image dependency. */
@Composable
internal fun AsyncAvatar(
    avatarUrl: String?,
    displayName: String,
    size: androidx.compose.ui.unit.Dp,
) {
    val scheme = MaterialTheme.colorScheme
    var bitmap by remember(avatarUrl) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(avatarUrl) {
        if (avatarUrl.isNullOrBlank()) return@LaunchedEffect
        bitmap = try {
            withContext(Dispatchers.IO) {
                val connection = URL(avatarUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 8000
                connection.inputStream.use { BitmapFactory.decodeStream(it) }
            }
        } catch (_: Exception) {
            null
        }
    }
    val initials = remember(displayName) {
        displayName.split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase().ifEmpty { "?" }
    }
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(scheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        val shown = bitmap
        if (shown != null) {
            Image(shown.asImageBitmap(), contentDescription = null, modifier = Modifier.size(size), contentScale = ContentScale.Crop)
        } else {
            Text(initials, color = scheme.onSurfaceVariant, style = MaterialTheme.typography.headlineMedium)
        }
    }
}

