// dsh-desktop-settings: migrated to the dsh-settings-framework. Registers the
// localized "Desktop" Settings tab and its items through the framework
// (window.__DSH_SETTINGS__), including a custom skin center and a test-notify
// action. Skin selection persists via the framework backend (activeSkin) and
// is enforced on every boot.

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-settings-desktop",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;

		var API = "http://127.0.0.1:3980";
		var NS = "desktopSettings";

		var dict = {
			zh: {
				nav: "桌面客户端",
				closeLabel: "关闭窗口按钮",
				closeTray: "最小化到系统托盘（推荐）",
				closeExit: "直接退出（并停止服务）",
				closeHint: "选择托盘时，点窗口 ✕ 只隐藏到托盘，后台持续运行。",
				autoStartLabel: "开机自启动",
				autoStartHint: "登录 Windows 后自动启动 DshDesktop.exe 并拉起服务。",
				notifyLabel: "会话完成时发送 Windows 通知",
				notifyHint: "后台任务每完成一轮回答，通过系统通知提醒你。",
				trayHintLabel: "缩到托盘时显示提示",
				trayHintHint: "关闭后最小化/关闭窗口不再反复弹出托盘提示。",
				testNotify: "发送测试通知",
				skinTitle: "皮肤中心",
				skinIntro: "几选一：选择 DSH 默认外观或已安装皮肤，切换后界面自动刷新。",
				skinDefault: "DSH 默认（本体内置）",
				skinSwitch: "正在切换皮肤，界面将自动刷新…",
				skinCurrent: "当前",
				notifSent: "测试通知已发送（查看 Windows 通知中心）",
			},
			en: {
				nav: "Desktop",
				closeLabel: "Close button behavior",
				closeTray: "Minimize to system tray (recommended)",
				closeExit: "Exit directly (and stop the service)",
				closeHint: "With tray mode, clicking ✕ hides to tray and keeps running in the background.",
				autoStartLabel: "Launch at logon",
				autoStartHint: "Start DshDesktop.exe and the backend automatically after you log in.",
				notifyLabel: "Notify when a task completes",
				notifyHint: "Shows a Windows notification when a background task finishes a turn.",
				trayHintLabel: "Tray balloon on minimize/close",
				trayHintHint: "When off, minimizing/closing no longer shows a repeated tray balloon.",
				testNotify: "Send test notification",
				skinTitle: "Skin Center",
				skinIntro: "Pick one: choose the DSH default look or an installed skin; the UI refreshes automatically after switching.",
				skinDefault: "DSH Default (built-in)",
				skinSwitch: "Switching skin, the UI will refresh automatically…",
				skinCurrent: "Current",
				notifSent: "Test notification sent (see Windows Action Center)",
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

		function sendTestNotify() {
			fetchJson(API + "/api/notify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "DeepSeek Harness", message: t("testNotify") }),
			}).catch(function () { });
		}

		// ---- custom skin center (one-of-N) --------------------------------

		function SkinCenterView(props) {
			var sf = props.sf;
			var revState = useState(0);
			var rev = revState[0];
			var setRev = revState[1];
			var cfgState = useState(null);
			var cfg = cfgState[0];
			var setCfg = cfgState[1];
			var skinsState = useState([]);
			var skins = skinsState[0];
			var setSkins = skinsState[1];
			var noticeState = useState("");
			var notice = noticeState[0];
			var setNotice = noticeState[1];

			useEffect(function () {
				var off = null;
				try { off = sf.subscribe("activeSkin", function () { setRev(function (v) { return v + 1; }); }); } catch (e) { }
				fetchJson(API + "/api/config").then(setCfg).catch(function () { });
				fetchJson(API + "/api/skins").then(setSkins).catch(function () { setSkins([]); });
				return function () { if (off) { try { off(); } catch (e) { } } };
			}, []);

			var active = (cfg && cfg.activeSkin) || "";
			var items = [{ id: "default", builtin: true, name: t("skinDefault"), preview: null, package: "" }]
				.concat(skins.filter(function (s) { return !s.builtin; }));

			function selectSkin(item) {
				var id = item.builtin ? "" : item.id;
				sf.set("activeSkin", id).then(function () {
					setNotice(t("skinSwitch"));
					setTimeout(function () { try { window.location.reload(); } catch (e) { } }, 900);
				}).catch(function () { });
			}

			return h("div", {},
				h("h3", { style: { margin: "18px 0 6px" } }, t("skinTitle")),
				h("p", { style: { margin: "0 0 10px", opacity: ".7", fontSize: "13px" } }, t("skinIntro")),
				h("div", { style: { display: "flex", flexDirection: "column" } },
					items.map(function (item) {
						var selected = item.builtin ? (active === "" || active === "default") : (active === item.id);
						return h("label", {
							key: item.id + "|" + (item.package || ""),
							style: {
								display: "flex", alignItems: "center", gap: "12px",
								padding: "8px 0", borderBottom: "1px solid rgba(128,128,128,.25)", cursor: "pointer",
							},
						},
							h("input", { type: "radio", name: "dsh-skin", checked: selected, onChange: function () { selectSkin(item); }, style: { flex: "none" } }),
							item.preview ? h("img", { src: item.preview, style: { width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", flex: "none" } }) : null,
							h("div", { style: { flex: "1", minWidth: "0" } },
								h("div", {},
									item.builtin ? item.name : (item.name || item.nameEn || item.id),
									selected ? h("span", { style: { marginLeft: "8px", fontSize: "12px", opacity: ".75" } }, "✓ " + t("skinCurrent")) : null),
								h("div", { style: { fontSize: "12px", opacity: ".6", wordBreak: "break-all" } }, item.builtin ? t("skinIntro") : item.package)));
					})),
				notice ? h("div", { style: { marginTop: "12px", padding: "8px 10px", border: "1px solid rgba(128,128,128,.35)", borderRadius: "6px", fontSize: "13px" } }, notice) : null);
		}

		// ---- plugin apply -------------------------------------------------

		function apply(ctx) {
			ctxRef = ctx;
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "desktop-settings: dictionaries");
			t = ctx.locale.bind(NS);

			whenReady(function (sf) {
				sf.registerTab({ id: "desktop", label: function () { return t("nav"); }, order: 90 });

				sf.registerItem({ tabId: "desktop", key: "closeBehavior", type: "select", label: t("closeLabel"),
					options: [
						{ value: "tray", label: t("closeTray") },
						{ value: "exit", label: t("closeExit") },
					], defaultValue: "tray" });
				sf.registerItem({ tabId: "desktop", key: "autoStart", type: "toggle", label: t("autoStartLabel"), hint: t("autoStartHint"), defaultValue: false });
				sf.registerItem({ tabId: "desktop", key: "notifyOnComplete", type: "toggle", label: t("notifyLabel"), hint: t("notifyHint"), defaultValue: true });
				sf.registerItem({ tabId: "desktop", key: "trayHint", type: "toggle", label: t("trayHintLabel"), hint: t("trayHintHint"), defaultValue: false });
				sf.registerItem({ tabId: "desktop", key: "testNotify", type: "action", label: t("testNotify"), action: sendTestNotify });
				sf.registerItem({ tabId: "desktop", key: "skinCenter", type: "custom", render: function () { return h(SkinCenterView, { sf: sf }); } });
			});

			enforceActiveSkin();
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});