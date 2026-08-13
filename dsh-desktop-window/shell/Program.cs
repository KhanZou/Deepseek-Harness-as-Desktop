using System;
using System.Collections.Generic;
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

        public Config GetConfig() { return cfg; }

        public void UpdateConfig(string key, string value)
        {
            if (key == "closeBehavior") cfg.closeBehavior = value;
            else if (key == "autoStart") cfg.autoStart = (value == "true");
            else if (key == "notifyOnComplete") cfg.notifyOnComplete = (value == "true");
            else if (key == "desiredSkin") cfg.desiredSkin = value;
            else if (key == "activeSkin") cfg.activeSkin = value;
            else if (key == "trayHint") cfg.trayHint = (value == "true");
            else if (key == "serverWorkDir") cfg.serverWorkDir = value;
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

        public HttpServer(int port, MainForm form)
        {
            this.port = port;
            this.form = form;
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
                string path = parts.Length > 1 ? parts[1] : "/";
                if (path.IndexOf('?') >= 0) path = path.Substring(0, path.IndexOf('?'));

                string response = null;
                string contentType = "application/json; charset=utf-8";
                int status = 200;

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
                else
                {
                    status = 404;
                    response = "{\"error\":\"not found\"}";
                }

                byte[] respBytes = Encoding.UTF8.GetBytes(response == null ? "" : response);
                StringBuilder sb = new StringBuilder();
                sb.Append("HTTP/1.1 ").Append(status).Append(" OK\r\n");
                sb.Append("Content-Type: ").Append(contentType).Append("\r\n");
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
    }
}