#!/usr/bin/env node
/**
 * CLI sinkronisasi UNPAM / FTI (tanpa login, tanpa write ke DB).
 *
 * Cara pakai:
 *   node scripts/cli/unpam-sync.mjs [--json] [--source kalender|mentari|pengumuman]
 *
 * Output: daftar event hasil fetch dari ftiunpam.com.
 * Implementasi parser penuh ada di adapter TS; CLI ini baca dari situ via
 * import dinamis setelah build, atau fallback scrape ringan kalender dulu.
 */
const KALENDER_URL = "https://ftiunpam.com/kalender";
const MENTARI_URL = "https://ftiunpam.com/elearning";
const PENGUMUMAN_URL = "https://ftiunpam.com/pengumuman";

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const sourceArg = args[args.indexOf("--source") + 1];

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "StarstaskCLI/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Fetch gagal (${url}): ${res.status}`);
  }

  return res.text();
}

const strip = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function parseKalender(html) {
  const out = [];

  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [
      ...(rowMatch[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi),
    ].map((cell) => strip(cell[1] ?? ""));

    if (cells.length >= 4) {
      out.push({
        title: cells[3],
        startsAt: cells[1],
        endsAt: cells[2],
        sourceUrl: KALENDER_URL,
      });
    }
  }

  return out;
}

function parseMentari(html) {
  const text = strip(html);

  return [
    ...text.matchAll(
      /Periode Daring (\d{2}-\d{2}-\d{4}) s\.d (\d{2}-\d{2}-\d{4})/gi,
    ),
  ].map((match, index) => ({
    title: `Periode Daring MENTARI #${index + 1}`,
    startsAt: match[1],
    endsAt: match[2],
    sourceUrl: MENTARI_URL,
  }));
}

function parsePengumuman(html) {
  return strip(html)
    .split(/INFORMASI /)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      title: `INFORMASI ${block.slice(0, 80)}`,
      startsAt: block.match(/(\d{1,2} \w+ \d{4})/)?.[1] ?? null,
      endsAt: null,
      sourceUrl: PENGUMUMAN_URL,
    }));
}

const runners = {
  kalender: async () => parseKalender(await fetchText(KALENDER_URL)),
  mentari: async () => parseMentari(await fetchText(MENTARI_URL)),
  pengumuman: async () => parsePengumuman(await fetchText(PENGUMUMAN_URL)),
};

const selected =
  sourceArg && runners[sourceArg] ? [sourceArg] : Object.keys(runners);
const all = {};

for (const key of selected) {
  all[key] = await runners[key]();
}

if (jsonOut) {
  console.log(JSON.stringify(all, null, 2));
} else {
  for (const [key, events] of Object.entries(all)) {
    console.log(`\n== ${key} (${events.length}) ==`);

    for (const e of events.slice(0, 10)) {
      console.log(`- ${e.startsAt} : ${e.title}`);
    }
  }
}
