// Browser preview of the droids layout.
//
// Renders layouts/droids.json's region tree at its real sizes with the real
// theme colors, and draws droids from the same spec tree mods/droids/droids.js
// gives the app (preview/build.mjs regenerates data.js from it).
const DATA = globalThis.HERDR_DATA;

const state = {
  appearance: matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
  panel: "files",
  demo: true,
  view: "window",
  folded: new Set(),
};

const AGENTS = [
  { kind: "astromech", name: "Claude Code", task: "fixing retry backoff in the lane client", space: "hyperlane", state: "working", dur: "4m",
    subs: [{ kind: "probe", name: "codex · review the diff", state: "working" }, { kind: "utility", name: "opencode · run the suite", state: "idle" }] },
  { kind: "probe", name: "Codex", task: "waiting on approval to push", space: "hyperlane", state: "blocked", dur: "12m", pinned: true },
  { kind: "pod", name: "pi", task: "splitting holonet.rs into modules", space: "droid-maker", state: "working", dur: "1m" },
  { kind: "protocol", name: "Kimi Code", task: "wrote tests for jump coordinates", space: "holocron", state: "done", dur: "just now" },
  { kind: "utility", name: "OpenCode", task: "in the bay, nothing queued", space: "holocron", state: "idle", dur: "2h" },
];
const SPACES = [
  { name: "hyperlane", branch: "main", tabs: 3, state: "blocked", active: true },
  { name: "droid-maker", branch: "feat/pods", tabs: 2, state: "working" },
  { name: "holocron", branch: "fix/jump", tabs: 4, state: "done" },
];

const el = (tag, cls, style) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  return e;
};
const hex = (c) => (typeof c === "string" && c.startsWith("#") ? c : c ?? "transparent");

// ---- spec tree -> DOM, with CSS keyframes standing in for .loop()

let kfSeq = 0;
const kfRules = new Map();

const styleSheets = document.createElement("style");
document.head.appendChild(styleSheets);
const frameAnims = [];

function applyAnim(node, e) {
  const a = node.anim;
  if (!a) return;
  const key = JSON.stringify(a);
  let name = kfRules.get(key);
  if (!name) {
    name = `kf${kfSeq++}`;
    const unit = a.p === "opacity" ? "" : "px";
    kfRules.set(key, name);
    frameAnims.push(`@keyframes ${name}{from{${a.p}:${a.from}${unit}}to{${a.p}:${a.to}${unit}}}`);
  }
  e.style.animation = `${name} ${(a.period ?? 1000) / 2}ms ${a.easing ?? "ease-in-out"} infinite alternate`;
}

const frameTexts = [];
function nodeToDom(node) {
  const e = el("div", "nd");
  const ap = state.appearance;
  const s = e.style;
  s.left = `${node.x ?? 0}px`;
  s.top = `${node.y ?? 0}px`;
  if (node.w != null) s.width = `${node.w}px`;
  if (node.h != null) s.height = `${node.h}px`;
  if (node.op != null) s.opacity = node.op;
  if (node.n === "t") {
    e.textContent = node.t ?? "";
    s.fontSize = `${node.size ?? 8}px`;
    s.color = hex(node.color);
    s.fontWeight = node.weight ?? 500;
    s.fontFamily = node.mono ? "var(--mono)" : "var(--ui)";
    s.lineHeight = `${(node.size ?? 8) * 1.15}px`;
    s.whiteSpace = "pre";
    if (node.w) s.width = `${node.w}px`;
    if (node.align) s.textAlign = node.align;
    if (node.frames) frameTexts.push({ e, frames: node.frames, ms: node.ms ?? 700 });
  } else {
    if (node.bg && node.bg !== "transparent") s.background = hex(node.bg);
    if (node.bd) {
      s.border = `${node.bd[0]}px solid ${hex(node.bd[1])}`;
      s.boxSizing = "border-box";
    }
    const r = (v) => (v == null ? null : `${v}px`);
    if (node.r != null) s.borderRadius = r(node.r);
    if (node.rt != null || node.rb != null) {
      const top = r(node.rt ?? node.r ?? 0), bottom = r(node.rb ?? node.r ?? 0);
      s.borderRadius = `${top} ${top} ${bottom} ${bottom}`;
    }
  }
  applyAnim(node, e);
  for (const c of node.children ?? []) e.appendChild(nodeToDom(c));
  return e;
}

// A droid: the built spec tree for kind+state, scaled into a box.
function droidNode(kind, st, opts = {}) {
  const tree = DATA.droids[kind]?.[st]?.[state.appearance] ?? DATA.droids.cradle[state.appearance];
  const k = opts.scale ?? 1;
  const wrap = el("div", "droid");
  wrap.style.width = `${(opts.w ?? tree.w) * k}px`;
  wrap.style.height = `${(opts.h ?? tree.h) * k}px`;
  const body = nodeToDom(globalThis.HERDR_SCALE(tree, k));
  body.style.left = `${(opts.ox ?? 0) * k}px`;
  body.style.top = `${(opts.oy ?? 0) * k}px`;
  wrap.appendChild(body);
  return wrap;
}

// ---- small themed bits

function lamp(color, pulse) {
  const e = el("div", "lamp");
  e.style.background = color;
  if (pulse) e.style.animation = `blink ${pulse}ms ease-in-out infinite alternate`;
  return e;
}

function holo(label, sub, right, left) {
  const h = el("div", "panelhead");
  if (left) h.appendChild(left);
  const d = el("div", "panelhead-t");
  d.textContent = label;
  h.appendChild(d);
  if (sub) {
    const s = el("div", "panelhead-s");
    s.textContent = sub;
    h.appendChild(s);
  }
  h.appendChild(el("div", "fill"));
  if (right) h.appendChild(right);
  return h;
}

// ---- regions

