package id.starstask.mobile.ui.screens.classdir

// Export Report sheet. Choices:
//  1. Attendance recap (PDF / XLSX) for a chosen subject, downloaded via the
//     web export route with the native bearer token (branding + logging match
//     the web path). Requires a subject — the web route is subjectId-scoped.
//  2. Class members (CSV), generated on-device.

import android.content.Context
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.DirectoryClass
import id.starstask.mobile.data.DirectoryMember
import id.starstask.mobile.data.ExportFormat
import id.starstask.mobile.data.downloadAttendanceExport
import id.starstask.mobile.data.listClassCourses
import id.starstask.mobile.data.membersCsv
import id.starstask.mobile.data.shareFile
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun ClassExportSheet(
    clazz: DirectoryClass,
    members: List<DirectoryMember>,
    onDismiss: () -> Unit,
) {
    val palette = mockColors()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var subjectId by remember { mutableStateOf<String?>(null) }
    var subjects by remember { mutableStateOf<List<id.starstask.mobile.data.ClassCourse>>(emptyList()) }
    var subjectsLoading by remember { mutableStateOf(true) }
    var subjectMenuOpen by remember { mutableStateOf(false) }
    var exporting by remember { mutableStateOf<ExportFormat?>(null) }
    var exportError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(clazz.id) {
        subjects = runCatching { listClassCourses(clazz.id, includeArchived = false) }.getOrDefault(emptyList())
        subjectId = subjects.firstOrNull()?.id
        subjectsLoading = false
    }

    val attendanceReady = subjectId != null && exporting == null

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = palette.card,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Export report",
                color = palette.ink,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 2.dp),
            )
            if (exportError != null) {
                Text(exportError!!, color = palette.riskFg, fontSize = 12.sp, lineHeight = 17.sp)
            }

            if (subjectsLoading) {
                Text("Loading subjects…", color = palette.muted, fontSize = 13.sp, modifier = Modifier.padding(vertical = 6.dp))
            } else if (subjects.isEmpty()) {
                Text(
                    "Add a course to this class before exporting attendance.",
                    color = palette.muted,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                )
            } else {
                Box {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                            .clickable { subjectMenuOpen = true }
                            .heightIn(min = 56.dp)
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                                .background(palette.accentSofter),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Lucide.BookOpen, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp))
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Subject", color = palette.muted, fontSize = 11.sp)
                            Text(
                                subjects.firstOrNull { it.id == subjectId }
                                    ?.let { subject -> subject.code?.let { "$it · ${subject.name}" } ?: subject.name }
                                    ?: "Choose a subject",
                                color = palette.ink,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                            )
                        }
                        Icon(Lucide.ChevronDown, contentDescription = null, tint = palette.muted, modifier = Modifier.size(19.dp))
                    }
                    DropdownMenu(expanded = subjectMenuOpen, onDismissRequest = { subjectMenuOpen = false }) {
                        subjects.forEach { subject ->
                            DropdownMenuItem(
                                text = { Text(subject.code?.let { "$it · ${subject.name}" } ?: subject.name) },
                                onClick = { subjectId = subject.id; subjectMenuOpen = false },
                            )
                        }
                    }
                }
            }

            ExportRow(
                icon = Lucide.FileText,
                label = "Attendance recap (PDF)",
                hint = if (exporting == ExportFormat.Pdf) "Preparing…" else "Formal, branded document",
                enabled = attendanceReady,
                onClick = {
                    val targetId = subjectId ?: return@ExportRow
                    exporting = ExportFormat.Pdf
                    exportError = null
                    scope.launch {
                        runCatching { downloadAttendanceExport(context, clazz.slug, targetId, ExportFormat.Pdf) }
                            .onSuccess { result ->
                                shareFile(context, result.file, result.mimeType, "Attendance recap")
                                onDismiss()
                            }
                            .onFailure { exportError = "Could not export the recap. Please try again." }
                        exporting = null
                    }
                },
                palette = palette,
            )
            ExportRow(
                icon = Lucide.FileSpreadsheet,
                label = "Attendance recap (Spreadsheet)",
                hint = if (exporting == ExportFormat.Xlsx) "Preparing…" else "XLSX matrix",
                enabled = attendanceReady,
                onClick = {
                    val targetId = subjectId ?: return@ExportRow
                    exporting = ExportFormat.Xlsx
                    exportError = null
                    scope.launch {
                        runCatching { downloadAttendanceExport(context, clazz.slug, targetId, ExportFormat.Xlsx) }
                            .onSuccess { result ->
                                shareFile(context, result.file, result.mimeType, "Attendance recap")
                                onDismiss()
                            }
                            .onFailure { exportError = "Could not export the recap. Please try again." }
                        exporting = null
                    }
                },
                palette = palette,
            )
            ExportRow(
                icon = Lucide.Users,
                label = "Class members (CSV)",
                hint = "Name, role, admin flag",
                onClick = { shareMembersCsv(context, clazz, members); onDismiss() },
                palette = palette,
            )
        }
    }
}

@Composable
private fun ExportRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    hint: String,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    enabled: Boolean = true,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .heightIn(min = 56.dp)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                .background(palette.accentSofter),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(label, color = if (enabled) palette.ink else palette.muted, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(hint, color = palette.muted, fontSize = 12.sp)
        }
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(19.dp))
    }
}

private fun shareMembersCsv(context: Context, clazz: DirectoryClass, members: List<DirectoryMember>) {
    val csv = membersCsv(clazz.name, members)
    val file = File(id.starstask.mobile.data.sharedReportsDir(context), "starstask-members-" + SimpleDateFormat("yyyyMMdd", Locale.US).format(Date()) + ".csv")
    file.writeText(csv, Charsets.UTF_8)
    shareFile(context, file, "text/csv", "Class members")
}
