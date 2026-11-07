// Star Wars droid art, as plain data.
//
// No imports, no DOM, no gpui: a droid is a tree of boxes and labels with
// optional native loops. The Herdr mod renders this with div() + .loop(),
// preview/render.js renders the same tree with divs + CSS keyframes, so a
// droid looks the same in the browser preview and in the app.
//
// Node shapes (all numbers are droid-space px; scale() multiplies them):
//   { n:'b', x, y, w, h, bg, r?, rt?, rb?, rl?, rr?, bd?:[px,color], op?,
//     anim?:{p:'opacity'|'left'|'top'|'width'|'height', from, to, period, easing?} }
//   { n:'t', x, y, w?, h?, t, size, color, weight?, mono?, align?,
//     frames?:[str], ms?, anim? }
//   { n:'g', x, y, w?, h?, anim?, clip?, children:[...] }   group, children relative

export const W = 56;
export const H = 72;

export const STATES = ["working", "blocked", "done", "idle"];

// id: what the layout and the preview call it. match: program.key / agent.app names.
export const KINDS = [
  {
    id: "astromech", name: "Astromech", droid: "R-unit",
    match: ["claude", "claude-code", "anthropic"],
    art: { p1: "#d97757", p2: "#5b8fd0", shell: null, eye: "#6fd3e8" },
  },
  {
    id: "probe", name: "Probe droid", droid: "Viper probe",
    match: ["codex", "codex-cli", "openai", "chatgpt"],
    art: { p1: "#10a37f", p2: "#0f7f66", shell: "#252d38", eye: "#37e0a8" },
  },
  {
    id: "pod", name: "Hover pod", droid: "D-series pod",
    match: ["pi", "pi-coding-agent", "pinv"],
    art: { p1: "#2ec9b0", p2: "#1a8f7d", shell: null, eye: "#5ff0d8" },
  },
  {
    id: "protocol", name: "Protocol droid", droid: "3PO-class",
    match: ["kimi", "kimi-code", "moonshot"],
    art: { p1: "#e0c069", p2: "#c0a04e", shell: null, eye: "#fff3cf", moon: "#1b2740" },
  },
  {
    id: "utility", name: "Utility droid", droid: "GNK-class",
    match: ["opencode", "open-code"],
    art: { p1: "#f0a13a", p2: "#c87c22", shell: null, eye: "#ffd98a" },
  },
  {
    id: "generic", name: "Service droid", droid: "IT-O",
    match: [],
    art: { p1: "#8b98a9", p2: "#6b7889", shell: null, eye: "#9fb4c6" },
  },
];

export const kindOf = (id) => KINDS.find((k) => k.id === id) ?? KINDS[KINDS.length - 1];

// program.key / agent.app -> droid kind. Unknown agents get the service droid.
export function matchKind(name) {
  const s = String(name ?? "").toLowerCase();
  if (!s) return "generic";
  for (const k of KINDS) if (k.match.some((m) => s === m || s.includes(m))) return k.id;
  return "generic";
}

// ---- node helpers

const b = (x, y, w, h, bg, o = {}) => ({ n: "b", x, y, w, h, bg, ...o });
const t = (x, y, label, o = {}) => ({ n: "t", x, y, t: label, size: 8, color: "#888", ...o });
const g = (o) => ({ n: "g", x: 0, y: 0, ...o });

const EASE = "ease-in-out";
const pulse = (period, from = 0.25, to = 1) => ({ p: "opacity", from, to, period, easing: EASE });
const bob = (period, to = -3) => ({ p: "top", from: 0, to, period, easing: EASE });

// A status lamp: colour per state, blinking when something is happening.
function lamp(x, y, s, state, P) {
  const c = P[state] ?? P.idle;
  if (state === "working") return b(x, y, s, s, c, { r: s / 2, anim: pulse(520, 0.35, 1) });
  if (state === "blocked") return b(x, y, s, s, c, { r: s / 2, anim: pulse(300, 0.2, 1) });
  if (state === "done") return b(x, y, s, s, c, { r: s / 2, op: 1 });
  return b(x, y, s, s, "transparent", { r: s / 2, bd: [1, c], op: 0.85 });
}

