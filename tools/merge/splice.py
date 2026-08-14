# -*- coding: utf-8 -*-
import io, os

base = r'C:\Users\NH55\Documents\Codex\2026-08-14\bn\work\dsh-desktop\dsh-desktop-framework\lib'
client = os.path.join(base, 'client.js')
extras = os.path.join(base, 'part_extras.js')

with io.open(client, 'r', encoding='utf-8') as f:
    src = f.read()

def sub1(old, new, label, count=1):
    global src
    if old not in src:
        print('!! NOT FOUND:', label)
        return False
    src = src.replace(old, new, count)
    print('ok:', label)
    return True

# ---------- R1: themed/non-floating override stylesheet (appended after the base style) ----------
old_append = """			(document.head || document.documentElement).appendChild(style);
		}

		// ---- panel shells --------------------------------------------------"""
new_append = """			(document.head || document.documentElement).appendChild(style);
			var style2 = document.createElement("style");
			style2.textContent = [
				".dsh-panel-right{top:0!important;right:var(--dsh-metrics-details,0px)!important;bottom:0!important;left:auto!important;border:none!important;border-left:1px solid var(--dsw-alias-border-l2)!important;border-radius:0!important;background:var(--dsw-alias-bg-layer-2)!important;box-shadow:none!important;}",
				".dsh-panel-bottom{left:var(--dsh-metrics-sidebar,0px)!important;right:var(--dsh-metrics-right,0px)!important;bottom:0!important;top:auto!important;border:none!important;border-top:1px solid var(--dsw-alias-border-l2)!important;border-radius:0!important;background:var(--dsw-alias-bg-layer-2)!important;box-shadow:none!important;}",
				".dsh-panel-rail-right{top:0!important;right:var(--dsh-metrics-details,0px)!important;bottom:0!important;width:26px!important;padding:0!important;border:none!important;border-left:1px solid var(--dsw-alias-border-l2)!important;border-radius:0!important;background:var(--dsw-alias-bg-layer-2)!important;opacity:.9!important;writing-mode:vertical-rl;cursor:pointer;}",
				".dsh-panel-rail-right:hover{opacity:1;background:var(--dsw-alias-bg-layer-3);}",
				".dsh-panel-rail-bottom{left:var(--dsh-metrics-sidebar,0px)!important;right:var(--dsh-metrics-right,0px)!important;bottom:0!important;top:auto!important;height:26px!important;transform:none!important;padding:0!important;border:none!important;border-top:1px solid var(--dsw-alias-border-l2)!important;border-radius:0!important;background:var(--dsw-alias-bg-layer-2)!important;opacity:.9!important;cursor:pointer;}",
				".dsh-panel-rail-bottom:hover{opacity:1;background:var(--dsw-alias-bg-layer-3);}",
				".dsh-panel-header{background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);}",
				".dsh-panel-tab:hover{background:rgba(128,128,128,.15);}",
				".dsh-panel-tab.active{background:rgba(77,107,254,.18);border-color:rgba(77,107,254,.55);}",
				".dsh-panel-tab-close{font-size:11px;opacity:.6;border:none;background:transparent;color:inherit;cursor:pointer;padding:0 2px;border-radius:4px;line-height:1;}",
				".dsh-panel-tab-close:hover{opacity:1;background:rgba(128,128,128,.25);}",
				".dsh-link{color:var(--dsw-alias-brand-text, #4d6bfe);text-decoration:underline;cursor:pointer;word-break:break-all;}",
				".dsh-link:hover{opacity:.85;}",
				".dsh-open-menu{position:fixed;z-index:9999;min-width:180px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:6px;box-shadow:0 8px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;}",
				".dsh-open-menu-item{display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:transparent;color:inherit;font-size:13px;cursor:pointer;border-radius:6px;}",
				".dsh-open-menu-item:hover{background:rgba(128,128,128,.15);}",
				".dsh-viewer{height:100%;display:flex;flex-direction:column;min-height:0;}",
				".dsh-viewer-status{padding:24px;text-align:center;opacity:.7;font-size:13px;display:flex;flex-direction:column;gap:12px;align-items:center;}",
				".dsh-viewer-action{padding:4px 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l3);background:transparent;color:inherit;font-size:12px;cursor:pointer;}",
				".dsh-viewer-action:hover{background:rgba(128,128,128,.15);}",
				".dsh-viewer-pre{margin:0;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all;font-family:Consolas,'Courier New',monospace;overflow:auto;flex:1;min-height:0;}",
				".dsh-viewer-media{flex:1;min-height:0;position:relative;}",
				".dsh-viewer-video{width:100%;height:100%;object-fit:contain;background:#000;}",
				".dsh-viewer-frame{width:100%;height:100%;border:none;background:#fff;}",
				".dsh-viewer-toolbar{display:flex;gap:6px;padding-bottom:8px;align-items:center;}",
				".dsh-viewer-image-stage{flex:1;min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1);}",
				".dsh-viewer-image-img{transition:transform .15s ease;object-fit:contain;user-select:none;}",
				".dsh-viewer-model{height:100%;position:relative;background:var(--dsw-alias-bg-layer-1);}",
				".dsh-viewer-model-canvas{width:100%;height:100%;display:block;cursor:grab;}",
				".dsh-md{overflow:auto;}",
				".dsh-md-body{max-width:880px;margin:0 auto;padding:8px 4px;font-size:14px;line-height:1.6;color:inherit;}",
				".dsh-md-body h1,.dsh-md-body h2,.dsh-md-body h3,.dsh-md-body h4,.dsh-md-body h5,.dsh-md-body h6{border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:.3em;margin:1em 0 .6em;font-weight:600;line-height:1.3;}",
				".dsh-md-body pre{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:12px;overflow:auto;font-size:12.5px;line-height:1.5;font-family:Consolas,'Courier New',monospace;}",
				".dsh-md-body code{background:var(--dsw-alias-bg-mask-1);border-radius:4px;padding:1px 5px;font-size:12.5px;font-family:Consolas,'Courier New',monospace;}",
				".dsh-md-body pre code{background:transparent;padding:0;}",
				".dsh-md-body table{border-collapse:collapse;margin:1em 0;font-size:13px;}",
				".dsh-md-body th,.dsh-md-body td{border:1px solid var(--dsw-alias-border-l2);padding:6px 10px;}",
				".dsh-md-body th{background:var(--dsw-alias-bg-layer-1);font-weight:600;}",
				".dsh-md-body blockquote{margin:.6em 0;padding:.2em 1em;border-left:4px solid var(--dsw-alias-border-l3);color:inherit;opacity:.85;}",
				".dsh-md-body img{max-width:100%;border-radius:8px;}",
				".dsh-md-body a{color:var(--dsw-alias-brand-text, #4d6bfe);text-decoration:underline;}",
				".dsh-md-body hr{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:1em 0;}",
				".dsh-md-body p{margin:.5em 0;}",
				".dsh-md-body ul,.dsh-md-body ol{margin:.5em 0;padding-left:1.6em;}",
			].join("\\n");
			(document.head || document.documentElement).appendChild(style2);
		}

		// ---- panel shells --------------------------------------------------"""