function brand() {
  const t = DATA.themes[state.appearance];
  const w = el("div", "brand");
  const lights = el("div", "lights");
  for (const c of ["#ff5f57", "#febc2e", "#28c840"]) lights.appendChild(el("i", "", { background: c }));
  w.appendChild(lights);
  const stars = el("div", "stars");
  for (let i = 0; i < 26; i++) {
    const s = el("div", "star");
    s.style.left = `${Math.round(Math.random() * 100)}%`;
    s.style.top = `${Math.round(Math.random() * 100)}%`;
    s.style.width = s.style.height = `${Math.random() < 0.75 ? 1 : 2}px`;
    s.style.animation = `twinkle ${2000 + Math.random() * 3000}ms ease-in-out ${Math.round(Math.random() * 2000)}ms infinite alternate`;
    stars.appendChild(s);
  }
  w.appendChild(stars);
  const mark = el("div", "brand-mark");
  mark.style.color = t.holo;
  mark.textContent = "◈";
  w.appendChild(mark);
  const txt = el("div", "brand-txt");
  const a = el("div", "brand-a");
  a.textContent = "HERDR";
  const b = el("div", "brand-b");
  b.textContent = "droid command";
  b.style.color = t.dim;
  txt.appendChild(a);
  txt.appendChild(b);
  w.appendChild(txt);
  w.appendChild(el("div", "fill"));
  for (const s of ["⌕", "▯"]) {
    const icon = el("div", "iconbtn sm");
    icon.textContent = s;
    w.appendChild(icon);
  }
  return w;
}

function spacesPanel() {
  const t = DATA.themes[state.appearance];
  const box = el("div", "panel");
  box.appendChild(holo("SPACES", "fleet"));
  const list = el("div", "list");
  for (const s of SPACES) {
    const row = el("div", `row${s.active ? " on" : ""}`);
    row.appendChild(lamp(t[s.state], s.state === "working" ? 520 : s.state === "blocked" ? 300 : 0));
    const nm = el("div", "row-n");
    nm.textContent = s.name;
    row.appendChild(nm);
    const br = el("div", "row-x");
    br.textContent = `⌥ ${s.branch}`;
    row.appendChild(br);
    const n = el("div", "row-c");
    n.textContent = String(s.tabs);
    row.appendChild(n);
    list.appendChild(row);
  }
  box.appendChild(list);
  return box;
}

function agentsPanel() {
  const t = DATA.themes[state.appearance];
  const box = el("div", "panel agents");
  const right = el("div", "sortbtn");
  right.textContent = "⇅";
  box.appendChild(holo("AGENTS", "droid bays", right));
  const list = el("div", "list droidlist");
  const drawn = [];
  const bayRow = (a) => {
    const row = el("div", `row drow${a.focus ? " on" : ""}`);
    const bay = el("div", `bay${a.pinned ? " pinned" : ""}`);
    bay.appendChild(droidNode(a.kind, a.state, { scale: 0.62 }));
    row.appendChild(bay);
    const info = el("div", "dinfo");
    const top = el("div", "dtop");
    top.textContent = a.name;
    const sub = el("div", "dsub");
    sub.textContent = a.task;
    info.appendChild(top);
    info.appendChild(sub);
    const meta = el("div", "dmeta");
    const chip = el("div", "chip");
    chip.textContent = a.state === "blocked" ? "needs you" : a.state;
    chip.style.color = t[a.state];
    chip.style.borderColor = t[a.state] + "55";
    chip.style.background = t[a.state] + "14";
    const sp = el("div", "dsp");
    sp.textContent = `${a.space} · ${a.dur}`;
    meta.appendChild(chip);
    meta.appendChild(sp);
    info.appendChild(meta);
    row.appendChild(info);
    const right = el("div", "dright");
    if ((a.subs ?? []).length) {
      const ch = el("div", "fold");
      ch.textContent = state.folded.has(a.name) ? "\u203a" : "\u2039";
      ch.title = `${a.subs.length} sub-agent(s)`;
      right.appendChild(ch);
    }
    const pn = el("div", `pinmark${a.pinned ? " on" : ""}`);
    pn.textContent = "\u2363";
    right.appendChild(pn);
    right.appendChild(lamp(t[a.state], a.state === "working" ? 520 : a.state === "blocked" ? 300 : 0));
    row.appendChild(right);
    drawn.push(row);
    for (const [i, k] of (a.subs ?? []).entries()) {
      if (state.folded.has(a.name)) continue;
      const sub = el("div", "row subrow");
      const lines = el("div", "treelines");
      lines.appendChild(el("div", i === a.subs.length - 1 ? "tee" : "elbow"));
      sub.appendChild(lines);
      const sd = el("div", "subd");
      sd.appendChild(droidNode(k.kind, k.state, { scale: 0.27 }));
      sub.appendChild(sd);
      const nm = el("div", "row-n");
      nm.textContent = k.name;
      sub.appendChild(nm);
      sub.appendChild(lamp(t[k.state], k.state === "working" ? 520 : 0));
      drawn.push(sub);
    }
  };
  const groups = [];
  const pinned = AGENTS.filter((a) => a.pinned);
  if (pinned.length) groups.push({ label: "Pinned berths", pin: true, members: pinned });
  for (const a of AGENTS) {
    if (a.pinned) continue;
    const rank = { blocked: 4, done: 3, working: 2, idle: 1 }[a.state];
    const label = { 4: "Needs you", 3: "Done", 2: "Working", 1: "Idle" }[rank];
    if (groups.at(-1)?.label === label) groups.at(-1).members.push(a);
    else groups.push({ label, status: a.state, members: [a] });
  }
  for (const g of groups) {
    const gh = el("div", "grouph");
    if (g.status) gh.appendChild(lamp(t[g.status], 0));
    if (g.pin) {
      const p = el("span", "pinmark on");
      p.textContent = "\u2363";
      gh.appendChild(p);
    }
    const lab = el("span");
    lab.textContent = g.label;
    gh.appendChild(lab);
    const n = el("span", "gn");
    n.textContent = String(g.members.length);
    gh.appendChild(n);
    gh.appendChild(el("div", "gline"));
    drawn.push(gh);
    for (const a of g.members) bayRow(a);
  }
  list.append(...drawn);
  box.appendChild(list);
  return box;
}

