# Build a "scanned" PDF: text rendered as an image (no extractable text layer),
# embedded in a minimal PDF with a DCTDecode XObject. Use to exercise OCR path.
Add-Type -AssemblyName System.Drawing

$text = "Introduction to Photosynthesis`n`n" +
        "Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy. It occurs mainly in the chloroplasts of plant cells, which contain the green pigment chlorophyll.`n`n" +
        "The overall equation for photosynthesis is carbon dioxide plus water, in the presence of sunlight, producing glucose and oxygen. Plants absorb carbon dioxide through small pores called stomata located on the underside of leaves.`n`n" +
        "The light-dependent reactions happen in the thylakoid membranes of the chloroplast. Light energy splits water molecules, releasing oxygen gas as a byproduct. The energy harvested is stored in ATP and NADPH.`n`n" +
        "The Calvin cycle, also called the light-independent reactions, takes place in the stroma of the chloroplast. It uses ATP and NADPH to convert carbon dioxide into glucose. This cycle can proceed without light when energy carriers are available.`n`n" +
        "Factors that affect the rate of photosynthesis include light intensity, carbon dioxide concentration, temperature, and water availability. Photosynthesis is fundamental to life because it produces oxygen and forms the base of nearly every food chain."

$fontSize = 30
$margin = 48
$canvasWidth = 1240
$font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$measureBmp = New-Object System.Drawing.Bitmap(1, 1)
$measureGfx = [System.Drawing.Graphics]::FromImage($measureBmp)

# Estimate required height by wrapping text into lines.
$prop = $measureGfx.MeasureString("M", $font, [System.Drawing.PointF]::Empty, [System.Drawing.StringFormat]::GenericTypographic)
$lineHeight = $prop.Height * 1.4
$maxWidth = $canvasWidth - (2 * $margin)
$lines = New-Object System.Collections.Generic.List[string]
foreach ($para in ($text -split "`n")) {
    $current = ""
    foreach ($word in ($para -split " ")) {
        $attempt = if ($current) { "$current $word" } else { $word }
        $w = $measureGfx.MeasureString($attempt, $font).Width
        if ($w -le $maxWidth -or $current -eq "") {
            $current = $attempt
        } else {
            $lines.Add($current)
            $current = $word
        }
    }
    if ($current) { $lines.Add($current) }
}
$canvasHeight = [int](($lines.Count * $lineHeight) + (2 * $margin))
$measureGfx.Dispose()
$measureBmp.Dispose()

# Render text onto white page.
$bmp = New-Object System.Drawing.Bitmap($canvasWidth, $canvasHeight)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$gfx.Clear([System.Drawing.Color]::White)
$y = $margin
foreach ($line in $lines) {
    $gfx.DrawString($line, $font, [System.Drawing.Brushes]::Black, ($margin * 1.0), ($y * 1.0))
    $y += $lineHeight
}
$gfx.Dispose()

$jpgPath = Join-Path $env:TEMP "scanned-page.jpg"
$bmp.Save($jpgPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()

$jpegBytes = [System.IO.File]::ReadAllBytes($jpgPath)
$width = $canvasWidth
$height = $canvasHeight

# Minimal single-page PDF with the JPEG embedded as a DCTDecode XObject.
$contentStream = "q $width 0 0 $height 0 0 cm /Im0 Do Q"
$contentBytes = [System.Text.Encoding]::ASCII.GetBytes($contentStream)

$objs = New-Object System.Collections.Generic.List[string]
$objs.Add("<< /Type /Catalog /Pages 2 0 R >>")
$objs.Add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
$objs.Add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $width $height] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>")
$objs.Add("<< /Length $($contentBytes.Length) >>`nstream`n$contentStream`nendstream")
$objs.Add("<< /Type /XObject /Subtype /Image /Width $width /Height $height /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length $($jpegBytes.Length) >>")

$out = Join-Path $env:TEMP "careeros-scanned.pdf"
$fs = [System.IO.File]::Create($out)
$ascii = [System.Text.Encoding]::ASCII
$writeA = { param($s) $b = $ascii.GetBytes($s); $fs.Write($b, 0, $b.Length) }

& $writeA "%PDF-1.4`n"
$offsets = New-Object System.Collections.Generic.List[int]
for ($i = 0; $i -lt $objs.Count; $i++) {
    $offsets.Add([int]$fs.Position)
    & $writeA (($i + 1).ToString() + " 0 obj`n" + $objs[$i] + "`n")
    if ($i -eq 4) {
        # Write the image stream binary between its stream/endstream markers.
        & $writeA "stream`n"
        $fs.Write($jpegBytes, 0, $jpegBytes.Length)
        & $writeA "`nendstream"
    }
    & $writeA "endobj`n"
}
$xrefPos = [int]$fs.Position
$a = "xref`n0 $($objs.Count + 1)`n0000000000 65535 f `n"
foreach ($o in $offsets) { $a += $o.ToString("0000000000") + " 00000 n `n" }
$a += "trailer`n<< /Size $($objs.Count + 1) /Root 1 0 R >>`nstartxref`n$xrefPos`n%%EOF"
& $writeA $a
$fs.Close()

Write-Output "wrote $out ($((Get-Item $out).Length) bytes), JPEG $($jpegBytes.Length) bytes, page ${width}x${height}"