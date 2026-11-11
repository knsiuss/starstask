package id.starstask.mobile.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.Constraints
import io.github.jan.supabase.auth.auth

/**
 * Retries queued offline check-ins once connectivity returns.
 * Scheduled uniquely; also triggered from the app on foreground.
 */
class CheckInSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val userId = SupabaseProvider.client.auth.currentSessionOrNull()?.user?.id
            ?: return Result.success() // nothing to sync without a session
        runCatching { syncQueuedCheckIns(applicationContext, userId) }
            .onFailure { return Result.retry() }
        return Result.success()
    }

    companion object {
        private const val UNIQUE_NAME = "starstask-checkin-sync"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<CheckInSyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .addTag(UNIQUE_NAME)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(UNIQUE_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
