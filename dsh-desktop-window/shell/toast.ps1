param([switch]$dismiss)
$ErrorActionPreference = 'Stop'
$AppId = 'DeepSeekHarness.Desktop'
$shellDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $shellDir 'DshDesktop.exe'
$lnk = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\DeepSeek Harness.lnk'

# ---- dismiss mode: remove a toast from the Action Center by tag ----
if ($dismiss) {
    $df = Join-Path $shellDir '.dismiss.json'
    if (Test-Path -LiteralPath $df) {
        try {
            $d = Get-Content -LiteralPath $df -Raw -Encoding UTF8 | ConvertFrom-Json
            $tag = [string]$d.tag
            $group = [string]$d.group
            if (-not $group) { $group = $AppId }
            if ($tag) {
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
                [Windows.UI.Notifications.ToastNotificationManager]::History.Remove($tag, $group, $AppId)
            }
        }
        catch { }
    }
    exit 0
}

# ---- read payload (written by DshDesktop.exe as UTF-8 JSON) ----
$toastFile = Join-Path $shellDir '.toast.json'
$kind = 'basic'
$Title = 'DeepSeek Harness'
$Message = ''
$sessionId = ''
$turn = ''
$reason = ''
$tools = ''
$approvalId = ''
$rpcId = ''
$toolName = ''
$argsText = ''
$tag = ''
$group = $AppId
$approveLabel = 'Allow once'
$rejectLabel = 'Reject'
$replyLabel = 'Reply'
$replyPlaceholder = 'Type a reply...'
$quickReply = $false
if (Test-Path -LiteralPath $toastFile) {
    try {
        $data = Get-Content -LiteralPath $toastFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($data.kind) { $kind = [string]$data.kind }
        if ($data.title) { $Title = [string]$data.title }
        if ($data.message) { $Message = [string]$data.message }
        if ($data.sessionId) { $sessionId = [string]$data.sessionId }
        if ($data.turn) { $turn = [string]$data.turn }
        if ($data.reason) { $reason = [string]$data.reason }
        if ($data.tools) { $tools = [string]$data.tools }
        if ($data.approvalId) { $approvalId = [string]$data.approvalId }
        if ($data.rpcId) { $rpcId = [string]$data.rpcId }
        if ($data.toolName) { $toolName = [string]$data.toolName }
        if ($data.args) { $argsText = [string]$data.args }
        if ($data.tag) { $tag = [string]$data.tag }
        if ($data.group) { $group = [string]$data.group }
        if ($data.approveLabel) { $approveLabel = [string]$data.approveLabel }
        if ($data.rejectLabel) { $rejectLabel = [string]$data.rejectLabel }
        if ($data.replyLabel) { $replyLabel = [string]$data.replyLabel }
        if ($data.replyPlaceholder) { $replyPlaceholder = [string]$data.replyPlaceholder }
        if ($data.quickReply) { $quickReply = [bool]$data.quickReply }
    }
    catch { }
}
if (-not $Title) { $Title = if ($env:DSH_TOAST_TITLE) { $env:DSH_TOAST_TITLE } else { 'DeepSeek Harness' } }
if (-not $Message) { $Message = if ($env:DSH_TOAST_MESSAGE) { $env:DSH_TOAST_MESSAGE } else { '' } }

# ---- ensure Start Menu shortcut with AppUserModelID + ToastActivatorCLSID ----
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
    [ShortcutAppId]::SetToastActivator($lnk, 'B7A8E4F2-1C3D-4E5F-8A9B-0C1D2E3F4A5B')
}
catch {
    Write-Warning "AUMID shortcut setup skipped: $($_.Exception.Message)"
}

# ---- helpers ----
function UrlEnc([string]$s) { return [uri]::EscapeDataString($s) }
function JsonEsc([string]$s) {
    $s = $s.Replace('\','\\').Replace('"','\"')
    $s = $s.Replace("`r",'\r').Replace("`n",'\n').Replace("`t",'\t')
    return $s
}

# ---- build toast XML ----
$safeTitle = [Security.SecurityElement]::Escape($Title)
$safeMsg = [Security.SecurityElement]::Escape($Message)
$safeTools = [Security.SecurityElement]::Escape($tools)

$launchJson = '{"action":"open"'
if ($sessionId) { $launchJson += ',"sessionId":"' + (JsonEsc $sessionId) + '"' }
$launchJson += '}'

$xmlText = "<?xml version='1.0' encoding='utf-8'?><toast launch='" + (UrlEnc $launchJson) + "'>"
$xmlText += "<visual><binding template='ToastGeneric'>"
$xmlText += "<text>$safeTitle</text>"
if ($kind -eq 'turn') {
    if ($safeMsg) { $xmlText += "<text>$safeMsg</text>" }
    if ($safeTools) { $xmlText += "<text>$safeTools</text>" }
}
else {
    if ($safeMsg) { $xmlText += "<text>$safeMsg</text>" }
}
$xmlText += "</binding></visual>"

if ($kind -eq 'turn' -and $quickReply) {
    $replyArgs = '{"action":"reply","sessionId":"' + (JsonEsc $sessionId) + '"}'
    $xmlText += "<actions>"
    $xmlText += "<input id='reply' type='text' placeHolderContent='" + [Security.SecurityElement]::Escape($replyPlaceholder) + "'/>"
    $xmlText += "<action content='" + [Security.SecurityElement]::Escape($replyLabel) + "' arguments='" + (UrlEnc $replyArgs) + "' activationType='foreground'/>"
    $xmlText += "</actions>"
}
elseif ($kind -eq 'approval') {
    $allowArgs = '{"action":"approve","sessionId":"' + (JsonEsc $sessionId) + '","rpcId":"' + (JsonEsc $rpcId) + '","approvalId":"' + (JsonEsc $approvalId) + '"}'
    $denyArgs = '{"action":"reject","sessionId":"' + (JsonEsc $sessionId) + '","rpcId":"' + (JsonEsc $rpcId) + '","approvalId":"' + (JsonEsc $approvalId) + '"}'
    $xmlText += "<actions>"
    $xmlText += "<action content='" + [Security.SecurityElement]::Escape($approveLabel) + "' arguments='" + (UrlEnc $allowArgs) + "' activationType='foreground'/>"
    $xmlText += "<action content='" + [Security.SecurityElement]::Escape($rejectLabel) + "' arguments='" + (UrlEnc $denyArgs) + "' activationType='foreground'/>"
    $xmlText += "</actions>"
}
$xmlText += "</toast>"

# ---- show real Windows toast ----
try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
    [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($xmlText)
    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    if ($tag) { $toast.Tag = $tag }
    if ($group) { $toast.Group = $group }
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show($toast)
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
exit 0
