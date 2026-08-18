// dsh-git-graph: a "Git Graph" conversation view tab for the DSH Web UI.
// Shows, grouped by DSH workspace (project), a branch selector plus a
// commit-history swimlane graph, backed by the local DshDesktop.exe API
// (/api/git/branches, /api/git/log, /api/git/checkout). The project list
// comes from the same-origin workspace.list RPC, so every row clearly
// belongs to the project section it is rendered under.

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
				nav: "Git 图鉴",
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
				projects: "项目（Git 仓库）",
				notRepo: "非 Git 项目",
				noProjects: "没有检测到 Git 项目（已检查所有工作区）",
				fallbackDir: "工作目录",
				loadingProjects: "正在扫描各项目的 Git 仓库…",
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
				projects: "Projects (git repos)",
				notRepo: "Not a git repo",
				noProjects: "No git projects detected (scanned all workspaces)",
				fallbackDir: "Work dir",
				loadingProjects: "Scanning workspaces for git repos…",
			},
		};
		var t = null;

		function fetchJson(url, options) {
			return fetch(url, options).then(function (r) { return r.json(); });
		}

		function rpcId() {
			return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID()
				: (Date.now() + "-" + Math.random().toString(16).slice(2));
		}

		// Same-origin DSH RPC (workspace.list) so we know every project's path.
		function dshRpc(method, payload) {
			return fetch("/api/" + method, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "client-request", rpcId: rpcId(), method: method, payload: payload || {} }),
			}).then(function (r) { return r.json(); });
		}

		function listWorkspaces() {
			return dshRpc("workspace.list", {}).then(function (m) {
				if (m && m.result && m.result.ok && m.result.value && Array.isArray(m.result.value.items)) {
					return m.result.value.items;
				}
				return null;
			}).catch(function () { return null; });
		}

		function workDir() {
			return fetchJson(API + "/api/settings").then(function (m) {
				return (m && m.serverWorkDir) || "";
			}).catch(function () { return ""; });
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
				lanes.splice(lane, 1);
				var parents = c.parents || [];
				if (parents.length > 0) {
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

		function shortTitle(ws) {
			var title = (ws && ws.title) || "";
			if (title) return title;
			var p = (ws && ws.path) || "";
			var parts = p.split(/[\\/]/);
			return parts[parts.length - 1] || p;
		}

		// ---- per-project graph --------------------------------------------

		function ProjectGraph(props) {
			var ws = props.ws;
			var tt = props.t;
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
			var dir = ws.path || "";

			function loadBranches() {
				return fetchJson(API + "/api/git/branches?dir=" + encodeURIComponent(dir)).then(function (m) {
					if (m && m.ok) {
						setBranches(m.branches || []);
						setCurrent(m.current || "");
						setBranch(function (prev) {
							if (prev && prev !== "") return prev;
							return m.current || ((m.branches || [])[0] || "");
						});
						return true;
					}
					return false;
				}).catch(function () { return false; });
			}

			function loadLog() {
				setLoading(true);
				setErr("");
				return fetchJson(API + "/api/git/log?dir=" + encodeURIComponent(dir) + "&branch=" + encodeURIComponent(branch || "HEAD") + "&limit=200").then(function (m) {
					if (m && m.ok) {
						setRows(layoutCommits(m.commits || []));
					} else {
						setRows([]);
						setErr((m && m.error) || tt("failed"));
					}
				}).catch(function () {
					setRows([]);
					setErr(tt("failed"));
				}).finally(function () { setLoading(false); });
			}

			useEffect(function () {
				loadBranches().then(function (ok) {
					if (!ok) { setLoading(false); setErr(tt("failed")); }
				});
			}, [dir]);

			useEffect(function () {
				if (branch) loadLog();
			}, [branch, dir]);

			function doCheckout() {
				if (!branch) return;
				fetchJson(API + "/api/git/checkout", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ dir: dir, branch: branch }),
				}).then(function (m) {
					if (m && m.ok) {
						setMsg(tt("checkoutDone") + branch);
						loadBranches();
						loadLog();
					} else {
						setMsg(tt("checkoutFail") + ((m && m.error) || ""));
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

			return h("div", { style: { border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.22))", borderRadius: "10px", padding: "10px 12px", marginBottom: "12px" } },
				h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", paddingBottom: "8px" } },
					h("span", { style: { fontWeight: 600, fontSize: "13px" } }, shortTitle(ws)),
					h("span", { style: { fontSize: "12px", opacity: ".6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "340px" } }, dir),
					h("span", { style: { marginLeft: "auto", display: "inline-flex", gap: "6px", alignItems: "center", flexWrap: "wrap" } },
						h("label", { style: { fontSize: "12px", opacity: ".8" } }, tt("branch") + ":"),
						h("select", {
							value: branch,
							onChange: function (e) { setBranch(e.target.value); },
							style: { padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))", background: "transparent", color: "inherit", fontSize: "12px" },
						}, branches.map(function (b) {
							return h("option", { key: b, value: b }, b + (b === current ? " (" + tt("current") + ")" : ""));
						})),
						h("button", { onClick: doCheckout, disabled: !branch || branch === current, style: btnStyle() }, tt("checkout")),
						h("button", { onClick: loadLog, style: btnStyle() }, tt("refresh")))),
				msg ? h("div", { style: { padding: "5px 10px", marginBottom: "6px", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--dsw-alias-accent, #4d6bfe) 45%, transparent)", fontSize: "12px", maxWidth: "720px" } }, msg) : null,
				h("input", { value: q, onChange: function (e) { setQ(e.target.value); }, placeholder: tt("search"), style: { width: "100%", boxSizing: "border-box", padding: "4px 8px", marginBottom: "6px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))", background: "transparent", color: "inherit", fontSize: "12px" } }),
				loading ? h("div", { style: { padding: "12px", opacity: ".6", fontSize: "12px" } }, tt("loading"))
					: err ? h("div", { style: { padding: "10px", opacity: ".75", fontSize: "12px", maxWidth: "720px" } }, err)
					: filtered.length === 0
						? h("div", { style: { padding: "12px", opacity: ".55", fontSize: "12px" } }, q ? tt("noMatch") : tt("empty"))
						: h("div", { style: { overflow: "auto", border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.12))", borderRadius: "8px", padding: "4px 0" } },
							filtered.map(function (r) {
								var c = r.commit;
								return h("div", { key: c.hash, style: { display: "flex", alignItems: "center", minHeight: "28px", padding: "2px 8px", fontSize: "12px", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.08))" } },
									h("div", { style: { flex: "none", width: "92px", minWidth: "92px", fontSize: "11px", opacity: ".7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dsw-alias-label-secondary-foreground, inherit)" } }, shortTitle(ws)),
									h("div", { style: { width: (laneCount * laneW) + "px", minWidth: (laneCount * laneW) + "px", height: "28px", position: "relative", flex: "none" } },
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
												position: "absolute", left: (r.lane * laneW + laneW / 2 - 5) + "px", top: "8px",
												width: "10px", height: "10px", borderRadius: "50%",
												background: "var(--dsw-alias-accent, #4d6bfe)",
												border: "2px solid var(--dsw-alias-surface-raised, #1a1f38)",
												boxShadow: "0 0 0 1px rgba(128,128,128,.35)",
											},
										}),
										(c.parents || []).length > 1 ? h("div", {
											style: {
												position: "absolute", left: (r.lane * laneW + laneW / 2) + "px", top: "13px",
												width: ((Math.max.apply(null, r.next.map(function (hash, li) { return li; }).concat([r.lane]))) * laneW + laneW / 2 - (r.lane * laneW + laneW / 2)) + "px",
												height: "2px", background: "rgba(128,128,128,.5)",
											},
										}) : null),
									h("div", { style: { flex: "none", fontFamily: "Consolas, monospace", color: "var(--dsw-alias-state-warning-primary, #e3b341)", width: "62px", minWidth: "62px" } }, c.short),
									h("div", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.subject),
									h("div", { style: { flex: "none", fontSize: "11px", opacity: ".6", marginLeft: "10px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
										c.author + " · " + fmtDate(c.date)));
							})));
		}

		// ---- main view ----------------------------------------------------

		function GitGraphView() {
			var wsState = useState([]);
			var workspaces = wsState[0];
			var setWorkspaces = wsState[1];
			var scanState = useState(true);
			var scanning = scanState[0];
			var setScanning = scanState[1];
			var scanErrState = useState("");
			var scanErr = scanErrState[0];
			var setScanErr = scanErrState[1];
			var fallbackState = useState(null);
			var fallback = fallbackState[0];
			var setFallback = fallbackState[1];

			function refresh() {
				setScanning(true);
				setScanErr("");
				listWorkspaces().then(function (items) {
					if (items) {
						items.sort(function (a, b) {
							return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
						});
						// Probe each workspace; keep only those that are git repos.
						var probes = items.map(function (ws) {
							return fetchJson(API + "/api/git/branches?dir=" + encodeURIComponent(ws.path || "")).then(function (m) {
								return (m && m.ok) ? ws : null;
							}).catch(function () { return null; });
						});
						return Promise.all(probes).then(function (gitWs) {
							setWorkspaces(gitWs.filter(function (x) { return x; }));
							setFallback(null);
						});
					}
					setWorkspaces([]);
					// fallback: single section for the configured work dir
					return workDir().then(function (wd) {
						if (!wd) return;
						fetchJson(API + "/api/git/branches?dir=" + encodeURIComponent(wd)).then(function (m) {
							setFallback({ path: wd, title: t("fallbackDir") + " · " + wd });
						}).catch(function () { setFallback({ path: wd, title: t("fallbackDir") + " · " + wd }); });
					});
				}).catch(function () {
					setWorkspaces([]);
				}).finally(function () { setScanning(false); });
			}

			useEffect(function () { refresh(); }, []);

			return h("div", { style: { padding: "16px", display: "flex", flexDirection: "column", height: "100%", minHeight: 0, boxSizing: "border-box", overflow: "auto" } },
				h("div", { style: { display: "flex", alignItems: "center", gap: "8px", paddingBottom: "10px" } },
					h("span", { style: { fontWeight: 600, fontSize: "13px" } }, t("projects")),
					h("button", { onClick: refresh, style: btnStyle() }, t("refresh")),
					h("span", { style: { fontSize: "12px", opacity: ".6" } }, scanning ? t("loadingProjects") : (workspaces.length + " 个工作区"))),
				scanning ? h("div", { style: { padding: "18px", opacity: ".6" } }, t("loadingProjects"))
					: (fallback ? h(ProjectGraph, { ws: fallback, t: t, key: "fallback" })
						: workspaces.length === 0 ? h("div", { style: { padding: "18px", opacity: ".55", fontSize: "13px" } }, t("noProjects"))
						: workspaces.map(function (ws) {
							return h(ProjectGraph, { ws: ws, t: t, key: ws.workspaceId || ws.path });
						})));
		}

		function fmtDate(iso) {
			try {
				var d = new Date(iso);
				return d.toLocaleString();
			} catch (e) { return iso || ""; }
		}

		function btnStyle() {
			return { padding: "3px 10px", fontSize: "12px", borderRadius: "6px", cursor: "pointer", background: "transparent", border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.4))", color: "inherit" };
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
