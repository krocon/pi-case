# Erweiterungen

- Arbeite nur an der Dateien fusion/model/pi5/case/case.ts und den lokalen imports 'fusion/model/pi5/case/*.ts', 
sowie fusion/model/pi5/doc/prompt/p006/prompt.md und evtl. den anderen fusion/model/pi5/doc/prompt/**/prompt.md
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Nut- und Feder-Verbindung (Tongue and Groove) mit Einrastfunktion zwischen den 3mm dicken Gehäusewänden von Case_Top und Case_Bottom

Ergänzung einer passgenauen Nut-und-Feder-Führung an der Trennebene ($Z = 0$) zwischen den beiden Gehäusehälften:
- **Case_Bottom** erhält die **Feder** (nach oben in $+Z$ ragender Steg).
- **Case_Top** erhält die **Nut** (nach oben in $+Z$ eingeschnittene Vertiefung).
- Die Verbindung wird **ausschließlich an den Wandbereichen platziert, an denen die Wand volle 3.0 mm Dicke besitzt** (keine Durchbrüche oder reduzierte Wandstärken wie bei der Front-Vertiefung oder den seitlichen Ports).
- An der Rückwand wird eine **integrierte Einrastfunktion (Snap-Fit)** mit definierter Rastwulst und korrespondierender Rastmulde für spürbaren Halt und werkzeugloses Öffnen realisiert.


## Geometriebeschreibung

- **Trennebene:**
  - Die Kontaktfläche zwischen `Case_Top` und `Case_Bottom` liegt auf der XY-Ebene bei $Z = 0$.
  - Gehäuseaußenmaß: $91.4\,\text{mm} \times 62.4\,\text{mm}$ ($X \in [-45.7, +45.7]\,\text{mm}, Y \in [-31.2, +31.2]\,\text{mm}$).
  - Gehäuseinnenmaß: $85.4\,\text{mm} \times 56.4\,\text{mm}$ ($X \in [-42.7, +42.7]\,\text{mm}, Y \in [-28.2, +28.2]\,\text{mm}$).
  - Standard-Wandstärke: $3.0\,\text{mm}$.

- **Identifikation der 3 mm dicken Wandbereiche:**
  1. **Rückwand (Back Wall):**
     - Vollständig geschlossen, keine Ports oder Vertiefungen.
     - Wandmitte bei $Y = +29.7\,\text{mm}$ (Wand von $Y = +28.2$ bis $+31.2\,\text{mm}$).
     - Segmentlänge: $X \in [-38.0\,\text{mm}, +38.0\,\text{mm}]$ ($76.0\,\text{mm}$ Länge, mit Sicherheitsabstand zu den Ecken).
  2. **Frontwand rechts (Front-Right Wall):**
     - Liegt rechts neben der Vertiefung der Frontanschlüsse (die Vertiefung endet bei $X = +4.7\,\text{mm}$).
     - Wandmitte bei $Y = -29.7\,\text{mm}$ (Wand von $Y = -31.2$ bis $-28.2\,\text{mm}$).
     - Segmentlänge: $X \in [+6.0\,\text{mm}, +38.0\,\text{mm}]$ ($32.0\,\text{mm}$ Länge).
  3. **Linke Seitenwand (Left Wall):**
     - Vollständig geschlossen (da Micro-SD-Slot und Power-Button entfernt wurden).
     - Wandmitte bei $X = -44.2\,\text{mm}$ (Wand von $X = -45.7$ bis $-42.7\,\text{mm}$).
     - Durchgehendes Segment: $Y \in [-25.0\,\text{mm}, +25.0\,\text{mm}]$ ($50.0\,\text{mm}$ Länge).
  4. **Rechte Seitenwand (2 Pfeiler zwischen den Port-Ausschnitten):**
     - Wandmitte bei $X = +44.2\,\text{mm}$ (Wand von $X = +42.7$ bis $+45.7\,\text{mm}$).
     - **Pfeiler 1 (zwischen RJ45 Ethernet und Dual USB 3.0):**
       - $Y \in [-9.55\,\text{mm}, -6.40\,\text{mm}]$ ($3.15\,\text{mm}$ Länge).
       - Feder auf `Case_Bottom` von $Y = -9.35\,\text{mm}$ bis $Y = -6.60\,\text{mm}$ ($2.75\,\text{mm}$ Länge mit je $0.2\,\text{mm}$ Freiraum).
       - Nut in `Case_Top` durchgehend zwischen den Ausschnitten.
     - **Pfeiler 2 (zwischen Dual USB 3.0 und Dual USB 2.0):**
       - $Y \in [+8.60\,\text{mm}, +11.50\,\text{mm}]$ ($2.90\,\text{mm}$ Länge).
       - Feder auf `Case_Bottom` von $Y = +8.80\,\text{mm}$ bis $Y = +11.30\,\text{mm}$ ($2.50\,\text{mm}$ Länge mit je $0.2\,\text{mm}$ Freiraum).
       - Nut in `Case_Top` durchgehend zwischen den Ausschnitten.

