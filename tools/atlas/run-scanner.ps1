param([string]$RepoRoot = "C:\code\truvern")
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $RepoRoot
& node "tools\atlas\repository-scanner.mjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
