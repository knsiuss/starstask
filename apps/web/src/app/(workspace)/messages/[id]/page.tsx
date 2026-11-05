import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The chat pane now lives inside the three-column /messages shell. */
export default function ChatLegacyPage(): never {
  redirect("/messages");
}
