/**
 * Public site configuration.
 *
 * `NEXT_PUBLIC_CONTACT_EMAIL` is optional. When it is unset, legal pages do not
 * render a mailto link rather than inventing an address that nobody reads.
 */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
