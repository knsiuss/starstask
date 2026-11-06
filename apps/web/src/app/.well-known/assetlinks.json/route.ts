import { NextResponse } from "next/server";

/**
 * Digital Asset Links for the TWA Android app (Bubblewrap).
 * Lets the Android app open starstask.aphelionlabs.tech links in-app
 * without a Custom Tab redirect. Fingerprint is the SHA-256 of the
 * TWA signing certificate (see .starstask-twa keystore notes).
 */
export function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "id.starstask.mobile",
          sha256_cert_fingerprints: [
            "D5:B4:DB:CF:D9:5A:22:D0:00:CF:DB:96:A3:75:88:A1:21:0C:07:11:AA:AB:8E:FD:AA:93:64:E3:55:1A:0D:DB",
          ],
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
