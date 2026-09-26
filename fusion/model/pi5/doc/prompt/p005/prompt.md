# Erweiterungen

- Arbeite nur an der Dateien fusion/model/pi5/case/case.ts und den lokalen imports 'fusion/model/pi5/case/*.ts', 
sowie fusion/model/pi5/doc/prompt/p005/prompt.md und evtl. den anderen fusion/model/pi5/doc/prompt/**/prompt.md
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: 4 Befestigungssäulen (Standoffs) mit modelliertem M2.5-Innengewinde für Metallschrauben auf der Gehäuseboden-Innenseite für das Raspberry Pi 5 Board


## Geometriebeschreibung

- **Skizzenebene auf dem Gehäuseboden (Innenseite):**
  - Konstruktionsebene parallel zur XY-Ebene auf der inneren Bodenfläche von `Case_Bottom` bei $Z = -\text{case\_bottom\_height} + \text{shell\_thickness} = -10.4\,\text{mm} + 3.0\,\text{mm} = -7.4\,\text{mm}$ (`Plane_Pi5_Standoffs`).
- **Koordinaten und Anordnung der 4 Befestigungspunkte:**
  - Das Raspberry Pi 5 Board ($85\,\text{mm} \times 56\,\text{mm}$) ist im Gehäuse symmetrisch um den Ursprung $(X = 0, Y = 0)$ ausgerichtet:
    - Der Innenraum des Gehäuses bietet $85.4\,\text{mm} \times 56.4\,\text{mm}$ Platz ($85 \times 56\,\text{mm}$ Platine plus $+0.2\,\text{mm}$ umlaufendes Spiel je Seite), woraus sich bei $3\,\text{mm}$ Wandstärke die Gehäuseaußenmaße von $91.4\,\text{mm} \times 62.4\,\text{mm}$ ergeben.
    - X-Bereich der Platine: von $-42.5\,\text{mm}$ bis $+42.5\,\text{mm}$.
    - Y-Bereich der Platine: von $-28.0\,\text{mm}$ bis $+28.0\,\text{mm}$.
  - Gemäß Raspberry Pi 5 Spezifikation (`img_geo.png`):
    - Lochabstand in X: $58.0\,\text{mm}$
    - Lochabstand in Y: $49.0\,\text{mm}$
    - Abstand linke Bohrungen zur linken Platinenkante: $3.5\,\text{mm}$ $\implies X = -42.5 + 3.5 = -39.0\,\text{mm}$
    - Abstand rechte Bohrungen zur linken Platinenkante: $3.5 + 58.0 = 61.5\,\text{mm} \implies X = -42.5 + 61.5 = +19.0\,\text{mm}$ (Abstand zur rechten Kante: $23.5\,\text{mm}$)
    - Abstand vordere Bohrungen zur vorderen Platinenkante: $3.5\,\text{mm} \implies Y = -28.0 + 3.5 = -24.5\,\text{mm}$
    - Abstand hintere Bohrungen zur hinteren Platinenkante: $3.5\,\text{mm} \implies Y = +28.0 - 3.5 = +24.5\,\text{mm}$
  - Daraus ergeben sich die 4 Bohrungsmittelpunkte (unter Berücksichtigung von `pi5_x_offset` und `pi5_y_offset`):
    1. Vorne links (Front-Left): $(X = -39.0\,\text{mm} + \text{pi5\_x\_offset}, Y = -24.5\,\text{mm} + \text{pi5\_y\_offset})$
    2. Hinten links (Back-Left): $(X = -39.0\,\text{mm} + \text{pi5\_x\_offset}, Y = +24.5\,\text{mm} + \text{pi5\_y\_offset})$
    3. Vorne rechts (Front-Right): $(X = +19.0\,\text{mm} + \text{pi5\_x\_offset}, Y = -24.5\,\text{mm} + \text{pi5\_y\_offset})$
    4. Hinten rechts (Back-Right): $(X = +19.0\,\text{mm} + \text{pi5\_x\_offset}, Y = +24.5\,\text{mm} + \text{pi5\_y\_offset})$
