// The droid bays: one row per agent, each with its droid, what it is working
// on, and how long it has been in that state. Pinned droids keep a berth at the
// top; sub-agents an agent started hang under it as a small tree, and peek.
// Droids come from droids.js — one per kind of coding agent, animated per state.

import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, terminals, panes, focused, spaces, run, theme, shared, setShared, setAgentOrder, layout } from "herdr";
import { droid, lamp, chip, head, taskOf, STATES } from "./kit.js";
import { kindId, kindOf } from "./droids.js";

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const SECTION = { 4: "Needs you", 3: "Done", 2: "Working", 1: "Idle" };
const SORTS = [
  { id: "priority", label: "Priority" },
  { id: "space", label: "By space" },
];
const sortOf = () => SORTS.find((s) => s.id === shared("droids.sort")) ?? SORTS[0];

const find = (node, id) => {
  if (node?.id === id) return node;
  for (const ch of node?.children ?? []) { const f = find(ch, id); if (f) return f; }
  return null;
};
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 170;

function duration(ms) {
  if (!ms) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// A sub-agent without a pane isn't in agents(): take its raw word, count an
// error as blocked, and never let it be done — it reports to its parent, and
// the parent's "done" is the news. Any other word is treated as idle.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" || !STATES.includes(s) ? "idle" : s;
};

// The pane that speaks for a tab: its agent, else the focused terminal.
function leadPanes(all) {
  const leads = new Map();
  for (const p of all) {
    if (!p.terminal) continue;
    const cur = leads.get(p.tab);
    if (!cur || (!cur.program?.agent && (p.program?.agent || (!cur.focused && p.focused)))) leads.set(p.tab, p);
  }
  return leads;
}

