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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import id.starstask.mobile.ui.components.WebSectionTitle
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
fun AdminProfileView(
    profile: MyProfile,
    email: String?,
    joinedDate: String?,
    onOpenDashboard: () -> Unit,
    onOpenClasses: () -> Unit,
    onSignOut: () -> Unit,
    onSaved: (MyProfile) -> Unit,
    onOpenAdminConsole: () -> Unit = {},
    onOpenDeveloperConsole: () -> Unit = {},
) {
    val scheme = MaterialTheme.colorScheme
    val scope = rememberCoroutineScope()
    var bio by remember(profile.bio) { mutableStateOf(profile.bio.orEmpty()) }
    var bioSaving by remember { mutableStateOf(false) }
    var bioError by remember { mutableStateOf<String?>(null) }
    var bioSaved by remember { mutableStateOf(false) }
    Column(modifier = Modifier.padding(horizontal = Spacing.Block), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        Spacer(Modifier.height(4.dp))
        Text("ACCOUNT", color = scheme.primary, style = MaterialTheme.typography.labelLarge)
        Text(
            profile.fullName?.takeIf { it.isNotBlank() } ?: profile.nickname,
            color = scheme.onBackground,
            style = MaterialTheme.typography.headlineSmall,
        )
        Surface(color = scheme.primary.copy(alpha = 0.14f), shape = RoundedCornerShape(999.dp)) {
            Text(
                "Platform admin",
                color = scheme.primary,
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.padding(horizontal = Spacing.Lg, vertical = Spacing.Xs),
            )
        }
        Text("@${profile.nickname}", color = scheme.onSurfaceVariant)
        Text(
            "Your platform administrator identity and shortcuts. Administrator access is granted outside this page and cannot be changed here.",
            color = scheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
        MetaRow("Email", email ?: "Not available", muted = email == null)
        MetaRow("Member since", joinedDate ?: "Not available", muted = joinedDate == null)
        Text(
            "This is a platform administrator account. Student-only details such as NIM, university, and class representative verification do not apply here.",
            color = scheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
        Text("Admin tools", color = scheme.onBackground, style = MaterialTheme.typography.titleMedium)
        AdminToolRow("Overview", "Pending reviews and platform state at a glance.", onClick = onOpenDashboard, icon = Lucide.LayoutDashboard)
        AdminToolRow("Classes", "Inspect classes, course details, and class admins.", onClick = onOpenClasses, icon = Lucide.Users)
        AdminToolRow("Admin console", "Applications, verifications, users and classes review queues.", onClick = onOpenAdminConsole, icon = Lucide.List)
        AdminToolRow("Developer console", "Activity metrics, class metrics, users and incidents.", onClick = onOpenDeveloperConsole, icon = Lucide.LayoutDashboard)
        Text("Public bio", color = scheme.onBackground, style = MaterialTheme.typography.titleMedium)
        Text(
            "Optional. Visible to members of classes you belong to. Leave it empty to hide it.",
            color = scheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
        androidx.compose.material3.OutlinedTextField(
            value = bio,
            onValueChange = { bio = it; bioSaved = false },
            label = { Text("Bio") },
            supportingText = { Text("${bio.length}/280", fontSize = MaterialTheme.typography.bodySmall.fontSize) },
            isError = bioError != null,
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
        if (bioError != null) Text(bioError!!, color = scheme.error, style = MaterialTheme.typography.bodySmall)
        if (bioSaved) Text("Bio saved.", color = scheme.primary, style = MaterialTheme.typography.bodySmall)
        androidx.compose.material3.Button(
            enabled = !bioSaving && bio.trim() != (profile.bio.orEmpty()),
            onClick = {
                bioSaving = true
                bioError = null
                bioSaved = false
                scope.launch {
                    val updated = if (bio.trim().length > 280) null else saveBioOnly(bio)
                    bioSaving = false
                    if (updated != null) {
                        onSaved(updated)
                        bioSaved = true
                    } else {
                        bioError = if (bio.trim().length > 280) "Bio must be 280 characters or fewer" else "Could not save your bio. Try again."
                    }
                }
            },
        ) {
            if (bioSaving) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = scheme.onPrimary, strokeWidth = 2.dp)
            } else {
                Text("Save bio")
            }
        }
        Spacer(Modifier.height(4.dp))
        WebButton(label = "Sign out", onClick = onSignOut, variant = WebButtonVariant.SECONDARY)
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
fun AdminToolRow(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: (() -> Unit)?,
) {
    val scheme = MaterialTheme.colorScheme
    OutlinedButton(onClick = onClick ?: { }, enabled = onClick != null, modifier = Modifier.fillMaxWidth()) {
        Text(if (onClick != null) title else "$title · Web only", modifier = Modifier.weight(1f))
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
    }
    Text(description, color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun MetaRow(label: String, value: String, note: String? = null, muted: Boolean = false) {
    val scheme = MaterialTheme.colorScheme
    Column(modifier = Modifier.padding(vertical = Spacing.Lg)) {
        Text(label, color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(2.dp))
        Text(value, color = if (muted) scheme.onSurfaceVariant else scheme.onBackground)
        if (note != null) {
            Spacer(Modifier.height(1.dp))
            Text(note, color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(10.dp))
        HorizontalDivider(color = scheme.outline)
    }
}