// The depot: a drawer on the right edge of the work area that shows only its
// edge strip until the pointer comes near, like the layout's `peek` block.
function depotPanel() {
  const t = DATA.themes[state.appearance];
  const box = el("div", "depot");
  const order = { blocked: 4, done: 3, working: 2, idle: 1 };
  const list = [...AGENTS].sort((a, b) => order[b.state] - order[a.state]);
  const head = el("div", "grouph depothead");
  head.appendChild(Object.assign(document.createElement("span"), { textContent: "DEPOT" }));
  const n = el("span", "gn");
  n.textContent = String(list.length);
  head.appendChild(n);
  head.appendChild(el("div", "gline"));
  box.appendChild(head);
  for (const a of list) {
    const r = el("div", "row deprow");
    const info = el("div", "dinfo");
    const top = el("div", "dtop");
    top.textContent = a.name;
    const sub = el("div", "dsub");
    sub.textContent = [a.space, a.state === "blocked" ? "needs you" : ""].filter(Boolean).join(" \u00b7 ");
    sub.style.fontSize = "10.5px";
    info.appendChild(top);
    info.appendChild(sub);
    r.appendChild(info);
    const d = el("div", "depd");
    d.appendChild(droidNode(a.kind, a.state, { scale: 0.42, oy: -1 }));
    r.appendChild(d);
    r.appendChild(lamp(t[a.state], a.state === "working" ? 520 : a.state === "blocked" ? 300 : 0));
    box.appendChild(r);
  }
  return box;
}

function footer() {
  const t = DATA.themes[state.appearance];
  const f = el("div", "footer");
  const d = el("div", "foot-line");
  d.innerHTML = `<span style="color:${t.holo}">◈</span> ${AGENTS.length} droids docked`;
  const k = el("div", "foot-keys");
  k.innerHTML = `<b>⌘⇧L</b> layout · <b>⌘B</b> rail`;
  const text = el("div", "foot-text");
  text.append(d, k);
  f.appendChild(text);
  for (const s of ["⚙", "+"]) {
    const icon = el("div", "iconbtn sm");
    icon.textContent = s;
    f.appendChild(icon);
  }
  return f;
}

function tabBar() {
  const t = DATA.themes[state.appearance];
  const bar = el("div", "tabbar");
  const wrap = el("div", "tabs");
  const tabs = [
    { n: "fix retry", kind: "astromech", st: "working", on: true, z: false },
    { n: "lane client", kind: "probe", st: "blocked", on: false },
    { n: "pods", kind: "pod", st: "working", on: false },
    { n: "notes", kind: null, st: null, on: false },
  ];
  for (const tb of tabs) {
    const p = el("div", `pill${tb.on ? " on" : ""}`);
    if (tb.kind) {
      const g = el("div", "pill-d");
      g.appendChild(droidNode(tb.kind, tb.st, { scale: 0.34, oy: -1 }));
      p.appendChild(g);
    } else {
      const s = el("div", "pill-s");
      s.textContent = "▮";
      s.style.color = t.dim;
      p.appendChild(s);
    }
    const nm = el("div", "pill-n");
    nm.textContent = tb.n + (tb.z ? " Z" : "");
    p.appendChild(nm);
    if (tb.st === "blocked") p.appendChild(lamp(t.blocked, 300));
    if (tb.st === "working") {
      const sp = el("div", "pill-spin");
      sp.style.borderColor = t.working;
      p.appendChild(sp);
    }
    if (tb.on) {
      const x = el("div", "pill-x");
      x.textContent = "✕";
      p.appendChild(x);
    }
    wrap.appendChild(p);
  }
  bar.appendChild(wrap);
  const add = el("div", "iconbtn");
  add.textContent = "+";
  bar.appendChild(add);
  for (const [id, label] of [["files", "Files"], ["changes", "Changes"]]) {
    const b = el("div", `panelbtn${state.panel === id && state.panelOpen ? " on" : ""}`);
    b.textContent = label;
    b.onclick = () => {
      state.panel = id;
      state.panelOpen = true;
      draw();
    };
    bar.appendChild(b);
  }
  const lights = el("div", "winbtns");
  for (const s of ["—", "□", "✕"]) {
    const b = el("div", "winbtn");
    b.textContent = s;
    lights.appendChild(b);
  }
  bar.appendChild(lights);
  return bar;
}

const TERM = (t) => [
  [{ c: "accent", s: "❯" }, { c: "fg", s: " claude \"fix the retry backoff in the hyperlane client\"" }],
  [],
  [{ c: "working", s: "● working " }, { c: "muted", s: "reading src/lane/retry.ts, src/lane/holonet.ts" }],
  [{ c: "dim", s: "  ⎿  Read 3 files · edited src/lane/retry.ts" }],
  [{ c: "dim", s: "  ⎿  Ran npm test — 42 passed, 0 failed" }],
  [],
  [{ c: "working", s: "● working " }, { c: "muted", s: "backoff now follows the lane's RTT; adding a test for the timeout ceiling" }],
  [{ c: "dim", s: "    src/lane/retry.ts" }],
  [{ c: "ansi1", s: "    - const MAX = 4_000;" }, { c: "fg", s: " MAX_BACKOFF, derived from rtt" }],
  [{ c: "ansi2", s: "    + const MAX_BACKOFF = Math.min(rtt * 8, 4_000);" }],
  [{ c: "ansi2", s: "    + const CEILING_TESTS = true;" }],
  [],
  [{ c: "accent", s: "❯" }, { c: "muted", s: " esc to interrupt · ⌃⌥⏎ accepts on your side" }],
];

