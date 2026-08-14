// dsh-live-stats: real-time token statistics for each completed turn in the
// DSH Web UI. Renders a compact stats line under each turn (via the
// conversation.chat.turnTail chain): TPS, LLM wall time, input/output tokens,
// and cache-hit tokens when the provider reports them.

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-live-stats",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;

		var NS = "liveStats";

		var dict = {
			zh: {
				label: "本轮用量",
				tps: "TPS",
				time: "耗时",
				inTokens: "输入",
				outTokens: "输出",
				cache: "缓存命中",
				noData: "本轮暂无用量数据",
			},
			en: {
				label: "This turn",
				tps: "TPS",
				time: "time",
				inTokens: "in",
				outTokens: "out",
				cache: "cache",
				noData: "No usage data for this turn",
			},
		};
		var t = null;

		// Probe common provider usage shapes (OpenAI-style snake_case and
		// DSH's normalized camelCase) defensively.
		function probeUsage(u) {
			if (!u || typeof u !== "object") return null;
			var out = num(u.outputTokens, u.completion_tokens, u.completionTokens);
			var inp = num(u.inputTokens, u.prompt_tokens, u.promptTokens);
			var cache = num(u.cacheReadInputTokens, u.prompt_cache_hit_tokens, u.cacheReadTokens);
			if (out === null && inp === null && cache === null) return null;
			return { in: inp, out: out, cache: cache };
		}

		function num() {
			for (var i = 0; i < arguments.length; i++) {
				var v = arguments[i];
				if (typeof v === "number" && isFinite(v) && v >= 0) return v;
			}
			return null;
		}

		function fmtTokens(n) {
			if (n === null || n === undefined) return "—";
			if (n >= 1000) return (n / 1000).toFixed(1) + "k";
			return String(n);
		}

		function fmtMs(ms) {
			if (ms === null || ms === undefined) return "—";
			if (ms < 1000) return Math.round(ms) + "ms";
			return (ms / 1000).toFixed(1) + "s";
		}

		function LiveStatsTail(props) {
			var matched = props.matched;
			var useSession = props.useSession;
			var nodes = useSession(function (snap) { return (snap && snap.nodes) || []; });

			var turn = matched && matched.turn;
			var step = null;
			var decodeMs = 0;
			var outTokens = 0;
			var sampled = false;
			var inputTokens = null;
			var cacheTokens = null;

			for (var i = 0; i < nodes.length; i++) {
				var n = nodes[i];
				if (n.kind !== "assistant" || n.turn !== turn) continue;
				var timing = n.timing;
				if (timing && timing.stepStartTime !== null && timing.firstTokenTime !== null) {
					var ttft = Math.max(0, timing.firstTokenTime - timing.stepStartTime);
					if (step === null || n.step < step) { step = n.step; }
				}
				if (timing && timing.firstTokenTime !== null && timing.completedTime !== null) {
					var dm = Math.max(0, timing.completedTime - timing.firstTokenTime);
					var u = probeUsage(n.usage);
					if (dm > 0 && u && u.out !== null) {
						decodeMs += dm;
						outTokens += u.out;
						sampled = true;
					}
					if (u) {
						if (u.in !== null) inputTokens = (inputTokens === null ? 0 : inputTokens) + u.in;
						if (u.cache !== null) cacheTokens = (cacheTokens === null ? 0 : cacheTokens) + u.cache;
					}
				}
			}

			if (!sampled) {
				return h("div", { style: { fontSize: "12px", opacity: ".6", padding: "4px 2px" } }, t("noData"));
			}

			var tps = decodeMs > 0 ? outTokens / (decodeMs / 1000) : null;
			var chips = [];
			if (tps !== null) chips.push({ k: t("tps"), v: tps.toFixed(1) });
			if (decodeMs > 0) chips.push({ k: t("time"), v: fmtMs(decodeMs) });
			if (inputTokens !== null) chips.push({ k: t("inTokens"), v: fmtTokens(inputTokens) });
			chips.push({ k: t("outTokens"), v: fmtTokens(outTokens) });
			if (cacheTokens !== null) chips.push({ k: t("cache"), v: fmtTokens(cacheTokens) });

			return h("div", {
				style: {
					display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
					fontSize: "12px", opacity: ".8", padding: "4px 2px 0",
				},
			},
				h("span", { style: { opacity: ".65", fontWeight: 600 } }, t("label")),
				chips.map(function (c, i) {
					return h("span", { key: c.k, style: { display: "inline-flex", gap: "4px", alignItems: "center" } },
						h("span", { style: { opacity: ".6" } }, c.k + ":"),
						h("span", { style: { fontFamily: "Consolas, monospace", color: "var(--dsw-alias-state-success-primary, #7ee787)" } }, c.v));
				}));
		}

		function apply(ctx) {
			ctx.effect(function () {
				return ctx.locale.register(NS, dict);
			}, "live-stats: dictionaries");
			t = ctx.locale.bind(NS);

			ctx.slots.inject("conversation.chat.turnTail", function () {
				return ctx.slots.register({
					name: "conversation.chat.turnTail",
					id: "live-stats",
					select: function (owner) { return { turn: owner.turn }; },
					priority: 20,
				}, LiveStatsTail);
			});
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});