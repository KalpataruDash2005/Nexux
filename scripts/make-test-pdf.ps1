# Build a minimal valid PDF from ASCII text using hex-string content streams.
$text = @"
Introduction to Photosynthesis

Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy. It occurs mainly in the chloroplasts of plant cells, which contain the green pigment chlorophyll.

The overall equation for photosynthesis is carbon dioxide plus water, in the presence of sunlight, producing glucose and oxygen. Plants absorb carbon dioxide from the atmosphere through small pores called stomata located on the underside of leaves.

The light-dependent reactions happen in the thylakoid membranes of the chloroplast. Here, light energy splits water molecules, releasing oxygen gas as a byproduct. The energy harvested is stored in the molecules ATP and NADPH.

The Calvin cycle, also called the light-independent reactions, takes place in the stroma of the chloroplast. It uses ATP and NADPH to convert carbon dioxide into glucose. This cycle can proceed even in the absence of light, as long as the required energy carriers are available.

Factors that affect the rate of photosynthesis include light intensity, carbon dioxide concentration, and temperature. Generally, increasing light intensity raises the rate until a saturation point is reached. Temperature extremes can damage the enzymes involved in the process.

Photosynthesis is fundamental to life on Earth because it produces oxygen and is the base of nearly every food chain. Understanding this process is essential for improving crop yields and addressing climate change.
"@

$lines = $text -split "`r?`n"
$hexBuilder = New-Object System.Text.StringBuilder
foreach ($line in $lines) {
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($line)
    foreach ($b in $bytes) { [void]$hexBuilder.Append($b.ToString("x2")) }
    [void]$hexBuilder.Append("0a")  # newline
}
$hex = $hexBuilder.ToString()

$contentStream = "BT /F1 11 Tf 50 750 Td <$hex> Tj ET"
$contentLen = [System.Text.Encoding]::ASCII.GetByteCount($contentStream)

$objs = @()
$objs += "<< /Type /Catalog /Pages 2 0 R >>"
$objs += "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
$objs += "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
$objs += "<< /Length $contentLen >>`nstream`n$contentStream`nendstream"
$objs += "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("%PDF-1.4")
$offsets = @()
for ($i = 0; $i -lt $objs.Count; $i++) {
    $offsets += $sb.Length
    $body = ($i + 1).ToString() + " 0 obj`n" + $objs[$i] + "`nendobj"
    [void]$sb.AppendLine($body)
}
$xrefPos = $sb.Length
$count = $objs.Count + 1
[void]$sb.AppendLine("xref")
[void]$sb.AppendLine("0 $count")
[void]$sb.AppendLine("0000000000 65535 f ")
for ($i = 0; $i -lt $offsets.Count; $i++) {
    [void]$sb.AppendLine($offsets[$i].ToString("0000000000") + " 00000 n ")
}
[void]$sb.AppendLine("trailer")
[void]$sb.AppendLine("<< /Size $count /Root 1 0 R >>")
[void]$sb.AppendLine("startxref")
[void]$sb.AppendLine($xrefPos.ToString())
[void]$sb.Append("%%EOF")

$out = Join-Path $env:TEMP "careeros-test.pdf"
[System.IO.File]::WriteAllText($out, $sb.ToString(), [System.Text.Encoding]::ASCII)
Write-Output "wrote $out ($((Get-Item $out).Length) bytes)"
