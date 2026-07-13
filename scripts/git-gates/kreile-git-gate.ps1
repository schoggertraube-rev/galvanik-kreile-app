param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet('commit', 'push')]
    [string]$Mode,

    [switch]$Preflight
)

function Write-GateLog {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateSet('ALLOW', 'BLOCK')]
        [string]$Decision,

        [Parameter(Mandatory=$true)]
        [string]$Class,

        [string]$Message = ''
    )

    if ($Message) {
        Write-Host "KREILE_GIT_GATE: ${Decision}:${Class} $Message"
    } else {
        Write-Host "KREILE_GIT_GATE: ${Decision}:${Class}"
    }
}

function Resolve-GitPath {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,

        [Parameter(Mandatory=$true)]
        [string]$RepoRoot
    )

    $ResolvedPathOutput = @(& git rev-parse --git-path $Name 2>$null)
    if ($LASTEXITCODE -ne 0 -or $ResolvedPathOutput.Count -eq 0) {
        return $null
    }

    $ResolvedPath = ([string]$ResolvedPathOutput[0]).Trim()
    if (-not [System.IO.Path]::IsPathRooted($ResolvedPath)) {
        $ResolvedPath = Join-Path $RepoRoot $ResolvedPath
    }

    return $ResolvedPath
}

# Class 1: the guard is valid only in the WerkstattCockpit app workspace.
$RepoRootOutput = @(& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or $RepoRootOutput.Count -eq 0) {
    Write-GateLog -Decision 'BLOCK' -Class 'WORKSPACE' -Message 'git rev-parse --show-toplevel failed.'
    exit 1
}

