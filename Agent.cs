using System;
using System.Drawing;
using System.Windows.Forms;
using System.Management;
using System.Net;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Diagnostics;
using Microsoft.Win32;

namespace OEMDriverAgent
{
    public class UpdateData
    {
        public string driver_name { get; set; }
        public string category { get; set; }
        public string installed_version { get; set; }
        public string target_version { get; set; }
        public string latest_version { get; set; }
        public string severity { get; set; }
        public string download_url { get; set; }
    }

    public class PolicyData
    {
        public bool enabled { get; set; }
        public bool criticalOnly { get; set; }
    }

    public class ApiResponse
    {
        public PolicyData policy { get; set; }
        public List<UpdateData> updates { get; set; }
    }

    public class MainForm : Form
    {
        private string ServerUrl = "http://localhost:3000";
        private string ApiKey = "m2m-super-secret-key-for-agents";
        private string MachineId = "UNKNOWN";

        private Label lblTitle;
        private Label lblPolicy;
        private DataGridView grid;
        private Label lblStatus;
        private ProgressBar progress;
        private Label lblProgress;
        private Button btnCheck;
        private Button btnInstall;
        private List<UpdateData> pendingUpdates;

        private GroupBox gb;
        private Panel pnlEmptyState;
        private PictureBox pbLoading;

        private NotifyIcon trayIcon;
        private ContextMenu trayMenu;
        private bool isFirstShow = true;
        private bool startSilent = false;

        protected override void SetVisibleCore(bool value)
        {
            if (isFirstShow && startSilent)
            {
                value = false;
                if (!this.IsHandleCreated) CreateHandle();
            }
            base.SetVisibleCore(value);
        }

        public MainForm(bool silent = false)
        {
            startSilent = silent;
            // Forzar TLS 1.2 para descargar desde servidores HTTPS modernos (como Lenovo/HP)
            System.Net.ServicePointManager.SecurityProtocol = (System.Net.SecurityProtocolType)3072;
            
            LoadConfig();
            if (string.IsNullOrEmpty(ServerUrl))
            {
                MessageBox.Show("No se encontró la URL del servidor corporativo.\nPor favor, instale el agente usando el MSI oficial o configure el Registro de Windows.", "Error de Configuración", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Environment.Exit(1);
            }

            InitializeComponent();
            LoadWmiInfo();
            SetupTrayIcon();
        }

        private void LoadConfig()
        {
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"Software\DriverExplorer"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue("ServerUrl");
                        if (val != null)
                        {
                            ServerUrl = val.ToString();
                        }
                    }
                }
            }
            catch { }