- **Querschnitt der Feder (Tongue) auf `Case_Bottom`:**
  - Breite: $1.0\,\text{mm}$ (`joint_tongue_width`), mittig in der 3.0 mm Wand platziert (je $1.0\,\text{mm}$ Restschulter innen und außen).
  - Höhe: $+1.6\,\text{mm}$ über der Trennebene $Z = 0$ in $+Z$-Richtung (`joint_tongue_height`).
  - An den Segmentenden $0.2\,\text{mm}$ Freiraum zur Nut.
  - Operation: `JoinFeatureOperation` (`Verbinden`) an `Case_Bottom`.

- **Querschnitt der Nut (Groove) in `Case_Top`:**
  - Breite: $1.4\,\text{mm}$ (`joint_groove_width`), zentriert auf der Wandachse.
  - Tiefe: $+2.0\,\text{mm}$ von $Z = 0$ nach oben in $+Z$ (`joint_groove_depth`).
  - Passungsspiel: $0.2\,\text{mm}$ horizontales FDM-Spiel je Seite (`joint_clearance`) und $0.4\,\text{mm}$ vertikales Kopfspiel (`joint_vertical_clearance`), damit die Hauptdichtfläche bei $Z = 0$ stets vollständig plan aufliegt.
  - Operation: `CutFeatureOperation` (`Ausschneiden`) in `Case_Top`.
  - **Minimale Nut-Kanten-Anfasung ($0.05\,\text{mm}$):**
    - Die horizontalen Eintrittskanten der Nut an der Trennebene $Z = 0$ werden minimal mit $0.05\,\text{mm}$ (`joint_groove_chamfer`) angefast ($45^\circ$).
    - Zweck: Entfernen von Schichtgraten des 3D-Drucks und schlüssige Einführschräge für das reibungslose Einschieben der Feder beim Schließen des Gehäuses.

- **Einrastfunktion (Snap-Fit):**
  - Position: Zentral an der Rückwand über eine Länge von $20.0\,\text{mm}$ ($X \in [-10.0\,\text{mm}, +10.0\,\text{mm}]$).
  - **Rastwulst an der Feder:** Horizontale Wulst auf der Außenflanke der Feder bei $Z = 0.85\,\text{mm}$, Auskragung $+0.25\,\text{mm}$ (`joint_snap_depth`), Höhe $0.5\,\text{mm}$ (`joint_snap_height`).
  - **Rastmulde in der Nut:** Korrespondierende Hinterschneidung in der äußeren Nutwand bei $Z = 0.85\,\text{mm}$, Tiefe $0.30\,\text{mm}$, Höhe $0.6\,\text{mm}$.
  - Haptik: Beim Zusammenstecken federt die dünne Wand elastisch ein und rastet bei vollständigem Schluss spürbar ein.


## Steps

1) **Parameter (`parameters.ts`):**
   - Parametrisierung im strikten `snake_case` (AGENTS.md §3.2 & §3.3):
     - `joint_tongue_width`: `1.0mm` (Breite der Feder)
     - `joint_tongue_height`: `1.6mm` (Höhe der Feder)
     - `joint_groove_width`: `1.4mm` (Breite der Nut)
     - `joint_groove_depth`: `2.0mm` (Tiefe der Nut)
     - `joint_clearance`: `0.2mm` (Horizontales Passungsspiel je Seite)
     - `joint_vertical_clearance`: `0.4mm` (Vertikales Kopfspiel der Feder)
     - `joint_groove_chamfer`: `0.05mm` (Minimale Fase an den Nut-Eintrittskanten bei Z=0)
     - `joint_snap_length`: `20mm` (Länge der Rastnase an der Rückwand)
     - `joint_snap_depth`: `0.25mm` (Auskragung der Rastnase)
     - `joint_snap_height`: `0.5mm` (Höhe der Rastnase in Z)

2) **Skizze & Extrusion der Feder (`Case_Bottom`):**
   - Erzeuge Skizze `Sketch_Case_Tongue` auf der XY-Ebene ($Z = 0$).
   - Zeichne die 5 Feder-Rechtecke mittig in den 3 mm dicken Wandbereichen:
     - Rückwand: $X \in [-37.8, +37.8]\,\text{mm}$, $Y \in [29.2, 30.2]\,\text{mm}$
     - Frontwand rechts: $X \in [+6.2, +37.8]\,\text{mm}$, $Y \in [-30.2, -29.2]\,\text{mm}$
     - Linke Wand durchgehend: $X \in [-44.7, -43.7]\,\text{mm}$, $Y \in [-24.8, +24.8]\,\text{mm}$
     - Rechte Wand Pfeiler 1 (zwischen RJ45 & Dual USB 3.0): $X \in [43.7, 44.7]\,\text{mm}$, $Y \in [-9.35, -6.60]\,\text{mm}$
     - Rechte Wand Pfeiler 2 (zwischen Dual USB 3.0 & Dual USB 2.0): $X \in [43.7, 44.7]\,\text{mm}$, $Y \in [+8.80, +11.30]\,\text{mm}$
   - Führe eine Extrusion um $+1.6\,\text{mm}$ nach oben aus (`JoinFeatureOperation` mit `Case_Bottom`).