- **Säulen- und Kernlochquerschnitt:**
  - Außendurchmesser der Säulen: $\varnothing 6.00\,\text{mm}$ (Radius $3.0\,\text{mm}$, entspricht der Pad-Freisparung in `img_geo.png` und `img_01.png`, Säulenwandstärke $\approx 2.0\,\text{mm}$).
  - Kernlochbohrung für M2.5-Regelgewinde: $\varnothing 2.05\,\text{mm}$ (Radius $1.025\,\text{mm}$, ISO-Normtapdrill gemäß ISO 261 / ISO 965 und Autodesk Fusion ThreadData `<TapDrill>2.05</TapDrill>`).
- **Extrusion nach oben:**
  - Extrusionshöhe: $+6.50\,\text{mm}$ in $+Z$-Richtung (`standoff_height`, siehe `img_1.png`).
  - Operation: `JoinFeatureOperation` (`Verbinden`) mit dem unteren Gehäusekörper (`Case_Bottom`).
- **Modelliertes M2.5-Innengewinde für Metallschrauben (AGENTS.md §4.9):**
  - Passend für handelsübliche M2.5-Metallschrauben (z. B. DIN 912 / ISO 4762 Zylinderschrauben oder ISO 7380 Linsenkopfschrauben mit $5\,\text{mm}$ bis $6\,\text{mm}$ Schaftlänge).
  - Gewindefamilie: `ISO Metric Profile`.
  - Gewindebezeichnung: `M2.5x0.45` (Regelgewinde mit Steigung $P = 0.45\,\text{mm}$, Nenndurchmesser $2.5\,\text{mm}$).
  - Toleranzklasse: `6H` (Standard-Mutterngewinde).
  - Gewindetiefe: Volle Höhe der Säule ($6.5\,\text{mm}$, `threadInput.isFullLength = true`).
  - Modellierung: `threadInput.isModeled = true` (vollständig ausmodellierte Gewindegänge im 3D-Druck).
  - **FDM-Passungsspiel via OffsetFaces (AGENTS.md §4.9):**
    - Zur Kompensation von Filamentquellungen beim FDM-3D-Druck (z. B. Bambu Lab P2S mit PLA/PETG) wird auf die Gewindeflanken ein negatives Offset-Feature mit `standoff_thread_clearance = '-0.05mm'` angewendet.
    - Dies gewährleistet ein leichtgängiges, verschleißfreies Eindrehen der Metallschrauben ohne Schichtdelamination.


## Steps

1) **Parameter (`parameters.ts`):**
   - Parametrisierung im strikten `snake_case` (AGENTS.md §3.2 & §3.3):
     - `standoff_outer_diameter`: `6mm` (Außendurchmesser der Säulen)
     - `standoff_height`: `6.5mm` (Höhe der Säulen über dem Innenboden, um 1.5mm erhöht für perfekte Port-Ausrichtung)
     - `standoff_hole_diameter`: `2.05mm` (Kernlochdurchmesser für M2.5-Innengewinde, ISO Tap Drill)
     - `standoff_spacing_x`: `58mm` (Lochabstand in X-Richtung)
     - `standoff_spacing_y`: `49mm` (Lochabstand in Y-Richtung)
     - `standoff_thread_clearance`: `-0.05mm` (Passungsspiel für modelliertes M2.5-Gewinde im FDM-Druck)

2) **Hilfsebene & Skizze auf Gehäuseboden-Innenseite:**
   - Erzeuge eine Konstruktionsebene parallel zur XY-Ebene bei $Z = -\text{case\_bottom\_height} + \text{shell\_thickness}$ ($-7.4\,\text{mm}$) mit Namen `Plane_Pi5_Standoffs`.
   - Erstelle darauf die Skizze `Sketch_Pi5_Standoffs`.

3) **4 Säulenprofile mit Kernlochbohrung zeichnen:**
   - Berechne die 4 Mittelpunkte im 3D-Modellraum.
   - Konvertiere jeden Mittelpunkt mit `sketch.modelToSketchSpace(...)` in den lokalen Skizzenraum (AGENTS.md §4.4).
   - Zeichne an jeder Position zwei konzentrische Kreise:
     - Außenkreis mit Radius `standoff_outer_diameter / 2` ($3.0\,\text{mm}$)
     - Innenkreis mit Radius `standoff_hole_diameter / 2` ($1.025\,\text{mm}$)

