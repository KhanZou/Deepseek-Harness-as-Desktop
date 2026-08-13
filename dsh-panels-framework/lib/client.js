// dsh-panels-framework: generic right/bottom panel framework for DSH client
// plugins, the visual counterpart of dsh-settings-framework.
//
// Other client plugins can use it (via window.__DSH_PANELS__) to:
//   registerPanel({ side: 'right'|'bottom', id, label, order, render })
//                                                         -> adds a panel tab
//   open(side) / close(side) / toggle(side)               -> open state control
//   setTab(side, tabId) / setSize(side, px)               -> tab + size control
//   getState() / subscribe(cb)                            -> read/sync
//
// The framework renders both panel shells (right column + bottom bar) into the
// layout's `shell.overlay` layer and provides one-click collapse/expand rails
// plus drag-to-resize. Open state, active tab and sizes persist through the
// dsh-settings-framework backend (keys panelRight* / panelBottom*). Without
// the settings framework installed the panels still work, they just keep
// their state in memory for the session.

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-panels-framework",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;

		var ctxRef = null;
		var NS = "panelsFramework";

		var dict = {
			zh: {
				collapse: "折叠",
				expand: "展开",
				empty: "（暂无面板内容）",
			},
			en: {
				collapse: "Collapse",
				expand: "Expand",
				empty: "(No panel content)",
			},
		};
		var t = null;

		var tabs = { right: [], bottom: [] };
		var state = {
			right: { open: false, tab: "", width: 420 },
			bottom: { open: false, tab: "", height: 260 },
		};
		var subs = new Set();
		var readyResolve = null;
		var ready = new Promise(function (r) { readyResolve = r; });
		var loaded = false;

		var PERSIST = {
			right: { open: "panelRightOpen", tab: "panelRightTab", width: "panelRightWidth" },
			bottom: { open: "panelBottomOpen", tab: "panelBottomTab", height: "panelBottomHeight" },
		};

		function emit() {
			subs.forEach(function (cb) { try { cb(); } catch (e) { } });
		}

		function getState() {
			return {
				right: {
					open: state.right.open, tab: state.right.tab, width: state.right.width,
					tabs: tabs.right.map(function (x) { return x; }),
				},
				bottom: {
					open: state.bottom.open, tab: state.bottom.tab, height: state.bottom.height,
					tabs: tabs.bottom.map(function (x) { return x; }),
				},
			};
		}

		function subscribe(cb) {
			subs.add(cb);
			return function () { subs.delete(cb); };
		}

		function byId(list, id) {
			for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
			return list.length ? list[0] : null;
		}

		function persist(side) {
			var sf = window.__DSH_SETTINGS__;
			if (!sf || !loaded) return;
			var map = PERSIST[side];
			try { sf.set(map.open, state[side].open ? "true" : "false"); } catch (e) { }
			if (map.tab) { try { sf.set(map.tab, state[side].tab); } catch (e) { } }
			try { sf.set(map.width || map.height, String(state[side].width || state[side].height)); } catch (e) { }
		}

		function setOpen(side, open) {
			state[side].open = !!open;
			persist(side);
			emit();
		}

		function toggle(side) {
			setOpen(side, !state[side].open);
		}

		function setTab(side, tab) {
			if (state[side].tab === tab) return;
			state[side].tab = tab;
			persist(side);
			emit();
		}

		function setSize(side, px) {
			var v = Math.max(side === "right" ? 260 : 120, Math.min(side === "right" ? 960 : 640, px));
			if (state[side].width !== undefined) state[side].width = v;
			else state[side].height = v;
			persist(side);
			emit();
		}

		function registerPanel(opt) {
			if (!opt || !opt.side || !opt.id) return;
			var list = opt.side === "bottom" ? tabs.bottom : tabs.right;
			for (var i = 0; i < list.length; i++) if (list[i].id === opt.id) return;
			list.push({
				id: opt.id,
				label: opt.label || opt.id,
				order: opt.order || 50,
				render: typeof opt.render === "function" ? opt.render : function () { return null; },
			});
			list.sort(function (a, b) { return a.order - b.order; });
			if (!state[opt.side].tab && list.length) {
				state[opt.side].tab = list[0].id;
				persist(opt.side);
			}
			emit();
		}

		// ---- persistence bootstrap ----------------------------------------

		function whenSettings(cb, tries) {
			tries = tries || 0;
			var sf = window.__DSH_SETTINGS__;
			if (sf) { cb(sf); return; }
			if (tries > 150) return;
			setTimeout(function () { whenSettings(cb, tries + 1); }, 200);
		}

		function loadPersisted(sf) {
			var v, n;
			v = sf.get("panelRightOpen"); if (v !== undefined) state.right.open = (v === "true");
			v = sf.get("panelRightTab"); if (v) state.right.tab = v;
			v = sf.get("panelRightWidth"); n = parseInt(v, 10); if (n > 0) state.right.width = n;
			v = sf.get("panelBottomOpen"); if (v !== undefined) state.bottom.open = (v === "true");
			v = sf.get("panelBottomTab"); if (v) state.bottom.tab = v;
			v = sf.get("panelBottomHeight"); n = parseInt(v, 10); if (n > 0) state.bottom.height = n;
			loaded = true;
			emit();
		}

		// ---- styles --------------------------------------------------------

		var injectedStyle = false;
		function ensureStyle() {
			if (injectedStyle || typeof document === "undefined") return;
			injectedStyle = true;
			var style = document.createElement("style");
			style.textContent = [
				".dsh-panel-right{position:absolute;top:10px;right:10px;bottom:10px;display:flex;flex-direction:column;border:1px solid rgba(128,128,128,.3);border-radius:12px;background:var(--dsw-alias-surface-raised, rgba(20,24,40,.94));box-shadow:0 8px 30px rgba(0,0,0,.35);overflow:hidden;z-index:30;}",
				".dsh-panel-bottom{position:absolute;left:10px;right:10px;bottom:10px;display:flex;flex-direction:column;border:1px solid rgba(128,128,128,.3);border-radius:12px;background:var(--dsw-alias-surface-raised, rgba(20,24,40,.94));box-shadow:0 -4px 24px rgba(0,0,0,.3);overflow:hidden;z-index:30;}",
				".dsh-panel-rail-right{position:absolute;top:80px;right:0;z-index:29;display:flex;align-items:center;gap:6px;padding:10px 6px;border-radius:10px 0 0 10px;background:var(--dsw-alias-surface-raised, rgba(20,24,40,.92));border:1px solid rgba(128,128,128,.3);border-right:none;cursor:pointer;writing-mode:vertical-rl;font-size:12px;color:inherit;opacity:.85;}",
				".dsh-panel-rail-right:hover{opacity:1;}",
				".dsh-panel-rail-bottom{position:absolute;left:50%;transform:translateX(-50%);bottom:0;z-index:29;display:flex;align-items:center;gap:8px;padding:4px 14px;border-radius:10px 10px 0 0;background:var(--dsw-alias-surface-raised, rgba(20,24,40,.92));border:1px solid rgba(128,128,128,.3);border-bottom:none;cursor:pointer;font-size:12px;color:inherit;opacity:.85;}",
				".dsh-panel-rail-bottom:hover{opacity:1;}",
				".dsh-panel-header{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid rgba(128,128,128,.25);flex:none;}",
				".dsh-panel-tabbar{display:flex;gap:4px;flex:1;min-width:0;overflow-x:auto;}",
				".dsh-panel-tab{border:1px solid transparent;background:transparent;color:inherit;padding:5px 12px;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;}",
				".dsh-panel-tab:hover{background:rgba(128,128,128,.14);}",
				".dsh-panel-tab.active{background:rgba(77,107,254,.22);border-color:rgba(77,107,254,.6);}",
				".dsh-panel-toggle{border:none;background:transparent;color:inherit;font-size:14px;cursor:pointer;padding:4px 8px;border-radius:6px;flex:none;}",
				".dsh-panel-toggle:hover{background:rgba(128,128,128,.16);}",
				".dsh-panel-body{flex:1;min-height:0;overflow:auto;padding:10px 12px;}",
				".dsh-panel-resize-left{position:absolute;left:-3px;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:5;}",
				".dsh-panel-resize-top{position:absolute;top:-3px;left:0;right:0;height:6px;cursor:ns-resize;z-index:5;}",
				".dsh-panel-empty{padding:18px;opacity:.55;font-size:13px;text-align:center;}",
			].join("\n");
			(document.head || document.documentElement).appendChild(style);
		}

		// ---- panel shells --------------------------------------------------

		function usePanelState() {
			var s = useState(getState());

			if (!st.right.tabs.length) return null;
			var rs = st.right;
			var active = byId(rs.tabs, rs.tab);
			if (!rs.open) {
				var rlabel = typeof active.label === "function" ? active.label() : active.label;
				return h("div", { className: "dsh-panel-rail-right", title: rlabel, onClick: function () { toggle("right"); } },
					h("span", {}, "◀ " + rlabel));
			}
			return h("div", { className: "dsh-panel-right", style: { width: rs.width + "px" } },
				h("div", { className: "dsh-panel-resize-left", onMouseDown: startResize("right") }),
				h("div", { className: "dsh-panel-header" },
					h(TabBar, { side: "right", st: rs }),
					h("button", { className: "dsh-panel-toggle", title: t("collapse"), onClick: function () { toggle("right"); } }, "»")),
				h("div", { className: "dsh-panel-body" }, active.render({ side: "right", tab: active.id, h: h, React: React })));
		}

		function BottomPanelShell() {
			ensureStyle();
			var st = usePanelState();
			if (!st.bottom.tabs.length) return null;
			var bs = st.bottom;
			var active = byId(bs.tabs, bs.tab);
			if (!bs.open) {
				var blabel = typeof active.label === "function" ? active.label() : active.label;
				return h("div", { className: "dsh-panel-rail-bottom", title: blabel, onClick: function () { toggle("bottom"); } },
					h("span", {}, "▲ " + blabel));
			}
			return h("div", { className: "dsh-panel-bottom", style: { height: bs.height + "px" } },
				h("div", { className: "dsh-panel-resize-top", onMouseDown: startResize("bottom") }),
				h("div", { className: "dsh-panel-header" },
					h(TabBar, { side: "bottom", st: bs }),
					h("button", { className: "dsh-panel-toggle", title: t("collapse"), onClick: function () { toggle("bottom"); } }, "▾")),
				h("div", { className: "dsh-panel-body" }, active.render({ side: "bottom", tab: active.id, h: h, React: React })));
		}

		function startResize(side) {
			return function (e) {
				e.preventDefault();
				e.stopPropagation();
				var startPos = side === "right" ? e.clientX : e.clientY;
				var startVal = side === "right" ? state.right.width : state.bottom.height;
				function move(ev) {
					var delta = side === "right" ? (startPos - ev.clientX) : (ev.clientY - startPos);
					setSize(side, startVal + delta);
				}
				function up() {
					document.removeEventListener("mousemove", move);
					document.removeEventListener("mouseup", up);
				}
				document.addEventListener("mousemove", move);
				document.addEventListener("mouseup", up);
			};
		}

		// ---- plugin apply -------------------------------------------------

		function apply(ctx) {
			ctxRef = ctx;
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "panels-framework: dictionaries");
			t = ctx.locale.bind(NS);

			ctx.slots.inject("shell.overlay", function () {
				return ctx.slots.register({
					name: "shell.overlay",
					id: "panels-right",
					order: 30,
				}, RightPanelShell);
			});
			ctx.slots.inject("shell.overlay", function () {
				return ctx.slots.register({
					name: "shell.overlay",
					id: "panels-bottom",
					order: 40,
				}, BottomPanelShell);
			});

			window.__DSH_PANELS__ = {
				ready: ready,
				registerPanel: registerPanel,
				open: function (side) { setOpen(side, true); },
				close: function (side) { setOpen(side, false); },
				toggle: toggle,
				setTab: setTab,
				setSize: setSize,
				getState: getState,
				subscribe: subscribe,
			};

			whenSettings(function (sf) {
				var sp = (sf && sf.ready) ? sf.ready : Promise.resolve();
				sp.then(function () {
					loadPersisted(sf);
					if (readyResolve) readyResolve();
				});
			});
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});