window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-skill-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:Toggle.module.css.mjs
		const css$1 = ".KtQV-G_toggle{background:var(--ds-ctl-switch-track,#80808059);cursor:pointer;border:none;border-radius:999px;flex:none;align-items:center;width:34px;height:20px;padding:0;transition:background .15s;display:inline-flex;position:relative}.KtQV-G_toggle.KtQV-G_on{background:var(--ds-accent,#4f7cff)}.KtQV-G_toggle.KtQV-G_disabled{opacity:.5;cursor:default}.KtQV-G_thumb{background:#fff;border-radius:50%;width:16px;height:16px;transition:transform .15s;position:absolute;top:2px;left:2px;box-shadow:0 1px 2px #00000040}.KtQV-G_on .KtQV-G_thumb{transform:translate(14px)}";
		const tagId$1 = "@dsh-external/dsh-client-ui-skill-manager/Toggle.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-external/dsh-client-ui-skill-manager";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var Toggle_module_css_default = {
			"on": "KtQV-G_on",
			"thumb": "KtQV-G_thumb",
			"toggle": "KtQV-G_toggle",
			"disabled": "KtQV-G_disabled"
		};
		//#endregion
		//#region lib/types/client/Toggle.js
		/**
		* Render an accessible switch.
		* @param props.checked - the current on/off state.
		* @param props.onChange - called with the next state when the user flips it.
		* @param props.label - accessible label naming the switch (e.g. "启用 alpha").
		* @param props.disabled - whether the switch is inert (pending writes).
		* @param props.className - optional extra class.
		* @returns the switch element.
		*/
		function Toggle({ checked, onChange, label, disabled = false, className }) {
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				role: "switch",
				"aria-checked": checked,
				"aria-label": label,
				className: clsx(Toggle_module_css_default.toggle, checked && Toggle_module_css_default.on, disabled && Toggle_module_css_default.disabled, className),
				disabled,
				onClick: () => {
					onChange(!checked);
				},
				children: (0, react_jsx_runtime.jsx)("span", {
					className: Toggle_module_css_default.thumb,
					"aria-hidden": "true"
				})
			});
		}
		//#endregion
		//#region \0dsh-css:SkillsManagerModal.module.css.mjs
		const css = ".oGEl5a_modal{flex-direction:column;width:min(560px,100vw - 48px);max-height:min(72vh,640px);display:flex}.oGEl5a_content{min-height:0;overflow-y:auto}.oGEl5a_status{text-align:center;color:var(--ds-fg-muted,#808080e6);padding:24px 4px;font-size:13px}.oGEl5a_sections{flex-direction:column;gap:20px;display:flex}.oGEl5a_section{flex-direction:column;gap:6px;display:flex}.oGEl5a_sectionTitle{margin:0;font-size:13px;font-weight:600}.oGEl5a_sectionHint{color:var(--ds-fg-muted,#808080e6);margin:0;font-size:11px}.oGEl5a_list{flex-direction:column;margin:0;padding:0;list-style:none;display:flex}.oGEl5a_row{border-bottom:1px solid var(--ds-separator,#8080802e);align-items:center;gap:12px;padding:10px 4px;display:flex}.oGEl5a_row:last-child{border-bottom:none}.oGEl5a_rowMain{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.oGEl5a_rowTitle{align-items:center;gap:8px;display:flex}.oGEl5a_rowName{font-size:13px;font-weight:600;font-family:var(--ds-font-mono,ui-monospace, monospace)}.oGEl5a_badge{background:var(--ds-ctl-badge,#80808029);color:var(--ds-fg-muted,#808080e6);border-radius:999px;padding:3px 6px;font-size:10px;line-height:1}.oGEl5a_badgeGlobal{background:var(--ds-accent-soft,#4f7cff29)}.oGEl5a_rowDesc{color:var(--ds-fg-muted,#808080e6);text-overflow:ellipsis;white-space:nowrap;font-size:12px;overflow:hidden}.oGEl5a_rowHint{color:var(--ds-fg-faint,#80808099);font-size:11px}.oGEl5a_footer{gap:8px;display:flex}";
		const tagId = "@dsh-external/dsh-client-ui-skill-manager/SkillsManagerModal.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-external/dsh-client-ui-skill-manager";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SkillsManagerModal_module_css_default = {
			"footer": "oGEl5a_footer",
			"rowDesc": "oGEl5a_rowDesc",
			"modal": "oGEl5a_modal",
			"rowName": "oGEl5a_rowName",
			"rowHint": "oGEl5a_rowHint",
			"rowMain": "oGEl5a_rowMain",
			"badge": "oGEl5a_badge",
			"status": "oGEl5a_status",
			"section": "oGEl5a_section",
			"sectionHint": "oGEl5a_sectionHint",
			"badgeGlobal": "oGEl5a_badgeGlobal",
			"row": "oGEl5a_row",
			"content": "oGEl5a_content",
			"rowTitle": "oGEl5a_rowTitle",
			"list": "oGEl5a_list",
			"sectionTitle": "oGEl5a_sectionTitle",
			"sections": "oGEl5a_sections"
		};
		//#endregion
		//#region lib/types/client/SkillsManagerModal.js
		/** Group the ready entries into the two scopes, keeping name order. */
		function groupEntries(entries) {
			const project = [];
			const global = [];
			for (const entry of entries) (entry.scope === "project" ? project : global).push(entry);
			return {
				project,
				global
			};
		}
		/** One skill row: name, description, source badge, invocation hint, toggle. */
		function SkillRow({ entry, pending, t, onToggle }) {
			const badge = entry.source.endsWith("agents") ? t("badge.agents") : t("badge.dsh");
			const invocation = entry.modelInvocable ? t("row.modelAndUser") : t("row.userOnly");
			return (0, react_jsx_runtime.jsxs)("li", {
				className: SkillsManagerModal_module_css_default.row,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: SkillsManagerModal_module_css_default.rowMain,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: SkillsManagerModal_module_css_default.rowTitle,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: SkillsManagerModal_module_css_default.rowName,
								children: entry.name
							}), (0, react_jsx_runtime.jsx)("span", {
								className: clsx(SkillsManagerModal_module_css_default.badge, entry.scope === "global" && SkillsManagerModal_module_css_default.badgeGlobal),
								children: badge
							})]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: SkillsManagerModal_module_css_default.rowDesc,
							children: entry.description
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: SkillsManagerModal_module_css_default.rowHint,
							children: invocation
						})
					]
				}), (0, react_jsx_runtime.jsx)(Toggle, {
					checked: entry.enabled,
					disabled: pending,
					label: entry.enabled ? t("toggle.disable", { name: entry.name }) : t("toggle.enable", { name: entry.name }),
					onChange: onToggle
				})]
			});
		}
		/**
		* The manager dialog occupant. Renders the Modal when open; loads the fresh
		* snapshot on open/cwd change, applies toggles through `setEnabled`, and
		* offers config copy/apply for cross-project reuse.
		* @param props - owner conversation plus the injected api/copy.
		* @returns the dialog element (Modal renders nothing while closed).
		*/
		function SkillsManagerSurface({ open, workspace, onCancel, api, t }) {
			const cwd = workspace?.cwd;
			const [phase, setPhase] = (0, react.useState)({ status: "idle" });
			const [reloadSeq, setReloadSeq] = (0, react.useState)(0);
			const [pendingName, setPendingName] = (0, react.useState)(null);
			const [toast, setToast] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!open || cwd === void 0) return;
				let cancelled = false;
				setPhase({ status: "loading" });
				api.inspect({ cwd }).then(({ result }) => {
					if (cancelled) return;
					if (!result.ok) {
						setPhase({
							status: "error",
							message: result.error.message
						});
						return;
					}
					setPhase({
						status: "ready",
						entries: [...result.value.entries]
					});
				}).catch((error) => {
					if (cancelled) return;
					setPhase({
						status: "error",
						message: String(error)
					});
				});
				return () => {
					cancelled = true;
				};
			}, [
				open,
				cwd,
				reloadSeq,
				api
			]);
			const toggle = async (entry, enabled) => {
				if (cwd === void 0 || phase.status !== "ready") return;
				setPendingName(entry.name);
				try {
					const { result } = await api.setEnabled({
						cwd,
						name: entry.name,
						enabled,
						scope: entry.scope
					});
					if (!result.ok) throw new Error(result.error.message);
					setPhase({
						status: "ready",
						entries: [...result.value.entries]
					});
				} catch (error) {
					setToast({
						text: t("action.applyFailed", { message: String(error) }),
						seq: Date.now()
					});
					setReloadSeq((seq) => seq + 1);
				} finally {
					setPendingName(null);
				}
			};
			const copyConfig = async () => {
				if (cwd === void 0) return;
				try {
					const { result } = await api.exportConfig({ cwd });
					if (!result.ok) throw new Error(result.error.message);
					await navigator.clipboard.writeText(result.value.json);
					setToast({
						text: t("action.copied"),
						seq: Date.now()
					});
				} catch (error) {
					setToast({
						text: t("action.copyFailed", { message: String(error) }),
						seq: Date.now()
					});
				}
			};
			const applyConfig = async () => {
				if (cwd === void 0) return;
				let json;
				try {
					json = await navigator.clipboard.readText();
				} catch (error) {
					setToast({
						text: t("action.clipboardUnavailable", { message: String(error) }),
						seq: Date.now()
					});
					return;
				}
				try {
					const { result } = await api.applyConfig({
						cwd,
						json
					});
					if (!result.ok) throw new Error(result.error.message);
					setPhase({
						status: "ready",
						entries: [...result.value.entries]
					});
					setToast({
						text: t("action.applied"),
						seq: Date.now()
					});
				} catch (error) {
					setToast({
						text: t("action.applyFailed", { message: String(error) }),
						seq: Date.now()
					});
				}
			};
			const refresh = () => {
				setReloadSeq((seq) => seq + 1);
			};
			const body = phase.status === "loading" ? (0, react_jsx_runtime.jsx)("div", {
				className: SkillsManagerModal_module_css_default.status,
				role: "status",
				children: t("dialog.loading")
			}) : phase.status === "error" ? (0, react_jsx_runtime.jsx)("div", {
				className: SkillsManagerModal_module_css_default.status,
				role: "alert",
				children: t("dialog.failed", { message: phase.message })
			}) : phase.status === "ready" ? (() => {
				const { project, global } = groupEntries(phase.entries);
				if (project.length === 0 && global.length === 0) return (0, react_jsx_runtime.jsx)("div", {
					className: SkillsManagerModal_module_css_default.status,
					children: t("dialog.empty")
				});
				return (0, react_jsx_runtime.jsxs)("div", {
					className: SkillsManagerModal_module_css_default.sections,
					children: [project.length > 0 && (0, react_jsx_runtime.jsxs)("section", {
						className: SkillsManagerModal_module_css_default.section,
						children: [
							(0, react_jsx_runtime.jsx)("h3", {
								className: SkillsManagerModal_module_css_default.sectionTitle,
								children: t("section.project")
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: SkillsManagerModal_module_css_default.sectionHint,
								children: t("section.project.hint")
							}),
							(0, react_jsx_runtime.jsx)("ul", {
								className: SkillsManagerModal_module_css_default.list,
								children: project.map((entry) => (0, react_jsx_runtime.jsx)(SkillRow, {
									entry,
									pending: pendingName === entry.name,
									t,
									onToggle: (next) => {
										toggle(entry, next);
									}
								}, `${entry.scope}:${entry.name}`))
							})
						]
					}), global.length > 0 && (0, react_jsx_runtime.jsxs)("section", {
						className: SkillsManagerModal_module_css_default.section,
						children: [
							(0, react_jsx_runtime.jsx)("h3", {
								className: SkillsManagerModal_module_css_default.sectionTitle,
								children: t("section.global")
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: SkillsManagerModal_module_css_default.sectionHint,
								children: t("section.global.hint")
							}),
							(0, react_jsx_runtime.jsx)("ul", {
								className: SkillsManagerModal_module_css_default.list,
								children: global.map((entry) => (0, react_jsx_runtime.jsx)(SkillRow, {
									entry,
									pending: pendingName === entry.name,
									t,
									onToggle: (next) => {
										toggle(entry, next);
									}
								}, `${entry.scope}:${entry.name}`))
							})
						]
					})]
				});
			})() : null;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open,
				onClose: onCancel,
				title: t("dialog.title"),
				closeLabel: t("action.close"),
				...workspace === void 0 ? {} : { description: t("footer.project", { path: workspace.cwd }) },
				className: SkillsManagerModal_module_css_default.modal,
				contentClassName: SkillsManagerModal_module_css_default.content,
				footer: (0, react_jsx_runtime.jsxs)("div", {
					className: SkillsManagerModal_module_css_default.footer,
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: cwd === void 0 || phase.status === "loading",
							onClick: () => {
								copyConfig();
							},
							children: t("action.copy")
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: cwd === void 0 || phase.status === "loading",
							onClick: () => {
								applyConfig();
							},
							children: t("action.apply")
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: phase.status === "loading",
							onClick: refresh,
							children: t("action.refresh")
						})
					]
				}),
				children: body
			}), toast !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: toast.text,
				onDone: () => {
					setToast(null);
				}
			}, toast.seq)] });
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `skillManager` namespace dictionaries for the skill manager dialog. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "skillManager";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"dialog.title": "技能设置",
			"dialog.loading": "正在加载技能…",
			"dialog.failed": "技能加载失败：{message}",
			"dialog.empty": "该项目未安装任何技能。",
			"section.project": "项目技能",
			"section.global": "全局技能",
			"section.project.hint": "仅当前项目生效（.dsh/skills、.agents/skills）",
			"section.global.hint": "所有项目生效（~/.dsh/skills、~/.agents/skills）",
			"badge.dsh": ".dsh",
			"badge.agents": ".agents",
			"badge.bundled": "内置",
			"row.userOnly": "仅用户",
			"row.modelAndUser": "模型+用户",
			"toggle.enable": "启用 {name}",
			"toggle.disable": "禁用 {name}",
			"action.copy": "复制配置",
			"action.apply": "应用配置",
			"action.refresh": "刷新",
			"action.close": "关闭",
			"action.copied": "配置已复制到剪贴板",
			"action.copyFailed": "复制失败：{message}",
			"action.applied": "配置已应用到该项目",
			"action.applyFailed": "应用失败：{message}",
			"action.clipboardUnavailable": "无法读取剪贴板：{message}",
			"action.pending": "处理中…",
			"footer.project": "项目：{path}"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"dialog.title": "Skill Settings",
			"dialog.loading": "Loading skills…",
			"dialog.failed": "Failed to load skills: {message}",
			"dialog.empty": "No skills are installed in this project.",
			"section.project": "Project skills",
			"section.global": "Global skills",
			"section.project.hint": "This project only (.dsh/skills, .agents/skills)",
			"section.global.hint": "Every project (~/.dsh/skills, ~/.agents/skills)",
			"badge.dsh": ".dsh",
			"badge.agents": ".agents",
			"badge.bundled": "bundled",
			"row.userOnly": "user-only",
			"row.modelAndUser": "model+user",
			"toggle.enable": "Enable {name}",
			"toggle.disable": "Disable {name}",
			"action.copy": "Copy config",
			"action.apply": "Apply config",
			"action.refresh": "Refresh",
			"action.close": "Close",
			"action.copied": "Config copied to clipboard",
			"action.copyFailed": "Copy failed: {message}",
			"action.applied": "Config applied to this project",
			"action.applyFailed": "Apply failed: {message}",
			"action.clipboardUnavailable": "Clipboard unavailable: {message}",
			"action.pending": "Working…",
			"footer.project": "Project: {path}"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Required services (cordis fiber inject): slots, the wire connection, locale. */
		const inject = [
			"slots",
			"connection",
			"locale"
		];
		/**
		* Client plugin body: register the dialog's dictionaries and the manager
		* surface into the workspace skill-manager hole through `slots.inject()`.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-skill-manager: dictionaries");
			const injected = () => ({
				api: ctx.get("connection").api.skills,
				t: ctx.locale.bind(NS)
			});
			ctx.slots.inject("sidebar.workspaces.skillManager", () => ctx.slots.register({
				name: "sidebar.workspaces.skillManager",
				inject: injected,
				locale: NS
			}, SkillsManagerSurface));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map