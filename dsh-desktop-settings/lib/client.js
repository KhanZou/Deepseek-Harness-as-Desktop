// dsh-desktop-settings: browser half. Registers a localized "Desktop" section
// in the DSH settings panel. Talks to the local DshDesktop.exe config API
// (127.0.0.1:3980). Provides a one-of-N skin picker (DSH default + installed
// skins); the selection is persisted (activeSkin) and enforced on every boot.
// Only requires platform seed modules.

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
				intro: "选项通过本地 DshDesktop.exe 生效（127.0.0.1:3980）。",
				closeLabel: "关闭窗口按钮",
				closeTray: "最小化到系统托盘（推荐）",
				closeExit: "直接退出（并停止服务）",
				closeHint: "选择托盘时，点窗口 ✕ 只隐藏到托盘，后台持续运行。",
				autoStartLabel: "开机自启动",
				autoStartHint: "登录 Windows 后自动启动 DshDesktop.exe 并拉起服务。",
				notifyLabel: "会话完成时发送 Windows 通知",
				notifyHint: "后台任务每完成一轮回答，通过系统通知提醒你。",
				testNotify: "发送测试通知",
				skinTitle: "皮肤中心",
				skinIntro: "几选一：选择 DSH 默认外观或已安装皮肤，切换后界面自动刷新。",
				skinDefault: "DSH 默认（本体内置）",
				skinNone: "未检测到其他皮肤。",
				skinSwitch: "正在切换皮肤，界面将自动刷新…",
				skinCurrent: "当前",
				notAvail: "桌面客户端设置不可用",
				notAvailHint: "这些选项由桌面客户端 DshDesktop.exe 提供，请通过 DshDesktop.exe 打开 DeepSeek Harness 后使用。",
				loading: "加载中…",
				saved: "已保存",
				notifSent: "测试通知已发送（查看 Windows 通知中心）",
			},
			en: {
				nav: "Desktop",
				intro: "Options are applied by the local DshDesktop.exe (127.0.0.1:3980).",
				closeLabel: "Close button behavior",
				closeTray: "Minimize to system tray (recommended)",
				closeExit: "Exit directly (and stop the service)",
				closeHint: "With tray mode, clicking ✕ hides to tray and keeps running in the background.",
				autoStartLabel: "Launch at logon",
				autoStartHint: "Start DshDesktop.exe and the backend automatically after you log in.",
				notifyLabel: "Notify when a task completes",
				notifyHint: "Shows a Windows notification when a background task finishes a turn.",
				testNotify: "Send test notification",
				skinTitle: "Skin Center",
				skinIntro: "Pick one: choose the DSH default look or an installed skin; the UI refreshes automatically after switching.",
				skinDefault: "DSH Default (built-in)",
				skinNone: "No other skins detected.",
				skinSwitch: "Switching skin, the UI will refresh automatically…",
				skinCurrent: "Current",
				notAvail: "Desktop settings unavailable",
				notAvailHint: "These options are provided by the DshDesktop.exe desktop client; open DeepSeek Harness via DshDesktop.exe to use them.",
				loading: "Loading…",
				saved: "Saved",
				notifSent: "Test notification sent (see Windows Action Center)",
			},
		};

		var t = null;
		var ctxRef = null;

		function fetchJson(url, options) {
			return fetch(url, options).then(function (r) { return r.json(); });
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

		// After boot, keep only the persisted active skin mounted; dispose the rest.
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

		function SectionRow(props) {
			return h("label", {
				style: {
					display: "flex", justifyContent: "space-between", alignItems: "center",
					gap: "16px", padding: "8px 0", cursor: "pointer",
				},
			}, h("span", { style: { lineHeight: "1.4" } }, props.label), props.control);
		}

		function Hint(props) {
			if (!props.text) return null;
			return h("div", { style: { fontSize: "12px", opacity: ".75", padding: "4px 0" } }, props.text);
		}

		function DesktopSection(props) {
			var cfgState = useState(null);
			var cfg = cfgState[0];
			var setCfg = cfgState[1];
			var errorState = useState(null);
			var error = errorState[0];
			var setError = errorState[1];
			var skinsState = useState([]);
			var skins = skinsState[0];
			var setSkins = skinsState[1];
			var noticeState = useState("");
			var notice = noticeState[0];
			var setNotice = noticeState[1];
			var revState = useState(0);
			var rev = revState[0];
			var setRev = revState[1];

			useEffect(function () {
				var off = null;
				try { off = ctxRef.locale.subscribe(function () { setRev(function (v) { return v + 1; }); }); } catch (e) { }
				fetchJson(API + "/api/config").then(setCfg).catch(function (e) { setError(String(e)); });
				fetchJson(API + "/api/skins").then(setSkins).catch(function () { setSkins([]); });
				return function () { if (off) { try { off(); } catch (e) { } } };
			}, []);

			function update(key, value, done) {
				fetchJson(API + "/api/config", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ key: key, value: value }),
				}).then(function (c) {
					setCfg(c);
					setNotice(t("saved") + ": " + key + " = " + value);
					if (done) done(c);
				}).catch(function (e) { setError(String(e)); });
			}

			function sendTestNotify() {
				fetchJson(API + "/api/notify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title: "DeepSeek Harness", message: t("testNotify") }),
				}).then(function () { setNotice(t("notifSent")); })
					.catch(function (e) { setError(String(e)); });
			}

			function selectSkin(item) {
				var id = item.builtin ? "" : item.id;
				update("activeSkin", id, function () {
					setNotice(t("skinSwitch"));
					setTimeout(function () { try { window.location.reload(); } catch (e) { } }, 900);
				});
			}

			function isSelected(item) {
				var active = (cfg && cfg.activeSkin) || "";
				if (item.builtin) return active === "" || active === "default";
				return active === item.id;
			}

			if (error) {
				return h("div", { style: { padding: "16px" } },
					h("p", {}, t("notAvail") + "（" + error + "）"),
					h("p", { style: { opacity: ".7", fontSize: "13px" } }, t("notAvailHint")));
			}
			if (!cfg) return h("div", { style: { padding: "16px" } }, t("loading"));

			var defaultItem = { id: "default", name: t("skinDefault"), builtin: true, package: "", preview: null };
			var items = [defaultItem].concat(skins.filter(function (s) { return !s.builtin; }));

			return h("div", { style: { padding: "16px", maxWidth: "640px" } },
				h("h3", { style: { margin: "0 0 6px" } }, t("nav")),
				h("p", { style: { margin: "0 0 12px", opacity: ".7", fontSize: "13px" } }, t("intro")),

				SectionRow({ label: t("closeLabel"),
					control: h("select", { value: cfg.closeBehavior, onChange: function (e) { update("closeBehavior", e.target.value); }, style: { padding: "4px 8px" } },
						h("option", { value: "tray" }, t("closeTray")),
						h("option", { value: "exit" }, t("closeExit"))) }),
				Hint({ text: t("closeHint") }),

				SectionRow({ label: t("autoStartLabel"),
					control: h("input", { type: "checkbox", checked: !!cfg.autoStart, onChange: function (e) { update("autoStart", e.target.checked); } }) }),
				Hint({ text: t("autoStartHint") }),

				SectionRow({ label: t("notifyLabel"),
					control: h("input", { type: "checkbox", checked: !!cfg.notifyOnComplete, onChange: function (e) { update("notifyOnComplete", e.target.checked); } }) }),
				Hint({ text: t("notifyHint") }),

				h("div", { style: { margin: "8px 0" } },
					h("button", { onClick: sendTestNotify, style: { padding: "6px 14px", cursor: "pointer" } }, t("testNotify"))),

				h("h3", { style: { margin: "18px 0 6px" } }, t("skinTitle")),
				h("p", { style: { margin: "0 0 10px", opacity: ".7", fontSize: "13px" } }, t("skinIntro")),

				h("div", { style: { display: "flex", flexDirection: "column" } },
					items.map(function (item) {
						var selected = isSelected(item);
						return h("label", {
							key: item.id + "|" + (item.package || ""),
							style: {
								display: "flex", alignItems: "center", gap: "12px",
								padding: "8px 0", borderBottom: "1px solid rgba(128,128,128,.25)", cursor: "pointer",
							},
						},
							h("input", { type: "radio", name: "dsh-skin", checked: selected,
								onChange: function () { selectSkin(item); }, style: { flex: "none" } }),
							item.preview
								? h("img", { src: item.preview, style: { width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", flex: "none" } })
								: null,
							h("div", { style: { flex: "1", minWidth: "0" } },
								h("div", {},
									item.builtin ? item.name : (item.name || item.nameEn || item.id),
									selected ? h("span", { style: { marginLeft: "8px", fontSize: "12px", opacity: ".75" } }, "✓ " + t("skinCurrent")) : null),
								h("div", { style: { fontSize: "12px", opacity: ".6", wordBreak: "break-all" } },
									item.builtin ? t("skinIntro") : item.package)));
					})),

				notice ? h("div", { style: { marginTop: "12px", padding: "8px 10px", border: "1px solid rgba(128,128,128,.35)", borderRadius: "6px", fontSize: "13px" } }, notice) : null);
		}

		function apply(ctx) {
			ctxRef = ctx;
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "desktop-settings: dictionaries");
			t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.section", function () {
				return ctx.slots.register({
					name: "settings.section",
					id: "desktop",
					order: 90,
					label: function () { return t("nav"); },
				}, DesktopSection);
			});
			enforceActiveSkin();
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});