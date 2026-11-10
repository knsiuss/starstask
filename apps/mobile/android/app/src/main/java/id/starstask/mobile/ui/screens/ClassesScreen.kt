package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebSkeletonCard
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.ClassesCover
import id.starstask.mobile.ui.theme.ClassesPage
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.Surface

/**
 * Classes directory, light web-style (matches `ClassDirectoryCard`):
 * white cards on a light-grey page, accent-soft cover strip, white
 * graduation-cap tile straddling the cover edge, mono code chip + bio
 * line, description excerpt, and a stats footer (subjects / assignments
 * / members) with a circular chevron. Navigation keeps the existing
 * [ClassDetailScreen] push.
 */
@Composable
fun ClassesScreen(userId: String, onJoinClass: () -> Unit = {}, onOpenGrades: (String) -> Unit = {}) {
    var rows by remember { mutableStateOf<List<ClassDetail>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var search by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var openClass by remember { mutableStateOf<ClassDetail?>(null) }

    LaunchedEffect(userId) {
        loading = true
        try {
            rows = id.starstask.mobile.data.loadClasses(userId)
        } catch (e: Exception) {
            error = "Could not load classes."
        }
        loading = false
    }

    val current = openClass
    if (current != null) {
        ClassDetailScreen(clazz = current, members = emptyList(), userId = userId, onBack = { openClass = null }, onOpenGrades = onOpenGrades)
        return
    }

    val filtered = remember(rows, search) {
        val q = search.trim().lowercase()
        if (q.isBlank()) rows else rows.filter {
            it.name.lowercase().contains(q) ||
                (it.classCode).lowercase().contains(q) ||
                (it.slug).lowercase().contains(q) ||
                (it.semester).lowercase().contains(q) ||
                (it.academicYear).contains(q)
        }
    }

    val showEmptySection = false

    Box(modifier = Modifier.fillMaxSize()) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(ClassesPage),
        verticalArrangement = Arrangement.spacedBy(Spacing.Section),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 88.dp),
    ) {
        item {
            ClassesHeader()
        }
        item {
            ClassesSearchField(search = search, onSearch = { search = it })
        }
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
                    description = "Join a class with an invitation or code to get started.",
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
                    color = MutedForeground,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = Spacing.Page),
                )
            }
            items(filtered, key = { it.id }) { clazz ->
                ClassDirectoryCard(
                    clazz = clazz,
                    onOpen = { openClass = clazz },
                    modifier = Modifier.padding(horizontal = Spacing.Page),
                )
            }
            if (showEmptySection) {
                item {
                    ClassesEmptySection()
                }
            }
        }
    }
    JoinFAB(onClick = onJoinClass, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun ClassesHeader() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.Page, vertical = Spacing.Section),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xs),
    ) {
        Text(
            "My Classes",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.SemiBold),
            color = Foreground,
        )
        Text(
            "All your enrolled class groups in one place.",
            style = MaterialTheme.typography.bodySmall,
            color = MutedForeground,
        )
    }
}

@Composable
private fun ClassesSearchField(search: String, onSearch: (String) -> Unit) {
    val focusManager = LocalFocusManager.current
    TextField(
        value = search,
        onValueChange = onSearch,
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.Page).shadow(2.dp, RoundedCornerShape(16.dp)),
        placeholder = { Text("Search classes...", color = MutedForeground) },
        leadingIcon = {
            Icon(
                imageVector = Lucide.Search,
                contentDescription = null,
                tint = MutedForeground,
            )
        },
        shape = RoundedCornerShape(16.dp),
        singleLine = true,
        keyboardActions = KeyboardActions(onSearch = { focusManager.clearFocus() }),
        textStyle = MaterialTheme.typography.bodyMedium,
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Surface,
            unfocusedContainerColor = Surface,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            cursorColor = Foreground,
        ),
    )
}

