package id.starstask.mobile.ui.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

@Composable
internal fun AsyncAvatar(
    avatarUrl: String?,
    displayName: String,
    size: androidx.compose.ui.unit.Dp,
) {
    val scheme = MaterialTheme.colorScheme
    var bitmap by remember(avatarUrl) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(avatarUrl) {
        if (avatarUrl.isNullOrBlank()) return@LaunchedEffect
        bitmap = try {
            withContext(Dispatchers.IO) {
                val connection = URL(avatarUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 8000
                connection.inputStream.use { BitmapFactory.decodeStream(it) }
            }
        } catch (_: Exception) {
            null
        }
    }
    val initials = remember(displayName) {
        displayName.split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase().ifEmpty { "?" }
    }
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(scheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        val shown = bitmap
        if (shown != null) {
            Image(shown.asImageBitmap(), contentDescription = null, modifier = Modifier.size(size), contentScale = ContentScale.Crop)
        } else {
            Text(initials, color = scheme.onSurfaceVariant, style = MaterialTheme.typography.headlineMedium)
        }
    }
}

