package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ClassMetric
import id.starstask.mobile.data.DashboardMetrics
import id.starstask.mobile.data.IncidentRow
import id.starstask.mobile.data.PlatformUserRow
import id.starstask.mobile.data.checkPlatformAdmin
import id.starstask.mobile.data.listDeveloperIncidents
import id.starstask.mobile.data.loadClassMetrics
import id.starstask.mobile.data.loadDashboardMetrics
import id.starstask.mobile.data.loadDeveloperUsers
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebAlertVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebScreen
import id.starstask.mobile.ui.components.WebScreenHeader
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground

// Developer console (web developer routes). Gated by checkPlatformAdmin().
@Composable
fun DeveloperConsoleScreen(onBack: () -> Unit) {
    var tab by remember { mutableStateOf("activity") }
    var isAdmin by remember { mutableStateOf<Boolean?>(null) }
    var metrics by remember { mutableStateOf<DashboardMetrics?>(null) }
    var classMetrics by remember { mutableStateOf<List<ClassMetric>>(emptyList()) }
    var users by remember { mutableStateOf<List<PlatformUserRow>>(emptyList()) }
    var incidents by remember { mutableStateOf<List<IncidentRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isAdmin = runCatching { checkPlatformAdmin() }.getOrDefault(false)
        if (isAdmin == true) {
            runCatching {
                metrics = loadDashboardMetrics()
                classMetrics = loadClassMetrics()
                users = loadDeveloperUsers()
                incidents = listDeveloperIncidents()
            }.onFailure { error = userFacingMessage(it) }
        }
    }

    if (isAdmin == false) {
        WebScreen {
            WebScreenHeader(title = "Developer console", subtitle = "Platform admin only")
            WebAlert(message = "You do not have platform admin access.", variant = WebAlertVariant.WARNING)
            WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        }
        return
    }

    WebScreen {
        WebScreenHeader(title = "Developer console", subtitle = "Platform observability")
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        if (error != null) WebAlert(message = error!!)
        id.starstask.mobile.ui.components.WebTabStrip(
            items = listOf("Activity" to "activity", "Classes" to "classes", "Users" to "users", "Incidents" to "incidents"),
            activeKey = tab,
            onSelect = { tab = it },
        )

        if (tab == "classes") {
            WebSectionTitle("Classes (${classMetrics.size})")
            classMetrics.forEach { c ->
                WebCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(Spacing.Section)) {
                        Text(c.name, color = Foreground)
                        Text("${c.status} · ${c.memberCount} members · ${c.publishedCount} published", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        } else if (tab == "users") {
            WebSectionTitle("Users (${users.size})")
            users.forEach { u ->
                WebCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(Spacing.Section)) {
                        Text(u.displayName ?: u.id.take(12), color = Foreground)
                        Text("Last sign-in: ${u.lastSignInAt ?: "never"}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        } else if (tab == "incidents") {
            WebSectionTitle("Incidents (${incidents.size})")
            if (incidents.isEmpty()) {
                Text("No incidents visible here. Full incident management (notes, database, logs, monitoring, security) remains in the web console.", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
            incidents.forEach { inc ->
                WebCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                        Text(inc.title ?: inc.id.take(12), color = Foreground)
                        Text(inc.status ?: "", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        } else {
        WebSectionTitle("Activity (30d)")
        metrics?.let {
            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(Spacing.Section)) {
                    WebCardHeader(title = "Users")
                    Text("Total users: ${it.totalUsers}", color = Foreground)
                    Text("Active 7d / 30d: ${it.activeUsers7} / ${it.activeUsers30}", color = Foreground)
                    Text("Sign-ins 7d / 30d: ${it.signIns7} / ${it.signIns30}", color = Foreground)
                    Text("Registrations 7d / 30d: ${it.registrations7} / ${it.registrations30}", color = Foreground)
                    Text("Total assignments: ${it.totalAssignments}", color = Foreground)
                }
            }
        }

        }
    }
}
