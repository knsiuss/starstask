package id.starstask.mobile.ui.screens

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.MyProfile
import id.starstask.mobile.data.ProfileClasses
import id.starstask.mobile.data.checkPlatformAdmin
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.loadMyProfile
import id.starstask.mobile.data.loadProfileClasses
import id.starstask.mobile.data.uploadProfileAvatar
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.AssignmentAccent
import id.starstask.mobile.ui.theme.AssignmentBackground
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.AssignmentSecondary
import kotlinx.coroutines.launch

/**
 * Profile — Apple Settings grouped lists, ultra-clean.
 *
 * Identity header: cover, 72dp avatar, name, @handle, Edit pill.
 * Sections are white grouped surfaces (Apple Settings style): ListItem rows
 * with label/value/chevron. No WebButton cards, no stat pills overload.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    userId: String,
    email: String?,
    memberSince: String?,
    onBack: () -> Unit,
    onOpenClasses: () -> Unit,
    onSignOut: () -> Unit,
    onOpenDashboard: () -> Unit = { },
    onOpenAdminConsole: () -> Unit = {},
    onOpenDeveloperConsole: () -> Unit = {},
) {
    BackHandler(onBack = onBack)
    val scope = rememberCoroutineScope()
    var profile by remember { mutableStateOf<MyProfile?>(null) }
    var classesData by remember { mutableStateOf<ProfileClasses?>(null) }
    var platformAdmin by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var retryTick by remember { mutableStateOf(0) }
    var editOpen by remember { mutableStateOf(false) }
    var avatarOpen by remember { mutableStateOf(false) }
    var claimOpen by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }

    suspend fun reload() {
        loading = true
        error = null
        try {
            profile = loadMyProfile()
            classesData = try { loadProfileClasses(userId) } catch (_: Exception) { null }
            platformAdmin = try { checkPlatformAdmin() } catch (_: Exception) { false }
        } catch (_: Exception) {
            error = "Could not load your profile."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId, retryTick) { reload() }

    val current = profile
    val activeCount = classesData?.classes?.count { it.status == "active" } ?: 0
    val joinedDate = memberSince?.let { formatDateShort(it) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AssignmentBackground),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                IconButton(onClick = onBack) {
                    Icon(Lucide.ArrowLeft, contentDescription = "Back", tint = AssignmentForeground)
                }
                Text("Profile", style = MaterialTheme.typography.titleLarge, color = AssignmentForeground)
            }

            when {
                loading -> Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = AssignmentAccent)
                }
                error != null -> Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(error!!, color = AssignmentSecondary)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "Retry",
                            color = AssignmentAccent,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(Color(0xFFEEF1F7))
                                .clickable { retryTick++ }
                                .padding(horizontal = 20.dp, vertical = 12.dp),
                        )
                    }
                }
                current == null -> Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Profile not found.", color = AssignmentSecondary)
                }
                else -> if (platformAdmin) {
                    AdminProfileView(
                        profile = current,
                        email = email,
                        joinedDate = joinedDate,
                        onOpenDashboard = onOpenDashboard,
                        onOpenClasses = onOpenClasses,
                        onSignOut = onSignOut,
                        onSaved = { profile = it; notice = "Profile updated." },
                        onOpenAdminConsole = onOpenAdminConsole,
                        onOpenDeveloperConsole = onOpenDeveloperConsole,
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                    ) {
                        item(key = "identity") {
                            ProfileIdentityHeaderClean(
                                profile = current,
                                email = email,
                                activeCount = activeCount,
                                joinedDate = joinedDate,
                                notice = notice,
                                onAvatarClick = { avatarOpen = true },
                                onEditClick = { notice = null; editOpen = true },
                            )
                        }
                        item(key = "meta") {
                            ProfileMetaSectionClean(
                                profile = current,
                                email = email,
                                joinedDate = joinedDate,
                            )
                        }
                        item(key = "classes") {
                            ProfileClassesSectionClean(
                                profile = current,
                                classesData = classesData,
                                onOpenClasses = onOpenClasses,
                                onClaimClick = { claimOpen = true },
                            )
                        }
                        item(key = "quick") {
                            ProfileQuickActionsClean(
                                onOpenClasses = onOpenClasses,
                                onOpenAdminConsole = onOpenAdminConsole,
                                onOpenDeveloperConsole = onOpenDeveloperConsole,
                                onSignOut = onSignOut,
                            )
                        }
                        item(key = "footer") {
                            Text(
                                "Joined $joinedDate · Asia/Jakarta (WIB)",
                                color = AssignmentSecondary,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp),
                            )
                        }
                        item(key = "bottom-spacer") {
                            Box(modifier = Modifier.size(height = 80.dp, width = 0.dp))
                        }
                    }
                }
            }
        }
    }

    if (current != null && editOpen) {
        EditProfileSheet(
            profile = current,
            onDismiss = { editOpen = false },
            onSaved = { saved ->
                profile = saved
                editOpen = false
                notice = "Profile updated."
            },
        )
    }

    if (current != null && avatarOpen) {
        val context = androidx.compose.ui.platform.LocalContext.current
        var pickedUri by remember { mutableStateOf<android.net.Uri?>(null) }
        var uploading by remember { mutableStateOf(false) }
        var avatarError by remember { mutableStateOf<String?>(null) }
        val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            pickedUri = uri
            avatarError = null
        }
        ProfileAvatarSheet(
            avatarUrl = current.avatarUrl,
            displayName = current.fullName ?: current.nickname,
            pickedUri = pickedUri,
            uploading = uploading,
            error = avatarError,
            onPick = { picker.launch("image/*") },
            onDismiss = { if (!uploading) avatarOpen = false },
            onSave = {
                val uri = pickedUri ?: return@ProfileAvatarSheet
                uploading = true
                avatarError = null
                scope.launch {
                    val outcome = uploadProfileAvatar(context, userId, uri)
                    uploading = false
                    if (outcome.avatarUrl != null) {
                        profile = current.copy(avatarUrl = outcome.avatarUrl)
                        avatarOpen = false
                        notice = "Profile photo updated."
                    } else {
                        avatarError = outcome.message ?: "Could not save the photo."
                    }
                }
            },
        )
    }

    if (current != null && claimOpen) {
        val claimable = classesData?.claimable.orEmpty()
        ClaimRepresentativeSheet(
            claimable = claimable,
            onDismiss = { claimOpen = false },
            onClaimed = {
                claimOpen = false
                notice = it
                scope.launch { classesData = try { loadProfileClasses(userId) } catch (_: Exception) { null } }
            },
        )
    }
}

@Composable
fun ProfileIdentityHeaderClean(
    profile: MyProfile,
    email: String?,
    activeCount: Int,
    joinedDate: String?,
    notice: String?,
    onAvatarClick: () -> Unit,
    onEditClick: () -> Unit,
) {
    val displayName = profile.fullName?.takeIf { it.isNotBlank() } ?: profile.nickname
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp)),
    ) {
        // Cover band
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp)
                .background(Color(0xFFD9E3F7)),
        ) {
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .offset(x = (-40).dp, y = (-60).dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.25f)),
            )
        }
        Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box {
                    AsyncAvatar(avatarUrl = profile.avatarUrl, displayName = displayName, size = 72.dp)
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .offset(x = 2.dp, y = 2.dp)
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .border(0.5.dp, Color(0xFFE9EBF0), CircleShape)
                            .clickable(onClick = onAvatarClick),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Lucide.Camera,
                            contentDescription = "Change profile photo",
                            tint = AssignmentForeground,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
                Box(Modifier.weight(1f))
                Text(
                    "Edit",
                    color = AssignmentForeground,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0xFFEEF1F7))
                        .clickable(onClick = onEditClick)
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                )
            }
            Spacer(Modifier.height(16.dp))
            Text(
                displayName,
                color = AssignmentForeground,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "@${profile.nickname}",
                color = AssignmentSecondary,
                fontSize = 14.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
            if (!profile.bio.isNullOrBlank()) {
                Text(profile.bio, color = AssignmentForeground, fontSize = 14.sp, modifier = Modifier.padding(top = 10.dp))
            }
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                Column {
                    Text(activeCount.toString(), color = AssignmentForeground, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                    Text("Active classes", color = AssignmentSecondary, fontSize = 12.sp)
                }
                Column {
                    Text(email?.take(2)?.uppercase() ?: "•", color = AssignmentForeground, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                    Text("Email", color = AssignmentSecondary, fontSize = 12.sp)
                }
                if (joinedDate != null) {
                    Column {
                        Text(joinedDate, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        Text("Joined", color = AssignmentSecondary, fontSize = 12.sp)
                    }
                }
            }
            if (notice != null) {
                Text(notice, color = AssignmentAccent, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 12.dp))
            }
        }
    }
}

@Composable
fun ProfileMetaSectionClean(
    profile: MyProfile,
    email: String?,
    joinedDate: String?,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        GroupLabel("Personal")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp)),
        ) {
            ProfileRowClean("Full name", profile.fullName?.takeIf { it.isNotBlank() } ?: "Not set")
            HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
            ProfileRowClean("Nickname", "@${profile.nickname}")
            HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
            ProfileRowClean("Email", email ?: "Not available")
            HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
            ProfileRowClean("Joined", joinedDate ?: "—")
        }
        GroupLabel("Academic")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp)),
        ) {
            ProfileRowClean("Student ID", profile.nim ?: "Not set")
            HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
            ProfileRowClean("University", profile.university ?: "Not set")
            HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
            ProfileRowClean("Declared class", profile.declaredClassName ?: "Not set")
        }
    }
}

@Composable
private fun GroupLabel(text: String) {
    Text(
        text,
        color = AssignmentForeground,
        fontSize = 20.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(bottom = 12.dp),
    )
}

@Composable
private fun ProfileRowClean(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            color = AssignmentForeground,
            fontSize = 15.sp,
            modifier = Modifier.weight(1f),
        )
        Text(
            value,
            color = AssignmentSecondary,
            fontSize = 15.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Icon(
            Lucide.ChevronRight,
            contentDescription = null,
            tint = AssignmentSecondary,
            modifier = Modifier.padding(start = 8.dp).size(18.dp),
        )
    }
}

@Composable
fun ProfileClassesSectionClean(
    profile: MyProfile,
    classesData: ProfileClasses?,
    onOpenClasses: () -> Unit,
    onClaimClick: () -> Unit,
) {
    val classes = classesData?.classes.orEmpty()
    val administered = classesData?.administered.orEmpty()
    val claimable = classesData?.claimable.orEmpty()
    Column(modifier = Modifier.fillMaxWidth()) {
        GroupLabel("Classes")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp)),
        ) {
            if (classes.isEmpty()) {
                Text(
                    "No classes yet. Join a class to see your schedule here.",
                    color = AssignmentSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                )
            } else {
                classes.forEachIndexed { index, clazz ->
                    if (index > 0) HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(onClick = onOpenClasses)
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(clazz.name, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(
                                "${clazz.semester} · ${clazz.academicYear}${if (clazz.status != "active") " · ${clazz.status}" else ""}",
                                color = AssignmentSecondary,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Icon(Lucide.ChevronRight, contentDescription = "Open classes", tint = AssignmentSecondary, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
        if (administered.isNotEmpty()) {
            Spacer(Modifier.height(24.dp))
            GroupLabel("Admin")
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White)
                    .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp)),
            ) {
                administered.forEachIndexed { index, clazz ->
                    if (index > 0) HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(onClick = onOpenClasses)
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(clazz.name, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Text(
                            "Admin",
                            color = AssignmentAccent,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
        if (claimable.isNotEmpty()) {
            Text(
                "Apply for Class Admin access",
                color = AssignmentAccent,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color(0xFFEEF1F7))
                    .clickable(onClick = onClaimClick)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }
    }
}

@Composable
fun ProfileQuickActionsClean(
    onOpenClasses: () -> Unit,
    onOpenAdminConsole: () -> Unit,
    onOpenDeveloperConsole: () -> Unit,
    onSignOut: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        GroupLabel("Quick actions")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp)),
        ) {
            QuickRowClean(icon = Lucide.GraduationCap, label = "My classes", onClick = onOpenClasses)
            HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
            QuickRowClean(icon = Lucide.Settings, label = "Console", onClick = onOpenAdminConsole)
            HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
            QuickRowClean(icon = Lucide.Terminal, label = "Developer", onClick = onOpenDeveloperConsole)
            HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
            QuickRowClean(icon = Lucide.LogOut, label = "Sign out", destructive = true, onClick = onSignOut)
        }
    }
}

@Composable
private fun QuickRowClean(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, destructive: Boolean = false, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            contentDescription = label,
            tint = if (destructive) Color(0xFFB85454) else AssignmentAccent,
            modifier = Modifier.size(20.dp),
        )
        Text(
            label,
            color = if (destructive) Color(0xFFB85454) else AssignmentForeground,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(start = 12.dp).weight(1f),
        )
        Icon(Lucide.ChevronRight, contentDescription = null, tint = AssignmentSecondary, modifier = Modifier.size(18.dp))
    }
}
