# Erweiterungen (p024): Erhöhung der Wandstärke der rechten Gehäusewand (+X) um 1 mm bei unverändertem Innenhohlraum

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p024/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel

Gemäß [img.png](img.png) soll die Wandstärke der dort blau hervorgehobenen Wand um $1\,\text{mm}$ verstärkt werden:
1. **Betroffene Wand:** Rechte Gehäusewand in der YZ-Ebene bei $+X$ (die Seitenwand mit den Anschlüssen Gigabit Ethernet RJ45, Dual USB 3.0 und Dual USB 2.0).
2. **Betroffene Körper:** Alle drei Gehäusekörper (`Case_Top`, `Case_Middle`, `Case_Bottom`).
3. **Unveränderter Innenhohlraum:**
   - Der innere Bauraum bleibt zu $100\,\%$ unverändert ($X \in [-42.7, +42.7]\,\text{mm}$, $Y \in [-28.2, +28.2]\,\text{mm}$).
   - Die Raspberry Pi 5 Platine, die 4 Standoff-Befestigungssäulen, die Montagebohrungen und alle internen Passungen verbleiben exakt an ihren nominalen Koordinaten.
4. **Wandstärken-Zuwachs & Außenmaß:**
   - Die Wandstärke dieser Wand erhöht sich von bisher $3.0\,\text{mm}$ (`shell_thickness`) auf $4.0\,\text{mm}$ (`shell_thickness + case_right_wall_extra_thickness`).
   - Das Gehäuse wächst ausschließlich nach rechts um $1.0\,\text{mm}$ nach außen: von $X = +45.7\,\text{mm}$ auf $X = +46.7\,\text{mm}$.
   - Die Gesamtbreite (Länge in X) des Gehäuses vergrößert sich somit exakt um $1.0\,\text{mm}$: von $91.4\,\text{mm}$ auf $92.4\,\text{mm}$ (`case_width`).
   - Alle anderen Gehäusewände (linke Wand, Frontwand, Rückwand, Deckel und Boden) behalten ihre reguläre Wandstärke von $3.0\,\text{mm}$ bei.

---

## 1. Geometrische & Mathematische Analyse

### A) Bezugsmaße & Parameter

| Parameter / Bezugsmaß | Wert / Formel | Beschreibung |
| :--- | :--- | :--- |
| `case_right_wall_extra_thickness` | `1.0 mm` | Zusätzliche Wandstärke für die rechte Gehäusewand (+X, Port-Wand) |
| `case_width` | `92.4 mm` | Gesamtlänge Gehäuse ($91.4\,\text{mm} + \text{case\_right\_wall\_extra\_thickness}$) |
| `shell_thickness` | `3.0 mm` | Standard-Wandstärke (Links, Vorne, Hinten, Deckel, Boden) |
| Wandstärke Rechte Wand (+X) | `4.0 mm` | $X \in [+42.7, +46.7]\,\text{mm}$ ($3.0\,\text{mm} + 1.0\,\text{mm}$) |
| Wandstärke Linke Wand (-X) | `3.0 mm` | $X \in [-45.7, -42.7]\,\text{mm}$ (vollkommen unverändert) |
| Wandstärke Front- & Rückwand | `3.0 mm` | $Y \in [\pm 28.2, \pm 31.2]\,\text{mm}$ (vollkommen unverändert) |
| Innenhohlraum $X$ | $[-42.7, +42.7]\,\text{mm}$ | Bauraumbreite $85.4\,\text{mm}$ ($85\,\text{mm} + 2 \times 0.2\,\text{mm}$) $100\,\%$ unverändert |
| Innenhohlraum $Y$ | $[-28.2, +28.2]\,\text{mm}$ | Bauramtiefe $56.4\,\text{mm}$ ($56\,\text{mm} + 2 \times 0.2\,\text{mm}$) $100\,\%$ unverändert |
| Fugen-Außenkante rechts | $+46.7\,\text{mm}$ | Bündig mit der neuen äußeren rechten Gehäusewand |
| Fugen-Innenkante rechts | $+45.2\,\text{mm}$ | $1.5\,\text{mm}$ Versatz (`groove_inset`) nach innen ab $+46.7\,\text{mm}$ |
| Restwandstärke in Fuge rechts | $2.5\,\text{mm}$ | $45.2\,\text{mm} - 42.7\,\text{mm} = 2.5\,\text{mm}$ (zuvor $1.5\,\text{mm}$, spürbar formstabiler) |
| Steckkragen-Auflagefläche rechts | $X \in [42.7, 45.2]\,\text{mm}$ | Stufenbreite an `Case_Middle` / `Case_Top` beträgt nun $2.5\,\text{mm}$ |
| 45°-Rampen an `Case_Middle` | $X \in [42.7, 45.2]\,\text{mm}$ | $2.5 \times 2.5\,\text{mm}$ 45°-Schräge für stützfreien FDM-Druck |

### B) Koordinatensystem & Symmetriebetrachtung

- **PCB- und Hohlraum-Zentrierung:**
  Der Gehäuseursprung $(0,0,0)$ verbleibt exakt im Zentrum der Raspberry Pi 5 Platine und des Innenhohlraums:
  - Linke Innenwand: $X = -42.7\,\text{mm}$
  - Rechte Innenwand: $X = +42.7\,\text{mm}$
  - Vordere Innenwand: $Y = -28.2\,\text{mm}$
  - Hintere Innenwand: $Y = +28.2\,\text{mm}$
