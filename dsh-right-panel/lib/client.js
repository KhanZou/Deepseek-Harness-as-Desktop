// dsh-right-panel: file tree + preview + SCM (right panel) and a mini
// terminal (bottom panel) for the DSH Web UI. The panel shells themselves are
// provided by the dsh-panels-framework; this plugin registers the tabs and the
// header toggle buttons that call into window.__DSH_PANELS__.
//
// Backend: the local DshDesktop.exe API (http://127.0.0.1:3980):
//   /api/fs/list, /api/fs/read, /api/git/status, /api/git/stage|unstage|discard,
//   /api/shell/cwd, /api/shell/exec

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-right-panel",
	factory: (require) => {
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

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});