# apply.ps1 - apply the dsh skill-manager host support patch to a dsh checkout.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\host-patch\apply.ps1 [-DshDir D:\deepseek-harness] [-SkipInstall]
#
# The patch is generated as a single commit on top of dsh 0.1.0-rc.7
# (feat/skill-manager). It applies with `git apply` (working-tree changes, no
# commit). Run `pnpm install` afterwards to regenerate the lockfile with the
# new workspace packages.

param(
  [string]$DshDir = "D:\deepseek-harness",
  [switch]$SkipInstall
)
$ErrorActionPreference = "Stop"
$patch = Join-Path $PSScriptRoot "patches\0001-feat-skill-manager-host.patch"
if (-not (Test-Path -LiteralPath $patch)) { throw "patch not found: $patch" }
if (-not (Test-Path -LiteralPath (Join-Path $DshDir ".git"))) { throw "not a git checkout: $DshDir" }

Push-Location $DshDir
try {
  $st = git status --porcelain
  if ($st) {
    Write-Warning ("Working tree is NOT clean ({0} change(s)). Refusing to apply to avoid clobbering your work." -f @($st).Count)
    Write-Warning "Commit or stash first, then rerun."
    exit 1
  }
  Write-Host "== git apply --check =="
  git apply --check $patch
  if ($LASTEXITCODE -ne 0) { throw "git apply --check failed; the patch may need manual rebasing." }
  Write-Host "== git apply =="
  git apply $patch
  if ($LASTEXITCODE -ne 0) { throw "git apply failed." }
  if (-not $SkipInstall) {
    Write-Host "== corepack pnpm install (regenerates lockfile) =="
    corepack pnpm install
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed." }
  }
  Write-Host ""
  Write-Host "Done. Next steps:"
  Write-Host "  1) restart dsh:  corepack pnpm dsh web"
  Write-Host "  2) install the plugin:  corepack pnpm dsh plugin --profile web add <this repo>/dsh-skill-manager"
  Write-Host "  3) per-workspace skill config (.dsh/skills.json) syncs with your project git."
}
finally { Pop-Location }
