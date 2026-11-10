package id.starstask.mobile.ui.screens.classdir

// Export Report sheet. Choices:
//  1. Attendance recap (PDF / XLSX) — downloaded via the web export route
//     with the native bearer token, so branding + logging match web exactly.
//  2. Class members (CSV) — generated on-device; no new RPC.
//  3. Approved leave letters (PDF) — generated on-device from rows that the
//     lecturer already approved (server is authoritative for status).

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.DirectoryClass
import id.starstask.mobile.data.DirectoryMember
import id.starstask.mobile.data.membersCsv
import id.starstask.mobile.data.shareFile
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun ClassExportSheet(
    clazz: DirectoryClass,
    members: List<DirectoryMember>,
    onDismiss: () -> Unit,
    onExportAttendancePdf: () -> Unit,
    onExportAttendanceXlsx: () -> Unit,
) {
    val palette = mockColors()
    val context = LocalContext.current
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
            ExportRow(
                icon = Lucide.FileText,
                label = "Attendance recap (PDF)",
                hint = "Formal, branded document",
                onClick = { onExportAttendancePdf(); onDismiss() },
                palette = palette,
            )
            ExportRow(
                icon = Lucide.FileText,
                label = "Attendance recap (Spreadsheet)",
                hint = "XLSX matrix",
                onClick = { onExportAttendanceXlsx(); onDismiss() },
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
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
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
            Text(label, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(hint, color = palette.muted, fontSize = 12.sp)
        }
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(19.dp))
    }
}

private fun shareMembersCsv(context: Context, clazz: DirectoryClass, members: List<DirectoryMember>) {
    val csv = membersCsv(clazz.name, members)
    val file = File(context.cacheDir, "starstask-members-" + SimpleDateFormat("yyyyMMdd", Locale.US).format(Date()) + ".csv")
    file.writeText(csv, Charsets.UTF_8)
    shareFile(context, file, "text/csv", "Class members")
}
