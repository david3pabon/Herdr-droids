// Star Wars droid art, as plain data.
//
// No imports, no DOM, no gpui: a droid is a tree of boxes and labels with
// optional native loops. The Herdr mod renders this with div() + .loop(),
// preview/app.js renders the same tree with divs + CSS keyframes, so a
// droid looks the same in the browser preview and in the app.
//
// Node shapes (all numbers are droid-space px; scale() multiplies them):
//   { n:'b', x, y, w, h, bg, r?, rt?, rb?, bd?:[px,color], op?, min?,
//     anim?:{p:'opacity'|'left'|'top'|'width'|'height', from, to, period, easing?} }
//   { n:'t', x, y, w?, h?, t, size, color, weight?, mono?, align?,
//     frames?:[str], ms?, anim?, min? }
//   { n:'g', x, y, w?, h?, op?, anim?, min?, children:[...] }   group, children relative
//
// min: the smallest scale a node is still drawn at. Below it the detail would be
// under a pixel, so scale() drops it and the silhouette and main colours carry
// the droid at tab and sub-agent sizes.

export const W = 56;
export const H = 72;

export const STATES = ["working", "blocked", "done", "idle"];

// id: what the layout and the preview call it. match: program.key / agent.app names.
// hover: floats above its shadow. settle: how far it sinks when idle. move: its
// whole-body motion while working, if not the usual bob. cx, tag: where the
// blocked beacon and the ✓ ! z marks sit, clear of its antennas and head.
export const KINDS = [
  {
    id: "astromech", name: "Astromech", droid: "R-unit",
    match: ["claude", "claude-code", "anthropic"],
    art: { p1: "#d97757", p2: "#5b8fd0", eye: "#6fd3e8" },
  },
  {
    id: "probe", name: "Probe droid", droid: "Viper probe", hover: true,
    match: ["codex", "codex-cli", "openai", "chatgpt"],
    art: { p1: "#10a37f", p2: "#0f7f66", shell: "#2c3644", eye: "#37e0a8" },
  },
  {
    id: "pod", name: "Hover pod", droid: "D-series pod", hover: true,
    match: ["pi", "pi-coding-agent", "pinv"],
    art: { p1: "#2ec9b0", p2: "#1a8f7d", eye: "#5ff0d8" },
  },
  {
    id: "protocol", name: "Protocol droid", droid: "3PO-class",
    match: ["kimi", "kimi-code", "moonshot"],
    art: { p1: "#e0c069", p2: "#b8933f", p3: "#f6e3a8", eye: "#fff3cf", moon: "#1b2740" },
  },
  {
    id: "utility", name: "Power droid", droid: "GNK-class", cx: 26, tag: [42, 0], settle: 3,
    move: { p: "left", from: -1.5, to: 1.5, period: 560 },
    match: ["opencode", "open-code"],
    art: { p1: "#f0a13a", p2: "#c87c22", shell: "#3b4656", eye: "#ffd98a" },
  },
  {
    id: "generic", name: "Pit droid", droid: "DUM-series",
    match: [],
    art: { p1: "#8b98a9", p2: "#6b7889", eye: "#9fb4c6" },
  },
];

export const kindOf = (id) => KINDS.find((k) => k.id === id) ?? KINDS[KINDS.length - 1];