sub1(old_append, new_append, 'R1 style2')# ---------- R2: layout metrics (CSS vars) ----------
old_metrics = """		// ---- persistence bootstrap ----------------------------------------"""
new_metrics = """		// ---- layout metrics (theme-aware, non-floating panels) --------------
		function updateMetrics() {
			try {
				var overlay = document.querySelector('[data-shell-overlay]');
				var frame = overlay && overlay.parentElement;
				if (!frame) return;
				var kids = frame.children;
				var sidebar = kids[0] ? kids[0].getBoundingClientRect().width : 0;
				var details = kids[2] ? kids[2].getBoundingClientRect().width : 0;
				var rightW = state.right.open ? state.right.width : 0;
				var doc = document.documentElement;
				doc.style.setProperty("--dsh-metrics-sidebar", sidebar + "px");
				doc.style.setProperty("--dsh-metrics-details", details + "px");
				doc.style.setProperty("--dsh-metrics-right", (rightW + details) + "px");
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

		// ---- persistence bootstrap ----------------------------------------"""
sub1(old_metrics, new_metrics, 'R2 metrics')

# hook updateMetrics into emit
old_emit = """		function emit() {
			subs.forEach(function (cb) { try { cb(); } catch (e) { } });
		}"""
new_emit = """		function emit() {
			updateMetrics();
			subs.forEach(function (cb) { try { cb(); } catch (e) { } });
		}"""
