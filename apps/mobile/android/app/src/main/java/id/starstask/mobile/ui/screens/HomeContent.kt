package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Danger

// Loading skeleton + header + error rows for Home. Extracted from HomeScreen.

@Composable
fun HomeLoadingSkeleton() {
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Section)) {
        SkeletonBox(modifier = Modifier.fillMaxWidth().height(120.dp), cornerRadius = 16)
        StatSkeletonRow()
        StatSkeletonRow()
        SkeletonCard()
        SkeletonCard()
        SkeletonBox(modifier = Modifier.fillMaxWidth().height(64.dp))
    }
}

@Composable
fun HomeErrorRow(error: String, onRetry: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        WebAlert(message = error)
        WebButton(label = "Retry", onClick = onRetry, variant = WebButtonVariant.SECONDARY)
    }
}

@Composable
fun HomeFeedbackRow(message: String) {
    Text(message, color = Accent)
}
