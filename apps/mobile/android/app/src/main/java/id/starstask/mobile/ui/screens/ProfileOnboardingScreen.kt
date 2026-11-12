package id.starstask.mobile.ui.screens

// Profile recovery for accounts that never finished onboarding (e.g. created
// before the gate existed, or onboarding interrupted). Mirrors web
// /onboarding (ProfileOnboardingForm): same fields, same RPCs, so a profile
// completed here is identical to one completed on the web.

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import id.starstask.mobile.ui.components.StaggerDots
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.saveOnboardingProfile
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebAlertVariant
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.components.WebScreen
import id.starstask.mobile.ui.components.WebScreenHeader
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

@Composable
fun ProfileOnboardingScreen(
    userId: String,
    email: String?,
    onDone: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var fullName by remember { mutableStateOf("") }
    var nickname by remember { mutableStateOf("") }
    var nim by remember { mutableStateOf("") }
    var university by remember { mutableStateOf("") }
    var className by remember { mutableStateOf("") }
    var fieldErrors by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var message by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    WebScreen(modifier = Modifier.verticalScroll(rememberScrollState())) {
        WebScreenHeader(
            title = "Finish setting up your profile",
            subtitle = "Your account is missing the details classes need. Complete them once — the same fields as on the web.",
        )
        if (email != null) {
            Text(email, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        }

        WebInput(
            value = fullName,
            onValueChange = { fullName = it; fieldErrors = fieldErrors - "fullName" },
            label = "Full name",
            isError = fieldErrors.containsKey("fullName"),
            supportingText = fieldErrors["fullName"],
        )
        WebInput(
            value = nickname,
            onValueChange = { nickname = it; fieldErrors = fieldErrors - "nickname" },
            label = "Nickname",
            isError = fieldErrors.containsKey("nickname"),
            supportingText = fieldErrors["nickname"],
        )
        WebInput(
            value = nim,
            onValueChange = { nim = it; fieldErrors = fieldErrors - "nim" },
            label = "Student ID (NIM)",
            isError = fieldErrors.containsKey("nim"),
            supportingText = fieldErrors["nim"],
        )
        WebInput(
            value = university,
            onValueChange = { university = it; fieldErrors = fieldErrors - "university" },
            label = "University",
            isError = fieldErrors.containsKey("university"),
            supportingText = fieldErrors["university"],
        )
        WebInput(
            value = className,
            onValueChange = { className = it; fieldErrors = fieldErrors - "className" },
            label = "Class (optional)",
            placeholder = "e.g. TPLM002 or 05TPLM002",
            isError = fieldErrors.containsKey("className"),
            supportingText = fieldErrors["className"],
        )

        if (message != null) WebAlert(message = message!!)
        if (notice != null) WebAlert(message = notice!!, variant = WebAlertVariant.SUCCESS)

        WebButton(
            label = if (saving) "Saving…" else "Save and continue",
            onClick = {
                if (saving) return@WebButton
                saving = true
                message = null
                notice = null
                scope.launch {
                    val outcome = saveOnboardingProfile(fullName, nickname, nim, university, className)
                    when {
                        outcome.fieldErrors.isNotEmpty() -> {
                            fieldErrors = outcome.fieldErrors
                            message = null
                        }
                        outcome.message != null -> {
                            message = outcome.message
                        }
                        outcome.succeeded -> {
                            notice = outcome.classJoin?.let { join ->
                                when (join.status) {
                                    "joined" -> "Profile saved. Joined ${join.className ?: "the class"}."
                                    "already_member" -> "Profile saved. You are already a member of ${join.className ?: "that class"}."
                                    "blocked_by_policy" -> "Profile saved. That class requires an invitation, so you were not added."
                                    "ambiguous" -> "Profile saved. Multiple classes match that name — ask your class admin for an invite."
                                    "no_match" -> "Profile saved. No active class matches that name."
                                    else -> "Profile saved."
                                }
                            } ?: "Profile saved."
                        }
                        else -> message = "Could not save your profile. Try again."
                    }
                    saving = false
                    if (outcome.succeeded) onDone()
                }
            },
            enabled = !saving,
        )
    }
}
