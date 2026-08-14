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
			cache = next || {};
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
				return h("input", { type: "checkbox", checked: value === "true" || value === "1", onChange: function (e) { onChange(e.target.checked); } });
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
						it.hint ? h("div", { style: { fontSize: "12px", opacity: ".75", padding: "0 0 4px" } }, it.hint) : null);
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

		function TabBar(props) {
			var side = props.side;
			var st = props.st;
			return h("div", { className: "dsh-panel-tabbar" },
				st.tabs.map(function (tab) {
					var label = typeof tab.label === "function" ? tab.label() : tab.label;
					return h("button", {
						key: tab.id,
						className: "dsh-panel-tab" + (st.tab === tab.id ? " active" : ""),
						onClick: function () { setTab(side, tab.id); },
					}, label);
				}));
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
					loadDir(wd || "C:\\");
				}).catch(function () { loadDir("C:\\"); });
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
						h("button", { onClick: function () { setPreview(null); }, style: { cursor: "pointer", background: "transparent", border: "none", color: "inherit", fontSize: "13px", padding: 0 } }, t("previewBack")),
						h("span", { style: { fontSize: "12px", opacity: ".7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, preview.name)),
					pd && pd.ok === false
						? h("div", { style: { padding: "16px", opacity: ".7", fontSize: "13px" } }, pd.error || t("loadFailed"))
						: pd && pd.kind === "image"
							? h("div", { style: { overflow: "auto", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" } },
								h("img", { src: pd.content, style: { maxWidth: "100%", maxHeight: "100%", borderRadius: "8px" } }))
							: h("pre", { style: { flex: 1, overflow: "auto", margin: 0, fontSize: "12px", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-all" } },
								(pd && pd.content) || t("previewTooLarge")));
			}

			var shown = q
				? entries.filter(function (e) { return e.name.toLowerCase().indexOf(q.toLowerCase()) >= 0; })
				: entries;

			return h("div", { style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } },
				h("div", { style: { display: "flex", gap: "6px", alignItems: "center", paddingBottom: "6px" } },
					h("button", { onClick: function () { loadDir(dir); }, title: t("refresh"), style: btnStyle() }, "↻"),
					h("button", { onClick: function () { var p = dir.replace(/[\\/]+$/, ""); var i = p.lastIndexOf("\\"); if (i > 0) loadDir(p.substring(0, i)); else loadDir(p.substring(0, 3)); }, title: t("up"), style: btnStyle() }, "↑"),
					h("input", { value: q, onChange: function (e) { setQ(e.target.value); }, placeholder: t("search"), style: { flex: 1, minWidth: 0, padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(128,128,128,.35)", background: "transparent", color: "inherit", fontSize: "12px" } })),
				h("div", { style: { fontSize: "11px", opacity: ".65", paddingBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, dir || "…"),
				err ? h("div", { style: { padding: "10px", opacity: ".75", fontSize: "12px" } }, err) : null,
				h("div", { style: { flex: 1, overflow: "auto", minHeight: 0 } },
					shown.length === 0
						? h("div", { style: { padding: "12px", opacity: ".5", fontSize: "13px" } }, t("emptyDir"))
						: shown.map(function (ent) {
							return h("div", {
								key: ent.path,
								style: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 6px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
								onMouseEnter: function (e) { e.currentTarget.style.background = "rgba(128,128,128,.12)"; },
								onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; },
								onClick: function () {
									if (ent.type === "dir") loadDir(ent.path);
									else openFile(ent);
								},
							},
								h("span", { style: { flex: "none", opacity: ".8" } }, ent.type === "dir" ? "📁" : "📄"),
								h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ent.name),
								ent.type === "file" ? h("span", { style: { flex: "none", fontSize: "11px", opacity: ".55" } }, fmtSize(ent.size)) : null);
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
					? h("div", { style: { padding: "10px", opacity: ".75", fontSize: "12px" } }, (st.error || t("loadFailed")) + (st.error && st.error.indexOf("not a git repository") >= 0 ? "" : ""))
					: changes.length === 0
						? h("div", { style: { padding: "14px", opacity: ".55", fontSize: "13px" } }, t("noChanges"))
						: h("div", { style: { flex: 1, overflow: "auto", minHeight: 0 } },
							changes.map(function (ch) {
								var pathLabel = ch.to ? ch.path + " → " + ch.to : ch.path;
								return h("label", {
									key: ch.path + "|" + ch.to,
									style: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 6px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
								},
									h("input", { type: "checkbox", checked: !!sel[ch.path], onChange: function () { toggleSel(ch.path); } }),
									h("span", { style: { flex: "none", fontSize: "11px", fontWeight: 600, color: statusColor(ch.x, ch.y) } }, statusText(ch.x, ch.y)),
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
					h("span", { style: { fontSize: "11px", opacity: ".7", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, cwd || "…"),
					h("button", { onClick: function () { setLines([]); }, style: btnStyle() }, t("termClear"))),
				h("div", { ref: bodyRef, style: { flex: 1, overflow: "auto", minHeight: 0, fontFamily: "Consolas, 'Courier New', monospace", fontSize: "12px", lineHeight: "1.55", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "rgba(0,0,0,.25)", borderRadius: "8px", padding: "8px 10px" } },
					lines.length === 0
						? h("div", { style: { opacity: ".5" } }, t("termEmpty"))
						: lines.map(function (ln, i) {
							var color = ln.kind === "in" ? "#7ee787" : ln.kind === "err" ? "#ff7b72" : ln.kind === "cwd" ? "#79c0ff" : "inherit";
							return h("div", { key: i, style: { color: color } }, ln.text);
						})),
				h("div", { style: { display: "flex", gap: "6px", paddingTop: "8px" } },
					h("span", { style: { fontSize: "13px", opacity: ".85", fontFamily: "Consolas, monospace" } }, ">"),
					h("input", {
						value: input,
						onChange: function (e) { setInput(e.target.value); },
						onKeyDown: function (e) { if (e.key === "Enter") run(input); },
						placeholder: t("termPlaceholder"),
						disabled: busy,
						style: { flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: "6px", border: "1px solid rgba(128,128,128,.35)", background: "transparent", color: "inherit", fontSize: "12px", fontFamily: "Consolas, monospace" },
					}),
					h("button", { onClick: function () { run(input); }, disabled: busy, style: btnStyle() }, busy ? t("termRunning") : t("termRun"))));
		}

		// ---- shared bits ----------------------------------------------------

		function btnStyle(danger) {
			return {
				padding: "4px 10px", fontSize: "12px", borderRadius: "6px", cursor: "pointer",
				background: "transparent", border: "1px solid " + (danger ? "rgba(255,90,90,.55)" : "rgba(128,128,128,.4)"),
				color: danger ? "#ff7b72" : "inherit",
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
			if (key === "??") return "#79c0ff";
			if (key.indexOf("U") >= 0) return "#ff7b72";
			if (key.charAt(0) === "A" || key.charAt(0) === "?") return "#7ee787";
			return "#e3b341";
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
				}, st.right.open ? "◧" : "◨"),
				h("button", {
					title: t("toggleBottom"),
					onClick: function () { window.__DSH_PANELS__.toggle("bottom"); },
					style: toggleBtnStyle(st.bottom.open),
				}, "▤"));
		}

		function toggleBtnStyle(active) {
			return {
				width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer", fontSize: "16px",
				lineHeight: "1", display: "inline-flex", alignItems: "center", justifyContent: "center",
				background: active ? "rgba(77,107,254,.35)" : "rgba(128,128,128,.12)",
				border: "1px solid " + (active ? "rgba(77,107,254,.85)" : "rgba(128,128,128,.55)"),
				color: "inherit",
			};
		}

		// ---- plugin apply ---------------------------------------------------

		function apply(ctx) {
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "right-panel: dictionaries");
			t = ctx.locale.bind(NS);

			whenPanels(function (P) {
				P.registerPanel({ side: "right", id: "files", label: function () { return t("files"); }, order: 10, render: function () { return h(FilesTab); } });
				P.registerPanel({ side: "right", id: "changes", label: function () { return t("changes"); }, order: 20, render: function () { return h(ChangesTab); } });
				P.registerPanel({ side: "bottom", id: "terminal", label: function () { return t("terminal"); }, order: 10, render: function () { return h(TerminalTab); } });
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

		// ---- unified apply -------------------------------------------------

		function apply(ctx) {
			applySettings(ctx);
			applyPanels(ctx);
			applyRightPanel(ctx);
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});
