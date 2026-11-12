package id.starstask.mobile.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Background
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.Muted
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Warning
import id.starstask.mobile.ui.theme.WarningSoft

/**
 * Web-mirrored components (apps/web/src/components/ui/{card,badge,button}.tsx):
 * card = surface + border + rounded-lg (12dp) + p-5 (20dp) + near-flat shadow;
 * badge = pill with soft tone; buttons = rounded-md (8dp), text-sm medium.
 */

/** Web radius-lg = 0.75rem; radius-md = 0.5rem; rounded-xl = 12dp; rounded-2xl = 16dp. */
val WebCardRadius = RoundedCornerShape(Spacing.Xl)
val WebButtonRadius = RoundedCornerShape(Spacing.Md)
val WebHeaderRadius = RoundedCornerShape(Spacing.Section)

/**
 * Web `Card` (components/ui/card.tsx): surface + 1dp border + near-flat shadow
 * (`shadow-[0_1px_2px_rgba(9,9,11,0.04)]`) + `p-5` (20dp). This is the only card
 * chrome in the app; compact variants change padding only.
 */
@Composable
fun WebCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    containerColor: Color = Surface,
    padding: Dp = Spacing.Block,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (onClick != null) {
        Card(
            onClick = onClick,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            shape = WebCardRadius,
            elevation = CardDefaults.cardElevation(defaultElevation = Spacing.WebCardElevation),
            border = BorderStroke(1.dp, Border),
            modifier = modifier,
        ) {
            Column(modifier = Modifier.padding(padding), content = content)
        }
    } else {
        Card(
            colors = CardDefaults.cardColors(containerColor = containerColor),
            shape = WebCardRadius,
            elevation = CardDefaults.cardElevation(defaultElevation = Spacing.WebCardElevation),
            border = BorderStroke(1.dp, Border),
            modifier = modifier,
        ) {
            Column(modifier = Modifier.padding(padding), content = content)
        }
    }
}

// Compact card: same chrome, tighter padding used by stat cards and list rows.
@Composable
fun WebCompactCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    containerColor: Color = Surface,
    padding: Dp = Spacing.WebCompactCardPadding,
    content: @Composable ColumnScope.() -> Unit,
) {
    WebCard(
        modifier = modifier,
        onClick = onClick,
        containerColor = containerColor,
        padding = padding,
        content = content,
    )
}

@Composable
fun WebCardHeader(title: String, description: String? = null) {
    Column {
        WebCardTitle(title)
        if (!description.isNullOrBlank()) WebCardDescription(description)
    }
}

@Composable
fun WebCardTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        color = Foreground,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 20.sp,
        modifier = modifier,
    )
}

@Composable
fun WebCardDescription(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        color = MutedForeground,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        modifier = modifier,
    )
}

enum class BadgeTone { NEUTRAL, ACCENT, SUCCESS, WARNING, DANGER }

@Composable
fun WebBadge(text: String, tone: BadgeTone = BadgeTone.NEUTRAL, modifier: Modifier = Modifier) {
    val (container, label) = when (tone) {
        BadgeTone.NEUTRAL -> Muted to MutedForeground
        BadgeTone.ACCENT -> AccentSoft to Accent
        BadgeTone.SUCCESS -> SuccessSoft to Success
        BadgeTone.WARNING -> WarningSoft to Warning
        BadgeTone.DANGER -> DangerSoft to Danger
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = container),
        shape = CircleShape,
        border = BorderStroke(0.5.dp, Border),
        modifier = modifier,
    ) {
        Text(
            text,
            color = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = Spacing.Lg, vertical = Spacing.Xxs),
        )
    }
}

@Composable
private fun WebButtonLabel(label: String, icon: ImageVector?) {
    if (icon != null) {
        Icon(icon, contentDescription = null, modifier = Modifier.padding(end = 6.dp))
    }
    Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1, softWrap = false)
}

@Composable
fun WebPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = WebButtonRadius,
        colors = ButtonDefaults.buttonColors(
            containerColor = Accent,
            contentColor = id.starstask.mobile.ui.theme.Surface,
        ),
        modifier = modifier.defaultMinSize(minHeight = 40.dp),
    ) {
        WebButtonLabel(label, icon)
    }
}

@Composable
fun WebSecondaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = WebButtonRadius,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Foreground),
        border = BorderStroke(1.dp, Border),
        modifier = modifier.defaultMinSize(minHeight = 40.dp),
    ) {
        WebButtonLabel(label, icon)
    }
}

enum class WebButtonVariant { PRIMARY, SECONDARY, GHOST, DANGER, LINK }

@Composable
fun WebButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: WebButtonVariant = WebButtonVariant.PRIMARY,
    enabled: Boolean = true,
    icon: ImageVector? = null,
) {
    when (variant) {
        WebButtonVariant.PRIMARY -> WebPrimaryButton(label, onClick, modifier, enabled, icon)
        WebButtonVariant.SECONDARY -> WebSecondaryButton(label, onClick, modifier, enabled, icon)
        WebButtonVariant.GHOST -> androidx.compose.material3.TextButton(
            onClick = onClick,
            enabled = enabled,
            shape = WebButtonRadius,
            colors = ButtonDefaults.textButtonColors(contentColor = Foreground),
            modifier = modifier,
        ) { WebButtonLabel(label, icon) }
        WebButtonVariant.DANGER -> Button(
            onClick = onClick,
            enabled = enabled,
            shape = WebButtonRadius,
            colors = ButtonDefaults.buttonColors(containerColor = Danger, contentColor = Surface),
            modifier = modifier.defaultMinSize(minHeight = 40.dp),
        ) { WebButtonLabel(label, icon) }
        WebButtonVariant.LINK -> androidx.compose.material3.TextButton(
            onClick = onClick,
            enabled = enabled,
            shape = WebButtonRadius,
            colors = ButtonDefaults.textButtonColors(contentColor = Accent),
            modifier = modifier,
        ) { WebButtonLabel(label, icon) }
    }
}
