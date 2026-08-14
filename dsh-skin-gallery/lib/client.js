// dsh-skin-gallery: modern, card-based Skin Center for DSH Web UI.
// Inspired by how VS Code / Obsidian / Windows Terminal pick themes: a card
// grid where each card carries a mini app-window mockup that is *painted with
// the actual theme tokens* (never hardcoded colors), the skin name + author +
// description, a current-skin checkmark, and a one-click apply that persists
// activeSkin and reloads. Sits in its own Settings tab, grouped after the
// native settings tabs (order 1030).

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-skin-gallery",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;

		var API = (typeof window !== "undefined" && window.__DSH_DESKTOP_API__) || "http://127.0.0.1:3980";
		var NS = "skinGallery";

		var dict = {
			zh: {
				nav: "皮肤中心",
				intro: "选一个外观：卡片里的迷你窗口按实际主题颜色渲染，点击卡片即可应用并自动刷新界面。",
				all: "全部",
				builtin: "内置",
				skins: "皮肤",
				skinDefault: "DSH 默认",
				skinDefaultDesc: "DeepSeek Harness 本体内置默认外观",
				apply: "应用",
				applying: "正在应用…",
				currentBadge: "使用中",
				author: "作者",
				noPreview: "（本体内置外观）",
				failed: "皮肤加载失败，请确认桌面客户端（DshDesktop.exe）正在运行。",
				refresh: "刷新列表",
				emptyFilter: "没有符合条件的皮肤。",
				count: "个外观",
			},
			en: {
				nav: "Skin Center",
				intro: "Pick a look: the mini window on each card is painted with real theme colors. Click a card to apply it; the UI refreshes automatically.",
				all: "All",
				builtin: "Built-in",
				skins: "Skins",
				skinDefault: "DSH Default",
				skinDefaultDesc: "DeepSeek Harness built-in default look",
				apply: "Apply",
				applying: "Applying…",
				currentBadge: "In use",
				author: "Author",
				noPreview: "(Built-in look)",
				failed: "Failed to load skins. Make sure the desktop client (DshDesktop.exe) is running.",
				refresh: "Refresh",
				emptyFilter: "No skins match this filter.",
				count: "looks",
			},
		};

		var t = null;
		var ctxRef = null;

		function fetchJson(url, options) {
			return fetch(url, options).then(function (r) { return r.json(); });
		}

		function whenReady(cb, tries) {
			tries = tries || 0;
			if (window.__DSH_SETTINGS__) { cb(window.__DSH_SETTINGS__); return; }
			if (tries > 200) return;
			setTimeout(function () { whenReady(cb, tries + 1); }, 200);
		}

		// Keep only the persisted active skin mounted after boot.
		function enforceActiveSkin() {
			setTimeout(function () {
				fetchJson(API + "/api/config").then(function (cfg) {
					var active = (cfg && cfg.activeSkin) || "";
					fetchJson(API + "/api/skins").then(function (skins) {
						for (var i = 0; i < skins.length; i++) {
							var s = skins[i];
							if (s.builtin || !s.package) continue;
							var keep = active !== "" && active === s.id;
							if (!keep) disposeEntry(s.package);
						}
					}).catch(function () { });
				}).catch(function () { });
			}, 800);
		}

		function disposeEntry(pkg) {
			try {
				var entries = ctxRef.loader.entries();
				for (var i = 0; i < entries.length; i++) {
					if (entries[i].options.name === pkg && entries[i].fiber) {
						entries[i].fiber.dispose();
						return true;
					}
				}
			} catch (e) { }
			return false;
		}

		// ---- theme tokens (colors always follow the host theme) ------------

		function token(name, fallback) {
			try {
				var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
				if (v) return v;
			} catch (e) { }
			return fallback || "";
		}

		function mockColors(accent) {
			var bodyBg = "";
			try { bodyBg = getComputedStyle(document.body).backgroundColor; } catch (e) { }
			var bg1 = token("--dsw-alias-bg-layer-1", bodyBg) || "#ffffff";
			return {
				bg1: bg1,
				bg2: token("--dsw-alias-bg-layer-2", bg1) || bg1,
				sidebar: token("--dsw-specific-sidebar-fill", bg1) || bg1,
				bubble: token("--dsw-specific-bubble", "rgba(128,128,128,.14)"),
				border: token("--dsw-alias-border-l2", token("--dsw-alias-border-l3", "rgba(128,128,128,.28)")),
				textSoft: token("--dsw-alias-label-secondary", "currentColor"),
				brand: accent || token("--dsw-alias-button-info-fill", token("--dsw-static-deepseek-500", "rgba(77,107,254,1)")),
				success: token("--dsw-alias-state-success-primary", "rgba(34,197,94,1)"),
			};
		}

		function mix(c, pct) {
			// Build a color-mix() string from a resolved color value; used for
			// translucent overlays that always follow the theme. No hardcoded palette.
			var v = String(c || "").trim();
			if (!v) return "transparent";
			if (/^var\(/.test(v)) return v;
			return "color-mix(in srgb, " + v + " " + pct + ", transparent)";
		}

		// Mini app-window mockup painted with the live theme tokens.
		function SkinMock(props) {
			var c = mockColors(props.accent);
			var frame = {
				position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
				display: "flex", flexDirection: "column",
				background: c.bg1, color: "inherit", overflow: "hidden",
			};
			var titlebar = {
				flex: "none", height: 22, display: "flex", alignItems: "center", gap: 5, padding: "0 10px",
				background: c.bg2, borderBottom: "1px solid " + c.border,
			};
			var dot = { width: 7, height: 7, borderRadius: "50%", background: c.textSoft, opacity: .55 };
			var body = { flex: 1, display: "flex", minHeight: 0 };
			var sidebar = {
				flex: "none", width: "26%", display: "flex", flexDirection: "column", gap: 6, padding: "8px 6px",
				background: c.sidebar, borderRight: "1px solid " + c.border, boxSizing: "border-box",
			};
			var navItem = { height: 7, borderRadius: 4, background: mix(c.brand, "14%") };
			var navItemActive = { height: 7, borderRadius: 4, background: c.brand };
			var main = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };
			var header = {
				flex: "none", height: 16, display: "flex", alignItems: "center", gap: 5, padding: "0 8px",
				background: c.bg2, borderBottom: "1px solid " + c.border,
			};
			var headDot = { width: 7, height: 7, borderRadius: "50%", background: c.brand };
			var headLine = { height: 5, width: "34%", borderRadius: 3, background: c.textSoft, opacity: .5 };
			var chat = { flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "8px 8px 6px", minHeight: 0 };
			var bubbleL = { width: "58%", height: 10, borderRadius: 5, background: c.bubble };
			var bubbleL2 = { width: "42%", height: 10, borderRadius: 5, background: c.bubble };
			var bubbleR = { width: "34%", height: 10, borderRadius: 5, background: mix(c.brand, "16%"), alignSelf: "flex-end" };
			var input = {
				flex: "none", height: 16, display: "flex", alignItems: "center", gap: 5, padding: "0 8px",
				borderTop: "1px solid " + c.border, background: c.bg1,
			};
			var inputBox = { flex: 1, height: 8, borderRadius: 4, background: c.bg2, border: "1px solid " + c.border };
			var sendBtn = { width: 20, height: 12, borderRadius: 4, background: c.brand };
			return h("div", { style: frame },
				h("div", { style: titlebar }, h("i", { style: dot }), h("i", { style: dot }), h("i", { style: dot })),
				h("div", { style: body },
					h("div", { style: sidebar },
						h("i", { style: navItemActive }), h("i", { style: navItem }), h("i", { style: navItem }), h("i", { style: navItem })),
					h("div", { style: main },
						h("div", { style: header }, h("i", { style: headDot }), h("i", { style: headLine })),
						h("div", { style: chat }, h("i", { style: bubbleL }), h("i", { style: bubbleL2 }), h("i", { style: bubbleR })),
						h("div", { style: input }, h("i", { style: inputBox }), h("i", { style: sendBtn })))));
		}

		// ---- styles --------------------------------------------------------

		var injectedStyle = false;
		function ensureStyle() {
			if (injectedStyle || typeof document === "undefined") return;
			injectedStyle = true;
			var style = document.createElement("style");
			style.textContent = [
				".dsh-skin-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 6px;}",
				".dsh-skin-intro{margin:0 0 12px;opacity:.72;font-size:13px;line-height:1.6;max-width:760px;}",
				".dsh-skin-refresh{flex:none;padding:6px 14px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;font-size:12px;cursor:pointer;}",
				".dsh-skin-refresh:hover{background:var(--dsw-alias-bg-layer-2);}",
				".dsh-skin-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 14px;}",
				".dsh-skin-chip{padding:5px 15px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;font-size:13px;cursor:pointer;opacity:.78;}",
				".dsh-skin-chip:hover{opacity:1;}",
				".dsh-skin-chip.active{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-button-info-fill);opacity:1;background:color-mix(in srgb, var(--dsw-alias-button-info-fill) 12%, transparent);}",
				".dsh-skin-count{font-size:12px;opacity:.55;margin-left:2px;}",
				".dsh-skin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;max-height:64vh;overflow-y:auto;padding:4px 10px 14px 2px;box-sizing:border-box;}",
				".dsh-skin-card{position:relative;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);cursor:pointer;transition:transform .12s ease,box-shadow .15s ease,border-color .15s ease;display:flex;flex-direction:column;}",
				".dsh-skin-card:hover{transform:translateY(-3px);border-color:var(--dsw-alias-border-l3);box-shadow:0 8px 20px color-mix(in srgb, currentColor 12%, transparent);}",
				".dsh-skin-card.selected{border-color:var(--dsw-alias-button-info-fill);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-button-info-fill) 22%, transparent);}",
				".dsh-skin-card.pending{opacity:.62;pointer-events:none;}",
				".dsh-skin-thumb{position:relative;height:150px;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);}",
				".dsh-skin-preview{width:100%;height:100%;object-fit:cover;display:block;}",
				".dsh-skin-current-pill{position:absolute;top:10px;right:10px;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent);}",
				".dsh-skin-body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1;}",
				".dsh-skin-title-row{display:flex;align-items:center;gap:8px;justify-content:space-between;}",
				".dsh-skin-title{margin:0;font-size:15px;font-weight:600;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
				".dsh-skin-kind{flex:none;font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);opacity:.72;}",
				".dsh-skin-author{margin:0;font-size:12px;opacity:.58;}",
				".dsh-skin-desc{margin:0;font-size:12px;opacity:.76;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}",
				".dsh-skin-actions{margin-top:auto;padding-top:9px;display:flex;align-items:center;min-height:32px;}",
				".dsh-skin-apply{padding:6px 18px;border-radius:9px;border:1px solid var(--dsw-alias-button-info-fill);background:transparent;color:var(--dsw-alias-button-info-fill);font-size:13px;font-weight:600;cursor:pointer;}",
				".dsh-skin-apply:hover{background:color-mix(in srgb, var(--dsw-alias-button-info-fill) 14%, transparent);}",
				".dsh-skin-apply:disabled{opacity:.55;cursor:default;}",
				".dsh-skin-inuse{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;color:var(--dsw-alias-state-success-primary);}",
				".dsh-skin-notice{margin:14px 0 0;padding:9px 13px;border:1px solid color-mix(in srgb, var(--dsw-alias-button-info-fill) 45%, transparent);border-radius:9px;font-size:13px;}",
				".dsh-skin-failed{padding:18px 0;opacity:.8;}",
				".dsh-skin-grid::-webkit-scrollbar{width:10px;}",
				".dsh-skin-grid::-webkit-scrollbar-track{background:transparent;}",
				".dsh-skin-grid::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-hover-l2, rgba(128,128,128,.35));border-radius:6px;}",
				".dsh-skin-grid::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2);}",
			].join("\n");
			(document.head || document.documentElement).appendChild(style);
		}

		// ---- view ----------------------------------------------------------

		function SkinGalleryView(props) {
			var sf = props.sf;
			var cfgState = useState(null);
			var cfg = cfgState[0];
			var setCfg = cfgState[1];
			var skinsState = useState(null);
			var skins = skinsState[0];
			var setSkins = skinsState[1];
			var noticeState = useState("");
			var notice = noticeState[0];
			var setNotice = noticeState[1];
			var pendingState = useState(null);
			var pending = pendingState[0];
			var setPending = pendingState[1];
			var filterState = useState("all");
			var filter = filterState[0];
			var setFilter = filterState[1];

			function load() {
				fetchJson(API + "/api/config").then(setCfg).catch(function () { });
				fetchJson(API + "/api/skins").then(setSkins).catch(function () { setSkins(null); });
			}

			useEffect(function () {
				ensureStyle();
				load();
				var off = null;
				try { off = sf.subscribe("activeSkin", function () { load(); }); } catch (e) { }
				return function () { if (off) { try { off(); } catch (e) { } } };
			}, []);

			if (skins === null || skins === undefined || !skins.length) {
				return h("div", { className: "dsh-skin-failed" }, t("failed"),
					h("div", { style: { marginTop: "12px" } },
						h("button", { className: "dsh-skin-refresh", onClick: load }, t("refresh"))));
			}

			var active = (cfg && cfg.activeSkin) || "";
			var items = [{ id: "default", builtin: true, name: t("skinDefault"), nameEn: t("skinDefault"), description: t("skinDefaultDesc"), author: "DeepSeek", preview: "" }]
				.concat(skins.filter(function (s) { return !s.builtin; }));
			var visible = items.filter(function (item) {
				if (filter === "builtin") return item.builtin;
				if (filter === "skins") return !item.builtin;
				return true;
			});

			function selectSkin(item) {
				var id = item.builtin ? "" : item.id;
				if (pending !== null) return;
				setPending(id);
				setNotice("");
				sf.set("activeSkin", id).then(function () {
					setNotice(t("applying"));
					setTimeout(function () { try { window.location.reload(); } catch (e) { } }, 900);
				}).catch(function () {
					setPending(null);
				});
			}

			var filters = [
				{ id: "all", label: t("all") },
				{ id: "builtin", label: t("builtin") },
				{ id: "skins", label: t("skins") },
			];

			return h("div", { style: { maxWidth: "980px" } },
				h("div", { className: "dsh-skin-header" },
					h("p", { className: "dsh-skin-intro" }, t("intro")),
					h("button", { className: "dsh-skin-refresh", onClick: load }, t("refresh"))),
				h("div", { className: "dsh-skin-toolbar" },
					filters.map(function (f) {
						return h("button", {
							key: f.id,
							className: "dsh-skin-chip" + (filter === f.id ? " active" : ""),
							onClick: function () { setFilter(f.id); },
						}, f.label);
					}),
					h("span", { className: "dsh-skin-count" }, visible.length + " " + t("count"))),
				visible.length
					? h("div", { className: "dsh-skin-grid" },
						visible.map(function (item) {
							var selected = item.builtin ? (active === "" || active === "default") : (active === item.id);
							var isPending = pending === item.id || (item.builtin && pending === "");
							var label = item.name || item.nameEn || item.id;
							var author = item.author ? t("author") + " · " + item.author : "";
							return h("div", {
								key: item.id + "|" + (item.package || ""),
								className: "dsh-skin-card" + (selected ? " selected" : "") + (isPending ? " pending" : ""),
								role: "button",
								tabIndex: 0,
								"aria-pressed": selected ? "true" : "false",
								onClick: function () { selectSkin(item); },
								onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSkin(item); } },
								title: label,
							},
								h("div", { className: "dsh-skin-thumb" },
									item.preview
										? h("img", { className: "dsh-skin-preview", src: item.preview, alt: label, draggable: false })
										: h(SkinMock, { accent: item.accent || "" }),
									selected ? h("span", { className: "dsh-skin-current-pill" }, "✓ " + t("currentBadge")) : null),
								h("div", { className: "dsh-skin-body" },
									h("div", { className: "dsh-skin-title-row" },
										h("h4", { className: "dsh-skin-title" }, label),
										h("span", { className: "dsh-skin-kind" }, item.builtin ? t("builtin") : t("skins"))),
									author ? h("p", { className: "dsh-skin-author" }, author) : null,
									h("p", { className: "dsh-skin-desc" }, item.description || (item.builtin ? t("noPreview") : "")),
									h("div", { className: "dsh-skin-actions" },
										selected
											? h("span", { className: "dsh-skin-inuse" }, "✓ " + t("currentBadge"))
											: h("button", {
												className: "dsh-skin-apply",
												disabled: pending !== null,
												onClick: function (e) { e.stopPropagation(); selectSkin(item); },
											}, isPending ? t("applying") : t("apply")))));
						}))
					: h("div", { className: "dsh-skin-failed" }, t("emptyFilter")),
				notice ? h("div", { className: "dsh-skin-notice" }, notice) : null);
		}

		function apply(ctx) {
			ctxRef = ctx;
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "skin-gallery: dictionaries");
			t = ctx.locale.bind(NS);

			whenReady(function (sf) {
				sf.registerTab({ id: "skinGallery", label: function () { return t("nav"); }, order: 1030 });
				sf.registerItem({
					tabId: "skinGallery",
					key: "skinGallery",
					type: "custom",
					render: function (api) { return h(SkinGalleryView, { sf: sf }); },
				});
			});

			enforceActiveSkin();
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});