// Ground shadow: breathes with a hovering droid, sits still otherwise.
function shadow(x, w, y, P, hover) {
  return b(x, y, w, 3, P.shadow, {
    r: 1.5,
    op: hover ? 0.22 : 0.16,
    anim: hover ? { p: "opacity", from: 0.22, to: 0.1, period: 1800, easing: EASE } : null,
  });
}

// Above-head alert beacon with a halo, for blocked.
function beacon(P, cx = W / 2) {
  return [
    b(cx - 9, -7, 18, 18, P.alert, { r: 9, op: 0.14, anim: pulse(700, 0.06, 0.3) }),
    b(cx - 2.5, 0, 5, 5, P.alert, { r: 2.5, anim: pulse(360, 0.25, 1) }),
  ];
}

// "zzz" for a sleeping droid: one label, cycling glyphs.
function snooze(P) {
  return t(W - 16, 2, "z", {
    size: 10, color: P.dim, weight: 600, frames: ["·", "z", "Z", "z"], ms: 700,
    anim: { p: "top", from: 4, to: -4, period: 2600, easing: EASE },
  });
}

// A small floating glyph near the head (✓ when done, ! when blocked).
function tag(state, P) {
  if (state === "done") return t(W - 18, 2, "✓", { size: 13, color: P.done, weight: 700, anim: pulse(1400, 0.45, 1) });
  if (state === "blocked") return t(W - 18, 2, "!", { size: 14, color: P.alert, weight: 800, anim: pulse(360, 0.2, 1) });
  return null;
}

// Whole-droid motion for each state: hop when done, dip when blocked, none idle.
function bodyAnim(state) {
  if (state === "working") return bob(1100, -1.6);
  if (state === "done") return bob(760, -4);
  if (state === "blocked") return { p: "left", from: 0, to: -1.5, period: 460, easing: EASE };
  return null;
}

// A scanning holo-eye that sweeps left/right while working, sits still otherwise.
function sweeper(x, y, s, range, state, color) {
  return b(x, y, s, s, color, {
    r: s / 2,
    op: state === "idle" ? 0.3 : 1,
    anim: state === "working" ? { p: "left", from: x, to: x + range, period: 1500, easing: EASE }
      : state === "blocked" ? { p: "left", from: x, to: x + range, period: 380, easing: "linear" } : null,
  });
}

// ---- the droids

// R-unit astromech: dome, cylider body, three legs, antenna. Claude Code.
function astromech(state, P, A) {
  const working = state === "working";
  const idle = state === "idle";
  const out = [];
  out.push(shadow(11, 34, 68, P, false));
  // antenna
  out.push(b(45, 3, 1.6, 10, P.metal));
  out.push(b(43.6, 1, 4, 4, working || state === "blocked" ? A.p1 : P.metal, { r: 2, anim: working ? pulse(600, 0.3, 1) : null }));
  // dome
  out.push(b(13, 9, 30, 17, P.hull, { rt: 15, bd: [1, P.hullShade] }));
  out.push(b(13, 21, 30, 3.5, P.hullShade, { op: 0.9 }));
  out.push(b(17, 12, 8, 1.6, P.hullDark, { op: 0.5 }));
  // holo eye, sweeping when working
  out.push(b(17, 14, 12, 7, P.holoDim, { r: 3.5 }));
  out.push(sweeper(19, 15.5, 4, 6, state, A.eye));
  out.push(b(32, 13, 5, 5, P.metal, { r: 2.5 }));
  out.push(lamp(33.2, 14.2, 2.6, state, P));
  // neck
  out.push(b(22, 26, 12, 4, P.metal));
  // body
  out.push(b(10, 29, 36, 26, P.hull, { r: 5, bd: [1, P.hullShade] }));
  out.push(b(13.5, 32.5, 10, 9, A.p1, { r: 2 }));
  out.push(b(13.5, 43, 10, 9, A.p2, { r: 2, op: idle ? 0.5 : 1 }));
  out.push(b(26, 32.5, 17, 2, P.hullShade, { op: 0.7 }));
  out.push(lamp(31, 38, 6, state, P));
  out.push(b(26, 47, 17, 2, P.metal, { op: 0.8 }));
  out.push(b(26, 50.5, 12, 2, P.metal, { op: 0.55 }));
  // legs
  out.push(b(3, 33, 7, 21, P.hullShade, { r: 3, bd: [1, P.hullDark] }));
  out.push(b(2, 53, 9, 4, P.metal, { r: 1 }));
  out.push(b(46, 33, 7, 21, P.hullShade, { r: 3, bd: [1, P.hullDark] }));
  out.push(b(45, 53, 9, 4, P.metal, { r: 1 }));
  out.push(b(25, 55, 6, 10, P.metal));
  out.push(b(21.5, 64, 13, 4, P.hullDark, { r: 1.5 }));
  // working: a weld spark off the side arm
  if (working) {
    out.push(b(49, 40, 5, 2, P.metal));
    out.push(b(50, 42, 4, 4, P.signal, { r: 2, anim: pulse(180, 0.15, 1) }));
  }
  return out;
}

