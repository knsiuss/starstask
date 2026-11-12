import type { Metadata } from "next";
import Link from "next/link";
import { Download, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Download StarsTask for Android",
  description:
    "Sideload the native StarsTask Android app. Requires Android 8+ and allows install from unknown sources.",
  alternates: { canonical: "/download" },
};

const APK_URL =
  "https://github.com/knsiuss/starstask/releases/download/native-v1/StarsTask-android-native-v1.apk";
const APK_SHA256 =
  "f34f9a5ddab2adefc94361e245e691d43e5de519205685430f383456ff8ca727";
const APK_SIZE = "22,456,508 bytes (~21 MB)";

export default function DownloadPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="border-border border-b pb-6">
        <p className="text-accent text-xs font-semibold uppercase tracking-wide">
          Android
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Download StarsTask for Android
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          The native app mirrors the StarsTask web workspace. This build is not
          on the Play Store yet — it is a sideloadable APK signed with the same
          development key every debug build uses.
        </p>
      </header>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <div className="border-border bg-surface rounded-xl border p-6">
          <div className="flex items-start gap-4">
            <span className="bg-accent-soft text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
              <Smartphone
                aria-hidden="true"
                className="h-6 w-6"
              />
            </span>
            <div>
              <h2 className="text-foreground text-base font-semibold">
                StarsTask Android (native, v1.0)
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                versionName 1.0 · versionCode 1 · minSdk 26 · targetSdk 36
              </p>
              <Button
                asChild
                className="mt-4"
              >
                <a
                  href={APK_URL}
                  download
                >
                  <Download
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Download APK
                </a>
              </Button>
              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                {APK_SIZE} · SHA-256:{" "}
                <code className="break-all">{APK_SHA256}</code>
              </p>
            </div>
          </div>
        </div>

        <section>
          <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            How to install
          </h2>
          <ol className="text-muted-foreground mt-3 list-decimal space-y-2 pl-5">
            <li>Download the APK with your Android browser or file manager.</li>
            <li>
              Open the file. When Android asks, allow installation from that
              source ("Install unknown apps") — you can turn it off afterwards.
            </li>
            <li>
              If you previously installed another StarsTask debug APK, uninstall
              it first (signature mismatch).
            </li>
            <li>Open StarsTask and sign in with Google.</li>
          </ol>
        </section>

        <p className="text-muted-foreground text-xs leading-relaxed">
          Security notice: this APK is signed with a development (debug)
          keystore, not the production Play Store key. Treat it as a beta
          build. If you see a signature mismatch, the APK you installed before
          came from a different key — uninstall the old app and install this
          one again. Questions: {""}
          <Link
            href="/feedback"
            className="text-accent font-medium underline underline-offset-2"
          >
            send feedback
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
