package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.icons.Lucide

import id.starstask.mobile.ui.theme.Spacing

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
fun PersonalInfo(profile: MyProfile, email: String?) {
    Column(modifier = Modifier.padding(horizontal = Spacing.Block)) {
        MetaRow("Full name", profile.fullName?.takeIf { it.isNotBlank() } ?: "Not set", note = "Only you can see this.", muted = profile.fullName.isNullOrBlank())
        MetaRow("Nickname", "@${profile.nickname}")
        MetaRow("Bio", if (profile.bio.isNullOrBlank()) "No bio yet" else profile.bio, note = "Shown to members of classes you belong to.", muted = profile.bio.isNullOrBlank())
        MetaRow("Email", email ?: "Not available", note = "From your sign-in provider.", muted = email == null)
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun AcademicInfo(profile: MyProfile, classesData: ProfileClasses?, onOpenClasses: () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    val classes = classesData?.classes.orEmpty()
    val active = classes.count { it.status == "active" }
    val membership = when {
        classes.isEmpty() -> "No classes yet"
        else -> "$active active · ${classes.size} joined"
    }
    Column(modifier = Modifier.padding(horizontal = Spacing.Block)) {
        MetaRow("Student ID", profile.nim ?: "Not set", muted = profile.nim == null)
        MetaRow("University", profile.university ?: "Not set", muted = profile.university == null)
        MetaRow("Declared class", profile.declaredClassName ?: "Not set", muted = profile.declaredClassName == null)
        MetaRow("Membership", membership, muted = classes.isEmpty())
        if (classes.isNotEmpty()) {
            Text("Joined classes", color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(6.dp))
            androidx.compose.foundation.layout.FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                verticalArrangement = Arrangement.spacedBy(Spacing.Md),
            ) {
                classes.forEach { clazz ->
                    Surface(
                        color = scheme.surfaceVariant,
                        shape = RoundedCornerShape(999.dp),
                        modifier = Modifier.clickable(onClick = onOpenClasses),
                    ) {
                        Text(
                            clazz.name + if (clazz.status != "active") " · ${clazz.status}" else "",
                            color = MaterialTheme.colorScheme.onBackground,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = Spacing.Lg, vertical = 5.dp),
                        )
                    }
                }
            }
        } else {
            MetaRow("Joined classes", "None yet", muted = true)
        }
    }
}

@Composable
fun ClassAdminSection(
    classesData: ProfileClasses?,
    onClaimClick: () -> Unit,
    onOpenClasses: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val administered = classesData?.administered.orEmpty()
    val claimable = classesData?.claimable.orEmpty()
    Column(modifier = Modifier.padding(horizontal = Spacing.Block)) {
        Text(
            "Any member of an active class can claim admin access right away — up to 5 per class. No evidence or approval needed; the class decides who steps up.",
            color = scheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
        Spacer(Modifier.height(12.dp))
        Text("Class admin access", color = scheme.onBackground, style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.height(6.dp))
        if (administered.isEmpty()) {
            Text("You do not administer any class yet.", color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        } else {
            administered.forEach { clazz ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable(onClick = onOpenClasses),
                ) {
                    androidx.compose.material3.AssistChip(
                        onClick = onOpenClasses,
                        label = { Text(clazz.name) },
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("${clazz.semester} · ${clazz.academicYear}", color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(4.dp))
            }
        }
        Spacer(Modifier.height(12.dp))
        if (claimable.isEmpty()) {
            Text("Join an active class to claim representative access.", color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        } else {
            WebButton(label = "Apply for Class Admin access", onClick = onClaimClick, variant = WebButtonVariant.SECONDARY)
        }
    }
}

@Composable
fun MetaRow(label: String, value: String, note: String? = null, muted: Boolean = false) {
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