// Viper probe: hovering dark pod, big iris, three claws. Codex.
function probe(state, P, A) {
  const idle = state === "idle";
  const hover = true;
  const out = [];
  out.push(shadow(15, 26, 66, P, hover));
  out.push(b(27, 4, 2, 8, P.metal));
  out.push(b(25.5, 2, 5, 4, idle ? P.metal : A.p1, { r: 2, anim: state === "working" ? pulse(700, 0.3, 1) : null }));
  // shell
  out.push(b(11, 12, 34, 32, A.shell ?? P.metal, { r: 16, bd: [1, P.hullDark] }));
  out.push(b(15, 16, 26, 9, P.hull, { r: 4.5, op: 0.12 }));
  // eye housing + iris
  out.push(b(17, 23, 22, 13, P.deck, { r: 6.5, bd: [1, P.hullDark] }));
  const iris = state === "working"
    ? { p: "width", from: 8, to: 12, period: 900, easing: EASE }
    : state === "blocked" ? { p: "opacity", from: 0.3, to: 1, period: 320, easing: EASE } : null;
  out.push(b(24, 26, 8, 7, idle ? P.dim : A.eye, { r: 3.5, anim: iris, op: idle ? 0.45 : 1 }));
  out.push(b(20, 25, 2.5, 9, P.metal, { op: 0.8 }));
  out.push(b(34, 25, 2.5, 9, P.metal, { op: 0.8 }));
  // claws
  const lift = state === "blocked" ? -5 : 0;
  out.push(b(13, 43 + lift, 3, 12, P.metal, { anim: state === "working" ? { p: "top", from: 43, to: 39, period: 620, easing: EASE } : null }));
  out.push(b(11, 54 + lift, 7, 2.5, P.hullDark, { r: 1 }));
  out.push(b(26.5, 44, 3, 14, P.metal));
  out.push(b(24.5, 57, 7, 2.5, P.hullDark, { r: 1 }));
  out.push(b(40, 43, 3, 12, P.metal, { anim: state === "working" ? { p: "top", from: 43, to: 38, period: 700, easing: EASE } : null }));
  out.push(b(38, 54, 7, 2.5, P.hullDark, { r: 1 }));
  // thruster glow under the shell
  if (!idle) out.push(b(22, 43, 12, 3, A.p1, { r: 1.5, op: 0.5, anim: pulse(420, 0.2, 0.7) }));
  return out;
}