function terminalMock() {
  const t = DATA.themes[state.appearance];
  const card = el("div", "panecard on");
  const focus = AGENTS[0];
  const head = el("div", "panehead");
  head.appendChild(droidNode(focus.kind, focus.state, { scale: 0.36, oy: -1 }));
  const nm = el("div", "panehead-n");
  nm.textContent = "fix retry";
  head.appendChild(nm);
  const cw = el("div", "panehead-x");
  cw.textContent = "~/work/hyperlane · main";
  cw.style.color = t.dim;
  head.appendChild(cw);
  const st = el("div", "chip");
  st.textContent = focus.state;
  st.style.color = t[focus.state];
  st.style.borderColor = t[focus.state] + "55";
  head.appendChild(st);
  for (const s of ["◫", "⬓", "⤢", "✕"]) {
    const b = el("div", "iconbtn sm");
    b.textContent = s;
    head.appendChild(b);
  }
  card.appendChild(head);
  const body = el("div", "term");
  for (const line of TERM(t)) {
    const l = el("div", "tl");
    if (!line.length) {
      l.appendChild(document.createTextNode("\u00a0"));
    } else {
      for (const seg of line) {
        const s = el("span");
        s.textContent = seg.s;
        s.style.color = t[seg.c] ?? t.fg;
        l.appendChild(s);
      }
    }
    body.appendChild(l);
  }
  const caret = el("span", "caret");
  caret.style.background = t.cursor;
  body.lastChild?.appendChild(caret);
  card.appendChild(body);
  const rail = el("div", "scrollrail");
  const thumb = el("div", "scrollthumb");
  thumb.style.background = t.input;
  rail.appendChild(thumb);
  card.appendChild(rail);
  return card;
}

function filesPanel() {
  const t = DATA.themes[state.appearance];
  const box = el("div", "panel card files");
  box.appendChild(holo("FILES", "hyperlane", null, droidNode("utility", "idle", { scale: 0.32, oy: -1 })));
  const tree = el("div", "tree");
  const rows = [
    ["", 1, "src", "d", ""],
    ["", 2, "lane", "d", ""],
    ["", 3, "retry.ts", "f", "M"],
    ["", 3, "holonet.ts", "f", "M"],
    ["", 3, "jump.rs", "f", ""],
    ["", 2, "agents", "d", ""],
    ["", 3, "astromech.ts", "f", "A"],
    ["", 3, "probe.ts", "f", ""],
    ["", 1, "tests", "d", ""],
    ["", 2, "retry.test.ts", "f", "M"],
    ["", 1, "package.json", "f", ""],
    ["", 1, "README.md", "f", ""],
  ];
  for (const [, depth, name, kind, mark] of rows) {
    const r = el("div", "trow");
    r.style.paddingLeft = `${8 + depth * 16}px`;
    const ch = el("div", "tchev");
    ch.textContent = kind === "d" ? "▾" : "";
    r.appendChild(ch);
    const ic = el("div", "tic");
    ic.textContent = kind === "d" ? "▣" : "▸";
    ic.style.color = kind === "d" ? t.accent : t.muted;
    r.appendChild(ic);
    const nm = el("div", "tnm");
    nm.textContent = name;
    if (name === "retry.ts") r.classList.add("sel");
    r.appendChild(nm);
    if (mark) {
      const m = el("div", "tmark");
      m.textContent = mark;
      m.style.color = mark === "A" ? t.ansi2 : mark === "D" ? t.ansi1 : t.blocked;
      r.appendChild(m);
    }
    tree.appendChild(r);
  }
  const code = el("div", "code");
  const clines = [
    ["comment", "// backoff follows the lane's round-trip time"],
    ["kw", "export const"],
    ["fg", "  MAX_BACKOFF = Math.min(rtt * 8, 4_000);"],
    ["", ""],
    ["kw", "export function"],
    ["fn", " nextDelay"],
    ["fg", "(attempt: number, rtt: number) {"],
    ["dim", "  // exponential with a ceiling"],
    ["kw", "  return"],
    ["fn", " Math"],
    ["fg", ".min(rtt * 2 ** attempt, MAX_BACKOFF);"],
    ["fg", "}"],
  ];
  for (const [cls, s] of clines) {
    const l = el("div", "cl");
    const sp = el("span");
    sp.textContent = s;
    sp.style.color = cls === "comment" || cls === "dim" ? t.dim : cls === "kw" ? t.ansi5 : cls === "fn" ? t.ansi4 : t.fg;
    l.appendChild(sp);
    code.appendChild(l);
  }
  const split = el("div", "split");
  split.appendChild(tree);
  split.appendChild(code);
  box.appendChild(split);
  return box;
}

function changesPanel() {
  const t = DATA.themes[state.appearance];
  const box = el("div", "panel card");
  box.appendChild(holo("CHANGES", "hangar log", null, droidNode("probe", "working", { scale: 0.32, oy: -1 })));
  const list = el("div", "list");
  for (const [f, m, add, del] of [["src/lane/retry.ts", "M", "+18", "−4"], ["src/agents/astromech.ts", "A", "+96", ""], ["tests/retry.test.ts", "M", "+31", "−2"], ["README.md", "M", "+3", ""]]) {
    const r = el("div", "row crow");
    const mark = el("div", "tmark");
    mark.textContent = m;
    mark.style.color = m === "A" ? t.ansi2 : t.blocked;
    r.appendChild(mark);
    const nm = el("div", "row-n");
    nm.textContent = f;
    r.appendChild(nm);
    const n = el("div", "row-c");
    n.innerHTML = `<span style="color:${t.ansi2}">${add}</span> <span style="color:${t.ansi1}">${del}</span>`;
    r.appendChild(n);
    list.appendChild(r);
  }
  box.appendChild(list);
  const diff = el("div", "code");
  for (const [pre, s] of [[" ", "export function nextDelay(attempt, rtt) {"], ["-", "-  return Math.min(attempt * 500, 4_000);"], ["+", "+  const MAX_BACKOFF = Math.min(rtt * 8, 4_000);"], ["+", "+  return Math.min(rtt * 2 ** attempt, MAX_BACKOFF);"], [" ", "}"]]) {
    const l = el("div", "cl");
    l.style.background = pre === "+" ? t.ansi2 + "18" : pre === "-" ? t.ansi1 + "18" : "transparent";
    const sp = el("span");
    sp.textContent = pre + s;
    sp.style.color = pre === "+" ? t.ansi2 : pre === "-" ? t.ansi1 : t.muted;
    l.appendChild(sp);
    diff.appendChild(l);
  }
  box.appendChild(diff);
  return box;
}

