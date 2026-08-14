// dsh-desktop-framework: unified desktop framework for the DSH Web UI.
//
// Merge of the former dsh-settings-framework + dsh-panels-framework + dsh-right-panel:
//   - generic settings tabs/items (window.__DSH_SETTINGS__)
//   - right/bottom panel shells + tabs (window.__DSH_PANELS__)
//   - Files / Changes / Terminal tabs and session-header panel toggles

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-desktop-framework",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		// Shared inline-SVG icons for the desktop framework UI (modern, theme-aware).
		var dshReact = require("react");
		var dshH = dshReact.createElement;
		var DSH_ICONS = {
			close: [["path", { d: "M4 4l8 8M12 4l-8 8" }]],
			"chevron-left": [["path", { d: "M10 3L5 8l5 5" }]],
			"chevron-right": [["path", { d: "M6 3l5 5-5 5" }]],
			"chevron-up": [["path", { d: "M3 10l5-5 5 5" }]],
			"chevron-down": [["path", { d: "M3 6l5 5 5-5" }]],
			plus: [["path", { d: "M8 3v10M3 8h10" }]],
			"panel-right": [["rect", { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2 }], ["path", { d: "M10.5 2.5v11" }]],
			"panel-bottom": [["rect", { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2 }], ["path", { d: "M1.5 10.5h13" }]],
		};
		function dshIcon(name, size) {
			var s = size || 16;
			var def = DSH_ICONS[name] || DSH_ICONS.plus;
			var kids = def.map(function (it, idx) {
				var attrs = {};
				for (var k in it[1]) attrs[k] = it[1][k];
				attrs.key = idx;
				return dshH(it[0], attrs);
			});
			return dshH("svg", {
				viewBox: "0 0 16 16", width: s, height: s, fill: "none",
				stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round",
				style: { display: "inline-block", verticalAlign: "middle", flex: "none" },
			}, kids);
		}

		// ---- settings framework (window.__DSH_SETTINGS__) ------------------------------------------------
function applySettings(ctx) {

		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;

		var API = "http://127.0.0.1:3980";

		var ctxRef = null;
		var tabs = {};        // id -> { id, label, order }
		var items = [];       // { tabId, key, type, label, hint, defaultValue, options }
		var cache = {};       // key -> string value
		var subs = {};        // key -> Set<callback>
		var itemSubs = [];    // callbacks on item registry change
		var readyResolve = null;
		var ready = new Promise(function (r) { readyResolve = r; });

		function fetchJson(url, options) {
			return fetch(url, options).then(function (r) { return r.json(); });
		}

		function findDefault(key) {
			for (var i = 0; i < items.length; i++) {
				if (items[i].key === key) return items[i].defaultValue;
			}
			return undefined;
		}

		function get(key) {
			if (cache[key] !== undefined) return cache[key];
			return findDefault(key);
		}

		function applyChanges(next) {
			var keys = new Set(Object.keys(cache).concat(Object.keys(next || {})));
			var changed = [];
			keys.forEach(function (k) {
				var a = cache[k] === undefined ? "" : String(cache[k]);
				var b = (next && next[k] !== undefined) ? String(next[k]) : "";
				if (a !== b) changed.push(k);
			});
			// Normalize every value to a string: the exe returns booleans for
			// typed keys (autoStart / notifyOnComplete / trayHint) while the
			// UI compares strings ("true"/"1"). Keeping the cache string-only
			// makes checkboxes reflect the persisted state correctly.
			var norm = {};
			if (next) {
				Object.keys(next).forEach(function (k) {
					norm[k] = next[k] === undefined || next[k] === null ? "" : String(next[k]);
				});
			}
			cache = norm;
			changed.forEach(function (k) { emit(k); });
		}

		function set(key, value) {
			var v = value === undefined || value === null ? "" : String(value);
			cache[key] = v;
			emit(key);
			return fetchJson(API + "/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: key, value: v }),
			}).then(function (m) {
				applyChanges(m);
			}).catch(function () { });
		}

		function subscribe(key, cb) {
			if (!subs[key]) subs[key] = new Set();
			subs[key].add(cb);
			return function () { if (subs[key]) subs[key].delete(cb); };
		}

		function emit(key) {
			var s = subs[key];
			if (!s) return;
			s.forEach(function (cb) { try { cb(get(key)); } catch (e) { } });
		}

		function bumpItems() {
			itemSubs.forEach(function (cb) { try { cb(); } catch (e) { } });
		}

		function refresh() {
			return fetchJson(API + "/api/settings").then(function (m) {
				applyChanges(m);
			}).catch(function () { });
		}

		// ---- declarative registration ------------------------------------

		function registerTab(opt) {
			if (!opt || !opt.id) return;
			tabs[opt.id] = { id: opt.id, label: opt.label || opt.id, order: opt.order || 50 };
			var labelThunk = typeof opt.label === "function" ? opt.label : function () { return opt.label || opt.id; };
			var TabComp = function () { return TabShellView({ tabId: opt.id }); };
			ctxRef.slots.inject("settings.section", function () {
				return ctxRef.slots.register({
					name: "settings.section",
					id: opt.id,
					order: opt.order || 50,
					label: labelThunk,
				}, TabComp);
			});
		}

		function registerItem(opt) {
			if (!opt || !opt.key) return;
			items.push({
				tabId: opt.tabId,
				key: opt.key,
				type: opt.type || "toggle",
				label: opt.label || opt.key,
				hint: opt.hint || "",
				defaultValue: opt.defaultValue,
				options: opt.options || [],
				// Custom/action item payloads: registerItem must keep them so
				// TabShellView can render type:"custom" and type:"action".
				action: opt.action,
				render: opt.render,
			});
			if (cache[opt.key] === undefined && opt.defaultValue !== undefined) {
				cache[opt.key] = String(opt.defaultValue);
			}
			bumpItems();
		}

		// ---- rendering ---------------------------------------------------

		function renderControl(item, onChange) {
			var value = get(item.key);
			if (value === undefined) value = "";
			if (item.type === "toggle") {
				return h("input", { type: "checkbox", checked: value === true || value === "true" || value === "1", onChange: function (e) { onChange(e.target.checked); } });
			}
			if (item.type === "select") {
				return h("select", { value: value, onChange: function (e) { onChange(e.target.value); }, style: { padding: "4px 8px" } },
					item.options.map(function (o) {
						return h("option", { key: String(o.value), value: String(o.value) }, o.label || String(o.value));
					}));
			}
			if (item.type === "number") {
				return h("input", { type: "number", value: value, style: { padding: "4px 8px" }, onChange: function (e) { onChange(e.target.value); } });
			}
			// default: text
			return h("input", { type: "text", value: value, style: { padding: "4px 8px" }, onChange: function (e) { onChange(e.target.value); } });
		}

		function ItemRow(props) {
			var item = props.item;
			return h("label", {
				style: {
					display: "flex", justifyContent: "space-between", alignItems: "center",
					gap: "16px", padding: "8px 0", cursor: "pointer",
				},
			}, h("span", { style: { lineHeight: "1.4" } }, item.label), renderControl(item, function (v) { set(item.key, v); }));
		}

		function TabShellView(props) {
			var tabId = props.tabId;
			var revState = useState(0);
			var rev = revState[0];
			var setRev = revState[1];

			useEffect(function () {
				var offs = [];
				items.forEach(function (it) {
					if (it.tabId === tabId) offs.push(subscribe(it.key, function () { setRev(function (v) { return v + 1; }); }));
				});
				var onItems = function () { setRev(function (v) { return v + 1; }); };
				itemSubs.push(onItems);
				var timer = setInterval(function () { refresh(); }, 3000);
				return function () {
					offs.forEach(function (f) { try { f(); } catch (e) { } });
					var idx = itemSubs.indexOf(onItems);
					if (idx >= 0) itemSubs.splice(idx, 1);
					clearInterval(timer);
				};
			}, []);

			var myItems = items.filter(function (it) { return it.tabId === tabId; });
			if (myItems.length === 0) {
				return h("div", { style: { padding: "16px", opacity: ".6" } }, "No settings items registered for this tab.");
			}
			return h("div", { style: { padding: "16px", maxWidth: "640px" } },
				myItems.map(function (it) {
					if (it.type === "action") {
						return h("div", { key: it.key, style: { padding: "8px 0" } },
							h("button", {
								onClick: function () { try { if (it.action) it.action({ get: get, set: set }); } catch (e) { } },
								style: { padding: "6px 14px", cursor: "pointer" },
							}, it.label));
					}
					if (it.type === "custom" && typeof it.render === "function") {
						return h("div", { key: it.key, style: { padding: "8px 0" } },
							it.render({ get: get, set: set, h: h, React: React, refresh: refresh }));
					}
					return h("div", { key: it.key },
						ItemRow({ item: it }),
						it.hint ? h("div", { style: { fontSize: "0.857em", opacity: ".75", padding: "0 0 4px" } }, it.hint) : null);
				}));
		}

		// ---- plugin apply -------------------------------------------------

		function apply(ctx) {
			ctxRef = ctx;
			window.__DSH_SETTINGS__ = {
				ready: ready,
				registerTab: registerTab,
				registerItem: registerItem,
				get: get,
				set: set,
				subscribe: subscribe,
			};
			refresh().finally(function () { if (readyResolve) readyResolve(); });
		}
	apply(ctx);
}

		// ---- panels framework (window.__DSH_PANELS__) ------------------------------------------------
