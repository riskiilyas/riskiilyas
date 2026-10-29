<#
.SYNOPSIS
    Draws and animates the profile README's pictures and writes them to assets\.

.DESCRIPTION
    scene.mjs lays every part out as SVG and writes the motion as an EffectCraft script. Then, each headless:
      VectorCraft   opens each part (and each brand icon in icons\), saves it as a .vectorcraft and exports a 2x PNG
      PhotoCraft    softens the glows (Gaussian blur)
      EffectCraft   builds the animation (out\profile.ecproj) and renders each comp as a PNG sequence
      gif.mjs       packs each sequence into a small looping GIF (one palette, changed rectangles only)
    Results: assets\hero.gif, assets\stack-orbit.gif, assets\divider.gif (+ assets\stack-matrix.svg from scene.mjs).

    Needs: node, and the Craft tools under Program Files. out\ is scratch and not committed.
#>
[CmdletBinding()]
param(
    # Only these comps (hero, stack-orbit, divider); all when left out.
    [string[]] $Comp
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $here 'out'
$assets = Join-Path $here '..\assets'
$utf8 = New-Object Text.UTF8Encoding($false)

$vector = Join-Path $env:ProgramFiles 'VectorCraft\vectorcraft-cli.exe'
$photo = Join-Path $env:ProgramFiles 'PhotoCraft\photocraft-cli.exe'
$effect = Join-Path $env:ProgramFiles 'EffectCraft\effectcraft-cli.exe'
foreach ($tool in $vector, $photo, $effect) { if (-not (Test-Path $tool)) { throw "Not installed here: $tool" } }

function Fwd([string] $path) { return $path.Replace('\', '/') }
function Tool([string] $exe) {
    $saved = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { return (& $exe @args 2>&1 | Out-String) } finally { $ErrorActionPreference = $saved }
}

foreach ($dir in 'png', 'vectorcraft', 'glow') {
    $p = Join-Path $out $dir
    if (Test-Path $p) { Get-ChildItem $p | Remove-Item -Recurse -Force } else { New-Item -ItemType Directory -Path $p | Out-Null }
}

# 1. The parts, as SVG, and the motion
& node (Join-Path $here 'scene.mjs')
if ($LASTEXITCODE -ne 0) { throw 'scene.mjs failed' }
$parts = Get-Content (Join-Path $out 'parts.json') -Raw | ConvertFrom-Json
$icons = Get-Content (Join-Path $out 'icons.json') -Raw | ConvertFrom-Json
$soft = Get-Content (Join-Path $out 'soft.json') -Raw | ConvertFrom-Json

# 2. VectorCraft: each part and icon as a document and a 2x PNG
$batch = New-Object Collections.ArrayList
foreach ($part in $parts) {
    [void]$batch.Add(@{ command = 'document.open'; params = @{ path = (Fwd (Join-Path $out "svg\$part.svg")) } })
    [void]$batch.Add(@{ command = 'document.save'; params = @{ path = (Fwd (Join-Path $out "vectorcraft\$part.vectorcraft")) } })
    [void]$batch.Add(@{ command = 'document.export'; params = @{ path = (Fwd (Join-Path $out "png\$part.png")); scale = 2 } })
}
foreach ($icon in $icons) {
    [void]$batch.Add(@{ command = 'document.open'; params = @{ path = (Fwd (Join-Path $here "icons\$icon.svg")) } })
    [void]$batch.Add(@{ command = 'document.export'; params = @{ path = (Fwd (Join-Path $out "png\icon-$icon.png")); scale = 2 } })
}
$file = Join-Path $out 'vectorcraft.batch.json'
[IO.File]::WriteAllText($file, (ConvertTo-Json -InputObject $batch.ToArray() -Depth 6), $utf8)
$log = Tool $vector run --commands $file
if ($log -match '"error"') { Write-Warning "VectorCraft: $($log.Trim())" }
foreach ($part in $parts) { if (-not (Test-Path (Join-Path $out "png\$part.png"))) { throw "VectorCraft drew nothing for $part`n$log" } }
Write-Host "  VectorCraft: $($parts.Count) parts, $($icons.Count) icons"

# 3. PhotoCraft: the soft ones
$n = 0
foreach ($p in $soft.PSObject.Properties) {
    $src = Join-Path $out "png\$($p.Name)-src.png"
    $dst = Join-Path $out "glow\$($p.Name).png"
    $params = '{\"radius\":' + $p.Value + '}'
    $log = Tool $photo run $src --cmd filter.blur.gaussianBlur --params $params --out $dst
    if (-not (Test-Path $dst)) { throw "PhotoCraft did not blur $($p.Name)`n$log" }
    $n++
}
Write-Host "  PhotoCraft: $n glows"

# 4. EffectCraft: the animation, kept as a project, each comp rendered as frames
$project = Join-Path $out 'profile.ecproj'
if (Test-Path $project) { Remove-Item $project }
$log = Tool $effect script (Join-Path $out 'animate.jsx') --empty --save-as (Fwd $project)
if (-not (Test-Path $project)) { throw "EffectCraft built nothing`n$log" }
Write-Host "  EffectCraft: $($log.Trim())"

$comps = if ($Comp) { $Comp } else { @('stack-orbit', 'divider') }   # hero is built only on request (-Comp hero): the README no longer shows it
$fps = Get-Content (Join-Path $out 'fps.json') -Raw | ConvertFrom-Json
if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Path $assets | Out-Null }
foreach ($c in $comps) {
    $fdir = Join-Path $out "frames-$c"
    if (Test-Path $fdir) { Get-ChildItem $fdir | Remove-Item -Force } else { New-Item -ItemType Directory -Path $fdir | Out-Null }
    $log = Tool $effect render --project (Fwd $project) --comp $c --out (Fwd (Join-Path $fdir 'f.png')) --format png
    $rendered = @(Get-ChildItem $fdir -Filter *.png)
    if ($rendered.Count -eq 0) { throw "EffectCraft rendered nothing for $c`n$log" }
    Write-Host "  EffectCraft: $c, $($rendered.Count) frames"

    # 5. The GIF
    $gif = Join-Path $assets "$c.gif"
    & node (Join-Path $here 'gif.mjs') $fdir $gif $fps.$c (Join-Path $out 'keep.json')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $gif)) { throw "gif.mjs failed for $c" }
    Write-Host "  -> assets\$c.gif ($([Math]::Round((Get-Item $gif).Length / 1KB)) KB)"
}
