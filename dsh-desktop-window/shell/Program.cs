using System;
using System.Collections.Generic;
using System.Linq;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Web.Script.Serialization;

namespace DshDesktop
{
    public class Config
    {
        public string closeBehavior = "tray";   // "tray" | "exit"
        public bool autoStart = false;
        public bool notifyOnComplete = true;
        public bool trayHint = false;
        public string desiredSkin = "";
        public string activeSkin = "";
        public string serverWorkDir = "";
        public Dictionary<string, string> settings = new Dictionary<string, string>();
        public int apiPort = 3980;
    }

    static class Program
    {
        public static readonly string AppDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        public static readonly string BaseDir = Directory.GetParent(AppDir).FullName;
        public static readonly string ConfigPath = BaseDir + "\\config.json";

        [STAThread]
        static void Main(string[] args)
        {
            string url = "http://127.0.0.1:3080";
            int width = 1440;
            int height = 900;
            int port = 3080;
            string userData = Program.BaseDir + "\\.wv2-profile";
            string serverWorkDir = "";
            string serverLog = "";
            string serverCmd = "C:\\Program Files\\nodejs\\corepack.cmd";

            for (int i = 0; i < args.Length; i++)
            {
                string a = args[i];
                if (a == "--url" && i + 1 < args.Length) url = args[i + 1];
                else if (a == "--width" && i + 1 < args.Length) { int w; if (int.TryParse(args[i + 1], out w)) width = w; }
                else if (a == "--height" && i + 1 < args.Length) { int h; if (int.TryParse(args[i + 1], out h)) height = h; }
                else if (a == "--port" && i + 1 < args.Length) { int p; if (int.TryParse(args[i + 1], out p) && p > 0 && p < 65536) port = p; }
                else if (a == "--user-data" && i + 1 < args.Length) userData = args[i + 1];
                else if (a == "--workdir" && i + 1 < args.Length) serverWorkDir = args[i + 1];
            }
            if (url == "http://127.0.0.1:3080" && port != 3080) url = "http://127.0.0.1:" + port;

            bool createdNew;
            using (Mutex mutex = new Mutex(true, "Local\\DshDesktopWindow", out createdNew))
            {
                if (!createdNew) return;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm(url, width, height, port, userData, serverWorkDir, serverLog, serverCmd));
            }
        }
    }

    class MainForm : Form
    {
        private WebView2 webView;
        private Label statusLabel;
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;
        private Icon appIcon;
        private string url;
        private string userData;
        private int port;
        private string serverWorkDir;
        private string serverLog;
        private string serverCmd;
        private bool quitRequested = false;
        private bool startedServer = false;
        private int serverPid = 0;
        private Config cfg;
        private HttpServer apiServer;

        public MainForm(string url, int width, int height, int port, string userData,
                        string serverWorkDir, string serverLog, string serverCmd)
        {
            this.url = url;
            this.userData = userData;
            this.port = port;
            this.serverCmd = serverCmd;

            cfg = ConfigStore.Load();
            this.serverWorkDir = string.IsNullOrEmpty(serverWorkDir)
                ? (string.IsNullOrEmpty(cfg.serverWorkDir) ? "D:\\deepseek harness" : cfg.serverWorkDir)
                : serverWorkDir;
            this.serverLog = this.serverWorkDir + "\\dsh-web.log";

            Text = "DeepSeek Harness";
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(width, height);
            MinimizeBox = true;

            appIcon = LoadIcon();
            Icon = appIcon;

            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            Controls.Add(webView);

            statusLabel = new Label();
            statusLabel.Dock = DockStyle.Fill;
            statusLabel.TextAlign = ContentAlignment.MiddleCenter;
            statusLabel.Font = new Font("Microsoft YaHei UI", 15F);
            statusLabel.ForeColor = Color.FromArgb(77, 107, 254);
            statusLabel.Text = "正在启动 DeepSeek Harness 服务…";
            Controls.Add(statusLabel);
            statusLabel.BringToFront();

            SetupTray();
            SyncAutoStart(cfg.autoStart);
            apiServer = new HttpServer(cfg.apiPort, this);
            apiServer.Start();
        }

        private Icon LoadIcon()
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                Stream s = asm.GetManifestResourceStream("DshDesktop.whale.ico");
                if (s != null) return new Icon(s);
            }
            catch
            {
            }
            return SystemIcons.Application;
        }

        private void SetupTray()
        {
            trayMenu = new ContextMenuStrip();
            ToolStripMenuItem openItem = new ToolStripMenuItem("打开 DeepSeek Harness");
            openItem.Click += delegate { ShowWindow(); };
            ToolStripMenuItem exitItem = new ToolStripMenuItem("退出");
            exitItem.Click += delegate { QuitApp(); };
            trayMenu.Items.Add(openItem);
            trayMenu.Items.Add(new ToolStripSeparator());
            trayMenu.Items.Add(exitItem);

            trayIcon = new NotifyIcon();
            trayIcon.Icon = appIcon;
            trayIcon.Text = "DeepSeek Harness";
            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.DoubleClick += delegate { ShowWindow(); };
            trayIcon.Visible = true;
        }

        public void ShowToast(string title, string message)
        {
            try
            {
                string script = Program.AppDir + "\\toast.ps1";
                string toastFile = Program.AppDir + "\\.toast.json";
                if (!File.Exists(script)) { ShowBalloon(title, message); return; }
                JavaScriptSerializer ser = new JavaScriptSerializer();
                ser.MaxJsonLength = int.MaxValue;
                Dictionary<string, string> map = new Dictionary<string, string>();
                map["title"] = title;
                map["message"] = message;
                File.WriteAllText(toastFile, ser.Serialize(map), new System.Text.UTF8Encoding(false));
                string args = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"";
                ProcessStartInfo psi = new ProcessStartInfo("powershell.exe", args);
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process p = Process.Start(psi);
                if (p.WaitForExit(8000) && p.ExitCode == 0) return;
            }
            catch
            {
            }
            ShowBalloon(title, message);
        }

        private static string EscapeArg(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
        public void ShowBalloon(string title, string message)
        {
            try
            {
                if (trayIcon != null) trayIcon.ShowBalloonTip(4000, title, message, ToolTipIcon.Info);
            }
            catch
            {
            }
        }

        private void ShowWindow()
        {
            Show();
            WindowState = FormWindowState.Normal;
            Activate();
        }

        private void QuitApp()
        {
            quitRequested = true;
            StopServerIfOwned();
            trayIcon.Visible = false;
            trayIcon.Dispose();
            Application.Exit();
        }

        private void StopServerIfOwned()
        {
            if (!startedServer || serverPid <= 0) return;
            try
            {
                Process p = new Process();
                p.StartInfo.FileName = "taskkill.exe";
                p.StartInfo.Arguments = "/PID " + serverPid + " /T /F";
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.CreateNoWindow = true;
                p.Start();
                p.WaitForExit(5000);
            }
            catch
            {
            }
        }

        private static readonly string[] KnownKeys = new string[]
        {
            "closeBehavior", "autoStart", "notifyOnComplete", "trayHint",
            "desiredSkin", "activeSkin", "serverWorkDir", "apiPort",
        };

        public Config GetConfig() { return cfg; }



        /// Effective server working directory: config override, else the
        /// resolved (--workdir / default) value stored at startup.
        public string EffectiveWorkDir()
        {
            return string.IsNullOrEmpty(cfg.serverWorkDir) ? this.serverWorkDir : cfg.serverWorkDir;
        }

        /// Merged view for the generic /api/settings endpoint: typed desktop
        /// options plus the plugin key-value map.
        public Dictionary<string, object> GetSettingsView()
        {
            Dictionary<string, object> view = new Dictionary<string, object>();
            view["closeBehavior"] = cfg.closeBehavior;
            view["autoStart"] = cfg.autoStart;
            view["notifyOnComplete"] = cfg.notifyOnComplete;
            view["trayHint"] = cfg.trayHint;
            view["desiredSkin"] = cfg.desiredSkin;
            view["activeSkin"] = cfg.activeSkin;
            view["serverWorkDir"] = EffectiveWorkDir();
            view["apiPort"] = cfg.apiPort;
            foreach (KeyValuePair<string, string> kv in cfg.settings) view[kv.Key] = kv.Value;
            return view;
        }

        /// Generic setter: known typed keys go through UpdateConfig (with side
        /// effects such as registry sync); anything else lands in the map.
        public void SetSetting(string key, string value)
        {
            if (Array.IndexOf(KnownKeys, key) >= 0) UpdateConfig(key, value);
            else { cfg.settings[key] = value; ConfigStore.Save(cfg); }
        }

        public void UpdateConfig(string key, string value)
        {
            if (key == "closeBehavior") cfg.closeBehavior = value;
            else if (key == "autoStart") cfg.autoStart = (value == "true");
            else if (key == "notifyOnComplete") cfg.notifyOnComplete = (value == "true");
            else if (key == "desiredSkin") cfg.desiredSkin = value;
            else if (key == "activeSkin") cfg.activeSkin = value;
            else if (key == "trayHint") cfg.trayHint = (value == "true");
            else if (key == "serverWorkDir") cfg.serverWorkDir = value;
            else cfg.settings[key] = value;
            ConfigStore.Save(cfg);
            if (key == "autoStart") SyncAutoStart(cfg.autoStart);
        }

        private void SyncAutoStart(bool enabled)
        {
            try
            {
                string exe = Assembly.GetExecutingAssembly().Location;
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                {
                    if (key == null) return;
                    if (enabled) key.SetValue("DeepSeek Harness", "\"" + exe + "\"");
                    else key.DeleteValue("DeepSeek Harness", false);
                }
            }
            catch
            {
            }
        }

        protected override async void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            StartServerIfNeeded();
            bool ready = await WaitForServerAsync();
            if (!ready)
            {
                statusLabel.Text = "未能连接到 DeepSeek Harness 服务，请检查服务目录（--workdir）配置。";
                return;
            }
            await LoadWebViewAsync();
        }

        private void StartServerIfNeeded()
        {
            if (IsPortOpen(port)) return;
            try
            {
                string args = "/c cd /d \"" + serverWorkDir + "\" && \"" + serverCmd + "\" pnpm dsh web >> \"" + serverLog + "\" 2>&1";
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = args;
                psi.WorkingDirectory = serverWorkDir;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.EnvironmentVariables["DSH_DESKTOP_AUTO"] = "0";
                Process p = Process.Start(psi);
                startedServer = true;
                serverPid = p.Id;
            }
            catch (Exception ex)
            {
                statusLabel.Text = "服务启动失败: " + ex.Message;
            }
        }

        private async Task<bool> WaitForServerAsync()
        {
            DateTime deadline = DateTime.UtcNow.AddSeconds(180);
            while (DateTime.UtcNow < deadline)
            {
                if (quitRequested) return false;
                if (IsPortOpen(port)) return true;
                await Task.Delay(1000);
            }
            return false;
        }

        private bool IsPortOpen(int port)
        {
            try
            {
                using (TcpClient c = new TcpClient())
                {
                    IAsyncResult ar = c.BeginConnect("127.0.0.1", port, null, null);
                    bool ok = ar.AsyncWaitHandle.WaitOne(400);
                    if (ok)
                    {
                        c.EndConnect(ar);
                        return c.Connected;
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        private async Task LoadWebViewAsync()
        {
            try
            {
                statusLabel.Text = "正在初始化界面…";
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, userData, null);
                await webView.EnsureCoreWebView2Async(env);
                CoreWebView2 core = webView.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.NavigationCompleted += OnNavigationCompleted;
                statusLabel.Visible = false;
                webView.Source = new Uri(url);
            }
            catch (Exception ex)
            {
                statusLabel.Text = "界面初始化失败: " + ex.Message;
            }
        }

        private void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                if (webView.CoreWebView2 != null)
                {
                    string title = webView.CoreWebView2.DocumentTitle;
                    if (!string.IsNullOrEmpty(title)) Text = title;
                }
            }
            catch
            {
            }
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            if (WindowState == FormWindowState.Minimized && !quitRequested)
            {
                Hide();
                if (cfg.trayHint) trayIcon.ShowBalloonTip(1200, "DeepSeek Harness", "已最小化到系统托盘，后台持续运行。", ToolTipIcon.Info);
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!quitRequested)
            {
                if (cfg.closeBehavior == "exit")
                {
                    quitRequested = true;
                    StopServerIfOwned();
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                    base.OnFormClosing(e);
                    return;
                }
                e.Cancel = true;
                Hide();
                if (cfg.trayHint) trayIcon.ShowBalloonTip(1200, "DeepSeek Harness", "已最小化到系统托盘，后台持续运行。", ToolTipIcon.Info);
                return;
            }
            trayIcon.Visible = false;
            trayIcon.Dispose();
            base.OnFormClosing(e);
        }
    }

    static class ConfigStore
    {
        public static Config Load()
        {
            try
            {
                if (File.Exists(Program.ConfigPath))
                {
                    string json = File.ReadAllText(Program.ConfigPath);
                    JavaScriptSerializer ser = new JavaScriptSerializer();
                    Dictionary<string, object> map = ser.Deserialize<Dictionary<string, object>>(json);
                    Config c = new Config();
                    if (map != null)
                    {
                        object v;
                        if (map.TryGetValue("closeBehavior", out v)) c.closeBehavior = Convert.ToString(v);
                        if (map.TryGetValue("autoStart", out v)) c.autoStart = Convert.ToBoolean(v);
                        if (map.TryGetValue("notifyOnComplete", out v)) c.notifyOnComplete = Convert.ToBoolean(v);
                        if (map.TryGetValue("desiredSkin", out v)) c.desiredSkin = Convert.ToString(v);
                        if (map.TryGetValue("activeSkin", out v)) c.activeSkin = Convert.ToString(v);
                        if (map.TryGetValue("trayHint", out v)) c.trayHint = Convert.ToBoolean(v);
                        if (map.TryGetValue("serverWorkDir", out v)) c.serverWorkDir = Convert.ToString(v);
                        if (map.TryGetValue("settings", out v) && v is Dictionary<string, object>) { c.settings = ((Dictionary<string, object>)v).ToDictionary(kv => kv.Key, kv => Convert.ToString(kv.Value)); }
                        if (map.TryGetValue("apiPort", out v)) { int p; if (int.TryParse(Convert.ToString(v), out p)) c.apiPort = p; }
                    }
                    return c;
                }
            }
            catch
            {
            }
            return new Config();
        }

        public static void Save(Config c)
        {
            try
            {
                JavaScriptSerializer ser = new JavaScriptSerializer();
                ser.MaxJsonLength = int.MaxValue;
                string json = ser.Serialize(c);
                File.WriteAllText(Program.ConfigPath, json);
            }
            catch
            {
            }
        }
    }

    class HttpServer
    {
        private int port;
        private MainForm form;
        private TcpListener listener;
        private Thread thread;
        private volatile bool running = true;
        private JavaScriptSerializer ser = new JavaScriptSerializer();
        private string shellCwd = "";

        public HttpServer(int port, MainForm form)
        {
            this.port = port;
            this.form = form;
            try { this.shellCwd = form.EffectiveWorkDir(); } catch { }
        }

        public void Start()
        {
            try
            {
                listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                thread = new Thread(new ThreadStart(Loop));
                thread.IsBackground = true;
                thread.Start();
            }
            catch
            {
                // port busy (e.g., another instance) - ignore
            }
        }

        private void Loop()
        {
            while (running)
            {
                try
                {
                    TcpClient client = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(new WaitCallback(Handle), client);
                }
                catch
                {
                    break;
                }
            }
        }

        private void Handle(object state)
        {
            TcpClient client = (TcpClient)state;
            try
            {
                client.ReceiveTimeout = 5000;
                NetworkStream stream = client.GetStream();
                byte[] buf = new byte[8192];
                StringBuilder head = new StringBuilder();
                byte[] body = null;
                int contentLength = -1;
                bool headerDone = false;
                while (true)
                {
                    int n = stream.Read(buf, 0, buf.Length);
                    if (n <= 0) break;
                    string chunk = Encoding.UTF8.GetString(buf, 0, n);
                    head.Append(chunk);
                    string h = head.ToString();
                    int sep = h.IndexOf("\r\n\r\n");
                    if (sep >= 0)
                    {
                        headerDone = true;
                        string headerText = h.Substring(0, sep);
                        string rest = h.Substring(sep + 4);
                        int cl = FindContentLength(headerText);
                        if (cl > 0)
                        {
                            contentLength = cl;
                            List<byte> acc = new List<byte>();
                            byte[] restBytes = Encoding.UTF8.GetBytes(rest);
                            acc.AddRange(restBytes);
                            while (acc.Count < contentLength)
                            {
                                int m = stream.Read(buf, 0, buf.Length);
                                if (m <= 0) break;
                                byte[] tmp = new byte[m];
                                Array.Copy(buf, tmp, m);
                                acc.AddRange(tmp);
                            }
                            body = acc.ToArray();
                        }
                        break;
                    }
                }
                if (!headerDone) return;
                string firstLine = head.ToString().Split('\n')[0].Trim();
                string[] parts = firstLine.Split(' ');
                string method = parts.Length > 0 ? parts[0] : "GET";
                string rawTarget = parts.Length > 1 ? parts[1] : "/";
                string path = rawTarget;
                Dictionary<string, string> query = new Dictionary<string, string>();
                int qi = rawTarget.IndexOf('?');
                if (qi >= 0)
                {
                    path = rawTarget.Substring(0, qi);
                    string qs = rawTarget.Substring(qi + 1);
                    foreach (string pair in qs.Split('&'))
                    {
                        if (string.IsNullOrEmpty(pair)) continue;
                        int eq = pair.IndexOf('=');
                        string k = eq > 0 ? pair.Substring(0, eq) : pair;
                        string v = eq > 0 ? pair.Substring(eq + 1) : "";
                        try { k = Uri.UnescapeDataString(k); v = Uri.UnescapeDataString(v); } catch { }
                        query[k] = v;
                    }
                }

                string response = null;
                string contentType = "application/json; charset=utf-8";
                int status = 200;
                byte[] rawBody = null;
                string rawMime = null;
                string rawRangeHeader = null;
                string rawAcceptRanges = "none";

                if (method == "OPTIONS")
                {
                    response = "";
                }
                else if (method == "GET" && path == "/api/config")
                {
                    response = ser.Serialize(form.GetConfig());
                }
                else if (method == "GET" && path == "/api/skins")
                {
                    string skinsFile = Program.BaseDir + "\\skins.json";
                    if (File.Exists(skinsFile)) response = File.ReadAllText(skinsFile);
                    else response = "[]";
                }
                else if (method == "POST" && path == "/api/config")
                {
                    if (body != null)
                    {
                        string bodyText = Encoding.UTF8.GetString(body);
                        Dictionary<string, object> map = ser.Deserialize<Dictionary<string, object>>(bodyText);
                        object key = null, value = null;
                        if (map != null)
                        {
                            map.TryGetValue("key", out key);
                            map.TryGetValue("value", out value);
                        }
                        if (key != null && value != null)
                        {
                            form.UpdateConfig(Convert.ToString(key), Convert.ToString(value).ToLowerInvariant());
                            response = ser.Serialize(form.GetConfig());
                        }
                        else
                        {
                            status = 400;
                            response = "{\"error\":\"key and value required\"}";
                        }
                    }
                    else
                    {
                        status = 400;
                        response = "{\"error\":\"empty body\"}";
                    }
                }
                else if (method == "POST" && path == "/api/notify")
                {
                    if (body != null)
                    {
                        string bodyText = Encoding.UTF8.GetString(body);
                        Dictionary<string, object> map = ser.Deserialize<Dictionary<string, object>>(bodyText);
                        string title = "DeepSeek Harness";
                        string message = "";
                        if (map != null)
                        {
                            object v;
                            if (map.TryGetValue("title", out v)) title = Convert.ToString(v);
                            if (map.TryGetValue("message", out v)) message = Convert.ToString(v);
                        }
                        form.BeginInvoke(new Action<string, string>(form.ShowToast), title, message);
                        response = "{\"ok\":true}";
                    }
                    else
                    {
                        status = 400;
                        response = "{\"error\":\"empty body\"}";
                    }
                }
                else if (method == "GET" && path == "/api/settings")
                {
                    response = ser.Serialize(form.GetSettingsView());
                }
                else if (method == "POST" && path == "/api/settings")
                {
                    if (body != null)
                    {
                        string bodyText = Encoding.UTF8.GetString(body);
                        Dictionary<string, object> map = ser.Deserialize<Dictionary<string, object>>(bodyText);
                        object key = null, value = null;
                        if (map != null)
                        {
                            map.TryGetValue("key", out key);
                            map.TryGetValue("value", out value);
                        }
                        if (key != null && value != null)
                        {
                            form.SetSetting(Convert.ToString(key), Convert.ToString(value));
                            response = ser.Serialize(form.GetSettingsView());
                        }
                        else
                        {
                            status = 400;
                            response = "{\"error\":\"key and value required\"}";
                        }
                    }
                    else
                    {
                        status = 400;
                        response = "{\"error\":\"empty body\"}";
                    }
                }
                else if (method == "GET" && path == "/api/fs/list")
                {
                    string dir = Q(query, "dir", form.EffectiveWorkDir());
                    response = ListFs(dir);
                }
                else if (method == "GET" && path == "/api/fs/read")
                {
                    response = ReadTextFile(Q(query, "path", ""));
                }
                else if (method == "GET" && path == "/api/git/branches")
                {
                    response = GitBranches(Q(query, "dir", form.EffectiveWorkDir()));
                }
                else if (method == "GET" && path == "/api/git/log")
                {
                    int limit = 50;
                    string ls = Q(query, "limit", "");
                    if (!string.IsNullOrEmpty(ls)) int.TryParse(ls, out limit);
                    response = GitLog(Q(query, "dir", form.EffectiveWorkDir()), Q(query, "branch", ""), limit);
                }
                else if (method == "GET" && path == "/api/git/status")
                {
                    response = GitStatus(Q(query, "dir", form.EffectiveWorkDir()));
                }
                else if (method == "POST" && path == "/api/git/checkout")
                {
                    response = GitPost("checkout", body);
                }
                else if (method == "POST" && path == "/api/git/stage")
                {
                    response = GitPost("stage", body);
                }
                else if (method == "POST" && path == "/api/git/unstage")
                {
                    response = GitPost("unstage", body);
                }
                else if (method == "POST" && path == "/api/git/discard")
                {
                    response = GitPost("discard", body);
                }
                else if (method == "GET" && path == "/api/shell/cwd")
                {
                    Dictionary<string, object> w = new Dictionary<string, object>();
                    w["ok"] = true;
                    w["cwd"] = shellCwd;
                    response = ser.Serialize(w);
                }
                else if (method == "POST" && path == "/api/shell/exec")
                {
                    response = ShellExec(body);
                }
                else if (method == "GET" && path == "/api/fs/raw")
                {
                    string rp = Q(query, "path", "");
                    if (string.IsNullOrEmpty(rp) || !File.Exists(rp))
                    {
                        status = 404;
                        response = "{\"error\":\"file not found\"}";
                    }
                    else
                    {
                        try
                        {
                            FileInfo fi = new FileInfo(rp);
                            long fsize = fi.Length;
                            rawMime = MimeForPath(rp);
                            byte[] all = File.ReadAllBytes(rp);
                            string rangeHdr = FindHeader(head.ToString(), "Range");
                            if (!string.IsNullOrEmpty(rangeHdr))
                            {
                                long start = 0, end = fsize - 1;
                                string spec = rangeHdr.Replace("bytes=", "").Trim();
                                string[] rr = spec.Split('-');
                                if (rr.Length >= 1) long.TryParse(rr[0].Trim(), out start);
                                if (rr.Length >= 2 && !string.IsNullOrEmpty(rr[1].Trim())) long.TryParse(rr[1].Trim(), out end);
                                if (end >= fsize) end = fsize - 1;
                                if (start < 0) start = 0;
                                if (start > end) end = start;
                                int len = (int)(end - start + 1);
                                byte[] part = new byte[len];
                                Array.Copy(all, start, part, 0, len);
                                rawBody = part;
                                rawRangeHeader = "bytes " + start + "-" + end + "/" + fsize;
                                rawAcceptRanges = "bytes";
                                status = 206;
                            }
                            else
                            {
                                rawBody = all;
                                rawAcceptRanges = "bytes";
                            }
                        }
                        catch (Exception ex)
                        {
                            status = 500;
                            response = "{\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}";
                        }
                    }
                }
                else if (method == "GET" && path.StartsWith("/serve/"))
                {
                    // Local web-page server: /serve/<url-encoded windows path>
                    // The browser keeps the encoded path segments, so relative
                    // assets (css/js/img) resolve next to the HTML file and are
                    // served from the same URL space.
                    string raw = path.Substring("/serve/".Length);
                    string rp;
                    try { rp = Uri.UnescapeDataString(raw); }
                    catch { rp = raw; }
                    rp = rp.Replace('/', Path.DirectorySeparatorChar);
                    if (string.IsNullOrEmpty(rp) || !File.Exists(rp))
                    {
                        status = 404;
                        response = "{\"error\":\"file not found\"}";
                    }
                    else
                    {
                        try
                        {
                            rawMime = MimeForPath(rp);
                            rawBody = File.ReadAllBytes(rp);
                            rawAcceptRanges = "bytes";
                        }
                        catch (Exception ex)
                        {
                            status = 500;
                            response = "{\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}";
                        }
                    }
                }
                else if (method == "POST" && path == "/api/fs/open")
                {
                    response = OpenPath(body);
                }
                else if (method == "POST" && path == "/api/fs/open-url")
                {
                    response = OpenUrl(body);
                }
                else
                {
                    status = 404;
                    response = "{\"error\":\"not found\"}";
                }

                byte[] respBytes = rawBody != null ? rawBody : Encoding.UTF8.GetBytes(response == null ? "" : response);
                StringBuilder sb = new StringBuilder();
                sb.Append("HTTP/1.1 ").Append(status).Append(" OK\r\n");
                sb.Append("Content-Type: ").Append(rawMime != null ? rawMime : contentType).Append("\r\n");
                if (rawRangeHeader != null) sb.Append("Content-Range: ").Append(rawRangeHeader).Append("\r\n");
                if (rawBody != null) sb.Append("Accept-Ranges: ").Append(rawAcceptRanges).Append("\r\n");
                sb.Append("Content-Length: ").Append(respBytes.Length).Append("\r\n");
                sb.Append("Access-Control-Allow-Origin: *\r\n");
                sb.Append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
                sb.Append("Access-Control-Allow-Headers: Content-Type\r\n");
                sb.Append("Access-Control-Max-Age: 86400\r\n");
                sb.Append("Connection: close\r\n\r\n");
                byte[] headBytes = Encoding.ASCII.GetBytes(sb.ToString());
                stream.Write(headBytes, 0, headBytes.Length);
                if (respBytes.Length > 0) stream.Write(respBytes, 0, respBytes.Length);
                stream.Flush();
            }
            catch
            {
            }
            finally
            {
                try { client.Close(); } catch { }
            }
        }

        private int FindContentLength(string headerText)
        {
            string[] lines = headerText.Split('\n');
            foreach (string raw in lines)
            {
                string line = raw.Trim().Trim('\r');
                int idx = line.IndexOf(':');
                if (idx > 0 && line.Substring(0, idx).Trim().ToLowerInvariant() == "content-length")
                {
                    int v;
                    if (int.TryParse(line.Substring(idx + 1).Trim(), out v)) return v;
                }
            }
            return -1;
        }

        // ---- shared helpers ------------------------------------------------

        private static string Q(Dictionary<string, string> query, string key, string def)
        {
            string v;
            if (query.TryGetValue(key, out v) && !string.IsNullOrEmpty(v)) return v;
            return def;
        }

        private string gitExePath = null;
        private string GetGit()
        {
            if (gitExePath != null) return gitExePath;
            string[] candidates = new string[]
            {
                @"C:\Program Files\Git\cmd\git.exe",
                @"C:\Program Files (x86)\Git\cmd\git.exe",
                @"C:\Program Files\Git\bin\git.exe",
                "git.exe",
            };
            foreach (string c in candidates)
            {
                if (c != "git.exe" && File.Exists(c)) { gitExePath = c; return c; }
            }
            gitExePath = "git.exe";
            return gitExePath;
        }

        private static string QuoteArg(string s)
        {
            if (string.IsNullOrEmpty(s)) return "\"\"";
            return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
        }

        private class CmdResult
        {
            public int Exit = -1;
            public string Out = "";
            public string Err = "";
        }

        private CmdResult RunCmd(string fileName, string args, string dir, Encoding enc)
        {
            CmdResult r = new CmdResult();
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = fileName;
                psi.Arguments = args;
                psi.WorkingDirectory = dir;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.StandardOutputEncoding = enc;
                psi.StandardErrorEncoding = enc;
                psi.EnvironmentVariables["GIT_TERMINAL_PROMPT"] = "0";
                Process p = Process.Start(psi);
                r.Out = p.StandardOutput.ReadToEnd();
                r.Err = p.StandardError.ReadToEnd();
                if (p.WaitForExit(30000)) r.Exit = p.ExitCode;
            }
            catch (Exception ex)
            {
                r.Err = ex.Message;
            }
            return r;
        }

        private static string ImageMime(string ext)
        {
            if (ext == ".png") return "image/png";
            if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
            if (ext == ".gif") return "image/gif";
            if (ext == ".webp") return "image/webp";
            if (ext == ".svg") return "image/svg+xml";
            if (ext == ".ico") return "image/x-icon";
            return "image/bmp";
        }

        // ---- filesystem API ------------------------------------------------

        private string ListFs(string dir)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            try
            {
                if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
                {
                    wrap["ok"] = false;
                    wrap["error"] = "directory not found";
                    wrap["dir"] = dir;
                    return ser.Serialize(wrap);
                }
                List<Dictionary<string, object>> items = new List<Dictionary<string, object>>();
                string[] dirs = Directory.GetDirectories(dir);
                string[] files = Directory.GetFiles(dir);
                Array.Sort(dirs, StringComparer.OrdinalIgnoreCase);
                Array.Sort(files, StringComparer.OrdinalIgnoreCase);
                foreach (string d in dirs)
                {
                    DirectoryInfo di = new DirectoryInfo(d);
                    if ((di.Attributes & FileAttributes.Hidden) != 0) continue;
                    Dictionary<string, object> e = new Dictionary<string, object>();
                    e["name"] = di.Name;
                    e["path"] = d;
                    e["type"] = "dir";
                    e["size"] = 0;
                    items.Add(e);
                    if (items.Count >= 800) break;
                }
                foreach (string f in files)
                {
                    FileInfo fi = new FileInfo(f);
                    if ((fi.Attributes & FileAttributes.Hidden) != 0) continue;
                    Dictionary<string, object> e = new Dictionary<string, object>();
                    e["name"] = fi.Name;
                    e["path"] = f;
                    e["type"] = "file";
                    e["size"] = fi.Length;
                    items.Add(e);
                    if (items.Count >= 800) break;
                }
                wrap["ok"] = true;
                wrap["dir"] = dir;
                wrap["items"] = items;
            }
            catch (Exception ex)
            {
                wrap["ok"] = false;
                wrap["error"] = ex.Message;
            }
            return ser.Serialize(wrap);
        }

        private static string FindHeader(string headerText, string name)
        {
            try
            {
                foreach (string ln in headerText.Split('\n'))
                {
                    string t = ln.Trim();
                    if (t.StartsWith(name + ":", StringComparison.OrdinalIgnoreCase))
                        return t.Substring(name.Length + 1).Trim();
                }
            }
            catch { }
            return "";
        }

        private static string MimeForPath(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            switch (ext)
            {
                case ".mp4": return "video/mp4";
                case ".webm": return "video/webm";
                case ".mov": return "video/quicktime";
                case ".mkv": return "video/x-matroska";
                case ".avi": return "video/x-msvideo";
                case ".m4v": return "video/mp4";
                case ".ogv": return "video/ogg";
                case ".pdf": return "application/pdf";
                case ".stl": return "model/stl";
                case ".obj": return "model/obj";
                case ".glb": return "model/gltf-binary";
                case ".gltf": return "model/gltf+json";
                case ".ply": return "application/octet-stream";
                case ".off": return "application/octet-stream";
                case ".png": return "image/png";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".gif": return "image/gif";
                case ".webp": return "image/webp";
                case ".svg": return "image/svg+xml";
                case ".bmp": return "image/bmp";
                case ".ico": return "image/x-icon";
                case ".html": case ".htm": return "text/html; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".js": return "text/javascript; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".md": return "text/markdown; charset=utf-8";
                case ".txt": return "text/plain; charset=utf-8";
                case ".xml": return "text/xml; charset=utf-8";
                case ".csv": return "text/csv; charset=utf-8";
                default: return "application/octet-stream";
            }
        }

        private string OpenPath(byte[] body)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            try
            {
                string p = "";
                if (body != null)
                {
                    string bodyText = Encoding.UTF8.GetString(body);
                    Dictionary<string, object> map = ser.Deserialize<Dictionary<string, object>>(bodyText);
                    if (map != null) { object v; if (map.TryGetValue("path", out v)) p = Convert.ToString(v); }
                }
                if (string.IsNullOrEmpty(p) || (!File.Exists(p) && !Directory.Exists(p)))
                {
                    wrap["ok"] = false;
                    wrap["error"] = "path not found";
                }
                else
                {
                    if (Directory.Exists(p))
                        Process.Start(new ProcessStartInfo("explorer.exe") { UseShellExecute = true, Arguments = "\"" + p + "\"" });
                    else
                        Process.Start(new ProcessStartInfo(p) { UseShellExecute = true });
                    wrap["ok"] = true;
                    wrap["path"] = p;
                }
            }
            catch (Exception ex)
            {
                wrap["ok"] = false;
                wrap["error"] = ex.Message;
            }
            return ser.Serialize(wrap);
        }

        private string OpenUrl(byte[] body)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            try
            {
                string u = "";
                if (body != null)
                {
                    string bodyText = Encoding.UTF8.GetString(body);
                    Dictionary<string, object> map = ser.Deserialize<Dictionary<string, object>>(bodyText);
                    if (map != null) { object v; if (map.TryGetValue("url", out v)) u = Convert.ToString(v); }
                }
                if (string.IsNullOrEmpty(u) || !(u.StartsWith("http://") || u.StartsWith("https://")))
                {
                    wrap["ok"] = false;
                    wrap["error"] = "invalid url";
                }
                else
                {
                    Process.Start(new ProcessStartInfo(u) { UseShellExecute = true });
                    wrap["ok"] = true;
                    wrap["url"] = u;
                }
            }
            catch (Exception ex)
            {
                wrap["ok"] = false;
                wrap["error"] = ex.Message;
            }
            return ser.Serialize(wrap);
        }

        private string ReadTextFile(string filePath)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            try
            {
                if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                {
                    wrap["ok"] = false;
                    wrap["error"] = "file not found";
                    wrap["path"] = filePath;
                    return ser.Serialize(wrap);
                }
                FileInfo fi = new FileInfo(filePath);
                string ext = Path.GetExtension(filePath).ToLowerInvariant();
                bool isImage = ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".gif" ||
                    ext == ".webp" || ext == ".svg" || ext == ".ico" || ext == ".bmp";
                long cap = isImage ? 20L * 1024 * 1024 : 1024 * 1024;
                if (fi.Length > cap)
                {
                    wrap["ok"] = false;
                    wrap["error"] = "file too large";
                    wrap["size"] = fi.Length;
                    return ser.Serialize(wrap);
                }
                byte[] bytes = File.ReadAllBytes(filePath);
                wrap["ok"] = true;
                wrap["path"] = filePath;
                wrap["size"] = bytes.Length;
                if (isImage)
                {
                    wrap["kind"] = "image";
                    wrap["content"] = "data:" + ImageMime(ext) + ";base64," + Convert.ToBase64String(bytes);
                }
                else
                {
                    wrap["kind"] = "text";
                    wrap["content"] = Encoding.UTF8.GetString(bytes);
                }
            }
            catch (Exception ex)
            {
                wrap["ok"] = false;
                wrap["error"] = ex.Message;
            }
            return ser.Serialize(wrap);
        }

        // ---- git API -------------------------------------------------------

        private string GitBranches(string dir)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            CmdResult r = RunCmd(GetGit(), "branch --format=%(refname:short)", dir, Encoding.UTF8);
            if (r.Exit != 0)
            {
                wrap["ok"] = false;
                wrap["error"] = (r.Err + r.Out).Trim();
                return ser.Serialize(wrap);
            }
            CmdResult rc = RunCmd(GetGit(), "rev-parse --abbrev-ref HEAD", dir, Encoding.UTF8);
            string current = rc.Exit == 0 ? rc.Out.Trim() : "";
            List<string> branches = new List<string>();
            foreach (string line in r.Out.Split('\n'))
            {
                string b = line.Trim();
                if (b.Length > 0 && !branches.Contains(b)) branches.Add(b);
            }
            wrap["ok"] = true;
            wrap["dir"] = dir;
            wrap["current"] = current;
            wrap["branches"] = branches;
            return ser.Serialize(wrap);
        }

        private string GitLog(string dir, string branch, int limit)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            if (limit <= 0) limit = 50;
            if (limit > 500) limit = 500;
            string b = string.IsNullOrEmpty(branch) ? "HEAD" : branch;
            string args = "log " + QuoteArg(b) + " --date-order --pretty=format:%H%x1f%h%x1f%P%x1f%an%x1f%aI%x1f%s -n " + limit;
            CmdResult r = RunCmd(GetGit(), args, dir, Encoding.UTF8);
            if (r.Exit != 0)
            {
                wrap["ok"] = false;
                wrap["error"] = (r.Err + r.Out).Trim();
                return ser.Serialize(wrap);
            }
            List<Dictionary<string, object>> commits = new List<Dictionary<string, object>>();
            foreach (string line in r.Out.Split('\n'))
            {
                string t = line.TrimEnd('\r');
                if (t.Length == 0) continue;
                string[] f = t.Split('\x1f');
                if (f.Length < 5) continue;
                Dictionary<string, object> c = new Dictionary<string, object>();
                c["hash"] = f[0].Trim();
                c["short"] = f[1].Trim();
                List<string> parents = new List<string>();
                foreach (string p in f[2].Trim().Split(' ')) if (p.Length > 0) parents.Add(p);
                c["parents"] = parents;
                c["author"] = f[3];
                c["date"] = f[4];
                c["subject"] = f.Length > 5 ? f[5] : "";
                commits.Add(c);
            }
            wrap["ok"] = true;
            wrap["dir"] = dir;
            wrap["branch"] = branch;
            wrap["commits"] = commits;
            return ser.Serialize(wrap);
        }

        private string GitStatus(string dir)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            CmdResult r = RunCmd(GetGit(), "-c core.quotepath=false status --porcelain=v1 --branch", dir, Encoding.UTF8);
            if (r.Exit != 0)
            {
                wrap["ok"] = false;
                wrap["error"] = (r.Err + r.Out).Trim();
                return ser.Serialize(wrap);
            }
            string branch = "";
            List<Dictionary<string, object>> changes = new List<Dictionary<string, object>>();
            foreach (string line in r.Out.Split('\n'))
            {
                string t = line.TrimEnd('\r');
                if (t.Length == 0) continue;
                if (t.StartsWith("## "))
                {
                    branch = t.Substring(3).Trim();
                    continue;
                }
                if (t.Length < 4) continue;
                string x = t.Substring(0, 1);
                string y = t.Substring(1, 1);
                string p = t.Substring(3);
                int arrow = p.IndexOf(" -> ");
                string path = arrow >= 0 ? p.Substring(0, arrow) : p;
                string to = arrow >= 0 ? p.Substring(arrow + 4) : "";
                Dictionary<string, object> ch = new Dictionary<string, object>();
                ch["x"] = x;
                ch["y"] = y;
                ch["path"] = path;
                ch["to"] = to;
                changes.Add(ch);
            }
            wrap["ok"] = true;
            wrap["dir"] = dir;
            wrap["branch"] = branch;
            wrap["changes"] = changes;
            return ser.Serialize(wrap);
        }

        private string GitPost(string action, byte[] body)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            if (body == null)
            {
                wrap["ok"] = false;
                wrap["error"] = "empty body";
                return ser.Serialize(wrap);
            }
            string bodyText = Encoding.UTF8.GetString(body);
            Dictionary<string, object> map = ser.Deserialize<Dictionary<string, object>>(bodyText);
            string dir = "";
            string arg = "";
            if (map != null)
            {
                object v;
                if (map.TryGetValue("dir", out v)) dir = Convert.ToString(v);
                if (map.TryGetValue("branch", out v)) arg = Convert.ToString(v);
                if (map.TryGetValue("path", out v)) arg = Convert.ToString(v);
            }
            if (string.IsNullOrEmpty(dir)) dir = form.EffectiveWorkDir();
            string git = GetGit();
            string args = "";
            if (action == "checkout") args = "checkout " + QuoteArg(arg);
            else if (action == "stage") args = arg == "." || arg == "" ? "add -A" : "add -- " + QuoteArg(arg);
            else if (action == "unstage") args = arg == "." || arg == "" ? "reset" : "reset -- " + QuoteArg(arg);
            else if (action == "discard") args = arg == "." || arg == "" ? "checkout -- ." : "checkout -- " + QuoteArg(arg);
            else
            {
                wrap["ok"] = false;
                wrap["error"] = "unknown action";
                return ser.Serialize(wrap);
            }
            CmdResult r = RunCmd(git, args, dir, Encoding.UTF8);
            wrap["ok"] = r.Exit == 0;
            wrap["output"] = (r.Out + r.Err).Trim();
            if (r.Exit != 0) wrap["error"] = (r.Err + r.Out).Trim();
            return ser.Serialize(wrap);
        }

        // ---- shell API (mini terminal) ------------------------------------

        private string ShellExec(byte[] body)
        {
            Dictionary<string, object> wrap = new Dictionary<string, object>();
            if (body == null)
            {
                wrap["ok"] = false;
                wrap["error"] = "empty body";
                return ser.Serialize(wrap);
            }
            string bodyText = Encoding.UTF8.GetString(body);
            Dictionary<string, object> map = ser.Deserialize<Dictionary<string, object>>(bodyText);
            string dir = "";
            string command = "";
            if (map != null)
            {
                object v;
                if (map.TryGetValue("dir", out v)) dir = Convert.ToString(v);
                if (map.TryGetValue("command", out v)) command = Convert.ToString(v);
            }
            string useDir = string.IsNullOrEmpty(dir) ? shellCwd : dir;
            if (string.IsNullOrEmpty(useDir)) useDir = form.EffectiveWorkDir();
            string trimmed = (command ?? "").Trim();
            if (trimmed.StartsWith("cd "))
            {
                string target = trimmed.Substring(3).Trim().Trim('"').Trim();
                if (target.Length == 0)
                {
                    wrap["ok"] = true;
                    wrap["cwd"] = useDir;
                    wrap["output"] = useDir;
                    return ser.Serialize(wrap);
                }
                string newDir = Path.IsPathRooted(target) ? target : Path.Combine(useDir, target);
                if (Directory.Exists(newDir))
                {
                    shellCwd = newDir;
                    wrap["ok"] = true;
                    wrap["cwd"] = newDir;
                    wrap["output"] = "";
                }
                else
                {
                    wrap["ok"] = false;
                    wrap["cwd"] = useDir;
                    wrap["output"] = "cd: directory not found: " + target;
                }
                return ser.Serialize(wrap);
            }
            Encoding oem = Encoding.GetEncoding(System.Globalization.CultureInfo.CurrentCulture.TextInfo.OEMCodePage);
            CmdResult r = RunCmd("cmd.exe", "/c " + command, useDir, oem);
            wrap["ok"] = r.Exit == 0;
            wrap["cwd"] = useDir;
            wrap["exit"] = r.Exit;
            wrap["output"] = r.Out + (r.Err.Length > 0 ? (r.Out.Length > 0 ? "\r\n" : "") + r.Err : "");
            return ser.Serialize(wrap);
        }
    }
}