export function renderAgents(cx, self) {
  const t = theme();
  const list0 = agents();
  const all = terminals();
  const collapsed = narrow();
  const sort = sortOf();
  const now = Date.now();
  const folded = self.folded ?? new Set();
  self.folded = folded;

  // When each agent entered its state. Done and idle count as one: glancing at
  // a finished agent turns it idle, and that isn't the agent doing anything.
  const changed = (self.changed ??= JSON.parse(localStorage.getItem("changed") ?? "{}"));
  let dirty = false;
  for (const a of list0) {
    const s = a.status === "done" ? "idle" : a.status;
    if (changed[a.address]?.s === s) continue;
    changed[a.address] = { s, at: now };
    dirty = true;
  }
  if (dirty) {
    const live = new Set(list0.map((a) => a.address));
    for (const [k, v] of Object.entries(changed)) if (!live.has(k) && now - v.at > 30 * 86400000) delete changed[k];
    localStorage.setItem("changed", JSON.stringify(changed));
  }
  const since = (a) => changed[a.address]?.at ?? 0;
  const listed = new Map(list0.map((a) => [a.address, a.status]));

  // Live sub-agents of an agent, depth first, each with the tree lines to draw.
  const kidsOf = (addr) => all.filter((k) => k.parent === addr && k.state === "live");
  const tree = (addr, lead = []) => kidsOf(addr).flatMap((k, i, arr) => {
    const last = i === arr.length - 1;
    return [{ t: k, lines: [...lead, last ? "└" : "├"] }, ...tree(k.address, [...lead, last ? "" : "│"])];
  });

  let list = [...list0];
  if (sort.id === "priority") list.sort((x, y) => (RANK[y.status] ?? 0) - (RANK[x.status] ?? 0) || since(y) - since(x) || y.seq - x.seq);
  const pinned = list.filter((a) => a.pinned);
  list = [...pinned, ...list.filter((a) => !a.pinned)];
  setAgentOrder(list.map((a) => a.address));

  const leads = leadPanes(panes());
  const tabs = new Map(spaces().flatMap((s) => s.tabs ?? []).map((tab) => [tab.id, tab]));

  const pin = (a) => div()
    .id(`bay-pin-${a.address}`)
    .flex_none().p(3).rounded(5).text_color(a.pinned ? t.muted : t.dim)
    .cursor_pointer()
    .tooltip(a.pinned ? "Let this droid go back to the ranks" : "Keep this droid at the top")
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .on_click((_e, cx) => {
      cx.stop_propagation();
      run("terminal.pin", { terminal: a.address, pinned: !a.pinned });
      self.hovered = null; // the row moves out from under the pointer
      cx.notify();
    })
    .child(svg(`mods/droids/icons/${a.pinned ? "pin-off" : "pin"}.svg`).size(13).flex_none());

  // A sub-agent: tree lines, a small droid, its name, its lamp. Click to peek.
  const subRow = (s, parent) => {
    const k = s.t;
    const st = kidStatus(k, listed);
    const on = focused()?.agent === k.address;
    return h_flex()
      .id(`bay-sub-${k.address}`)
      .h(26).flex_none().pl(8).pr(8).gap(0).items_center().rounded(7)
      .text_size(12)
      .when(on, (el) => el.bg(t.raised))
      .cursor_pointer().hover((s2) => s2.bg(t.hover))
      .on_click(() => run("terminal.peek", { terminal: k.address }))
      .children(s.lines.map((l, i) => div().self_start().mt(-3).w(9).h(16).mr(4).flex_none()
        .when(Boolean(l), (el) => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", (el) => el.border_b(1.5).rounded_bl(6))))
      .child(div().mr(7).child(droid(t, kindId(k.program?.key ?? k.app), st, { w: 15, h: 19, scale: 0.27 })))
      .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.muted)
        .child(k.name || k.template || k.program?.name || k.address))
      .child(lamp(t, st, 6));
  };

  const row = (a) => {
    const kind = kindId(a.app ?? a.program?.key);
    const task = taskOf(tabs.get(a.tab), leads.get(a.tab)) || a.program?.name || "";
    const idle = a.status === "idle" && !a.focused;
    const kids = collapsed || folded.has(a.address) ? [] : tree(a.address);
    const hasKids = kidsOf(a.address).length > 0;
    if (collapsed) {
      return [
        h_flex().id(`bay-${a.address}`).h(30).px(6).flex_none().gap(3).items_center().justify_center()
          .rounded(7)
          .when(a.focused, (el) => el.bg(t.selected))
          .hover((s) => s.bg(t.hover))
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .child(droid(t, kind, a.status, { scale: 0.3, w: 18, h: 22, oy: -1 }))
          .child(lamp(t, a.status, 5)),
      ];
    }
    return [
      h_flex()
        .id(`bay-${a.address}`)
        .h(62).flex_none().px(8).mb(2).gap(10).items_center().rounded(9)
        .cursor_pointer()
        .when(a.focused, (el) => el.bg(t.raised))
        .hover((s) => s.bg(t.hover))
        .on_hover((on, cx) => { self.hovered = on ? a.address : (self.hovered === a.address ? null : self.hovered); cx.notify(); })
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .child(droid(t, kind, a.status, { w: 40, h: 50, scale: 0.68 }))
        .child(
          v_flex().flex_1().min_w(0).gap(2)
            .child(
              h_flex().gap(6).items_center()
                .child(div().min_w(0).truncate().text_size(13).font_semibold()
                  .text_color(idle ? t.muted : t.foreground).child(a.program?.name || kindOf(kind).name))
            )
            .child(div().text_size(11.2).truncate().text_color(idle ? t.dim : t.muted).child(task))
            .child(
              h_flex().gap(7).items_center().mt(2)
                .child(chip(t, a.status === "blocked" ? "needs you" : a.status, t[a.status] ?? t.idle))
                .child(div().text_size(10.5).truncate().text_color(t.dim)
                  .child([a.space_name, duration(now - since(a))].filter(Boolean).join(" · ")))
            )
        )
        // right-hand cluster: fold, pin (on hover), then the state lamp
        .when(hasKids, (el) => el.child(
          div().id(`bay-fold-${a.address}`).flex_none().p(3).rounded(5).text_color(t.dim).cursor_pointer()
            .tooltip(folded.has(a.address) ? `Show ${kidsOf(a.address).length} sub-agent(s)` : "Hide sub-agents")
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_click((_e, cx) => {
              cx.stop_propagation();
              folded.has(a.address) ? folded.delete(a.address) : folded.add(a.address);
              cx.notify();
            })
            .child(svg(`mods/droids/icons/chevron-${folded.has(a.address) ? "right" : "down"}.svg`).size(11).flex_none())))
        .when(self.hovered === a.address || a.pinned, (el) => el.child(pin(a)))
        .child(lamp(t, a.status, 7)),
      ...kids.map((s) => subRow(s, a)),
    ];
  };

  // Group headers: pinned first, then priority sections or one group per space.
  const groups = [];
  if (pinned.length) groups.push({ id: "pinned", label: "Pinned berths", status: null, members: pinned });
  for (const a of list) {
    if (a.pinned) continue;
    const id = sort.id === "priority" ? `s${RANK[a.status] ?? 0}` : `p${a.space}`;
    const label = sort.id === "priority" ? SECTION[RANK[a.status] ?? 1] : a.space_name || "";
    const status = sort.id === "priority" ? a.status : null;
    if (groups.at(-1)?.id === id) groups.at(-1).members.push(a);
    else groups.push({ id, label, status, members: [a] });
  }
  const header = (g) =>
    h_flex().px(8).h(26).flex_none().gap(6).items_center().text_size(11).font_medium().text_color(t.muted)
      .when(g.status, (el) => el.child(div().size(6).rounded(3).bg(t[g.status] ?? t.idle)))
      .when(g.id === "pinned", (el) => el.child(svg("mods/droids/icons/pin.svg").size(11).flex_none().text_color(t.accent)))
      .child(div().truncate().child(g.label))
      .child(div().text_color(t.dim).child(String(g.members.length)))
      .child(div().flex_1().border_b(1).border_color(t.border).h(0));

  const toggle = div()
    .id("droids-sort")
    .h(22).px(7).flex().items_center().rounded(6).text_size(10.5).text_color(t.dim)
    .cursor_pointer()
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .tooltip(`Sort: ${sort.label} — click to change`)
    .on_click(() => setShared("droids.sort", sort.id === "priority" ? "space" : "priority"))
    .child("⇅");

  const body = collapsed
    ? list.flatMap(row)
    : groups.flatMap((g) => folded.has(g.id) ? [] : [header(g), ...g.members.flatMap(row)]);

  return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
    .when(!collapsed, (el) => el.child(head(t, "AGENTS", "droid bays", toggle)))
    .when(!list.length && !collapsed, (el) =>
      el.child(
        v_flex().px(14).gap(8)
          .child(div().text_size(12).text_color(t.muted).child("No droids in the bays yet."))
          .child(div().text_size(11.5).text_color(t.dim).child("An agent appears here once it reports its status. Start one from a tab's + menu, or in a terminal.")),
      ))
    .child(v_flex().id("droids-list").flex_1().min_h(0).px(collapsed ? 3 : 8).pt(6).pb(8).overflow_y_scrollbar().mode("always").gap(2).children(body));
}
