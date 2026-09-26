# Erweiterungen (p022): 45°-Fase für stützfreien FDM-Druck an Case_Middle, Anpassung von Case_Top sowie Schließen der Gehäuselücke an der Front-Vertiefung

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p022/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Problem

### 1. Überhang an Case_Middle
Beim FDM-3D-Druck von `Case_Middle` (insbesondere im Übergang zu `Case_Top`) wurden bisher erhebliche Stützstrukturen generiert:
1. **Horizontaler 90°-Überhang:** Die Auflagefläche für den Steckkragen von `Case_Top` bei $Z = 24.5\,\text{mm}$ (`lid_split_z - lid_joint_depth`, nominal $29.5 - 5.0\,\text{mm}$) bildete eine $1.5\,\text{mm}$ breite, horizontal umlaufende Stufe (in [img.png](img.png) blau hervorgehoben).
2. **Druckausrichtung:** Für eine optimale Oberflächenqualität wird `Case_Middle` kopfüber (180° um die X-Achse gedreht) gedruckt, sodass die Trennebene bei $Z = 29.5\,\text{mm}$ auf dem Druckbett liegt. In dieser Orientierung hing die $1.5\,\text{mm}$ breite Stufe $5.0\,\text{mm}$ über dem Druckbett waagerecht in der Luft und erforderte über die gesamte Peripherie Stützstrukturen.

### 2. Offene Lücke / Durchbruch an der Front-Vertiefung
An der oberen linken Ecke der frontseitigen Anschlussvertiefung (USB-C-Bereich) existierte eine kleine offene Lücke / Durchbruch ins Gehäuseinnere (in [img_1.png](img_1.png) mit rotem Rahmen markiert).
- **Symptom:** Am oberen linken Rand der Vertiefung klaffte ein ca. $0.3\,\text{mm}$ hoher und $1.55\,\text{mm}$ breiter horizontaler Schlitz direkt in den Gehäuseinnenraum, darunter war die Trennfuge des innenliegenden Steckkragens sichtbar.

## Ziel

1. **45°-Fase an der Auflagefläche von `Case_Middle`:**
   - Die horizontale Fläche wird entlang der vier Gehäusewände (Rückwand, Frontwand, linke Wand, rechte Wand) um 45° angefast ($1.5\,\text{mm}$ Fasenbreite $\times 1.5\,\text{mm}$ Fasenhöhe).
   - Beim FDM-Druck kopfüber entspricht dies einem selbsttragenden 45°-Überhang, der **vollständig ohne Stützstrukturen (100 % stützfrei)** gedruckt werden kann.
2. **Plane Ecken beibehalten:**
   - In den vier Ecken (Back-Left, Back-Right, Front-Left, Front-Right) bleibt jeweils ein definierter Bereich ($5.0\,\text{mm}$ Schenkellänge) horizontal plan wie bisher, damit `Case_Top` dort stabil, rechtwinklig und kippfrei aufliegt.
3. **Korrespondierende Anpassung von `Case_Top`:**
   - Der nach unten ragende Steckkragen von `Case_Top` wird spiegelbildlich an den vier Wänden um 45° ausgespart.
   - In den vier Ecken bleibt der Steckkragen von `Case_Top` flach und liegt exakt auf den planen Eckflächen von `Case_Middle` auf.
4. **Vollständiges Schließen der Gehäuselücke an der Front-Vertiefung:**
   - Beseitigung des Durchbruchs und Erhalt einer durchgehenden, massiven Gehäusewand ($1.5\,\text{mm}$ Restwandstärke) hinter der gesamten Front-Vertiefung.

---

## 1. Geometrische & Mathematische Analyse

### A) Bezugsmaße & Parameter

