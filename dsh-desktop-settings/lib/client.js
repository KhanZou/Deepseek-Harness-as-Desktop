// dsh-desktop-settings: Desktop options for the DSH Web UI, registered through
// the dsh-settings-framework (window.__DSH_SETTINGS__). Covers close-button
// behavior, auto-start on boot, session-completion notifications, and a test
// notification action. The skin center moved out to the standalone
// dsh-skin-gallery plugin (own Settings tab).

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-settings-desktop",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;

		var API = (typeof window !== "undefined" && window.__DSH_DESKTOP_API__) || "http://127.0.0.1:3980";
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
				notifyPreviewLabel: "通知显示回答预览",
				notifyPreviewHint: "会话完成通知中附带本轮实际回答内容摘要。",
				quickReplyLabel: "通知内快捷回复",
				quickReplyHint: "通知内提供输入框与回复按钮，可直接回复或布置下一个任务到同一会话。",
				approvalNotifyLabel: "权限请求通知",
				approvalNotifyHint: "工具请求更高权限时通过 Windows 通知询问，可在通知内批准或拒绝。",
				previewMaxLabel: "预览长度",
				testNotifyAdvanced: "发送带预览/回复的测试通知",
				notifAdvancedSent: "已发送带交互的测试通知（查看 Windows 通知中心）",
				trayHintLabel: "缩到托盘时显示提示",
				trayHintHint: "关闭后最小化/关闭窗口不再反复弹出托盘提示。",
				testNotify: "发送测试通知",
				notifSent: "测试通知已发送（查看 Windows 通知中心）",
				skinGalleryHint: "皮肤请到「皮肤中心」标签页管理（dsh-skin-gallery 插件）。",
				updateClient: "一键更新客户端",
				updateClientHint: "从 GitHub 拉取最新客户端插件并安全部署，自动重启服务；本地设置、皮肤与对话会话均不受影响。",
				updateRunning: "正在更新… 完成后客户端会自动重启",
				updateIdle: "等待更新",
				updateConfirm: "确定要一键更新客户端吗？将拉取 GitHub 最新版本、安全部署并重启服务（本地数据与会话不受影响）。",
				updateStartedNotify: "客户端更新已启动，完成后会自动重启。",
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
				notifyPreviewLabel: "Show answer preview in notification",
				notifyPreviewHint: "Completion notifications include a short preview of the actual reply.",
				quickReplyLabel: "Quick reply in notification",
				quickReplyHint: "The toast includes a text input and reply button to continue the same session.",
				approvalNotifyLabel: "Permission request notifications",
				approvalNotifyHint: "Tool permission escalations ask through a Windows notification with approve/reject buttons.",
				previewMaxLabel: "Preview length",
				testNotifyAdvanced: "Send interactive test notification",
				notifAdvancedSent: "Interactive test notification sent (see Windows Action Center)",
				trayHintLabel: "Tray balloon on minimize/close",
				trayHintHint: "When off, minimizing/closing no longer shows a repeated tray balloon.",
				testNotify: "Send test notification",
				notifSent: "Test notification sent (see Windows Action Center)",
				skinGalleryHint: "Manage skins in the Skin Center tab (dsh-skin-gallery plugin).",
				updateClient: "One-click update client",
				updateClientHint: "Pull the latest client plugins from GitHub, deploy them safely and restart the service. Local settings, skins and conversation sessions are preserved.",
				updateRunning: "Updating… the app will restart automatically",
				updateIdle: "Idle",
				updateConfirm: "Update the client now? The latest code will be pulled from GitHub, deployed safely and the service restarted (local data and sessions are preserved).",
				updateStartedNotify: "Client update started; the app will restart when done.",
			},
		};

		var t = null;

		function fetchJson(url, options) {
			return fetch(url, options).then(function (r) { return r.json(); });
		}

		function whenReady(cb, tries) {
			tries = tries || 0;
			if (window.__DSH_SETTINGS__) { cb(window.__DSH_SETTINGS__); return; }
			if (tries > 200) return;
			setTimeout(function () { whenReady(cb, tries + 1); }, 200);
		}

		function sendTestNotify() {
			fetchJson(API + "/api/notify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "DeepSeek Harness", message: t("testNotify") }),
			}).catch(function () { });
		}

		function sendTestNotifyAdvanced() {
			fetchJson(API + "/api/notify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					kind: "turn",
					title: "任务完成 / Task completed",
					message: "回答预览：已按计划完成通知优化，包含预览、快捷回复与权限审批按钮，下一步可继续验证。",
					sessionId: "",
					turn: "0",
					reason: "completed",
					tools: "bash, fs",
					quickReply: true,
					replyPlaceholder: "回复或布置下一个任务…",
					replyLabel: "回复 / Reply",
				}),
			}).catch(function () { });
		}


		var UPDATE_LOG_PATH = "D:\\dsh-desktop-window\\update.log";
		var updateState = { running: false, tail: "", inFlight: false };

		function readUpdateLog() {
			return fetchJson(API + "/api/fs/read?path=" + encodeURIComponent(UPDATE_LOG_PATH))
				.then(function (r) { return (r && r.ok && r.content) ? String(r.content) : ""; })
				.catch(function () { return ""; });
		}

		function refreshUpdateStatus() {
			if (updateState.inFlight) return;
			updateState.inFlight = true;
			fetchJson(API + "/api/fs/list?dir=" + encodeURIComponent("D:\\dsh-desktop-window"))
				.then(function (r) {
					var items = (r && r.items) || [];
					updateState.running = items.some(function (f) { return f.name === "update.lock"; });
					return readUpdateLog();
				})
				.then(function (text) {
					var lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
					updateState.tail = lines.slice(-8).join("\n");
					updateState.inFlight = false;
				})
				.catch(function () { updateState.inFlight = false; });
		}

		function startUpdate() {
			if (!window.confirm(t("updateConfirm"))) return;
			updateState.running = true;
			updateState.tail = "";
			var cmd = "start \"\" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"D:\\dsh-desktop-window\\update-client.ps1\"";
			fetchJson(API + "/api/shell/exec", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dir: "D:\\dsh-desktop-window", command: cmd }),
			}).catch(function () { });
			fetchJson(API + "/api/notify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "DeepSeek Harness", message: t("updateStartedNotify") }),
			}).catch(function () { });
		}

		function apply(ctx) {
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "desktop-settings: dictionaries");
			t = ctx.locale.bind(NS);

			whenReady(function (sf) {
				sf.registerTab({ id: "desktop", label: function () { return t("nav"); }, order: 1020 });

				sf.registerItem({ tabId: "desktop", key: "closeBehavior", type: "select", label: t("closeLabel"),
					options: [
						{ value: "tray", label: t("closeTray") },
						{ value: "exit", label: t("closeExit") },
					], defaultValue: "tray" });
				sf.registerItem({ tabId: "desktop", key: "autoStart", type: "toggle", label: t("autoStartLabel"), hint: t("autoStartHint"), defaultValue: false });
				sf.registerItem({ tabId: "desktop", key: "notifyOnComplete", type: "toggle", label: t("notifyLabel"), hint: t("notifyHint"), defaultValue: true });
				sf.registerItem({ tabId: "desktop", key: "notifyPreview", type: "toggle", label: t("notifyPreviewLabel"), hint: t("notifyPreviewHint"), defaultValue: true });
				sf.registerItem({ tabId: "desktop", key: "quickReply", type: "toggle", label: t("quickReplyLabel"), hint: t("quickReplyHint"), defaultValue: true });
				sf.registerItem({ tabId: "desktop", key: "approvalNotify", type: "toggle", label: t("approvalNotifyLabel"), hint: t("approvalNotifyHint"), defaultValue: true });
				sf.registerItem({ tabId: "desktop", key: "previewMaxChars", type: "select", label: t("previewMaxLabel"), options: [
					{ value: "200", label: "200" },
					{ value: "300", label: "300" },
					{ value: "500", label: "500" },
				], defaultValue: "300" });
				sf.registerItem({ tabId: "desktop", key: "trayHint", type: "toggle", label: t("trayHintLabel"), hint: t("trayHintHint"), defaultValue: false });
				sf.registerItem({ tabId: "desktop", key: "testNotify", type: "action", label: t("testNotify"), action: sendTestNotify });
				sf.registerItem({ tabId: "desktop", key: "testNotifyAdvanced", type: "action", label: t("testNotifyAdvanced"), action: sendTestNotifyAdvanced });

				sf.registerItem({ tabId: "desktop", key: "updateClient", type: "custom",
					render: function () {
						refreshUpdateStatus();
						var divider = { borderTop: "1px solid rgba(128,128,128,.25)", marginTop: "12px", paddingTop: "12px" };
						return h("div", { style: divider },
							h("div", { style: { fontWeight: 600, marginBottom: "4px" } }, t("updateClient")),
							h("div", { style: { fontSize: "0.857em", opacity: ".8", marginBottom: "10px" } }, t("updateClientHint")),
							h("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
								h("button", {
									onClick: startUpdate,
									disabled: updateState.running,
									style: { padding: "8px 16px", cursor: "pointer" },
								}, t("updateClient")),
								h("span", { style: { fontSize: "0.857em", opacity: ".8" } },
									updateState.running ? t("updateRunning") : t("updateIdle"))),
							updateState.tail
								? h("pre", { style: { marginTop: "8px", fontSize: "0.75em", lineHeight: "1.4", opacity: ".75", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "140px", overflow: "auto", background: "rgba(128,128,128,.08)", padding: "8px", borderRadius: "6px" } }, updateState.tail)
								: null
						);
					} });
				sf.registerItem({ tabId: "desktop", key: "skinGalleryHint", type: "custom",
					render: function () {
						return h("div", { style: { fontSize: "0.75em", opacity: ".75", padding: "4px 0" } }, t("skinGalleryHint"));
					} });
			});
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});