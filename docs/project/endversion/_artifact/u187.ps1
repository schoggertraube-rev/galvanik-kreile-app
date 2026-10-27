$d='C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\docs\project\endversion'
"index kundenliste: " + (Select-String -Path "$d\index.html" -Pattern 'kundenliste').Count
"spec kundenliste: " + (Select-String -Path "$d\spec.json" -Pattern 'kundenliste').Count
"css ev-kkarte: " + (Select-String -Path "$d\ui_ergaenzung.css" -Pattern 'ev-kkarte').Count
Set-Location $d
node werkzeuge/bauen.mjs 2>&1 | Select-Object -Last 4
$f="$d\ENTSCHEIDUNGEN_UI.md"
$t=[IO.File]::ReadAllText($f,[Text.Encoding]::UTF8)
if(-not $t.Contains('| U-187 |')){
  $lines=$t -split "`n"; $i=-1
  for($n=0;$n -lt $lines.Count;$n++){ if($lines[$n].StartsWith('| U-186 |')){$i=$n} }
  if($i -ge 0){
    $neu='| U-187 | Kunden (Seite 5): Kundenkarte = Standard-Baustein wie Auftragskarte (Kürzel-Kreis, Name · K-Nr, Ansprechpartner · Ort · aktive Aufträge; Aktionen Neuer Auftrag · Mail · Öffnen). Oranges Ausrufezeichen = Achtung (ungelesene Mails, Terminkonflikt, Verhalten/Eigenheit, Zahlungsmoral, fehlende Pflichtdaten); Gründe in einer Zeile, solche Kunden oben. Filter Alle · Mit Hinweis · Unvollständig. Werkstatt sieht keine Geld-Gründe. | Owner 2026-10-27 |'
    $lines=$lines[0..$i]+$neu+$lines[($i+1)..($lines.Count-1)]
    [IO.File]::WriteAllText($f,($lines -join "`n"),(New-Object Text.UTF8Encoding $false)); 'U-187 eingetragen'
  } else {'U-186 nicht gefunden'}
} else {'U-187 vorhanden'}
