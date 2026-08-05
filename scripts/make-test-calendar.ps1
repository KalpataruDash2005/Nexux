# Build a minimal valid PDF containing an academic calendar as text.
$text = @"
B.Tech Semester V Academic Calendar 2026-2027
Semester Start: 2026-08-10
Semester End: 2026-12-20

Important Dates:
2026-08-10 Orientation Program
2026-08-18 TW Submission
2026-08-25 Assignment 1 - Java Programming
2026-09-01 Industrial Visit - Infosys
2026-09-07 Mid Semester Examination (Java, DBMS, CN)
2026-09-15 Hackathon 2026
2026-09-21 Internal Assessment - Software Engineering
2026-09-28 Workshop - Machine Learning
2026-10-02 Gandhi Jayanti - Holiday
2026-10-15 Project Interim Submission
2026-10-25 Placement Drive - TCS
2026-11-02 Diwali - Festival
2026-11-10 External Practical Exams
2026-11-20 End Semester Examination
2026-12-10 Convocation 2026
2026-12-18 Winter Vacation
"@

$lines = $text -split "`r?`n"
$hexBuilder = New-Object System.Text.StringBuilder
foreach ($line in $lines) {
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($line)
    foreach ($b in $bytes) { [void]$hexBuilder.Append($b.ToString("x2")) }
    [void]$hexBuilder.Append("0a")  # newline
}
$hex = $hexBuilder.ToString()

$contentStream = "BT /F1 9 Tf 40 760 Td <$hex> Tj ET"
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

$out = Join-Path $env:TEMP "careeros-academic-calendar.pdf"
[System.IO.File]::WriteAllText($out, $sb.ToString(), [System.Text.Encoding]::ASCII)
Write-Output "wrote $out ($((Get-Item $out).Length) bytes)"
