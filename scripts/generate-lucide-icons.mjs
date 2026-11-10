#!/usr/bin/env node
/**
 * Generates Kotlin ImageVector definitions for the Lucide icons used by the web
 * app, so the native Android UI renders the identical glyphs.
 *
 * Data source: lucide-react inside the pnpm store (pinned by the workspace
 * lockfile, so the generated output is reproducible). Only icons actually
 * imported by apps/web/src/components, apps/web/src/features and apps/web/src/app
 * are emitted.
 *
 * Output: apps/mobile/android/app/src/main/java/id/starstask/mobile/ui/icons/Lucide.kt
 *
 * Usage: node scripts/generate-lucide-icons.mjs [--check]
 *   --check exits non-zero when the generated file differs from what is on disk.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(
  repoRoot,
  "apps/mobile/android/app/src/main/java/id/starstask/mobile/ui/icons/Lucide.kt",
);
const checkOnly = process.argv.includes("--check");

const require = createRequire(import.meta.url);

function findLucideDir() {
  const pnpmStore = path.join(repoRoot, "node_modules/.pnpm");
  for (const entry of readdirSync(pnpmStore)) {
    if (!entry.startsWith("lucide-react@")) continue;
    const candidate = path.join(
      pnpmStore,
      entry,
      "node_modules/lucide-react/dist/esm/icons",
    );
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("lucide-react not found in node_modules/.pnpm; run pnpm install first.");
}

const ICON_DIRS = [
  "apps/web/src/components",
  "apps/web/src/features",
  "apps/web/src/app",
];

// Material Icons used by the native app that have no exact Lucide namesake in the
// list above. These are generated so every existing call site has an equivalent
// Lucide-styled glyph. The mapping is the platform-standard Material → Lucide
// naming used by lucide's own material migration guide.
const MATERIAL_FALLBACK = {
  Add: "Plus",
  ArrowBack: "ArrowLeft",
  ArrowForward: "ArrowRight",
  Close: "X",
  School: "GraduationCap",
  CalendarMonth: "CalendarDays",
  DateRange: "CalendarRange",
  Schedule: "CalendarClock",
  Event: "CalendarDays",
  EventAvailable: "CalendarCheck",
  Warning: "TriangleAlert",
  Dashboard: "LayoutDashboard",
  Description: "FileText",
  List: "List",
  Assignment: "ClipboardList",
  CheckCircle: "CircleCheck",
  ChatBubble: "MessageCircle",
  MailOutline: "Mail",
  LocationOn: "MapPin",
  KeyboardArrowDown: "ChevronDown",
  ChevronRight: "ChevronRight",
  ExitToApp: "LogOut",
  OpenInNew: "ExternalLink",
  AttachFile: "Paperclip",
  AddPhotoAlternate: "ImagePlus",
  CameraAlt: "Camera",
  Notifications: "Bell",
  Person: "User",
  PersonAdd: "UserPlus",
  Group: "Users",
  GridView: "LayoutGrid",
  Refresh: "RefreshCw",
  Cancel: "XCircle",
  Star: "Star",
  TrendingUp: "TrendingUp",
  Delete: "Trash2",
  Edit: "Pencil",
  Settings: "Settings",
  Shield: "Shield",
  PenLine: "PenLine",
  Send: "Send",
  Search: "Search",
  Info: "Info",
  LightMode: "Sun",
  DarkMode: "Moon",
  Menu: "Menu",
  UsersRound: "UsersRound",
  FilePenLine: "FilePenLine",
};

function collectUsedIconNames() {
  const names = new Set();
  const importRe =
    /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g;
  const files = [];
  for (const dir of ICON_DIRS) {
    const base = path.join(repoRoot, dir);
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".next") walk(full);
          continue;
        }
        if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
      }
    };
    walk(base);
  }
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(importRe)) {
      for (const part of match[1].split(",")) {
        const name = part.trim();
        if (!name || name === "type") continue;
        if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) continue;
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .toLowerCase();
}

// Resolve the real file for an icon name, following re-export shims
// (for example `alert-triangle.mjs` re-exports `triangle-alert.mjs`).
function resolveIconFile(dir, kebab) {
  let file = path.join(dir, `${kebab}.mjs`);
  if (!existsSync(file)) return null;
  let src = readFileSync(file, "utf8");
  const reexport = src.match(/export\s*\{\s*default\s*\}\s*from\s*['"]\.\/([^'"]+)\.mjs['"]/);
  if (reexport) {
    file = path.join(dir, `${reexport[1]}.mjs`);
    src = readFileSync(file, "utf8");
  }
  return src;
}

function parseIconData(src) {
  // Extract the `node: [...]` array from __iconData.
  const start = src.indexOf("node: [");
  if (start === -1) return null;
  const from = src.indexOf("[", start);
  // Balance brackets while skipping string literals.
  let depth = 0;
  let inStr = false;
  let escape = false;
  let end = -1;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  const literal = src.slice(from, end + 1);
  return Function(`"use strict"; return (${literal});`)();
}

// Convert one SVG element into a Kotlin code fragment.
function attrsToKotlin(attrs) {
  const out = [];
  const num = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0f";
    return Number.isInteger(n) ? `${n}f` : `${n}f`;
  };
  for (const [key, raw] of Object.entries(attrs)) {
    const value = String(raw);
    switch (key) {
      case "d":
        out.push(`pathData = PathParser().parsePathString("${value}").toNodes()`);
        break;
      case "cx":
      case "cy":
      case "r": {
        out.push(
          `pathData = PathParser().parsePathString(arcPath(${num(attrs.cx)}, ${num(attrs.cy)}, ${num(attrs.r)})).toNodes()`,
        );
        return out;
      }
      case "x":
      case "y":
      case "width":
      case "height":
      case "rx":
      case "ry": {
        const x = Number(attrs.x ?? 0);
        const y = Number(attrs.y ?? 0);
        const w = Number(attrs.width ?? 0);
        const h = Number(attrs.height ?? 0);
        const rx = Number(attrs.rx ?? Math.min(w, h) / 2);
        const ry = Number(attrs.ry ?? rx);
        if (rx > 0 && ry > 0 && rx !== w / 2) {
          out.push(
            `pathData = PathParser().parsePathString(roundedRectPath(${num(x)}, ${num(y)}, ${num(w)}, ${num(h)}, ${num(rx)}, ${num(ry)})).toNodes()`,
          );
        } else {
          out.push(
            `pathData = listOf(\n                    MoveTo(${num(x)}, ${num(y)}),\n                    LineTo(${num(x + w)}, ${num(y)}),\n                    LineTo(${num(x + w)}, ${num(y + h)}),\n                    LineTo(${num(x)}, ${num(y + h)}),\n                    Close,\n                )`,
          );
        }
        return out;
      }
      case "x1":
      case "y1":
      case "x2":
      case "y2": {
        out.push(
          `pathData = listOf(\n                    MoveTo(${num(attrs.x1)}, ${num(attrs.y1)}),\n                    LineTo(${num(attrs.x2)}, ${num(attrs.y2)}),\n                )`,
        );
        return out;
      }
      case "points": {
        const pts = value
          .trim()
          .split(/\s+/)
          .map((p) => p.split(",").map(Number));
        const body = pts
          .map((p, i) => `                    ${i === 0 ? "MoveTo" : "LineTo"}(${num(p[0])}, ${num(p[1])}),`)
          .join("\n");
        out.push(`pathData = listOf(\n${body}\n                )`);
        return out;
      }
      default:
        break;
    }
  }
  return out;
}

function nodeToKotlin([tag, attrs]) {
  const fragments = attrsToKotlin(attrs);
  if (fragments.length === 0) return null;
  return `                addPath(\n                    ${fragments.join(",\n                    ")},\n                    stroke = strokeSpec,\n                    strokeLineWidth = 2f,\n                    strokeLineCap = StrokeCap.Round,\n                    strokeLineJoin = StrokeJoin.Round,\n                    strokeLineMiter = 4f,\n                    pathFillType = PathFillType.NonZero,\n                )`;
}

function generate() {
  const iconsDir = findLucideDir();
  const names = collectUsedIconNames();
  // Include Material fallback names that are not already in the web set.
  for (const fallback of Object.values(MATERIAL_FALLBACK)) {
    if (!names.includes(fallback)) names.push(fallback);
  }
  names.sort();
  const blocks = [];
  const skipped = [];
  const multiElement = [];

  for (const name of names) {
    const kebab = toKebab(name);
    const src = resolveIconFile(iconsDir, kebab);
    if (!src) {
      skipped.push(`${name} (${kebab}.mjs not found)`);
      continue;
    }
    const nodes = parseIconData(src);
    if (!nodes) {
      skipped.push(`${name} (could not parse __iconData)`);
      continue;
    }
    const rendered = nodes.map(nodeToKotlin).filter(Boolean);
    if (rendered.length === 0) {
      skipped.push(`${name} (no renderable nodes)`);
      continue;
    }
    if (rendered.length > 1) multiElement.push(name);
    blocks.push(
      `    val ${name}: ImageVector by lazy {\n        ImageVector.Builder(\n            name = "${name}",\n            defaultWidth = 24.dp,\n            defaultHeight = 24.dp,\n            viewportWidth = 24f,\n            viewportHeight = 24f,\n        ).apply {\n${rendered.join("\n")}\n        }.build()\n    }\n`,
    );
  }

  const header = [
    "package id.starstask.mobile.ui.icons",
    "",
    "import androidx.compose.ui.graphics.Color",
    "import androidx.compose.ui.graphics.PathFillType",
    "import androidx.compose.ui.graphics.SolidColor",
    "import androidx.compose.ui.graphics.StrokeCap",
    "import androidx.compose.ui.graphics.StrokeJoin",
    "import androidx.compose.ui.graphics.vector.ImageVector",
    "import androidx.compose.ui.graphics.vector.PathNode.Close",
    "import androidx.compose.ui.graphics.vector.PathNode.LineTo",
    "import androidx.compose.ui.graphics.vector.PathNode.MoveTo",
    "import androidx.compose.ui.graphics.vector.PathParser",
    "import androidx.compose.ui.unit.dp",
    "",
    "/**",
    " * Generated by scripts/generate-lucide-icons.mjs — do not edit by hand.",
    " * Icon geometry comes from lucide-react (ISC License, see",
    " * https://github.com/lucide-icons/lucide). Web and native render the same",
    " * glyphs: 24x24 viewport, 2dp stroke, round caps and joins, transparent fill.",
    " *",
    " * Re-run the generator after updating the web dependency:",
    " *   node scripts/generate-lucide-icons.mjs",
    " */",
    "",
    "private val strokeSpec = SolidColor(Color.Black)",
    "",
    "private fun arcPath(cx: Float, cy: Float, r: Float): String =",
    "    \"M ${cx - r} $cy a $r $r 0 1 0 ${r * 2} 0 a $r $r 0 1 0 ${-r * 2} 0\"",
    "",
    "private fun roundedRectPath(",
    "    x: Float,",
    "    y: Float,",
    "    w: Float,",
    "    h: Float,",
    "    rx: Float,",
    "    ry: Float,",
    "): String =",
    "    \"M ${x + rx} $y h ${w - rx * 2} a $rx $ry 0 0 1 $rx $ry v ${h - ry * 2} a $rx $ry 0 0 1 ${-rx} $ry h ${-w + rx * 2} a $rx $ry 0 0 1 ${-rx} ${-ry} v ${-h + ry * 2} a $rx $ry 0 0 1 $rx ${-ry} z\"",
    "",
  ];

  const fallbackAliases = Object.entries(MATERIAL_FALLBACK)
    .map(([material, lucide]) => `    val ${material}: ImageVector get() = Lucide.${lucide}\n`)
    .join("");

  const body = [
    "",
    "/** Stroke/shade helpers, mirroring lucide currentColor strokes. */",
    "",
    "object Lucide {",
    ...blocks,
    "}",
    "",
    "/**",
    " * Compatibility aliases for call sites written against Material Icons.",
    " * Each alias points at the Lucide glyph in the table above so existing",
    " * screens get the web glyph without a rename at every usage.",
    " */",
    "object MaterialIconAliases {",
    fallbackAliases.trimEnd(),
    "}",
    "",
  ];

  if (skipped.length) {
    process.stderr.write(`skipped ${skipped.length} icon(s):\n${skipped.join("\n")}\n`);
  }
  if (multiElement.length) {
    process.stderr.write(
      `icons with multiple path elements: ${multiElement.join(", ")}\n`,
    );
  }

  return [...header, ...body].join("\n");
}

const generated = generate();

if (checkOnly) {
  const current = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
  if (current !== generated) {
    process.stderr.write(`check failed: ${outPath} is stale. Re-run the generator.\n`);
    process.exit(1);
  }
  process.stdout.write(`check passed: ${outPath}\n`);
} else {
  writeFileSync(outPath, generated, "utf8");
  process.stdout.write(`wrote ${outPath}\n`);
}
