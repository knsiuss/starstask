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
import androidx.compose.material3.OutlinedButton
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
import kotlinx.coroutines.launch

@Composable
fun PickedAvatarPreview(pickedUri: Uri) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var bitmap by remember(pickedUri) { mutableStateOf<android.graphics.Bitmap?>(null) }
    androidx.compose.runtime.LaunchedEffect(pickedUri) {
        bitmap = try {
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                android.graphics.BitmapFactory.decodeStream(
                    context.contentResolver.openInputStream(pickedUri),
                )
            }
        } catch (_: Exception) {
            null
        }
    }
    val shown = bitmap
    if (shown != null) {
        androidx.compose.foundation.Image(
            shown.asImageBitmap(),
            contentDescription = null,
            modifier = Modifier.size(128.dp),
            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
        )
    } else {
        AsyncAvatar(avatarUrl = null, displayName = "?", size = 128.dp)
    }
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ClaimRepresentativeSheet(
    claimable: List<ProfileClass>,
    onDismiss: () -> Unit,
    onClaimed: (String) -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val scope = rememberCoroutineScope()
    var selectedId by remember { mutableStateOf<String?>(null) }
    var expanded by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    val selected = claimable.firstOrNull { it.id == selectedId }

    ModalBottomSheet(onDismissRequest = { if (!busy) onDismiss() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.Block).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Lucide.ShieldCheck, contentDescription = null, tint = scheme.primary, modifier = Modifier.size(28.dp))
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Become a class representative", style = MaterialTheme.typography.titleMedium, color = scheme.onBackground)
                    Text(
                        "Access is granted immediately. Up to 5 representatives per class.",
                        color = scheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            if (error != null) Text(error!!, color = scheme.error, style = MaterialTheme.typography.bodySmall)
            if (message != null) Text(message!!, color = scheme.primary, style = MaterialTheme.typography.bodySmall)

            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { if (!busy) expanded = !expanded }) {
                androidx.compose.material3.OutlinedTextField(
                    value = selected?.let { "${it.name} · ${it.semester} ${it.academicYear}" } ?: "Choose a class",
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    claimable.forEach { clazz ->
                        DropdownMenuItem(
                            text = { Text("${clazz.name} · ${clazz.semester} ${clazz.academicYear}") },
                            onClick = { selectedId = clazz.id; expanded = false; error = null },
                        )
                    }
                }
            }

            Button(
                enabled = selectedId != null && !busy,
                onClick = {
                    val target = selected ?: return@Button
                    busy = true
                    error = null
                    message = null
                    scope.launch {
                        val outcome = id.starstask.mobile.data.claimClassRepresentative(target.id)
                        busy = false
                        if (outcome.succeeded) {
                            onClaimed(outcome.message)
                        } else {
                            error = outcome.message
                        }
                    }
                },
            ) {
                if (busy) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = scheme.onPrimary, strokeWidth = 2.dp)
                    Spacer(Modifier.width(6.dp))
                    Text("Saving...")
                } else {
                    Text("Become representative")
                }
            }
            Text("You must already be a member of the class.", color = scheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
    }
}
