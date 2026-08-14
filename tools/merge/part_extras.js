// dsh-desktop-framework extras: open-mode settings, multi-type viewers,
// conversation link-ification with chooser/context menu, and a WebGL
// STL/OBJ model viewer. All client-side, plugin-only.
function applyDesktopExtras(ctx) {
    var React = require("react");
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;

    var API = "http://127.0.0.1:3980";
    var NS = "desktopExtras";
    var t = null;

    var dict = {
        zh: {
            nav: "文件打开", hint: "选择每类文件优先的打开方式",
            ask: "每次询问", desktop: "桌面端打开", system: "系统默认应用", copy: "复制链接",
            image: "图片", video: "视频", pdf: "PDF", markdown: "Markdown", code: "代码",
            text: "文本", model3d: "3D 模型", web: "网页链接", other: "其他文件",
            chooseOpen: "选择打开方式", openSystem: "系统默认应用打开", openDesktop: "在桌面端打开", copyOk: "已复制",
            loading: "加载中…", failed: "加载失败", unsupported: "不支持的查看类型",
            reset: "复位",
        },
        en: {
            nav: "Open files", hint: "Choose the preferred open mode per file type",
            ask: "Ask each time", desktop: "Open in desktop", system: "System default app", copy: "Copy link",
            image: "Image", video: "Video", pdf: "PDF", markdown: "Markdown", code: "Code",
            text: "Text", model3d: "3D Model", web: "Web link", other: "Other files",
            chooseOpen: "Choose how to open", openSystem: "Open with system default", openDesktop: "Open in desktop", copyOk: "Copied",
            loading: "Loading…", failed: "Failed to load", unsupported: "Unsupported viewer type",
            reset: "Reset",
        },
    };

    function fetchJson(url, options) {
        return fetch(url, options).then(function (r) { return r.json(); });
    }

    // ---- file type classification -----------------------------------------
    var TYPE_MAP = {
        image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"],
        video: ["mp4", "webm", "mov", "mkv", "avi", "m4v", "ogv"],
        pdf: ["pdf"],
        markdown: ["md", "markdown", "mdown"],
        code: ["js", "ts", "tsx", "jsx", "mjs", "cjs", "py", "java", "c", "h", "cpp", "hpp", "cc", "cs", "go", "rs", "rb", "php", "swift", "kt", "sql", "html", "htm", "css", "scss", "less", "json", "yaml", "yml", "toml", "xml", "sh", "ps1", "bat", "cmd", "vue", "svelte", "astro", "dockerfile", "makefile", "gradle"],
        text: ["txt", "log", "ini", "cfg", "conf", "csv", "tsv", "env", "gitignore", "editorconfig", "license", "readme"],
        model3d: ["stl", "obj", "glb", "gltf", "ply", "off"],
    };
    function extOf(name) {
        var n = String(name || "").toLowerCase();
        var i = n.lastIndexOf(".");
        if (i < 0 || i === n.length - 1) return "";
        return n.substring(i + 1);
    }
    function kindOf(name) {
        var e = extOf(name);
        for (var k in TYPE_MAP) if (TYPE_MAP[k].indexOf(e) >= 0) return k;
        return e === "" ? "unknown" : "other";
    }
    function modeOf(kind) {
        var sf = window.__DSH_SETTINGS__;
        var v = sf ? sf.get("openMode_" + kind) : undefined;
        return v === "system" || v === "desktop" ? v : "ask";
    }

    function openSystemPath(path) {
        return fetchJson(API + "/api/fs/open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: path }),
        });
    }
    function openSystemUrl(url) {
        return fetchJson(API + "/api/fs/open-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url }),
        });
    }
    function copyText(s) {
        try { navigator.clipboard.writeText(s); } catch (e) { }
    }    // ---- chooser / context menu -------------------------------------------
    var menuEl = null;
    function showMenu(items, x, y) {
        hideMenu();
        menuEl = document.createElement("div");
        menuEl.className = "dsh-open-menu";
        menuEl.style.left = x + "px";
        menuEl.style.top = y + "px";
        items.forEach(function (it) {
            var b = document.createElement("button");
            b.textContent = it.label;
            b.className = "dsh-open-menu-item";
            b.onclick = function () { hideMenu(); it.action(); };
            menuEl.appendChild(b);
        });
        document.body.appendChild(menuEl);
        setTimeout(function () {
            document.addEventListener("mousedown", onDocDown, { once: true });
        }, 0);
    }
    function onDocDown() { hideMenu(); }
    function hideMenu() {
        if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
        menuEl = null;
    }

    function openResource(res, x, y) {
        var isUrl = !!res.url;
        var name = res.name || (res.url ? res.url : "");
        var kind = res.kind || (isUrl ? "web" : kindOf(name));
        var mode = modeOf(kind);
        if (mode === "system") {
            if (isUrl) openSystemUrl(res.url); else openSystemPath(res.path);
            return;
        }
        if (mode === "desktop") {
            if (isUrl) openWeb(res.url); else openViewer(res, kind);
            return;
        }
        showMenu([
            { label: t("openDesktop"), action: function () { if (isUrl) openWeb(res.url); else openViewer(res, kind); } },
            { label: t("openSystem"), action: function () { if (isUrl) openSystemUrl(res.url); else openSystemPath(res.path); } },
            { label: t("copy"), action: function () { copyText(isUrl ? res.url : res.path); } },
        ], x, y);
    }

    // ---- viewers -----------------------------------------------------------
    var viewerSeq = 0;
    function addViewerTab(label, render) {
        var P = window.__DSH_PANELS__;
        if (!P) return null;
        viewerSeq++;
        var id = "viewer-" + viewerSeq;
        P.addTab("right", {
            id: id,
            label: label,
            order: 80,
            closable: true,
            activate: true,
            render: render,
        });
        P.open("right");
        return id;
    }
    function openViewer(res, kind) {
        var name = res.name || "viewer";
        var label = name.length > 22 ? name.slice(0, 22) + "…" : name;
        var keyRes = { path: res.path, url: res.url, name: name };
        var kindNow = kind || kindOf(name);
        addViewerTab(label, function () { return h(ViewerTab, { key: "v" + viewerSeq, kind: kindNow, res: keyRes }); });
    }
    function openWeb(url) {
        var label = url.length > 22 ? url.slice(0, 22) + "…" : url;
        var keyRes = { url: url, name: url };
        addViewerTab(label, function () { return h(ViewerTab, { key: "v" + viewerSeq, kind: "web", res: keyRes }); });
    }    // ---- markdown renderer (compact, GitHub-ish) ---------------------------
    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function inlineMd(s) {
        s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
        s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" class="dsh-md-img" />');
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="dsh-md-link">$1</a>');
        s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
        s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,!?]|$)/g, "$1<em>$2</em>");
        return s;
    }
    function renderMarkdown(md) {
        if (!md) return "";
        var lines = String(md).replace(/\r\n/g, "\n").split("\n");
        var out = [];
        var i = 0, n = lines.length;
        var inCode = false, codeBuf = [];
        var inTable = false, tableBuf = [];
        function flushTable() {
            if (!tableBuf.length) return;
            var rows = tableBuf.map(function (r) { return r.split("|").map(function (c) { return c.trim(); }); });
            var header = rows[0] || [];
            var html = "<table class=\"dsh-md-table\"><thead><tr>" + header.map(function (c) { return "<th>" + inlineMd(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
            for (var r = 1; r < rows.length; r++) {
                html += "<tr>" + rows[r].map(function (c) { return "<td>" + inlineMd(c) + "</td>"; }).join("") + "</tr>";
            }
            html += "</tbody></table>";
            out.push(html);
            tableBuf = [];
        }
        for (i = 0; i < n; i++) {
            var line = lines[i];
            var tline = line.trim();
            if (/^```/.test(tline)) {
                if (inCode) {
                    out.push("<pre class=\"dsh-md-pre\"><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
                    codeBuf = []; inCode = false;
                } else {
                    flushTable(); inCode = true;
                }
                continue;
            }
            if (inCode) { codeBuf.push(line); continue; }
            if (/^\|/.test(tline) && /\|$/.test(tline)) {
                if (!inTable) { flushTable(); inTable = true; tableBuf = []; }
                tableBuf.push(tline);
                continue;
            }
            if (inTable && tline === "") { flushTable(); inTable = false; continue; }
            if (inTable) { flushTable(); inTable = false; }
            if (tline === "") { continue; }
            if (/^#{1,6}\s/.test(tline)) {
                var m = tline.match(/^(#{1,6})\s+(.*)$/);
                var lv = m[1].length;
                out.push("<h" + lv + " class=\"dsh-md-h\">" + inlineMd(m[2]) + "</h" + lv + ">");
                continue;
            }
            if (/^(-{3,}|\*{3,}|_{3,})$/.test(tline)) { out.push("<hr class=\"dsh-md-hr\" />"); continue; }
            if (/^&gt;\s?/.test(tline)) { out.push("<blockquote class=\"dsh-md-bq\">" + inlineMd(tline.replace(/^&gt;\s?/, "")) + "</blockquote>"); continue; }
            if (/^[-*+]\s+/.test(tline)) { out.push("<li class=\"dsh-md-li\">" + inlineMd(tline.replace(/^[-*+]\s+/, "")) + "</li>"); continue; }
            if (/^\d+\.\s+/.test(tline)) { out.push("<li class=\"dsh-md-li\">" + inlineMd(tline.replace(/^\d+\.\s+/, "")) + "</li>"); continue; }
            out.push("<p class=\"dsh-md-p\">" + inlineMd(tline) + "</p>");
        }
        if (inCode) out.push("<pre class=\"dsh-md-pre\"><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
        flushTable();
        return out.join("\n");
    }    // ---- viewer components ------------------------------------------------
    function ViewerTab(props) {
        var kind = props.kind;
        var res = props.res;
        var st = useState({ loading: true, error: "", text: "", dataUrl: "", objectUrl: "", src: "" });
        var state = st[0];
        var setState = st[1];
        var key = res.path || res.url || "";

        useEffect(function () {
            var cancelled = false;
            setState({ loading: true, error: "", text: "", dataUrl: "", objectUrl: "", src: "" });
            if (kind === "web") {
                setState({ loading: false, error: "", text: "", dataUrl: "", objectUrl: "", src: res.url });
                return;
            }
            if (!res.path) { setState({ loading: false, error: "no path", text: "", dataUrl: "", objectUrl: "", src: "" }); return; }
            if (kind === "video" || kind === "pdf" || kind === "model3d") {
                fetch(API + "/api/fs/raw?path=" + encodeURIComponent(res.path))
                    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.blob(); })
                    .then(function (b) {
                        if (cancelled) return;
                        var url = URL.createObjectURL(b);
                        setState({ loading: false, error: "", text: "", dataUrl: "", objectUrl: url, src: url });
                    })
                    .catch(function () { if (!cancelled) setState({ loading: false, error: "load failed", text: "", dataUrl: "", objectUrl: "", src: "" }); });
                return;
            }
            fetchJson(API + "/api/fs/read?path=" + encodeURIComponent(res.path))
                .then(function (m) {
                    if (cancelled) return;
                    if (!m || m.ok === false) { setState({ loading: false, error: (m && m.error) || "load failed", text: "", dataUrl: "", objectUrl: "", src: "" }); return; }
                    if (m.kind === "image") setState({ loading: false, error: "", text: "", dataUrl: m.content || "", objectUrl: "", src: m.content || "" });
                    else setState({ loading: false, error: "", text: m.content || "", dataUrl: "", objectUrl: "", src: "" });
                })
                .catch(function () { if (!cancelled) setState({ loading: false, error: "load failed", text: "", dataUrl: "", objectUrl: "", src: "" }); });
            return function () {
                cancelled = true;
                if (state.objectUrl) { try { URL.revokeObjectURL(state.objectUrl); } catch (e) { } }
            };
        }, [kind, key]);

        if (state.loading) return h("div", { className: "dsh-viewer-status" }, t("loading"));
        if (state.error) {
            return h("div", { className: "dsh-viewer-status" },
                h("div", {}, t("failed") + (state.error ? ": " + state.error : "")),
                res.path ? h("button", { className: "dsh-viewer-action", onClick: function () { openSystemPath(res.path); } }, t("system")) : null);
        }
        if (kind === "markdown") {
            return h("div", { className: "dsh-viewer dsh-md" },
                h("div", { className: "dsh-md-body", dangerouslySetInnerHTML: { __html: renderMarkdown(state.text) } }));
        }
        if (kind === "code" || kind === "text" || kind === "other" || kind === "unknown") {
            return h("div", { className: "dsh-viewer" },
                h("pre", { className: "dsh-viewer-pre" }, state.text || ""));
        }
        if (kind === "image") return h(ImageViewer, { src: state.src });
        if (kind === "video") {
            return h("div", { className: "dsh-viewer dsh-viewer-media" },
                state.src ? h("video", { src: state.src, controls: true, autoPlay: false, className: "dsh-viewer-video" }) : null);
        }
        if (kind === "pdf") {
            return h("div", { className: "dsh-viewer dsh-viewer-media" },
                state.src ? h("iframe", { src: state.src, className: "dsh-viewer-frame", title: res.name || "pdf" }) : null);
        }
        if (kind === "web") {
            return h("div", { className: "dsh-viewer dsh-viewer-media" },
                h("iframe", { src: res.url, className: "dsh-viewer-frame", title: res.name || "web" }));
        }
        if (kind === "model3d") return h(ModelViewer, { res: res });
        return h("div", { className: "dsh-viewer-status" }, t("unsupported"));
    }

    function ImageViewer(props) {
        var st = useState({ zoom: 1, fit: true });
        var s = st[0]; var set = st[1];
        function zoomBy(f) {
            set(function (old) {
                var z = Math.max(0.1, Math.min(8, old.zoom * f));
                return { zoom: z, fit: z === 1 };
            });
        }
        return h("div", { className: "dsh-viewer dsh-viewer-image" },
            h("div", { className: "dsh-viewer-toolbar" },
                h("button", { className: "dsh-viewer-action", onClick: function () { zoomBy(1.25); } }, "+"),
                h("button", { className: "dsh-viewer-action", onClick: function () { zoomBy(0.8); } }, "-"),
                h("button", { className: "dsh-viewer-action", onClick: function () { set({ zoom: 1, fit: true }); } }, t("reset"))),
            h("div", { className: "dsh-viewer-image-stage" },
                h("img", {
                    src: props.src,
                    className: "dsh-viewer-image-img",
                    style: {
                        transform: "scale(" + s.zoom + ")",
                        maxWidth: s.fit ? "100%" : "none",
                        maxHeight: s.fit ? "100%" : "none",
                    },
                    draggable: false,
                })));
    }    // ---- WebGL model viewer (STL/OBJ) -------------------------------------
    function parseModel(buf, name) {
        var dv = new DataView(buf);
        var ext = extOf(name);
        var verts = [];
        function pushTri(a, b, c) {
            verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        }
        if (ext === "stl") {
            if (buf.byteLength > 84 && dv.getUint32(80, true) * 50 + 84 === buf.byteLength) {
                var count = dv.getUint32(80, true);
                for (var i = 0; i < count; i++) {
                    var o = 84 + i * 50;
                    var a = [dv.getFloat32(o + 12, true), dv.getFloat32(o + 16, true), dv.getFloat32(o + 20, true)];
                    var b = [dv.getFloat32(o + 24, true), dv.getFloat32(o + 28, true), dv.getFloat32(o + 32, true)];
                    var c = [dv.getFloat32(o + 36, true), dv.getFloat32(o + 40, true), dv.getFloat32(o + 44, true)];
                    pushTri(a, b, c);
                }
            } else {
                var text = new TextDecoder().decode(buf);
                var re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
                var m, tri = [];
                while ((m = re.exec(text)) !== null) {
                    tri.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
                    if (tri.length === 3) { pushTri(tri[0], tri[1], tri[2]); tri = []; }
                }
            }
        } else if (ext === "obj") {
            var t2 = new TextDecoder().decode(buf);
            var vv = [];
            t2.split(/\r?\n/).forEach(function (ln) {
                var p = ln.trim().split(/\s+/);
                if (p[0] === "v" && p.length >= 4) vv.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
                else if (p[0] === "f" && p.length >= 4) {
                    var idx = [];
                    for (var k = 1; k < p.length; k++) {
                        var pi = p[k].split("/")[0];
                        var vi = parseInt(pi, 10);
                        if (vi > 0) idx.push(vi - 1); else if (vi < 0) idx.push(vv.length + vi);
                    }
                    for (var j = 1; j + 1 < idx.length; j++) pushTri(vv[idx[0]], vv[idx[j]], vv[idx[j + 1]]);
                }
            });
        }
        if (verts.length < 9) return null;
        var minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
        for (var i = 0; i < verts.length; i += 3) {
            if (verts[i] < minX) minX = verts[i]; if (verts[i] > maxX) maxX = verts[i];
            if (verts[i + 1] < minY) minY = verts[i + 1]; if (verts[i + 1] > maxY) maxY = verts[i + 1];
            if (verts[i + 2] < minZ) minZ = verts[i + 2]; if (verts[i + 2] > maxZ) maxZ = verts[i + 2];
        }
        var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
        var r = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2;
        if (r <= 0) r = 1;
        var arr = new Float32Array(verts.length);
        for (var i = 0; i < verts.length; i += 3) {
            arr[i] = (verts[i] - cx) / r;
            arr[i + 1] = (verts[i + 1] - cy) / r;
            arr[i + 2] = (verts[i + 2] - cz) / r;
        }
        return arr;
    }

    function startModelRenderer(gl, verts) {
        var vs = "attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uProj;uniform mat4 uView;uniform vec3 uLight;varying vec3 vNor;varying vec3 vPos;void main(){vNor=aNor;vPos=aPos;gl_Position=uProj*uView*vec4(aPos,1.0);}";
        var fs = "precision mediump float;varying vec3 vNor;varying vec3 vPos;uniform vec3 uColor;void main(){vec3 n=normalize(vNor);vec3 l=normalize(uLight);float d=max(dot(n,l),0.0);float a=0.35;float s=pow(max(dot(reflect(-l,n),normalize(-vPos)),0.0),24.0);vec3 c=uColor*(a+d*0.85)+vec3(1.0)*s*0.5;gl_FragColor=vec4(c,1.0);}";
        function sh(type, src) {
            var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        }
        var prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        gl.useProgram(prog);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        var aPos = gl.getAttribLocation(prog, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
        var normals = new Float32Array(verts.length);
        for (var i = 0; i < verts.length; i += 9) {
            var ax = verts[i], ay = verts[i + 1], az = verts[i + 2];
            var bx = verts[i + 3], by = verts[i + 4], bz = verts[i + 5];
            var cx = verts[i + 6], cy = verts[i + 7], cz = verts[i + 8];
            var ux = bx - ax, uy = by - ay, uz = bz - az;
            var vx = cx - ax, vy = cy - ay, vz = cz - az;
            var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            for (var j = 0; j < 3; j++) { normals[i + j * 3] = nx / len; normals[i + j * 3 + 1] = ny / len; normals[i + j * 3 + 2] = nz / len; }
        }
        var nb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nb);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        var aNor = gl.getAttribLocation(prog, "aNor");
        gl.enableVertexAttribArray(aNor);
        gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 24, 0);
        var uProj = gl.getUniformLocation(prog, "uProj");
        var uView = gl.getUniformLocation(prog, "uView");
        var uLight = gl.getUniformLocation(prog, "uLight");
        var uColor = gl.getUniformLocation(prog, "uColor");
        gl.uniform3f(uLight, 0.5, 0.8, 1.0);
        gl.uniform3f(uColor, 0.42, 0.56, 0.95);
        var rotX = -0.5, rotY = 0.6, dist = 3.2;
        var count = verts.length / 3;
        var drag = null;
        var canvas = gl.canvas;
        function resize() {
            var w = canvas.clientWidth, hgt = canvas.clientHeight;
            if (w === 0 || hgt === 0) return;
            if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
            gl.viewport(0, 0, w, hgt);
            gl.uniformMatrix4fv(uProj, false, persp(0.9, w / (hgt || 1), 0.1, 20));
        }
        function persp(fov, aspect, near, far) {
            var f = 1 / Math.tan(fov / 2);
            var m = new Float32Array(16);
            m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = (2 * far * near) / (near - far);
            return m;
        }
        function view() {
            var m = new Float32Array(16);
            var cx = Math.cos(rotY), sx = Math.sin(rotY), cy = Math.cos(rotX), sy = Math.sin(rotX);
            var r = new Float32Array(16);
            r[0] = cx; r[2] = -sx; r[8] = sx; r[10] = cx; r[5] = 1; r[15] = 1;
            var rx = new Float32Array(16);
            rx[5] = cy; rx[6] = sy; rx[9] = -sy; rx[10] = cy; rx[0] = 1; rx[15] = 1;
            for (var col = 0; col < 4; col++) for (var row = 0; row < 4; row++) {
                var sum = 0;
                for (var k = 0; k < 4; k++) sum += r[k * 4 + row] * rx[col * 4 + k];
                m[col * 4 + row] = sum;
            }
            m[14] = -dist;
            m[15] = 1;
            return m;
        }
        function draw() {
            resize();
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.uniformMatrix4fv(uView, false, view());
            gl.drawArrays(gl.TRIANGLES, 0, count);
        }
        canvas.addEventListener("mousedown", function (e) {
            drag = { x: e.clientX, y: e.clientY };
            if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        });
        window.addEventListener("mousemove", function (e) {
            if (!drag) return;
            rotY += (e.clientX - drag.x) * 0.01;
            rotX += (e.clientY - drag.y) * 0.01;
            drag = { x: e.clientX, y: e.clientY };
            draw();
        });
        window.addEventListener("mouseup", function () { drag = null; });
        canvas.addEventListener("wheel", function (e) {
            e.preventDefault();
            dist = Math.max(1.2, Math.min(12, dist + e.deltaY * 0.003));
            draw();
        }, { passive: false });
        window.addEventListener("resize", draw);
        draw();
    }

    function ModelViewer(props) {
        var ref = useRef(null);
        var st = useState({ error: "" });
        var setState = st[1];
        useEffect(function () {
            var el = ref.current;
            if (!el) return;
            var gl = el.getContext("webgl");
            if (!gl) { setState({ error: "WebGL unavailable" }); return; }
            var cancelled = false;
            fetch(API + "/api/fs/raw?path=" + encodeURIComponent(props.res.path))
                .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.arrayBuffer(); })
                .then(function (buf) {
                    if (cancelled) return;
                    var geo = parseModel(buf, props.res.name);
                    if (!geo) { setState({ error: "unsupported model" }); return; }
                    startModelRenderer(gl, geo);
                })
                .catch(function () { if (!cancelled) setState({ error: "load failed" }); });
            return function () { cancelled = true; };
        }, [props.res.path]);
        return h("div", { className: "dsh-viewer dsh-viewer-model" },
            h("canvas", { ref: ref, className: "dsh-viewer-model-canvas" }),
            st[0].error ? h("div", { className: "dsh-viewer-status" }, st[0].error) : null);
    }    // ---- settings registration --------------------------------------------
    function registerSettings() {
        var sf = window.__DSH_SETTINGS__;
        if (!sf) return;
        var kinds = ["image", "video", "pdf", "markdown", "code", "text", "model3d", "web", "other"];
        var opts = [
            { value: "ask", label: t("ask") },
            { value: "desktop", label: t("desktop") },
            { value: "system", label: t("system") },
        ];
        sf.registerTab({ id: "fileOpen", label: function () { return t("nav"); }, order: 95 });
        kinds.forEach(function (k) {
            sf.registerItem({
                tabId: "fileOpen",
                key: "openMode_" + k,
                type: "select",
                label: t(k),
                hint: t("hint"),
                defaultValue: "ask",
                options: opts,
            });
        });
    }

    // ---- link-ification ---------------------------------------------------
    var LINK_RE = /(https?:\/\/[^\s<>"'()]+|(?:[A-Za-z]:[\\/][^\s<>"']+))/g;
    function isLinkableParent(node) {
        if (!node) return false;
        var tag = node.tagName ? node.tagName.toLowerCase() : "";
        if (tag === "a" || tag === "pre" || tag === "code" || tag === "button" || tag === "textarea" || tag === "input" || tag === "select") return false;
        if (node.closest && node.closest(".dsh-panel-right, .dsh-panel-bottom, .dsh-open-menu, .dsh-panel-rail-right, .dsh-panel-rail-bottom, pre, code, a")) return false;
        return true;
    }
    function handleClick(e) {
        var a = e.target && e.target.closest ? e.target.closest("a.dsh-link") : null;
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        var res = { path: a.getAttribute("data-path") || "", url: a.getAttribute("data-url") || "", name: a.getAttribute("data-name") || "" };
        openResource(res, e.clientX, e.clientY);
    }
    function handleCtx(e) {
        var a = e.target && e.target.closest ? e.target.closest("a.dsh-link") : null;
        if (!a) return;
        e.preventDefault();
        var res = { path: a.getAttribute("data-path") || "", url: a.getAttribute("data-url") || "", name: a.getAttribute("data-name") || "" };
        showMenu([
            { label: t("openDesktop"), action: function () { if (res.url) openWeb(res.url); else openViewer(res, res.kind || kindOf(res.name || res.path)); } },
            { label: t("openSystem"), action: function () { if (res.url) openSystemUrl(res.url); else openSystemPath(res.path); } },
            { label: t("copy"), action: function () { copyText(res.url || res.path); } },
        ], e.clientX, e.clientY);
    }
    function linkifyNode(node) {
        if (!node.nodeValue) return;
        LINK_RE.lastIndex = 0;
        if (!LINK_RE.test(node.nodeValue)) return;
        var parent = node.parentElement;
        if (!parent || !isLinkableParent(parent)) return;
        var text = node.nodeValue;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        LINK_RE.lastIndex = 0;
        while ((m = LINK_RE.exec(text)) !== null) {
            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            var token = m[0];
            var isUrl = /^https?:/i.test(token);
            var a = document.createElement("a");
            a.className = "dsh-link";
            a.textContent = token;
            if (isUrl) { a.setAttribute("data-url", token); a.href = token; }
            else {
                a.setAttribute("data-path", token);
                a.setAttribute("data-name", token.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || token);
                a.href = "#";
            }
            frag.appendChild(a);
            last = m.index + token.length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        if (frag.childNodes.length) parent.replaceChild(frag, node);
    }
    function walkTextNodes(root) {
        if (!root) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                return isLinkableParent(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            },
        });
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(linkifyNode);
    }
    function startLinkify() {
        try {
            document.addEventListener("click", handleClick, true);
            document.addEventListener("contextmenu", handleCtx, true);
        } catch (e) { }
        var timer = null;
        try {
            var observer = new MutationObserver(function () {
                if (timer) return;
                timer = setTimeout(function () {
                    timer = null;
                    try { walkTextNodes(document.body); } catch (e) { }
                }, 400);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { }
        setTimeout(function () { try { walkTextNodes(document.body); } catch (e) { } }, 3000);
    }

    // ---- plugin apply -----------------------------------------------------
    function apply(ctx) {
        ctx.effect(function () {
            return ctx.locale.register(NS, dict);
        }, "desktop-extras: dictionaries");
        t = ctx.locale.bind(NS);

        var sfTimer = setInterval(function () {
            if (window.__DSH_SETTINGS__) {
                clearInterval(sfTimer);
                registerSettings();
            }
        }, 300);

        window.__DSH_OPEN__ = {
            openResource: openResource,
            openViewer: openViewer,
            openWeb: openWeb,
            openSystemPath: openSystemPath,
            openSystemUrl: openSystemUrl,
            kindOf: kindOf,
        };

        setTimeout(function () { startLinkify(); }, 2000);
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale"];
    return apply;
}