function statusBar() {
  const t = DATA.themes[state.appearance];
  const b = el("div", "status");
  const needs = AGENTS.filter((a) => a.state === "blocked").length;
  b.innerHTML = `<span class="sl">◈ this machine</span>
    <span class="sl">⌥ main</span>
    <span class="sl" style="display:flex;gap:4px;align-items:center">${[...AGENTS].sort((a, b) => ({ blocked: 4, done: 3, working: 2, idle: 1 })[b.state] - ({ blocked: 4, done: 3, working: 2, idle: 1 })[a.state]).map((a) => `<i style="width:6px;height:6px;border-radius:3px;background:${t[a.state]}"></i>`).join("")}</span>
    <span class="sl">${AGENTS.length} droids${needs ? ` · <b style="color:${t.blocked}">${needs} needs you</b>` : ""}</span>
    <span class="fill"></span>
    <span class="sl dim">⌘K  commands</span>`;
  return b;
}

// ---- the window tree from layouts/droids.json

const CONTENT = {
  brand,
  spaces: spacesPanel,
  agents: agentsPanel,
  "sidebar-footer": footer,
  tabs: tabBar,
  panel: () => (state.panel === "files" ? filesPanel() : changesPanel()),
  status: statusBar,
};

const COLOR = (v) => {
  const t = DATA.themes[state.appearance];
  if (!v) return null;
  if (typeof v === "string") return t[v] ?? v;
  if (v.gradient) return `linear-gradient(${v.angle ?? 180}deg, ${v.gradient.join(", ")})`;
  return null;
};

function buildNode(node) {
  // The side panel is "hidden" in the layout file and shown by a tab-bar click,
  // exactly like Herdr does it; everything else hidden stays hidden.
  if (node.hidden && node.id !== "panel") return el("div", "hidden");
  const t = DATA.themes[state.appearance];
  const e = el("div", `node lay-${node.type}`);
  const s = e.style;
  if (node.type === "row" || node.type === "column") {
    s.display = "flex";
    s.flexDirection = node.type === "row" ? "row" : "column";
    if (node.gap) s.gap = `${node.gap}px`;
    if (node.padding) {
      const p = Array.isArray(node.padding) ? node.padding : [node.padding, node.padding];
      s.padding = `${p[0]}px ${p[1]}px`;
    }
    if (node.divider) {
      const side = node.type === "row" ? "borderRight" : "borderBottom";
      s[side] = `${node.divider.width}px solid ${COLOR(node.divider.color)}`;
    }
    const bg = COLOR(node.background);
    if (bg) s.background = bg;
    for (const c of node.children ?? []) e.appendChild(buildNode(c));
    return e;
  }
  if (node.type === "stack") {
    s.display = "flex";
    s.flexDirection = "column";
    s.minHeight = 0;
    const active = node.id === "panel-body" ? state.panel : node.active;
    e.appendChild(buildChild(node.children.find((c) => c.id === active)));
    return e;
  }
  // block
  s.minWidth = 0;
  s.minHeight = 0;
  s.position = "relative";
  const c = node.content;
  if (c?.mod === "droids") {
    const role = c.props?.role;
    e.appendChild((CONTENT[role] ?? (() => el("div")))());
  } else if (c?.tab) {
    s.display = "flex";
    e.appendChild(terminalMock());
    for (const f of node.floating ?? []) e.appendChild(depotPanel());
  } else if (c?.mod === "droids-spaces") e.appendChild(spacesPanel());
  else if (c?.mod === "droids-tabs") e.appendChild(tabBar());
  else if (c?.mod === "droids-files") e.appendChild(state.panel === "files" ? filesPanel() : el("div", "hidden"));
  else if (c?.mod === "droids-changes") e.appendChild(state.panel === "changes" ? changesPanel() : el("div", "hidden"));
  return e;
}

function buildChild(node) {
  const t = DATA.themes[state.appearance];
  const e = el("div", `node lay-${node.type}`);
  const s = e.style;
  s.minWidth = 0;
  s.minHeight = 0;
  s.position = "relative";
  s.display = "flex";
  s.flexDirection = "column";
  if (node.id === "files") e.appendChild(filesPanel());
  if (node.id === "changes") e.appendChild(changesPanel());
  return e;
}

function flexFor(node) {
  const s = node.size;
  if (s?.px != null) return `0 0 ${s.px}px`;
  if (s?.weight != null) return `${s.weight} 1 0%`;
  return "1 1 0%";
}

function applySizes(node, parent) {
  // walk the tree, assigning flex sizes from the layout
  if (!node) return;
  const kids = node.children ?? [];
  kids.forEach((c, i) => {
    const e = parent.children[i];
    if (!e) return;
    e.style.flex = flexFor(c);
    if (c.id === "panel") e.style.display = state.panelOpen ? "flex" : "none";
    else if (c.hidden) e.style.display = "none";
    applySizes(c, e);
  });
}

function windowMock() {
  const t = DATA.themes[state.appearance];
  const root = DATA.layout;
  const e = buildNode(root);
  e.classList.add("window");
  e.style.setProperty("--bg", COLOR(root.background) ?? t.canvas);
  applySizes(root, e);
  return e;
}

// ---- gallery of every droid in every state

