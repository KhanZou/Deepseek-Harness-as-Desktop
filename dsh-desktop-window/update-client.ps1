# update-client.ps1 - One-click updater for the DeepSeek Harness desktop client.
#
# Pulls the latest client code from GitHub, deploys it safely to the installed
# plugin folders (D:\dsh-*), then restarts the desktop shell and the backend.
# Local data is preserved:
#   - D:\dsh-desktop-window\config.json     (desktop settings)
#   - D:\dsh-desktop-window\skins.json      (skin manifest)
#   - D:\dsh-desktop-window\.wv2-profile    (WebView2 profile / logins)
#   - D:\dsh-desktop-window\.runtime-profile
#   - C:\Users\zouke\.dsh\sessions          (conversation sessions - never touched)
#   - D:\dsh-deep-whale\...                 (user-installed skin plugins - never touched)
#
# Safety: the git checkout is NEVER hard-reset. Local commits and uncommitted
# changes are never destroyed: a clean checkout fast-forwards to origin/main,
# an ahead checkout (unpushed commits) is deployed as-is with a warning.
#
# Run from the "Desktop" settings tab, or manually:
#   powershell -NoProfile -ExecutionPolicy Bypass -File update-client.ps1
# Options:
#   -RepoDir      git checkout to pull from       (default D:\Deepseek-Harness-as-Desktop)
#   -InstallRoot  root containing the D:\dsh-*    (default D:\)
#   -NoRestart    deploy only; do not restart the stack
#   -SkipGitPull  deploy from the current checkout without fetching

param(
  [string]$RepoDir = 'D:\Deepseek-Harness-as-Desktop',
  [string]$InstallRoot = 'D:\',
  [switch]$NoRestart,
  [switch]$SkipGitPull
)

$ErrorActionPreference = 'Stop'
$env:GIT_TERMINAL_PROMPT = '0'

$pluginDir = Join-Path $InstallRoot 'dsh-desktop-window'
$logFile   = Join-Path $pluginDir 'update.log'
$lockFile  = Join-Path $pluginDir 'update.lock'
$exePath   = Join-Path $pluginDir 'shell\DshDesktop.exe'
$webPort   = 3080

# plugin folders deployed from the repo checkout
$plugins = @('dsh-desktop-window','dsh-desktop-settings','dsh-desktop-framework','dsh-skin-gallery','dsh-git-graph','dsh-live-stats')

# data / self files and dirs never overwritten while the window plugin deploys
$windowExcludeFiles = @('config.json','skins.json','restart.log','update.log','update.lock','update-client.ps1','sandbox-child-test.txt','DshDesktop.exe','*.dll')
$windowExcludeDirs  = @('.wv2-profile','.runtime-profile','sdk','.git')
$commonExcludeFiles = @('config.json','*.log','update.lock')
$commonExcludeDirs  = @('.git')

function Log($msg) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  try { Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8 } catch { }
  Write-Output $line
}

function Fail($msg) {
  Log("ERROR: $msg")
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
  exit 1
}

function Invoke-Robocopy($src, $dst, $excludeDirs, $excludeFiles) {
  $xd = @('/XD') + $excludeDirs
  $xf = @('/XF') + $excludeFiles
  & robocopy $src $dst /E @xd @xf /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
  $code = $LASTEXITCODE
  if ($code -ge 8) {
    Log("robocopy failed for $src -> $dst (exit $code)")
    return $false
  }
  return $true
}

# resolve git (fallbacks for a session without git on PATH)
function Resolve-Git {
  $candidates = @(
    'C:\Program Files\Git\cmd\git.exe',
    'C:\Program Files (x86)\Git\cmd\git.exe',
    'C:\Program Files\Git\bin\git.exe',
    'git.exe'
  )
  foreach ($c in $candidates) {
    if ($c -eq 'git.exe') {
      $cmd = Get-Command git -ErrorAction SilentlyContinue
      if ($cmd) { return $cmd.Source }
    } elseif (Test-Path -LiteralPath $c) {
      return $c
    }
  }
  return 'git.exe'
}
$gitExe = Resolve-Git

Log '=== DSH desktop client update started ==='
Log "repo=$RepoDir installRoot=$InstallRoot noRestart=$NoRestart skipPull=$SkipGitPull"

