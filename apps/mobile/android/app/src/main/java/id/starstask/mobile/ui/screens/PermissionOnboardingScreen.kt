package id.starstask.mobile.ui.screens

// First-launch onboarding: explains (in the app's voice) why StarsTask asks
// for notification and location permissions, then triggers the Android
// runtime dialogs. Notification grant also enables push end-to-end
// (server preference row + FCM token + local cache), identical to the
// Settings toggle. Notifications stay IMPORTANCE_LOW — no sound, vibration,
// or heads-up, per the product constraint that reminders must never pull
// people out of meetings.
// "Nanti" is not a permanent lockout: the gate runs once per install and the
// same prompts re-appear at the point of need (check-in for location,
// Settings for push).

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.R
import id.starstask.mobile.data.enablePushForUser
import id.starstask.mobile.data.hasLocationPermission
import id.starstask.mobile.data.notificationsGranted
import id.starstask.mobile.data.setPermissionsOnboardingSeen
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DashRadiusCard
import id.starstask.mobile.ui.theme.dashColors
import kotlinx.coroutines.launch

private enum class Step { INTRO, NOTIFICATION, LOCATION, DONE }

@Composable
fun PermissionOnboardingScreen(
    userId: String,
    onDone: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val palette = dashColors()
    var step by remember { mutableStateOf(Step.INTRO) }
    var notice by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun finish() {
        scope.launch {
            runCatching { setPermissionsOnboardingSeen(context, true) }
            onDone()
        }
    }

    val notifLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            scope.launch {
                busy = true
                runCatching { enablePushForUser(context, userId) }
                    .onSuccess { notice = "Notifikasi aktif — senyap, muncul di shade saja." }
                    .onFailure { notice = "Gagal menyalakan notifikasi. Kamu bisa coba lagi di Pengaturan." }
                busy = false
                step = Step.LOCATION
            }
        } else {
            notice = "Notifikasi tidak diizinkan. Bisa dinyalakan lagi di Pengaturan."
            step = Step.LOCATION
        }
    }

    val locationLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (!granted) {
            notice = "Lokasi ditolak. Bisa diberikan nanti saat absen kelas."
        }
        step = Step.DONE
    }

    fun skipAll() {
        finish()
    }

    when (step) {
        Step.INTRO -> IntroScreen(
            palette = palette,
            onContinue = { step = Step.NOTIFICATION },
            onSkip = { skipAll() },
        )
        Step.NOTIFICATION -> ExplainerDialog(
            palette = palette,
            title = "Aktifkan notifikasi?",
            body = """StarsTask bisa mengingatkanmu 24 jam dan 3 jam sebelum deadline, juga sebelum kelas dimulai.

Senyap - tanpa suara, getar, atau heads-up.

Muncul di shade saja. Tidak mengganggu saat kamu meeting atau kerja.

Bisa dimatikan kapan pun di Pengaturan.""".trimIndent(),

            confirmLabel = if (busy) "Mengaktifkan…" else "Lanjutkan",
            onConfirm = {
                if (notificationsGranted(context)
                    || android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU
                ) {
                    scope.launch {
                        busy = true
                        runCatching { enablePushForUser(context, userId) }
                            .onSuccess { notice = "Notifikasi aktif — senyap, muncul di shade saja." }
                            .onFailure { notice = "Gagal menyalakan notifikasi. Kamu bisa coba lagi di Pengaturan." }
                        busy = false
                        step = Step.LOCATION
                    }
                } else {
                    notifLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                }
            },
            onSkip = { step = Step.LOCATION },
        )
        Step.LOCATION -> ExplainerDialog(
            palette = palette,
            title = "Izinkan lokasi?",
            body = "Dipakai hanya saat kamu absen kelas — untuk memverifikasi kamu benar-benar di kampus.\n\nStarsTask tidak melacak lokasimu di latar belakang, dan tidak membagikannya ke pihak lain.",
            confirmLabel = "Izinkan",
            onConfirm = {
                if (hasLocationPermission(context)) {
                    step = Step.DONE
                } else {
                    locationLauncher.launch(android.Manifest.permission.ACCESS_FINE_LOCATION)
                }
            },
            onSkip = { step = Step.DONE },
        )
        Step.DONE -> DoneScreen(
            palette = palette,
            notice = notice,
            onContinue = { finish() },
        )
    }
}

