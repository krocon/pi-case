# Verrundung der Kanten auf der inneren Grundfläche von Case_Bottom für FDM-Druck (p027)

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p027/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel

Im Gehäuseunterteil `Case_Bottom` sollen auf der inneren Grundfläche (Bodenfläche) die Kanten mit einer Verrundung versehen werden, um das Bauteil optimal für den FDM-3D-Druck (Schichtaufbau in $+Z$) auszulegen.
Hierbei werden **ausschließlich die Kanten verrundet, die parallel zur XY-Ebene liegen** (horizontale Boden-zu-Wand-Kehlen bei $Z = -3.4\,\text{mm}$). Die senkrechten/aufrechten Kanten (parallel zur Z-Achse an den Wand-zu-Wand-Innenecken) verbleiben strikt unverrundet.

---

## 1. Geometrische & Mathematische Analyse

### A) Bezugsebenen & Koordinaten

| Parameter / Bezugsmaß | Wert / Formel | Beschreibung |
| :--- | :--- | :--- |
| `case_bottom_height` | `6.4mm` | Gesamte Höhe des unteren Gehäuseteils in $-Z$ |
| `shell_thickness` | `3.0mm` | Wand- und Bodendicke der Schale |
| $Z_{\text{outer\_bottom}}$ | $-6.4\,\text{mm}$ ($-0.64\,\text{cm}$) | Unterseite des Außenbodens (liegt bei `layout_for_print = 1` flach auf dem Druckbett $Z = 0$) |
| $Z_{\text{floor}}$ | $-3.4\,\text{mm}$ ($-0.34\,\text{cm}$) | Innere Grundfläche (Floor Face) von `Case_Bottom`: $-6.4\,\text{mm} + 3.0\,\text{mm}$ |
| $Z_{\text{rim}}$ | $0.0\,\text{mm}$ ($0.0\,\text{cm}$) | Obere Trennebene / Fügekante zu `Case_Middle` / `Case_Main` |
| `case_bottom_inner_fillet_radius` | `1.0mm` (Default: `1mm`) | Verrundungsradius der Kanten auf der inneren Grundfläche parallel zur XY-Ebene |

### B) Kantenanalyse auf der inneren Grundfläche

Die innere Grundfläche von `Case_Bottom` ist eine ebene Fläche (`SurfaceTypes.PlaneSurfaceType`) bei $Z = -3.4\,\text{mm}$ mit aufwärts gerichteter Normale $\vec{n} = (0, 0, 1)$.
Ihre Begrenzungskanten zu den 4 aufrechten Gehäuseinnenwänden verlaufen exakt horizontal in der Ebene $Z = -3.4\,\text{mm}$:

1. **Vordere Kehle (Front):** Entlang X bei $Y = -28.2\,\text{mm}$, $Z = -3.4\,\text{mm}$ (parallel zur XY-Ebene).
2. **Hintere Kehle (Back):** Entlang X bei $Y = +28.2\,\text{mm}$, $Z = -3.4\,\text{mm}$ (parallel zur XY-Ebene).
3. **Linke Kehle (Left):** Entlang Y bei $X = -42.7\,\text{mm}$, $Z = -3.4\,\text{mm}$ (parallel zur XY-Ebene).
4. **Rechte Kehle (Right):** Entlang Y bei $X = +42.7\,\text{mm}$, $Z = -3.4\,\text{mm}$ (parallel zur XY-Ebene).

**Ausschluss:**
- Die 4 aufrechten Wand-Innenecken verlaufen in Z-Richtung von $Z = -3.4\,\text{mm}$ bis $Z = 0.0\,\text{mm}$ (senkrecht zur XY-Ebene) und werden **nicht** verrundet.

### C) FDM-Druckoptimierung (Stützfreier Schichtaufbau)

1. **Orientierung:** `Case_Bottom` wird auf dem flachen Außenboden ($Z = -6.4\,\text{mm}$) liegend gedruckt.
2. **Schichtfolge:** Die ersten Schichten (0 bis 3.0 mm) bilden den massiven Boden. Ab $Z = 3.0\,\text{mm}$ (entspricht $Z_{\text{floor}} = -3.4\,\text{mm}$ im CAD-Montageraum) beginnen die aufrechten Wände.
3. **Wirkung der Verrundung:**
   - Ein harter $90^\circ$-Winkel führt im FDM-Druck zu abrupten Brems- und Beschleunigungsvorgängen der Düse sowie hoher Kerbspannungsanfälligkeit bei Stoß- oder Biegebelastung.
   - Der Radius $R = 1.0\,\text{mm}$ erstreckt sich bei $0.2\,\text{mm}$ Schichthöhe über 5 Schichten mit stetig wachsendem Böschungswinkel von $0^\circ$ (horizontal) bis $90^\circ$ (vertikal), mittlerer Überhangwinkel $45^\circ$.
   - Dies gewährleistet $100\%$ stützfreien Druck ohne Durchhängen von Filamentsträngen und maximiert die Schichthaftung zwischen Boden und Gehäusewand.

---

## 2. Implementierungsdetails

1. **Parameter-Management (`parameters.ts`):**
   - Ergänzung des Parameters `case_bottom_inner_fillet_radius` mit Standardwert `'1mm'` und Einheit `'mm'`.

2. **CAD-Modul `chassis.ts` (`filletCaseBottomInnerFloorEdges`):**
   - Neue exportierte Funktion `filletCaseBottomInnerFloorEdges(rootComp, bottomBody, params)`.
   - Identifiziert die innere Grundfläche über Normalenvektor $(0, 0, 1)$ und $Z \approx -3.4\,\text{mm}$.
   - Filtert ausschließlich Kanten, deren Anfangs- und Endpunkte auf der Ebene liegen ($\Delta Z \approx 0$, parallel zur XY-Ebene).
   - Wendet `applyFilletWithFallbacks` mit `case_bottom_inner_fillet_radius` an.

3. **Orchestrierung in `case.ts:run()`:**
   - Schritt 7b wird unmittelbar nach der Außenkantenverrundung (Schritte 6–7) ausgeführt, bevor Einbauten (Standoffs, Rastnasen, SD-Kartenführung) den Boden segmentieren.

4. **Spannungsreduktion `stressRelief.ts`:**
   - Filterkriterium in `collectStressReliefEdges` für `role === 'bottom'` stellt sicher, dass vertikale Innenkanten ($\Delta Z > 0.2\,\text{mm}$) ausgeschlossen bleiben.