// A name is either already a droid kind ("probe") or something that identifies
// the agent: program.key ("codex"), the agent's own report ("claude-code"), or
// a program name ("Claude Code"). Accept both, so callers never have to care.
export function kindId(name) {
  return KINDS.some((k) => k.id === name) ? name : matchKind(name);
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
const has = (s, m) => s === m || s.startsWith(m + "-") || s.endsWith("-" + m) || s.includes("-" + m + "-");

// program.key / agent.app -> droid kind. Exact and hyphen-bounded matches first,
// so "pi" claims "pi" and "pi-code" but not "openpi"; only longer names (4+,
// e.g. "gemini" in "gemini-cli") are allowed to match loosely inside a word.
// Anything unknown gets the pit droid.
export function matchKind(name) {
  const s = norm(name);
  if (!s) return "generic";
  for (const k of KINDS) if (k.match.some((m) => norm(m) === s)) return k.id;
  for (const k of KINDS) if (k.match.some((m) => has(s, norm(m)))) return k.id;
  for (const k of KINDS) if (k.match.some((m) => norm(m).length >= 4 && s.includes(norm(m)))) return k.id;
  return "generic";
}

// ---- node helpers

const b = (x, y, w, h, bg, o = {}) => ({ n: "b", x, y, w, h, bg, ...o });
const t = (x, y, label, o = {}) => ({ n: "t", x, y, t: label, size: 8, color: "#888", ...o });
const g = (o) => ({ n: "g", x: 0, y: 0, w: W, h: H, ...o });

// Detail that only survives at bay and depot sizes.
export const FINE = 0.4;
const fine = (n) => ({ ...n, min: FINE });

const EASE = "ease-in-out";
const pulse = (period, from = 0.25, to = 1) => ({ p: "opacity", from, to, period, easing: EASE });
const bob = (period, to = -3) => ({ p: "top", from: 0, to, period, easing: EASE });
const swing = (p, from, to, period, easing = EASE) => ({ p, from, to, period, easing });

// The right-hand twin of a part drawn on the left.
const flip = (x, w) => W - x - w;

// A status lamp: colour per state, blinking when something is happening.
function lamp(x, y, s, state, P) {
  const c = P[state] ?? P.idle;
  if (state === "working") return b(x, y, s, s, c, { r: s / 2, anim: pulse(520, 0.35, 1) });
  if (state === "blocked") return b(x, y, s, s, c, { r: s / 2, anim: pulse(300, 0.2, 1) });
  if (state === "done") return b(x, y, s, s, c, { r: s / 2, op: 1 });
  return b(x, y, s, s, "transparent", { r: s / 2, bd: [1, c], op: 0.85 });
}

// Ground shadow: stays on the floor while the body moves, and breathes under a
// hovering droid.
function shadow(x, w, P, hover) {
  const op = P.shadowOp;
  return b(x, 68, w, 3, P.shadow, {
    ground: true,
    r: 1.5,
    op,
    anim: hover ? { p: "opacity", from: op, to: op * 0.45, period: 1800, easing: EASE } : null,
  });
}

// Above-head alert beacon with a halo, for blocked.
function beacon(P, cx) {
  return [
    b(cx - 7, -2.5, 14, 14, P.alert, { r: 7, op: 0.14, anim: pulse(700, 0.08, 0.34) }),
    b(cx - 2.5, 2, 5, 5, P.alert, { r: 2.5, anim: pulse(360, 0.25, 1) }),
  ];
}

// "zzz" for a sleeping droid: one label, cycling glyphs.
function snooze(P, [x]) {
  return t(x, 2, "z", {
    size: 10, color: P.dim, weight: 600, frames: ["·", "z", "Z", "z"], ms: 700, min: FINE,
    anim: { p: "top", from: 7, to: 0, period: 2600, easing: EASE },
  });
}

// A small floating glyph near the head (✓ when done, ! when blocked).
function mark(state, P, [x, y]) {
  if (state === "done") return t(x, y, "✓", { size: 13, color: P.done, weight: 700, min: FINE, anim: pulse(1400, 0.45, 1) });
  if (state === "blocked") return t(x + 2, y, "!", { size: 14, color: P.alert, weight: 800, min: FINE, anim: pulse(360, 0.2, 1) });
  return null;
}

// Whole-droid motion for each state: hop when done, shudder when blocked, float
// when a hoverer works, a slow breath when idle.
function bodyAnim(state, k) {
  if (state === "working") return k.move ?? (k.hover ? bob(1500, -3) : bob(1100, -1.2));
  if (state === "done") return bob(760, -4);
  if (state === "blocked") return { p: "left", from: -1, to: 1, period: 460, easing: EASE };
  return { p: "opacity", from: 0.9, to: 0.76, period: 3200, easing: EASE };
}

const eyeColor = (state, A, P) => (state === "idle" ? P.dim : A.eye);

// A round lens: dark socket, lit iris, a glint.
function lens(cx, cy, d, color, P, state, anim = null) {
  const i = d * 0.62;
  return [
    b(cx - d / 2, cy - d / 2, d, d, P.visor, { r: d / 2, bd: [1, P.outline] }),
    b(cx - i / 2, cy - i / 2, i, i, color, { r: i / 2, op: state === "idle" ? 0.5 : 1, anim }),
    fine(b(cx - i / 4, cy - i / 3, i / 3, i / 3, "#ffffff", { r: i / 6, op: state === "idle" ? 0.25 : 0.8 })),
  ];
}

// A scanning holo-eye that sweeps left/right while working, sits still otherwise.
function sweeper(x, y, s, range, state, color) {
  return b(x, y, s, s, color, {
    r: s / 2,
    op: state === "idle" ? 0.45 : 1,
    anim: state === "working" ? { p: "left", from: x, to: x + range, period: 1500, easing: EASE }
      : state === "blocked" ? { p: "left", from: x, to: x + range, period: 380, easing: "linear" } : null,
  });
}

// ---- the droids

// R-unit astromech: a dome as wide as its drum, three legs. Claude Code.
// The same stance in every state; while it works a periscope pops up and the
// bars on its chest race.
function astromech(state, P, A) {
  const working = state === "working";
  const idle = state === "idle";
  const out = [shadow(6, 44, P, false)];
  // periscope: pops up out of the dome while working
  if (working) {
    out.push(g({ anim: swing("top", 5, 0, 1400), children: [
      b(26.5, 3, 3, 8, P.metal),
      b(24.5, 1.5, 7, 4, A.p1, { r: 1.5, bd: [1, P.outline] }),
    ] }));
  }
  // outer legs: hub, strut, ankle, foot
  for (const X of [(x) => x, (x, w) => flip(x, w)]) {
    out.push(b(X(4.5, 7), 36, 7, 22, P.hullShade, { r: 2, bd: [1, P.outline] }));
    out.push(b(X(5.5, 5), 57, 5, 5, P.metal));
    out.push(b(X(1.5, 13), 61, 13, 7, P.hullShade, { rt: 3.5, rb: 1, bd: [1, P.outline] }));
    out.push(b(X(2.5, 10), 30, 10, 10, P.hull, { r: 5, bd: [1, P.outline] }));
    out.push(fine(b(X(5.5, 4), 33, 4, 4, A.p2, { r: 2 })));
  }
  out.push(b(23, 56, 10, 6, P.metal));
  out.push(b(19, 61, 18, 7, P.hullShade, { rt: 3.5, rb: 1, bd: [1, P.outline] }));
  // drum
  out.push(b(12, 26, 32, 33, P.hull, { rt: 1, rb: 6, bd: [1, P.outline] }));
  out.push(fine(b(38, 29, 5, 25, P.hullShade, { r: 1.5, op: 0.6 })));
  out.push(b(16, 31, 9, 11, A.p1, { r: 1.5, bd: [1, P.outline] }));
  out.push(b(16, 44, 9, 10, A.p2, { r: 1.5, op: idle ? 0.55 : 1, bd: [1, P.outline] }));
  out.push(lamp(29, 34, 7, state, P));
  [45, 48.5, 52].forEach((y, i) => out.push(fine(b(28, y, 9, 1.8, working ? A.p1 : P.hullDark, {
    op: working ? 1 : 0.6,
    anim: working ? swing("width", 2.5, 9, 620 + i * 170) : null,
  }))));
  // dome and its collar
  out.push(b(12, 8, 32, 19, P.hull, { rt: 16, bd: [1, P.outline] }));
  out.push(fine(b(18, 11, 9, 1.8, "#ffffff", { r: 0.9, op: 0.8 })));
  out.push(b(11, 24, 34, 4, A.p1, { r: 1, bd: [1, P.outline] }));
  out.push(b(16, 13.5, 15, 9, P.visor, { r: 4.5, bd: [1, P.outline] }));
  out.push(sweeper(18, 15.5, 5, 6, state, eyeColor(state, A, P)));
  out.push(b(34, 13.5, 6, 6, A.p2, { r: 1.5, op: idle ? 0.55 : 1, bd: [1, P.outline] }));
  return out;
}

// Viper probe: a dark orb with a sensor band, two uneven masts and a fringe of
// dangling claws framing the beam it scans with. Codex.
function probe(state, P, A) {
  const idle = state === "idle";
  const working = state === "working";
  const blocked = state === "blocked";
  const out = [shadow(15, 26, P, true)];
  // the scan: a soft band with a bright core, in step with the iris
  if (working) {
    out.push(b(25, 44, 12, 23, A.eye, { r: 2, op: 0.13, anim: swing("left", 12, 32, 1700) }));
    out.push(b(25, 44, 2, 23, A.eye, { r: 1, op: 0.6, anim: swing("left", 17, 37, 1700) }));
  }
  // masts, uneven on purpose: they are its silhouette
  out.push(b(15.5, 4, 1.8, 12, P.hullDark));
  out.push(b(14, 1.5, 5, 5, idle ? P.hullDark : A.p1, { r: 2.5, anim: working ? pulse(700, 0.3, 1) : null }));
  out.push(b(38.6, 7, 1.8, 9, P.hullDark));
  out.push(b(37.3, 5, 4.4, 4.4, idle ? P.hullDark : A.p2, { r: 2.2, anim: working ? pulse(900, 0.3, 1) : null }));
  // dangling claws: arm and claw tip swing together
  [[12, 14], [19, 20], [35, 20], [42, 14]].forEach(([x, len], i) => {
    const n = len - (blocked ? 5 : 0);
    const period = 760 + i * 90;
    const [a, c] = working ? (i % 2 ? [-3, 2] : [2, -3]) : [0, 0];
    out.push(b(x, 42, 2.4, n, P.hullDark, { anim: working ? swing("height", n + a, n + c, period) : null }));
    out.push(b(x - 1.8, 42 + n, 6, 3.2, P.metal, { r: 1.2, bd: [1, P.outline], anim: working ? swing("top", 42 + n + a, 42 + n + c, period) : null }));
  });
  // side sensor pods
  const lift = blocked ? -5 : 0;
  for (const [x, a] of [[3, [22, 26]], [46, [26, 22]]]) {
    out.push(b(x, 24 + lift, 7, 11, P.metal, { r: 3.5, bd: [1, P.outline], anim: working ? swing("top", a[0], a[1], 640) : null }));
  }
  // the orb
  out.push(b(9, 12, 38, 34, A.shell, { r: 17, bd: [1, P.hullDark] }));
  out.push(fine(b(16, 15, 15, 3, P.hull, { r: 1.5, op: 0.28 })));
  out.push(b(11.5, 21, 33, 14, P.visor, { r: 7, bd: [1, P.hullDark] }));
  out.push(b(23, 23.5, 10, 9, idle ? P.dim : A.eye, {
    r: 4.5,
    op: idle ? 0.5 : 1,
    anim: working ? swing("left", 18, 28, 1700) : blocked ? pulse(320, 0.3, 1) : null,
  }));
  out.push(fine(b(14.5, 26.5, 3.4, 3.4, A.p1, { r: 1.7, op: idle ? 0.4 : 1 })));
  out.push(fine(b(38.1, 26.5, 3.4, 3.4, A.p1, { r: 1.7, op: idle ? 0.4 : 1 })));
  out.push(b(14, 38, 28, 3, A.p1, { r: 1.5, op: idle ? 0.4 : 0.95 }));
  return out;
}

// D-series hover pod: an egg with a wide visor between two big engine pods. pi.
function pod(state, P, A) {
  const idle = state === "idle";
  const out = [shadow(13, 30, P, true)];
  out.push(b(25, 7, 6, 8, A.p1, { rt: 3, bd: [1, P.outline] })); // dorsal fin
  // engine pods and their flames
  const flame = (x, from, to, period) => b(x, 46, 5.4, from, A.eye, { r: 2.7, op: 0.9, anim: { p: "height", from, to, period, easing: "linear" } });
  if (!idle) out.push(flame(4.8, 7, 14, 220), flame(45.8, 8, 13, 260));
  for (const x of [2, 43]) {
    out.push(b(x, 27, 11, 17, idle ? A.p2 : A.p1, { r: 4, bd: [1, P.outline] }));
    out.push(fine(b(x + 2, 29.5, 7, 2.2, "#ffffff", { r: 1.1, op: 0.45 })));
    out.push(b(x + 2, 43, 7, 3.5, P.metal, { r: 1, bd: [1, P.outline] }));
  }
  // the egg
  out.push(b(10, 12, 36, 40, P.hull, { r: 18, bd: [1, P.outline] }));
  out.push(fine(b(15, 41, 26, 8.5, P.hullShade, { rt: 2, rb: 12, op: 0.7 })));
  out.push(fine(b(18, 15, 10, 2, "#ffffff", { r: 1, op: 0.85 })));
  // visor
  out.push(b(13, 20, 30, 12.5, P.visor, { r: 6.25, bd: [1, P.outline] }));
  out.push(sweeper(17, 23, 6.5, 15.5, state, eyeColor(state, A, P)));
  // π, built from bars so it stays crisp when small
  const badge = idle ? P.hullDark : A.p2;
  out.push(b(21, 36, 14, 2.4, badge, { r: 1.2 }));
  out.push(b(24, 37, 2.4, 7, badge, { r: 1 }));
  out.push(b(29.8, 37, 2.4, 7, badge, { r: 1 }));
  out.push(fine(b(22, 42.4, 3.4, 1.8, badge, { r: 0.9 })));
  out.push(fine(b(31, 42.4, 3.4, 1.8, badge, { r: 0.9 })));
  return out;
}

// 3PO-class protocol droid: slim gold humanoid, exposed wiring at the waist, a
// crescent moon on the chest. It reads a long holo scroll while it works, waves
// when it needs you, throws both arms up when done. Kimi.
function protocol(state, P, A) {
  const idle = state === "idle";
  const working = state === "working";
  const blocked = state === "blocked";
  const done = state === "done";
  const out = [shadow(11, 34, P, false)];
  const plate = { bd: [1, P.outline] };
  // legs
  for (const [x, foot] of [[20, 16.5], [30, 29.5]]) {
    out.push(b(x + 0.5, 59, 5, 7, A.p2, { r: 1.5, ...plate }));
    out.push(b(x, 52, 6, 9, A.p1, { r: 2, ...plate }));
    out.push(b(foot, 64.5, 10, 4, A.p2, { rt: 2.5, rb: 0.5, ...plate }));
  }
  // waist: exposed wiring between chest and pelvis
  out.push(b(23, 42, 10, 8, P.metal));
  [["#d8604f", 24.6], ["#5b8fd0", 27.2], [P.signal, 29.8]].forEach(([c, x]) => out.push(fine(b(x, 42, 1.6, 8, c))));
  out.push(b(19, 48, 18, 6, A.p2, { rt: 2, rb: 5, ...plate }));
  // arms
  const arm = (x, up, handX = x - 0.5) => up
    ? [b(x, 18, 4.5, 15, A.p1, { r: 2, ...plate }), b(handX, 14.5, 5.5, 5, P.metal, { r: 2.5 })]
    : [b(x, 32, 4.5, 11, A.p2, { r: 2, ...plate }), b(x, 41, 4.5, 10, A.p1, { r: 2, ...plate }), b(handX, 50, 5.5, 4, P.metal, { r: 2 })];
  out.push(...arm(12.5, done));
  if (working) {
    // a long holo scroll paying out from its hand
    out.push(b(39, 32, 4.5, 11, A.p2, { r: 2, ...plate }));
    out.push(b(33, 42, 11, 4.5, A.p1, { r: 2, ...plate }));
    out.push(b(41.5, 31, 12, 12, P.visor, { r: 1, bd: [1, P.hullDark], anim: swing("height", 12, 34, 2200) }));
    [34.5, 38, 41.5].forEach((y, i) => out.push(fine(b(43.5, y, 8 - i, 1.6, A.eye, { anim: pulse(700 + i * 180, 0.3, 1) }))));
    out.push(b(39, 28.5, 17, 3.5, A.p2, { r: 1.7, ...plate }));
  } else if (blocked) {
    out.push(g({ anim: swing("left", -2, 3, 340), children: arm(39, true) }));
  } else {
    out.push(...arm(39, done));
  }
  // torso
  out.push(b(12, 27, 32, 6.5, A.p2, { r: 3.2, ...plate }));
  out.push(b(17, 28, 22, 16, A.p1, { rt: 4, rb: 9, ...plate }));
  out.push(fine(b(20, 30, 6, 1.8, A.p3, { r: 0.9 })));
  // crescent: navy disc, gold disc over it
  out.push(b(23, 31, 11, 11, A.moon, { r: 5.5 }));
  out.push(b(26.2, 31.2, 9.4, 9.4, A.p1, { r: 4.7 }));
  out.push(fine(lamp(19.5, 36, 3.6, state, P)));
  // head: it droops when idle
  const eye = eyeColor(state, A, P);
  const blink = working ? pulse(1100, 0.45, 1) : null;
  out.push(b(25, 24, 6, 4, P.metal));
  out.push(g({ y: idle ? 2 : 0, children: [
    b(18, 8.5, 20, 16.5, A.p1, { rt: 9, rb: 5, ...plate }),
    fine(b(21, 11, 8, 1.8, A.p3, { r: 0.9 })),
    ...lens(23.5, 17, 6.4, eye, P, state, blink),
    ...lens(32.5, 17, 6.4, eye, P, state, blink),
    fine(b(25, 22, 6, 1.4, A.p2, { r: 0.7 })),
  ] }));
  return out;
}

// GNK-class power droid: a charcoal box on two stubby legs that runs on anything
// you plug into it. It waddles while its charge cells fill. OpenCode.
function utility(state, P, A) {
  const idle = state === "idle";
  const working = state === "working";
  const blocked = state === "blocked";
  const done = state === "done";
  const out = [shadow(7, 42, P, false)];
  out.push(b(13, 8, 2.6, 8, P.metal));
  out.push(b(11.4, 5.5, 5.8, 3.4, idle ? P.metal : A.p1, { r: 1.7, anim: working ? pulse(800, 0.3, 1) : null }));
  // legs step in turn
  [[15, [-2, 0]], [33, [0, -2]]].forEach(([x, up]) => {
    out.push(b(x, 54, 8, 10, P.hullDark, { r: 1.5, anim: working ? swing("top", 54 + up[0], 54 + up[1], 560) : null }));
    out.push(b(x - 3, 63, 14, 5.5, P.hullShade, { rt: 3, rb: 1, bd: [1, P.outline], anim: working ? swing("top", 63 + up[0], 63 + up[1], 560) : null }));
  });
  // its universal plug
  out.push(b(46, 30, 7, 2.6, P.metal));
  out.push(b(50.5, 25.5, 5, 11.5, A.p1, { r: 1, bd: [1, P.outline], anim: working ? pulse(420, 0.35, 1) : null }));
  // hull and hazard band
  out.push(b(8, 14, 40, 43, A.shell, { r: 5, bd: [1, P.hullDark] }));
  out.push(b(8, 14, 40, 7.5, idle ? A.p2 : A.p1, { rt: 5, bd: [1, P.outline] }));
  for (let i = 0; i < 5; i++) out.push(fine(b(12 + i * 7.2, 15.8, 3.6, 4, P.visor, { r: 0.6, op: 0.85 })));
  out.push(b(13, 24, 30, 7, P.visor, { r: 3.5, bd: [1, P.hullDark] }));
  out.push(sweeper(16, 25.3, 4.4, 19, state, eyeColor(state, A, P)));
  // four charge cells: they carry the state
  out.push(b(12, 34.5, 32, 18, P.visor, { r: 2, bd: [1, P.hullDark] }));
  [15.5, 22.4, 29.3, 36.2].forEach((x, i) => {
    const c = blocked ? P.blocked : done ? P.done : idle ? P.idle : A.p1;
    out.push(b(x, 37.5, 5.2, 12, c, {
      r: 1,
      op: idle ? 0.35 : 1,
      anim: working ? pulse(700 + i * 160, 0.15, 1) : blocked ? pulse(300, 0.2, 1) : null,
    }));
  });
  return out;
}

// Pit droid for anything unrecognised: a wide cap, one lens, thin limbs. It
// hammers while it works and folds into a bundle when idle.
function generic(state, P, A) {
  const idle = state === "idle";
  const working = state === "working";
  const blocked = state === "blocked";
  const done = state === "done";
  const drop = idle ? 14 : 0;
  const out = [shadow(14, 28, P, false)];
  for (const [x, foot] of [[21.5, 17], [31.5, 28]]) {
    out.push(b(x, 44 + drop, 3, 20 - drop, P.metal, { r: 1.2 }));
    out.push(b(foot, 63, 11, 5, P.hullDark, { rt: 2.5, rb: 0.5, bd: [1, P.outline] }));
  }
  const arm = (x, hand, o) => g({ ...o, children: [
    b(x, 34, 2.8, 19, P.metal, { r: 1.2 }),
    b(hand, 52, 7, 4, P.hullShade, { r: 1.5, bd: [1, P.outline] }),
  ] });
  if (working) {
    out.push(arm(12.5, 10.4, { anim: swing("top", 0, -9, 520) }), arm(40.7, 38.6, { anim: swing("top", -9, 0, 520) }));
  } else if (blocked) {
    out.push(arm(12.5, 10.4, { y: -13 }), g({ anim: swing("left", -2, 3, 320), children: [arm(40.7, 38.6, { y: -13 })] }));
  } else {
    const y = done ? -13 : drop;
    out.push(arm(12.5, 10.4, { y }), arm(40.7, 38.6, { y }));
  }
  out.push(b(12.5, 34 + drop, 31, 3, P.metal, { r: 1.5 }));
  out.push(b(21, 34 + drop, 14, 12, P.hullShade, { rt: 3, rb: 6, bd: [1, P.outline] }));
  out.push(lamp(25.5, 37 + drop, 5, state, P));
  out.push(b(26.5, 26 + drop, 3, 9, P.metal));
  out.push(g({ y: drop, children: [
    b(18, 18, 20, 11, P.hullShade, { rb: 7, bd: [1, P.outline] }),
    b(11, 9, 34, 10, A.p1, { rt: 15, rb: 2, bd: [1, P.outline] }),
    fine(b(18, 11.5, 11, 1.8, "#ffffff", { r: 0.9, op: 0.65 })),
    ...lens(28, 23, 10, eyeColor(state, A, P), P, state, working ? pulse(900, 0.5, 1) : null),
  ] }));
  return out;
}

// Empty charging cradle: a terminal with no agent reporting.
export function cradle(P) {
  return [
    b(12, 58, 32, 6, P.metal, { r: 3 }),
    b(15, 60, 26, 2, P.deck, { r: 1 }),
    b(16, 18, 24, 34, "transparent", { r: 6, bd: [1.5, P.input], op: 0.6 }),
    b(22, 26, 12, 6, "transparent", { r: 3, bd: [1.5, P.input], op: 0.4 }),
    t(16, 40, "no link", { size: 7, color: P.dim, align: "center", w: 24, op: 0.8 }),
  ];
}

const BUILD = { astromech, probe, pod, protocol, utility, generic };

// Build a droid: kind id + state + palette -> { w, h, children }. The shadow
// stays on the floor and the marks stay put; only the body between them moves.
export function build(kind, state, P) {
  const k = kindOf(kind);
  const st = STATES.includes(state) ? state : "idle";
  const parts = (BUILD[k.id] ?? generic)(st, P, k.art).filter(Boolean);
  const tag = k.tag ?? [44, 1];
  const body = g({
    y: st === "idle" ? (k.settle ?? (k.hover ? 3 : 0)) : 0, // it sinks a little when it rests
    op: st === "idle" ? 0.9 : 1,
    anim: bodyAnim(st, k),
    children: parts.filter((n) => !n.ground),
  });
  return {
    w: W,
    h: H,
    children: [
      ...parts.filter((n) => n.ground),
      body,
      ...(st === "blocked" ? beacon(P, k.cx ?? W / 2) : []),
      st === "idle" ? snooze(P, tag) : mark(st, P, tag),
    ].filter(Boolean),
  };
}

// Scale a built tree into a smaller box (list rows use k < 1). Opacity loops
// are not lengths, and a limb too thin to hold an outline at small sizes goes
// without one. Only FINE from outside: preview/build.mjs embeds its source.
export function scale(node, k) {
  if (!node) return node;
  const s = (v) => (v == null ? v : Math.round(v * k * 100) / 100);
  const out = { ...node };
  for (const p of ["x", "y", "w", "h", "r", "rt", "rb", "size"]) if (p in node) out[p] = s(node[p]);
  const thin = k < FINE && node.bg !== "transparent" && Math.min(node.w, node.h) * k < 2.5;
  if (node.bd) out.bd = thin ? null : [Math.max(0.5, s(node.bd[0])), node.bd[1]];
  if (node.anim && node.anim.p !== "opacity") out.anim = { ...node.anim, from: s(node.anim.from), to: s(node.anim.to) };
  if (node.children) out.children = node.children.filter((c) => !(c.min > k)).map((c) => scale(c, k));
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
    shadow: dark ? "#000000" : "#6d7682",
    shadowOp: dark ? 0.5 : 0.32,
    visor: c("visor", "#081019", "#1c2935"),
    outline: c("outline", "#0b1320", "#55626f"),
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
