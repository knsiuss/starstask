package id.starstask.mobile.ui.screens

// My Classes, glossy iOS-light. Header + boxed directory cards with real
// class counts; Manage Class / Post Assignment are wired to the existing
// manage/create flows, Join reads the web accept_class_invitation RPC.

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.DirectoryClass
import id.starstask.mobile.data.WorkspaceScope
import id.starstask.mobile.data.acceptClassInvitationToken
import id.starstask.mobile.data.getWorkspaceScope
import id.starstask.mobile.data.loadClassDirectory
import id.starstask.mobile.data.leaveFailureMessage
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebSkeletonCard
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.screens.classdir.ClassesDirectoryCard
import id.starstask.mobile.ui.screens.classdir.JoinClassDialog
import id.starstask.mobile.ui.theme.mockColors
import id.starstask.mobile.ui.theme.mockPageBrush

@Composable
fun ClassesScreen(userId: String, onJoinClass: () -> Unit = {}, onOpenGrades: (String) -> Unit = {}) {
    var rows by remember { mutableStateOf<List<DirectoryClass>>(emptyList()) }
    var workspaceScope by remember { mutableStateOf<WorkspaceScope?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var joinError by remember { mutableStateOf<String?>(null) }
    var search by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var joining by remember { mutableStateOf(false) }
    var openClass by remember { mutableStateOf<DirectoryClass?>(null) }
    var joinOpen by remember { mutableStateOf(false) }
    var manageClassId by remember { mutableStateOf<String?>(null) }
    var postAssignmentFor by remember { mutableStateOf<String?>(null) }
    var reloadTick by remember { mutableStateOf(0) }
    val coroutinesScope = rememberCoroutineScope()

    LaunchedEffect(userId, reloadTick) {
        loading = true
        error = null
        try {
            rows = loadClassDirectory(userId)
            workspaceScope = getWorkspaceScope(userId)
        } catch (_: Exception) {
            error = "Could not load classes."
        }
        loading = false
    }

    val current = openClass
    if (current != null) {
        ClassDetailScreen(
            clazz = DirectoryClassToDetail(current),
            members = emptyList(),
            userId = userId,
            onBack = { openClass = null },
            onOpenGrades = onOpenGrades,
        )
        return
    }

    val activeManageId = manageClassId
    if (activeManageId != null) {
        val target = rows.firstOrNull { it.id == activeManageId }
        if (target != null) {
            ClassManageScreen(
                clazz = DirectoryClassToDetail(target),
                onBack = { manageClassId = null },
                onOpenGrades = onOpenGrades,
            )
            return
        } else {
            manageClassId = null
        }
    }

    val activePostId = postAssignmentFor
    val activeScope = workspaceScope
    if (activePostId != null && activeScope != null) {
        CreateAssignmentDialog(
            scope = activeScope,
            userId = userId,
            initialClassId = activePostId,
            onDismiss = { postAssignmentFor = null },
            onCreated = {
                postAssignmentFor = null
                reloadTick++
            },
        )
    }

    val filtered = remember(rows, search) {
        val q = search.trim().lowercase()
        if (q.isBlank()) rows else rows.filter {
            it.name.lowercase().contains(q) ||
                it.classCode.orEmpty().lowercase().contains(q) ||
                it.slug.lowercase().contains(q) ||
                it.semester.lowercase().contains(q) ||
                it.academicYear.contains(q)
        }
    }

    val palette = mockColors()
    Box(modifier = Modifier.fillMaxSize().background(mockPageBrush())) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(Spacing.Section),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 104.dp),
        ) {
            item { ClassesHeader() }
            item { ClassesSearchField(search = search, onSearch = { search = it }) }
            if (error != null) {
                item {
                    WebAlert(message = error!!, modifier = Modifier.padding(horizontal = Spacing.Page))
                }
            }
            if (loading) {
                item {
                    Column(
                        modifier = Modifier.padding(horizontal = Spacing.Page),
                        verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
                    ) {
                        WebSkeletonCard()
                        WebSkeletonCard()
                    }
                }
            } else if (rows.isEmpty()) {
                item {
                    WebEmptyState(
                        title = "No classes yet.",
                        description = "Join a class with an invitation code to get started.",
                        modifier = Modifier.padding(horizontal = Spacing.Page),
                    )
                }
            } else if (filtered.isEmpty()) {
                item {
                    WebEmptyState(
                        title = "No classes match your search.",
                        description = "Try a different search to see the rest of your classes.",
                        modifier = Modifier.padding(horizontal = Spacing.Page),
                    )
                }
            } else {
                item {
                    Text(
                        if (filtered.size == 1) "1 class group" else "${filtered.size} class groups",
                        color = palette.muted,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = Spacing.Page),
                    )
                }
                items(filtered, key = { it.id }) { clazz ->
                    ClassesDirectoryCard(
                        clazz = clazz,
                        onOpen = { openClass = clazz },
                        onManageClass = if (clazz.isAdmin) ({ manageClassId = clazz.id }) else null,
                        onPostAssignment = ({ postAssignmentFor = clazz.id }),
                        modifier = Modifier.padding(horizontal = Spacing.Page),
                    )
                }
            }
        }
        JoinFab(onClick = { joinOpen = true }, modifier = Modifier.align(Alignment.BottomCenter))
    }

    if (joinOpen) {
        JoinClassDialog(
            busy = joining,
            error = joinError,
            onJoin = { code ->
                coroutinesScope.launch {
                    joining = true
                    joinError = null
                    try {
                        acceptClassInvitationToken(code)
                        joinOpen = false
                        joining = false
                        joinError = null
                        reloadTick++
                    } catch (e: Exception) {
                        joining = false
                        joinError = leaveFailureMessage(e)
                    }
                }
            },
            onDismiss = {
                if (!joining) {
                    joinOpen = false
                    joinError = null
                }
            },
        )
    }
}