// D-series hover pod: round body, wide visor, twin thrusters. pi.
function pod(state, P, A) {
  const idle = state === "idle";
  const out = [];
  out.push(shadow(14, 28, 66, P, true));
  out.push(b(8, 24, 5, 12, P.hullShade, { r: 2.5, bd: [1, P.hullDark] }));
  out.push(b(43, 24, 5, 12, P.hullShade, { r: 2.5, bd: [1, P.hullDark] }));
  // body
  out.push(b(13, 15, 30, 28, P.hull, { r: 14, bd: [1, P.hullShade] }));
  out.push(b(17, 19, 22, 6, P.hull, { r: 3, op: 0.5 }));
  // visor
  out.push(b(17, 24, 22, 9, P.deck, { r: 4.5 }));
  out.push(sweeper(20, 26.5, 5, 12, state, A.eye));
  out.push(t(24, 35, "π", { size: 9, color: idle ? P.dim : A.p1, weight: 700, op: idle ? 0.5 : 1 }));
  // engines + thruster flames
  out.push(b(17, 43, 9, 4, P.metal, { r: 1.5 }));
  out.push(b(30, 43, 9, 4, P.metal, { r: 1.5 }));
  if (!idle) {
    out.push(b(19, 47, 5, 8, A.p1, { r: 2.5, op: 0.85, anim: { p: "height", from: 4, to: 10, period: 220, easing: "linear" } }));
    out.push(b(32, 47, 5, 8, A.p1, { r: 2.5, op: 0.85, anim: { p: "height", from: 5, to: 9, period: 260, easing: "linear" } }));
  }
  out.push(b(20, 58, 16, 2.5, A.p1, { r: 1.25, op: idle ? 0.2 : 0.35, anim: idle ? null : pulse(1600, 0.18, 0.5) }));
  return out;
}

// 3PO-class protocol droid: gold plates, a crescent moon on the chest. Kimi.
function protocol(state, P, A) {
  const idle = state === "idle";
  const up = state === "done", waving = state === "blocked";
  const out = [];
  out.push(shadow(13, 30, 68, P, false));
  // head
  out.push(b(25, 4, 6, 4, A.p2, { r: 2 }));
  out.push(b(18, 8, 20, 14, A.p1, { r: 4, bd: [1, A.p2] }));
  const eyeOpen = idle ? 0.35 : 1;
  out.push(b(22, 12.5, 4.5, 4.5, P.deck, { r: 2.25 }));
  out.push(b(29.5, 12.5, 4.5, 4.5, P.deck, { r: 2.25 }));
  out.push(b(23, 13.5, 2.5, 2.5, A.eye, { r: 1.25, op: eyeOpen, anim: state === "working" ? pulse(1100, 0.4, 1) : null }));
  out.push(b(30.5, 13.5, 2.5, 2.5, A.eye, { r: 1.25, op: eyeOpen, anim: state === "working" ? pulse(1100, 0.4, 1) : null }));
  out.push(b(21, 20, 14, 1.6, A.p2, { op: 0.7 }));
  out.push(b(26, 22, 4, 3, P.metal));
  // torso
  out.push(b(16, 25, 24, 22, A.p1, { r: 4, bd: [1, A.p2] }));
  out.push(b(19, 28, 18, 2, A.p2, { op: 0.6 }));
  // crescent moon: navy disc, gold disc over it, leaving a crescent
  out.push(b(25, 31, 12, 12, A.moon ?? P.deck, { r: 6 }));
  out.push(b(28.5, 32, 11, 11, A.p1, { r: 5.5 }));
  out.push(lamp(18, 42, 4, state, P));
  // arms: down, raised (done), one waving (blocked)
  out.push(b(10, 26, 4, 18, A.p2, { r: 2 }));
  out.push(b(9, 44, 6, 3.5, P.metal, { r: 1 }));
  const armY = up ? 16 : waving ? 14 : 26;
  out.push(b(42, armY, 4, up || waving ? 14 : 18, A.p2, { r: 2, anim: waving ? { p: "top", from: 14, to: 19, period: 340, easing: EASE } : null }));
  out.push(b(41, up || waving ? armY - 4 : 44, 6, 3.5, P.metal, { r: 1 }));
  // legs
  out.push(b(20, 47, 6, 16, A.p2, { r: 2 }));
  out.push(b(30, 47, 6, 16, A.p2, { r: 2 }));
  out.push(b(17, 62, 10, 4, P.metal, { r: 1.5 }));
  out.push(b(29, 62, 10, 4, P.metal, { r: 1.5 }));
  return out;
}

