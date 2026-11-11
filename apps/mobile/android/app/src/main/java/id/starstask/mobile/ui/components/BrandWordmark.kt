package id.starstask.mobile.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import id.starstask.mobile.R

// Intrinsic aspect ratio of res/drawable-nodpi/logo_wordmark.png (2172x724).
private const val WORDMARK_WIDTH = 2172f
private const val WORDMARK_HEIGHT = 724f

/**
 * The StarsTask wordmark (new logo): "STARTASK" + swoosh, transparent PNG.
 * Black variant for light surfaces, white variant for dark surfaces.
 * Decorative; content descriptions are suppressed.
 */
@Composable
fun BrandWordmark(
    heightDp: Int = 26,
    onDark: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val width = (heightDp * WORDMARK_WIDTH / WORDMARK_HEIGHT).toInt()
    Image(
        painter = painterResource(
            id = if (onDark) R.drawable.logo_wordmark_white else R.drawable.logo_wordmark,
        ),
        contentDescription = null,
        modifier = modifier
            .width(width.dp)
            .height(heightDp.dp)
            .semantics { contentDescription = "" },
        contentScale = ContentScale.Fit,
    )
}