private fun DirectoryClassToDetail(clazz: DirectoryClass): ClassDetail =
    ClassDetail(
        id = clazz.id,
        name = clazz.name,
        slug = clazz.slug,
        semester = clazz.semester,
        academicYear = clazz.academicYear,
        memberCount = clazz.memberCount,
        classCode = clazz.classCode.orEmpty(),
        isAdmin = clazz.isAdmin,
        status = clazz.status,
    )

@Composable
private fun ClassesHeader() {
    val palette = mockColors()
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.Page, vertical = Spacing.Section),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xs),
    ) {
        Text(
            "My Classes",
            color = palette.ink,
            fontSize = 28.sp,
            lineHeight = 34.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "All your enrolled class groups in one place.",
            color = palette.muted,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun ClassesSearchField(search: String, onSearch: (String) -> Unit) {
    val palette = mockColors()
    val focusManager = LocalFocusManager.current
    TextField(
        value = search,
        onValueChange = onSearch,
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.Page)
            .clip(RoundedCornerShape(999.dp)),
        placeholder = { Text("Search classes...", color = palette.muted) },
        leadingIcon = {
            Icon(
                imageVector = Lucide.Search,
                contentDescription = null,
                tint = palette.muted,
            )
        },
        shape = RoundedCornerShape(999.dp),
        singleLine = true,
        keyboardActions = KeyboardActions(onSearch = { focusManager.clearFocus() }),
        textStyle = MaterialTheme.typography.bodyMedium.copy(
            color = palette.ink,
            fontSize = 15.sp,
        ),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = palette.card,
            unfocusedContainerColor = palette.card,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            cursorColor = palette.accent,
        ),
    )
}

@Composable
private fun JoinFab(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val palette = mockColors()
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 16.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(palette.accent)
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Lucide.Plus, contentDescription = null, tint = palette.dockBar, modifier = Modifier.size(16.dp))
            Text(
                "Join a class",
                color = palette.dockBar,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
