// Drawing kit for the droids layout: turns the spec tree in droids.js into
// gpui-kit elements, plus the small themed parts every panel shares.
//
// The preview (preview/app.js) renders the very same tree, so what you see in
// the browser is what the app draws.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { settings } from "herdr";
import { build, scale as scaleTree, palette as specPalette, kindId, matchKind, kindOf, STATES } from "./droids.js";

// Theme colors with fallbacks: custom names (hull, holo, deck, ...) come from
// themes/droids-*.json; if a theme lacks one, the fallback keeps the look.
export function c(t, name, dark, light) {
  return t[name] ?? (isDark() ? dark : light);
}

export function isDark() {
  // The appearance now: settings() carries it, theme() doesn't.
  return settings()?.dark !== false;
}

export function paletteOf(t) {
  return specPalette(t, isDark());
}

// ---- spec tree -> elements

function box(node) {
  let e = div().absolute().left(node.x ?? 0).top(node.y ?? 0);
  if (node.w != null) e = e.w(node.w);
  if (node.h != null) e = e.h(node.h);
  if (node.bg && node.bg !== "transparent") e = e.bg(node.bg);
  if (node.bd) e = e.border(node.bd[0]).border_color(node.bd[1]);
  if (node.r != null) e = e.rounded(node.r);
  if (node.rt != null) e = e.rounded_t(node.rt);
  if (node.rb != null) e = e.rounded_b(node.rb);
  if (node.op != null) e = e.opacity(node.op);
  return e;
}

function looped(e, node) {
  const a = node.anim;
  if (!a) return e;
  const policy = { from: a.from, to: a.to, period: Math.max(100, a.period ?? 1000), easing: a.easing ?? "ease-in-out" };
  if (a.p === "left") e = e.left(policy.from);
  if (a.p === "top") e = e.top(policy.from);
  if (a.p === "width") e = e.w(policy.from);
  if (a.p === "height") e = e.h(policy.from);
  return e.loop(a.p, policy);
}

export function node(spec) {
  let e = box(spec);
  if (spec.n === "t") {
    e = e.text_size(spec.size ?? 8).text_color(spec.color ?? "#888");
    if (spec.weight) e = e.font_weight(spec.weight);
    if (spec.w) e = e.w(spec.w);
    if (spec.align === "center") e = e.text_center();
    e = spec.frames ? e.frames(spec.frames, spec.ms ?? 700) : e.child(String(spec.t ?? ""));
  }
  e = looped(e, spec);
  const kids = spec.children ?? [];
  if (kids.length) e = e.children(kids.map(node));
  return e;
}

// A droid in a fixed box: kind + state, scaled and centred in it. The art
// sits in its own positioned frame so a hop or a lean (.loop on top/left)
// moves the droid inside the box instead of moving the box.
export function droid(t, kind, state, o = {}) {
  const spec = scaleTree(build(kindId(kind), state, paletteOf(t)), o.scale ?? 1);
  return droidSpec(spec, o);
}

export function droidSpec(spec, o = {}) {
  const hostW = o.w ?? spec.w, hostH = o.h ?? spec.h;
  const left = Math.round(((hostW - spec.w) / 2 + (o.ox ?? 0)) * 100) / 100;
  const top = Math.round(((hostH - spec.h) / 2 + (o.oy ?? 0)) * 100) / 100;
  const art = node({ ...spec, x: 0, y: 0 });
  const frame = div().absolute().left(left).top(top).w(spec.w).h(spec.h).child(art);
  return div().relative().flex_none().w(hostW).h(hostH).child(frame);
}

// ---- shared panel parts

// A tiny round status light; blinks while something is happening.
export function lamp(t, status, size = 7) {
  const color = t[status] ?? t.idle;
  let e = div().size(size).flex_none().rounded(size / 2);
  if (status === "idle") return e.border(1.5).border_color(color);
  e = e.bg(color);
  if (status === "working") return e.loop("opacity", { from: 0.35, to: 1, period: 520 });
  if (status === "blocked") return e.loop("opacity", { from: 0.2, to: 1, period: 300 });
  return e;
}

export function chip(t, text, color) {
  return div().flex_none().px(6).h(16).flex().items_center().rounded(5)
    .text_size(10).font_semibold().text_color(color)
    .bg(color + "1a").border(1).border_color(color + "55")
    .child(text);
}

// Panel header: SECTION + a quiet caption, something optional on the right.
export function head(t, label, sub, right, pad = 16) {
  return h_flex().px(pad).h(40).pt(12).pb(4).flex_none().gap(8).items_center()
    .child(div().text_size(11.5).font_semibold().text_color(t.muted).child(label))
    .when(Boolean(sub), (el) => el.child(div().text_size(10.5).text_color(t.dim).child(sub)))
    .child(div().flex_1())
    .when(Boolean(right), (el) => el.child(right));
}

// Deterministic pseudo-random, so the starfield doesn't jump every render.
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// A quiet starfield for bars: still, only twinkling natively.
export function stars(t, count = 22, tint) {
  const color = tint ?? c(t, "holo", "#6fd3e8", "#1f7a8c");
  const out = [];
  for (let i = 0; i < count; i++) {
    const size = hash(i) > 0.78 ? 2 : 1;
    out.push(
      div().absolute()
        .left(Math.round(hash(i + 1) * 96) + "%")
        .top(Math.round(hash(i + 7) * 80) + "%")
        .w(size).h(size).rounded(size / 2)
        .bg(color)
        .opacity(0.25)
        .loop("opacity", { from: 0.08, to: isDark() ? 0.5 : 0.3, period: 2000 + Math.round(hash(i + 3) * 2600) })
    );
  }
  return out;
}

// kindId() accepts a kind id or an agent name (program.key / app / program name).
export { kindId, matchKind, kindOf, STATES };
