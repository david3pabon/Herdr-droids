// A pane's header: the droid that runs in it, what it is called, where it is,
// and the buttons that split, zoom and close this pane.

import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home } from "herdr";
import { droid, lamp, chip, kindId } from "./kit.js";

// Icons live in this mod's folder so the layout travels on its own.
const glyph = (t, name, size = 14) => svg(`mods/droids/icons/${name}.svg`).size(size).flex_none().text_color(t.dim);

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export function renderPane(cx, self) {
  const t = theme();
  const p = panes().find((x) => x.pane === props()?.pane);
  if (!p) return div();
  const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
  const pane = p.pane;
  const on = self.hovered === pane;
  const st = p.status;
  const button = (id, icon, command, args) =>
    div().id(id).p(3).rounded(4).flex().items_center().text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); run(command, { ...args, pane }); })
      .child(glyph(t, icon));
  return h_flex().id(`droids-pane-${pane}`).size_full().px(10).gap(9).items_center()
    .bg(t.background).border_b(1).border_color(t.border).text_size(12)
    .on_hover((hovered, cx) => { self.hovered = hovered ? pane : null; cx.notify(); })
    .on_click(() => run("pane.focus", { pane }))
    .child(p.program?.agent
      ? droid(t, kindId(p.app ?? p.program.key), st ?? "idle", { w: 20, h: 24, scale: 0.32, oy: -1 })
      : div().w(20).flex_none().flex().items_center().justify_center().text_color(t.dim).child("▮"))
    .child(div().flex_none().truncate().max_w(240).font_medium().text_color(t.foreground).child(name))
    .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
    .when(Boolean(st), (el) => el.child(
      st === "blocked" ? chip(t, "needs you", t.blocked)
        : st === "done" ? chip(t, "done", t.done)
        : st === "working" ? chip(t, "working", t.working)
        : lamp(t, "idle", 6)))
    .when(on, (el) => el
      .child(button(`dp-r-${pane}`, "split-right", "pane.split", { direction: "right" }))
      .child(button(`dp-d-${pane}`, "split-down", "pane.split", { direction: "down" }))
      .child(button(`dp-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom"))
      .child(button(`dp-x-${pane}`, "close", "pane.close")));
}
