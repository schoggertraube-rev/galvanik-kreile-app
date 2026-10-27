$d='C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\docs\project\endversion'
"index buchliste: " + (Select-String -Path "$d\index.html" -Pattern 'buchliste').Count
"spec buchliste: " + (Select-String -Path "$d\spec.json" -Pattern 'buchliste').Count
"css U-188: " + (Select-String -Path "$d\ui_ergaenzung.css" -Pattern 'U-188').Count
Set-Location $d
node werkzeuge/bauen.mjs 2>&1 | Select-Object -Last 3
$f="$d\ENTSCHEIDUNGEN_UI.md"
$t=[IO.File]::ReadAllText($f,[Text.Encoding]::UTF8)
$neu=@(
'| U-188 | Buchhaltung (Seite 7) = ein Modul, ein Menüpunkt „Buchhaltung“ (ersetzt „Geld & Rechnungen“ + separaten Stufe-2-Eintrag). Stufe 1 = Basis: Kennzahlen (Geld fehlt · Abrechnen · Offen im Zahlungsziel), Liste nach Dringlichkeit Geld fehlt → Abrechnen → Offen, Standardkarte; Aktionen Zahlung bestätigen / Erinnern / Rechnung erstellen. Stufe 2 = voller Umfang (Mahnwesen, Bankabgleich, DATEV) auf derselben Seite, vorher als eine ruhige Ausbau-Zeile. | Owner 2026-10-27 |',
'| U-189 | Dringlichkeit appweit einheitlich: weiße Karte/Zeile, links Balken 4 px im Ton, Etikett im selben Ton (Ecken 6 px), Grund in einer Zeile in Ton-Schrift, oranges ! = Achtung. Kein Punkt, keine farbig gefüllten Warnflächen (auch Hinweise, Bündeln). Neutrale Zeilen ohne Balken. | Owner 2026-10-27 |',
'| U-190 | Werkstatt (Seite 11) sachlicher: Gruppenköpfe als schmale Überschrift mit Farblinie statt gefüllter Balken, Zähler als Etikett, Karten Ecken 8 px, Balken 4 px, Bildvorschau 56 px; Inhalt und Logik unverändert. | Owner 2026-10-27 |')
if(-not $t.Contains('| U-188 |')){
  $lines=$t -split "`n"; $i=-1
  for($n=0;$n -lt $lines.Count;$n++){ if($lines[$n].StartsWith('| U-187 |')){$i=$n} }
  if($i -ge 0){ $lines=$lines[0..$i]+$neu+$lines[($i+1)..($lines.Count-1)]; [IO.File]::WriteAllText($f,($lines -join "`n"),(New-Object Text.UTF8Encoding $false)); 'U-188..190 eingetragen' } else {'U-187 nicht gefunden'}
} else {'U-188 vorhanden'}
