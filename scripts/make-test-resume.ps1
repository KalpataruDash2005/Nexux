# Build a minimal valid PDF containing a sample resume as text.
$text = @"
ARJUN SHARMA
arjun.sharma@gmail.com | +91 98765 43210 | Bengaluru, India
LinkedIn: linkedin.com/in/arjunsharma | GitHub: github.com/arjunsharma

B.Tech in Computer Science and Engineering
National Institute of Technology, Rourkela | 2022 - 2026 | CGPA: 8.7 / 10

SKILLS
Languages: Java, Python, JavaScript, SQL
Frameworks: Spring Boot, Hibernate, React, Node.js
Tools: Docker, Kubernetes, MySQL, PostgreSQL, Git, Linux
Concepts: Data Structures & Algorithms, OOP, REST APIs, Microservices

PROJECTS
1. Campus Connect - A full-stack placement management platform
   Built with Spring Boot and React. Implemented JWT authentication, role-based access,
   and a REST API serving 40+ endpoints. Reduced manual tracking effort by 60%.
2. Smart Attendance using Face Recognition
   Used Python, OpenCV, and a CNN to recognize faces and mark attendance automatically.
   Achieved 94% accuracy on a test set of 200 images.
3. Expense Tracker CLI - A command-line budget tracker in Java with CSV persistence,
   category-wise reports, and monthly summaries.

INTERNSHIP
Software Engineering Intern - TechNova Solutions (Remote) | May 2025 - Jul 2025
- Developed REST APIs for an e-commerce backend using Spring Boot and MySQL.
- Wrote unit tests with JUnit and Mockito, achieving 85% line coverage.
- Refactored a legacy module, improving response times by 30%.

ACHIEVEMENTS & EXTRA-CURRICULAR
- Solved 350+ DSA problems on LeetCode (top 12%).
- Core member of the Coding Club; mentored 40 juniors in Java.
- Won 2nd prize in the university Hackathon 2025 (24-hour build).

CERTIFICATIONS
- Oracle Certified Associate, Java SE 8 Programmer
- AWS Certified Cloud Practitioner
- Complete Machine Learning Bootcamp (Udemy)

RESUME OBJECTIVE
Seeking a Software Development Engineer role in a product-based company where I can
apply my skills in Java, Spring Boot, and distributed systems to build scalable software.
"@

$lines = $text -split "`r?`n"
$hexBuilder = New-Object System.Text.StringBuilder
foreach ($line in $lines) {
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($line)
    foreach ($b in $bytes) { [void]$hexBuilder.Append($b.ToString("x2")) }
    [void]$hexBuilder.Append("0a")  # newline
}
$hex = $hexBuilder.ToString()

$contentStream = "BT /F1 8 Tf 40 760 Td <$hex> Tj ET"
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

$out = Join-Path $env:TEMP "careeros-test-resume.pdf"
[System.IO.File]::WriteAllText($out, $sb.ToString(), [System.Text.Encoding]::ASCII)
Write-Output "wrote $out ($((Get-Item $out).Length) bytes)"
