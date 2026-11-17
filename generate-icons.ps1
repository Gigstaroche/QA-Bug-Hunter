Add-Type -AssemblyName System.Drawing

$iconsDir = 'c:\Users\Admin\Downloads\FelixMutaiResumes\qa-bug-finder-extension\icons'
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

function Generate-Icon {
    param (
        [int]$size,
        [string]$outputFile
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Dark background rounded circle
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
    $g.FillEllipse($bgBrush, 1, 1, $size - 2, $size - 2)

    # Sky blue outer glow ring
    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(56, 189, 248), [Math]::Max(1.0, $size * 0.05))
    $g.DrawEllipse($ringPen, 1, 1, $size - 2, $size - 2)

    # Red Ladybug body
    $bugBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 68, 68))
    $bx = [float]($size * 0.26)
    $by = [float]($size * 0.32)
    $bw = [float]($size * 0.48)
    $bh = [float]($size * 0.48)
    $g.FillEllipse($bugBrush, $bx, $by, $bw, $bh)

    # Bug head
    $headBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 245, 249))
    $hx = [float]($size * 0.38)
    $hy = [float]($size * 0.18)
    $hw = [float]($size * 0.24)
    $hh = [float]($size * 0.22)
    $g.FillEllipse($headBrush, $hx, $hy, $hw, $hh)

    # Center division line
    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(15, 23, 42), [Math]::Max(1.0, $size * 0.04))
    $g.DrawLine($linePen, [float]($size * 0.5), [float]($size * 0.35), [float]($size * 0.5), [float]($size * 0.78))

    # Magnifying glass circle on bottom right
    $glassPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(56, 189, 248), [Math]::Max(1.5, $size * 0.08))
    $gx = [float]($size * 0.48)
    $gy = [float]($size * 0.48)
    $gw = [float]($size * 0.38)
    $gh = [float]($size * 0.38)
    $g.DrawEllipse($glassPen, $gx, $gy, $gw, $gh)

    # Glass handle
    $g.DrawLine($glassPen, [float]($size * 0.78), [float]($size * 0.78), [float]($size * 0.94), [float]($size * 0.94))

    $g.Dispose()
    $bmp.Save($outputFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Generate-Icon -size 16 -outputFile "$iconsDir\icon16.png"
Generate-Icon -size 32 -outputFile "$iconsDir\icon32.png"
Generate-Icon -size 48 -outputFile "$iconsDir\icon48.png"
Generate-Icon -size 128 -outputFile "$iconsDir\icon128.png"

Write-Host "Icons generated successfully in $iconsDir"
