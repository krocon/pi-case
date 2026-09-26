# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p012/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Erstelle einen neuen Körper für ein Logo (siehe fusion/model/pi5/doc/prompt/p012/img_1.png) und das SVG: fusion/model/pi5/doc/prompt/p012/logo.svg

Das Logo soll 0.5mm dick sein.
Mache an einer Seitenwand (siehe fusion/model/pi5/doc/prompt/p012/img.png) eine entsprechende Mulde in der Umrissform (+0.2mm spiel).

---

## Umsetzung & Spezifikation

### 1. Geometrie & BRep-Körper-Struktur

1. **Eigenständiger BRep-Körper `Logo`:**
   - Erzeugt als separater BRep-Körper mit dem eindeutigen Namen `'Logo'`.
   - **Dicke:** $0.5\,\text{mm}$ (`logo_thickness = 0.5mm`).
   - **Umrissform:** Mathematisch geschlossenes 17-Punkte-Polygon, direkt abgeleitet aus den Vektordaten von `logo.svg` und validiert gegen das Referenzbild `img_1.png` (0 Selbstüberschneidungen).
   - **Orientierung im CAD-Raum:** 
     - Platziert an der linken Gehäuseseitenwand ($X = -45.7\,\text{mm}$, Außenseite von `Case_Middle`).
     - Aufrecht stehend: Der obere Zenit des SVG-Logos zeigt nach $+Z$ (oben).
     - Die Öffnung des isometrischen "G" zeigt nach $-Y$ (vorne in Richtung der Anschlüsse), die gerade vertikale Kante zeigt nach $+Y$ (hinten in Richtung Gehäuserückseite).
   - **Visuelle Facettierung (Isometrischer 3D-Look):**
     - Die Frontfläche des Logos wird über `splitFaceFeatures` entlang der internen SVG-Kanten in die Segmente unterteilt.
     - Automatische Zuweisung dreier individueller Graustufen-Erscheinungsbilder (Appearances):
       - **Hellgrau / Fast Weiß (`Logo_Light_Shade`, RGB 242, 243, 245):** Obere Dachflächen, Zungen-Oberseite und Trittstufe.
       - **Mittelgrau (`Logo_Medium_Shade`, RGB 155, 160, 170):** Nach rechts/vorne gerichtete Facetten.
       - **Dunkelgrau (`Logo_Dark_Shade`, RGB 55, 60, 72):** Nach links/hinten gerichtete Schattenflächen.

2. **Passvertiefung (Logo-Mulde) in `Case_Middle`:**
   - Passgenaue Aussparung in der äußeren Planarfläche bei $X = -45.7\,\text{mm}$.
   - **Umlaufendes Spiel:** $+0.2\,\text{mm}$ (`logo_recess_clearance = 0.2mm`), berechnet über einen exakten 2D-Normalen-Außenversatz des 17-Punkte-Umrisses.
   - **Tiefe der Mulde:** $0.5\,\text{mm}$ (`logo_recess_depth = 0.5mm`), sodass das Logo bündig mit der Gehäuseaußenwand abschließt.
   - **Positionierung:**
     - $Y = 0.0\,\text{mm}$ (`logo_pos_y`): Um weitere $2.0\,\text{mm}$ nach rechts verschoben (ausgehend von $2.0\,\text{mm}$ auf $0.0\,\text{mm}$, in Blickrichtung auf die Seitenwand nach rechts / in Richtung Gehäusefront). Liegt nun perfekt symmetrisch zentriert bei $Y = 0$ auf der Seitenwand.
     - $Z = 14.7\,\text{mm}$ (`logo_pos_z`): Um weitere $1.0\,\text{mm}$ höher gesetzt (ausgehend von $13.7\,\text{mm}$ auf $14.7\,\text{mm}$). Mit Gesamthöhe $8.0\,\text{mm}$ erstreckt sich das Logo von $Z = 10.7\,\text{mm}$ bis $Z = 18.7\,\text{mm}$ und liegt damit ideal in der vertikalen Mitte von `Case_Middle` ($Z \in [0, 29.5]\,\text{mm}$).
     - Gesamthöhe: $8.0\,\text{mm}$ (`logo_size`), Breite: $7.01\,\text{mm}$ (entspricht exakt der Proportion in `img_01.png`).

3. **Fertigung & FDM-3D-Druck:**
   - Bei Standardmontage (`layout_for_print = 0`): Das Logo sitzt formschlüssig in der Mulde.
   - Bei aktivierter Druckanordnung (`layout_for_print = 1`): Der Körper `Logo` wird automatisch flach auf das Druckbett ($Z = 0$) gelegt, sodass er entweder separat (z. B. in Kontrastfarbe) oder im Mehrfarbdruck (Bambu AMS) gedruckt werden kann.
   - **Optionalität (`create_logo = 0`):** Bei deaktiviertem Parameter wird weder die Mulde geschnitten noch der BRep-Körper `Logo` erzeugt.

---

### 2. Parameter (`parameters.ts:setupParameters`)

| Parameter | Standardwert | Einheit | Beschreibung |
| :--- | :--- | :--- | :--- |
| `create_logo` | `'1'` | `''` | Logo und Passvertiefung (Mulde) an der Gehäuseseitenwand konstruieren (0=Aus, 1=An) |
| `logo_pos_y` | `'0mm'` | `'mm'` | Y-Position des Logos und der Mulde an der linken Seitenwand (symmetrisch zentriert bei 0 mm) |
| `logo_pos_z` | `'14.7mm'` | `'mm'` | Z-Position des Logos und der Mulde an der linken Seitenwand (1 mm höher; Z = 14.7 mm) |
| `logo_size` | `'8mm'` | `'mm'` | Gesamthöhe des Logos entlang der Z-Achse |
| `logo_thickness` | `'0.5mm'` | `'mm'` | Dicke des Logo-Körpers |
| `logo_recess_depth` | `'0.5mm'` | `'mm'` | Tiefe der Passvertiefung (Logo-Mulde) in der linken Seitenwand |
| `logo_recess_clearance` | `'0.2mm'` | `'mm'` | Umlaufendes Spiel der Logo-Mulde um die Umrissform des Logos (+0.2 mm) |

---

### 3. Implementierungsübersicht & Modul-Architektur (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Änderungen | Status |
| :--- | :--- | :--- |
| **`parameters.ts`** | Definition der 7 Parameter (`create_logo`, `logo_pos_y`, `logo_pos_z`, `logo_size`, `logo_thickness`, `logo_recess_depth`, `logo_recess_clearance`) im strikten `snake_case`. | Abgeschlossen |
| **`logo.ts`** (NEU) | Eigenständiges CAD-Modul: Vektorberechnung des 17-Punkte-Umrisses, 2D-Polygon-Offset (+0.2mm), Schnitt der Mulde über `Case_Middle` und `Case_Bottom`, Extrusion des Körpers `Logo` (0.5mm) und Facetten-Farbaufteilung. | Abgeschlossen |
| **`utils.ts`** | Bereitstellung der robusten Farb-Zuweisungsfunktion `applyColorToEntity(design, entity, colorName, r, g, b)`. | Abgeschlossen |
| **`printLayout.ts`** | Integration von `logo?: adsk.fusion.BRepBody` in `PrintableBodiesInput` und `knownCaseNames`; stützfreie Nivellierung des Logos auf $Z = 0$ bei `layout_for_print = 1`. | Abgeschlossen |
| **`case.ts`** | Orchestrierung in `run()` als Schritt 23: Aufruf von `createCaseLogo`, Aktualisierung der Live-Körperreferenzen und Protokollierung. | Abgeschlossen |