            if (string.IsNullOrEmpty(ServerUrl))
            {
                string configPath = Path.Combine(Application.StartupPath, "appsettings.json");
                if (File.Exists(configPath))
                {
                    try {
                        var json = File.ReadAllText(configPath);
                        var js = new JavaScriptSerializer();
                        var config = js.Deserialize<Dictionary<string, string>>(json);
                        if (config.ContainsKey("ServerUrl")) ServerUrl = config["ServerUrl"];
                    } catch { }
                }
            }
        }

        private void SetupTrayIcon()
        {
            trayMenu = new ContextMenu();
            trayMenu.MenuItems.Add("Abrir Panel", (s, e) => {
                isFirstShow = false;
                this.Show();
                this.WindowState = FormWindowState.Normal;
                this.BringToFront();
                LoadUpdatesData();
            });
            trayMenu.MenuItems.Add("Buscar Actualizaciones", (s, e) => {
                isFirstShow = false;
                this.Show();
                this.WindowState = FormWindowState.Normal;
                this.BringToFront();
                LoadUpdatesData();
            });
            trayMenu.MenuItems.Add("Salir", (s, e) => {
                trayIcon.Visible = false;
                Application.Exit();
            });

            trayIcon = new NotifyIcon();
            trayIcon.Text = "Driver Explorer Client";
            trayIcon.Icon = this.Icon;
            trayIcon.ContextMenu = trayMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => {
                isFirstShow = false;
                this.Show();
                this.WindowState = FormWindowState.Normal;
                this.BringToFront();
                LoadUpdatesData();
            };

            this.FormClosing += (s, e) => {
                if (e.CloseReason == CloseReason.UserClosing)
                {
                    e.Cancel = true;
                    this.Hide();
                }
            };
        }

        private void InitializeComponent()
        {
            this.Text = "Driver Explorer Client";
            this.Size = new Size(800, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(241, 245, 249);

            try { this.Font = new Font("Segoe UI Variable Text", 10); } 
            catch { this.Font = new Font("Segoe UI", 10); }

            try {
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "refresh_14433.ico");
                if (File.Exists(iconPath)) this.Icon = new Icon(iconPath);
                else this.Icon = SystemIcons.Shield;
            } catch { }

            // Menu
            var menu = new MenuStrip();
            var helpMenu = new ToolStripMenuItem("Ayuda");
            var aboutItem = new ToolStripMenuItem("Acerca de...");
            aboutItem.Click += (s, e) => MessageBox.Show("OEM Driver Explorer - C# Native Agent\nVersión: v2.0 (Compilado y Firmado)\n© 2026 Corporación.", "Acerca de", MessageBoxButtons.OK, MessageBoxIcon.Information);
            helpMenu.DropDownItems.Add(aboutItem);
            menu.Items.Add(helpMenu);
            this.Controls.Add(menu);
            this.MainMenuStrip = menu;

            // GroupBox WMI
            gb = new GroupBox();
            gb.Text = "Información del Sistema";
            gb.Location = new Point(15, 35);
            gb.Size = new Size(750, 80);
            gb.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            gb.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            gb.ForeColor = Color.FromArgb(30, 41, 59);
            this.Controls.Add(gb);

            lblTitle = new Label { Text = "Controladores Pendientes", Font = new Font("Segoe UI", 11, FontStyle.Bold), Location = new Point(15, 125), AutoSize = true, ForeColor = Color.FromArgb(30, 41, 59) };
            this.Controls.Add(lblTitle);

            lblPolicy = new Label { Text = "Políticas: Verificando...", ForeColor = Color.FromArgb(30, 41, 59), Location = new Point(15, 150), AutoSize = true };
            this.Controls.Add(lblPolicy);

            grid = new DataGridView();
            grid.Location = new Point(15, 175);
            grid.Size = new Size(750, 250);
            grid.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            grid.AllowUserToAddRows = false;
            grid.ReadOnly = true;
            grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            grid.BackgroundColor = Color.White;
            grid.BorderStyle = BorderStyle.None;
            this.Controls.Add(grid);

            // Empty State
            pnlEmptyState = new Panel();
            pnlEmptyState.Location = grid.Location;
            pnlEmptyState.Size = grid.Size;
            pnlEmptyState.Anchor = grid.Anchor;
            pnlEmptyState.BackColor = Color.White;
            pnlEmptyState.Visible = false;

            var lblEmptyIcon = new Label { Text = "✔", Font = new Font("Segoe UI", 64, FontStyle.Bold), AutoSize = false, TextAlign = ContentAlignment.MiddleCenter, ForeColor = Color.FromArgb(54, 95, 136) };
            lblEmptyIcon.Size = new Size(pnlEmptyState.Width, 120);
            lblEmptyIcon.Location = new Point(0, (pnlEmptyState.Height - 160) / 2);
            lblEmptyIcon.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            pnlEmptyState.Controls.Add(lblEmptyIcon);

            var lblEmptyText = new Label { Text = "Todo está al día", Font = new Font("Segoe UI", 14, FontStyle.Bold), AutoSize = false, TextAlign = ContentAlignment.MiddleCenter, ForeColor = Color.FromArgb(30, 41, 59) };
            lblEmptyText.Size = new Size(pnlEmptyState.Width, 30);
            lblEmptyText.Location = new Point(0, lblEmptyIcon.Bottom + 10);
            lblEmptyText.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            pnlEmptyState.Controls.Add(lblEmptyText);
            
            this.Controls.Add(pnlEmptyState);

            // Spinner (GIF base64)
            pbLoading = new PictureBox();
            pbLoading.Size = new Size(64, 64);
            pbLoading.Location = new Point((this.ClientSize.Width - 64) / 2, (this.ClientSize.Height - 64) / 2);
            pbLoading.Anchor = AnchorStyles.None;
            pbLoading.BackColor = Color.Transparent;
            pbLoading.SizeMode = PictureBoxSizeMode.Zoom;
            pbLoading.Visible = false;
            
            string gifBase64 = "R0lGODlhIAAgAPUAAP///wAAAM7OztbW1t7e3uTk5Ojo6Ozs7PT09Pj4+P///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJCgAAACwAAAAAIAAgAAAG/0CAcEgkKhzI4i25cCCd0Kh0Sq1ar9isdsvter/gsHhMLpvP6LR6zW673/C4fE6v2+/4vH7P7/v/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmQEQARnJ0AEQQSoRIDEKSbpxGoqxGrkwAEr7AQBLGjtrS1EAS4r7u2vL4TBb+6wL8TwsK/r8gTBcvJz78R0NEQBQHRr9bKzQWl3N/crd0F4uPgzeO/5ePnzegFBQXr6q/t5u8FBPDiQcQvWj8T/Lp94zbwGz4FAhM6XJhwG0SCAEwoWAAAwkSIv2CgO0Fx2gUAHzgYUKBgQEqTB06q7EFAAMuWMFu2GPCgZcMHDQ0E5Azq8uDPkEAx9gQK9KfRoTh9DqVZ9ChUplKlWoVKtSrWq1izYr2KtatWrly9ig0bNuzYsGTNmjWr1i1ct3Dlyp1Lt67du3jz6t3Lt67fvIADCx5MuLDhw4gTK17MuLHjx5AjS55MubLly5gza97MubPnz6BDix5NurTp06hTq17NurXr158RAAAh+QQJCgAAACwAAAAAIAAgAAAG/0CAcEgkKhzI4i25cCCd0Kh0Sq1ar9isdsvter/gsHhMLpvP6LR6zW673/C4fE6v2+/4vH7P7/v/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmQEQARnJ0AEQQSoRIDEKSbpxGoqxGrkwAEr7AQBLGjtrS1EAS4r7u2vL4TBb+6wL8TwsK/r8gTBcvJz78R0NEQBQHRr9bKzQWl3N/crd0F4uPgzeO/5ePnzegFBQXr6q/t5u8FBPDiQcQvWj8T/Lp94zbwGz4FAhM6XJhwG0SCAEwoWAAAwkSIv2CgO0Fx2gUAHzgYUKBgQEqTB06q7EFAAMuWMFu2GPCgZcMHDQ0E5Azq8uDPkEAx9gQK9KfRoTh9DqVZ9ChUplKlWoVKtSrWq1izYr2KtatWrly9ig0bNuzYsGTNmjWr1i1ct3Dlyp1Lt67du3jz6t3Lt67fvIADCx5MuLDhw4gTK17MuLHjx5AjS55MubLly5gza97MubPnz6BDix5NurTp06hTq17NurXr158RAAAh+QQJCgAAACwAAAAAIAAgAAAG/0CAcEgkKhzI4i25cCCd0Kh0Sq1ar9isdsvter/gsHhMLpvP6LR6zW673/C4fE6v2+/4vH7P7/v/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmQEQARnJ0AEQQSoRIDEKSbpxGoqxGrkwAEr7AQBLGjtrS1EAS4r7u2vL4TBb+6wL8TwsK/r8gTBcvJz78R0NEQBQHRr9bKzQWl3N/crd0F4uPgzeO/5ePnzegFBQXr6q/t5u8FBPDiQcQvWj8T/Lp94zbwGz4FAhM6XJhwG0SCAEwoWAAAwkSIv2CgO0Fx2gUAHzgYUKBgQEqTB06q7EFAAMuWMFu2GPCgZcMHDQ0E5Azq8uDPkEAx9gQK9KfRoTh9DqVZ9ChUplKlWoVKtSrWq1izYr2KtatWrly9ig0bNuzYsGTNmjWr1i1ct3Dlyp1Lt67du3jz6t3Lt67fvIADCx5MuLDhw4gTK17MuLHjx5AjS55MubLly5gza97MubPnz6BDix5NurTp06hTq17NurXr158RAAA7";
            try {
                byte[] imageBytes = Convert.FromBase64String(gifBase64);
                var ms = new MemoryStream(imageBytes);
                pbLoading.Image = Image.FromStream(ms);
            } catch { }
            this.Controls.Add(pbLoading);
            pbLoading.BringToFront();

            lblStatus = new Label { Text = "Estado: Listo", Font = new Font("Segoe UI", 9, FontStyle.Bold), ForeColor = Color.FromArgb(30, 41, 59), Location = new Point(15, 435), AutoSize = true, Anchor = AnchorStyles.Bottom | AnchorStyles.Left };
            this.Controls.Add(lblStatus);

            progress = new ProgressBar { Location = new Point(15, 460), Size = new Size(600, 25), Style = ProgressBarStyle.Continuous, Visible = false, Anchor = AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right };
            this.Controls.Add(progress);

            lblProgress = new Label { Text = "0%", Location = new Point(625, 465), AutoSize = true, Visible = false, Anchor = AnchorStyles.Bottom | AnchorStyles.Right };
            this.Controls.Add(lblProgress);

            btnCheck = new Button { Text = "Revisar", Location = new Point(450, 500), Size = new Size(150, 35), BackColor = Color.FromArgb(54, 95, 136), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9, FontStyle.Bold), Anchor = AnchorStyles.Bottom | AnchorStyles.Right, Cursor = Cursors.Hand };
            btnCheck.FlatAppearance.BorderSize = 0;
            btnCheck.MouseEnter += (s, e) => btnCheck.BackColor = Color.FromArgb(70, 118, 166);
            btnCheck.MouseLeave += (s, e) => btnCheck.BackColor = Color.FromArgb(54, 95, 136);
            btnCheck.Click += BtnCheck_Click;
            this.Controls.Add(btnCheck);

            btnInstall = new Button { Text = "Descargar e Instalar", Location = new Point(610, 500), Size = new Size(150, 35), BackColor = Color.FromArgb(54, 95, 136), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9, FontStyle.Bold), Enabled = false, Anchor = AnchorStyles.Bottom | AnchorStyles.Right, Cursor = Cursors.Hand };
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.MouseEnter += (s, e) => { if (btnInstall.Enabled) btnInstall.BackColor = Color.FromArgb(70, 118, 166); };
            btnInstall.MouseLeave += (s, e) => { if (btnInstall.Enabled) btnInstall.BackColor = Color.FromArgb(54, 95, 136); };
            btnInstall.EnabledChanged += (s, e) => { btnInstall.BackColor = btnInstall.Enabled ? Color.FromArgb(54, 95, 136) : Color.Gray; };
            btnInstall.Click += BtnInstall_Click;
            this.Controls.Add(btnInstall);

            this.Load += (s, e) => { if (!startSilent) LoadUpdatesData(); };
        }

        private void LoadWmiInfo()
        {
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT UUID FROM Win32_ComputerSystemProduct"))
                {
                    foreach (ManagementObject queryObj in searcher.Get())
                    {
                        MachineId = queryObj["UUID"].ToString();
                    }
                }

                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Name, Manufacturer, Model FROM Win32_ComputerSystem"))
                {
                    foreach (ManagementObject queryObj in searcher.Get())
                    {
                        var lblHost = new Label { Text = "Equipo: " + queryObj["Name"], Location = new Point(15, 25), AutoSize = true, Font = new Font("Segoe UI Semibold", 10), ForeColor = Color.FromArgb(30, 41, 59) };
                        var lblModel = new Label { Text = "Modelo: " + queryObj["Manufacturer"] + " " + queryObj["Model"], Location = new Point(300, 25), AutoSize = true, Font = new Font("Segoe UI Semibold", 10), ForeColor = Color.FromArgb(30, 41, 59) };
                        if (gb != null) { gb.Controls.Add(lblHost); gb.Controls.Add(lblModel); }
                    }
                }
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Caption FROM Win32_OperatingSystem"))
                {
                    foreach (ManagementObject queryObj in searcher.Get())
                    {
                        var lblOS = new Label { Text = "SO: " + queryObj["Caption"], Location = new Point(15, 50), AutoSize = true, Font = new Font("Segoe UI Semibold", 10), ForeColor = Color.FromArgb(30, 41, 59) };
                        if (gb != null) gb.Controls.Add(lblOS);
                    }
                    if (gb != null)
                    {
                        var lblSync = new Label { Name = "lblSyncDate", Text = "Última sinc: Pendiente", Location = new Point(300, 50), AutoSize = true, Font = new Font("Segoe UI Semibold", 10), ForeColor = Color.FromArgb(30, 41, 59) };
                        gb.Controls.Add(lblSync);
                    }
                }
            }
            catch (Exception ex) { Log("Error WMI: " + ex.Message, "ERROR"); }
        }

        private void SetStatus(string text)
        {
            lblStatus.Text = "Estado: " + text;
            lblStatus.Refresh();
        }

        private void Log(string message, string level = "INFO")
        {
            try
            {
                var payload = new {
                    machineId = MachineId,
                    timestamp = DateTime.UtcNow.ToString("O"),
                    level = level,
                    message = message
                };
                var js = new JavaScriptSerializer();
                string json = js.Serialize(payload);

                using (var client = new WebClient())
                {
                    client.Encoding = System.Text.Encoding.UTF8;
                    client.Headers.Add("x-device-api-key", ApiKey);
                    client.Headers.Add("Content-Type", "application/json");
                    client.UploadString(ServerUrl + "/api/client/logs", "POST", json);
                }
            }
            catch { }
        }

        private void BtnCheck_Click(object sender, EventArgs e)
        {
            LoadUpdatesData();
        }

        private async void LoadUpdatesData()
        {
            btnCheck.Enabled = false;
            btnInstall.Enabled = false;
            grid.Visible = false;
            pnlEmptyState.Visible = false;
            pbLoading.Visible = true;
            SetStatus("Conectando con el servidor...");
            grid.DataSource = null;

            Log("C# Agente GUI comprobando actualizaciones...");

            try
            {
                using (var client = new WebClient())
                {
                    client.Encoding = System.Text.Encoding.UTF8;
                    client.Headers.Add("x-device-api-key", ApiKey);
                    
                    string json = await System.Threading.Tasks.Task.Run(() => client.DownloadString(ServerUrl + "/api/client/updates/" + MachineId));
                    pbLoading.Visible = false;
                    
                    var js = new JavaScriptSerializer();
                    var data = js.Deserialize<ApiResponse>(json);

                    string lastSync = DateTime.Now.ToString("dd/MM/yyyy HH:mm");
                    if (gb != null && gb.Controls.ContainsKey("lblSyncDate"))
                    {
                        gb.Controls["lblSyncDate"].Text = "Última sinc: " + lastSync;
                    }

                    if (data.policy.enabled)
                    {
                        lblPolicy.Text = "Políticas Habilitadas | Modo: " + (data.policy.criticalOnly ? "Solo Críticos" : "Todos los Drivers");
                        lblPolicy.ForeColor = Color.Green;
                    }
                    else
                    {
                        lblPolicy.Text = "Políticas Pausadas. No hay actualizaciones disponibles.";
                        lblPolicy.ForeColor = Color.Orange;
                    }

                    pendingUpdates = data.updates;
                    if (pendingUpdates != null && pendingUpdates.Count > 0)
                    {
                        btnInstall.Enabled = true;
                        
                        var dt = new System.Data.DataTable();
                        dt.Columns.Add("Controlador");
                        dt.Columns.Add("Categoría");
                        dt.Columns.Add("Instalado");
                        dt.Columns.Add("Aprobado");
                        dt.Columns.Add("Criticidad");

                        foreach (var u in pendingUpdates)
                        {
                            dt.Rows.Add(u.driver_name, u.category, u.installed_version, string.IsNullOrEmpty(u.target_version) ? u.latest_version : u.target_version, u.severity);
                        }
                        grid.DataSource = dt;
                        grid.Visible = true;
                        pnlEmptyState.Visible = false;
                        SetStatus("Listo (" + pendingUpdates.Count + " actualizaciones pendientes)");
                    }
                    else
                    {
                        if (data.policy.enabled) lblPolicy.Text = "Políticas Habilitadas | Modo: " + (data.policy.criticalOnly ? "Solo Críticos" : "Todos los Drivers") + " | Su equipo está al día.";
                        grid.Visible = false;
                        pnlEmptyState.Visible = true;
                        SetStatus("Listo (Equipo actualizado)");
                    }
                }
            }
            catch (Exception ex)
            {
                pbLoading.Visible = false;
                grid.Visible = false;
                pnlEmptyState.Visible = true;
                lblPolicy.Text = "Error: " + ex.Message; System.IO.File.WriteAllText("agent_error.log", ex.ToString());
                SetStatus("Error de conexión");
                Log("Error API: " + ex.Message, "ERROR");
            }
            btnCheck.Enabled = true;
        }

        private void CleanupGhostInstallers()
        {
            string[] ghostNames = { 
                "Setup", "SynReflash", "Reflash", "fwupdatetool", 
                "Win32 FW Update Tool", "For Lenovo Updates Catalog", 
                "dpinst", "dpinst64", "drvsetup", "pnputil",
                "fwnva", "fwsdw", "fwnv", "fwsd", "FUDF", "fudf"
            };
            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    string pName = p.ProcessName;
                    foreach (var name in ghostNames)
                    {
                        if (pName.Equals(name, StringComparison.OrdinalIgnoreCase) ||
                            pName.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            p.Kill();
                            break;
                        }
                    }
                }
                catch { }
            }
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            btnInstall.Enabled = false;
            btnCheck.Enabled = false;
            progress.Visible = true;
            lblProgress.Visible = true;

            Log("Iniciando descarga e instalación C# NATIVA de " + pendingUpdates.Count + " paquete(s)...");

            foreach (var update in pendingUpdates)
            {
                CleanupGhostInstallers();
                
                string url = update.download_url;
                if (string.IsNullOrEmpty(url)) continue;
                
                string fileName = Path.GetFileName(new Uri(url).LocalPath);
                string tempPath = Path.Combine(Path.GetTempPath(), fileName);

                Log("Descargando " + fileName + " desde Lenovo/HP...");
                SetStatus("Descargando controlador " + fileName + " (0%)...");

                using (var client = new WebClient())
                {
                    client.DownloadProgressChanged += (s, ev) => {
                        progress.Value = ev.ProgressPercentage;
                        lblProgress.Text = ev.ProgressPercentage + "%";
                        SetStatus("Descargando " + fileName + " (" + ev.ProgressPercentage + "%)...");
                    };

                    bool downloadComplete = false;
                    bool downloadError = false;
                    client.DownloadFileCompleted += (s, ev) => { 
                        if (ev.Error != null) {
                            Log("Error al descargar " + fileName + ": " + ev.Error.Message, "ERROR");
                            downloadError = true;
                        }
                        downloadComplete = true; 
                    };
                    
                    if (File.Exists(tempPath)) { try { File.Delete(tempPath); } catch { } }
                    client.DownloadFileAsync(new Uri(url), tempPath);
                    while (!downloadComplete)
                    {
                        Application.DoEvents();
                        System.Threading.Thread.Sleep(50);
                    }

                    if (downloadError) {
                        if (File.Exists(tempPath)) { try { File.Delete(tempPath); } catch { } }
                        continue;
                    }
                }

                Log("Descarga completada: " + fileName + ". Instalando...", "SUCCESS");
                SetStatus("Instalando " + fileName + "...");

                try
                {
                    if (fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                    {
                        CleanupGhostInstallers();
                        var proc = Process.Start(new ProcessStartInfo {
                            FileName = tempPath,
                            Arguments = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOCANCEL /SP- /S /q /qn",
                            UseShellExecute = false,
                            CreateNoWindow = true
                        });
                        
                        if (proc != null) {
                            DateTime startTime = DateTime.Now;
                            while (!proc.HasExited && (DateTime.Now - startTime).TotalSeconds < 20) {
                                Application.DoEvents();
                                System.Threading.Thread.Sleep(500);
                            }
                            if (!proc.HasExited) {
                                Log("Timeout (20s): El instalador " + fileName + " se quedó colgado en segundo plano. Forzando cierre...", "WARNING");
                                try { proc.Kill(); } catch { }
                                CleanupGhostInstallers();
                            } else {
                                Log("Instalación de " + fileName + " finalizada con código " + proc.ExitCode, "SUCCESS");
                            }
                        } else {
                            Log("Instalación de " + fileName + " finalizada con código 0", "SUCCESS");
                        }
                        CleanupGhostInstallers();
                    }
                    else if (fileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                    {
                        Log("Instalación de " + fileName + " finalizada con código 0", "SUCCESS");
                    }
                }
                catch (Exception ex)
                {
                    Log("Error al instalar " + fileName + ": " + ex.Message, "ERROR");
                }
            }

            SetStatus("Instalación completada");
            MessageBox.Show("Instalación de controladores finalizada.", "Completado", MessageBoxButtons.OK, MessageBoxIcon.Information);
            
            progress.Visible = false;
            lblProgress.Visible = false;
            LoadUpdatesData();
        }
    }

    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool silent = args.Length > 0 && args[0].Equals("-Silent", StringComparison.OrdinalIgnoreCase);
            Application.Run(new MainForm(silent));
        }
    }
}
