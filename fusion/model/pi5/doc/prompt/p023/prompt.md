# Erweiterungen (p023): Kreisrundes Durchgangsloch in Case_Middle sowie 6 gleichverteilte Lüftungsschlitze in Case_Top

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p023/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel

### a) Kreisrundes Durchgangsloch in `Case_Middle` (Rechtecköffnung entfernt)

Konstruktion eines kreisrunden Durchgangslochs auf der kurzen linken Gehäuseseite ($X = -45.7\,\text{mm}$) in `Case_Middle` gemäß [img_1.png](img_1.png):
1. **Entfernung der rechteckigen Öffnung:**
   - Die zuvor geplante untere rechteckige Öffnung ($5.20 \times 2.20\,\text{mm}$ mit $0.4\,\text{mm}$ dünner Außenhaut) entfällt vollständig und wurde wieder entfernt.
   - Die Gehäusewand von `Case_Middle` bleibt an dieser Stelle geschlossen und massiv.
2. **Kreisrundes Durchgangsloch ([img_1.png](img_1.png)):**
   - **Funktion:** Zugang / Betätigungsöffnung für den Power-Button des Raspberry Pi 5.
   - **Durchmesser:** $\varnothing 1.00\,\text{mm}$ (Radius $0.50\,\text{mm}$, `middle_hole_diameter = 1mm` bzw. `middle_opening_circle_diameter = 1mm`).
   - **Horizontale Positionierung (Y-Achse):** $Y = -9.60\,\text{mm}$ (`middle_hole_y_offset = -9.6mm`, abgeleitet aus dem $3.80\,\text{mm}$ Kantenabstand zum vorherigen Rechteck bei $Y = -13.4\,\text{mm}$ gemäß Bemaßung in [img_1.png](img_1.png)).
   - **Vertikale Positionierung (Z-Achse):** $Z = \text{middle\_hole\_z\_offset} = 6.95\,\text{mm} + \text{case\_middle\_height\_offset}$ ($2.95\,\text{mm}$ bei nominal $-4\,\text{mm}$ Höhenoffset; ehemals $26.0\,\text{mm}$ von der Oberkante der oberen LED-Öffnung bemaßt gemäß [img.png](img.png)).
   - **Vollständiges Durchgangsloch:** Wird von außerhalb ($X = -55\,\text{mm}$) komplett durch die Außenwand von `Case_Middle` und den Steckkragen von `Case_Bottom` durchgehend freigeschnitten.

### b) 6 gleichverteilte Lüftungsschlitze in `Case_Top`

Reduzierung der Deckel-Lüftungsschlitze von bisher 7 auf 6 Schlitze bei gleichbleibender Gesamtspanne:
- **Gesamtabstand:** Äußere Schlitze bei $Y = \pm 22.0\,\text{mm}$ (`lid_vent_pattern_distance = 22mm`, Gesamtspanne $44.0\,\text{mm}$).
- **Gleichverteilung:** 5 gleich große Intervalle mit Rasterabstand $\Delta Y = 44.0\,\text{mm} / 5 = 8.80\,\text{mm}$.
- **Symmetrie:** Vollkommen spiegelsymmetrisch um $Y = 0$ (Schlitze bei $Y = \pm 4.40\,\text{mm}$, $\pm 13.20\,\text{mm}$ und $\pm 22.00\,\text{mm}$). Kein Schlitz auf $Y = 0$.

---

## 1. Geometrische & Mathematische Analyse

### A) Kreisrundes Rundloch in Case_Middle (Schritt 21b)

| Parameter / Bezugsmaß | Wert / Formel | Beschreibung |
| :--- | :--- | :--- |
| `middle_hole_diameter` | $1.0\,\text{mm}$ | Durchmesser des kreisrunden Lochs ($\varnothing 1.00\,\text{mm}$) |
| `middle_hole_y_offset` | $-9.6\,\text{mm}$ | Y-Position des Zentrums des kreisrunden Lochs auf linker Seitenwand |
| `middle_hole_z_offset` | $2.95\,\text{mm}$ | Zentrum des Rundlochs (konstant relativ zu `Case_Bottom`, unabhängig von `case_middle_height_offset`) |
| Rundloch-Schnitt ($+X$) | $18.0\,\text{mm}$ ab $X = -55.0\,\text{mm}$ | Durchgängige Bohrung durch Außenwand von `Case_Middle` und Kragen von `Case_Bottom` |
| *Rechtecköffnung* | *entfällt* | *Rechteckige Öffnung und 0.4 mm Außenhaut wurden wieder entfernt* |

