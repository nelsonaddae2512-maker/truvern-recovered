param(
  [string[]] $Roots = @(".\app", ".\lib"),
  [string[]] $Pattern = @(
    "ensureVendorSnapshotSealed",
    "sealedHash",
    "sealedAt",
    "sealHash",
    "sealVersion",
    'data\s*:\s*{[^}]*sealedHash\s*:',
    'data\s*:\s*{[^}]*sealedAt\s*:'
  )
)

$repoRoot = (Get-Location).Path
$scanRoots = foreach ($r in $Roots) {
  $p = Join-Path $repoRoot $r
  if (Test-Path -LiteralPath $p) { $p }
}

Write-Host "Scanning roots:" -ForegroundColor Cyan
$scanRoots | ForEach-Object { Write-Host " - $_" }

$files = Get-ChildItem -LiteralPath $scanRoots -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in ".ts", ".tsx" } |
  Select-Object -ExpandProperty FullName

Write-Host ("Found {0} TypeScript files." -f ($files.Count)) -ForegroundColor Cyan

$hits = Select-String -LiteralPath $files -Pattern $Pattern -AllMatches -ErrorAction SilentlyContinue

if (-not $hits) {
  Write-Host "No matches found." -ForegroundColor Yellow
  exit 0
}

$hits |
  Sort-Object Path, LineNumber |
  Select-Object Path, LineNumber, Line |
  Format-Table -AutoSize
