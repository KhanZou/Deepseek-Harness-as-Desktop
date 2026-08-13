$ErrorActionPreference = 'Stop'
$AppId = 'DeepSeekHarness.Desktop'
$exe = 'D:\dsh-desktop-window\shell\DshDesktop.exe'
$shellDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lnk = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\DeepSeek Harness.lnk'
$toastFile = Join-Path $shellDir '.toast.json'

# Message transport: prefer the UTF-8 JSON file written by DshDesktop.exe;
# fall back to environment variables.
$Title = 'DeepSeek Harness'
$Message = ''
if (Test-Path -LiteralPath $toastFile) {
    try {
        $data = Get-Content -LiteralPath $toastFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($data.title) { $Title = [string]$data.title }
        if ($data.message) { $Message = [string]$data.message }
    }
    catch { }
}
if (-not $Title) { $Title = if ($env:DSH_TOAST_TITLE) { $env:DSH_TOAST_TITLE } else { 'DeepSeek Harness' } }
if (-not $Message) { $Message = if ($env:DSH_TOAST_MESSAGE) { $env:DSH_TOAST_MESSAGE } else { '' } }

# ---- ensure Start Menu shortcut with AppUserModelID (unpackaged toast support) ----
try {
    if (-not (Test-Path $lnk)) {
        $ws = New-Object -ComObject WScript.Shell
        $sc = $ws.CreateShortcut($lnk)
        $sc.TargetPath = $exe
        $sc.WorkingDirectory = $shellDir
        $sc.IconLocation = "$exe,0"
        $sc.Save()
    }
    Add-Type -Path (Join-Path $shellDir 'ShortcutAppId.cs')
    [ShortcutAppId]::Set($lnk, $AppId)
}
catch {
    Write-Warning "AUMID shortcut setup skipped: $($_.Exception.Message)"
}

# ---- show real Windows toast ----
try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
    [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null
    $safeTitle = [Security.SecurityElement]::Escape($Title)
    $safeMsg = [Security.SecurityElement]::Escape($Message)
    $xmlText = "<?xml version='1.0' encoding='utf-8'?><toast><visual><binding template='ToastGeneric'><text>$safeTitle</text><text>$safeMsg</text></binding></visual></toast>"
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($xmlText)
    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show($toast)
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
exit 0