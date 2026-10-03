param([string]$ArchiveDirectory = (Join-Path $PSScriptRoot '../../releases/rigui-20261003-r1'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskDirectory = (Resolve-Path -LiteralPath $ArchiveDirectory).Path
$taskManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $taskDirectory 'archive-manifest.json') | ConvertFrom-Json
if ($taskManifest.version -notin @('20261003-r1','20261003-r5')) { throw 'Unknown accepted archive version' }
$taskVersion = $taskManifest.version
$taskReleaseDocument = if ($taskManifest.releaseDocument) { $taskManifest.releaseDocument } else { 'RELEASE-20261003.md' }
$taskSha = [System.Security.Cryptography.SHA256]::Create()
$taskWebZip = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $taskDirectory "rigui-$taskVersion-web.zip"))
try {
    $taskEntries = @{}
    foreach ($taskEntry in $taskWebZip.Entries) {
        $taskName = $taskEntry.FullName.Replace('\','/')
        if ($taskName.EndsWith('/')) { continue }
        if ($taskEntries.ContainsKey($taskName)) { throw "Duplicate ZIP entry: $taskName" }
        $taskEntries[$taskName] = $taskEntry
    }
    if ($taskEntries.Count -ne $taskManifest.files.Count) { throw 'Unexpected deployment ZIP entries' }
    foreach ($taskRecord in $taskManifest.files) {
        if (-not $taskEntries.ContainsKey($taskRecord.path)) { throw "Missing ZIP file: $($taskRecord.path)" }
        $taskStream = $taskEntries[$taskRecord.path].Open()
        try { $taskHash = [BitConverter]::ToString($taskSha.ComputeHash($taskStream)).Replace('-','').ToLowerInvariant() } finally { $taskStream.Dispose() }
        if ($taskHash -ne $taskRecord.sha256 -or $taskEntries[$taskRecord.path].Length -ne $taskRecord.bytes) { throw "ZIP hash or size mismatch: $($taskRecord.path)" }
    }
    if (-not $taskEntries.ContainsKey('index.html')) { throw 'index.html must be at ZIP root' }
} finally { $taskWebZip.Dispose(); $taskSha.Dispose() }
foreach ($taskPackage in $taskManifest.packages) {
    $taskPackagePath = Join-Path $taskDirectory $taskPackage.path
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $taskPackagePath).Hash.ToLowerInvariant() -ne $taskPackage.sha256) { throw "Package hash mismatch: $($taskPackage.path)" }
}
$taskSourceZip = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $taskDirectory "rigui-$taskVersion-source.zip"))
$taskSourceSha = [System.Security.Cryptography.SHA256]::Create()
try {
    $taskSourceEntries = @($taskSourceZip.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
    $taskSourceLookup = @{}
    foreach ($taskEntry in $taskSourceZip.Entries) {
        $taskName = $taskEntry.FullName.Replace('\','/')
        if ($taskName.EndsWith('/')) { continue }
        if ($taskSourceLookup.ContainsKey($taskName)) { throw "Duplicate source ZIP entry: $taskName" }
        $taskSourceLookup[$taskName] = $taskEntry
    }
    if ($taskSourceLookup.Count -ne $taskManifest.sourceFiles.Count) { throw 'Unexpected source ZIP entries' }
    foreach ($taskRecord in $taskManifest.sourceFiles) {
        if (-not $taskSourceLookup.ContainsKey($taskRecord.path)) { throw "Missing source ZIP file: $($taskRecord.path)" }
        $taskStream = $taskSourceLookup[$taskRecord.path].Open()
        try { $taskHash = [BitConverter]::ToString($taskSourceSha.ComputeHash($taskStream)).Replace('-','').ToLowerInvariant() } finally { $taskStream.Dispose() }
        if ($taskHash -ne $taskRecord.sha256 -or $taskSourceLookup[$taskRecord.path].Length -ne $taskRecord.bytes) { throw "Source ZIP hash or size mismatch: $($taskRecord.path)" }
    }
    foreach ($taskRequired in @('index.html','package.json','src/app2.js','tests/exchange-feedback.test.mjs',$taskReleaseDocument,'DEVICE-QA.md','scripts/archive-release.mjs')) {
        if ($taskRequired -notin $taskSourceEntries) { throw "Missing source file: $taskRequired" }
    }
    if (@($taskSourceEntries | Where-Object { $_ -match '^(qa/|dist/|node_modules/|\.git/)' }).Count -gt 0) { throw 'Private or generated content found in source ZIP' }
} finally { $taskSourceZip.Dispose(); $taskSourceSha.Dispose() }
$taskReportPath = Join-Path $taskDirectory 'verification.json'
$taskReport = Get-Content -Raw -Encoding UTF8 -LiteralPath $taskReportPath | ConvertFrom-Json
$taskReport.zipReadback = "Passed: $($taskManifest.files.Count) deployment files and $($taskManifest.sourceFiles.Count) source files verified by SHA-256, root index.html present; source ZIP required files and exclusions verified"
$taskReport | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 -LiteralPath $taskReportPath
Write-Output $taskReport.zipReadback
