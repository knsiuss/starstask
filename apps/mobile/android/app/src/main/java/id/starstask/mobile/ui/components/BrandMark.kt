package id.starstask.mobile.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import id.starstask.mobile.R

// Intrinsic aspect ratio of apps/web/public/brand/logo-mark.png (992x810).
private const val MARK_WIDTH = 992f
private const val MARK_HEIGHT = 810f

/**
 * The StarsTask mark: an open book under a four-point star. Mirrors web
 * `BrandMark` (components/layout/brand-mark.tsx): decorative, hidden from
 * assistive technology because every place that shows it also prints the
 * wordmark. The PNG is byte-identical to the web asset.
 */
@Composable
fun BrandMark(
    sizeDp: Int = 32,
    modifier: Modifier = Modifier,
) {
    val width = (sizeDp * MARK_WIDTH / MARK_HEIGHT).toInt()
    Image(
        painter = painterResource(id = R.drawable.logo_mark),
        contentDescription = null,
        modifier = modifier
            .size(width = width.dp, height = sizeDp.dp)
            .semantics { contentDescription = "" },
        contentScale = ContentScale.FillBounds,
    )
}