@Composable
private fun ClassDirectoryCard(clazz: ClassDetail, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Surface)
            .clickable { onOpen() },
    ) {
        // Cover strip - web h-16 accent-soft rounded-t-2xl with menu top-right.
        Box(
            modifier = Modifier.fillMaxWidth()
                .height(64.dp)
                .background(ClassesCover)
                .padding(top = Spacing.Sm, end = Spacing.Sm),
            contentAlignment = Alignment.TopEnd,
        ) {
            if (clazz.isAdmin) {
                ClassAdminPill()
            } else if (clazz.status.isNotBlank() && clazz.status != "active") {
                Text(
                    clazz.status.replaceFirstChar { it.uppercase() },
                    color = Accent,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.clip(RoundedCornerShape(999.dp))
                        .background(AccentSoft)
                        .padding(horizontal = Spacing.Lg, vertical = Spacing.Xs),
                )
            }
        }
        // Body - tile straddles cover edge via offset, then title/bio/excerpt.
        Column(
            modifier = Modifier.padding(horizontal = Spacing.Section).padding(bottom = Spacing.Section),
            verticalArrangement = Arrangement.spacedBy(Spacing.Md),
        ) {
            Box(
                modifier = Modifier.size(48.dp).offset(y = (-28).dp)
                    .shadow(4.dp, RoundedCornerShape(12.dp))
                    .clip(RoundedCornerShape(12.dp))
                    .background(Surface),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Lucide.GraduationCap,
                    contentDescription = null,
                    tint = Accent,
                    modifier = Modifier.size(24.dp),
                )
            }
            Text(
                clazz.name,
                color = Foreground,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
            )
            BioLine(clazz = clazz)
            if (clazz.courseName.isNotBlank()) {
                Text(
                    clazz.courseName,
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                )
            }
        }
        StatsFooter(clazz = clazz, onOpen = onOpen)
    }
}

@Composable
private fun ClassAdminPill() {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(999.dp))
            .background(AccentSoft)
            .padding(horizontal = Spacing.Lg, vertical = Spacing.Xs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
    ) {
        Icon(
            imageVector = Lucide.Crown,
            contentDescription = null,
            tint = Accent,
            modifier = Modifier.size(12.dp),
        )
        Text(
            "Class Admin",
            color = Accent,
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
        )
    }
}

@Composable
private fun BioLine(clazz: ClassDetail) {
    val code = codeOf(clazz)
    val bio = buildList {
        if (code.isNotBlank()) add(code)
        if (clazz.semester.isNotBlank()) add("Semester ${clazz.semester}")
        if (clazz.academicYear.isNotBlank()) add(clazz.academicYear)
    }
    if (bio.isEmpty()) return
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        val chip = bio.first()
        if (chip != clazz.name) {
            Text(
                chip.uppercase(),
                color = MutedForeground,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                modifier = Modifier.clip(RoundedCornerShape(6.dp))
                    .background(MutedForeground.copy(alpha = 0.1f))
                    .padding(horizontal = Spacing.Md, vertical = Spacing.Xxs),
            )
        }
        if (bio.size > 1) {
            Text(
                bio.drop(1).joinToString(" · "),
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun StatsFooter(clazz: ClassDetail, onOpen: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth()
            .padding(horizontal = Spacing.Section, vertical = Spacing.Section),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.Section),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CardStat(icon = Lucide.BookOpen, value = 0, label = "Subjects")
            CardStat(icon = Lucide.ClipboardList, value = 0, label = "Assignments")
            CardStat(icon = Lucide.Users, value = clazz.memberCount, label = plural(clazz.memberCount, "Member", "Members"))
        }
        Box(
            modifier = Modifier.size(44.dp)
                .clip(CircleShape)
                .background(AccentSoft)
                .clickable { onOpen() },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Lucide.ChevronRight,
                contentDescription = null,
                tint = Accent,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
private fun CardStat(icon: ImageVector, value: Int, label: String) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.Xxs),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MutedForeground,
                modifier = Modifier.size(16.dp),
            )
            Text(
                value.toString(),
                color = Foreground,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            )
        }
        Text(
            label,
            color = MutedForeground,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

private fun plural(value: Int, singular: String, plural: String): String =
    if (value == 1) singular else plural


@Composable
private fun JoinFAB(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 16.dp)
            .shadow(4.dp, RoundedCornerShape(999.dp))
            .clip(RoundedCornerShape(999.dp))
            .background(Accent)
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Lucide.Plus, contentDescription = null, tint = Surface, modifier = Modifier.size(16.dp))
            Text("Join a class", color = Surface, style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold))
        }
    }
}

@Composable
private fun ClassesEmptySection() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.Page, bottom = Spacing.Page),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.Section),
    ) {
        Text(
            "No other classes available",
            color = MutedForeground,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

private fun codeOf(clazz: ClassDetail): String {
    val raw = clazz.classCode.ifBlank { clazz.slug }
    return raw.trim().replace(" ", "").uppercase()
}
