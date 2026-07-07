param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('commit', 'push')]
    [string]$Mode
)

# Resolve git directory
$GitDir = git rev-parse --git-dir
if (-not $GitDir) {
    Write-Error "Not a git repository."
    exit 1
}

$TokenFile = ""
if ($Mode -eq 'commit') {
    $TokenFile = "$GitDir/KREILE_ALLOW_COMMIT"
} elseif ($Mode -eq 'push') {
    $TokenFile = "$GitDir/KREILE_ALLOW_PUSH"
}

if (-not (Test-Path $TokenFile)) {
    Write-Host "KREILE_GIT_GATE_BLOCKED: $Mode requires explicit main-chat gate token."
    exit 1
}

Remove-Item -Path $TokenFile -Force
Write-Host "KREILE_GIT_GATE: $Mode allowed. Token consumed."
exit 0
