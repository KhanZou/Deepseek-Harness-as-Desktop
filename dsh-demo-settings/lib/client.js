// dsh-demo-settings: example consumer of @dsh-external/dsh-settings-framework.
// Adds a "Demo" Settings tab with declarative items and demonstrates
// cross-plugin sync: toggling an item sends a Windows notification, and the
// framework broadcasts changes to every subscriber regardless of which plugin
// wrote the value.

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-demo-settings",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var NS = "demoSettings";
		var API = "http://127.0.0.1:3980";

		var dict = {
			zh: {
				nav: "演示设置",
				greetingLabel: "问候语",
				greetingHint: "切换下方开关时作为通知内容。",
				modeLabel: "模式",
				modeAuto: "自动",
				modeManual: "手动",
				notifyLabel: "变更时发送通知",
				notifyHint: "打开/关闭本开关会立即发送一条 Windows 通知（跨插件同步演示）。",
				toastOn: "已开启",
				toastOff: "已关闭",
			},
			en: {
				nav: "Demo",
				greetingLabel: "Greeting",
				greetingHint: "Used as the notification text when you toggle the switch below.",
				modeLabel: "Mode",
				modeAuto: "Auto",
				modeManual: "Manual",
				notifyLabel: "Notify on change",
				notifyHint: "Toggling sends a Windows notification immediately (cross-plugin sync demo).",
				toastOn: "enabled",
				toastOff: "disabled",
			},
		};

		var t = null;
		var ctxRef = null;

		function whenReady(cb, tries) {
			tries = tries || 0;
			if (window.__DSH_SETTINGS__) { cb(window.__DSH_SETTINGS__); return; }
			if (tries > 200) return;
			setTimeout(function () { whenReady(cb, tries + 1); }, 200);
		}

		function apply(ctx) {
			ctxRef = ctx;
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "demo-settings: dictionaries");
			t = ctx.locale.bind(NS);

			whenReady(function (sf) {
				sf.registerTab({ id: "demo", label: function () { return t("nav"); }, order: 85 });

				sf.registerItem({ tabId: "demo", key: "demo.greeting", type: "text", label: t("greetingLabel"), hint: t("greetingHint"), defaultValue: "Hello" });
				sf.registerItem({ tabId: "demo", key: "demo.mode", type: "select", label: t("modeLabel"),
					options: [
						{ value: "auto", label: t("modeAuto") },
						{ value: "manual", label: t("modeManual") },
					], defaultValue: "auto" });
				sf.registerItem({ tabId: "demo", key: "demo.notify", type: "toggle", label: t("notifyLabel"), hint: t("notifyHint"), defaultValue: false });

				// React to changes from any plugin (this one or another): the
				// framework emits for every subscriber on every write + refresh.
				sf.subscribe("demo.notify", function (v) {
					var on = v === "true" || v === "1";
					var greeting = sf.get("demo.greeting") || "";
					fetch(API + "/api/notify", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ title: "Demo Settings", message: (on ? t("toastOn") : t("toastOff")) + " | " + greeting }),
					}).catch(function () { });
				});
			});
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});