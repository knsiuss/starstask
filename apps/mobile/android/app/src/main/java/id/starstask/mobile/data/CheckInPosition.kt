package id.starstask.mobile.data

import android.Manifest
import android.content.Context
import android.location.LocationManager
import android.os.Build
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.tasks.await

data class CapturedPosition(
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double,
    val capturedAtMs: Long,
)

sealed interface CaptureOutcome {
    data class Fix(val position: CapturedPosition) : CaptureOutcome

    data class Failed(val reason: CaptureFailureReason) : CaptureOutcome
}

enum class CaptureFailureReason {
    PermissionDenied,
    ServicesOff,
    NoFix,
}

fun captureFailureMessage(reason: CaptureFailureReason): String =
    when (reason) {
        CaptureFailureReason.PermissionDenied -> "Location permission needed to check in."
        CaptureFailureReason.ServicesOff -> "Turn on Location services, then try again."
        CaptureFailureReason.NoFix -> "Could not get a location fix. Try again outdoors, or ask your class admin to mark you present."
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
    return CaptureOutcome.Fix(
        CapturedPosition(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracyM = location.accuracy.toDouble(),
            capturedAtMs = System.currentTimeMillis(),
        ),
    )
}

fun hasLocationPermission(context: Context): Boolean =
    androidx.core.content.ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION,
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
