// The droid depot: a drawer on the right edge of the work area, showing every
// droid with the most urgent nearest the top. It's a `peek` block in the layout,
// so only its edge strip shows until the pointer comes near.
//
// A floating mod must draw one full layout and never change it on hover — that
// is what keeps the slide smooth — so the width is fixed and the edge side of
// every row carries what has to be readable while tucked in: the lamp, then the
// droid.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, placement, focused, run, theme } from "herdr";
import { droid, lamp, kindId } from "./kit.js";
import { kindOf } from "./droids.js";

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };

export function renderDepot() {
  const t = theme();
  const pl = placement();
  const horizontal = pl ? !pl.vertical : false;
  const list = [...agents()].sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0) || (b.seq ?? 0) - (a.seq ?? 0));

  const row = (a) => {
    const on = focused()?.agent === a.address;
    const kind = kindId(a.app ?? a.program?.key);
    return h_flex()
      .id(`depot-${a.address}`)
      .h(40).flex_none().px(7).gap(9).items_center().rounded(8)
      .cursor_pointer()
      .when(on, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      // inner side first (the story), edge side last (the peek): name, task,
      // then the droid and its lamp, which is what stays visible when tucked.
      .child(
        v_flex().flex_1().min_w(0).gap(1)
          .child(div().text_size(11.5).font_medium().truncate()
            .text_color(a.status === "idle" ? t.muted : t.foreground)
            .child(a.program?.name || kindOf(kind).name))
          .child(div().text_size(10.5).truncate().text_color(t.dim)
            .child([a.space_name, a.status === "blocked" ? "needs you" : ""].filter(Boolean).join(" · "))))
      .child(droid(t, kind, a.status, { w: 22, h: 28, scale: 0.42, oy: -1 }))
      .child(lamp(t, a.status, 6));
  };

  const head = h_flex().h(24).px(8).gap(6).items_center().text_size(10.5).font_medium().text_color(t.dim)
    .child(div().child("DEPOT"))
    .child(div().child(String(list.length)))
    .child(div().flex_1().border_b(1).border_color(t.border).h(0));

  const empty = div().px(10).py(8).text_size(11).text_color(t.dim)
    .child(list.length ? "" : "No droids docked.");

  if (horizontal) {
    return h_flex().flex_none().max_w(560).p(5).gap(4).items_center()
      .child(head.w(70))
      .children(list.slice(0, 6).map(row))
      .when(!list.length, (el) => el.child(empty));
  }
  return v_flex().w(244).p(5).gap(2)
    .child(head)
    .when(!list.length, (el) => el.child(empty))
    .children(list.map(row));
}
