# Erweiterungen

- Arbeite nur an der Dateien fusion/model/pi5/case/case.ts und den lokalen imports 'fusion/model/pi5/case/*.ts', 
sowie fusion/model/pi5/doc/prompt/p004/prompt.md und evtl. den anderen fusion/model/pi5/doc/prompt/**/prompt.md
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Lüftungsschlitze im Deckel

## Geometriebeschreibung

- **Skizzenebene auf dem Deckel:**
  - Konstruktionsebene parallel zur XY-Ebene auf der Deckeloberseite bei $Z = \text{case\_top\_height} = 40\,\text{mm}$ (`Plane_Lid_Vents`).
- **Zentraler Schlitz:**
  - Rechteck mit $80\,\text{mm}$ Länge (in X) $\times 2.5\,\text{mm}$ Breite (in Y), mittig platziert auf dem Ursprung $(X = 0, Y = 0)$.
- **Symmetrische lineare Anordnung (Rectangular Pattern):**
  - Anordnung in beide Richtungen ($\pm Y$): Symmetrisch, Menge 4 je Richtung (inklusive Mittel-Rechteck) über eine Gesamtlänge von $22\,\text{mm}$ ($22\,\text{mm}$ vom Zentrum nach oben $+Y$ und $22\,\text{mm}$ nach unten $-Y$).
  - Dies ergibt insgesamt 7 Schlitze mit einem Mittenabstand von $\Delta Y = 22\,\text{mm} / 3 \approx 7.333\,\text{mm}$:
    1. Schlitz 1 (oben): $Y = +22.000\,\text{mm}$
    2. Schlitz 2: $Y = +14.667\,\text{mm}$
    3. Schlitz 3: $Y = +7.333\,\text{mm}$
    4. Schlitz 4 (Mitte): $Y = 0.000\,\text{mm}$
    5. Schlitz 5: $Y = -7.333\,\text{mm}$
    6. Schlitz 6: $Y = -14.667\,\text{mm}$
    7. Schlitz 7 (unten): $Y = -22.000\,\text{mm}$
  - Jeder Schlitz erstreckt sich in X von $-40\,\text{mm}$ bis $+40\,\text{mm}$ ($80\,\text{mm}$ Länge) und hat eine Breite von $2.5\,\text{mm}$.
- **Extrusions-Schnitt nach innen mit Verjüngung:**
  - Tiefe: $-4\,\text{mm}$ nach innen (in $-Z$-Richtung durch die $3\,\text{mm}$ dicke Deckelwand in den Gehäuseinnenraum).
  - Verjüngungswinkel (Taper Angle): $25^\circ$ Verjüngung (`lid_vent_taper_angle`).
  - Operation: `CutFeatureOperation` gezielt auf den oberen Gehäusekörper (`Case_Top`).


## Steps

1) **Parameter (`parameters.ts`):**
   - Parametrisierung im strikten `snake_case` (AGENTS.md §3.2 & §3.3):
     - `lid_vent_slot_length`: `80mm` (Länge der Schlitze in X)
     - `lid_vent_slot_width`: `2.5mm` (Breite der Schlitze in Y)
     - `lid_vent_pattern_count`: `4` (unit: `''`, Anzahl der Schlitze je Richtung inklusive Mitte)
     - `lid_vent_pattern_distance`: `22mm` (Gesamtabstand der Anordnung vom Zentrum)
     - `lid_vent_cut_depth`: `-4mm` (Schnitttiefe nach innen)
     - `lid_vent_taper_angle`: `25 deg` (unit: `'deg'`, Verjüngungswinkel des Schnitts)

2) **Hilfsebene & Skizze auf dem Deckel:**
   - Erzeuge eine Konstruktionsebene parallel zur XY-Ebene bei $Z = \text{case\_top\_height}$ ($40\,\text{mm}$).
   - Erstelle darauf die Skizze `Sketch_Lid_Vent_Slots`.

3) **Schlitzprofile zeichnen:**
   - Berechne die Mittenpositionen der 7 Schlitze ($Y_i = i \cdot \frac{\text{lid\_vent\_pattern\_distance}}{\text{lid\_vent\_pattern\_count} - 1}$ für $i \in \{-3, -2, -1, 0, 1, 2, 3\}$).
   - Zeichne für jeden Schlitz ein geschlossenes Rechteck von $X = -40\,\text{mm}$ bis $+40\,\text{mm}$ und $Y = Y_i \pm 1.25\,\text{mm}$ unter Verwendung von `sketch.modelToSketchSpace(...)` (AGENTS.md §4.4).

4) **Extrusions-Schnitt mit 25° Verjüngung:**
   - Ermittle die 7 Rechteck-Profile in der Skizze.
   - Führe eine Schnitt-Extrusion (`CutFeatureOperation`) nach innen um $-4\,\text{mm}$ mit $25^\circ$ Verjüngungswinkel aus.
   - Beschränke die Schnittoperation auf `participantBodies = [Case_Top]`.

5) **Orchestrierung (`case.ts`):**
   - Integriere Schritt 17 in `case.ts:run()` nach Schritt 16 (Front-Vertiefung).
   - Validiere und sichere die Live-BRep-Referenz für `Case_Top`.


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrische Maße `lid_vent_slot_length` (80 mm), `lid_vent_slot_width` (2.5 mm), `lid_vent_pattern_count` (4), `lid_vent_pattern_distance` (22 mm), `lid_vent_cut_depth` (-4 mm), `lid_vent_taper_angle` (25 deg) | `parameters.ts:setupParameters` | Abgeschlossen |
| **Ebene & Skizze** | Konstruktionsebene bei $Z = 40\,\text{mm}$ und Skizze `Sketch_Lid_Vent_Slots` | `openings.ts:createLidVentilationSlots` | Abgeschlossen |
| **7 Schlitz-Rechtecke** | 7 Rechtecke ($80 \times 2.5\,\text{mm}$) symmetrisch bei $Y = 0, \pm 7.333, \pm 14.667, \pm 22.0\,\text{mm}$ | `openings.ts:createLidVentilationSlots` | Abgeschlossen |
| **Extrusions-Schnitt** | Gezielter Schnitt um -4 mm in `Case_Top` mit 25° Verjüngung (`participantBodies`) | `openings.ts:createLidVentilationSlots` | Abgeschlossen |
| **Orchestrierung** | Schritt 17 in `run()` integriert inkl. BRep-Live-Referenzen | `case.ts:run` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `lid_vent_slot_length`: `80mm` (Länge der Lüftungsschlitze)
- `lid_vent_slot_width`: `2.5mm` (Breite der Lüftungsschlitze)
- `lid_vent_pattern_count`: `4` (Anzahl Instanzen je Richtung inkl. Zentrum)
- `lid_vent_pattern_distance`: `22mm` (Gesamtabstand der Schlitze vom Zentrum)
- `lid_vent_cut_depth`: `-4mm` (Schnitttiefe nach innen)
- `lid_vent_taper_angle`: `25 deg` (Verjüngungswinkel)