# single-instance lock
if (Test-Path -LiteralPath $lockFile) {
  Fail "Another update appears to be running (update.lock exists). If that is stale, delete $lockFile and retry."
}
try { Set-Content -LiteralPath $lockFile -Value (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -Encoding UTF8 } catch { Fail "Cannot write lock file $lockFile" }

if (-not (Test-Path -LiteralPath (Join-Path $RepoDir '.git'))) { Fail "Git checkout not found: $RepoDir" }

# ---- 1) pull latest from GitHub (safe: never destroys local work) ---------
if (-not $SkipGitPull) {
  Log 'Fetching updates from GitHub ...'
  & $gitExe -C $RepoDir fetch origin 2>&1 | ForEach-Object { Log $_ }
  if ($LASTEXITCODE -ne 0) { Fail 'git fetch failed' }

  $head   = (& $gitExe -C $RepoDir rev-parse HEAD 2>$null).Trim()
  $origin = (& $gitExe -C $RepoDir rev-parse origin/main 2>$null).Trim()
  # tracked modifications only (untracked files never block)
  $dirty  = (& $gitExe -C $RepoDir status --porcelain 2>$null) | Where-Object { $_ -notmatch '^\?\?' }
  if ($dirty) {
    Fail "The checkout at $RepoDir has uncommitted tracked changes; commit or stash them first."
  }
  if ($origin -and $origin -ne $head) {
    & $gitExe -C $RepoDir merge --ff-only origin/main 2>&1 | ForEach-Object { Log $_ }
    if ($LASTEXITCODE -ne 0) {
      Log "Local checkout is ahead of origin/main (unpushed commits) - deploying the local checkout. Push to GitHub when ready so future updates can fast-forward."
    } else {
      $newHead = (& $gitExe -C $RepoDir rev-parse HEAD 2>$null).Trim()
      if ($newHead -eq $origin) { Log 'Updated to origin/main.' } else { Log "Deploying local checkout (ahead of origin/main). Push to GitHub when ready so future updates can fast-forward." }
    }
  } else {
    Log 'Already up to date with origin/main.'
  }
}

# ---- 2) deploy plugins ---------------------------------------------------
foreach ($p in $plugins) {
  $src = Join-Path $RepoDir $p
  $dst = Join-Path $InstallRoot $p
  if (-not (Test-Path -LiteralPath $src)) {
    Log("WARNING: repo folder missing: $src (skipped)")
    continue
  }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Log "Deploying $p ..."
  if ($p -eq 'dsh-desktop-window') {
    if (-not (Invoke-Robocopy $src $dst $windowExcludeDirs $windowExcludeFiles)) { Fail "Deploy failed for $p" }
  } else {
    if (-not (Invoke-Robocopy $src $dst $commonExcludeDirs $commonExcludeFiles)) { Fail "Deploy failed for $p" }
  }
}
Log 'Deployment finished.'

if ($NoRestart) {
  Log 'NoRestart set: skipping restart (files are deployed).'
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
  Log '=== update done (no restart) ==='
  exit 0
}

# ---- 3) restart the stack ------------------------------------------------
Log 'Restarting desktop shell and backend ...'

# 3a) stop the old desktop shell
Get-Process -Name 'DshDesktop' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Log 'Old desktop shell stopped.'

# 3b) stop the old backend (whatever listens on the web port)
$conn = Get-NetTCPConnection -LocalPort $webPort -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  foreach ($p in ($conn.OwningProcess | Select-Object -Unique)) {
    try {
      & taskkill /PID $p /T /F 2>&1 | Out-Null
      Log "Backend PID $p stopped."
    } catch {
      Log "Backend PID $p stop failed: $($_.Exception.Message)"
    }
  }
} else {
  Log "No backend process found on port $webPort."
}
Start-Sleep -Seconds 3

# 3c) copy shell binaries (exe + dlls) now that nothing is locked
$shellSrc = Join-Path $RepoDir 'dsh-desktop-window\shell'
$shellDst = Join-Path $pluginDir 'shell'
New-Item -ItemType Directory -Force -Path $shellDst | Out-Null
& robocopy $shellSrc $shellDst /E /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Fail 'Copying shell binaries failed' }

# 3d) refresh the updater itself: rename the running file, then copy the new
#     one. Renaming a running .ps1 is allowed on Windows; overwriting is not.
$updSrc = Join-Path $RepoDir 'dsh-desktop-window\update-client.ps1'
$updDst = Join-Path $pluginDir 'update-client.ps1'
$updCopied = $false
if (Test-Path -LiteralPath $updSrc) {
  for ($i = 0; $i -lt 4; $i++) {
    try {
      $oldDst = "$updDst.old"
      Remove-Item -LiteralPath $oldDst -Force -ErrorAction SilentlyContinue
      if (Test-Path -LiteralPath $updDst) { Rename-Item -LiteralPath $updDst -NewName (Split-Path $oldDst -Leaf) -Force -ErrorAction Stop }
      Copy-Item -LiteralPath $updSrc -Destination $updDst -Force -ErrorAction Stop
      Remove-Item -LiteralPath $oldDst -Force -ErrorAction SilentlyContinue
      $updCopied = $true
      break
    } catch {
      Start-Sleep -Milliseconds 800
    }
  }
  if (-not $updCopied) { Log 'WARNING: could not refresh update-client.ps1 (will take effect next update)' }
}

# 3e) launch the new shell (auto-starts the backend via serverWorkDir)
if (Test-Path -LiteralPath $exePath) {
  Start-Process -FilePath $exePath
  Log 'New desktop shell launched.'
} else {
  Log 'WARNING: DshDesktop.exe not found after deploy; start it manually.'
}

Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
Log '=== update done ==='