function gallery() {
  const t = DATA.themes[state.appearance];
  const wrap = el("div", "gallery");
  for (const k of DATA.meta.kinds) {
    const card = el("div", "gcard");
    const head = el("div", "ghead");
    head.innerHTML = `<b>${k.name}</b><span>${k.droid}</span>`;
    card.appendChild(head);
    const strip = el("div", "gstrip");
    for (const st of DATA.meta.states) {
      const cell = el("div", "gcell");
      cell.appendChild(droidNode(k.id, st, { scale: 1.35 }));
      const lab = el("div", "glab");
      lab.textContent = st;
      lab.style.color = t[st];
      cell.appendChild(lab);
      strip.appendChild(cell);
    }
    card.appendChild(strip);
    const m = el("div", "gmatch");
    m.textContent = `matches: ${k.match.join(", ") || "(anything unknown)"}`;
    card.appendChild(m);
    wrap.appendChild(card);
  }
  const cr = el("div", "gcard");
  cr.innerHTML = `<div class="ghead"><b>No droid</b><span>plain terminal</span></div>`;
  const strip = el("div", "gstrip");
  const cell = el("div", "gcell");
  cell.appendChild(droidNode("cradle", "cradle", { scale: 1.35 }));
  const lab = el("div", "glab");
  lab.textContent = "cradle";
  lab.style.color = t.dim;
  cell.appendChild(lab);
  strip.appendChild(cell);
  cr.appendChild(strip);
  wrap.appendChild(cr);
  return wrap;
}

// ---- draw

function draw() {
  const t = DATA.themes[state.appearance];
  frameAnims.length = 0;
  kfRules.clear();
  kfSeq = 0;
  frameTexts.length = 0;
  document.documentElement.style.setProperty("--fg", t.foreground);
  document.documentElement.style.setProperty("--ui", "-apple-system,system-ui,sans-serif");
  document.documentElement.style.setProperty("--mono", "'JetBrains Mono',ui-monospace,monospace");
  document.documentElement.style.setProperty("--line", t.border);
  document.documentElement.style.setProperty("--muted", t.muted);
  document.documentElement.style.setProperty("--dim", t.dim);
  document.documentElement.style.setProperty("--pop", t.popover);
  document.body.dataset.appearance = state.appearance;
  const host = document.getElementById("stage");
  host.innerHTML = "";
  try {
    // build first: drawing the droids is what collects their keyframes
    const view = state.view === "window" ? windowMock() : gallery();
    styleSheets.textContent = CSS_BASE + frameAnims.join("\n") + THEMED(t);
    host.appendChild(view);
    fit();
    dbg();
  } catch (e) {
    host.textContent = "";
    const box = el("div");
    box.style.cssText = "color:#f88;font:12px monospace;padding:20px;white-space:pre-wrap";
    box.textContent = "preview error: " + (e && e.stack ? e.stack : String(e));
    document.body.appendChild(box);
  }
}

function dbg() {
  const old = document.getElementById("dbg");
  if (old) old.remove();
  if (!location.hash.includes("dbg")) return;
  const w = document.querySelector(".window");
  const r = w ? w.getBoundingClientRect() : { width: 0, height: 0, top: 0, left: 0 };
  const kids = w ? [...w.children].map((c) => `${c.className.split(" ").pop()}:${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)}`).join(" ") : "";
  const d = el("div");
  d.id = "dbg";
  d.style.cssText = "position:fixed;left:0;top:0;right:0;z-index:99;font:18px monospace;background:#000;color:#0f8;padding:6px";
  const cs = w ? getComputedStyle(w) : null;
  const stage = document.getElementById("stage"), sw = document.getElementById("stageWrap");
  const css = cs ? `h=${cs.height} w=${cs.width} disp=${cs.display} ovf=${cs.overflow} minH=${cs.minHeight} pos=${cs.position}` : "none";
  d.textContent = `win ${Math.round(r.width)}x${Math.round(r.height)} | ${css} | stage=${Math.round(stage.getBoundingClientRect().height)} t=${stage.style.transform} wrap=${Math.round(sw.getBoundingClientRect().height)} inner=${innerWidth} | ${kids}`;
  document.body.appendChild(d);
}

const THEMED = (t) => `
.window{background:${t.canvas}}
.node.lay-row,.node.lay-column{color:${t.foreground}}
.brand,.panel,.footer,.tabbar,.status{color:${t.foreground}}
.brand{background:${t.chrome}}
.panel{background:${t.chrome}}
.panelhead{border-bottom-color:${t.border}}
.panelhead-s{color:${t.dim}}
.row{color:${t.muted}}
.row:hover{background:${t.hover}}
.row.on{background:${t.selected};color:${t.foreground}}
.row-x,.row-c{color:${t.dim}}
.footer{background:${t.chrome};border-top:1px solid ${t.border};color:${t.muted}}
.footer a{color:${t.accent}}
.tabbar{background:${t.chrome};border-bottom:1px solid ${t.border}}
.pill{background:${t.chrome};border:1px solid ${t.chrome};color:${t.muted}}
.pill.on{background:${t.raised};border-color:${t.border};color:${t.foreground}}
.pill:hover{background:${t.hover}}
.iconbtn{color:${t.dim}}
.iconbtn:hover{background:${t.hover};color:${t.foreground}}
.panelbtn{color:${t.muted};border:1px solid transparent}
.panelbtn.on{background:${t.selected};color:${t.foreground};border-color:${t.border}}
.winbtn{color:${t.dim}}
.panecard{background:${t.background};border:1px solid ${t.border};color:${t.foreground}}
.panecard.on{border-color:${t.accent}}
.panehead{border-bottom:1px solid ${t.border};background:${t.surface}}
.panehead-n{color:${t.foreground}}
.term{color:${t.foreground};background:${t.background}}
.tl{color:${t.foreground}}
.files{background:${t.surface};border:1px solid ${t.border}}
.trow{color:${t.foreground}}
.trow:hover{background:${t.hover}}
.trow.sel{background:${t.selected}}
.tchev{color:${t.dim}}
.code{background:${t.background};border-left:1px solid ${t.border};color:${t.foreground}}
.tree{border-right:1px solid ${t.border}}
.status{display:flex;align-items:center;gap:14px;padding:0 14px;background:${t.chrome};border-top:1px solid ${t.border};color:${t.muted}}
.status .sl{color:${t.muted}}
.status .dim{color:${t.dim}}
.gcard{background:${t.surface};border:1px solid ${t.border};color:${t.foreground}}
.ghead span{color:${t.dim}}
.gmatch{color:${t.dim}}
.gcell{background:${t.background};border:1px solid ${t.border}}
.stars .star{background:${t.holo}}
.lamp{box-shadow:0 0 6px currentColor}
.pinmark.on{color:${t.accent}}
`;