3) **Skizze & Schnitt der Nut (`Case_Top`):**
   - Erzeuge Skizze `Sketch_Case_Groove` auf der XY-Ebene ($Z = 0$).
   - Zeichne die 5 Nut-Rechtecke mit $1.4\,\text{mm}$ Breite und entsprechendem Endüberstand:
     - Rückwand: $X \in [-38.0, +38.0]\,\text{mm}$, $Y \in [29.0, 30.4]\,\text{mm}$
     - Frontwand rechts: $X \in [+6.0, +38.0]\,\text{mm}$, $Y \in [-30.4, -29.0]\,\text{mm}$
     - Linke Wand durchgehend: $X \in [-44.9, -43.5]\,\text{mm}$, $Y \in [-25.0, +25.0]\,\text{mm}$
     - Rechte Wand Pfeiler 1: $X \in [43.5, 44.9]\,\text{mm}$, $Y \in [-9.65, -6.30]\,\text{mm}$
     - Rechte Wand Pfeiler 2: $X \in [43.5, 44.9]\,\text{mm}$, $Y \in [+8.50, +11.60]\,\text{mm}$
   - Führe eine Schnitt-Extrusion um $+2.0\,\text{mm}$ nach oben aus (`CutFeatureOperation` in `Case_Top`).

4) **Minimale Anfasung der Nut-Eintrittskanten (0.05 mm):**
   - Ermittle die horizontalen Kanten der Nut-Ausschnitte auf der Trennebene $Z = 0$ an `Case_Top`.
   - Wende eine Fase von $0.05\,\text{mm}$ (`joint_groove_chamfer`) mit mehrstufigem Fallback-System an.

5) **Einrastfunktion an Rückwand:**
   - Hilfsebene/Skizze an der Außenfläche der Rückwand-Feder bei $Y = 30.2\,\text{mm}$.
   - Profil für die Rastnase: $X \in [-10.0, +10.0]\,\text{mm}$, $Z \in [0.6, 1.1]\,\text{mm}$.
   - Extrusion $+0.25\,\text{mm}$ in $+Y$ mit `Join` an `Case_Bottom`.
   - Korrespondierender Schnitt für die Rastmulde in `Case_Top` an der Nut-Außenwand ($Y = 30.4\,\text{mm}$): Profil $X \in [-10.2, +10.2]\,\text{mm}$, $Z \in [0.55, 1.15]\,\text{mm}$, Schnitt $+0.30\,\text{mm}$ in $+Y$.

6) **Modul & Orchestrierung (`joint.ts`, `case.ts`):**
   - Erstelle neues Modul `fusion/model/pi5/case/joint.ts` mit Funktion `createTongueAndGrooveJoint`.
   - Binde Schritt 19 in `case.ts:run()` ein und aktualisiere BRep-Live-Referenzen.


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrische Maße `joint_tongue_width`, `joint_tongue_height`, `joint_groove_width`, `joint_groove_depth`, `joint_clearance`, `joint_vertical_clearance`, `joint_groove_chamfer`, `joint_snap_length`, `joint_snap_depth`, `joint_snap_height` | `parameters.ts:setupParameters` | Abgeschlossen |
| **Feder (Bottom)** | 5 Feder-Segmente ($1.0\,\text{mm}$ breit, $+1.6\,\text{mm}$ hoch) auf $Z=0$ an Rück-, Front-, linker Wand und den 2 rechten Pfeilern | `joint.ts:createTongueAndGrooveJoint` | Abgeschlossen |
| **Nut (Top)** | 5 Nut-Segmente ($1.4\,\text{mm}$ breit, $+2.0\,\text{mm}$ tief) auf $Z=0$ in `Case_Top` | `joint.ts:createTongueAndGrooveJoint` | Abgeschlossen |
| **Nut-Anfasung** | Minimale $0.05\,\text{mm}$ Fase an den Nut-Eintrittskanten bei $Z = 0$ in `Case_Top` | `joint.ts:createTongueAndGrooveJoint` | Abgeschlossen |
| **Einrastfunktion** | Rastwulst ($20 \times 0.5 \times 0.25\,\text{mm}$) an der Rückwand-Feder & Rastmulde in der Nut | `joint.ts:createTongueAndGrooveJoint` | Abgeschlossen |
| **Orchestrierung** | Schritt 19 in `run()` integriert inkl. BRep-Live-Referenzen | `case.ts:run` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `joint_tongue_width`: `1.0mm` (Breite der Feder)
- `joint_tongue_height`: `1.6mm` (Höhe der Feder)
- `joint_groove_width`: `1.4mm` (Breite der Nut)
- `joint_groove_depth`: `2.0mm` (Tiefe der Nut)
- `joint_clearance`: `0.2mm` (Horizontales Spiel je Seite)
- `joint_vertical_clearance`: `0.4mm` (Vertikales Kopfspiel)
- `joint_groove_chamfer`: `0.05mm` (Minimale Fase an den Nut-Eintrittskanten)
- `joint_snap_length`: `20mm` (Länge der Rastnase)
- `joint_snap_depth`: `0.25mm` (Auskragung der Rastnase)
- `joint_snap_height`: `0.5mm` (Höhe der Rastnase)
