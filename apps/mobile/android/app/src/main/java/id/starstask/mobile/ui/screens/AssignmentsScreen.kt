package id.starstask.mobile.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.WorkspaceRequest
import id.starstask.mobile.data.WorkspaceScheduleItem
import id.starstask.mobile.data.getWorkspaceOverview
import id.starstask.mobile.data.getWorkspaceScope
import id.starstask.mobile.data.hideAssignment
import id.starstask.mobile.data.hiddenAssignmentsFlow
import id.starstask.mobile.data.listManagedRequests
import id.starstask.mobile.data.listMyRequests
import id.starstask.mobile.data.listWorkspaceSchedule
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebSkeletonCard
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.dashColors
import id.starstask.mobile.ui.theme.SoftFill
import id.starstask.mobile.ui.theme.Muted
import id.starstask.mobile.ui.theme.Danger
import kotlinx.coroutines.launch

private val SearchBg = Muted
private val FilterBg = SoftFill

@Composable
fun AssignmentsWorkspaceScreen(
    userId: String,
    onOpenAssignment: ((WorkspaceScheduleItem) -> Unit)? = null,
    onOpenRequestApproved: (WorkspaceRequest) -> Unit = {},
    autoOpenRequest: Boolean = false,
) {
    val palette = dashColors()
    var activeAssignment by remember { mutableStateOf<WorkspaceScheduleItem?>(null) }
    val open: (WorkspaceScheduleItem) -> Unit = onOpenAssignment ?: { item -> activeAssignment = item }

    val scopeState = remember { mutableStateOf<id.starstask.mobile.data.WorkspaceScope?>(null) }
    var overview by remember { mutableStateOf<id.starstask.mobile.data.WorkspaceOverview?>(null) }
    var scheduleItems by remember { mutableStateOf<List<WorkspaceScheduleItem>>(emptyList()) }
    var scheduleTotal by remember { mutableStateOf(0) }
    var scheduleTotalPages by remember { mutableStateOf(1) }
    var myRequests by remember { mutableStateOf<List<WorkspaceRequest>>(emptyList()) }
    var managedRequests by remember { mutableStateOf<List<WorkspaceRequest>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var tab by remember { mutableStateOf("schedule") }
    var search by remember { mutableStateOf("") }
    var appliedSearch by remember { mutableStateOf("") }
    var classId by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf("all") }
    var sort by remember { mutableStateOf("newest") }
    var page by remember { mutableStateOf(1) }
    var typeFilter by remember { mutableStateOf<String?>(null) }
    var showFilterSheet by remember { mutableStateOf(false) }
    var showCreate by remember { mutableStateOf(autoOpenRequest) }
    var reviewTarget by remember { mutableStateOf<WorkspaceRequest?>(null) }
    var refreshTick by remember { mutableStateOf(0) }
    var showSort by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val hiddenIds by hiddenAssignmentsFlow(context).collectAsState(initial = emptySet())
    val scope = scopeState.value
    val manages = scope?.managesAnyClass == true
    val scopeCoroutine = androidx.compose.runtime.rememberCoroutineScope()

    suspend fun loadAll() {
        val s = getWorkspaceScope(userId)
        scopeState.value = s
        val page1 = listWorkspaceSchedule(
            scope = s,
            search = appliedSearch.ifBlank { null },
            classFilter = classId,
            status = status,
            sort = sort,
            type = typeFilter,
            page = page,
        )
        scheduleItems = page1.items
        scheduleTotal = page1.total
        scheduleTotalPages = page1.totalPages
        overview = getWorkspaceOverview(s)
        myRequests = listMyRequests(userId, s)
        managedRequests = listManagedRequests(s)
    }

    LaunchedEffect(userId, appliedSearch, classId, status, sort, typeFilter, page, refreshTick) {
        loading = true
        error = null
        try {
            loadAll()
        } catch (e: Exception) {
            error = e.message ?: "Could not load assignments."
        }
        loading = false
    }

    if (showCreate && scope != null) {
        CreateAssignmentDialog(
            scope = scope,
            userId = userId,
            onDismiss = { showCreate = false },
            onCreated = {
                showCreate = false
                refreshTick++
            },
        )
        return
    }

    val detail = activeAssignment
    if (detail != null) {
        BackHandler(onBack = { activeAssignment = null })
        AssignmentDetailScreen(
            userId = userId,
            assignment = Assignment(
                id = detail.id,
                title = detail.title,
                status = detail.status,
                deadline = detail.deadline,
                className = detail.className ?: detail.courseName,
            ),
            onBack = { activeAssignment = null },
        )
        return
    }

    val review = reviewTarget
    if (review != null) {
        ReviewRequestDialog(
            request = review,
            onDismiss = { reviewTarget = null },
            onReviewed = {
                reviewTarget = null
                refreshTick++
            },
        )
        return
    }

    val filterCount = activeFilterCount(typeFilter, status, classId, sort)
    val createLabel = if (manages) "Create Assignment" else "Request Task Publication"
    val subtitle = if (manages) {
        "Manage class tasks, schedules, and publication requests."
    } else {
        "Keep track of tasks and deadlines across your classes."
    }

    if (showFilterSheet) {
        AssignmentsFilterSheet(
            initialType = typeFilter,
            initialStatus = status,
            initialClassId = classId,
            initialSort = sort,
            classes = scope?.classes.orEmpty(),
            manages = manages,
            onDismiss = { showFilterSheet = false },
            onApply = { type, newStatus, newClassId, newSort ->
                typeFilter = type
                status = newStatus
                classId = newClassId
                sort = newSort
                page = 1
                showFilterSheet = false
            },
        )
    }

    val visibleItems = scheduleItems.filterNot { it.id in hiddenIds }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(palette.pageBackground),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Assignments", color = palette.text, fontSize = 30.sp, fontWeight = FontWeight.SemiBold)
                Text(subtitle, color = palette.muted, fontSize = 14.sp)
            }
        }

        if (scope != null && scope.classes.isNotEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(999.dp))
                        .background(palette.accent)
                        .clickable { showCreate = true }
                        .padding(vertical = 14.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Lucide.Plus, contentDescription = null, tint = Surface, modifier = Modifier.size(18.dp))
                        Text("+  $createLabel", color = Surface, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        if (overview != null) {
            item {
                ReferenceStats(overview = overview!!)
            }
            item {
                ReferenceDeadlineAlert(
                    overview = overview!!,
                    onOpenAssignment = { id ->
                        scheduleItems.firstOrNull { it.id == id }?.let(open)
                    },
                )
            }
        }

        if (error != null) {
            item {
                Text(error!!, color = Danger, style = MaterialTheme.typography.bodySmall)
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box {
                    ReferenceScheduleHeader(count = scheduleTotal, onOpenSort = { showSort = true })
                    DropdownMenu(expanded = showSort, onDismissRequest = { showSort = false }) {
                        SORTS.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    sort = value
                                    page = 1
                                    showSort = false
                                },
                            )
                        }
                    }
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Box(modifier = Modifier.weight(1f)) {
                        TextField(
                            value = search,
                            onValueChange = { search = it },
                            placeholder = {
                                Text(
                                    "Search assignments...",
                                    maxLines = 1,
                                    softWrap = false,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = palette.muted,
                                )
                            },
                            singleLine = true,
                            leadingIcon = {
                                Icon(Lucide.Search, contentDescription = null, tint = palette.muted, modifier = Modifier.size(20.dp))
                            },
                            trailingIcon = if (search.isNotEmpty()) {
                                {
                                    IconButton(
                                        onClick = {
                                            search = ""
                                            appliedSearch = ""
                                            page = 1
                                        },
                                    ) {
                                        Icon(Lucide.X, contentDescription = "Clear search", tint = palette.muted, modifier = Modifier.size(16.dp))
                                    }
                                }
                            } else {
                                null
                            },
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(
                                onSearch = {
                                    appliedSearch = search.trim()
                                    page = 1
                                },
                            ),
                            shape = RoundedCornerShape(999.dp),
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = SearchBg,
                                unfocusedContainerColor = SearchBg,
                                disabledContainerColor = SearchBg,
                                focusedIndicatorColor = Color.Transparent,
                                unfocusedIndicatorColor = Color.Transparent,
                                cursorColor = palette.accent,
                            ),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(color = palette.text),
                            modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp),
                        )
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(FilterBg)
                            .clickable(onClick = { showFilterSheet = true })
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(Lucide.SlidersHorizontal, contentDescription = "Filter", tint = palette.text, modifier = Modifier.size(18.dp))
                            Text("Filter", color = palette.text, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            Text(
                                (if (filterCount > 0) filterCount else 1).toString(),
                                color = Surface,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(palette.accent).padding(horizontal = 8.dp, vertical = 2.dp),
                            )
                        }
                    }
                }
            }
        }

        item {
            WorkspaceTabs(
                tab = tab,
                onTabChange = { tab = it },
                scheduleCount = scheduleTotal,
                requestsLabel = if (manages) "Publication Requests" else "My Requests",
                requestsCount = if (manages) {
                    managedRequests.count { it.displayStatus == id.starstask.mobile.data.RequestDisplayStatus.PENDING } + myRequests.size
                } else {
                    myRequests.size
                },
            )
        }

        if (tab == "requests") {
            item {
                RequestsSection(
                    manages = manages,
                    myRequests = myRequests,
                    managedRequests = managedRequests,
                    onReview = { reviewTarget = it },
                    onOpenApproved = onOpenRequestApproved,
                )
            }
        } else if (loading) {
            items(3) {
                WebSkeletonCard()
            }
        } else if (visibleItems.isEmpty()) {
            item {
                WebEmptyState(
                    title = if ((scope?.classIds.orEmpty()).isEmpty()) "No assignments yet." else "No assignments match these filters.",
                    description = if ((scope?.classIds.orEmpty()).isEmpty()) "Published class tasks will appear here." else "Try a different search or filter to see the rest of your class tasks.",
                )
            }
        } else {
            items(visibleItems, key = { it.id }) { item ->
                ReferenceAssignmentCard(
                    item = item,
                    onOpen = { open(item) },
                    onDismiss = {
                        scopeCoroutine.launch { hideAssignment(context, item.id) }
                    },
                    onOpenAttachments = { open(item) },
                )
            }
            if (scheduleTotalPages > 1) {
                item {
                    PaginationRow(page = page, totalPages = scheduleTotalPages, onPage = { page = it })
                }
            }
        }
    }
}