$RepoRoot = ([string]$RepoRootOutput[0]).Trim()
$RepoRootLeaf = Split-Path -Leaf ($RepoRoot -replace '/', '\')
if ($RepoRootLeaf -ne '02_app') {
    Write-GateLog -Decision 'BLOCK' -Class 'WORKSPACE' -Message "repo root leaf is '$RepoRootLeaf' (root '$RepoRoot')."
    exit 1
}
Write-GateLog -Decision 'ALLOW' -Class 'WORKSPACE' -Message "repo root leaf is '$RepoRootLeaf' (root '$RepoRoot')."

# Class 2: verify the expected application, and verify Vitest only for push.
$PackageJsonPath = Join-Path $RepoRoot 'package.json'
try {
    $PackageJson = Get-Content -Raw -LiteralPath $PackageJsonPath | ConvertFrom-Json
    $PackageName = [string]$PackageJson.name
} catch {
    Write-GateLog -Decision 'BLOCK' -Class 'ENV_MISMATCH' -Message "cannot read package.json name: $($_.Exception.Message)"
    exit 1
}

if ($PackageName -ne 'next_app') {
    Write-GateLog -Decision 'BLOCK' -Class 'ENV_MISMATCH' -Message "package.json name is '$PackageName', expected 'next_app'."
    exit 1
}

if ($Mode -eq 'push') {
    $VitestVersionOutput = @(& npx.cmd vitest --version 2>&1)
    $VitestExitCode = $LASTEXITCODE
    $VitestVersion = (($VitestVersionOutput | ForEach-Object { [string]$_ }) -join ' ').Trim()
    if ($VitestExitCode -ne 0 -or $VitestVersion -notmatch '^vitest/4\.1\.7(?:\s|$)') {
        Write-GateLog -Decision 'BLOCK' -Class 'ENV_MISMATCH' -Message "vitest check failed (exit $VitestExitCode, output '$VitestVersion')."
        exit 1
    }

    Write-GateLog -Decision 'ALLOW' -Class 'ENV' -Message "package.json name is '$PackageName'; $VitestVersion."
} else {
    Write-GateLog -Decision 'ALLOW' -Class 'ENV' -Message "package.json name is '$PackageName'; Vitest check skipped in commit mode."
}

# Class 3: inspect the staged index version of every non-deleted src file.
# core.quotePath=false keeps non-ASCII paths usable as index pathspecs, while
# diff-filter=d excludes staged deletions because they have no index blob to read.
$StagedSrcFiles = @(& git -c core.quotePath=false diff --cached --name-only --diff-filter=d -- src/)
if ($LASTEXITCODE -ne 0) {
    Write-GateLog -Decision 'BLOCK' -Class 'KERNREGEL' -Message 'cannot list staged src files.'
    exit 1
}

$KernelPattern = '(?i)(math\.random|\bmock\b|\bmock[a-z0-9_]+|\bdemo\b|placeholder)'
$ExcludedPattern = '(?i)(^|[/\\])[^/\\]+\.(test|spec|stories)\.[^/\\]+$'
$KernelHits = New-Object System.Collections.Generic.List[string]
$ExcludedCount = 0

foreach ($StagedSrcFileValue in $StagedSrcFiles) {
    $StagedSrcFile = [string]$StagedSrcFileValue
    if (-not $StagedSrcFile) {
        continue
    }

    if ($StagedSrcFile -match $ExcludedPattern) {
        $ExcludedCount++
        continue
    }

    $IndexLines = @(& git show ":$StagedSrcFile")
    $IndexReadExitCode = $LASTEXITCODE
    if ($IndexReadExitCode -ne 0) {
        Write-GateLog -Decision 'BLOCK' -Class 'KERNREGEL' -Message "cannot read staged index content for '$StagedSrcFile' (git show exit $IndexReadExitCode)."
        exit 1
    }

    for ($LineIndex = 0; $LineIndex -lt $IndexLines.Count; $LineIndex++) {
        $Line = [string]$IndexLines[$LineIndex]
        if ($Line -match $KernelPattern) {
            $KernelHits.Add("${StagedSrcFile}:$($LineIndex + 1): $($Line.Trim())")
        }
    }
}

$KernelOverrideFile = Resolve-GitPath -Name 'KREILE_ALLOW_KERNREGEL' -RepoRoot $RepoRoot
if (-not $KernelOverrideFile) {
    Write-GateLog -Decision 'BLOCK' -Class 'KERNREGEL' -Message 'cannot resolve single-use override path.'
    exit 1
}

$KernelOverrideExists = Test-Path -LiteralPath $KernelOverrideFile -PathType Leaf
if ($KernelHits.Count -gt 0) {
    $KernelHitText = $KernelHits -join '; '
    if (-not $KernelOverrideExists) {
        Write-GateLog -Decision 'BLOCK' -Class 'KERNREGEL' -Message $KernelHitText
        exit 1
    }

    if ($Preflight) {
        Write-GateLog -Decision 'ALLOW' -Class 'KERNREGEL' -Message "single-use override present; consumption deferred until the final gate; hits: $KernelHitText"
    } else {
        try {
            Remove-Item -LiteralPath $KernelOverrideFile -Force -ErrorAction Stop
        } catch {
            Write-GateLog -Decision 'BLOCK' -Class 'KERNREGEL' -Message "cannot consume single-use override: $($_.Exception.Message)"
            exit 1
        }
        Write-GateLog -Decision 'ALLOW' -Class 'KERNREGEL' -Message "single-use override consumed; hits: $KernelHitText"
    }
} else {
    if (-not $Preflight -and $KernelOverrideExists) {
        try {
            Remove-Item -LiteralPath $KernelOverrideFile -Force -ErrorAction Stop
        } catch {
            Write-GateLog -Decision 'BLOCK' -Class 'KERNREGEL' -Message "cannot consume unused single-use override: $($_.Exception.Message)"
            exit 1
        }
        Write-GateLog -Decision 'ALLOW' -Class 'KERNREGEL' -Message "no prohibited staged src terms; unused single-use override consumed; excluded test/story files: $ExcludedCount."
    } else {
        Write-GateLog -Decision 'ALLOW' -Class 'KERNREGEL' -Message "no prohibited staged src terms; excluded test/story files: $ExcludedCount."
    }
}

# The commit hook runs this preflight before verify:precommit. The final invocation
# repeats classes 1-3 and is the only phase allowed to consume a commit token.
if ($Preflight) {
    exit 0
}

# Class 4: consume the explicit commit/push token only after classes 1-3 pass.
if ($Mode -eq 'commit') {
    $TokenClass = 'COMMIT-FREIGABE'
    $TokenName = 'KREILE_ALLOW_COMMIT'
} else {
    $TokenClass = 'PUSH-FREIGABE'
    $TokenName = 'KREILE_ALLOW_PUSH'
}

$TokenFile = Resolve-GitPath -Name $TokenName -RepoRoot $RepoRoot
if (-not $TokenFile) {
    Write-GateLog -Decision 'BLOCK' -Class $TokenClass -Message "cannot resolve single-use $Mode token path."
    exit 1
}

if (-not (Test-Path -LiteralPath $TokenFile -PathType Leaf)) {
    Write-GateLog -Decision 'BLOCK' -Class $TokenClass -Message "$Mode requires explicit single-use token '$TokenName'."
    exit 1
}

try {
    Remove-Item -LiteralPath $TokenFile -Force -ErrorAction Stop
} catch {
    Write-GateLog -Decision 'BLOCK' -Class $TokenClass -Message "cannot consume single-use token: $($_.Exception.Message)"
    exit 1
}

Write-GateLog -Decision 'ALLOW' -Class $TokenClass -Message "$Mode allowed; single-use token consumed."
exit 0
