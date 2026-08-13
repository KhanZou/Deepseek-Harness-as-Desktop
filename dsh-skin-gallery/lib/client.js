// dsh-skin-gallery: standalone, card-based skin center for DSH Web UI.
// Renders one card per skin (name top-left, large preview in the middle,
// highlighted selection, scrollable grid) in its own Settings tab, separate
// from the Desktop options tab. Uses the dsh-settings-framework backend
// (activeSkin) for persistence and refreshes the UI after switching.

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-skin-gallery",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;

		var API = "http://127.0.0.1:3980";
		var NS = "skinGallery";

		var dict = {
			zh: {
				nav: "皮肤中心",
				intro: "几选一：选择 DSH 默认外观或已安装皮肤，切换后界面自动刷新。",
				skinDefault: "DSH 默认",
				skinDefaultDesc: "DeepSeek Harness 本体内置默认外观",
				apply: "应用",
				applying: "正在切换皮肤，界面将自动刷新…",
				current: "当前",
				builtIn: "内置",
				author: "作者",
				noPreview: "（本体内置外观，无预览图）",
				failed: "皮肤加载失败，请确认桌面客户端（DshDesktop.exe）正在运行。",
				refresh: "刷新列表",
			},
			en: {
				nav: "Skin Center",
				intro: "Pick one: choose the DSH default look or an installed skin; the UI refreshes automatically after switching.",
				skinDefault: "DSH Default",
				skinDefaultDesc: "DeepSeek Harness built-in default look",
				apply: "Apply",
				applying: "Switching skin, the UI will refresh automatically…",
				current: "Current",
				builtIn: "Built-in",
				author: "Author",
				noPreview: "(Built-in look, no preview)",
				failed: "Failed to load skins. Make sure the desktop client (DshDesktop.exe) is running.",
				refresh: "Refresh",
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

		// Inject a small stylesheet once: card grid, selected highlight,
		// and a slim paired scrollbar.
		var injectedStyle = false;
		function ensureStyle() {
			if (injectedStyle || typeof document === "undefined") return;
			injectedStyle = true;
			var style = document.createElement("style");
			style.textContent = [
				".dsh-skin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;max-height:66vh;overflow-y:auto;padding:4px 10px 12px 2px;box-sizing:border-box;}",
				".dsh-skin-card{position:relative;border:2px solid rgba(128,128,128,.28);border-radius:12px;overflow:hidden;background:rgba(128,128,128,.06);cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease,transform .1s ease;display:flex;flex-direction:column;}",
				".dsh-skin-card:hover{transform:translateY(-1px);}",
				".dsh-skin-card.selected{border-color:#4d6bfe;box-shadow:0 0 0 3px rgba(77,107,254,.28);}",
				".dsh-skin-card .name{position:absolute;top:10px;left:10px;z-index:2;margin:0;padding:4px 12px;background:rgba(10,14,32,.72);color:#fff;border-radius:999px;font-size:13px;font-weight:600;line-height:1.5;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
				".dsh-skin-card .badge{position:absolute;top:10px;right:10px;z-index:2;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;}",
				".dsh-skin-card .badge.on{background:#4d6bfe;color:#fff;}",
				".dsh-skin-card .badge.off{background:rgba(10,14,32,.55);color:#fff;}",
				".dsh-skin-card .preview{width:100%;height:170px;object-fit:cover;display:block;background:linear-gradient(135deg,#0e1733 0%,#1b2a56 45%,#0e1733 100%);}",
				".dsh-skin-card .preview-holder{width:100%;height:170px;display:flex;align-items:center;justify-content:center;font-size:44px;color:rgba(255,255,255,.85);background:linear-gradient(135deg,#0e1733 0%,#1b2a56 45%,#0e1733 100%);}",
				".dsh-skin-card .meta{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px;flex:1;}",
				".dsh-skin-card .author{font-size:12px;opacity:.6;margin:0;}",
				".dsh-skin-card .desc{font-size:12px;opacity:.78;margin:0;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}",
				".dsh-skin-card .apply-row{margin-top:auto;padding-top:8px;display:flex;justify-content:flex-end;}",
				".dsh-skin-card .apply-btn{font-size:13px;padding:5px 14px;border-radius:8px;border:1px solid rgba(77,107,254,.7);background:transparent;color:inherit;cursor:pointer;}",
				".dsh-skin-card .apply-btn:hover{background:rgba(77,107,254,.18);}",
				".dsh-skin-card.selected .apply-btn{background:#4d6bfe;color:#fff;border-color:#4d6bfe;}",
				".dsh-skin-grid::-webkit-scrollbar{width:10px;}",
				".dsh-skin-grid::-webkit-scrollbar-track{background:rgba(128,128,128,.12);border-radius:6px;}",
				".dsh-skin-grid::-webkit-scrollbar-thumb{background:rgba(128,128,128,.42);border-radius:6px;}",
				".dsh-skin-grid::-webkit-scrollbar-thumb:hover{background:rgba(128,128,128,.6);}",
			].join("\n");
			(document.head || document.documentElement).appendChild(style);
		}

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
			var pendingState = useState("");
			var pending = pendingState[0];
			var setPending = pendingState[1];

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

			if (skins === null) {
				return h("div", { style: { padding: "18px 0", opacity: ".8" } }, t("failed"),
					h("div", { style: { marginTop: "10px" } },
						h("button", { onClick: load, style: { padding: "6px 14px", cursor: "pointer" } }, t("refresh"))));
			}
			if (skins === undefined || !skins.length) {
				return h("div", { style: { padding: "18px 0", opacity: ".8" } }, t("failed"),
					h("div", { style: { marginTop: "10px" } },
						h("button", { onClick: load, style: { padding: "6px 14px", cursor: "pointer" } }, t("refresh"))));
			}

			var active = (cfg && cfg.activeSkin) || "";
			var items = [{ id: "default", builtin: true, name: t("skinDefault"), nameEn: t("skinDefault"), description: t("skinDefaultDesc"), author: "DeepSeek", preview: "" }]
				.concat(skins.filter(function (s) { return !s.builtin; }));

			function selectSkin(item) {
				var id = item.builtin ? "" : item.id;
				if (pending) return;
				setPending(id);
				setNotice("");
				sf.set("activeSkin", id).then(function () {
					setNotice(t("applying"));
					setTimeout(function () { try { window.location.reload(); } catch (e) { } }, 900);
				}).catch(function () {
					setPending("");
				});
			}

			return h("div", { style: { maxWidth: "860px" } },
				h("p", { style: { margin: "0 0 14px", opacity: ".7", fontSize: "13px" } }, t("intro")),
				h("div", { className: "dsh-skin-grid" },
					items.map(function (item) {
						var selected = item.builtin ? (active === "" || active === "default") : (active === item.id);
						var isPending = pending === item.id || (item.builtin && pending === "");
						var label = item.name || item.nameEn || item.id;
						var author = item.author ? t("author") + ": " + item.author : "";
						return h("div", {
							key: item.id + "|" + (item.package || ""),
							className: "dsh-skin-card" + (selected ? " selected" : ""),
							onClick: function () { selectSkin(item); },
						},
							h("h4", { className: "name", title: label }, label),
							h("span", { className: "badge " + (selected ? "on" : "off") },
								selected ? t("current") : (item.builtin ? t("builtIn") : "")),
							item.preview
								? h("img", { className: "preview", src: item.preview, alt: label, draggable: false })
								: h("div", { className: "preview-holder" }, "\U0001f40b"),
							h("div", { className: "meta" },
								author ? h("p", { className: "author" }, author) : null,
								h("p", { className: "desc" }, item.description || (item.builtin ? t("noPreview") : "")),
								h("div", { className: "apply-row" },
									h("button", {
										className: "apply-btn",
										onClick: function (e) { e.stopPropagation(); selectSkin(item); },
										disabled: !!pending,
									}, isPending ? t("applying") : t("apply")))));
					})),
				notice ? h("div", { style: { marginTop: "14px", padding: "8px 12px", border: "1px solid rgba(77,107,254,.5)", borderRadius: "8px", fontSize: "13px" } }, notice) : null);
		}

		function apply(ctx) {
			ctxRef = ctx;
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "skin-gallery: dictionaries");
			t = ctx.locale.bind(NS);

			whenReady(function (sf) {
				sf.registerTab({ id: "skinGallery", label: function () { return t("nav"); }, order: 10 });
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