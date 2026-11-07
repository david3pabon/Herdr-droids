// The droid bays: one row per agent, each with its droid, what it is working
// on, and how long it has been in that state. Droids come from droids.js; a
// droid for each kind of coding agent, with its own animation per state.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, terminals, panes, focused, spaces, run, theme, shared, setShared, setAgentOrder, layout } from "herdr";
import { droid, lamp, chip, head, isDark, c } from "./kit.js";
import { matchKind, kindOf } from "./droids.js";

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

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function duration(ms) {
  if (!ms) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

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

// What the agent is working on: its own title when that says something, else
// the tab's name. Folder paths and "user@host" titles are noise, not tasks.
function taskOf(tab, lead) {
  const live = clean(lead?.title ?? tab?.name);
  const prog = lead?.program?.name;
  const telling = live && live !== prog && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== lead?.program?.key;
  if (!tab?.named) return telling ? live : prog ?? live;
  return live;
}

export function renderAgents() {
  const t = theme();
  const list0 = agents();
  const all = terminals();
  const collapsed = narrow();
  const sort = sortOf();
  const shown = focused()?.agent;
  const now = Date.now();

  // When each agent entered its state. Done and idle count as one: glancing at
  // a finished agent turns it idle, and that isn't the agent doing anything.
  const changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
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

  let list = [...list0];
  if (sort.id === "priority") list.sort((x, y) => (RANK[y.status] ?? 0) - (RANK[x.status] ?? 0) || since(y) - since(x) || y.seq - x.seq);
  setAgentOrder(list.map((a) => a.address));

  const leads = leadPanes(panes());
  const tabs = new Map(spaces().flatMap((s) => s.tabs ?? []).map((tab) => [tab.id, tab]));
  const subs = new Map();
  for (const k of all) if (k.parent && k.state === "live") subs.set(k.parent, (subs.get(k.parent) ?? 0) + 1);

  const row = (a, i) => {
    const kind = matchKind(a.app ?? a.program?.key);
    const task = taskOf(tabs.get(a.tab), leads.get(a.tab)) || a.program?.name || "";
    const idle = a.status === "idle" && !a.focused;
    if (collapsed) {
      return h_flex().id(`dr-${a.address}`).h(30).px(6).flex_none().gap(3).items_center().justify_center()
        .rounded(7)
        .when(a.focused, (el) => el.bg(t.selected))
        .hover((s) => s.bg(t.hover))
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .child(droid(t, kind, a.status, { scale: 0.3, w: 18, h: 22, oy: -1 }))
        .child(lamp(t, a.status, 5));
    }
    const n = subs.get(a.address) ?? 0;
    return h_flex()
      .id(`dr-${a.address}`)
      .h(62)
      .flex_none()
      .px(8)
      .mb(2)
      .gap(10)
      .items_center()
      .rounded(9)
      .cursor_pointer()
      .when(a.focused, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      // the bay: a plinth the droid stands on
      .child(
        div().relative().flex_none().w(40).h(50).rounded(7)
          .bg(isDark() ? "#ffffff08" : "#00000008")
          .border(1).border_color(t.border)
          .child(droid(t, kind, a.status, { w: 40, h: 50, scale: 0.68, oy: -2 }))
      )
      .child(
        v_flex().flex_1().min_w(0).gap(2)
          .child(
            h_flex().gap(6).items_center()
              .child(div().min_w(0).truncate().text_size(13).font_semibold()
                .text_color(idle ? t.muted : t.foreground).child(a.program?.name || kindOf(kind).name))
              .when(Boolean(n), (el) => el.child(div().text_size(10).text_color(t.dim).child(`+${n}`)))
          )
          .child(div().text_size(11.2).truncate().text_color(idle ? t.dim : t.muted).child(task))
          .child(
            h_flex().gap(7).items_center().mt(2)
              .child(chip(t, a.status === "blocked" ? "needs you" : a.status, t[a.status] ?? t.idle))
              .child(div().text_size(10.5).truncate().text_color(t.dim)
                .child([a.space_name, duration(now - since(a))].filter(Boolean).join(" · ")))
          )
      );
  };

  // Group headers: priority sections, or one group per space.
  const groups = [];
  for (const a of list) {
    const id = sort.id === "priority" ? `s${RANK[a.status] ?? 0}` : `p${a.space}`;
    const label = sort.id === "priority" ? SECTION[RANK[a.status] ?? 1] : a.space_name || "";
    if (groups.at(-1)?.id === id) groups.at(-1).members.push(a);
    else groups.push({ id, label, status: sort.id === "priority" ? Object.keys(SECTION).find((k) => SECTION[k] === label) : null, members: [a] });
  }
  const header = (g) =>
    h_flex().px(8).h(26).flex_none().gap(6).items_center().text_size(11).font_medium().text_color(t.muted)
      .when(g.status, (el) => el.child(div().size(6).rounded(3).bg(t[g.status] ?? t.idle)))
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
    .child(sort.label);

  const body = collapsed
    ? list.map(row)
    : groups.flatMap((g) => [header(g), ...g.members.map(row)]);

  return v_flex().size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).text_size(13)
    .when(!collapsed, (el) => el.child(head(t, "AGENTS", "droid bays", toggle)))
    .when(!list.length && !collapsed, (el) =>
      el.child(
        v_flex().px(14).gap(8)
          .child(div().text_size(12).text_color(t.muted).child("No droids in the bays yet."))
          .child(div().text_size(11.5).text_color(t.dim).child("An agent appears here once it reports its status. Start one from a tab's + menu, or in a terminal.")),
      ))
    .child(v_flex().id("droids-list").flex_1().min_h(0).px(collapsed ? 3 : 8).pb(8).overflow_y_scrollbar().mode("always").gap(2).children(body));
}
