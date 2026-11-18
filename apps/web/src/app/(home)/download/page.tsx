import type { Metadata } from "next";
import Link from "next/link";
import { Download, Puzzle, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Downloads — StarsTask",
  description:
    "Download the StarsTask Android app (APK) and the SIAKAD Attendance Injector browser extension for Chrome and Edge.",
  alternates: { canonical: "/download" },
};

const APK_URL =
  "https://github.com/knsiuss/starstask/releases/download/native-v1/StarsTask-android-native-v1.apk";
const APK_SHA256 =
  "f34f9a5ddab2adefc94361e245e691d43e5de519205685430f383456ff8ca727";
const APK_SIZE = "22,456,508 bytes (~21 MB)";

const EXTENSION_URL = "/downloads/starstask-siakad-injector.zip";
const EXTENSION_VERSION = "v0.1.0";

export default function DownloadPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="border-border border-b pb-6">
        <p className="text-accent text-xs font-semibold tracking-wide uppercase">
          Apps &amp; Tools
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Downloads
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Install the native Android app for mobile access, or add the SIAKAD
          Browser Extension to sync class attendance rosters from StarsTask into
          your university portal.
        </p>

        <nav
          aria-label="Download sections"
          className="mt-5 flex flex-wrap gap-2"
        >
          <a
            href="#android"
            className="border-border bg-surface text-foreground hover:border-accent hover:text-accent rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Android App (APK)
          </a>
          <a
            href="#extension"
            className="border-border bg-surface text-foreground hover:border-accent hover:text-accent rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            SIAKAD Browser Extension
          </a>
        </nav>
      </header>

      <div className="mt-8 space-y-10 text-sm leading-relaxed">
        <section
          id="android"
          aria-labelledby="android-heading"
          className="scroll-mt-20 space-y-6"
        >
          <div className="border-border bg-surface rounded-xl border p-6">
            <div className="flex items-start gap-4">
              <span className="bg-accent-soft text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <Smartphone
                  aria-hidden="true"
                  className="h-6 w-6"
                />
              </span>
              <div>
                <h2
                  id="android-heading"
                  className="text-foreground text-base font-semibold"
                >
                  StarsTask Android (native, v1.0.0)
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  versionName 1.0.0 · versionCode 1 · minSdk 26 · targetSdk 36
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Mirrors the StarsTask web workspace. Sideloadable APK signed
                  with the development key.
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

          <div>
            <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
              How to install on Android
            </h3>
            <ol className="text-muted-foreground mt-3 list-decimal space-y-2 pl-5">
              <li>
                Download the APK with your Android browser or file manager.
              </li>
              <li>
                Open the file. When Android asks, allow installation from that
                source (&ldquo;Install unknown apps&rdquo;), then turn it off
                afterwards.
              </li>
              <li>
                If you previously installed another StarsTask debug APK,
                uninstall it first (signature mismatch).
              </li>
              <li>Open StarsTask and sign in with Google.</li>
            </ol>
          </div>
        </section>

        <section
          id="extension"
          aria-labelledby="extension-heading"
          className="border-border scroll-mt-20 space-y-6 border-t pt-10"
        >
          <div className="border-border bg-surface rounded-xl border p-6">
            <div className="flex items-start gap-4">
              <span className="bg-accent-soft text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <Puzzle
                  aria-hidden="true"
                  className="h-6 w-6"
                />
              </span>
              <div>
                <h2
                  id="extension-heading"
                  className="text-foreground text-base font-semibold"
                >
                  StarsTask SIAKAD Injector ({EXTENSION_VERSION})
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Chrome &amp; Microsoft Edge · Manifest V3 · Local-only DOM
                  matching
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Syncs StarsTask meeting attendance into any SIAKAD attendance
                  table using NIM matching, name fallback, 1-click calibration,
                  and preview mode. Your SIAKAD page never leaves your browser.
                </p>
                <Button
                  asChild
                  className="mt-4"
                >
                  <a
                    href={EXTENSION_URL}
                    download="starstask-siakad-injector.zip"
                  >
                    <Download
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    Download Extension (.zip)
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
              How to install &amp; use in Chrome / Edge
            </h3>
            <ol className="text-muted-foreground mt-3 list-decimal space-y-2 pl-5">
              <li>
                Download and extract <code>starstask-siakad-injector.zip</code>{" "}
                into a folder on your computer.
              </li>
              <li>
                Open <code>chrome://extensions</code> (or{" "}
                <code>edge://extensions</code>) and enable{" "}
                <strong className="text-foreground">Developer mode</strong>.
              </li>
              <li>
                Click <strong className="text-foreground">Load unpacked</strong>{" "}
                and select the extracted folder.
              </li>
              <li>
                In StarsTask, open an attendance meeting and click{" "}
                <strong className="text-foreground">Copy Sync Code</strong>{" "}
                (valid for 15 minutes).
              </li>
              <li>
                Open your SIAKAD attendance page, click the StarsTask Injector
                extension icon, paste the code, optionally run{" "}
                <strong className="text-foreground">Preview only</strong> or{" "}
                <strong className="text-foreground">Calibrate This Page</strong>
                , then inject and save on SIAKAD.
              </li>
            </ol>
          </div>
        </section>

        <p className="text-muted-foreground border-border border-t pt-6 text-xs leading-relaxed">
          Security notice: the Android APK is signed with a development
          keystore, and the browser extension runs 100% locally on the active
          SIAKAD tab without sending SIAKAD credentials or HTML to StarsTask
          servers. Questions:{" "}
          <Link
            href="/settings/feedback"
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
