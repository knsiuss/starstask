package id.starstask.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.OnboardingProfile
import id.starstask.mobile.data.SessionRow
import id.starstask.mobile.data.loadOnboardingProfile
import id.starstask.mobile.data.submitLeaveRequest
import io.github.jan.supabase.postgrest.postgrest
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch

/** Class detail mirroring the web class workspace header. */
@Composable
fun ClassDetailScreen(clazz: ClassDetail, members: List<String>, onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onBack) { Text("← Back") }
        Text(clazz.name, style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text("${clazz.semester} · ${clazz.academicYear}", color = MutedForeground)
        Text("Members", style = MaterialTheme.typography.titleMedium, color = Foreground)
        members.forEach { member ->
            Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                Text(member, modifier = Modifier.padding(16.dp), color = Foreground)
            }
        }
    }
}

/** Session detail with GPS check-in (permission + capture + RPC). */
@Composable
fun SessionDetailScreen(
    session: SessionRow,
    onBack: () -> Unit,
    onCheckIn: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onBack) { Text("← Back") }
        Text(session.title, style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(session.className ?: "", color = MutedForeground)
        Text(
            "${id.starstask.mobile.data.formatTime(session.startsAt)}-${id.starstask.mobile.data.formatTime(session.endsAt)}",
            color = MutedForeground,
        )
        Text("Status: ${session.status}", color = MutedForeground)
        Button(
            onClick = { onCheckIn(session.id) },
            colors = ButtonDefaults.buttonColors(containerColor = Accent),
        ) { Text("Check in (GPS)") }
    }
}

/** Leave request form mirroring the web absence flow. */
@Composable
fun LeaveRequestFormScreen(
    classes: List<ClassDetail>,
    onSubmitted: () -> Unit,
    onBack: () -> Unit,
) {
    var classId by remember { mutableStateOf(classes.firstOrNull()?.id ?: "") }
    var leaveStart by remember { mutableStateOf("") }
    var leaveEnd by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("sick") }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onBack) { Text("← Back") }
        Text("New absence request", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text("Class", color = MutedForeground)
        classes.forEach { clazz ->
            OutlinedButton(
                onClick = { classId = clazz.id },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(clazz.name) }
        }
        OutlinedTextField(
            value = leaveStart,
            onValueChange = { leaveStart = it },
            label = { Text("Start date (YYYY-MM-DD)") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = leaveEnd,
            onValueChange = { leaveEnd = it },
            label = { Text("End date (YYYY-MM-DD)") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = reason,
            onValueChange = { reason = it },
            label = { Text("Reason category") },
            modifier = Modifier.fillMaxWidth(),
        )
        if (message != null) Text(message!!, color = Accent)
        Button(
            onClick = {
                scope.launch {
                    runCatching {
                        submitLeaveRequest(classId, leaveStart, leaveEnd, reason)
                    }.onSuccess {
                        message = "Submitted."
                        onSubmitted()
                    }.onFailure {
                        message = "Could not submit. Check the dates and class."
                    }
                }
            },
            colors = ButtonDefaults.buttonColors(containerColor = Accent),
        ) { Text("Submit request") }
    }
}

/** Onboarding: full name + NIM gate before workspace access. */
@Composable
fun OnboardingScreen(userId: String, onDone: () -> Unit) {
    var fullName by remember { mutableStateOf("") }
    var nim by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(userId) {
        val profile = runCatching { loadOnboardingProfile(userId) }.getOrNull()
        fullName = profile?.fullName ?: ""
        nim = profile?.nim ?: ""
    }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Welcome to StarsTask", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text("Complete your profile to continue.", color = MutedForeground)
        OutlinedTextField(
            value = fullName,
            onValueChange = { fullName = it },
            label = { Text("Full name") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = nim,
            onValueChange = { nim = it },
            label = { Text("NIM / student ID") },
            modifier = Modifier.fillMaxWidth(),
        )
        if (message != null) Text(message!!, color = Accent)
        Button(
            onClick = {
                scope.launch {
                    // Persisted via the web profile API contract; mobile
                    // writes profiles directly under RLS (own row only).
                    runCatching {
                        id.starstask.mobile.data.SupabaseProvider.client.postgrest
                            .from("profiles")
                            .upsert(
                                kotlinx.serialization.json.buildJsonObject {
                                    put("id", kotlinx.serialization.json.JsonPrimitive(userId))
                                    put("full_name", kotlinx.serialization.json.JsonPrimitive(fullName))
                                    put("nim", kotlinx.serialization.json.JsonPrimitive(nim))
                                    put("onboarded_at", kotlinx.serialization.json.JsonPrimitive(java.time.Instant.now().toString()))
                                },
                            )
                    }.onSuccess { onDone() }
                        .onFailure { message = "Could not save. Try again." }
                }
            },
            colors = ButtonDefaults.buttonColors(containerColor = Accent),
        ) { Text("Continue") }
    }
}