// GNK-class utility droid: boxy hull, grille, treads, tool arm. OpenCode.
function utility(state, P, A) {
  const idle = state === "idle";
  const working = state === "working";
  const out = [];
  out.push(shadow(9, 38, 68, P, false));
  // head
  out.push(b(14, 12, 4, 7, P.hullShade, { r: 1.5 }));
  out.push(b(38, 12, 4, 7, P.hullShade, { r: 1.5 }));
  out.push(b(18, 9, 20, 13, P.hull, { r: 3, bd: [1, P.hullShade] }));
  out.push(b(21, 13, 5, 5, P.deck, { r: 2.5 }));
  out.push(b(30, 13, 5, 5, P.deck, { r: 2.5 }));
  out.push(b(22, 14, 3, 3, idle ? P.dim : A.eye, { r: 1.5, op: idle ? 0.4 : 1, anim: working ? pulse(900, 0.4, 1) : null }));
  out.push(b(31, 14, 3, 3, idle ? P.dim : A.eye, { r: 1.5, op: idle ? 0.4 : 1, anim: working ? pulse(900, 0.4, 1) : null }));
  // body
  out.push(b(11, 23, 34, 27, P.hull, { r: 4, bd: [1, P.hullShade] }));
  out.push(b(11, 23, 34, 5, A.p1, { rt: 4 }));
  out.push(b(15, 31, 16, 2.4, P.metal));
  out.push(b(15, 36, 16, 2.4, P.metal));
  out.push(b(15, 41, 16, 2.4, P.metal));
  out.push(lamp(34, 32, 6, state, P));
  out.push(b(33.5, 41, 7, 1.6, P.hullShade));
  // tool arm
  const armY = working ? 0 : state === "blocked" ? -6 : 0;
  out.push(b(45, 28 + armY, 7, 3, P.metal, { anim: working ? { p: "top", from: 26, to: 31, period: 520, easing: EASE } : null }));
  out.push(b(49, 31 + armY, 3, 9, P.hullDark));
  if (working) out.push(b(47.5, 40, 6, 5, P.signal, { r: 2, anim: pulse(160, 0.1, 1) }));
  // treads
  out.push(b(7, 52, 42, 15, P.deck, { r: 7.5, bd: [1, P.hullDark] }));
  out.push(b(11, 55, 8, 8, P.metal, { r: 4 }));
  out.push(b(37, 55, 8, 8, P.metal, { r: 4 }));
  const ticks = [16, 22, 28, 34].map((x) => b(x, 57, 3, 5, P.metal, {
    op: 0.75,
    anim: working ? { p: "left", from: x, to: x - 6, period: 420, easing: "linear" } : null,
  }));
  out.push(...ticks);
  return out;
}

// Service droid for anything unrecognised: small, grey, one eye.
function generic(state, P, A) {
  const idle = state === "idle";
  const out = [];
  out.push(shadow(14, 28, 68, P, false));
  out.push(b(39, 8, 1.6, 10, P.metal));
  out.push(b(37.6, 6, 4, 4, idle ? P.metal : A.p1, { r: 2, anim: state === "working" ? pulse(700, 0.3, 1) : null }));
  out.push(b(17, 18, 22, 12, P.hullShade, { rt: 6, bd: [1, P.hullDark] }));
  out.push(b(24, 21, 8, 8, P.deck, { r: 4 }));
  out.push(sweeper(26, 23, 4, 4, state, A.eye));
  out.push(b(22, 30, 12, 3, P.metal));
  out.push(b(15, 33, 26, 20, P.hullShade, { r: 4, bd: [1, P.hullDark] }));
  out.push(b(19, 37, 10, 6, A.p1, { r: 1.5, op: idle ? 0.5 : 0.9 }));
  out.push(lamp(32, 38, 5, state, P));
  out.push(b(18, 53, 5, 12, P.metal, { r: 2 }));
  out.push(b(33, 53, 5, 12, P.metal, { r: 2 }));
  out.push(b(15, 64, 10, 4, P.hullDark, { r: 1.5 }));
  out.push(b(31, 64, 10, 4, P.hullDark, { r: 1.5 }));
  return out;
}