| Parameter | Wert / Formel | Beschreibung |
| :--- | :--- | :--- |
| `case_width` | $91.4\,\text{mm}$ | Außenbreite Gehäuse ($X \in [-45.7, +45.7]\,\text{mm}$) |
| `case_depth` | $62.4\,\text{mm}$ | Außentiefe Gehäuse ($Y \in [-31.2, +31.2]\,\text{mm}$) |
| `shell_thickness` | $3.0\,\text{mm}$ | Gehäusewandstärke (Innenraum: $X \in [-42.7, +42.7]$, $Y \in [-28.2, +28.2]\,\text{mm}$) |
| `groove_inset` | $1.5\,\text{mm}$ | Versatz der Fugenwand (Außenkragen-Innenflanke: $X = \pm 44.2$, $Y = \pm 29.7\,\text{mm}$) |
| `lid_split_z` | $29.5\,\text{mm} + \text{offset}$ | Z-Höhe der Trennebene (nominal $29.5\,\text{mm}$) |
| `lid_joint_depth` | $5.0\,\text{mm}$ | Tiefe des Stufenfalzes |
| $Z_{\text{shelf}}$ | $Z_{\text{split}} - 5.0\,\text{mm}$ | Auflage-Niveau (nominal $24.5\,\text{mm}$) |
| `lid_joint_shelf_chamfer` | $1.5\,\text{mm}$ | Breite der 45°-Fase entlang der Wände ($\Delta Z = 1.5\,\text{mm}$) |
| $Z_{\text{chamfer\_top}}$ | $Z_{\text{shelf}} + 1.5\,\text{mm}$ | Fasenoberkante (nominal $26.0\,\text{mm}$) |
| `lid_joint_corner_flat_length` | $5.0\,\text{mm}$ | Länge der planen Auflagefläche in den 4 Ecken |

### B) Fasenbereiche entlang der Gehäusewände

- **Rückwand & Frontwand (Extrusion entlang X):**
  - Innerer Wandbereich: $X \in [-42.7, +42.7]\,\text{mm}$
  - Fasenbereich: $X \in [-37.7, +37.7]\,\text{mm}$ (Länge: $75.4\,\text{mm}$, 88 % stützfrei)
  - Querschnitt Rückwand (+Y): Dreieck $(Y = 28.2, Z = 24.5) \to (Y = 29.7, Z = 24.5) \to (Y = 29.7, Z = 26.0)$
  - Querschnitt Frontwand (-Y): Dreieck $(Y = -28.2, Z = 24.5) \to (Y = -29.7, Z = 24.5) \to (Y = -29.7, Z = 26.0)$
- **Linke & Rechte Seitenwand (Extrusion entlang Y):**
  - Innerer Wandbereich: $Y \in [-28.2, +28.2]\,\text{mm}$
  - Fasenbereich: $Y \in [-23.2, +23.2]\,\text{mm}$ (Länge: $46.4\,\text{mm}$, 82 % stützfrei)
  - Querschnitt Linke Wand (-X): Dreieck $(X = -42.7, Z = 24.5) \to (X = -44.2, Z = 24.5) \to (X = -44.2, Z = 26.0)$
  - Querschnitt Rechte Wand (+X): Dreieck $(X = 42.7, Z = 24.5) \to (X = 44.2, Z = 24.5) \to (X = 44.2, Z = 26.0)$
- **Vier plane Eckauflagen:**
  - Back-Left: $X \in [-42.7, -37.7]\,\text{mm}$, $Y \in [23.2, 28.2]\,\text{mm}$
  - Back-Right: $X \in [37.7, 42.7]\,\text{mm}$, $Y \in [23.2, 28.2]\,\text{mm}$
  - Front-Left: $X \in [-42.7, -37.7]\,\text{mm}$, $Y \in [-28.2, -23.2]\,\text{mm}$
  - Front-Right: $X \in [37.7, 42.7]\,\text{mm}$, $Y \in [-28.2, -23.2]\,\text{mm}$
  - Bleiben horizontal plan bei $Z = 24.5\,\text{mm}$ mit $0.5\,\text{mm}$ Einführfase an `Case_Top`.

### C) Kompatibilität mit den 4 Rastnasen (p020)

- Die vier Rastnasen und -mulden befinden sich bei $Z \in [26.75, 27.25]\,\text{mm}$ ($Z$-Zentrum $27.0\,\text{mm}$).
- Die 45°-Fase endet bei $Z = 26.0\,\text{mm}$.
- Zwischen der Fasenoberkante und dem unteren Rand der Rastnasen verbleibt ein vertikaler Wandabschnitt von $0.75\,\text{mm}$, sodass die Rastfunktion vollkommen unbeeinträchtigt und formstabil bleibt.

### D) Ursachenanalyse der Gehäuselücke an der Front-Vertiefung ([img_1.png](img_1.png))

