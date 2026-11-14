package id.starstask.mobile.data

import android.Manifest
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.provider.Settings
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.tasks.await

data class CapturedPosition(
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double,
    /** GNSS fix time when available, else device wall clock at capture. */
    val capturedAtMs: Long,
    /** Device wall clock at capture — used for freshness comparisons. */
    val deviceTimeMs: Long,
    /** True when capturedAtMs came from the satellite fix, not the device clock. */
    val timeFromGnss: Boolean,
    /** True when Settings.Global.AUTO_TIME is on (network-provided time). */
    val deviceClockAuto: Boolean,
    val isMock: Boolean,
    val provider: String?,
)

sealed interface CaptureOutcome {
    data class Fix(val position: CapturedPosition) : CaptureOutcome

    data class Failed(val reason: CaptureFailureReason) : CaptureOutcome
}

enum class CaptureFailureReason {
    PermissionDenied,
    ServicesOff,
    NoFix,
    MockDetected,
}

fun captureFailureMessage(reason: CaptureFailureReason): String =
    when (reason) {
        CaptureFailureReason.PermissionDenied -> "Location permission needed to check in."
        CaptureFailureReason.ServicesOff -> "Turn on Location services, then try again."
        CaptureFailureReason.NoFix -> "Could not get a location fix. Try again outdoors, or ask your class admin to mark you present."
        CaptureFailureReason.MockDetected -> "A mock location provider is active. Turn it off, then try again."
    }

fun isLocationServicesOn(context: Context): Boolean {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        manager.isLocationEnabled
    } else {
        manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }
}

private fun isMockLocation(location: Location): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        return location.isMock
    }
    // Deprecated <31 but still the only signal available there.
    @Suppress("DEPRECATION")
    return location.isFromMockProvider
}

private fun deviceClockAuto(context: Context): Boolean {
    return runCatching {
        Settings.Global.getInt(context.contentResolver, Settings.Global.AUTO_TIME, 0) == 1
    }.getOrDefault(true)
}

suspend fun capturePositionDetailed(context: Context): CaptureOutcome {
    if (!hasLocationPermission(context)) {
        return CaptureOutcome.Failed(CaptureFailureReason.PermissionDenied)
    }
    if (!isLocationServicesOn(context)) {
        return CaptureOutcome.Failed(CaptureFailureReason.ServicesOff)
    }
    val client: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)
    val location =
        try {
            client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
        } catch (_: Exception) {
            null
        }
    if (location == null) {
        return CaptureOutcome.Failed(CaptureFailureReason.NoFix)
    }
    if (isMockLocation(location)) {
        return CaptureOutcome.Failed(CaptureFailureReason.MockDetected)
    }
    // GNSS fixes carry the satellite-derived epoch; anything else falls back
    // to the device wall clock and is flagged as such.
    val gnssTime = location.time.takeIf { it > 0L && location.elapsedRealtimeNanos > 0L && location.provider?.contains("gps", ignoreCase = true) == true }
    return CaptureOutcome.Fix(
        CapturedPosition(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracyM = location.accuracy.toDouble(),
            capturedAtMs = gnssTime ?: System.currentTimeMillis(),
            deviceTimeMs = System.currentTimeMillis(),
            timeFromGnss = gnssTime != null,
            deviceClockAuto = deviceClockAuto(context),
            isMock = false,
            provider = location.provider,
        ),
    )
}

fun hasLocationPermission(context: Context): Boolean =
    androidx.core.content.ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION,
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
