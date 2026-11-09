import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "id.starstask.mobile"
    compileSdk = 36

    defaultConfig {
        applicationId = "id.starstask.mobile"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        // Supabase public credentials from local.properties (gitignored).
        // Falls back to placeholders so a fresh clone still configures.
        val localProps = Properties().apply {
            val file = rootProject.file("local.properties")
            if (file.exists()) {
                file.inputStream().use { load(it) }
            }
        }
        buildConfigField(
            "String",
            "SUPABASE_URL",
            "\"${localProps.getProperty("starstask.supabase.url", "https://your-project-ref.supabase.co")}\""
        )
        buildConfigField(
            "String",
            "SUPABASE_PUBLISHABLE_KEY",
            "\"${localProps.getProperty("starstask.supabase.publishableKey", "your-publishable-key")}\""
        )
        buildConfigField(
            "String",
            "SITE_URL",
            "\"${localProps.getProperty("starstask.site.url", "https://your-site.example.com")}\""
        )
        buildConfigField(
            "String",
            "GOOGLE_WEB_CLIENT_ID",
            "\"${localProps.getProperty("starstask.google.webClientId", "TODO_WEB_CLIENT_ID")}\""
        )
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.10.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.2")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation(platform("io.github.jan-tennert.supabase:bom:3.0.2"))
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:storage-kt")
    implementation("io.github.jan-tennert.supabase:realtime-kt")
    implementation("io.ktor:ktor-client-android:3.4.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("androidx.navigation:navigation-compose:2.9.3")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation(platform("com.google.firebase:firebase-bom:35.1.0"))
    implementation("com.google.firebase:firebase-crashlytics")
    implementation("com.google.firebase:firebase-messaging")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
