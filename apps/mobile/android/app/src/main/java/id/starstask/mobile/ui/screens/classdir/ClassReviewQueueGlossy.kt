package id.starstask.mobile.ui.screens.classdir

// Review queue for class content (web /manage?tab=content + /review/[id]).
// Admins review pending_review submissions and moderate published/unpublished/
// archived content. Members see their own pending posts (read-only).

import androidx.compose.foundation.background
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassContentItem
import id.starstask.mobile.data.moderateAssignment
import id.starstask.mobile.data.listClassContent
import id.starstask.mobile.data.listManagedRequests
import id.starstask.mobile.data.listMyRequests
import id.starstask.mobile.data.getWorkspaceScope
import id.starstask.mobile.ui.screens.ReviewRequestDialog
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.StartaskSuccessDialog
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch

private val CONTENT_STATUSES = listOf(
    "pending_review" to "Pending",
    "published" to "Published",
    "unpublished" to "Unpublished",
    "archived" to "Archived",
)

@Composable
fun ClassReviewQueueGlossy(
    classId: String,
    userId: String,
    isAdmin: Boolean,
    onBack: () -> Unit,
    onOpenAssignment: (String) -> Unit,
) {
    val palette = mockColors()
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf(if (isAdmin) "pending_review" else "mine") }
    var search by remember { mutableStateOf("") }
    var reloadTick by remember { mutableIntStateOf(0) }
    var reviewTarget by remember { mutableStateOf<id.starstask.mobile.data.WorkspaceRequest?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var moderateBusyId by remember { mutableStateOf<String?>(null) }
    var successTitle by remember { mutableStateOf<String?>(null) }
    var successSummary by remember { mutableStateOf("") }

    val scopeState by produceState<id.starstask.mobile.data.WorkspaceScope?>(
        initialValue = null,
        key1 = userId,
    ) {
        value = runCatching { getWorkspaceScope(userId) }.getOrNull()
    }

    val managed by produceState(
        initialValue = emptyList<id.starstask.mobile.data.WorkspaceRequest>(),
        key1 = reloadTick,
        key2 = scopeState,
    ) {
        val s = scopeState
        value = if (s == null) emptyList() else runCatching {
            listManagedRequests(s).filter { it.classId == classId }
        }.getOrDefault(emptyList())
    }

    val mine by produceState(
        initialValue = emptyList<id.starstask.mobile.data.WorkspaceRequest>(),
        key1 = reloadTick,
        key2 = scopeState,
    ) {
        val s = scopeState
        value = if (s == null) emptyList() else runCatching {
            listMyRequests(userId, s).filter { it.classId == classId }
        }.getOrDefault(emptyList())
    }

    val content by produceState(
        initialValue = emptyList<ClassContentItem>(),
        key1 = reloadTick,
        key2 = tab,
    ) {
        value = if (tab == "mine") emptyList()
        else runCatching { listClassContent(classId, tab) }.getOrDefault(emptyList())
    }

    val managedPending = managed.filter { it.displayStatus == id.starstask.mobile.data.RequestDisplayStatus.PENDING }
        .sortedBy { it.createdAt }
    val minePending = mine.filter { it.displayStatus == id.starstask.mobile.data.RequestDisplayStatus.PENDING }

    val query = search.trim().lowercase()
    val visibleContent = content.filter { query.isEmpty() || it.title.lowercase().contains(query) }
    val visiblePending = managedPending.filter { query.isEmpty() || it.title.lowercase().contains(query) }

    GlossyBackSurface(
        title = "Review queue",
        subtitle = if (isAdmin) "Approve member content before it is published." else "Your posts waiting on review.",
        onBack = onBack,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (error != null) WebAlert(message = error!!)

            androidx.compose.material3.OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                singleLine = true,
                label = { Text("Search titles") },
                leadingIcon = { Icon(Lucide.Search, contentDescription = null, modifier = Modifier.size(17.dp)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
            )

            FilterRow(
                items = if (isAdmin) CONTENT_STATUSES + ("mine" to "My posts") else listOf("mine" to "My posts"),
                selected = tab,
                counts = content.groupingBy { it.status }.eachCount(),
                pendingCount = managedPending.size,
                mineCount = minePending.size,
                onSelect = { tab = it },
                palette = palette,
            )

            when (tab) {
                "pending_review" -> {
                    if (visiblePending.isEmpty()) {
                        EmptyRow(if (query.isEmpty()) "Nothing waiting for review." else "No title matches \"$search\".")
                    } else {
                        visiblePending.forEach { request ->
                            PendingReviewRow(
                                request = request,
                                palette = palette,
                                onOpen = { onOpenAssignment(request.id) },
                                onReview = { reviewTarget = request },
                            )
                            GlossyHairline(palette)
                        }
                    }
                }
                "mine" -> {
                    if (minePending.isEmpty()) {
                        EmptyRow("You have no posts waiting on review.")
                    } else {
                        minePending.forEach { request ->
                            MineRow(request = request, palette = palette, onOpen = { onOpenAssignment(request.id) })
                            GlossyHairline(palette)
                        }
                    }
                }
                else -> {
                    // Content moderation tabs.
                    if (visibleContent.isEmpty()) {
                        EmptyRow(if (query.isEmpty()) "No content in this state." else "No title matches \"$search\".")
                    } else {
                        visibleContent.forEach { item ->
                            ContentRow(
                                item = item,
                                palette = palette,
                                busy = moderateBusyId == item.id,
                                onOpen = { onOpenAssignment(item.id) },
                                onModerate = { action ->
                                    scope.launch {
                                        moderateBusyId = item.id
                                        val label = when (action) {
                                            "unpublish" -> "Content Unpublished"
                                            "archive" -> "Content Archived"
                                            "restore" -> "Content Restored"
                                            else -> "Content Moderated"
                                        }
                                        val message = moderateAssignment(item.id, action)
                                        if (message != null) {
                                            error = message
                                        } else {
                                            successTitle = label
                                            successSummary = item.title
                                        }
                                        moderateBusyId = null
                                        reloadTick++
                                    }
                                },
                            )
                            GlossyHairline(palette)
                        }
                    }
                }
            }
        }
    }

    reviewTarget?.let { target ->
        ReviewRequestDialog(
            request = target,
            onDismiss = { reviewTarget = null },
            onReviewed = {
                reviewTarget = null
                reloadTick++
            },
        )
    }
    val st = successTitle
    if (st != null) {
        StartaskSuccessDialog(
            title = st,
            summary = successSummary,
            primaryLabel = "Done",
            onPrimary = { successTitle = null },
            onDismiss = { successTitle = null },
        )
    }
}


