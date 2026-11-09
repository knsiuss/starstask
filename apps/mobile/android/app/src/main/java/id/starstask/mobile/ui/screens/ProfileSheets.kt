package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.MyProfile
import id.starstask.mobile.data.ProfileClass
import id.starstask.mobile.data.saveProfileSettings
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import kotlinx.coroutines.launch

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
internal fun EditProfileSheet(
    profile: MyProfile,
    onDismiss: () -> Unit,
    onSaved: (MyProfile) -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val scope = rememberCoroutineScope()
    var fullName by remember { mutableStateOf(profile.fullName.orEmpty()) }
    var nickname by remember { mutableStateOf(profile.nickname) }
    var bio by remember { mutableStateOf(profile.bio.orEmpty()) }
    var fieldErrors by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var formError by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    val isDirty = fullName != profile.fullName.orEmpty() ||
        nickname != profile.nickname ||
        bio != profile.bio.orEmpty()
    var confirmDiscard by remember { mutableStateOf(false) }

    fun requestDismiss() {
        if (isDirty && !saving) {
            confirmDiscard = true
        } else {
            onDismiss()
        }
    }

    ModalBottomSheet(onDismissRequest = { requestDismiss() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        if (confirmDiscard) {
            androidx.compose.material3.AlertDialog(
                onDismissRequest = { confirmDiscard = false },
                title = { Text("Discard changes?") },
                text = { Text("Your edits have not been saved yet.") },
                confirmButton = {
                    WebButton(label = "Discard", onClick = { onDismiss() }, variant = WebButtonVariant.DANGER)
                },
                dismissButton = {
                    WebButton(label = "Keep editing", onClick = { confirmDiscard = false }, variant = WebButtonVariant.GHOST)
                },
            )
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(horizontal = Spacing.Block)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Edit profile", style = MaterialTheme.typography.titleLarge, color = scheme.onBackground, modifier = Modifier.weight(1f))
                IconButton(onClick = { requestDismiss() }, enabled = !saving) {
                    Icon(Lucide.X, contentDescription = "Close", tint = scheme.onBackground)
                }
            }
            if (formError != null) WebAlert(message = formError!!)

            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it; fieldErrors = fieldErrors - "fullName" },
                label = { Text("Full name") },
                supportingText = {
                    Text(fieldErrors["fullName"] ?: "Only you can see this.", fontSize = MaterialTheme.typography.bodySmall.fontSize)
                },
                isError = fieldErrors.containsKey("fullName"),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = nickname,
                onValueChange = { nickname = it; fieldErrors = fieldErrors - "nickname" },
                label = { Text("Nickname") },
                supportingText = {
                    Text(fieldErrors["nickname"] ?: "Shown to classmates.", fontSize = MaterialTheme.typography.bodySmall.fontSize)
                },
                isError = fieldErrors.containsKey("nickname"),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = bio,
                onValueChange = { bio = it; fieldErrors = fieldErrors - "bio" },
                label = { Text("Bio") },
                supportingText = {
                    Text(fieldErrors["bio"] ?: "${bio.length}/280 · Shown to members of classes you belong to.", fontSize = MaterialTheme.typography.bodySmall.fontSize)
                },
                isError = fieldErrors.containsKey("bio"),
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )

            Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                WebButton(label = "Cancel", onClick = { requestDismiss() }, variant = WebButtonVariant.GHOST, enabled = !saving)
                Spacer(Modifier.width(8.dp))
                Button(
                    enabled = !saving && isDirty,
                    onClick = {
                        saving = true
                        formError = null
                        fieldErrors = emptyMap()
                        scope.launch {
                            val outcome = saveProfileSettings(profile, fullName, nickname, bio)
                            saving = false
                            when {
                                outcome.fieldErrors.isNotEmpty() -> fieldErrors = outcome.fieldErrors
                                outcome.profile != null -> onSaved(outcome.profile)
                                else -> formError = outcome.message ?: "Could not save your profile."
                            }
                        }
                    },
                ) {
                    if (saving) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = scheme.onPrimary, strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                        Text("Saving...")
                    } else {
                        Text("Save changes")
                    }
                }
            }
        }
    }
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ProfileAvatarSheet(
    avatarUrl: String?,
    displayName: String,
    pickedUri: Uri?,
    uploading: Boolean,
    error: String?,
    onPick: () -> Unit,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    ModalBottomSheet(onDismissRequest = { if (!uploading) onDismiss() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.Block).padding(bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
        ) {
            Text("Profile photo", style = MaterialTheme.typography.titleLarge, color = scheme.onBackground)
            Text(
                "PNG or JPG, up to 2 MB. The new photo replaces your current one.",
                color = scheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
            if (pickedUri != null) {
                PickedAvatarPreview(pickedUri = pickedUri)
            } else {
                AsyncAvatar(avatarUrl = avatarUrl, displayName = displayName, size = 128.dp)
            }
            if (error != null) WebAlert(message = error)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                WebButton(
                    label = if (pickedUri != null) "Choose another" else "Choose image",
                    onClick = onPick,
                    variant = WebButtonVariant.SECONDARY,
                    enabled = !uploading,
                    icon = Lucide.ImagePlus,
                )
                Button(onClick = onSave, enabled = pickedUri != null && !uploading) {
                    if (uploading) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = scheme.onPrimary, strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                        Text("Saving...")
                    } else {
                        Text("Save photo")
                    }
                }
            }
        }
    }
}