const CSS_BASE = `
*{box-sizing:border-box}
.nd{position:absolute}
.droid{position:relative;flex:none}
.nd{text-rendering:optimizeLegibility}
html,body{margin:0;height:100%}
body{font-family:var(--ui);background:#05070c;color:var(--fg)}
body[data-appearance=light]{background:#cfc6b4}
header{display:flex;align-items:center;gap:14px;padding:12px 18px;font-size:13px;flex-wrap:wrap}
header h1{font-size:14px;margin:0 8px 0 0;font-weight:650;letter-spacing:.02em}
body[data-appearance=dark] header{color:#9fb0c4}
body[data-appearance=light] header{color:#3a4450}
.btn{border:1px solid #445; border-radius:7px;padding:5px 10px;cursor:pointer;font-size:12px;background:transparent;color:inherit}
body[data-appearance=dark] .btn{border-color:#2b3a4c;color:#b9c8d8}
body[data-appearance=light] .btn{border-color:#b9ae9a;color:#3a4450}
.btn.on{background:#e0a34a;color:#1a1206;border-color:#e0a34a}
#stageWrap{display:flex;justify-content:center;padding:0 20px 30px}
#stage{transform-origin:top center}
.hidden{display:none}
.depot{position:absolute;right:8px;top:50%;width:244px;transform:translate(198px,-50%);transition:transform .22s ease-out;background:var(--pop);border:1px solid var(--line);border-radius:12px;padding:5px;box-shadow:0 18px 46px rgba(0,0,0,.45);z-index:5}
.depot:hover{transform:translate(0,-50%)}
.deprow{height:40px}
.deprow .dtop{font-size:11.5px}
.depd{width:22px;height:28px;flex:none;position:relative}
.dright{display:flex;align-items:center;gap:7px;flex:none}
.fold{font-size:13px;opacity:.6;padding:0 2px}
.pinmark{font-size:12px;opacity:.35;line-height:1}
.pinmark.on{opacity:1}
.bay.pinned{outline:1px solid transparent}
.grouph{display:flex;align-items:center;gap:6px;height:26px;padding:0 8px;font-size:11px;color:var(--muted)}
.grouph .gn{color:var(--dim)}
.grouph .gline{flex:1;border-bottom:1px solid var(--line);height:0}
.subrow{height:26px;font-size:12px}
.subrow .treelines{display:flex;flex:none}
.subrow .treelines div{width:9px;height:16px;margin-right:4px;border-left:1.5px solid var(--line)}
.subrow .treelines .elbow{border-bottom:1.5px solid var(--line);border-bottom-left-radius:6px}
.droid{position:relative;flex:none}
.window{display:flex;position:relative;width:1320px;height:840px;border-radius:12px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);font-size:13px}
.node{position:relative;min-width:0;min-height:0}
.node.lay-block{display:flex;flex-direction:column}
.brand{position:relative;display:flex;align-items:center;gap:8px;padding:0 10px 0 82px;height:100%;overflow:hidden}
.lights{position:absolute;left:16px;top:18px;display:flex;gap:8px}
.lights i{width:12px;height:12px;border-radius:6px}
.brand-mark{font-size:19px}
.brand-a{font-weight:700;letter-spacing:.16em;font-size:13px}
.brand-b{font-size:10.5px;letter-spacing:.04em}
.stars{position:absolute;inset:0;pointer-events:none;opacity:.5}
.star{position:absolute;border-radius:50%}
.panel{display:flex;flex-direction:column;height:100%;min-height:0}
.panelhead{display:flex;align-items:center;gap:8px;padding:10px 14px 6px;border-bottom:1px solid}
.panelhead-t{font-size:11.5px;font-weight:600;letter-spacing:.1em}
.panelhead-s{font-size:10.5px;letter-spacing:.03em}
.fill{flex:1}
.sortbtn{font-size:12px;opacity:.55;cursor:pointer}
.list{flex:1;min-height:0;overflow:auto;padding:6px 8px}
.row{display:flex;align-items:center;gap:8px;height:26px;padding:0 8px;border-radius:7px;cursor:pointer;font-size:12.5px}
.lamp{width:7px;height:7px;border-radius:50%;flex:none}
.row-n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row-x{font-size:11px;white-space:nowrap}
.row-c{font-size:11px;flex:none}
.droidlist .row{height:62px;align-items:center;gap:10px}
.droidlist .subrow{height:26px;gap:8px}
.bay{width:36px;height:46px;flex:none;position:relative;display:flex;align-items:center;justify-content:center}
.dinfo{flex:1;min-width:0}
.dtop{font-size:12.8px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsub{font-size:11.2px;opacity:.72;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dmeta{display:flex;align-items:center;gap:8px;margin-top:4px}
.chip{font-size:9.8px;padding:1px 6px;border-radius:5px;border:1px solid;letter-spacing:.03em}
.dsp{font-size:10.5px;opacity:.55}
.footer{display:flex;align-items:center;gap:4px;padding:0 8px 0 16px;font-size:11px}
.foot-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.foot-keys{opacity:.6;font-size:10.5px}
.footer b{font-weight:600}
.tabbar{display:flex;align-items:center;gap:4px;padding:0 12px;height:100%;overflow:hidden}
.tabs{display:flex;align-items:center;gap:4px;flex:1;min-width:0;overflow:hidden}
.pill{display:flex;align-items:center;gap:7px;height:30px;padding:0 9px;border-radius:8px;cursor:pointer;font-size:12.5px;flex:none}
.pill-d{width:20px;height:26px;position:relative;display:flex;align-items:center;justify-content:center}
.pill-s{font-size:11px}
.pill-n{max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pill-x{font-size:10px;opacity:.55}
.iconbtn{width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;font-size:15px;flex:none}
.iconbtn.sm{width:22px;height:22px;font-size:12px}
.panelbtn{height:26px;padding:0 9px;display:flex;align-items:center;border-radius:6px;font-size:12px;cursor:pointer;flex:none}
.winbtns{display:flex;gap:4px}
.winbtn{width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;opacity:.6}
#main{padding:10px;gap:10px}
.panecard{position:relative;flex:1;display:flex;flex-direction:column;border-radius:10px;overflow:hidden;min-width:0}
.panehead{display:flex;align-items:center;gap:8px;height:32px;padding:0 10px;flex:none}
.panehead-n{font-size:12px;font-weight:600}
.panehead-x{font-size:11px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.term{flex:1;overflow:hidden;padding:12px 14px;font-family:var(--mono);font-size:12.6px;line-height:1.5}
.tl{white-space:pre;height:19px}
.caret{display:inline-block;width:7px;height:14px;vertical-align:-2px;animation:blink 1s steps(1,end) infinite}
.scrollrail{position:absolute;right:3px;top:38px;bottom:6px;width:7px;border-radius:4px}
.scrollthumb{position:absolute;top:12%;left:1px;width:5px;height:38%;border-radius:3px;opacity:.55}
.card{border-radius:10px;overflow:hidden;display:flex;flex-direction:column;height:100%}
.files .split{flex:1;min-height:0;display:flex;flex-direction:row}
.files .tree{flex:1 1 46%;min-width:0;border-right:1px solid var(--line)}
.files .code{flex:1 1 54%}
.tree{min-width:0;overflow:auto;padding-bottom:8px}
.trow{display:flex;align-items:center;gap:7px;height:26px;padding-right:10px;border-radius:6px;font-size:12.4px;cursor:pointer;margin:0 6px}
.tchev{width:10px;font-size:9px;flex:none}
.tic{font-size:11px;flex:none;width:12px;text-align:center}
.tnm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tmark{font-size:10.5px;font-weight:700;flex:none}
.code{min-width:0;overflow:auto;padding:8px 10px;font-family:var(--mono);font-size:11.6px;line-height:1.5;border-radius:0}
.cl{white-space:pre;min-height:17px}
.gallery{display:flex;flex-wrap:wrap;gap:14px;width:1320px}
.gcard{border-radius:12px;padding:12px 14px 10px;width:100%}
.ghead{display:flex;align-items:baseline;gap:8px;font-size:13px;margin-bottom:8px}
.gstrip{display:flex;gap:12px}
.gcell{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px;border-radius:9px;position:relative}
.glab{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}
html.plain header{display:none}
html.plain #stageWrap{padding:20px}
@keyframes blink{from{opacity:.15}to{opacity:1}}
@keyframes twinkle{from{opacity:.15}to{opacity:.9}}
`;

