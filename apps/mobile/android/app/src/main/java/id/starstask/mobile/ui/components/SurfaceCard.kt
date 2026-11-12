package id.starstask.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

private val CardShape = RoundedCornerShape(12.dp)

/**
 * Grouped-card surface for Apple-style screens: white surface, 12dp radius,
 * hairline border, no elevation (iOS grouped-list look), 16dp padding.
 * Drop-in replacement for the glossy 22dp/WebCard chrome.
 */
@Composable
fun SurfaceCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    horizontalPadding: androidx.compose.ui.unit.Dp = 16.dp,
    verticalPadding: androidx.compose.ui.unit.Dp = 16.dp,
    content: @Composable () -> Unit,
) {
    val palette = mockColors()
    val base = if (onClick != null) {
        Modifier.clickable(onClick = onClick)
    } else {
        Modifier
    }
    Column(
        modifier = modifier
            .then(base)
            .clip(CardShape)
            .background(palette.card)
            .border(1.dp, palette.cardBorder, CardShape)
            .padding(horizontal = horizontalPadding, vertical = verticalPadding),
    ) {
        content()
    }
}

/** Section label for Apple grouped lists: small uppercase muted label, optional
 * trailing action link. No vertical accent bar. */
@Composable
fun SectionHeader(
    title: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val palette = mockColors()
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            title.uppercase(),
            color = palette.muted,
            fontSize = 11.sp,
            lineHeight = 14.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            modifier = Modifier.weight(1f),
        )
        if (actionLabel != null && onAction != null) {
            Row(
                modifier = Modifier.clickable(onClick = onAction),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(actionLabel, color = palette.accent, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.accent, modifier = Modifier.size(14.dp))
            }
        }
    }
}

/** Apple inset grouped list: white rounded container, rows separated by a
 * hairline divider with 16dp start inset. */
@Composable
fun InsetGroup(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val palette = mockColors()
    Column(
        modifier = modifier
            .clip(CardShape)
            .background(palette.card)
            .border(1.dp, palette.cardBorder, CardShape),
    ) {
        content()
    }
}

@Composable
fun InsetGroupRow(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val base = if (onClick != null) {
        Modifier.clickable(onClick = onClick)
    } else {
        Modifier
    }
    Column(
        modifier = modifier
            .then(base)
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        content()
    }
}