// Empty charging cradle: a terminal with no agent reporting.
export function cradle(P) {
  return [
    b(12, 58, 32, 6, P.metal, { r: 3 }),
    b(15, 60, 26, 2, P.deck, { r: 1 }),
    b(16, 18, 24, 34, "transparent", { r: 6, bd: [1.5, P.input], op: 0.6 }),
    b(22, 26, 12, 6, "transparent", { r: 3, bd: [1.5, P.input], op: 0.4 }),
    t(20, 40, "no link", { size: 7, color: P.dim, align: "center", w: 16, op: 0.8 }),
  ];
}

const BUILD = { astromech, probe, pod, protocol, utility, generic };

// Build a droid: kind id + state + palette -> { w, h, children }.
export function build(kind, state, P) {
  const k = kindOf(kind);
  const make = BUILD[k.id] ?? generic;
  const parts = make(state, P, k.art);
  const kids = parts.filter(Boolean);
  if (state === "idle") kids.push(snooze(P));
  const extra = state === "blocked" ? beacon(P) : [];
  const mark = tag(state, P);
  if (mark) kids.push(mark);
  kids.push(...extra);
  return {
    w: W,
    h: H,
    // idle dims the whole droid and gives it a slow breath
    anim: state === "idle" ? { p: "opacity", from: 0.72, to: 0.62, period: 3200, easing: EASE } : bodyAnim(state),
    op: state === "idle" ? 0.72 : 1,
    children: kids,
  };
}

// Scale a built tree into a smaller box (list rows use k < 1).
export function scale(node, k) {
  if (!node) return node;
  const s = (v) => (v == null ? v : Math.round(v * k * 100) / 100);
  const out = { ...node };
  for (const p of ["x", "y", "w", "h", "r", "rt", "rb", "rl", "rr", "size"]) if (p in node) out[p] = s(node[p]);
  if (node.bd) out.bd = [Math.max(0.5, s(node.bd[0])), node.bd[1]];
  if (node.anim) out.anim = { ...node.anim, from: s(node.anim.from), to: s(node.anim.to) };
  if (node.children) out.children = node.children.map((c) => scale(c, k));
  return out;
}

// ---- palettes from theme colors, with fallbacks so a missing custom color
// never breaks a droid. `dark` picks which fallback set to use.

export function palette(t, dark) {
  const c = (name, d, l) => t[name] ?? (dark ? d : l);
  return {
    hull: c("hull", "#e3e9f1", "#ffffff"),
    hullShade: c("hull_shade", "#a9b6c6", "#c3ccd6"),
    hullDark: c("hull_dark", "#6a7889", "#8b96a3"),
    metal: c("metal", "#3a475a", "#9aa4b0"),
    deck: c("deck", "#0a1018", "#ded5c4"),
    shadow: dark ? "#000000" : "#7d8894",
    holoDim: c("holo_dim", "#1d3a48", "#cfe0e4"),
    signal: c("signal", "#e6b45c", "#a87c12"),
    alert: c("alert", "#e2685e", "#b4362c"),
    input: t.input ?? c("input", "#33465c", "#b6a993"),
    dim: t.dim ?? c("dim", "#64768d", "#8b97a2"),
    working: t.working ?? "#5fc9d8",
    blocked: t.blocked ?? "#e2685e",
    done: t.done ?? "#7fca8b",
    idle: t.idle ?? "#64768d",
  };
}