// shared clock for cycling text (mirrors gpui's frames(): one clock, all views)
setInterval(() => {
  const now = performance.now();
  for (const f of frameTexts) {
    const i = Math.floor(now / f.ms) % f.frames.length;
    const want = f.frames[i];
    if (f.e.textContent !== want) f.e.textContent = want;
  }
}, 90);

// controls
function controls() {
  const bar = document.getElementById("bar");
  bar.innerHTML = "";
  const title = el("h1");
  title.textContent = "herdr · droids layout";
  bar.appendChild(title);
  const mk = (label, on, fn) => {
    const b = el("div", `btn${on ? " on" : ""}`);
    b.textContent = label;
    b.onclick = fn;
    bar.appendChild(b);
    return b;
  };
  mk("dark", state.appearance === "dark", () => ((state.appearance = "dark"), draw(), controls()));
  mk("light", state.appearance === "light", () => ((state.appearance = "light"), draw(), controls()));
  bar.appendChild(el("div", "", { width: "8px" }));
  mk("window", state.view === "window", () => ((state.view = "window"), draw(), controls()));
  mk("droid gallery", state.view === "gallery", () => ((state.view = "gallery"), draw(), controls()));
  bar.appendChild(el("div", "", { width: "8px" }));
  mk(`demo: ${state.demo ? "on" : "off"}`, state.demo, () => ((state.demo = !state.demo), controls()));
  for (const st of DATA.meta.states) {
    mk(`all ${st}`, false, () => {
      state.demo = false;
      AGENTS.forEach((a) => (a.state = st));
      draw();
      controls();
    });
  }
  const hint = el("div", "", { fontSize: "11.5px", opacity: ".6", marginLeft: "auto" });
  hint.textContent = "preview: real layout sizes, real theme files, real droid geometry";
  bar.appendChild(hint);
}

setInterval(() => {
  if (!state.demo) return;
  const pool = DATA.meta.states;
  const a = AGENTS[Math.floor(Math.random() * AGENTS.length)];
  a.state = pool[Math.floor(Math.random() * pool.length)];
  draw();
}, 2600);

function fit() {
  const w = document.getElementById("stage");
  const scale = Math.min(1, (innerWidth - 60) / 1320);
  w.style.transform = `scale(${scale})`;
  document.getElementById("stageWrap").style.height = `${840 * scale + 20}px`;
}
addEventListener("resize", fit);

state.panelOpen = true;
// #light / #dark / #gallery / #still (no state-cycling) let a screenshot or a
// bookmark open the preview in a known state.
const h = location.hash;
if (h.includes("light")) state.appearance = "light";
if (h.includes("dark")) state.appearance = "dark";
if (h.includes("gallery")) state.view = "gallery";
if (h.includes("still")) state.demo = false;
// #plain drops the control bar: just the window, for a shareable screenshot.
if (h.includes("plain")) document.documentElement.classList.add("plain");
addEventListener("hashchange", () => {
  if (location.hash.includes("gallery")) state.view = "gallery";
  else if (location.hash.includes("window")) state.view = "window";
  if (location.hash.includes("light")) state.appearance = "light";
  if (location.hash.includes("dark")) state.appearance = "dark";
  draw();
  controls();
  fit();
});
draw();
controls();
fit();
