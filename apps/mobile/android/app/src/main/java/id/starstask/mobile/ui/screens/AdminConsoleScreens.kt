package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
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
import id.starstask.mobile.data.ClassApplicationRow
import id.starstask.mobile.data.PlatformClass
import id.starstask.mobile.data.PlatformOverview
import id.starstask.mobile.data.PlatformUser
import id.starstask.mobile.data.checkPlatformAdmin
import id.starstask.mobile.data.decideClassApplication
import id.starstask.mobile.data.decideVerification
import id.starstask.mobile.data.listClassApplications
import id.starstask.mobile.data.listPlatformClasses
import id.starstask.mobile.data.listPlatformUsers
import id.starstask.mobile.data.listVerificationRequests
import id.starstask.mobile.data.loadPlatformOverview
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebAlertVariant
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebScreen
import id.starstask.mobile.ui.components.WebScreenHeader
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

// Platform admin console (web admin routes). Gated by checkPlatformAdmin().
@Composable
fun AdminConsoleScreen(onBack: () -> Unit) {
    var isAdmin by remember { mutableStateOf<Boolean?>(null) }
    var overview by remember { mutableStateOf<PlatformOverview?>(null) }
    var applications by remember { mutableStateOf<List<ClassApplicationRow>>(emptyList()) }
    var verifications by remember { mutableStateOf<List<id.starstask.mobile.data.VerificationRow>>(emptyList()) }
    var users by remember { mutableStateOf<List<PlatformUser>>(emptyList()) }
    var classes by remember { mutableStateOf<List<PlatformClass>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var tick by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(tick) {
        if (isAdmin == null) {
            isAdmin = runCatching { checkPlatformAdmin() }.getOrDefault(false)
            if (isAdmin != true) return@LaunchedEffect
        }
        if (isAdmin == true) {
            val err = runCatching {
                overview = loadPlatformOverview()
                applications = listClassApplications()
                verifications = listVerificationRequests()
                users = listPlatformUsers()
                classes = listPlatformClasses()
            }.exceptionOrNull()
            error = err?.message
        }
    }

    if (isAdmin == false) {
        WebScreen {
            WebScreenHeader(title = "Admin console", subtitle = "Platform admin only")
            WebAlert(message = "You do not have platform admin access.", variant = WebAlertVariant.WARNING)
            WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        }
        return
    }

    WebScreen {
        WebScreenHeader(title = "Admin console", subtitle = "Platform-wide review queues")
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        if (error != null) WebAlert(message = error!!)
        if (notice != null) WebAlert(message = notice!!, variant = WebAlertVariant.SUCCESS)

        overview?.let {
            WebSectionTitle("Overview")
            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                    Text("Active classes: ${it.activeClasses}", color = Foreground)
                    Text("Total users: ${it.totalUsers}", color = Foreground)
                    Text("Pending applications: ${it.pendingApplications}", color = Foreground)
                    Text("Pending verifications: ${it.pendingVerifications}", color = Foreground)
                    Text("Pending reviews: ${it.pendingReviews}", color = Foreground)
                    Text("Published / unpublished assignments: ${it.publishedAssignments}/${it.unpublishedAssignments}", color = Foreground)
                    Text("Platform admins: ${it.platformAdmins}", color = Foreground)
                }
            }
        }

        WebSectionTitle("Class applications (${applications.size})")
        applications.forEach { app ->
            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                    Text(app.name, color = Foreground)
                    Text("${app.slug} · ${app.courseName ?: ""} · ${app.status}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        WebButton(label = "Approve", onClick = {
                            scope.launch {
                                val err = decideClassApplication(app.id, "approve")
                                notice = err ?: "Approved."
                                if (err == null) tick++
                            }
                        })
                        WebButton(label = "Reject", variant = WebButtonVariant.DANGER, onClick = {
                            scope.launch {
                                val err = decideClassApplication(app.id, "reject")
                                notice = err ?: "Rejected."
                                if (err == null) tick++
                            }
                        })
                    }
                }
            }
        }

        WebSectionTitle("Verifications (${verifications.size})")
        verifications.forEach { v ->
            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                    Text("Request ${v.id.take(8)}…", color = Foreground)
                    Text("Class ${v.classId?.take(8) ?: ""} · ${v.status}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        WebButton(label = "Approve", onClick = {
                            scope.launch {
                                val err = decideVerification(v.id, "approve")
                                notice = err ?: "Approved."
                                if (err == null) tick++
                            }
                        })
                        WebButton(label = "Reject", variant = WebButtonVariant.DANGER, onClick = {
                            scope.launch {
                                val err = decideVerification(v.id, "reject")
                                notice = err ?: "Rejected."
                                if (err == null) tick++
                            }
                        })
                    }
                }
            }
        }

        WebSectionTitle("Users (${users.size})")
        users.forEach { u ->
            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                    Text(u.displayName ?: u.id.take(12), color = Foreground)
                    Text("Classes: ${u.classCount} · Admin of: ${u.adminClassCount}${if (u.isPlatformAdmin) " · Platform admin" else ""}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        WebSectionTitle("Classes (${classes.size})")
        classes.forEach { c ->
            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                    Text(c.name, color = Foreground)
                    Text("${c.slug} · ${c.status} · ${c.memberCount} members", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
