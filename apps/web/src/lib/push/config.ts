import "server-only";

export type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

/**
 * Reads VAPID configuration.
 *
 * Returns `null` unless all three values are present and the subject is a
 * `mailto:` or `https:` URI, which is what push services require. The public
 * key is handed to the browser as a prop; the private key never leaves this
 * module and is never logged.
 */
export function getPushConfig(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  if (!/^(mailto:|https:\/\/)/i.test(subject)) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return getPushConfig() !== null;
}