function applyPanels(ctx) {

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
			updateMetrics();
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
				closable: !!opt.closable,
				render: typeof opt.render === "function" ? opt.render : function () { return null; },
			});
			list.sort(function (a, b) { return a.order - b.order; });
			if (!state[opt.side].tab && list.length) {
				state[opt.side].tab = list[0].id;
				persist(opt.side);
			}
			emit();
		}

		// ---- layout metrics (theme-aware, non-floating panels) --------------
		var metrics = { sidebar: 0, details: 0, right: 0 };
		function updateMetrics() {
			try {
				var overlay = document.querySelector('[data-shell-overlay]');
				var frame = overlay && overlay.parentElement;
				if (!frame) return;
				var kids = frame.children;
				var sidebar = kids[0] ? kids[0].getBoundingClientRect().width : 0;
				var details = kids[2] ? kids[2].getBoundingClientRect().width : 0;
				var rightW = state.right.open ? state.right.width : 0;
				var bottomH = state.bottom.open ? state.bottom.height : 0;
				metrics.sidebar = sidebar;
				metrics.details = details;
				metrics.right = rightW;
				var doc = document.documentElement;
				doc.style.setProperty("--dsh-metrics-sidebar", sidebar + "px");
				doc.style.setProperty("--dsh-metrics-details", details + "px");
				doc.style.setProperty("--dsh-metrics-right", (rightW + details) + "px");
				// Adapt the main (center) column: reserve space for open panels so
				// they never overlay the conversation (plugin-only, no DSH changes).
				var center = kids[1];
				if (center) {
					center.style.paddingRight = rightW + "px";
					center.style.paddingBottom = bottomH + "px";
				}
			} catch (e) { }
		}
		function startMetrics(tries) {
			tries = tries || 0;
			if (typeof ResizeObserver === "undefined") return;
			try {
				var overlay = document.querySelector('[data-shell-overlay]');
				var frame = overlay && overlay.parentElement;
				if (!frame) {
					if (tries > 50) return;
					setTimeout(function () { startMetrics(tries + 1); }, 200);
					return;
				}
				if (!frame.__dshMetricsRO) {
					frame.__dshMetricsRO = new ResizeObserver(function () { updateMetrics(); });
					frame.__dshMetricsRO.observe(frame);
					for (var i = 0; i < frame.children.length; i++) {
						try { frame.__dshMetricsRO.observe(frame.children[i]); } catch (e) { }
					}
				}
				updateMetrics();
			} catch (e) { }
		}

		function addTab(side, opt) {
			if (!opt || !opt.id) return;
			var list = side === "bottom" ? tabs.bottom : tabs.right;
			for (var i = 0; i < list.length; i++) {
				if (list[i].id === opt.id) {
					list[i].label = opt.label || opt.id;
					list[i].closable = !!opt.closable;
					list[i].render = typeof opt.render === "function" ? opt.render : list[i].render;
					if (opt.activate) { state[side].tab = opt.id; persist(side); }
					emit();
					return;
				}
			}
			list.push({
				id: opt.id,
				label: opt.label || opt.id,
				order: opt.order || 90,
				closable: !!opt.closable,
				render: typeof opt.render === "function" ? opt.render : function () { return null; },
			});
			list.sort(function (a, b) { return a.order - b.order; });
			if (opt.activate || !state[side].tab) { state[side].tab = opt.id; persist(side); }
			emit();
		}
		function removeTab(side, id) {
			var list = side === "bottom" ? tabs.bottom : tabs.right;
			for (var i = 0; i < list.length; i++) if (list[i].id === id) { list.splice(i, 1); break; }
			if (state[side].tab === id) {
				state[side].tab = list.length ? list[0].id : "";
				persist(side);
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
				".dsh-panel-right{position:absolute;top:0;right:var(--dsh-metrics-details,0px);bottom:0;display:flex;flex-direction:column;background:var(--dsw-specific-sidebar-fill);border-left:1px solid var(--dsw-alias-border-l1);overflow:hidden;z-index:25;}",
				".dsh-panel-bottom{position:absolute;bottom:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-2);border-top:1px solid var(--dsw-alias-border-l2);overflow:hidden;z-index:24;}",
				".dsh-panel-header{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;background:var(--dsw-alias-bg-layer-1);}",
				".dsh-panel-body{flex:1;min-height:0;overflow:auto;padding:10px 12px;color:inherit;}",
				".dsh-panel-empty{padding:18px;opacity:.55;text-align:center;}",
				".dsh-panel-resize-left{position:absolute;left:0;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:5;}",
				".dsh-panel-resize-left:hover{background:var(--dsw-alias-border-l3);}",
				".dsh-panel-resize-top{position:absolute;top:0;left:0;right:0;height:5px;cursor:ns-resize;z-index:5;}",
				".dsh-panel-resize-top:hover{background:var(--dsw-alias-border-l3);}",
				".dsh-panel-tabbar{padding:6px 8px 0;border-bottom:1px solid var(--dsw-alias-border-l1);gap:2px;align-items:flex-end;background:transparent;}",
				".dsh-panel-tab{height:30px;padding:0 10px;border-radius:8px 8px 0 0;border:1px solid transparent;border-bottom:none;color:var(--dsw-alias-label-secondary-foreground, inherit);background:transparent;display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;}",
				".dsh-panel-tab:hover{background:var(--dsw-alias-button-floating-hover);color:inherit;}",
				".dsh-panel-tab.active{background:var(--dsw-alias-button-ghost-active-fill);border-color:var(--dsw-alias-button-ghost-active-border);color:var(--dsw-alias-label-primary-foreground, inherit);}",
				".dsh-panel-tab-close{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;opacity:.55;border:none;background:transparent;color:inherit;cursor:pointer;}",
				".dsh-panel-tab-close:hover{opacity:1;background:var(--dsw-alias-button-floating-hover);}",
				".dsh-panel-tab-plus{width:26px;height:26px;margin:0 0 4px;border-radius:8px;border:none;background:transparent;color:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none;}",
				".dsh-panel-tab-plus:hover{background:var(--dsw-alias-button-floating-hover);}",
				".dsh-open-menu{position:fixed;z-index:9999;min-width:180px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:6px;display:flex;flex-direction:column;}",
				".dsh-open-menu-item{display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:transparent;color:inherit;cursor:pointer;border-radius:8px;}",
				".dsh-open-menu-item:hover{background:var(--dsw-alias-button-floating-hover);}",
				".dsh-panel-plus-menu{position:fixed;z-index:9999;min-width:170px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:6px;display:flex;flex-direction:column;}",
				".dsh-panel-plus-item{display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:transparent;color:inherit;cursor:pointer;border-radius:8px;}",
				".dsh-panel-plus-item:hover{background:var(--dsw-alias-button-floating-hover);}",
				".dsh-link{color:var(--dsw-alias-brand-text);text-decoration:underline;cursor:pointer;word-break:break-all;}",
				".dsh-link:hover{opacity:.85;}",
				".dsh-viewer{height:100%;display:flex;flex-direction:column;min-height:0;}",
				".dsh-viewer-status{padding:24px;text-align:center;opacity:.7;display:flex;flex-direction:column;gap:12px;align-items:center;}",
				".dsh-viewer-action{height:26px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-button-ghost-active-border);background:transparent;color:inherit;cursor:pointer;display:inline-flex;align-items:center;}",
				".dsh-viewer-action:hover{background:var(--dsw-alias-button-floating-hover);}",
				".dsh-viewer-pre{margin:0;line-height:1.5;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:auto;flex:1;min-height:0;}",
				".dsh-viewer-media{flex:1;min-height:0;position:relative;}",
				".dsh-viewer-video{width:100%;height:100%;object-fit:contain;background:var(--dsw-alias-bg-mask-photo, #000);}",
				".dsh-viewer-frame{width:100%;height:100%;border:none;background:var(--dsw-alias-bg-base);}",
				".dsh-viewer-toolbar{display:flex;gap:6px;padding-bottom:8px;align-items:center;}",
				".dsh-viewer-image-stage{flex:1;min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1);}",
				".dsh-viewer-image-img{transition:transform .15s ease;object-fit:contain;user-select:none;}",
				".dsh-viewer-model{height:100%;position:relative;background:var(--dsw-alias-bg-layer-1);}",
				".dsh-viewer-model-canvas{width:100%;height:100%;display:block;cursor:grab;}",
				".dsh-md{overflow:auto;}",
				".dsh-md-body{max-width:880px;margin:0 auto;padding:8px 4px;line-height:1.6;color:inherit;}",
				".dsh-md-body h1,.dsh-md-body h2,.dsh-md-body h3,.dsh-md-body h4,.dsh-md-body h5,.dsh-md-body h6{border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:.3em;margin:1em 0 .6em;font-weight:600;line-height:1.3;}",
				".dsh-md-body pre{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:12px;overflow:auto;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}",
				".dsh-md-body code{background:var(--dsw-alias-bg-mask-1);border-radius:4px;padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}",
				".dsh-md-body pre code{background:transparent;padding:0;}",
				".dsh-md-body table{border-collapse:collapse;margin:1em 0;}",
				".dsh-md-body th,.dsh-md-body td{border:1px solid var(--dsw-alias-border-l2);padding:6px 10px;}",
				".dsh-md-body th{background:var(--dsw-alias-bg-layer-1);font-weight:600;}",
				".dsh-md-body blockquote{margin:.6em 0;padding:.2em 1em;border-left:4px solid var(--dsw-alias-border-l3);color:inherit;opacity:.85;}",
				".dsh-md-body img{max-width:100%;border-radius:8px;}",
				".dsh-md-body a{color:var(--dsw-alias-brand-text);text-decoration:underline;}",
				".dsh-md-body hr{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:1em 0;}",
				".dsh-md-body p{margin:.5em 0;}",
				".dsh-md-body ul,.dsh-md-body ol{margin:.5em 0;padding-left:1.6em;}",
			].join("\n");
			(document.head || document.documentElement).appendChild(style);

		}

		// ---- panel shells --------------------------------------------------

		var plusMenuEl = null;
		function hidePlusMenu() {
			if (plusMenuEl && plusMenuEl.parentNode) plusMenuEl.parentNode.removeChild(plusMenuEl);
			plusMenuEl = null;
		}
		function showPlusMenu(side, anchor) {
			hidePlusMenu();
			var rect = anchor.getBoundingClientRect();
			var items = [];
			function ensureTab(id) {
				if (window.__DSH_TABS__) window.__DSH_TABS__.ensure(id);
				else setTab(side, id);
			}
			if (side === "right") {
				items.push({ label: "\u6587\u4ef6\u6d4f\u89c8", action: function () { ensureTab("files"); } });
				items.push({ label: "\u53d8\u66f4", action: function () { ensureTab("changes"); } });
				items.push({ label: "\u6253\u5f00\u6587\u4ef6\u2026", action: function () { var p = prompt("\u8f93\u5165\u6587\u4ef6\u8def\u5f84"); if (p && window.__DSH_OPEN__) window.__DSH_OPEN__.openResource({ path: p, name: p }); } });
				items.push({ label: "\u6253\u5f00URL\u2026", action: function () { var u = prompt("\u8f93\u5165URL"); if (u && window.__DSH_OPEN__) window.__DSH_OPEN__.openWeb(u); } });
			} else {
				items.push({ label: "\u7ec8\u7aef", action: function () { ensureTab("terminal"); } });
			}
			plusMenuEl = document.createElement("div");
			plusMenuEl.className = "dsh-panel-plus-menu";
			plusMenuEl.style.left = (rect.right - 170) + "px";
			plusMenuEl.style.top = (rect.bottom + 4) + "px";
			items.forEach(function (it) {
				var b = document.createElement("button");
				b.className = "dsh-panel-plus-item";
				b.textContent = it.label;
				b.onclick = function () { hidePlusMenu(); it.action(); };
				plusMenuEl.appendChild(b);
			});
			document.body.appendChild(plusMenuEl);
			setTimeout(function () {
				document.addEventListener("mousedown", function h(e) {
					if (plusMenuEl && plusMenuEl.contains(e.target)) return;
					hidePlusMenu();
					document.removeEventListener("mousedown", h);
				});
			}, 0);
		}

		function TabBar(props) {
			var side = props.side;
			var st = props.st;
			return h("div", { className: "dsh-panel-tabbar" },
				st.tabs.map(function (tab) {
					var label = typeof tab.label === "function" ? tab.label() : tab.label;
					var closeBtn = tab.closable
						? h("button", {
							className: "dsh-panel-tab-close",
							title: "close",
							onClick: function (e) { e.stopPropagation(); removeTab(side, tab.id); },
							style: { display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" },
						}, dshIcon("close", 12))
						: null;
					return h("div", {
						key: tab.id,
						className: "dsh-panel-tab" + (st.tab === tab.id ? " active" : ""),
						onClick: function () { setTab(side, tab.id); },
					}, h("span", { className: "dsh-panel-tab-label" }, label), closeBtn);
				}),
				h("button", {
					className: "dsh-panel-tab-plus",
					title: "new tab",
					onClick: function (e) { e.stopPropagation(); showPlusMenu(side, e.currentTarget); },
					style: { display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" },
				}, dshIcon("plus", 15)));
		}

		function usePanelState() {
			var s = useState(getState());
			useEffect(function () {
				var off = subscribe(function () { s[1](getState()); });
				return function () { off(); };
			}, []);
			return s[0];
		}

		function RightPanelShell() {
			ensureStyle();
			var st = usePanelState();
			var rs = st.right;
			if (!rs.open) return null;
			var header = h("div", { className: "dsh-panel-header" },
				h(TabBar, { side: "right", st: rs }));
			if (!rs.tabs.length) {
				return h("div", { className: "dsh-panel-right", style: { width: rs.width + "px", right: metrics.details + "px" } },
					h("div", { className: "dsh-panel-resize-left", onMouseDown: startResize("right") }),
					header,
					h("div", { className: "dsh-panel-body dsh-panel-empty" }, t("empty")));
			}
			var active = byId(rs.tabs, rs.tab);
			return h("div", { className: "dsh-panel-right", style: { width: rs.width + "px", right: metrics.details + "px" } },
				h("div", { className: "dsh-panel-resize-left", onMouseDown: startResize("right") }),
				header,
				h("div", { className: "dsh-panel-body" }, active.render({ side: "right", tab: active.id, h: h, React: React })));
		}
		function BottomPanelShell() {
			ensureStyle();
			var st = usePanelState();
			var bs = st.bottom;
			if (!bs.open) return null;
			var bl = metrics.sidebar;
			var br = (state.right.open ? state.right.width : 0) + metrics.details;
			if (!bs.tabs.length) {
				return h("div", { className: "dsh-panel-bottom", style: { height: bs.height + "px", left: bl + "px", right: br + "px" } },
					h("div", { className: "dsh-panel-resize-top", onMouseDown: startResize("bottom") }),
					h("div", { className: "dsh-panel-body dsh-panel-empty" }, t("empty")));
			}
			var active = byId(bs.tabs, bs.tab);
			return h("div", { className: "dsh-panel-bottom", style: { height: bs.height + "px", left: bl + "px", right: br + "px" } },
				h("div", { className: "dsh-panel-resize-top", onMouseDown: startResize("bottom") }),
				h("div", { className: "dsh-panel-body" }, active.render({ side: "bottom", tab: active.id, h: h, React: React })));
		}

		function startResize(side) {
			return function (e) {
				e.preventDefault();
				e.stopPropagation();
				var startPos = side === "right" ? e.clientX : e.clientY;
				var startVal = side === "right" ? state.right.width : state.bottom.height;
				function move(ev) {
					var delta = side === "right" ? (startPos - ev.clientX) : (startPos - ev.clientY);
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
				addTab: addTab,
				removeTab: removeTab,
				open: function (side) { setOpen(side, true); },
				close: function (side) { setOpen(side, false); },
				toggle: toggle,
				setTab: setTab,
				setSize: setSize,
				getState: getState,
				subscribe: subscribe,
				notify: emit,
			};
			// Keyboard shortcuts to reopen hidden panels anywhere (incl. no session):
			// Ctrl+Alt+Right = right panel, Ctrl+Alt+Down = bottom panel.
			document.addEventListener("keydown", function (e) {
				if (!e.ctrlKey || !e.altKey) return;
				var k = e.key ? e.key.toLowerCase() : "";
				if (k === "arrowright") { e.preventDefault(); toggle("right"); }
				else if (k === "arrowdown") { e.preventDefault(); toggle("bottom"); }
			});
			startMetrics();

			whenSettings(function (sf) {
				var sp = (sf && sf.ready) ? sf.ready : Promise.resolve();
				sp.then(function () {
					loadPersisted(sf);
					if (readyResolve) readyResolve();
				});
			});
		}
	apply(ctx);
}

		// ---- Files/Changes/Terminal tabs + header toggles ------------------------------------------------
function applyRightPanel(ctx) {

		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;
		var useRef = React.useRef;

		var API = "http://127.0.0.1:3980";
		var NS = "rightPanel";

		var dict = {
			zh: {
				toggleRight: "右侧面板",
				toggleBottom: "底部面板",
				files: "文件",
				changes: "变更",
				terminal: "终端",
				refresh: "刷新",
				up: "上级目录",
				search: "搜索文件名…",
				emptyDir: "（空目录）",
				loadFailed: "加载失败",
				noPreview: "选择左侧文件查看预览",
				previewTooLarge: "文件过大，无法预览",
				previewBack: "← 返回文件列表",
				file: "文件",
				dir: "目录",
				stage: "暂存",
				unstage: "撤销暂存",
				discard: "丢弃",
				stageAll: "暂存全部",
				unstageAll: "撤销全部",
				discardSel: "丢弃所选",
				stageSel: "暂存所选",
				unstageSel: "撤销所选",
				noChanges: "工作区干净，没有变更。",
				changesIntro: "勾选变更后执行操作",
				selectAll: "全选",
				termPlaceholder: "输入命令，Enter 运行（支持 cd）",
				termRun: "运行",
				termEmpty: "输入命令开始交互，例如 dir / git status / cd ..",
				termRunning: "运行中…",
				termClear: "清屏",
				termFail: "请求失败，请确认 DshDesktop.exe 正在运行",
				statusUnknown: "未知",
				conflict: "冲突",
				added: "新增",
				modified: "修改",
				deleted: "删除",
				renamed: "重命名",
				untracked: "未跟踪",
			},
			en: {
				toggleRight: "Right panel",
				toggleBottom: "Bottom panel",
				files: "Files",
				changes: "Changes",
				terminal: "Terminal",
				refresh: "Refresh",
				up: "Up",
				search: "Search file names…",
				emptyDir: "(empty directory)",
				loadFailed: "Failed to load",
				noPreview: "Select a file on the left to preview",
				previewTooLarge: "File is too large to preview",
				previewBack: "← Back to file list",
				file: "File",
				dir: "Folder",
				stage: "Stage",
				unstage: "Unstage",
				discard: "Discard",
				stageAll: "Stage all",
				unstageAll: "Unstage all",
				discardSel: "Discard selected",
				stageSel: "Stage selected",
				unstageSel: "Unstage selected",
				noChanges: "Working tree is clean.",
				changesIntro: "Select changes, then run an action",
				selectAll: "Select all",
				termPlaceholder: "Type a command, Enter to run (cd supported)",
				termRun: "Run",
				termEmpty: "Start typing to interact, e.g. dir / git status / cd ..",
				termRunning: "Running…",
				termClear: "Clear",
				termFail: "Request failed - make sure DshDesktop.exe is running",
				statusUnknown: "Unknown",
				conflict: "Conflict",
				added: "Added",
				modified: "Modified",
				deleted: "Deleted",
				renamed: "Renamed",
				untracked: "Untracked",
			},
		};
		var t = null;

		function fetchJson(url, options) {
			return fetch(url, options).then(function (r) { return r.json(); });
		}

		function whenPanels(cb, tries) {
			tries = tries || 0;
			if (window.__DSH_PANELS__) { cb(window.__DSH_PANELS__); return; }
			if (tries > 200) return;
			setTimeout(function () { whenPanels(cb, tries + 1); }, 200);
		}

		function usePanelsState() {
			var s = useState(null);
			useEffect(function () {
				var off = null;
				var timer = null;
				function tryBind() {
					var P = window.__DSH_PANELS__;
					if (!P) return false;
					s[1](P.getState());
					off = P.subscribe(function () { s[1](P.getState()); });
					return true;
				}
				if (!tryBind()) {
					timer = setInterval(function () {
						if (tryBind()) { clearInterval(timer); timer = null; }
					}, 500);
				}
				return function () {
					if (off) { try { off(); } catch (e) { } }
					if (timer) clearInterval(timer);
				};
			}, []);
			return s[0];
		}

		// ---- Files tab ------------------------------------------------------

		function FilesTab() {
			var dirState = useState("");
			var dir = dirState[0];
			var setDir = dirState[1];
			var entriesState = useState([]);
			var entries = entriesState[0];
			var setEntries = entriesState[1];
			var errState = useState("");
			var err = errState[0];
			var setErr = errState[1];
			var qState = useState("");
			var q = qState[0];
			var setQ = qState[1];
			var previewState = useState(null);
			var preview = previewState[0];
			var setPreview = previewState[1];

			function loadDir(d, cb) {
				setDir(d);
				setErr("");
				fetchJson(API + "/api/fs/list?dir=" + encodeURIComponent(d)).then(function (m) {
					if (m && m.ok) {
						setEntries(m.items || []);
						if (cb) cb();
					} else {
						setEntries([]);
						setErr((m && m.error) || t("loadFailed"));
					}
				}).catch(function () { setEntries([]); setErr(t("loadFailed")); });
			}

			useEffect(function () {
				fetchJson(API + "/api/settings").then(function (m) {
					var wd = (m && m.serverWorkDir) || "";
					if (wd) { loadDir(wd); return; }
					fetchJson(API + "/api/shell/cwd").then(function (c) {
						loadDir((c && c.cwd) || "");
					}).catch(function () { loadDir(""); });
				}).catch(function () { loadDir(""); });
			}, []);

			function openFile(ent) {
				fetchJson(API + "/api/fs/read?path=" + encodeURIComponent(ent.path)).then(function (m) {
					setPreview({ path: ent.path, name: ent.name, data: m });
				}).catch(function () { });
			}

			if (preview) {
				var pd = preview.data;
				return h("div", { style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } },
					h("div", { style: { display: "flex", alignItems: "center", gap: "8px", paddingBottom: "8px" } },
						h("button", { onClick: function () { setPreview(null); }, style: { cursor: "pointer", background: "transparent", border: "none", color: "inherit", fontSize: "0.929em", padding: 0 } }, t("previewBack")),
						h("span", { style: { fontSize: "0.857em", opacity: ".7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, preview.name)),
					pd && pd.ok === false
						? h("div", { style: { padding: "16px", opacity: ".7", fontSize: "0.929em" } }, pd.error || t("loadFailed"))
						: pd && pd.kind === "image"
							? h("div", { style: { overflow: "auto", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" } },
								h("img", { src: pd.content, style: { maxWidth: "100%", maxHeight: "100%", borderRadius: "8px" } }))
							: h("pre", { style: { flex: 1, overflow: "auto", margin: 0, fontSize: "0.857em", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-all" } },
								(pd && pd.content) || t("previewTooLarge")));
			}

			var shown = q
				? entries.filter(function (e) { return e.name.toLowerCase().indexOf(q.toLowerCase()) >= 0; })
				: entries;

			return h("div", { style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } },
				h("div", { style: { display: "flex", gap: "6px", alignItems: "center", paddingBottom: "6px" } },
					h("button", { onClick: function () { loadDir(dir); }, title: t("refresh"), style: btnStyle() }, "↻"),
					h("button", { onClick: function () { var p = dir.replace(/[\\/]+$/, ""); var i = p.lastIndexOf("\\"); if (i > 0) loadDir(p.substring(0, i)); else loadDir(p.substring(0, 3)); }, title: t("up"), style: btnStyle() }, "↑"),
					h("input", { value: q, onChange: function (e) { setQ(e.target.value); }, placeholder: t("search"), style: { flex: 1, minWidth: 0, padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "inherit", fontSize: "0.857em" } })),
				h("div", { style: { fontSize: "0.786em", opacity: ".65", paddingBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, dir || "…"),
				err ? h("div", { style: { padding: "10px", opacity: ".75", fontSize: "0.857em" } }, err) : null,
				h("div", { style: { flex: 1, overflow: "auto", minHeight: 0 } },
					shown.length === 0
						? h("div", { style: { padding: "12px", opacity: ".5", fontSize: "0.929em" } }, t("emptyDir"))
						: shown.map(function (ent) {
							return h("div", {
								key: ent.path,
								style: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 6px", borderRadius: "6px", cursor: "pointer", fontSize: "0.929em" },
								onMouseEnter: function (e) { e.currentTarget.style.background = "var(--dsw-alias-button-floating-hover)"; },
								onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; },
								onClick: function () {
									if (ent.type === "dir") loadDir(ent.path);
									else if (window.__DSH_OPEN__) window.__DSH_OPEN__.openResource({ path: ent.path, name: ent.name });
									else openFile(ent);
								},
							},
								h("span", { style: { flex: "none", opacity: ".8" } }, ent.type === "dir" ? "📁" : "📄"),
								h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ent.name),
								ent.type === "file" ? h("span", { style: { flex: "none", fontSize: "0.786em", opacity: ".55" } }, fmtSize(ent.size)) : null);
						})));
		}

		// ---- Changes tab ----------------------------------------------------

		function ChangesTab() {
			var stState = useState(null);
			var st = stState[0];
			var setSt = stState[1];
			var selState = useState({});
			var sel = selState[0];
			var setSel = selState[1];
			var busyState = useState(false);
			var busy = busyState[0];
			var setBusy = busyState[1];

			function refresh() {
				fetchJson(API + "/api/settings").then(function (m) {
					var wd = (m && m.serverWorkDir) || "";
					return fetchJson(API + "/api/git/status?dir=" + encodeURIComponent(wd));
				}).then(function (s) { setSt(s); setSel({}); }).catch(function () { setSt({ ok: false }); });
			}

			useEffect(function () { refresh(); }, []);

			function gitAction(action, paths, thenRefresh) {
				setBusy(true);
				fetchJson(API + "/api/settings").then(function (m) {
					var wd = (m && m.serverWorkDir) || "";
					var targets = (paths && paths.length) ? paths : ["."];
					var reqs = targets.map(function (p) {
						return fetchJson(API + "/api/git/" + action, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ dir: wd, path: p }),
						});
					});
					return Promise.all(reqs);
				}).then(function () {
					if (thenRefresh) refresh();
				}).catch(function () { }).finally(function () { setBusy(false); });
			}

			var changes = (st && st.changes) || [];
			var selected = Object.keys(sel).filter(function (k) { return sel[k]; });

			function toggleSel(path) {
				var n = Object.assign({}, sel);
				n[path] = !n[path];
				setSel(n);
			}

			return h("div", { style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } },
				h("div", { style: { display: "flex", gap: "6px", alignItems: "center", paddingBottom: "6px", flexWrap: "wrap" } },
					h("button", { onClick: refresh, disabled: busy, style: btnStyle() }, t("refresh")),
					h("button", { onClick: function () { gitAction("stage", selected, true); }, disabled: busy || !selected.length, style: btnStyle() }, t("stageSel")),
					h("button", { onClick: function () { gitAction("unstage", selected, true); }, disabled: busy || !selected.length, style: btnStyle() }, t("unstageSel")),
					h("button", { onClick: function () { gitAction("stage", ['.'], true); }, disabled: busy, style: btnStyle() }, t("stageAll")),
					h("button", { onClick: function () { gitAction("discard", selected, true); }, disabled: busy || !selected.length, style: btnStyle(true) }, t("discardSel"))),
				st && st.ok === false
					? h("div", { style: { padding: "10px", opacity: ".75", fontSize: "0.857em" } }, (st.error || t("loadFailed")) + (st.error && st.error.indexOf("not a git repository") >= 0 ? "" : ""))
					: changes.length === 0
						? h("div", { style: { padding: "14px", opacity: ".55", fontSize: "0.929em" } }, t("noChanges"))
						: h("div", { style: { flex: 1, overflow: "auto", minHeight: 0 } },
							changes.map(function (ch) {
								var pathLabel = ch.to ? ch.path + " → " + ch.to : ch.path;
								return h("label", {
									key: ch.path + "|" + ch.to,
									style: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 6px", borderRadius: "6px", cursor: "pointer", fontSize: "0.929em" },
								},
									h("input", { type: "checkbox", checked: !!sel[ch.path], onChange: function () { toggleSel(ch.path); } }),
									h("span", { style: { flex: "none", fontSize: "0.786em", fontWeight: 600, color: statusColor(ch.x, ch.y) } }, statusText(ch.x, ch.y)),
									h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pathLabel));
							})));
		}

		// ---- Terminal tab ---------------------------------------------------

		function TerminalTab() {
			var cwdState = useState("");
			var cwd = cwdState[0];
			var setCwd = cwdState[1];
			var linesState = useState([]);
			var lines = linesState[0];
			var setLines = linesState[1];
			var inputState = useState("");
			var input = inputState[0];
			var setInput = inputState[1];
			var busyState = useState(false);
			var busy = busyState[0];
			var setBusy = busyState[1];
			var bodyRef = useRef(null);

			useEffect(function () {
				fetchJson(API + "/api/shell/cwd").then(function (m) {
					if (m && m.ok && m.cwd) setCwd(m.cwd);
				}).catch(function () { });
			}, []);

			useEffect(function () {
				if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
			}, [lines]);

			function run(cmd) {
				var c = (cmd || "").trim();
				if (!c || busy) return;
				setBusy(true);
				setLines(function (prev) {
					return prev.concat([{ kind: "in", text: cwd + "> " + c }]);
				});
				fetchJson(API + "/api/shell/exec", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ dir: cwd, command: c }),
				}).then(function (m) {
					var out = (m && m.output) || "";
					setLines(function (prev) {
						var next = prev.slice();
						if (out) next.push({ kind: "out", text: out });
						if (m && m.cwd) next.push({ kind: "cwd", text: m.cwd });
						return next;
					});
					if (m && m.cwd) setCwd(m.cwd);
				}).catch(function () {
					setLines(function (prev) { return prev.concat([{ kind: "err", text: t("termFail") }]); });
				}).finally(function () { setBusy(false); setInput(""); });
			}

			return h("div", { style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } },
				h("div", { style: { display: "flex", gap: "6px", alignItems: "center", paddingBottom: "6px" } },
					h("span", { style: { fontSize: "0.786em", opacity: ".7", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, cwd || "…"),
					h("button", { onClick: function () { setLines([]); }, style: btnStyle() }, t("termClear"))),
				h("div", { ref: bodyRef, style: { flex: 1, overflow: "auto", minHeight: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "0.857em", lineHeight: "1.55", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--dsw-alias-bg-mask-1)", borderRadius: "8px", padding: "8px 10px" } },
					lines.length === 0
						? h("div", { style: { opacity: ".5" } }, t("termEmpty"))
						: lines.map(function (ln, i) {
							var color = ln.kind === "in" ? "var(--dsw-static-green-500)" : ln.kind === "err" ? "var(--dsw-static-red-500)" : ln.kind === "cwd" ? "var(--dsw-static-blue-500)" : "inherit";
							return h("div", { key: i, style: { color: color } }, ln.text);
						})),
				h("div", { style: { display: "flex", gap: "6px", paddingTop: "8px" } },
					h("span", { style: { fontSize: "0.929em", opacity: ".85", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" } }, ">"),
					h("input", {
						value: input,
						onChange: function (e) { setInput(e.target.value); },
						onKeyDown: function (e) { if (e.key === "Enter") run(input); },
						placeholder: t("termPlaceholder"),
						disabled: busy,
						style: { flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "inherit", fontSize: "0.857em", fontFamily: "Consolas, monospace" },
					}),
					h("button", { onClick: function () { run(input); }, disabled: busy, style: btnStyle() }, busy ? t("termRunning") : t("termRun"))));
		}

		// ---- shared bits ----------------------------------------------------

		function btnStyle(danger) {
			return {
				padding: "4px 10px", fontSize: "0.857em", borderRadius: "6px", cursor: "pointer",
				background: "transparent", border: "1px solid " + (danger ? "var(--dsw-static-red-500)" : "var(--dsw-alias-border-l2)"),
				color: danger ? "var(--dsw-static-red-500)" : "inherit",
			};
		}

		function fmtSize(n) {
			if (n == null) return "";
			if (n < 1024) return n + " B";
			if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
			return (n / 1024 / 1024).toFixed(1) + " MB";
		}

		function statusText(x, y) {
			var key = (x || "") + (y || "");
			if (key === "??") return t("untracked");
			if (key === "UU" || key === "DD" || key === "AA") return t("conflict");
			if (key.indexOf("A") >= 0) return t("added");
			if (key.indexOf("R") >= 0) return t("renamed");
			if (key.indexOf("D") >= 0) return t("deleted");
			if (key.indexOf("M") >= 0 || key.indexOf("T") >= 0) return t("modified");
			return t("statusUnknown");
		}

		function statusColor(x, y) {
			var key = (x || "") + (y || "");
			if (key === "??") return "var(--dsw-static-blue-500)";
			if (key.indexOf("U") >= 0) return "var(--dsw-static-red-500)";
			if (key.charAt(0) === "A" || key.charAt(0) === "?") return "var(--dsw-static-green-500)";
			return "var(--dsw-static-amber-500)";
		}

		// ---- header toggle buttons ------------------------------------------

		function ToggleButtons() {
			var st = usePanelsState();
			if (!st) return h("div", { style: { display: "flex", gap: "4px" } });
			return h("div", { style: { display: "flex", gap: "4px", alignItems: "center" } },
				h("button", {
					title: t("toggleRight"),
					onClick: function () { window.__DSH_PANELS__.toggle("right"); },
					style: toggleBtnStyle(st.right.open),
				}, dshIcon("panel-right", 16)),
				h("button", {
					title: t("toggleBottom"),
					onClick: function () { window.__DSH_PANELS__.toggle("bottom"); },
					style: toggleBtnStyle(st.bottom.open),
				}, dshIcon("panel-bottom", 16)));
		}

		function toggleBtnStyle(active) {
			return {
				width: "28px", height: "28px", borderRadius: "8px", cursor: "pointer",
				lineHeight: "1", display: "inline-flex", alignItems: "center", justifyContent: "center",
				background: active ? "var(--dsw-alias-button-ghost-active-fill)" : "transparent",
				border: "1px solid " + (active ? "var(--dsw-alias-button-ghost-active-border)" : "var(--dsw-alias-border-l2)"),
				color: "inherit",
			};
		}

		// ---- plugin apply ---------------------------------------------------

		function apply(ctx) {
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "right-panel: dictionaries");
			t = ctx.locale.bind(NS);

			var standardTabs = {
				files: { side: "right", id: "files", label: function () { return t("files"); }, order: 10, render: function () { return h(FilesTab); } },
				changes: { side: "right", id: "changes", label: function () { return t("changes"); }, order: 20, render: function () { return h(ChangesTab); } },
				terminal: { side: "bottom", id: "terminal", label: function () { return t("terminal"); }, order: 10, render: function () { return h(TerminalTab); } },
			};
			function ensureStandardTab(id) {
				var P = window.__DSH_PANELS__;
				if (!P || !standardTabs[id]) return;
				var def = standardTabs[id];
				var st = P.getState();
				var list = def.side === "right" ? st.right.tabs : st.bottom.tabs;
				for (var i = 0; i < list.length; i++) if (list[i].id === id) { P.setTab(def.side, id); return; }
				P.registerPanel({ side: def.side, id: def.id, label: def.label, order: def.order, closable: true, render: def.render });
				P.setTab(def.side, id);
			}
			window.__DSH_TABS__ = { ensure: ensureStandardTab };
			whenPanels(function (P) {
				P.registerPanel({ side: "right", id: "files", label: function () { return t("files"); }, order: 10, closable: true, render: function () { return h(FilesTab); } });
				P.registerPanel({ side: "right", id: "changes", label: function () { return t("changes"); }, order: 20, closable: true, render: function () { return h(ChangesTab); } });
				P.registerPanel({ side: "bottom", id: "terminal", label: function () { return t("terminal"); }, order: 10, closable: true, render: function () { return h(TerminalTab); } });
			});

			ctx.slots.inject("conversation.session.header.utilities", function () {
				return ctx.slots.register({
					name: "conversation.session.header.utilities",
					id: "panel-toggles",
					order: 100,
				}, ToggleButtons);
			});
		}
	apply(ctx);
}

		// ---- desktop extras (viewers, open settings, linkify) ----------------
// dsh-desktop-framework extras: open-mode settings, multi-type viewers,
// conversation link-ification with chooser/context menu, and a WebGL
// STL/OBJ model viewer. All client-side, plugin-only.
function applyDesktopExtras(ctx) {
    var React = require("react");
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;

    var API = "http://127.0.0.1:3980";
    var NS = "desktopExtras";
    var t = null;

    var dict = {
        zh: {
            nav: "文件打开", hint: "选择每类文件优先的打开方式",
            ask: "每次询问", desktop: "桌面端打开", system: "系统默认应用", copy: "复制链接",
            image: "图片", video: "视频", pdf: "PDF", markdown: "Markdown", code: "代码",
            text: "文本", html: "HTML 网页", model3d: "3D 模型", web: "网页链接", other: "其他文件",
            chooseOpen: "选择打开方式", openSystem: "系统默认应用打开", openDesktop: "在桌面端打开", copyOk: "已复制",
            loading: "加载中…", failed: "加载失败", unsupported: "不支持的查看类型",
            reset: "复位",
        },
        en: {
            nav: "Open files", hint: "Choose the preferred open mode per file type",
            ask: "Ask each time", desktop: "Open in desktop", system: "System default app", copy: "Copy link",
            image: "Image", video: "Video", pdf: "PDF", markdown: "Markdown", code: "Code",
            text: "Text", html: "HTML page", model3d: "3D Model", web: "Web link", other: "Other files",
            chooseOpen: "Choose how to open", openSystem: "Open with system default", openDesktop: "Open in desktop", copyOk: "Copied",
            loading: "Loading…", failed: "Failed to load", unsupported: "Unsupported viewer type",
            reset: "Reset",
        },
    };

    function fetchJson(url, options) {
        return fetch(url, options).then(function (r) { return r.json(); });
    }

    // ---- file type classification -----------------------------------------
    var TYPE_MAP = {
        image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"],
        video: ["mp4", "webm", "mov", "mkv", "avi", "m4v", "ogv"],
        pdf: ["pdf"],
        markdown: ["md", "markdown", "mdown"],
        html: ["html", "htm"],
        code: ["js", "ts", "tsx", "jsx", "mjs", "cjs", "py", "java", "c", "h", "cpp", "hpp", "cc", "cs", "go", "rs", "rb", "php", "swift", "kt", "sql", "css", "scss", "less", "json", "yaml", "yml", "toml", "xml", "sh", "ps1", "bat", "cmd", "vue", "svelte", "astro", "dockerfile", "makefile", "gradle"],
        text: ["txt", "log", "ini", "cfg", "conf", "csv", "tsv", "env", "gitignore", "editorconfig", "license", "readme"],
        model3d: ["stl", "obj", "glb", "gltf", "ply", "off"],
    };
    function extOf(name) {
        var n = String(name || "").toLowerCase();
        var i = n.lastIndexOf(".");
        if (i < 0 || i === n.length - 1) return "";
        return n.substring(i + 1);
    }
    function kindOf(name) {
        var e = extOf(name);
        for (var k in TYPE_MAP) if (TYPE_MAP[k].indexOf(e) >= 0) return k;
        return e === "" ? "unknown" : "other";
    }
    function modeOf(kind) {
        var sf = window.__DSH_SETTINGS__;
        var v = sf ? sf.get("openMode_" + kind) : undefined;
        return v === "system" || v === "desktop" ? v : "ask";
    }

    function openSystemPath(path) {
        return fetchJson(API + "/api/fs/open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: path }),
        });
    }
    function openSystemUrl(url) {
        return fetchJson(API + "/api/fs/open-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url }),
        });
    }
    function copyText(s) {
        try { navigator.clipboard.writeText(s); } catch (e) { }
    }    // ---- chooser / context menu -------------------------------------------
    var menuEl = null;
    function showMenu(items, x, y) {
        hideMenu();
        menuEl = document.createElement("div");
        menuEl.className = "dsh-open-menu";
        menuEl.style.left = x + "px";
        menuEl.style.top = y + "px";
        items.forEach(function (it) {
            var b = document.createElement("button");
            b.textContent = it.label;
            b.className = "dsh-open-menu-item";
            b.onclick = function () { hideMenu(); it.action(); };
            menuEl.appendChild(b);
        });
        document.body.appendChild(menuEl);
        setTimeout(function () {
            document.addEventListener("mousedown", function h(e) {
                if (menuEl && menuEl.contains(e.target)) return;
                hideMenu();
                document.removeEventListener("mousedown", h);
            });
        }, 0);
    }
    function onDocDown() { hideMenu(); }
    function hideMenu() {
        if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
        menuEl = null;
    }

    function openResource(res, x, y) {
        var isUrl = !!res.url;
        var name = res.name || (res.url ? res.url : "");
        var kind = res.kind || (isUrl ? "web" : kindOf(name));
        var mode = modeOf(kind);
        if (mode === "system") {
            if (isUrl) openSystemUrl(res.url); else openSystemPath(res.path);
            return;
        }
        if (mode === "desktop") {
            if (isUrl) openWeb(res.url); else openViewer(res, kind);
            return;
        }
        showMenu([
            { label: t("openDesktop"), action: function () { if (isUrl) openWeb(res.url); else openViewer(res, kind); } },
            { label: t("openSystem"), action: function () { if (isUrl) openSystemUrl(res.url); else openSystemPath(res.path); } },
            { label: t("copy"), action: function () { copyText(isUrl ? res.url : res.path); } },
        ], x, y);
    }

    // ---- viewers -----------------------------------------------------------
    var viewerSeq = 0;
    function addViewerTab(label, render) {
        var P = window.__DSH_PANELS__;
        if (!P) return null;
        viewerSeq++;
        var id = "viewer-" + viewerSeq;
        P.addTab("right", {
            id: id,
            label: label,
            order: 80,
            closable: true,
            activate: true,
            render: render,
        });
        P.open("right");
        return id;
    }
    function openViewer(res, kind) {
        var name = res.name || "viewer";
        var label = name.length > 22 ? name.slice(0, 22) + "…" : name;
        var keyRes = { path: res.path, url: res.url, name: name };
        var kindNow = kind || kindOf(name);
        addViewerTab(label, function () { return h(ViewerTab, { key: "v" + viewerSeq, kind: kindNow, res: keyRes }); });
    }
    function openWeb(url) {
        var label = url.length > 22 ? url.slice(0, 22) + "…" : url;
        var keyRes = { url: url, name: url };
        addViewerTab(label, function () { return h(ViewerTab, { key: "v" + viewerSeq, kind: "web", res: keyRes }); });
    }    // Local web-page URL for an HTML file: /serve/<url-encoded windows path>.
    // Segments are encoded individually so relative assets resolve next to the
    // file and the exe serves them from the same URL space.
    function serveUrl(path) {
        var win = String(path || "").replace(/\\/g, "/");
        var parts = win.split("/").map(function (seg) { return encodeURIComponent(seg); });
        return API + "/serve/" + parts.join("/");
    }
    // ---- markdown renderer (compact, GitHub-ish) ---------------------------
    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function inlineMd(s) {
        s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
        s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" class="dsh-md-img" />');
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="dsh-md-link">$1</a>');
        s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
        s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,!?]|$)/g, "$1<em>$2</em>");
        return s;
    }
    function renderMarkdown(md) {
        if (!md) return "";
        var lines = String(md).replace(/\r\n/g, "\n").split("\n");
        var out = [];
        var i = 0, n = lines.length;
        var inCode = false, codeBuf = [];
        var inTable = false, tableBuf = [];
        function flushTable() {
            if (!tableBuf.length) return;
            var rows = tableBuf.map(function (r) { return r.split("|").map(function (c) { return c.trim(); }); });
            var header = rows[0] || [];
            var html = "<table class=\"dsh-md-table\"><thead><tr>" + header.map(function (c) { return "<th>" + inlineMd(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
            for (var r = 1; r < rows.length; r++) {
                html += "<tr>" + rows[r].map(function (c) { return "<td>" + inlineMd(c) + "</td>"; }).join("") + "</tr>";
            }
            html += "</tbody></table>";
            out.push(html);
            tableBuf = [];
        }
        for (i = 0; i < n; i++) {
            var line = lines[i];
            var tline = line.trim();
            if (/^```/.test(tline)) {
                if (inCode) {
                    out.push("<pre class=\"dsh-md-pre\"><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
                    codeBuf = []; inCode = false;
                } else {
                    flushTable(); inCode = true;
                }
                continue;
            }
            if (inCode) { codeBuf.push(line); continue; }
            if (/^\|/.test(tline) && /\|$/.test(tline)) {
                if (!inTable) { flushTable(); inTable = true; tableBuf = []; }
                tableBuf.push(tline);
                continue;
            }
            if (inTable && tline === "") { flushTable(); inTable = false; continue; }
            if (inTable) { flushTable(); inTable = false; }
            if (tline === "") { continue; }
            if (/^#{1,6}\s/.test(tline)) {
                var m = tline.match(/^(#{1,6})\s+(.*)$/);
                var lv = m[1].length;
                out.push("<h" + lv + " class=\"dsh-md-h\">" + inlineMd(m[2]) + "</h" + lv + ">");
                continue;
            }
            if (/^(-{3,}|\*{3,}|_{3,})$/.test(tline)) { out.push("<hr class=\"dsh-md-hr\" />"); continue; }
            if (/^&gt;\s?/.test(tline)) { out.push("<blockquote class=\"dsh-md-bq\">" + inlineMd(tline.replace(/^&gt;\s?/, "")) + "</blockquote>"); continue; }
            if (/^[-*+]\s+/.test(tline)) { out.push("<li class=\"dsh-md-li\">" + inlineMd(tline.replace(/^[-*+]\s+/, "")) + "</li>"); continue; }
            if (/^\d+\.\s+/.test(tline)) { out.push("<li class=\"dsh-md-li\">" + inlineMd(tline.replace(/^\d+\.\s+/, "")) + "</li>"); continue; }
            out.push("<p class=\"dsh-md-p\">" + inlineMd(tline) + "</p>");
        }
        if (inCode) out.push("<pre class=\"dsh-md-pre\"><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
        flushTable();
        return out.join("\n");
    }    // ---- viewer components ------------------------------------------------
    function ViewerTab(props) {
        var kind = props.kind;
        var res = props.res;
        var st = useState({ loading: true, error: "", text: "", dataUrl: "", objectUrl: "", src: "" });
        var state = st[0];
        var setState = st[1];
        var key = res.path || res.url || "";

        useEffect(function () {
            var cancelled = false;
            setState({ loading: true, error: "", text: "", dataUrl: "", objectUrl: "", src: "" });
            if (kind === "web") {
                setState({ loading: false, error: "", text: "", dataUrl: "", objectUrl: "", src: res.url });
                return;
            }
            if (kind === "html") {
                // Render local HTML files as real web pages (via the exe /serve/
                // route so relative css/js/img assets resolve correctly).
                setState({ loading: false, error: "", text: "", dataUrl: "", objectUrl: "", src: serveUrl(res.path) });
                return;
            }
            if (!res.path) { setState({ loading: false, error: "no path", text: "", dataUrl: "", objectUrl: "", src: "" }); return; }
            if (kind === "video" || kind === "pdf" || kind === "model3d") {
                fetch(API + "/api/fs/raw?path=" + encodeURIComponent(res.path))
                    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.blob(); })
                    .then(function (b) {
                        if (cancelled) return;
                        var url = URL.createObjectURL(b);
                        setState({ loading: false, error: "", text: "", dataUrl: "", objectUrl: url, src: url });
                    })
                    .catch(function () { if (!cancelled) setState({ loading: false, error: "load failed", text: "", dataUrl: "", objectUrl: "", src: "" }); });
                return;
            }
            fetchJson(API + "/api/fs/read?path=" + encodeURIComponent(res.path))
                .then(function (m) {
                    if (cancelled) return;
                    if (!m || m.ok === false) { setState({ loading: false, error: (m && m.error) || "load failed", text: "", dataUrl: "", objectUrl: "", src: "" }); return; }
                    if (m.kind === "image") setState({ loading: false, error: "", text: "", dataUrl: m.content || "", objectUrl: "", src: m.content || "" });
                    else setState({ loading: false, error: "", text: m.content || "", dataUrl: "", objectUrl: "", src: "" });
                })
                .catch(function () { if (!cancelled) setState({ loading: false, error: "load failed", text: "", dataUrl: "", objectUrl: "", src: "" }); });
            return function () {
                cancelled = true;
                if (state.objectUrl) { try { URL.revokeObjectURL(state.objectUrl); } catch (e) { } }
            };
        }, [kind, key]);

        if (state.loading) return h("div", { className: "dsh-viewer-status" }, t("loading"));
        if (state.error) {
            return h("div", { className: "dsh-viewer-status" },
                h("div", {}, t("failed") + (state.error ? ": " + state.error : "")),
                res.path ? h("button", { className: "dsh-viewer-action", onClick: function () { openSystemPath(res.path); } }, t("system")) : null);
        }
        if (kind === "markdown") {
            return h("div", { className: "dsh-viewer dsh-md" },
                h("div", { className: "dsh-md-body", dangerouslySetInnerHTML: { __html: renderMarkdown(state.text) } }));
        }
        if (kind === "code" || kind === "text" || kind === "other" || kind === "unknown") {
            return h("div", { className: "dsh-viewer" },
                h("pre", { className: "dsh-viewer-pre" }, state.text || ""));
        }
        if (kind === "image") return h(ImageViewer, { src: state.src });
        if (kind === "video") {
            return h("div", { className: "dsh-viewer dsh-viewer-media" },
                state.src ? h("video", { src: state.src, controls: true, autoPlay: false, className: "dsh-viewer-video" }) : null);
        }
        if (kind === "pdf") {
            return h("div", { className: "dsh-viewer dsh-viewer-media" },
                state.src ? h("iframe", { src: state.src, className: "dsh-viewer-frame", title: res.name || "pdf" }) : null);
        }
        if (kind === "html" || kind === "web") {
            return h("div", { className: "dsh-viewer dsh-viewer-media" },
                h("iframe", { src: kind === "html" ? state.src : res.url, className: "dsh-viewer-frame", title: res.name || (kind === "html" ? "html" : "web") }));
        }
        if (kind === "model3d") return h(ModelViewer, { res: res });
        return h("div", { className: "dsh-viewer-status" }, t("unsupported"));
    }

    function ImageViewer(props) {
        var st = useState({ zoom: 1, fit: true });
        var s = st[0]; var set = st[1];
        function zoomBy(f) {
            set(function (old) {
                var z = Math.max(0.1, Math.min(8, old.zoom * f));
                return { zoom: z, fit: z === 1 };
            });
        }
        return h("div", { className: "dsh-viewer dsh-viewer-image" },
            h("div", { className: "dsh-viewer-toolbar" },
                h("button", { className: "dsh-viewer-action", onClick: function () { zoomBy(1.25); } }, "+"),
                h("button", { className: "dsh-viewer-action", onClick: function () { zoomBy(0.8); } }, "-"),
                h("button", { className: "dsh-viewer-action", onClick: function () { set({ zoom: 1, fit: true }); } }, t("reset"))),
            h("div", { className: "dsh-viewer-image-stage" },
                h("img", {
                    src: props.src,
                    className: "dsh-viewer-image-img",
                    style: {
                        transform: "scale(" + s.zoom + ")",
                        maxWidth: s.fit ? "100%" : "none",
                        maxHeight: s.fit ? "100%" : "none",
                    },
                    draggable: false,
                })));
    }    // ---- WebGL model viewer (STL/OBJ) -------------------------------------
    function parseModel(buf, name) {
        var dv = new DataView(buf);
        var ext = extOf(name);
        var verts = [];
        function pushTri(a, b, c) {
            verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        }
        if (ext === "stl") {
            if (buf.byteLength > 84 && dv.getUint32(80, true) * 50 + 84 === buf.byteLength) {
                var count = dv.getUint32(80, true);
                for (var i = 0; i < count; i++) {
                    var o = 84 + i * 50;
                    var a = [dv.getFloat32(o + 12, true), dv.getFloat32(o + 16, true), dv.getFloat32(o + 20, true)];
                    var b = [dv.getFloat32(o + 24, true), dv.getFloat32(o + 28, true), dv.getFloat32(o + 32, true)];
                    var c = [dv.getFloat32(o + 36, true), dv.getFloat32(o + 40, true), dv.getFloat32(o + 44, true)];
                    pushTri(a, b, c);
                }
            } else {
                var text = new TextDecoder().decode(buf);
                var re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
                var m, tri = [];
                while ((m = re.exec(text)) !== null) {
                    tri.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
                    if (tri.length === 3) { pushTri(tri[0], tri[1], tri[2]); tri = []; }
                }
            }
        } else if (ext === "obj") {
            var t2 = new TextDecoder().decode(buf);
            var vv = [];
            t2.split(/\r?\n/).forEach(function (ln) {
                var p = ln.trim().split(/\s+/);
                if (p[0] === "v" && p.length >= 4) vv.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
                else if (p[0] === "f" && p.length >= 4) {
                    var idx = [];
                    for (var k = 1; k < p.length; k++) {
                        var pi = p[k].split("/")[0];
                        var vi = parseInt(pi, 10);
                        if (vi > 0) idx.push(vi - 1); else if (vi < 0) idx.push(vv.length + vi);
                    }
                    for (var j = 1; j + 1 < idx.length; j++) pushTri(vv[idx[0]], vv[idx[j]], vv[idx[j + 1]]);
                }
            });
        }
        if (verts.length < 9) return null;
        var minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
        for (var i = 0; i < verts.length; i += 3) {
            if (verts[i] < minX) minX = verts[i]; if (verts[i] > maxX) maxX = verts[i];
            if (verts[i + 1] < minY) minY = verts[i + 1]; if (verts[i + 1] > maxY) maxY = verts[i + 1];
            if (verts[i + 2] < minZ) minZ = verts[i + 2]; if (verts[i + 2] > maxZ) maxZ = verts[i + 2];
        }
        var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
        var r = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2;
        if (r <= 0) r = 1;
        var arr = new Float32Array(verts.length);
        for (var i = 0; i < verts.length; i += 3) {
            arr[i] = (verts[i] - cx) / r;
            arr[i + 1] = (verts[i + 1] - cy) / r;
            arr[i + 2] = (verts[i + 2] - cz) / r;
        }
        return arr;
    }

    function startModelRenderer(gl, verts) {
        var vs = "attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uProj;uniform mat4 uView;uniform vec3 uLight;varying vec3 vNor;varying vec3 vPos;void main(){vNor=aNor;vPos=aPos;gl_Position=uProj*uView*vec4(aPos,1.0);}";
        var fs = "precision mediump float;varying vec3 vNor;varying vec3 vPos;uniform vec3 uColor;void main(){vec3 n=normalize(vNor);vec3 l=normalize(uLight);float d=max(dot(n,l),0.0);float a=0.35;float s=pow(max(dot(reflect(-l,n),normalize(-vPos)),0.0),24.0);vec3 c=uColor*(a+d*0.85)+vec3(1.0)*s*0.5;gl_FragColor=vec4(c,1.0);}";
        function sh(type, src) {
            var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        }
        var prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        gl.useProgram(prog);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        var aPos = gl.getAttribLocation(prog, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
        var normals = new Float32Array(verts.length);
        for (var i = 0; i < verts.length; i += 9) {
            var ax = verts[i], ay = verts[i + 1], az = verts[i + 2];
            var bx = verts[i + 3], by = verts[i + 4], bz = verts[i + 5];
            var cx = verts[i + 6], cy = verts[i + 7], cz = verts[i + 8];
            var ux = bx - ax, uy = by - ay, uz = bz - az;
            var vx = cx - ax, vy = cy - ay, vz = cz - az;
            var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            for (var j = 0; j < 3; j++) { normals[i + j * 3] = nx / len; normals[i + j * 3 + 1] = ny / len; normals[i + j * 3 + 2] = nz / len; }
        }
        var nb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nb);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        var aNor = gl.getAttribLocation(prog, "aNor");
        gl.enableVertexAttribArray(aNor);
        gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 24, 0);
        var uProj = gl.getUniformLocation(prog, "uProj");
        var uView = gl.getUniformLocation(prog, "uView");
        var uLight = gl.getUniformLocation(prog, "uLight");
        var uColor = gl.getUniformLocation(prog, "uColor");
        gl.uniform3f(uLight, 0.5, 0.8, 1.0);
        gl.uniform3f(uColor, 0.42, 0.56, 0.95);
        var rotX = -0.5, rotY = 0.6, dist = 3.2;
        var count = verts.length / 3;
        var drag = null;
        var canvas = gl.canvas;
        function resize() {
            var w = canvas.clientWidth, hgt = canvas.clientHeight;
            if (w === 0 || hgt === 0) return;
            if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
            gl.viewport(0, 0, w, hgt);
            gl.uniformMatrix4fv(uProj, false, persp(0.9, w / (hgt || 1), 0.1, 20));
        }
        function persp(fov, aspect, near, far) {
            var f = 1 / Math.tan(fov / 2);
            var m = new Float32Array(16);
            m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = (2 * far * near) / (near - far);
            return m;
        }
        function view() {
            var m = new Float32Array(16);
            var cx = Math.cos(rotY), sx = Math.sin(rotY), cy = Math.cos(rotX), sy = Math.sin(rotX);
            var r = new Float32Array(16);
            r[0] = cx; r[2] = -sx; r[8] = sx; r[10] = cx; r[5] = 1; r[15] = 1;
            var rx = new Float32Array(16);
            rx[5] = cy; rx[6] = sy; rx[9] = -sy; rx[10] = cy; rx[0] = 1; rx[15] = 1;
            for (var col = 0; col < 4; col++) for (var row = 0; row < 4; row++) {
                var sum = 0;
                for (var k = 0; k < 4; k++) sum += r[k * 4 + row] * rx[col * 4 + k];
                m[col * 4 + row] = sum;
            }
            m[14] = -dist;
            m[15] = 1;
            return m;
        }
        function draw() {
            resize();
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.uniformMatrix4fv(uView, false, view());
            gl.drawArrays(gl.TRIANGLES, 0, count);
        }
        canvas.addEventListener("mousedown", function (e) {
            drag = { x: e.clientX, y: e.clientY };
            if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        });
        window.addEventListener("mousemove", function (e) {
            if (!drag) return;
            rotY += (e.clientX - drag.x) * 0.01;
            rotX += (e.clientY - drag.y) * 0.01;
            drag = { x: e.clientX, y: e.clientY };
            draw();
        });
        window.addEventListener("mouseup", function () { drag = null; });
        canvas.addEventListener("wheel", function (e) {
            e.preventDefault();
            dist = Math.max(1.2, Math.min(12, dist + e.deltaY * 0.003));
            draw();
        }, { passive: false });
        window.addEventListener("resize", draw);
        draw();
    }

    function ModelViewer(props) {
        var ref = useRef(null);
        var st = useState({ error: "" });
        var setState = st[1];
        useEffect(function () {
            var el = ref.current;
            if (!el) return;
            var gl = el.getContext("webgl");
            if (!gl) { setState({ error: "WebGL unavailable" }); return; }
            var cancelled = false;
            fetch(API + "/api/fs/raw?path=" + encodeURIComponent(props.res.path))
                .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.arrayBuffer(); })
                .then(function (buf) {
                    if (cancelled) return;
                    var geo = parseModel(buf, props.res.name);
                    if (!geo) { setState({ error: "unsupported model" }); return; }
                    startModelRenderer(gl, geo);
                })
                .catch(function () { if (!cancelled) setState({ error: "load failed" }); });
            return function () { cancelled = true; };
        }, [props.res.path]);
        return h("div", { className: "dsh-viewer dsh-viewer-model" },
            h("canvas", { ref: ref, className: "dsh-viewer-model-canvas" }),
            st[0].error ? h("div", { className: "dsh-viewer-status" }, st[0].error) : null);
    }    // ---- settings registration --------------------------------------------
    function registerSettings() {
        var sf = window.__DSH_SETTINGS__;
        if (!sf) return;
        var kinds = ["image", "video", "pdf", "markdown", "html", "code", "text", "model3d", "web", "other"];
        var opts = [
            { value: "ask", label: t("ask") },
            { value: "desktop", label: t("desktop") },
            { value: "system", label: t("system") },
        ];
        sf.registerTab({ id: "fileOpen", label: function () { return t("nav"); }, order: 1010 });
        kinds.forEach(function (k) {
            sf.registerItem({
                tabId: "fileOpen",
                key: "openMode_" + k,
                type: "select",
                label: t(k),
                hint: t("hint"),
                // HTML files render as real web pages in the right panel by
                // default; every other type still asks first.
                defaultValue: k === "html" ? "desktop" : "ask",
                options: opts,
            });
        });
    }

    // ---- link-ification ---------------------------------------------------
    var LINK_RE = /(https?:\/\/[^\s<>"'()]+|(?:[A-Za-z]:[\\/](?:[^<>"'\n]+?\.\w{1,10})(?=[，。、；：,;:!?…\s]|$)|[A-Za-z]:[\\/](?:[^<>"'\n]+?[\\/])))/g;
    function isLocalRef(s) {
        return /^[A-Za-z]:[\\/]/.test(s) || /^file:\/\//i.test(s);
    }
    function localPath(s) {
        s = String(s || "");
        if (/^file:\/\//i.test(s)) {
            s = s.replace(/^file:\/\//i, "");
            try { s = decodeURIComponent(s); } catch (e) { }
            s = s.replace(/\//g, "\\");
        }
        return s;
    }
    function isLinkableParent(node) {
        if (!node) return false;
        var tag = node.tagName ? node.tagName.toLowerCase() : "";
        if (tag === "button" || tag === "textarea" || tag === "input" || tag === "select" || tag === "iframe" || tag === "svg") return false;
        if (node.closest && node.closest(".dsh-panel-right, .dsh-panel-bottom, .dsh-open-menu, .dsh-panel-plus-menu, a.dsh-link, .dsh-md-body")) return false;
        return true;
    }
    function handleClick(e) {
        var tgt = e.target;
        var a = tgt && tgt.closest ? tgt.closest("a.dsh-link") : null;
        if (a) {
            e.preventDefault();
            e.stopPropagation();
            openResource({ path: a.getAttribute("data-path") || "", url: a.getAttribute("data-url") || "", name: a.getAttribute("data-name") || "" }, e.clientX, e.clientY);
            return;
        }
        // intercept app-rendered <a> whose href is a local file path
        var aa = tgt && tgt.closest ? tgt.closest("a[href]") : null;
        if (aa) {
            var href = aa.getAttribute("href") || aa.href || "";
            if (isLocalRef(href)) {
                e.preventDefault();
                e.stopPropagation();
                var p = localPath(href);
                openResource({ path: p, name: p }, e.clientX, e.clientY);
            }
            return;
        }
        // intercept <img> whose src is a local file path
        var im = tgt && tgt.closest ? tgt.closest("img[src]") : null;
        if (im) {
            var src = im.getAttribute("src") || im.src || "";
            if (isLocalRef(src)) {
                e.preventDefault();
                e.stopPropagation();
                var pp = localPath(src);
                openResource({ path: pp, name: pp }, e.clientX, e.clientY);
            }
        }
    }
    function handleCtx(e) {
        var a = e.target && e.target.closest ? e.target.closest("a.dsh-link") : null;
        if (!a) return;
        e.preventDefault();
        var res = { path: a.getAttribute("data-path") || "", url: a.getAttribute("data-url") || "", name: a.getAttribute("data-name") || "" };
        showMenu([
            { label: t("openDesktop"), action: function () { if (res.url) openWeb(res.url); else openViewer(res, res.kind || kindOf(res.name || res.path)); } },
            { label: t("openSystem"), action: function () { if (res.url) openSystemUrl(res.url); else openSystemPath(res.path); } },
            { label: t("copy"), action: function () { copyText(res.url || res.path); } },
        ], e.clientX, e.clientY);
    }
    function linkifyNode(node) {
        if (!node.nodeValue) return;
        LINK_RE.lastIndex = 0;
        if (!LINK_RE.test(node.nodeValue)) return;
        var parent = node.parentElement;
        if (!parent || !isLinkableParent(parent)) return;
        var text = node.nodeValue;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        LINK_RE.lastIndex = 0;
        while ((m = LINK_RE.exec(text)) !== null) {
            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            var token = m[0];
            token = token.replace(/[，。、；：,;:!?…"'”’)\]]+$/, "");
            if (!token) continue;
            var isUrl = /^https?:/i.test(token);
            var a = document.createElement("a");
            a.className = "dsh-link";
            a.textContent = token;
            if (isUrl) { a.setAttribute("data-url", token); a.href = token; }
            else {
                a.setAttribute("data-path", token);
                a.setAttribute("data-name", token.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || token);
                a.href = "#";
            }
            frag.appendChild(a);
            last = m.index + token.length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        if (frag.childNodes.length) parent.replaceChild(frag, node);
    }
    function walkTextNodes(root) {
        if (!root) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                return isLinkableParent(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            },
        });
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(linkifyNode);
    }
    function linkifyRoots() {
        var roots = [];
        var s = document.querySelectorAll('[data-slot="conversation.session"], [data-slot="conversation.session.header"]');
        for (var i = 0; i < s.length; i++) roots.push(s[i]);
        if (!roots.length) roots.push(document.body);
        return roots;
    }
    function startLinkify() {
        try {
            document.addEventListener("click", handleClick, true);
            document.addEventListener("contextmenu", handleCtx, true);
        } catch (e) { }
        var timer = null;
        try {
            var observer = new MutationObserver(function () {
                if (timer) return;
                timer = setTimeout(function () {
                    timer = null;
                    try { linkifyRoots().forEach(walkTextNodes); } catch (e) { }
                }, 400);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { }
        setTimeout(function () { try { linkifyRoots().forEach(walkTextNodes); } catch (e) { } }, 3000);
    }

    // ---- plugin apply -----------------------------------------------------
    function apply(ctx) {
        ctx.effect(function () {
            return ctx.locale.register(NS, dict);
        }, "desktop-extras: dictionaries");
        t = ctx.locale.bind(NS);

        var sfTimer = setInterval(function () {
            if (window.__DSH_SETTINGS__) {
                clearInterval(sfTimer);
                registerSettings();
            }
        }, 300);

        window.__DSH_OPEN__ = {
            openResource: openResource,
            openViewer: openViewer,
            openWeb: openWeb,
            openSystemPath: openSystemPath,
            openSystemUrl: openSystemUrl,
            kindOf: kindOf,
        };

        setTimeout(function () { startLinkify(); }, 2000);
    }

    apply(ctx);
}
		// ---- unified apply -------------------------------------------------

		function apply(ctx) {
			applySettings(ctx);
			applyPanels(ctx);
			applyRightPanel(ctx);
			applyDesktopExtras(ctx);
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});
