package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Success

/**
 * Course detail mirroring the design reference: title hero, deadline row,
 * Edit/Delete actions, then content sections (Description, Attachments,
 * References, Assignment information, Contributor, Share, Revision history).
 * Back navigation handles collapsing back to the list.
 */
@Composable
fun CourseDetailScreen(
    assignment: Assignment,
    onBack: () -> Unit,
    onEdit: () -> Unit = {},
    onDelete: () -> Unit = {},
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = Spacing.Page, vertical = Spacing.Section),
        verticalArrangement = Arrangement.spacedBy(Spacing.Section),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Surface),
            ) {
                Icon(
                    imageVector = Lucide.ArrowLeft,
                    contentDescription = "Back",
                    tint = Foreground,
                    modifier = Modifier.size(18.dp),
                )
            }
            Text(
                "Assignments",
                color = MutedForeground,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text("›", color = MutedForeground)
            Text(
                assignment.title,
                color = MutedForeground,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
            )
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(Spacing.Section),
            modifier = Modifier.fillMaxSize(),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        Badge(
                            text = "${assignment.className ?: ""} · ${assignment.className ?: ""}",
                            bg = AccentSoft,
                            fg = Accent,
                        )
                        Badge(
                            text = "Lecturer assignment",
                            bg = AccentSoft,
                            fg = Accent,
                        )
                    }
                    Text(
                        assignment.title,
                        style = MaterialTheme.typography.headlineSmall,
                        color = Foreground,
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Lucide.User,
                            contentDescription = null,
                            tint = MutedForeground,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            "P KANISIUS BAGASKARA",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Icon(
                            imageVector = Lucide.CalendarDays,
                            contentDescription = null,
                            tint = MutedForeground,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            "Published 05 Nov 2026",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Lucide.Clock,
                            contentDescription = null,
                            tint = Danger,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            "Due 07 Nov 2026, 23:59",
                            color = Danger,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        OutlinedButton(
                            onClick = onEdit,
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Icon(
                                imageVector = Lucide.Pencil,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.size(6.dp))
                            Text("Edit assignment")
                        }
                        Button(
                            onClick = onDelete,
                            colors = ButtonDefaults.buttonColors(containerColor = Danger),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Icon(
                                imageVector = Lucide.Trash2,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.size(6.dp))
                            Text("Delete")
                        }
                    }
                }
            }

            item {
                WebCard {
                    Text(
                        "Description",
                        style = MaterialTheme.typography.titleMedium,
                        color = Foreground,
                    )
                    Spacer(Modifier.height(Spacing.Xs))
                    Text(
                        "Tugas dikumpulkan sebelum hari minggu (Kode ipynb + tulis tangan )",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }

            item {
                WebCard {
                    Text(
                        "Attachments (3)",
                        style = MaterialTheme.typography.titleMedium,
                        color = Foreground,
                    )
                    Spacer(Modifier.height(Spacing.Xs))
                    Text(
                        "Images and PDFs preview here. Download links expire after 15 minutes; files are checked for type and size on upload.",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Spacer(Modifier.height(Spacing.Md))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
                    ) {
                        Icon(
                            imageVector = Lucide.Paperclip,
                            contentDescription = null,
                            tint = MutedForeground,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            "Attachment limit reached",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Spacer(Modifier.height(Spacing.Md))
                    AttachmentRow(filename = "data_jam_belajar.csv", meta = "CSV · 318 B")
                    AttachmentRow(filename = "Pertemuan 13 - Linear Regression...", meta = "PDF · 469.9 KB")
                    AttachmentPreviewCard(
                        title = "Linear Regression",
                        subtitle = "Apa Itu Linear Regression?",
                    )
                    AttachmentRow(filename = "Praktikum_Linear_Regression...", meta = "IPYNB · 140.7 KB")
                }
            }

            item {
                WebCard {
                    Text(
                        "References",
                        style = MaterialTheme.typography.titleMedium,
                        color = Foreground,
                    )
                    Spacer(Modifier.height(Spacing.Md))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Lucide.ExternalLink,
                            contentDescription = null,
                            tint = Accent,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.size(6.dp))
                        Text(
                            "https://drive.google.com/drive/folders/19nV6HGU0Kq6E54LA2Ah5dZT813le4dJ_?usp=sharing",
                            color = Accent,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 2,
                        )
                    }
                }
            }

            item {
                WebCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Lucide.Info,
                            contentDescription = null,
                            tint = Foreground,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.size(6.dp))
                        Text(
                            "Assignment information",
                            style = MaterialTheme.typography.titleMedium,
                            color = Foreground,
                        )
                    }
                    Spacer(Modifier.height(Spacing.Md))
                    InfoRow(label = "Course", value = assignment.className ?: "TPLM002")
                    InfoRow(label = "Course code", value = assignment.className ?: "TPLM002")
                    InfoRow(label = "Semester", value = "5")
                    InfoRow(label = "Academic year", value = "2024/2025")
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Status", color = MutedForeground, style = MaterialTheme.typography.bodyMedium)
                        Badge(
                            text = assignment.status.replaceFirstChar { it.uppercase() },
                            bg = SuccessSoft,
                            fg = Success,
                        )
                    }
                }
            }

            item {
                WebCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Lucide.UserCheck,
                            contentDescription = null,
                            tint = Foreground,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.size(6.dp))
                        Text(
                            "Contributor",
                            style = MaterialTheme.typography.titleMedium,
                            color = Foreground,
                        )
                    }
                    Spacer(Modifier.height(Spacing.Md))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(AccentSoft),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "P",
                                color = Accent,
                                style = MaterialTheme.typography.labelLarge,
                            )
                        }
                        Spacer(Modifier.size(10.dp))
                        Column {
                            Text(
                                "P KANISIUS BAGASKARA",
                                color = Foreground,
                                style = MaterialTheme.typography.titleSmall,
                            )
                            Text(
                                "Contributed 05 Nov 2026",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }

            item {
                WebCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Lucide.Share2,
                            contentDescription = null,
                            tint = Foreground,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.size(6.dp))
                        Text(
                            "Share assignment",
                            style = MaterialTheme.typography.titleMedium,
                            color = Foreground,
                        )
                    }
                    Spacer(Modifier.height(Spacing.Xs))
                    Text(
                        "Share this assignment with your class.",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Spacer(Modifier.height(Spacing.Md))
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        OutlinedButton(onClick = {}, shape = RoundedCornerShape(12.dp)) {
                            Icon(
                                imageVector = Lucide.Link2,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.size(6.dp))
                            Text("Copy link")
                        }
                        OutlinedButton(onClick = {}, shape = RoundedCornerShape(12.dp)) {
                            Icon(
                                imageVector = Lucide.MessageCircle,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.size(6.dp))
                            Text("Share on WhatsApp")
                        }
                    }
                }
            }

            item {
                WebCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Lucide.History,
                            contentDescription = null,
                            tint = Foreground,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.size(6.dp))
                        Text(
                            "Revision history",
                            style = MaterialTheme.typography.titleMedium,
                            color = Foreground,
                        )
                    }
                    Spacer(Modifier.height(Spacing.Md))
                    RevisionRow(action = "Updated description", date = "05 Nov 2026 · P KANISIUS BAGASKARA")
                    RevisionRow(action = "Status changed", date = "05 Nov 2026 · P KANISIUS BAGASKARA")
                    RevisionRow(action = "Published", date = "05 Nov 2026 · P KANISIUS BAGASKARA")
                    Spacer(Modifier.height(Spacing.Md))
                    Text(
                        "Every change to the title, description, deadline, or status is recorded automatically.",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            item {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(
                        imageVector = Lucide.Info,
                        contentDescription = null,
                        tint = MutedForeground,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.size(6.dp))
                    Text(
                        "Assignments are contributed by students and may be incomplete or outdated. Always confirm requirements with your lecturer.",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun Badge(text: String, bg: Color, fg: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text, color = fg, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = MutedForeground, style = MaterialTheme.typography.bodyMedium)
        Text(value, color = Foreground, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun AttachmentRow(filename: String, meta: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Lucide.FileText,
            contentDescription = null,
            tint = Accent,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.size(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(filename, color = Foreground, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
            Text(meta, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        }
        Icon(
            imageVector = Lucide.Ellipsis,
            contentDescription = "More",
            tint = MutedForeground,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Composable
private fun AttachmentPreviewCard(title: String, subtitle: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, color = Color.White, style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(4.dp))
            Text(subtitle, color = Color(0xFF94A3B8), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun RevisionRow(action: String, date: String) {
    Column(modifier = Modifier.padding(vertical = 6.dp)) {
        Text(action, color = Foreground, style = MaterialTheme.typography.titleSmall)
        Text(date, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
    }
}
