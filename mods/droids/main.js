// The droids layout's own mod, in roles. The layout gives each copy a role:
//
//   brand   the sidebar's title bar (a quiet starfield, search, fold)
//   agents  the droid bays: one row per agent, its droid, its task, its state
//   footer  the sidebar's footer (settings, add machine)
//   status  the bottom bar: machine, branch, a lamp per droid, the palette key
//   pane    a pane header: the droid running in it + split/zoom/close
//   depot   a peek drawer of every droid, most urgent first (not placed by default)
//
// Panel content this layout reuses from Herdr, restyled, lives in its own
// cloned mods: droids-spaces, droids-tabs, droids-files, droids-changes.

import { View, div } from "gpui-kit";
import { props } from "herdr";
import { renderAgents } from "./agents.js";
import { renderBrand, renderFooter, renderStatus } from "./chrome.js";
import { renderPane } from "./pane.js";
import { renderDepot } from "./depot.js";

const ROLES = { brand: renderBrand, agents: renderAgents, footer: renderFooter, status: renderStatus, pane: renderPane, depot: renderDepot };

export default class Droids extends View {
  init() {
    this.hovered = null;
    this.folded = new Set();   // bays with their sub-agents hidden
  }

  render(cx) {
    const role = props()?.role ?? "brand";
    const at = ROLES[role];
    if (!at) return div().p(10).text_size(12).child(`droids: no role "${role}"`);
    return at(cx, this);
  }
}