4) **Extrusion nach oben (+6.5 mm) mit Join:**
   - Wähle die 4 Ringprofile (`prof.profileLoops.count === 2`, AGENTS.md §4.8) aus.
   - Führe eine Extrusion um $+6.5\,\text{mm}$ nach oben mit `JoinFeatureOperation` (`Verbinden`) an `Case_Bottom` aus.
   - Beschränke die Operation gezielt auf `Case_Bottom` via `participantBodies` und ermittle den resultierenden Live-BRep-Körper.

5) **Modellierung der M2.5-Innengewinde & FDM-Passungsspiel:**
   - Erzeuge `ThreadInfo` über `threadFeatures.createThreadInfo(true, "ISO Metric Profile", "M2.5x0.45", "6H")`.
   - Identifiziere für jede der 4 Säulenpositionen dynamisch die zylindrische Kernloch-Innenfläche im Live-Körper `Case_Bottom`.
   - Wende `ThreadFeature` mit `isModeled = true` und `isFullLength = true` an (mit Fallback auf kosmetisches Gewinde bei BRep-Konflikten).
   - Wende auf die resultierenden Gewindeflächen ein `OffsetFacesFeature` mit `standoff_thread_clearance` ($-0.05\,\text{mm}$) an.

6) **Orchestrierung (`case.ts`):**
   - Importiere `createPi5Standoffs` aus dem Modul `standoffs.ts`.
   - Integriere Schritt 18 in `case.ts:run()` nach Schritt 17 (Lüftungsschlitze im Deckel).
   - Validiere und sichere die Live-BRep-Referenz für `Case_Bottom`.


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrische Maße `standoff_outer_diameter` (6 mm), `standoff_height` (6.5 mm), `standoff_hole_diameter` (2.05 mm), `standoff_spacing_x` (58 mm), `standoff_spacing_y` (49 mm), `standoff_thread_clearance` (-0.05 mm) | `parameters.ts:setupParameters` | Abgeschlossen |
| **Ebene & Skizze** | Konstruktionsebene bei $Z = -7.4\,\text{mm}$ und Skizze `Sketch_Pi5_Standoffs` | `standoffs.ts:createPi5Standoffs` | Abgeschlossen |
| **4 Ringprofile** | 4 Kreisringe ($\varnothing 6\,\text{mm}$ außen, $\varnothing 2.05\,\text{mm}$ innen) an den exakten Pi5-Bohrungspositionen | `standoffs.ts:createPi5Standoffs` | Abgeschlossen |
| **Extrusion (Join)** | Extrusion $+6.5\,\text{mm}$ nach oben mit `JoinFeatureOperation` an `Case_Bottom` | `standoffs.ts:createPi5Standoffs` | Abgeschlossen |
| **M2.5-Innengewinde** | Modelliertes ISO Metric Profile `M2.5x0.45 6H` Gewinde ($6.5\,\text{mm}$ Tiefe) in allen 4 Säulen mit Fallbacks | `standoffs.ts:createPi5Standoffs` | Abgeschlossen |
| **FDM-Passungsspiel** | Offset-Faces-Feature mit $-0.05\,\text{mm}$ Spiel auf den Gewindeflanken | `standoffs.ts:createPi5Standoffs` | Abgeschlossen |
| **Orchestrierung** | Schritt 18 in `run()` integriert inkl. BRep-Live-Referenzen | `case.ts:run` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `standoff_outer_diameter`: `6mm` (Außendurchmesser der Befestigungssäulen)
- `standoff_height`: `6.5mm` (Höhe der Säulen über dem Gehäuse-Innenboden, um 1.5mm erhöht für exakten Port-Sitz)
- `standoff_hole_diameter`: `2.05mm` (Kernlochdurchmesser für M2.5-Innengewinde, ISO Tap Drill)
- `standoff_spacing_x`: `58mm` (Lochabstand in X-Richtung)
- `standoff_spacing_y`: `49mm` (Lochabstand in Y-Richtung)
- `standoff_thread_clearance`: `-0.05mm` (Passungsspiel für modelliertes M2.5-Gewinde im FDM-Druck)