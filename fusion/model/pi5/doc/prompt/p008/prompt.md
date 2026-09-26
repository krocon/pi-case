# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`, 
sowie `fusion/model/pi5/doc/prompt/p008/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Rechteckige Öffnung und Halterung für eine 5x2 mm LED in der Schattenfuge der kurzen linken Seitenwand (Retro Apple "Nutshell Pi" Look)

Integration einer seitlichen rechteckigen Öffnung und einer formschlüssigen Innenhalterung für eine rechteckige Status-/Power-LED im Retro-Look gemäß den Referenzbildern:
- **Design-Vorlage (Nutshell Pi):** [img_nutshell.jpg](img_nutshell.jpg) (Grün leuchtende Rechteck-LED im rechten Bereich der horizontalen Schattenfuge auf der kurzen Gehäuseseite, angrenzend an die Portseite mit USB-C/HDMI).
- **Positionierungskorrektur:** [img_cad.png](img_cad.png) (Verschiebung der LED-Öffnung von der langen Frontseite um die Ecke auf die kurze linke Seitenwand).
- **LED-Bauteil:** [img.png](img.png) (Rechteckige $5.0 \times 2.0 \times 7.0\,\text{mm}$ LED mit 2 Anschlussbeinchen im Rastermaß $2.54\,\text{mm}$).

Zur perfekten Passung und werkzeuglosen Montage:
1. **Rechteckige Gehäuseöffnung:** Die Fugenwand des Deckels (`Case_Top`) auf der linken kurzen Gehäuseseite ($X = -45.7\,\text{mm}$) erhält bei $Y = -16.0\,\text{mm}$ (`led_y_offset`) und $Z = 30.75\,\text{mm}$ (`led_z_offset`) eine $5.2 \times 2.2\,\text{mm}$ große Aussparung, durch die der Leuchtkopf der LED bündig nach außen strahlt.
2. **Monolithische Haltehülse (Pocket/Sleeve):** Auf der linken Innenwand von `Case_Top` ($X = -42.7\,\text{mm}$) wird eine kompakte Haltehülse ($5.2 \times 2.2\,\text{mm}$ Innenmaß, $1.2\,\text{mm}$ Wandstärke, $2.5\,\text{mm}$ Tiefe nach innen bis $X = -40.2\,\text{mm}$) direkt an die Gehäusewand und die Gehäusedecke angebunden.
3. **Kollisionsfreiheit & stützfreier Druck:** Die Hülse endet bei $X = -40.2\,\text{mm}$ und liegt damit vollständig außerhalb des Deckel-Lüftungsschlitzbereichs ($X \ge -40.0\,\text{mm}$). Beim FDM-Druck (Kopfüber auf der Deckelfläche) wächst sie ohne Überhänge stabil aus der Decke empor.


## Geometriebeschreibung

- **Horizontale Positionierung (X- und Y-Achse):**
  - Gehäuseaußenmaße: $91.4 \times 62.4\,\text{mm}$ ($X \in [-45.7, +45.7]\,\text{mm}$, $Y \in [-31.2, +31.2]\,\text{mm}$).
  - Die linke Gehäuseaußenwand liegt bei $X = -45.7\,\text{mm}$ (kurze Gehäuseseite).
  - Die Fugenwand (nach innen versetzt) liegt bei $X = -44.2\,\text{mm}$.
  - Die Innenfläche der Gehäuseschale liegt bei $X = -42.7\,\text{mm}$.
  - **LED-Mitte entlang Y:** Exakt bei $Y = -16.0\,\text{mm}$ (`led_y_offset`), auf der vorderen Hälfte der linken Seitenwand (ca. $15\,\text{mm}$ Abstand zur vorderen Gehäuseecke). Dies entspricht exakt der Position im Referenzfoto ([img_nutshell.jpg](img_nutshell.jpg)).

- **Vertikale Positionierung (Z-Achse):**
  - Die umlaufende Schattenfuge liegt zwischen $Z = 29.5\,\text{mm}$ (`lid_split_z`) und $Z = 32.0\,\text{mm}$ (Höhe $2.5\,\text{mm}$).
  - **LED-Mitte:** Bei $Z = 30.75\,\text{mm}$ (`led_z_offset`), exakt im vertikalen Zentrum der Fuge.
  - Die $2.2\,\text{mm}$ hohe Öffnung erstreckt sich von $Z = 29.65\,\text{mm}$ bis $Z = 31.85\,\text{mm}$.
  - Ober- und unterhalb verbleibt ein sauberer $0.15\,\text{mm}$ Randsteg zur Fugenoberkante ($32.0\,\text{mm}$) und Fugenunterkante ($29.5\,\text{mm}$).

- **Innenliegende Halterung (Sleeve an `Case_Top`):**
  - **Kompakter Außenkörper:** Ein solider Quader, der sich von der linken Innenwand bei $X = -42.7\,\text{mm}$ um $2.5\,\text{mm}$ nach innen in $+X$-Richtung bis $X = -40.2\,\text{mm}$ erstreckt.
    - Breite entlang Y: $5.2\,\text{mm} + 2 \times 1.2\,\text{mm} = 7.6\,\text{mm}$ ($Y \in [-19.8, -12.2]\,\text{mm}$).
    - Höhe entlang Z: $Z \in [28.45, 40.0]\,\text{mm}$ (im CAD-Modell nach oben bis zur Deckeloberseite bei $Z = 40.0\,\text{mm}$ durchgezogen, siehe [Schnittanalyse](img_overhang.png)).
    - Da die Deckel-Lüftungsschlitze erst ab $X = -40.0\,\text{mm}$ beginnen, liegt die gesamte Halterung im massiven Deckenbereich ($X \le -40.0\,\text{mm}$) und schneidet keinen einzigen Lüftungsschlitz!
    - Verbunden monolithisch via `JoinFeatureOperation` mit `Case_Top`.
  - **Durchgehender LED-Führungstunnel:**
    - Abmessungen: Breite $5.2\,\text{mm}$ ($Y \in [-18.6, -13.4]\,\text{mm}$), Höhe $2.2\,\text{mm}$ ($Z \in [29.65, 31.85]\,\text{mm}$).
    - Schneidet von außerhalb ($X = -55\,\text{mm}$) komplett durch die $1.5\,\text{mm}$ Fugenwand und den $2.5\,\text{mm}$ Halterungsblock hindurch ins Gehäuseinnere (Gesamtlänge der Führung $4.0\,\text{mm}$).
    - Der $7.0\,\text{mm}$ LED-Körper wird formschlüssig auf $4.0\,\text{mm}$ Länge spielfrei gehalten; die Rückseite des Körpers und die Pins treten bei $X = -40.2\,\text{mm}$ frei ins Gehäuseinnere hervor.

- **FDM-Druck-Optimierung (AGENTS.md §4.11 & [img_overhang.png](img_overhang.png)):**
  - `Case_Top` wird mit der flachen Oberseite ($Z = 40.0\,\text{mm}$) auf dem Druckbett gedruckt.
  - Durch das Durchziehen des LED-Blocks im CAD-Modell ganz nach oben ($+Z$ bis $Z = 40.0\,\text{mm}$, im Schnittbild nach unten zum Druckbett) beginnt der Block direkt auf dem Druckbett bzw. der massiven $3\,\text{mm}$-Deckelschicht.
  - Beim Drucken in Schichtrichtung wächst der Block stufenlos empor: **Keinerlei horizontaler Überhang oder Stützstruktur erforderlich!**


## Steps

1) **Parameter (`parameters.ts`):**
   - Parametrisierung im strikten `snake_case` (AGENTS.md §3.2 & §3.3):
     - `led_y_offset`: `-16mm` (Position der LED entlang der kurzen linken Seitenwand)
     - `led_x_offset`: `-45.7mm` (Referenz-Koordinate an linker Seitenwand)
     - `led_z_offset`: `30.75mm` (Z-Höhe im Zentrum der Fuge)
     - `led_opening_width`: `5.2mm` (Breite der Gehäuseöffnung entlang Y)
     - `led_opening_height`: `2.2mm` (Höhe der Gehäuseöffnung entlang Z)
     - `led_body_depth`: `2.5mm` (Tiefe der Halterung nach innen, endet vor den Deckelschlitzen)
     - `led_holder_wall_thickness`: `1.2mm` (Wandstärke der Haltehülse)
     - `led_pin_slot_width`: `3.8mm` (Breite des Pin-Durchbruchs)
     - `led_pin_slot_height`: `1.2mm` (Höhe des Pin-Durchbruchs)

2) **CAD-Modul `led.ts` (`createLedOpeningAndMount`):**
   - Konstruktionsebene `Plane_Led_Sleeve_Base` an der linken Innenwand bei $X = -42.7\,\text{mm}$.
   - Erstellung des $2.5\,\text{mm}$ tiefen Halterungs-Außenkörpers via `JoinFeatureOperation` an `Case_Top` (Ende bei $X = -40.2\,\text{mm}$, vor den Deckelschlitzen bei $X \ge -40.0\,\text{mm}$).
   - Schnitt-Extrusion der $5.2 \times 2.2\,\text{mm}$ Tunnelkontur von außerhalb ($X = -55\,\text{mm}$) komplett durch die linke Fugenwand und den Block hindurch.
   - Sicherstellung der Live-Körperreferenz für `Case_Top`.

3) **Orchestrierung in `case.ts:run()`:**
   - Aufruf als Schritt 21 nach `splitAndCreateLidJoint` (Schritt 20).
   - Aktualisierung und Prüfung aller Live-Körper (`Case_Top`, `Case_Middle`, `Case_Bottom`).


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrische Maße `led_y_offset` (-16 mm), `led_z_offset`, `led_opening_width`, `led_opening_height`, `led_body_depth` (2.5 mm), `led_holder_wall_thickness` | `parameters.ts:setupParameters` | Abgeschlossen |
| **Halterungs-Geometrie** | Kompakter Außenkörper ($7.6 \times 4.6 \times 2.5\,\text{mm}$) an linker Innenwand ($X = -42.7\,\text{mm}$) monolithisch mit Decke verbunden | `led.ts:createLedOpeningAndMount` | Abgeschlossen |
| **LED-Öffnung & Tunnel** | $5.2 \times 2.2\,\text{mm}$ Schnitt komplett durch linke Fugenwand und Halterung (Ende bei $X = -40.2\,\text{mm}$, vor Deckelschlitzen) | `led.ts:createLedOpeningAndMount` | Abgeschlossen |
| **Orchestrierung** | Schritt 21 in `case.ts:run` integriert inkl. Benennung aller 3 Körper | `case.ts:run` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `led_y_offset`: `-16mm` (Position der LED entlang der kurzen linken Seitenwand)
- `led_z_offset`: `30.75mm` (Z-Höhe im Zentrum der Fuge)
- `led_opening_width`: `5.2mm` (Breite der Gehäuseöffnung inkl. 0.2 mm Passungsspiel)
- `led_opening_height`: `2.2mm` (Höhe der Gehäuseöffnung inkl. 0.2 mm Passungsspiel)
- `led_body_depth`: `2.5mm` (Tiefe des Halterungsblocks nach innen ab Gehäuseinnenwand, strikt vor den Deckelschlitzen)
- `led_holder_wall_thickness`: `1.2mm` (Wandstärke der Führungshülse)
- `led_pin_slot_width`: `3.8mm` (Breite des Schlitzes für 2 Pins à 2.54 mm Raster)
- `led_pin_slot_height`: `1.2mm` (Höhe des Pin-Schlitzes)
