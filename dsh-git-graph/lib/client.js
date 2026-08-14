// dsh-git-graph: a "Git Graph" conversation view tab for the DSH Web UI.
// Shows a branch selector plus a commit-history swimlane graph, backed by the
// local DshDesktop.exe API (/api/git/branches, /api/git/log, /api/git/checkout).

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-git-graph",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;

		var API = (typeof window !== "undefined" && window.__DSH_DESKTOP_API__) || "http://127.0.0.1:3980";
		var NS = "gitGraph";

		var dict = {
			zh: {
				nav: "Git 图谱",
				branch: "分支",
				current: "当前",
				checkout: "切换到此分支",
				refresh: "刷新",
				loading: "加载中…",
				failed: "加载失败（请确认该目录是 Git 仓库，且 DshDesktop.exe 正在运行）",
				checkoutDone: "已切换到分支：",
				checkoutFail: "切换失败：",
				empty: "暂无提交记录",
				commit: "提交",
				by: "作者",
				search: "搜索提交…",
				noMatch: "没有匹配的提交",
			},
			en: {
				nav: "Git Graph",
				branch: "Branch",
				current: "current",
				checkout: "Checkout",
				refresh: "Refresh",
				loading: "Loading…",
				failed: "Failed to load (make sure the directory is a Git repo and DshDesktop.exe is running)",
				checkoutDone: "Checked out branch: ",
				checkoutFail: "Checkout failed: ",
				empty: "No commits yet",
				commit: "Commit",
				by: "by",
				search: "Search commits…",
				noMatch: "No matching commits",
			},
		};
		var t = null;

		function fetchJson(url, options) {
			return fetch(url, options).then(function (r) { return r.json(); });
		}

		function workDir() {
			return fetchJson(API + "/api/settings").then(function (m) {
				return (m && m.serverWorkDir) || "";
			});
		}

		// ---- swimlane layout ----------------------------------------------

		// Returns commits annotated with { lane, active, next } for rendering.
		function layoutCommits(commits) {
			var lanes = [];
			var out = [];
			for (var i = 0; i < commits.length; i++) {
				var c = commits[i];
				var active = lanes.slice();
				var lane = lanes.indexOf(c.hash);
				if (lane < 0) {
					lane = lanes.length;
					lanes.push(c.hash);
				}
				// resolve this commit: remove from lanes
				lanes.splice(lane, 1);
				var parents = c.parents || [];
				if (parents.length > 0) {
					// first parent continues the lane
					var ins = [parents[0]];
					for (var p = 1; p < parents.length; p++) ins.push(parents[p]);
					for (var k = ins.length - 1; k >= 0; k--) lanes.splice(lane, 0, ins[k]);
				}
				out.push({
					commit: c,
					lane: lane,
					active: active,
					next: lanes.slice(),
					maxLanes: Math.max(active.length, lanes.length, lane + 1),
				});
			}
			return out;
		}

		function maxLaneCount(rows) {
			var m = 1;
			for (var i = 0; i < rows.length; i++) if (rows[i].maxLanes > m) m = rows[i].maxLanes;
			return m;
		}

		// ---- component -----------------------------------------------------

		function GitGraphView() {
			var branchesState = useState([]);
			var branches = branchesState[0];
			var setBranches = branchesState[1];
			var currentState = useState("");
			var current = currentState[0];
			var setCurrent = currentState[1];
			var branchState = useState("");
			var branch = branchState[0];
			var setBranch = branchState[1];
			var rowsState = useState([]);
			var rows = rowsState[0];
			var setRows = rowsState[1];
			var errState = useState("");
			var err = errState[0];
			var setErr = errState[1];
			var loadingState = useState(true);
			var loading = loadingState[0];
			var setLoading = loadingState[1];
			var msgState = useState("");
			var msg = msgState[0];
			var setMsg = msgState[1];
			var qState = useState("");
			var q = qState[0];
			var setQ = qState[1];

			function loadBranches() {
				workDir().then(function (wd) {
					return fetchJson(API + "/api/git/branches?dir=" + encodeURIComponent(wd));
				}).then(function (m) {
					if (m && m.ok) {
						setBranches(m.branches || []);
						setCurrent(m.current || "");
						if (!branch || branch === "") setBranch(m.current || ((m.branches || [])[0] || ""));
					}
				}).catch(function () { });
			}

			function loadLog() {
				setLoading(true);
				setErr("");
				workDir().then(function (wd) {
					var url = API + "/api/git/log?dir=" + encodeURIComponent(wd) + "&branch=" + encodeURIComponent(branch || "HEAD") + "&limit=200";
					return fetchJson(url);
				}).then(function (m) {
					if (m && m.ok) {
						setRows(layoutCommits(m.commits || []));
					} else {
						setRows([]);
						setErr((m && m.error) || t("failed"));
					}
				}).catch(function () {
					setRows([]);
					setErr(t("failed"));
				}).finally(function () { setLoading(false); });
			}

			useEffect(function () {
				loadBranches();
			}, []);

			useEffect(function () {
				if (branch) loadLog();
			}, [branch]);

			function doCheckout() {
				if (!branch) return;
				workDir().then(function (wd) {
					return fetchJson(API + "/api/git/checkout", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ dir: wd, branch: branch }),
					});
				}).then(function (m) {
					if (m && m.ok) {
						setMsg(t("checkoutDone") + branch);
						loadBranches();
						loadLog();
					} else {
						setMsg(t("checkoutFail") + ((m && m.error) || ""));
					}
					setTimeout(function () { setMsg(""); }, 4000);
				}).catch(function () { });
			}

			var laneCount = rows.length ? maxLaneCount(rows) : 1;
			var laneW = 16;
			var filtered = q ? rows.filter(function (r) {
				var c = r.commit;
				return c.subject.toLowerCase().indexOf(q.toLowerCase()) >= 0 ||
					c.author.toLowerCase().indexOf(q.toLowerCase()) >= 0 ||
					c.short.toLowerCase().indexOf(q.toLowerCase()) >= 0;
			}) : rows;

			return h("div", { style: { padding: "16px", display: "flex", flexDirection: "column", height: "100%", minHeight: 0, boxSizing: "border-box" } },
				h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", paddingBottom: "10px" } },
					h("label", { style: { fontSize: "13px", opacity: ".8" } }, t("branch") + ":"),
					h("select", {
						value: branch,
						onChange: function (e) { setBranch(e.target.value); },
						style: { padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(128,128,128,.35)", background: "transparent", color: "inherit", fontSize: "13px" },
					}, branches.map(function (b) {
						return h("option", { key: b, value: b }, b + (b === current ? " (" + t("current") + ")" : ""));
					})),
					h("button", { onClick: doCheckout, disabled: !branch || branch === current, style: btnStyle() }, t("checkout")),
					h("button", { onClick: loadLog, style: btnStyle() }, t("refresh")),
					h("input", { value: q, onChange: function (e) { setQ(e.target.value); }, placeholder: t("search"), style: { flex: 1, minWidth: "140px", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(128,128,128,.35)", background: "transparent", color: "inherit", fontSize: "12px" } })),
				msg ? h("div", { style: { padding: "6px 10px", marginBottom: "8px", borderRadius: "8px", border: "1px solid rgba(77,107,254,.5)", fontSize: "13px", maxWidth: "720px" } }, msg) : null,
				loading ? h("div", { style: { padding: "18px", opacity: ".6" } }, t("loading"))
					: err ? h("div", { style: { padding: "14px", opacity: ".75", fontSize: "13px", maxWidth: "720px" } }, err)
					: filtered.length === 0
						? h("div", { style: { padding: "18px", opacity: ".55", fontSize: "13px" } }, q ? t("noMatch") : t("empty"))
						: h("div", { style: { flex: 1, overflow: "auto", minHeight: 0, border: "1px solid rgba(128,128,128,.22)", borderRadius: "10px", padding: "6px 0" } },
							filtered.map(function (r) {
								var c = r.commit;
								return h("div", { key: c.hash, style: { display: "flex", alignItems: "center", minHeight: "30px", padding: "2px 10px", fontSize: "13px", borderBottom: "1px solid rgba(128,128,128,.08)" } },
									h("div", { style: { width: (laneCount * laneW) + "px", minWidth: (laneCount * laneW) + "px", height: "30px", position: "relative", flex: "none" } },
										r.active.map(function (hash, li) {
											var cont = r.next.indexOf(hash) >= 0;
											return h("div", {
												key: "l" + li,
												style: {
													position: "absolute", left: (li * laneW + laneW / 2 - 1) + "px", top: 0, bottom: 0, width: "2px",
													background: cont ? "rgba(128,128,128,.4)" : "rgba(128,128,128,.18)",
												},
											});
										}),
										h("div", {
											style: {
												position: "absolute", left: (r.lane * laneW + laneW / 2 - 5) + "px", top: "9px",
												width: "10px", height: "10px", borderRadius: "50%",
												background: "var(--dsw-alias-accent, #4d6bfe)",
												border: "2px solid var(--dsw-alias-surface-raised, #1a1f38)",
												boxShadow: "0 0 0 1px rgba(128,128,128,.35)",
											},
										}),
										(c.parents || []).length > 1 ? h("div", {
											style: {
												position: "absolute", left: (r.lane * laneW + laneW / 2) + "px", top: "14px",
												width: ((Math.max.apply(null, r.next.map(function (hash, li) { return li; }).concat([r.lane]))) * laneW + laneW / 2 - (r.lane * laneW + laneW / 2)) + "px",
												height: "2px", background: "rgba(128,128,128,.5)",
											},
										}) : null),
									h("div", { style: { flex: "none", fontFamily: "Consolas, monospace", color: "var(--dsw-alias-state-warning-primary, #e3b341)", width: "70px", minWidth: "70px" } }, c.short),
									h("div", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.subject),
									h("div", { style: { flex: "none", fontSize: "12px", opacity: ".65", marginLeft: "12px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
										c.author + " · " + fmtDate(c.date)));
							})));
		}

		function fmtDate(iso) {
			try {
				var d = new Date(iso);
				return d.toLocaleString();
			} catch (e) { return iso || ""; }
		}

		function btnStyle() {
			return { padding: "4px 12px", fontSize: "12px", borderRadius: "6px", cursor: "pointer", background: "transparent", border: "1px solid rgba(128,128,128,.4)", color: "inherit" };
		}

		function apply(ctx) {
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "git-graph: dictionaries");
			t = ctx.locale.bind(NS);

			ctx.slots.inject("conversation.view", function () {
				return ctx.slots.register({
					name: "conversation.view",
					id: "git-graph",
					order: 20,
					label: function () { return t("nav"); },
				}, GitGraphView);
			});
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});