- **Asymmetrische Außenkontur:**
  Durch die selektive Verstärkung der rechten Wand um $1.0\,\text{mm}$ liegt die Gehäuseaußenwand nun bei:
  - Linke Außenwand: $X = -45.7\,\text{mm}$
  - Rechte Außenwand: $X = +46.7\,\text{mm}$
  - Vordere Außenwand: $Y = -31.2\,\text{mm}$
  - Hintere Außenwand: $Y = +31.2\,\text{mm}$
  Gesamtabmessung: $92.4 \times 62.4\,\text{mm}$ (Breite $\times$ Tiefe).

---

## 2. Implementierungsdetails

1. **Parameter-Management (`parameters.ts`):**
   - Neuer Parameter `case_right_wall_extra_thickness`: Standard `'1mm'`, Einheit `'mm'`, Beschreibung `'Zusätzliche Wandstärke für die rechte Gehäusewand (+X, Port-Wand, p024)'`.
   - `case_width`: Ausdruck dynamisch gekoppelt via `'91.4mm + case_right_wall_extra_thickness'` (Ergebnis: $92.4\,\text{mm}$), unter Beibehaltung von `ensureParamExpression`.
   - `groove_base_width`: Ausdruck auf `'case_width'` aktualisiert, damit die Fuge die asymmetrisch vergrößerte Gehäusekontur präzise abbildet.

2. **Grundkörper, Schalenbildung & Wandverstärkung (`chassis.ts`):**
   - `createBaseSketchAndExtrusions`: Der initiale Basiskörper wird mit den nominalen Maßen $91.4 \times 62.4\,\text{mm}$ ($X \in [-45.7, +45.7]\,\text{mm}$) extrudiert.
   - `shellBodies`: Erzeugt an Ober- und Unterkörper eine Schale mit $3.0\,\text{mm}$ Wandstärke. Dadurch entsteht der exakt zentrierte Innenhohlraum ($85.4 \times 56.4\,\text{mm}$).
   - **Schritt 5b (`thickenRightWall`):**
     - Identifiziert die äußeren Planarflächen bei $X \approx +4.57\,\text{cm}$ ($\text{normal.x} > 0.8$) an `topBody` und `bottomBody`.
     - Versetzt beide Flächen über `offsetFacesFeatures` (Press Pull) um `case_right_wall_extra_thickness` ($+1.0\,\text{mm}$) nach $+X$ auf $X = +46.7\,\text{mm}$.
     - Robuster mehrstufiger Fallback: Falls `OffsetFaces` im BRep-Kernel scheitert, greift ein `extrudeFeatures`-Join-Feature als Fallback.
   - `filletOuterEdges`: Verrundungsfilter für die je 8 Außenkanten an die asymmetrische X-Spanne ($X \in [-45.7, +46.7]\,\text{mm}$) angepasst.
   - `createGrooveFeature`: Basis-Rechteck umschließt die Außenwand von $X = -45.7\,\text{mm}$ bis $X = +46.7\,\text{mm}$; Inset-Rechteck liegt bei $X \in [-44.2, +45.2]\,\text{mm}$.
   - `filletGrooveEdges`: Eckenfilter für die 4 senkrechten Innenkanten auf die asymmetrischen Koordinaten ($X = -44.2\,\text{mm}$ und $X = +45.2\,\text{mm}$) aktualisiert.

3. **Deckel-Steckverbindung (`lidJoint.ts`):**
   - `applyLidJointShelfChamfers`:
     - Die Stufe an der rechten Wand erstreckt sich von der Innenwand ($X = +4.27\,\text{cm}$) bis zur Kragen-Innenflanke ($X = +4.52\,\text{cm}$, Breite $2.5\,\text{mm}$).
     - Das 45°-Dreiecksprofil an der rechten Wand wurde von $X = 4.27\,\text{cm}$ bis $X = 4.52\,\text{cm}$ mit korrespondierender Höhe ($2.5\,\text{mm}$) für lückenlosen FDM-Druck angepasst.
     - `thinWallFace` an der Trennebene $Z = 29.5\,\text{mm}$ wird über BRep-Topologie automatisch ermittelt und in voller $2.5\,\text{mm}$ Wandbreite in `Case_Middle` geschnitten und an `Case_Top` verlängert.

4. **Entkopplung linker Gehäusefeatures (`openings.ts`, `led.ts`, `logo.ts`, `stressRelief.ts`):**
   - Alle Features der linken Gehäusewand (LED-Öffnung, LED-Halterungshülse, Logo-Mulde, untere rechteckige Öffnung & Rundloch) greifen strikt auf die feste Koordinate der linken Außenwand ($X = -45.7\,\text{mm}$) zu und bleiben vollständig unbeeinflusst von der rechten Wandverstärkung.
   - `createInnerSsdPocket`: `innerX` greift fest auf die Innenwand bei $X = +4.27\,\text{cm}$ zu.

5. **Orchestrierung (`case.ts`):**
   - Schritt 5b (`thickenRightWall`) chronologisch zwischen Schritt 4–5 (Schalenbildung) und Schritt 6–7 (Außenverrundung) eingebunden.
   - BRep-Referenzen beider Körper werden über `getLiveBody` transparent an alle nachfolgenden Schritte (`filletOuterEdges`, `createGrooveFeature`, `createAllPortCutouts`, `createTongueAndGrooveJoint`, `splitAndCreateLidJoint`, `arrangeBodiesForPrint`) übergeben.
