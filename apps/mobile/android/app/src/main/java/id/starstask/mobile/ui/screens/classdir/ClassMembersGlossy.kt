package id.starstask.mobile.ui.screens.classdir

// Glossy Members tab: roster with initials avatar, name, role chip
// (Class Admin / Member), admin-only export CSV + promote/demote/remove
// behind confirm dialogs. Export writes display_name + role + joined_at
// only — never NIM, and always exports every member (not the filtered
// view). Search + role filter are client-side.

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.DirectoryClass
import id.starstask.mobile.data.DirectoryMember
import id.starstask.mobile.data.assignClassAdmin
import id.starstask.mobile.data.loadClassRoster
import id.starstask.mobile.data.membersCsv
import id.starstask.mobile.data.removeClassMember
import id.starstask.mobile.data.revokeClassAdmin
import id.starstask.mobile.data.shareFile
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private data class PendingAction(
    val member: DirectoryMember,
    val action: String,
)

@Composable
fun ClassMembersGlossy(
    clazz: DirectoryClass,
    currentUserId: String,
    onMembersChanged: () -> Unit,
) {
    val palette = mockColors()
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var members by remember { mutableStateOf<List<DirectoryMember>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var pending by remember { mutableStateOf<PendingAction?>(null) }
    var search by remember { mutableStateOf("") }
    var roleFilter by remember { mutableStateOf("all") }

    val query = search.trim().lowercase()
    val adminCount = members.count { it.isAdmin }
    val memberCount = members.size - adminCount
    val visible = members.filter { member ->
        val roleMatch = when (roleFilter) {
            "admins" -> member.isAdmin
            "members" -> !member.isAdmin
            else -> true
        }
        val searchMatch = query.isEmpty() || member.name.lowercase().contains(query)
        roleMatch && searchMatch
    }

    LaunchedEffect(clazz.id) {
        loading = true
        error = null
        runCatching { loadClassRoster(clazz.id) }
            .onSuccess { members = it; loading = false }
            .onFailure { error = "Could not load members."; loading = false }
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Members",
                color = palette.ink,
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier
                    .clip(androidx.compose.foundation.shape.RoundedCornerShape(999.dp))
                    .background(palette.chip)
                    .clickable { exportMembersCsv(context, clazz.name, members) }
                    .padding(horizontal = 12.dp, vertical = 7.dp),
            ) {
                Icon(Lucide.Download, contentDescription = null, tint = palette.accent, modifier = Modifier.size(16.dp))
                Text("CSV (all)", color = palette.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        androidx.compose.material3.OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            singleLine = true,
            label = { Text("Search members") },
            leadingIcon = { Icon(Lucide.Search, contentDescription = null, modifier = Modifier.size(17.dp)) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                "all" to "All · ${members.size}",
                "admins" to "Admins · $adminCount",
                "members" to "Members · $memberCount",
            ).forEach { (key, label) ->
                val active = roleFilter == key
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (active) palette.accent else palette.chip)
                        .clickable { roleFilter = key }
                        .heightIn(min = 34.dp)
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                ) {
                    Text(
                        label,
                        color = if (active) androidx.compose.ui.graphics.Color.White else palette.ink,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, androidx.compose.foundation.shape.RoundedCornerShape(22.dp)),
        ) {
            if (loading) {
                Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = palette.accent)
                }
            } else if (error != null) {
                Text(error!!, color = palette.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp))
            } else if (members.isEmpty()) {
                Text("No members yet.", color = palette.muted, fontSize = 13.sp, modifier = Modifier.padding(16.dp))
            } else if (visible.isEmpty()) {
                Text(
                    if (query.isEmpty()) "No members in this role." else "No member matches \"$search\".",
                    color = palette.muted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(16.dp),
                )
            } else {
                Column {
                    visible.forEachIndexed { index, member ->
                        if (index > 0) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 1.dp)
                                    .background(palette.hairline),
                            )
                        }
                        MemberRow(
                            member = member,
                            isSelf = member.id == currentUserId,
                            onPromote = { pending = PendingAction(member, "promote") },
                            onRevoke = { pending = PendingAction(member, "revoke") },
                            onRemove = { pending = PendingAction(member, "remove") },
                            palette = palette,
                        )
                    }
                }
            }
        }
    }

    pending?.let { action ->
        val title = when (action.action) {
            "promote" -> "Make ${action.member.name} an admin?"
            "revoke" -> "Remove admin from ${action.member.name}?"
            else -> "Remove ${action.member.name} from this class?"
        }
        val message = when (action.action) {
            "promote" -> "Class admins can manage the class and approve requests."
            "revoke" -> "They will become a regular member again."
            else -> "They will lose access to this class. This cannot be undone."
        }
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text(title) },
            text = { Text(message) },
            confirmButton = {
                androidx.compose.material3.TextButton(
                    onClick = {
                        scope.launch {
                            when (action.action) {
                                "promote" -> assignClassAdmin(clazz.id, action.member.id)
                                "revoke" -> revokeClassAdmin(clazz.id, action.member.id)
                                else -> removeClassMember(clazz.id, action.member.id)
                            }
                            pending = null
                            onMembersChanged()
                        }
                    },
                ) { Text("Confirm") }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { pending = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun MemberRow(
    member: DirectoryMember,
    isSelf: Boolean,
    onPromote: () -> Unit,
    onRevoke: () -> Unit,
    onRemove: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(palette.accentSofter),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                member.name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                color = palette.accent,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                member.name + if (isSelf) " (you)" else "",
                color = palette.ink,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                if (member.isAdmin) "Class Admin" else "Member",
                color = if (member.isAdmin) palette.accent else palette.muted,
                fontSize = 12.sp,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            if (member.isAdmin) {
                IconButton(onClick = onRevoke, modifier = Modifier.size(34.dp)) {
                    Icon(Lucide.ShieldCheck, contentDescription = "Remove admin", tint = palette.muted, modifier = Modifier.size(17.dp))
                }
            } else {
                IconButton(onClick = onPromote, modifier = Modifier.size(34.dp)) {
                    Icon(Lucide.Shield, contentDescription = "Make admin", tint = palette.muted, modifier = Modifier.size(17.dp))
                }
            }
            IconButton(onClick = onRemove, modifier = Modifier.size(34.dp)) {
                Icon(Lucide.Trash2, contentDescription = "Remove member", tint = palette.riskFg, modifier = Modifier.size(17.dp))
            }
        }
    }
}

private fun exportMembersCsv(context: Context, className: String, members: List<DirectoryMember>) {
    if (members.isEmpty()) return
    val csv = membersCsv(className, members)
    val file = File(id.starstask.mobile.data.sharedReportsDir(context), "starstask-members-" + SimpleDateFormat("yyyyMMdd", Locale.US).format(Date()) + ".csv")
    file.writeText(csv, Charsets.UTF_8)
    shareFile(context, file, "text/csv", "Class members")
}
