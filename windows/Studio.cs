using System;
using System.Drawing;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Náutica Volt")]
[assembly: AssemblyProduct("Náutica Volt")]
[assembly: AssemblyVersion("2.0.0.0")]

internal static class Program {
    internal static Stream Asset(string name) {
        return Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
    }
    [STAThread]
    static void Main() {
        AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs args) {
            string name = new AssemblyName(args.Name).Name;
            if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms") return null;
            using (Stream stream = Asset(name + ".dll"))
            using (MemoryStream copy = new MemoryStream()) {
                stream.CopyTo(copy);
                return Assembly.Load(copy.ToArray());
            }
        };
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Studio());
    }
}

internal sealed class Studio : Form {
    readonly WebView2 browser = new WebView2();
    readonly string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NauticaVolt");
    const string LocalOrigin = "https://nauticavolt.example/";
    FormWindowState previousState;

    public Studio() {
        Text = "Náutica Volt"; Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Size = new Size(1320, 860); StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized; browser.Dock = DockStyle.Fill;
        Controls.Add(browser); Shown += Start;
    }
    async void Start(object sender, EventArgs e) {
        try {
            string loader = Path.Combine(root, "runtime-1.0.2903.40");
            Directory.CreateDirectory(loader);
            string target = Path.Combine(loader, "WebView2Loader.dll");
            if (!File.Exists(target)) {
                string temp = Path.Combine(loader, Guid.NewGuid().ToString("N") + ".tmp");
                using (Stream source = Program.Asset("WebView2Loader.dll"))
                using (FileStream file = File.Create(temp)) source.CopyTo(file);
                try { File.Move(temp, target); }
                catch (IOException) { if (!File.Exists(target)) throw; File.Delete(temp); }
            }
            CoreWebView2Environment.SetLoaderDllFolderPath(loader);
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(root, "perfil"));
            await browser.EnsureCoreWebView2Async(env);
            var web = browser.CoreWebView2;
            web.AddWebResourceRequestedFilter(LocalOrigin + "*", CoreWebView2WebResourceContext.All);
            web.WebResourceRequested += delegate(object o, CoreWebView2WebResourceRequestedEventArgs a) {
                bool home = new Uri(a.Request.Uri).AbsolutePath == "/";
                a.Response = env.CreateWebResourceResponse(home ? Program.Asset("index.html") : Stream.Null, home ? 200 : 404, home ? "OK" : "Not Found", "Content-Type: text/html; charset=utf-8");
            };
            web.NavigationStarting += delegate(object o, CoreWebView2NavigationStartingEventArgs a) {
                if (!a.Uri.StartsWith(LocalOrigin,StringComparison.OrdinalIgnoreCase)) { a.Cancel=true; External(a.Uri); }
            };
            web.NewWindowRequested += delegate(object o, CoreWebView2NewWindowRequestedEventArgs a) { a.Handled=true; External(a.Uri); };
            web.ContainsFullScreenElementChanged += delegate {
                if (web.ContainsFullScreenElement) {
                    previousState=WindowState; FormBorderStyle=FormBorderStyle.None; WindowState=FormWindowState.Maximized;
                } else { FormBorderStyle=FormBorderStyle.Sizable; WindowState=previousState; }
            };
            web.NavigationCompleted += delegate { Text = web.DocumentTitle; };
            web.Navigate(LocalOrigin);
        } catch (Exception ex) {
            MessageBox.Show("No se pudo iniciar el visor. Comprueba que Microsoft Edge WebView2 Runtime x64 está instalado.\n\n" + ex.Message, "Náutica Volt");
            Close();
        }
    }
    static void External(string url) {
        Uri parsed;
        if (Uri.TryCreate(url, UriKind.Absolute, out parsed) && (parsed.Scheme=="https" || parsed.Scheme=="http"))
            Process.Start(new ProcessStartInfo(parsed.AbsoluteUri) {UseShellExecute=true});
    }
}
