package id.starstask.mobile.ui.components

import id.starstask.mobile.ui.components.WebSectionTitle
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import id.starstask.mobile.ui.theme.LinkActionText
import id.starstask.mobile.ui.theme.SectionDescription
import id.starstask.mobile.ui.theme.SectionTitleRail
import id.starstask.mobile.ui.theme.Spacing

// Web page scaffold: bg-background (#fafaf8), gutter and section rhythm from
// the canonical spacing scale (web `px-3 sm:px-6 py-4 sm:py-8` and `mt-5`).
@Composable
fun WebScreen(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(Spacing.PageGutter),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
        content = content,
    )
}

@Composable
fun WebScreenHeader(title: String, subtitle: String? = null) {
    val palette = mockColors()
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xxs)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, color = palette.ink)
        if (!subtitle.isNullOrBlank()) {
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = palette.muted)
        }
    }
}

// Mirrors web SectionHeader (components/dashboard/section-header.tsx): title
// 16sp semibold tracking-tight, optional 12sp muted description, and an
// optional right-aligned action link with an arrow. `rail` is the tighter
// treatment used by the dashboard's right column.
@Composable
fun WebSectionTitle(
    text: String,
    modifier: Modifier = Modifier,
    description: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    rail: Boolean = false,
) {
    val palette = mockColors()
    androidx.compose.foundation.layout.Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = androidx.compose.ui.Modifier.weight(1f)) {
            Text(
                text,
                style = if (rail) SectionTitleRail else MaterialTheme.typography.titleMedium,
                color = palette.ink,
            )
            if (!description.isNullOrBlank() && !rail) {
                Text(
                    description,
                    style = SectionDescription,
                    color = palette.muted,
                    modifier = androidx.compose.ui.Modifier.padding(top = Spacing.Xs),
                )
            }
        }
        if (actionLabel != null && onAction != null) {
            androidx.compose.foundation.layout.Row(
                modifier = androidx.compose.ui.Modifier
                    .padding(start = Spacing.Section)
                    .clickable(
                        interactionSource = androidx.compose.foundation.interaction.MutableInteractionSource(),
                        indication = null,
                        onClick = onAction,
                    ),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
            ) {
                Text(actionLabel, style = LinkActionText, color = palette.accent)
                Icon(Lucide.ArrowRight, contentDescription = null, tint = palette.accent, modifier = androidx.compose.ui.Modifier.size(Spacing.Xl))
            }
        }
    }
}

// Mirrors web Input: h-10, rounded-md, border-input, bg-surface, focus accent.
@Composable
fun WebInput(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    enabled: Boolean = true,
    placeholder: String? = null,
    minLines: Int = 1,
    isError: Boolean = false,
    supportingText: String? = null,
) {
    val palette = mockColors()
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = placeholder?.let { text -> { Text(text, maxLines = 1) } },
        supportingText = supportingText?.let { text -> { Text(text, color = palette.riskFg) } },
        isError = isError,
        modifier = modifier.fillMaxWidth(),
        singleLine = singleLine,
        minLines = minLines,
        enabled = enabled,
        shape = RoundedCornerShape(8.dp),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = palette.card,
            unfocusedContainerColor = palette.card,
            focusedIndicatorColor = palette.accent,
            unfocusedIndicatorColor = palette.hairline,
        ),
        textStyle = MaterialTheme.typography.bodyMedium,
    )
}

// Mirrors web Alert variants.
enum class WebAlertVariant { INFO, ERROR, SUCCESS, WARNING }

@Composable
fun WebAlert(message: String, variant: WebAlertVariant = WebAlertVariant.ERROR, modifier: Modifier = Modifier) {
    val palette = mockColors()
    val (bg, fg, bd) = when (variant) {
        WebAlertVariant.INFO -> Triple(palette.chip, palette.ink, palette.cardBorder)
        WebAlertVariant.ERROR -> Triple(palette.riskBg, palette.riskFg, palette.riskFg.copy(alpha = 0.3f))
        WebAlertVariant.SUCCESS -> Triple(palette.goodBg, palette.goodFg, palette.goodFg.copy(alpha = 0.3f))
        WebAlertVariant.WARNING -> Triple(palette.fairBg, palette.fairFg, palette.fairFg.copy(alpha = 0.3f))
    }
    Column(
        modifier = modifier.fillMaxWidth()
            .background(bg, RoundedCornerShape(8.dp))
            .border(0.5.dp, bd, RoundedCornerShape(8.dp))
            .padding(Spacing.Xl),
    ) {
        Text(message, color = fg, style = MaterialTheme.typography.bodySmall)
    }
}

// Skeleton placeholder. A branded shimmer brush sweeps across the block on a
// short infinite loop while fresh data fetches; reads as "working", never as
// a frozen placeholder.
@Composable
fun WebSkeleton(height: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier, radius: androidx.compose.ui.unit.Dp = 8.dp) {
    val shimmerWidth = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp
    androidx.compose.foundation.layout.BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(radius))
            .background(id.starstask.mobile.ui.theme.rememberShimmerBrush(width = shimmerWidth)),
    ) {}
}

/** Web `loading.tsx` list idiom: a card with title, meta and body lines. */
@Composable
fun WebSkeletonCard(modifier: Modifier = Modifier) {
    WebCard(modifier = modifier) {
        WebSkeleton(height = 16.dp, modifier = Modifier.fillMaxWidth(0.5f))
        WebSkeleton(height = 12.dp, modifier = Modifier.fillMaxWidth(0.75f))
        WebSkeleton(height = 12.dp, modifier = Modifier.fillMaxWidth(0.35f))
    }
}

// Empty state mirroring web EmptyState: rounded-xl border-dashed, centered,
// px-6 py-14, title text-lg semibold, muted description.
@Composable
fun WebEmptyState(title: String, description: String? = null, modifier: Modifier = Modifier) {
    val palette = mockColors()
    androidx.compose.foundation.layout.Box(
        modifier = modifier
            .fillMaxWidth()
            .background(palette.card, RoundedCornerShape(12.dp))
            .border(
                1.dp,
                palette.cardBorder,
                RoundedCornerShape(12.dp),
            )
            .padding(horizontal = Spacing.Page, vertical = 48.dp),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.Sm),
        ) {
            Text(
                title,
                style = MaterialTheme.typography.titleLarge,
                color = palette.ink,
                fontWeight = FontWeight.SemiBold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            if (!description.isNullOrBlank()) {
                Text(
                    description,
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.muted,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }
}