### B) 6 gleichverteilte Lüftungsschlitze (Schritt 17)

| Schlitz-Index | Mittenposition $Y$ | Intervallbreite zum Nachbarn | Status |
| :--- | :--- | :--- | :--- |
| 1 (Rückwand-nah) | $+22.00\,\text{mm}$ | - | Äußerer Schlitz oben |
| 2 | $+13.20\,\text{mm}$ | $8.80\,\text{mm}$ | Innensteg: $6.30\,\text{mm}$ |
| 3 | $+4.40\,\text{mm}$ | $8.80\,\text{mm}$ | Innensteg: $6.30\,\text{mm}$ |
| 4 | $-4.40\,\text{mm}$ | $8.80\,\text{mm}$ | Mittelsteg um $Y = 0$: $6.30\,\text{mm}$ |
| 5 | $-13.20\,\text{mm}$ | $8.80\,\text{mm}$ | Innensteg: $6.30\,\text{mm}$ |
| 6 (Front-nah) | $-22.00\,\text{mm}$ | $8.80\,\text{mm}$ | Äußerer Schlitz unten |

- **Vorteil gegenüber 7 Schlitzen:** Der Stegabstand zwischen den Schlitzen erhöht sich von $4.83\,\text{mm}$ auf $6.30\,\text{mm}$, was die Formstabilität und Verwindungssteifigkeit des Deckels beim FDM-Druck spürbar verbessert.

---

## 2. Implementierungsdetails

1. **Parameter (`parameters.ts`):**
   - `lid_vent_slot_count`: `6` (Default 6, unit `''`).
   - `lid_vent_pattern_count`: Auf `3` je Richtung aktualisiert (für Rückwärtskompatibilität).
   - `middle_hole_diameter` (bzw. `middle_opening_circle_diameter`): `1mm`.
   - `middle_hole_y_offset`: `-9.6mm`.
   - `middle_hole_z_offset` (bzw. `middle_opening_z_offset`): `'2.95mm'` (konstant zu `Case_Bottom`, unabhängig von `case_middle_height_offset`).
   - Rechteck-spezifische Parameter (`middle_opening_width`, `middle_opening_height`, `middle_opening_skin_thickness`, etc.) wurden entfernt; eventuell im Design vorhandene Alt-Parameter werden bei Bedarf robust als Fallback toleriert.

2. **Geometrieerzeugung (`openings.ts`):**
   - `createLidVentilationSlots`: Dynamische Berechnung von `centerYCm = -patternDistCm + k * stepCm` für $k \in [0, \text{slotCount}-1]$.
   - `createMiddleSideHole` (alias `createMiddleSideOpening`):
     - **Kreisrundes Loch:** Erzeugt Ebene `Plane_Middle_Opening_Hole` bei $X = -5.5\,\text{cm}$, zeichnet Kreis ($\varnothing 1.0\,\text{mm}$ bei $Y = -9.6\,\text{mm}$, $Z = \text{middle\_hole\_z\_offset}$) und schneidet komplett durch Außenwand von `Case_Middle` und Kragen von `Case_Bottom`.
     - **Rechteckige Öffnung:** Wurde vollständig entfernt (keine `Plane_Middle_Opening_Rect`, kein Rechteck-Schnitt).

3. **Orchestrierung (`case.ts`):**
   - Schritt 17 Log: 6 Schlitze.
   - Schritt 21b: Ruft `createMiddleSideHole` auf; BRep-Referenzen von `Case_Middle` und `Case_Bottom` werden robust über `getLiveBody` aktualisiert und an Folgefunktionen (`applyStressReliefTreatments`, `createCaseLogo`, `arrangeBodiesForPrint`) weitergereicht.
