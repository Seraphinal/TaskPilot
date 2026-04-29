param(
  [string]$Root = (Get-Location).Path
)

$skip = @("node_modules", ".venv", ".git")

function Is-Skipped([string]$FullPath) {
  $rel = $FullPath.Substring($Root.Length).TrimStart('\')
  foreach ($s in $skip) {
    if ($rel -eq $s) { return $true }
    if ($rel.StartsWith($s + "\")) { return $true }
  }
  return $false
}

$deleted = 0

do {
  $cands =
    Get-ChildItem -LiteralPath $Root -Directory -Recurse -Force |
    Where-Object { -not (Is-Skipped $_.FullName) } |
    Where-Object { (Get-ChildItem -LiteralPath $_.FullName -Force | Measure-Object).Count -eq 0 }

  foreach ($d in $cands) {
    try {
      Remove-Item -LiteralPath $d.FullName -Force -ErrorAction Stop
      $deleted++
    } catch {
      # ignore (permissions / transient state)
    }
  }
} while ($cands.Count -gt 0)

Write-Output ("deleted_empty_dirs=" + $deleted)

