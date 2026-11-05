"use client";

/** Notifikasi grouping per hari — assignment + attendance digabung per hari biar tidak spam. */
export type DigestItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export function groupByDay(items: DigestItem[]): Map<string, DigestItem[]> {
  const groups = new Map<string, DigestItem[]>();
  for (const item of items) {
    const day = item.createdAt.slice(0, 10);
    const list = groups.get(day) ?? [];
    list.push(item);
    groups.set(day, list);
  }
  return groups;
}

export function digestTitle(count: number): string {
  return count === 1 ? "1 notifikasi hari ini" : `${count} notifikasi hari ini`;
}