@Composable
private fun FilterRow(
    items: List<Pair<String, String>>,
    selected: String,
    counts: Map<String, Int>,
    pendingCount: Int,
    mineCount: Int,
    onSelect: (String) -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { (key, label) ->
            val count = when (key) {
                "pending_review" -> pendingCount
                "mine" -> mineCount
                else -> counts[key] ?: 0
            }
            val active = selected == key
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (active) palette.accent else palette.chip)
                    .clickable { onSelect(key) }
                    .heightIn(min = 36.dp)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Text(
                    "$label${if (count > 0) " · $count" else ""}",
                    color = if (active) androidx.compose.ui.graphics.Color.White else palette.ink,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun EmptyRow(message: String) {
    val palette = mockColors()
    Text(message, color = palette.muted, fontSize = 13.sp, lineHeight = 19.sp)
}

@Composable
private fun PendingReviewRow(
    request: id.starstask.mobile.data.WorkspaceRequest,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onOpen: () -> Unit,
    onReview: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(request.title, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(
                listOfNotNull(request.submitterName, request.courseName).joinToString(" · "),
                color = palette.muted,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                request.deadline?.let { "Deadline ${id.starstask.mobile.data.formatShortDayMonth(it.take(10))}" } ?: "No deadline",
                color = palette.muted,
                fontSize = 11.sp,
            )
        }
        Text(
            "Review",
            color = palette.accent,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .clickable(onClick = onReview)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun MineRow(
    request: id.starstask.mobile.data.WorkspaceRequest,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onOpen: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(request.title, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(request.courseName, color = palette.muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("Waiting for the class admin to review.", color = palette.muted, fontSize = 11.sp)
        }
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun ContentRow(
    item: ClassContentItem,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    busy: Boolean,
    onOpen: () -> Unit,
    onModerate: (String) -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(item.title, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(
                listOfNotNull(item.ownerName, if (item.attachmentCount > 0) "${item.attachmentCount} file${if (item.attachmentCount == 1) "" else "s"}" else null).joinToString(" · "),
                color = palette.muted,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Box {
            Text(
                if (busy) "Saving…" else "Moderate",
                color = palette.accent,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .clickable(enabled = !busy) { menuOpen = true }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                when (item.status) {
                    "published" -> {
                        DropdownMenuItem(text = { Text("View public") }, onClick = { menuOpen = false; onOpen() })
                        DropdownMenuItem(text = { Text("Unpublish") }, onClick = { menuOpen = false; onModerate("unpublish") })
                        DropdownMenuItem(text = { Text("Archive") }, onClick = { menuOpen = false; onModerate("archive") })
                    }
                    "unpublished", "archived" -> {
                        DropdownMenuItem(text = { Text("Restore") }, onClick = { menuOpen = false; onModerate("restore") })
                    }
                    else -> DropdownMenuItem(text = { Text("View") }, onClick = { menuOpen = false; onOpen() })
                }
            }
        }
    }
}