private data class ExplainerCard(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val title: String,
    val body: String,
)

@Composable
private fun IntroScreen(
    palette: id.starstask.mobile.ui.theme.DashPalette,
    onContinue: () -> Unit,
    onSkip: () -> Unit,
) {
    val cards = listOf(
        ExplainerCard(
            Lucide.Bell,
            "Notifikasi deadline",
            "Pengingat 24 jam dan 3 jam sebelum tugas jatuh tempo. Senyap — tidak ada suara atau getar.",
        ),
        ExplainerCard(
            Lucide.MapPin,
            "Lokasi untuk absensi",
            "Memverifikasi kamu di kampus saat check-in kelas. Tidak dipakai untuk hal lain.",
        ),
    )
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageBackground)
            .padding(horizontal = 24.dp, vertical = 40.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
        ) {
            TextButton(onClick = onSkip) { Text("Lewati", color = palette.muted) }
        }
        Image(
            painter = painterResource(R.drawable.logo_mark),
            contentDescription = null,
            modifier = Modifier
                .size(96.dp)
                .clip(RoundedCornerShape(24.dp))
                .align(Alignment.CenterHorizontally),
        )
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "Dua hal dulu.",
                color = palette.text,
                fontSize = 30.sp,
                lineHeight = 36.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "Terima kasih sudah pakai StarsTask. Izin ini yang bikin pengingat deadline dan absensi otomatis bisa jalan.",
                color = palette.muted,
                fontSize = 15.sp,
                lineHeight = 22.sp,
            )
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.weight(1f)) {
            items(items = cards) { card ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(DashRadiusCard)
                        .background(palette.card)
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        card.icon,
                        contentDescription = null,
                        tint = palette.accent,
                        modifier = Modifier.size(28.dp),
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(card.title, color = palette.text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text(card.body, color = palette.muted, fontSize = 13.sp, lineHeight = 19.sp)
                    }
                }
            }
        }
        WebButton(
            label = "Lanjutkan",
            onClick = onContinue,
            variant = WebButtonVariant.PRIMARY,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun ExplainerDialog(
    palette: id.starstask.mobile.ui.theme.DashPalette,
    title: String,
    body: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onSkip: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageBackground)
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(DashRadiusCard)
                .background(palette.card)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(title, color = palette.text, fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.SemiBold)
            Text(
                text = body,
                color = palette.muted,
                fontSize = 15.sp,
                lineHeight = 23.sp,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.End),
            ) {
                TextButton(onClick = onSkip) { Text("Nanti", color = palette.muted) }
                WebButton(label = confirmLabel, onClick = onConfirm, variant = WebButtonVariant.PRIMARY)
            }
        }
    }
}

@Composable
private fun DoneScreen(
    palette: id.starstask.mobile.ui.theme.DashPalette,
    notice: String?,
    onContinue: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageBackground)
            .padding(horizontal = 24.dp, vertical = 40.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(40.dp))
        Icon(
            Lucide.CircleCheck,
            contentDescription = null,
            tint = palette.accent,
            modifier = Modifier.size(96.dp),
        )
        Text(
            "Siap dipakai",
            color = palette.text,
            fontSize = 28.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 34.sp,
        )
        if (notice != null) {
            Text(
                notice,
                color = palette.muted,
                fontSize = 14.sp,
                lineHeight = 21.sp,
            )
        } else {
            Text(
                "Kamu bisa ubah preferensi ini kapan pun di Pengaturan → Notifications.",
                color = palette.muted,
                fontSize = 14.sp,
                lineHeight = 21.sp,
            )
        }
        Spacer(Modifier.weight(1f))
        WebButton(
            label = "Masuk ke beranda",
            onClick = onContinue,
            variant = WebButtonVariant.PRIMARY,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