1. **Front-Vertiefung (`createFrontPortRecess` in `openings.ts`):**
   - Zentrum des USB-C-Ports: $X = -31.3\,\text{mm}$, halbe Breite: $5.75\,\text{mm} \implies X_{\text{usbc\_min}} = -37.05\,\text{mm}$.
   - Versatz der Vertiefung: `front_recess_offset = 4.0 mm`.
   - Linke Bounding-Box-Kante der Vertiefung:
     $$X_{\text{recess\_min}} = -37.05\,\text{mm} - 4.00\,\text{mm} = -41.05\,\text{mm}$$
   - Schnitttiefe: $1.5\,\text{mm}$ von außen nach innen von $Y = -31.2\,\text{mm}$ bis $Y = -29.7\,\text{mm}$.
   - Verbleibende Nenn-Restwandstärke an der Vertiefung: $3.0\,\text{mm} - 1.5\,\text{mm} = 1.5\,\text{mm}$ ($Y \in [-29.7, -28.2]\,\text{mm}$).

2. **Kollision mit dem Stufenschnitt in `joint.ts`:**
   - In Schritt 19 (`createTongueAndGrooveJoint`) erstreckte sich der Front-Left-Eckschenkel (`Segment 6`) bisher bis:
     $$\text{cornerFrontLeftXMax} = -3.95\,\text{cm} = -39.5\,\text{mm}$$
   - Der Stufenschnitt schnitt an der Gehäuseinnenwand von $Y = -28.2\,\text{mm}$ um $1.5\,\text{mm}$ nach außen bis $Y = -29.7\,\text{mm}$ für $Z \in [0, 5.3]\,\text{mm}$ (`joint_depth + joint_vertical_clearance`).
   - Im Überlappungsbereich $X \in [-41.05, -39.50]\,\text{mm}$ (Breite $1.55\,\text{mm}$) summierten sich der äußere und der innere Schnitt:
     $$1.5\,\text{mm} + 1.5\,\text{mm} = 3.0\,\text{mm} \implies \text{Restwandstärke} = 0.0\,\text{mm}!$$
   - Da der Kragen von `Case_Bottom` nur bis $Z = 5.0\,\text{mm}$ reicht, entstand im Bereich des vertikalen Spiels ($Z \in [5.0, 5.3]\,\text{mm}$, Höhe $0.3\,\text{mm}$) die in [img_1.png](img_1.png) gezeigte offene Lücke ins Gehäuseinnere.

---

## 2. Implementierungsdetails

### A) 45°-Fasen an Case_Middle & Case_Top (`lidJoint.ts`)
- **Funktion `applyLidJointShelfChamfers` (`lidJoint.ts`):**
  - Erzeugt die Skizzen `Sketch_LidChamfer_BackFront` (YZ-Ebene) und `Sketch_LidChamfer_LeftRight` (XZ-Ebene).
  - Verwendet `sketch.modelToSketchSpace()` für alle 3D-Stützpunkte.
  - Führt `JoinFeatureOperation` auf `Case_Middle` aus (fügt die 45°-Rampen an).
  - Führt `CutFeatureOperation` auf `Case_Top` aus (schneidet das Gegenstück frei).
  - Dynamische Normalenvektor-Prüfung garantiert korrekte Extrusionsrichtung.
  - `getLiveBody` aktualisiert die BRep-Referenzen robust nach jeder Operation.

### B) Schließen der Lücke an der Front-Vertiefung (`joint.ts` & `case.ts`)
- **Vollständiger Entfall von Segment 6 auf der Frontwand:**
  - Die linke Gehäusewand ist durch Segment 2 bereits von $Y = \text{frontMidY} + \text{clearance}$ ($-29.55\,\text{mm}$) bis zur Rückwand vollflächig mit dem Steckkragen und dem Stufenschnitt versehen.
  - Ein Übergreifen auf die Frontwand entfällt links vollständig.
  - Die Frontwand bleibt dadurch im gesamten Bereich der Vertiefung ($X \in [-41.05, +0.34]\,\text{mm}$) von innen unberührt und massiv ($1.5\,\text{mm}$ Restwandstärke).
- **Anpassung der Fasenselektion (`collarEdgesToChamfer`):**
  - `isFrontOuter` beschränkt sich auf den rechten Frontkragen ($X \in [0.55, 4.45]\,\text{cm}$), da an Front-Left kein Kragen auf der Frontwand existiert.
- **Orchestrierung (`case.ts`):**
  - Schritt-19-Kommentare und Konsolenausgaben wurden aktualisiert (Front-Left massiv geschlossen für optimalen Schutz der Anschlussvertiefung).