sub1(old_emit, new_emit, 'R2 emit hook')# ---------- R3: TabBar with close button ----------
old_tabbar = """		function TabBar(props) {
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
		}"""
new_tabbar = """		function TabBar(props) {
			var side = props.side;
			var st = props.st;
			return h("div", { className: "dsh-panel-tabbar" },
				st.tabs.map(function (tab) {
					var label = typeof tab.label === "function" ? tab.label() : tab.label;
					var closeBtn = tab.closable
						? h("button", { className: "dsh-panel-tab-close", title: "x", onClick: function (e) { e.stopPropagation(); removeTab(side, tab.id); } }, "x")
						: null;
					return h("button", {
						key: tab.id,
						className: "dsh-panel-tab" + (st.tab === tab.id ? " active" : ""),
						onClick: function () { setTab(side, tab.id); },
					}, label, closeBtn);
				}));
		}"""
sub1(old_tabbar, new_tabbar, 'R3 tabbar')

# ---------- R5a: addTab / removeTab after registerPanel ----------
old_after_reg = """		// ---- persistence bootstrap ----------------------------------------"""
new_after_reg = """		function addTab(side, opt) {
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

		// ---- persistence bootstrap ----------------------------------------"""
sub1(old_after_reg, new_after_reg, 'R5a addTab/removeTab', 2)

# ---------- R5b: extend __DSH_PANELS__ API + startMetrics ----------
old_api = """			window.__DSH_PANELS__ = {
				ready: ready,
				registerPanel: registerPanel,
				open: function (side) { setOpen(side, true); },
				close: function (side) { setOpen(side, false); },
				toggle: toggle,
				setTab: setTab,
				setSize: setSize,
				getState: getState,
				subscribe: subscribe,
			};"""
new_api = """			window.__DSH_PANELS__ = {
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
			startMetrics();"""
sub1(old_api, new_api, 'R5b API')# ---------- FilesTab: open through __DSH_OPEN__ ----------
old_click = """								onClick: function () {
									if (ent.type === "dir") loadDir(ent.path);
									else openFile(ent);
								},"""
new_click = """								onClick: function () {
									if (ent.type === "dir") loadDir(ent.path);
									else if (window.__DSH_OPEN__) window.__DSH_OPEN__.openResource({ path: ent.path, name: ent.name });
									else openFile(ent);
								},"""
sub1(old_click, new_click, 'FilesTab click')

# ---------- insert applyDesktopExtras + unified apply call ----------
with io.open(extras, 'r', encoding='utf-8') as f:
    extra_src = f.read()
# strip the internal exports.* lines (they would clobber the unified apply)
extra_lines = []
for ln in extra_src.split('\n'):
    s = ln.strip()
    if s.startswith('exports.apply') or s.startswith('exports.inject'):
        continue
    extra_lines.append(ln)
extra_clean = '\n'.join(extra_lines)

old_unified = """		// ---- unified apply -------------------------------------------------

		function apply(ctx) {
			applySettings(ctx);
			applyPanels(ctx);
			applyRightPanel(ctx);
		}"""
new_unified = """		// ---- desktop extras (viewers, open settings, linkify) ----------------
""" + extra_clean + """
		// ---- unified apply -------------------------------------------------

		function apply(ctx) {
			applySettings(ctx);
			applyPanels(ctx);
			applyRightPanel(ctx);
			applyDesktopExtras(ctx);
		}"""
sub1(old_unified, new_unified, 'extras insert')

with io.open(client, 'w', encoding='utf-8', newline='\n') as f:
    f.write(src)
print('client.js written, length', len(src))