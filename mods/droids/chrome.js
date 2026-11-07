// The deck's chrome: the brand bar, the sidebar footer and the status bar.

import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, window, layout, spaces, agents, keys, updates, shared, setShared } from "herdr";
import { stars, c, isDark } from "./kit.js";

const find = (node, id) => {
  if (node?.id === id) return node;
  for (const ch of node?.children ?? []) { const f = find(ch, id); if (f) return f; }
  return null;
};
const rail = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 170;

function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!rail()) setShared("sidebar.width", width);
  setShared("sidebar.collapsed", !rail());
  run("layout.resize", { id: "sidebar", px: rail() ? (shared("sidebar.width") ?? 300) : window()?.platform === "macos" ? 78 : 44 });
}

const icon = (t, name, size = 15, color) => svg(`mods/droids/icons/${name}.svg`).size(size).flex_none().text_color(color ?? t.muted);

// What the palette key actually is on this machine, so the hint never lies.
function paletteHint() {
  const mac = window()?.platform === "macos";
  const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
  const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
  const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
  const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
  return key ? `${key}  commands` : "commands";
}

export function renderBrand() {
  const t = theme();
  const collapsed = rail();
  const w = window();
  const macRoom = w?.platform === "macos" && !w?.fullscreen && !collapsed;
  const holo = c(t, "holo", "#6fd3e8", "#1f7a8c");
  const button = (id, name, action, tip) =>
    div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6)
      .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(action).child(icon(t, name));
  return h_flex().size_full().bg(t.chrome).pl(macRoom ? 82 : collapsed ? 8 : 16).pr(10).gap(8).items_center()
    .children(stars(t, 20))
    .when(!collapsed, (el) => el
      .child(div().text_size(17).flex_none().text_color(holo).child("◈")
        .loop("opacity", { from: 0.55, to: 1, period: 2600 }))
      .child(v_flex().flex_1().min_w(0).gap(0)
        .child(div().text_size(13).font_semibold().text_color(t.foreground).child("HERDR"))
        .child(div().text_size(10).text_color(t.dim).child("droid command"))))
    .when(!collapsed, (el) => el.child(button("droids-search", "search", () => run("mod.open", { name: "picker" }), "Search spaces, tabs and files")))
    .when(!(collapsed && w?.platform === "macos"), (el) => el.child(button("droids-rail", "sidebar", toggleSidebar, "Fold the sidebar")))
    .when(collapsed, (el) => el.child(
      div().id("droids-rail-open").w_full().h(22).flex().items_center().justify_center().text_size(13)
        .text_color(t.dim).hover((s) => s.text_color(t.foreground)).on_click(toggleSidebar).child("»")));
}

export function renderFooter() {
  const t = theme();
  const collapsed = rail();
  const row = (id, name, label, dim, action) =>
    h_flex().id(id).h(24).px(8).gap(9).items_center().rounded(7).cursor_pointer()
      .text_color(dim ? t.dim : t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .child(icon(t, name, 14, dim ? t.dim : t.muted))
      .when(!collapsed, (el) => el.child(div().text_size(12.5).child(label)));
  return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).px(8).pt(5).pb(7).gap(2)
    .child(row("droids-settings", "settings", "Settings", false, () => run("app.settings"))
      .when(Boolean(updates().app.ready), (el) => el.child(div().size(6).rounded(3).bg(t.accent))))
    .child(row("droids-machine", "plus", "Add machine", true, () => run("mod.open", { name: "machine-add" })));
}

export function renderStatus() {
  const t = theme();
  const space = spaces().find((s) => s.active);
  const list = agents();
  const needs = list.filter((a) => a.status === "blocked").length;
  const holo = c(t, "holo", "#6fd3e8", "#1f7a8c");
  const label = (name, text) =>
    h_flex().gap(6).items_center().flex_none().child(icon(t, name, 13, t.dim)).child(div().child(text));
  const bit = (text) => div().flex_none().text_color(t.muted).child(text);
  // The deck's read-out: one lamp per droid, most urgent first.
  const rank = { blocked: 4, done: 3, working: 2, idle: 1 };
  const lamps = [...list].sort((a, b) => rank[b.status] - rank[a.status]).slice(0, 10).map((a, i) =>
    div().size(6).flex_none().rounded(3)
      .when(a.status === "idle", (el) => el.border(1).border_color(t.idle))
      .when(a.status !== "idle", (el) => el.bg(t[a.status] ?? t.idle)
        .when(a.status === "blocked", (e2) => e2.loop("opacity", { from: 0.25, to: 1, period: 320 }))
        .when(a.status === "working", (e2) => e2.loop("opacity", { from: 0.4, to: 1, period: 620 }))));
  return h_flex().size_full().px(14).gap(14).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
    .child(h_flex().gap(6).items_center().flex_none().child(div().text_color(holo).child("◈")).child(div().child(space?.machine ?? "this machine")))
    .when(Boolean(space?.branch), (el) => el.child(label("branch", space.branch)))
    .when(lamps.length, (el) => el.child(h_flex().gap(4).items_center().flex_none().children(lamps)))
    .child(bit(`${list.length} droid${list.length === 1 ? "" : "s"}`))
    .when(needs > 0, (el) => el.child(div().text_color(t.blocked).child(`${needs} needs you`)))
    .child(div().flex_1())
    .child(div().id("droids-palette").text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
      .on_click(() => run("app.palette")).child(paletteHint()));
}
