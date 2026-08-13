// dsh-settings-framework: generic settings framework for DSH client plugins.
//
// Other client plugins can use it (via window.__DSH_SETTINGS__) to:
//   registerTab({ id, label, order })                     -> adds a Settings tab
//   registerItem({ tabId, key, type, label, hint, defaultValue, options })
//                                                         -> adds a setting item
//   get(key) / set(key, value) / subscribe(key, cb)       -> read/write/sync
//
// Persistence backend (v1): the desktop client's local API /api/settings
// (generic key-value store in DshDesktop.exe config.json). Cross-plugin sync
// happens through a local pub/sub plus a periodic refresh of the store.

window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-settings-framework",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;

		var API = "http://127.0.0.1:3980";

		var ctxRef = null;
		var tabs = {};        // id -> { id, label, order }
		var items = [];       // { tabId, key, type, label, hint, defaultValue, options }
		var cache = {};       // key -> string value
		var subs = {};        // key -> Set<callback>
		var itemSubs = [];    // callbacks on item registry change
		var readyResolve = null;
		var ready = new Promise(function (r) { readyResolve = r; });

		function fetchJson(url, options) {
			return fetch(url, options).then(function (r) { return r.json(); });
		}

		function findDefault(key) {
			for (var i = 0; i < items.length; i++) {
				if (items[i].key === key) return items[i].defaultValue;
			}
			return undefined;
		}

		function get(key) {
			if (cache[key] !== undefined) return cache[key];
			return findDefault(key);
		}

		function set(key, value) {
			var v = value === undefined || value === null ? "" : String(value);
			cache[key] = v;
			emit(key);
			return fetchJson(API + "/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: key, value: v }),
			}).then(function (m) {
				cache = m || cache;
				Object.keys(subs).forEach(function (k) { emit(k); });
			}).catch(function () { });
		}

		function subscribe(key, cb) {
			if (!subs[key]) subs[key] = new Set();
			subs[key].add(cb);
			return function () { if (subs[key]) subs[key].delete(cb); };
		}

		function emit(key) {
			var s = subs[key];
			if (!s) return;
			s.forEach(function (cb) { try { cb(get(key)); } catch (e) { } });
		}

		function bumpItems() {
			itemSubs.forEach(function (cb) { try { cb(); } catch (e) { } });
		}

		function refresh() {
			return fetchJson(API + "/api/settings").then(function (m) {
				cache = m || {};
				Object.keys(subs).forEach(function (k) { emit(k); });
			}).catch(function () { });
		}

		// ---- declarative registration ------------------------------------

		function registerTab(opt) {
			if (!opt || !opt.id) return;
			tabs[opt.id] = { id: opt.id, label: opt.label || opt.id, order: opt.order || 50 };
			var labelThunk = typeof opt.label === "function" ? opt.label : function () { return opt.label || opt.id; };
			var TabComp = function () { return TabShellView({ tabId: opt.id }); };
			ctxRef.slots.inject("settings.section", function () {
				return ctxRef.slots.register({
					name: "settings.section",
					id: opt.id,
					order: opt.order || 50,
					label: labelThunk,
				}, TabComp);
			});
		}

		function registerItem(opt) {
			if (!opt || !opt.key) return;
			items.push({
				tabId: opt.tabId,
				key: opt.key,
				type: opt.type || "toggle",
				label: opt.label || opt.key,
				hint: opt.hint || "",
				defaultValue: opt.defaultValue,
				options: opt.options || [],
			});
			if (cache[opt.key] === undefined && opt.defaultValue !== undefined) {
				cache[opt.key] = String(opt.defaultValue);
			}
			bumpItems();
		}

		// ---- rendering ---------------------------------------------------

		function renderControl(item, onChange) {
			var value = get(item.key);
			if (value === undefined) value = "";
			if (item.type === "toggle") {
				return h("input", { type: "checkbox", checked: value === "true" || value === "1", onChange: function (e) { onChange(e.target.checked); } });
			}
			if (item.type === "select") {
				return h("select", { value: value, onChange: function (e) { onChange(e.target.value); }, style: { padding: "4px 8px" } },
					item.options.map(function (o) {
						return h("option", { key: String(o.value), value: String(o.value) }, o.label || String(o.value));
					}));
			}
			if (item.type === "number") {
				return h("input", { type: "number", value: value, style: { padding: "4px 8px" }, onChange: function (e) { onChange(e.target.value); } });
			}
			// default: text
			return h("input", { type: "text", value: value, style: { padding: "4px 8px" }, onChange: function (e) { onChange(e.target.value); } });
		}

		function ItemRow(props) {
			var item = props.item;
			return h("label", {
				style: {
					display: "flex", justifyContent: "space-between", alignItems: "center",
					gap: "16px", padding: "8px 0", cursor: "pointer",
				},
			}, h("span", { style: { lineHeight: "1.4" } }, item.label), renderControl(item, function (v) { set(item.key, v); }));
		}

		function TabShellView(props) {
			var tabId = props.tabId;
			var revState = useState(0);
			var rev = revState[0];
			var setRev = revState[1];

			useEffect(function () {
				var offs = [];
				items.forEach(function (it) {
					if (it.tabId === tabId) offs.push(subscribe(it.key, function () { setRev(function (v) { return v + 1; }); }));
				});
				var onItems = function () { setRev(function (v) { return v + 1; }); };
				itemSubs.push(onItems);
				var timer = setInterval(function () { refresh(); }, 3000);
				return function () {
					offs.forEach(function (f) { try { f(); } catch (e) { } });
					var idx = itemSubs.indexOf(onItems);
					if (idx >= 0) itemSubs.splice(idx, 1);
					clearInterval(timer);
				};
			}, []);

			var myItems = items.filter(function (it) { return it.tabId === tabId; });
			if (myItems.length === 0) {
				return h("div", { style: { padding: "16px", opacity: ".6" } }, "No settings items registered for this tab.");
			}
			return h("div", { style: { padding: "16px", maxWidth: "640px" } },
				myItems.map(function (it) {
					return h("div", { key: it.key },
						ItemRow({ item: it }),
						it.hint ? h("div", { style: { fontSize: "12px", opacity: ".75", padding: "0 0 4px" } }, it.hint) : null);
				}));
		}

		// ---- plugin apply -------------------------------------------------

		function apply(ctx) {
			ctxRef = ctx;
			window.__DSH_SETTINGS__ = {
				ready: ready,
				registerTab: registerTab,
				registerItem: registerItem,
				get: get,
				set: set,
				subscribe: subscribe,
			};
			refresh().finally(function () { if (readyResolve) readyResolve(); });
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});