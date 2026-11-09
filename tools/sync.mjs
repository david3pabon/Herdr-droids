// Install (or update) the droids layout into the Herdr app's home.
//
//   node tools/sync.mjs            copy this folder's layout, themes and mods in
//   node tools/sync.mjs --pull     copy the cloned mods back out of the app home
//                                  (their own files only: mods/droids and the
//                                  vendored kit stay as they are in this folder)
//
// The app hot-reloads every file under ~/.config/herdr-app, so a sync is
// picked up immediately: no restart. Herdr's own layouts and mods are never
// touched; only names starting with "droids" and the two theme files.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.HERDR_APP_HOME ?? join(process.env.HOME ?? "", ".config/herdr-app");

if (!existsSync(home)) {
  console.error(`no Herdr home at ${home}`);
  process.exit(1);
}

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === ".DS_Store" || name === "node_modules") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`  ${relative(root, from)} → ${relative(home, to)}`);
};

const themes = ["themes/droids-dark.json", "themes/droids-light.json"];
const layouts = ["layouts/droids.json"];
const mods = existsSync(join(root, "mods"))
  ? readdirSync(join(root, "mods")).filter((m) => m.startsWith("droids") && statSync(join(root, "mods", m)).isDirectory())
  : [];

// kit.js, droids.js and icons/ are vendored: a mod may not import another
// mod's code, so every droids-* mod carries its own copy of the shared kit.
const sharedFiles = ["kit.js", "droids.js"];
const icons = join(root, "mods/droids/icons");
function vendor() {
  for (const m of readdirSync(join(root, "mods"))) {
    if (!m.startsWith("droids") || m === "droids" || !statSync(join(root, "mods", m)).isDirectory()) continue;
    for (const f of sharedFiles) copyFileSync(join(root, "mods/droids", f), join(root, "mods", m, f));
    mkdirSync(join(root, "mods", m, "icons"), { recursive: true });
    for (const f of walk(icons)) copyFileSync(f, join(root, "mods", m, "icons", relative(icons, f)));
  }
}
vendor();

if (process.argv.includes("--pull")) {
  // Pull the cloned mods out of the app home: they are edited where they run.
  for (const m of mods.filter((name) => name !== "droids")) {
    const src = join(home, "mods", m);
    if (!existsSync(src)) continue;
    for (const f of walk(src)) {
      if (f.endsWith("gpui-kit.d.ts") || f.endsWith("jsconfig.json")) continue;
      const rel = relative(src, f);
      if (sharedFiles.includes(rel) || rel.startsWith("icons/")) continue;
      const to = join(root, relative(home, f));
      if (!existsSync(to) && existsSync(join(icons, rel))) continue; // stray flat copy from an older sync
      copy(f, to);
    }
  }
  console.log("pulled cloned mods out of the app home");
  process.exit(0);
}

for (const rel of [...themes, ...layouts]) {
  const from = join(root, rel);
  if (!existsSync(from)) { console.error(`missing ${rel}`); process.exit(1); }
  copy(from, join(home, rel));
}
for (const m of mods) for (const f of walk(join(root, "mods", m))) copy(f, join(home, relative(root, f)));

console.log(`\ninstalled into ${home}`);
console.log("in the app: ⌃⇧L cycles layouts; or  herdr-app do layout.switch --name droids");
