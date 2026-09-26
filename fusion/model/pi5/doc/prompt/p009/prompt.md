# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`, 
sowie `fusion/model/pi5/doc/prompt/p009/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Stützfreie FDM-3D-Druckanordnung aller druckbaren Gehäusekörper (Case_Top, Case_Middle, Case_Bottom) auf der XY-Ebene entlang der Y-Achse via Parameter layout_for_print

Analog zur Referenz-Implementierung in [fusion/model/marcintosh/case/printLayout.ts](../../../marcintosh/case/printLayout.ts) soll für das Raspberry Pi 5 Gehäuse eine automatisierte, stützoptimierte 3D-Druckanordnung (`layout_for_print`) geschaffen werden:
- **Zustand 0 (`layout_for_print = 0`, Standard):** Normaler Montagezustand (Assembled View) – alle drei Körper (`Case_Top`, `Case_Middle`, `Case_Bottom`) befinden sich in ihrer funktionalen Einbauposition im Raum. Etwaige Referenzkörper sind sichtbar geschaltet (`isLightBulbOn = true`).
- **Zustand 1 (`layout_for_print = 1`):** Stützfreie FDM-Druckanordnung (Print Bed Layout) – alle druckbaren Körper werden entlang der Y-Achse auf der XY-Ebene ($Z = 0$) nebeneinander mit parametrischem Abstand (`print_layout_spacing = 20mm`) aufgereiht. Eventuell vorhandene Referenzkörper werden automatisch ausgeblendet (`isLightBulbOn = false`).


## Druckausrichtungs- & Layout-Strategie (FDM-Optimierung gemäß AGENTS.md §4.11 & §2.3)

Für einen perfekten, stützfreien Druck auf modernen FDM-Druckern (z. B. Bambu Lab P2S / X1C / A1 mit PLA oder PETG) wird jedes Bauteil mit seiner optimalen Montage- bzw. Sichtfläche ausgerichtet:

1. **`Case_Top` (Gehäusedeckel mit 7 Lüftungsschlitzen & LED-Halterung):**
   - **Ausrichtung:** $180^\circ$ ($\pi$) Drehung um die X-Achse (Kopfüber / Upside-Down).
   - **Auflagefläche:** Die ebene Gehäusedeckelfläche bei $Z = 40.0\,\text{mm}$ liegt vollflächig und plan auf dem Druckbett bei $Z = 0$.
   - **FDM-Vorteile:**
     - Der nach unten weisende Steckkragen ($5.0\,\text{mm}$ hoch, $1.5\,\text{mm}$ dünne Wand) baut stabil und stufenlos vertikal nach oben in $+Z$ auf.
     - Die innenliegende LED-Führungshülse ($3.6\,\text{mm}$ Tiefe) bindet direkt an die Decke an und wächst vertikal stützfrei auf.
     - Die 7 Lüftungsschlitze ($80 \times 2.5\,\text{mm}$) mit $25^\circ$-Verjüngung drucken ohne jegliche Stützstruktur oder Überhangprobleme.
     - 100 % stützfreier Druck, perfekte Betthaftung auf der großen Deckelfläche ($91.4 \times 62.4\,\text{mm}$).

2. **`Case_Middle` (Rahmen / Mittelteil mit Anschlussaussparungen & Stufenfalz):**
   - **Ausrichtung:** $180^\circ$ ($\pi$) Drehung um die X-Achse (oben und unten vertauscht / Kopfüber).
   - **Auflagefläche:** Die obere Trennfläche bei $Z = 29.5\,\text{mm}$ (Schnittfläche der Fuge) liegt auf dem Druckbett bei $Z = 0$.
   - **FDM-Vorteile:**
     - Alle vier Außenwände stehen exakt $90^\circ$ senkrecht zur Druckplatte für maximale Schichtqualität an den Sichtflächen.
     - Die Nut-Verbindung zum Gehäuseboden ($Z = 0.0\,\text{mm}$) zeigt nach oben in $+Z$.
     - Die horizontalen Durchbrüche (USB-C, Micro-HDMI, Ethernet, USB) drucken sauber.

3. **`Case_Bottom` (Gehäuseboden mit 4 Standoffs & Nut/Feder-Rastleiste):**
   - **Ausrichtung:** Keine Rotation ($0^\circ$).
   - **Auflagefläche:** Die große, ebene Gehäuseunterseite ($Z = -10.4\,\text{mm}$) liegt vollflächig auf dem Druckbett bei $Z = 0$.
   - **FDM-Vorteile:**
     - Maximale Druckbetthaftung über die gesamte Bodenfläche ($91.4 \times 62.4\,\text{mm}$).
     - Die 4 Befestigungssäulen ($\varnothing 6\,\text{mm}$, $5\,\text{mm}$ Höhe) mit M2.5-Innengewinde sowie die nach oben stehende Feder (+1.6 mm Höhe) wachsen vertikal in $+Z$ auf.
     - Null Stützstrukturen erforderlich.

4. **Lineare Anordnung entlang der Y-Achse:**
   - Alle drei Bauteile werden in X auf $X = 0$ zentriert (`deltaX = -(box.minPoint.x + box.maxPoint.x) / 2.0`).
   - Entlang der Y-Achse werden die Bauteile chronologisch hintereinander mit dem parametrischen Abstand `print_layout_spacing` (Standard: $20\,\text{mm}$) aufgereiht:
     - Position 1: `Case_Top`
     - Position 2: `Case_Middle`
     - Position 3: `Case_Bottom`
   - In Z werden alle Körper exakt so verschoben, dass ihr tiefster Punkt auf $Z = 0.0\,\text{mm}$ aufliegt (`deltaZ = -box.minPoint.z`).

5. **Referenzkörper-Sichtbarkeit:**
   - Eventuell im Projekt vorhandene Referenzkörper (z. B. importierte Raspberry Pi 5 Platine) werden bei `layout_for_print = 1` automatisch ausgeblendet (`body.isLightBulbOn = false`) und bei `layout_for_print = 0` wieder sichtbar geschaltet (`body.isLightBulbOn = true`).


## Steps

1) **Parameter (`parameters.ts`):**
   - Ergänzung im strikten `snake_case` (AGENTS.md §3.2 & §3.3):
     - `layout_for_print`: `'0'` (Einheitenlos `''`, 0 = Normalzustand montiert, 1 = Druckanordnung aktiviert)
     - `print_layout_spacing`: `'20mm'` (Einheit `'mm'`, lichter Abstand zwischen den Bauteilen entlang der Y-Achse)
   - **Erhalt von Benutzerwerten:** Bereits existierende Parameter werden in `getOrCreateParam` nicht mit dem Default-Wert überschrieben, sodass manuelle Änderungen im Fusion-Parameter-Dialog (z. B. `layout_for_print = 1`) bei erneutem Skriptaufruf erhalten bleiben.

2) **Modul `printLayout.ts` (`arrangeBodiesForPrint`):**
   - Eigenständiges Modul `fusion/model/pi5/case/printLayout.ts` gemäß AGENTS.md §2.3.
   - `PrintableBodiesInput`-Interface für `top`, `middle`, `bottom`.
   - Robuste Hilfsfunktion `alignAndPlaceBody(body, targetName, rotAxis, rotAngleRad)`:
     - Drehung um den Bounding-Box-Mittelpunkt via `adsk.core.Matrix3D.setToRotation` und `moveFeatures.createInput2`.
     - Zentrierung in X auf $X = 0$, bündige Platzierung in Y am Fortschritts-Offset `currentY`, Nivellierung in Z auf $Z = 0$.
     - Vorschub `currentY += yDim + spacingCm`.
   - Sichtbarkeitssteuerung für Referenzkörper (`isLightBulbOn`).
   - Rückgabe aller drei aktualisierten Live-BRep-Körper.

3) **Orchestrierung in `case.ts:run()`:**
   - Einbindung als neuer **Schritt 22** nach Schritt 21 (`createLedOpeningAndMount`).
   - Aufruf von `arrangeBodiesForPrint(rootComp, { top: topBody, middle: middleBody, bottom: bottomBody }, params)`.
   - Aktualisierung der Live-Körperreferenzen und Bestätigung der Namen (`Case_Top`, `Case_Middle`, `Case_Bottom`).


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrische Maße `layout_for_print` (0/1 einheitenlos), `print_layout_spacing` (20 mm) | `parameters.ts:setupParameters` | Abgeschlossen |
| **Druckanordnungs-Modul** | Stützfreie Rotation (Deckel $180^\circ$ um X, Rahmen $180^\circ$ um X, Boden $0^\circ$) und Platzierung auf XY-Ebene ($Z = 0$) | `printLayout.ts:arrangeBodiesForPrint` | Abgeschlossen |
| **Referenzkörper-Handling** | Automatisches Ausblenden (`isLightBulbOn = false`) bei `layout_for_print = 1` | `printLayout.ts:arrangeBodiesForPrint` | Abgeschlossen |
| **Orchestrierung** | Schritt 22 in `case.ts:run` integriert inkl. Benennung aller 3 Körper (`Case_Top`, `Case_Middle`, `Case_Bottom`) | `case.ts:run` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `layout_for_print`: `'0'` (Einheitenloser Schalter: 0 = Montagezustand, 1 = FDM-Druckbett-Anordnung)
- `print_layout_spacing`: `'20mm'` (Lichter Zwischenabstand zwischen den Bauteilen entlang der Y-Achse)
