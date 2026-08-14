# -*- coding: utf-8 -*-
import io, re
f = r'C:\Users\NH55\Documents\Codex\2026-08-14\bn\work\dsh-desktop\dsh-desktop-framework\lib\client.js'
t = io.open(f, 'r', encoding='utf-8').read()

def sub1(old, new, label, count=1):
    global t
    if old not in t:
        print('!! NOT FOUND:', label)
        return False
    t = t.replace(old, new, count)
    print('ok:', label)
    return True

# ---------- 1) replace the whole ensureStyle block with a single tokenized stylesheet ----------
new_style = '''			var style = document.createElement("style");
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
			].join("\\n");
			(document.head || document.documentElement).appendChild(style);
'''
pat = re.compile(r'var style = document\.createElement\("style"\);.*?appendChild\(style2\);', re.DOTALL)
if pat.search(t):
    t = pat.sub(lambda m: new_style, t, count=1)
    print('ok: ensureStyle rewritten')
else:
    print('!! NOT FOUND: ensureStyle pattern')

io.open(f, 'w', encoding='utf-8', newline='\n').write(t)
print('chunk A done')# ---------- 2) shells: remove collapse toggles, inline positioning, bottom no-tabs ----------
old_right = u'''			if (!rs.open) return null;
			return h("div", { className: "dsh-panel-right", style: { width: rs.width + "px" } },
				h("div", { className: "dsh-panel-resize-left", onMouseDown: startResize("right") }),
				h("div", { className: "dsh-panel-header" },
					h(TabBar, { side: "right", st: rs }),
					h("button", { className: "dsh-panel-toggle", title: t("collapse"), onClick: function () { toggle("right"); }, style: { display: "inline-flex", alignItems: "center", justifyContent: "center" } }, dshIcon("chevron-right", 14))),
				h("div", { className: "dsh-panel-body" }, active.render({ side: "right", tab: active.id, h: h, React: React })));'''
new_right = u'''			if (!rs.open) return null;
			return h("div", { className: "dsh-panel-right", style: { width: rs.width + "px", right: metrics.details + "px" } },
				h("div", { className: "dsh-panel-resize-left", onMouseDown: startResize("right") }),
				h("div", { className: "dsh-panel-header" },
					h(TabBar, { side: "right", st: rs })),
				h("div", { className: "dsh-panel-body" }, active.render({ side: "right", tab: active.id, h: h, React: React })));'''
sub1(old_right, new_right, 'right shell')

old_bottom = u'''			if (!bs.open) return null;
			return h("div", { className: "dsh-panel-bottom", style: { height: bs.height + "px" } },
				h("div", { className: "dsh-panel-resize-top", onMouseDown: startResize("bottom") }),
				h("div", { className: "dsh-panel-header" },
					h(TabBar, { side: "bottom", st: bs }),
					h("button", { className: "dsh-panel-toggle", title: t("collapse"), onClick: function () { toggle("bottom"); }, style: { display: "inline-flex", alignItems: "center", justifyContent: "center" } }, dshIcon("chevron-down", 14))),
				h("div", { className: "dsh-panel-body" }, active.render({ side: "bottom", tab: active.id, h: h, React: React })));'''
new_bottom = u'''			if (!bs.open) return null;
			var bl = metrics.sidebar;
			var br = (state.right.open ? state.right.width : 0) + metrics.details;
			return h("div", { className: "dsh-panel-bottom", style: { height: bs.height + "px", left: bl + "px", right: br + "px" } },
				h("div", { className: "dsh-panel-resize-top", onMouseDown: startResize("bottom") }),
				h("div", { className: "dsh-panel-body" }, active.render({ side: "bottom", tab: active.id, h: h, React: React })));'''
sub1(old_bottom, new_bottom, 'bottom shell')

io.open(f, 'w', encoding='utf-8', newline='\n').write(t)
print('chunk B done')# ---------- 3) global font-size px -> em (no hardcoded sizes) ----------
for px, em in [('"12px"', '"0.857em"'), ('"13px"', '"0.929em"'), ('"11px"', '"0.786em"'), ('"14px"', '"1em"'), ('"15px"', '"1.071em"'), ('"12.5px"', '"0.893em"')]:
    key = 'fontSize: ' + px
    n = t.count(key)
    if n:
        t = t.replace(key, 'fontSize: ' + em)
        print('fontSize', px, '->', em, 'x', n)

# ---------- 4) JS hardcoded colors -> tokens ----------
sub1('border: "1px solid rgba(128,128,128,.35)", background: "transparent", color: "inherit", fontSize: "0.857em"',
     'border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "inherit", fontSize: "0.857em"', 'input border', 2)
sub1('e.currentTarget.style.background = "rgba(128,128,128,.12)"', 'e.currentTarget.style.background = "var(--dsw-alias-button-floating-hover)"', 'file hover')
sub1('background: "rgba(0,0,0,.25)", borderRadius: "8px"', 'background: "var(--dsw-alias-bg-mask-1)", borderRadius: "8px"', 'terminal body bg')
sub1('"#7ee787"', '"var(--dsw-static-green-500)"', 'green')
sub1('"#ff7b72"', '"var(--dsw-static-red-500)"', 'red')
sub1('"#79c0ff"', '"var(--dsw-static-blue-500)"', 'blue')
sub1('"#e3b341"', '"var(--dsw-static-amber-500)"', 'amber')
sub1('"rgba(255,90,90,.55)"', '"var(--dsw-static-red-500)"', 'danger border')
sub1('"rgba(128,128,128,.4)"', '"var(--dsw-alias-border-l2)"', 'normal border')
sub1('active ? "rgba(77,107,254,.35)" : "rgba(128,128,128,.12)"', 'active ? "var(--dsw-alias-button-ghost-active-fill)" : "transparent"', 'toggle bg')
sub1('"rgba(77,107,254,.85)" : "rgba(128,128,128,.55)"', '"var(--dsw-alias-button-ghost-active-border)" : "var(--dsw-alias-border-l2)"', 'toggle border')
sub1("fontFamily: \"Consolas, 'Courier New', monospace\"", 'fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"', 'mono family a')
sub1('fontFamily: "Consolas, monospace"', 'fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"', 'mono family b')

# ---------- 5) hardcoded path fallback -> use exe cwd ----------
old_path = u'''			useEffect(function () {
				fetchJson(API + "/api/settings").then(function (m) {
					var wd = (m && m.serverWorkDir) || "";
					loadDir(wd || "C:\\\\");
				}).catch(function () { loadDir("C:\\\\"); });
			}, []);'''
new_path = u'''			useEffect(function () {
				fetchJson(API + "/api/settings").then(function (m) {
					var wd = (m && m.serverWorkDir) || "";
					if (wd) { loadDir(wd); return; }
					fetchJson(API + "/api/shell/cwd").then(function (c) {
						loadDir((c && c.cwd) || "");
					}).catch(function () { loadDir(""); });
				}).catch(function () { loadDir(""); });
			}, []);'''
sub1(old_path, new_path, 'path fallback')

io.open(f, 'w', encoding='utf-8', newline='\n').write(t)
print('chunk C done')