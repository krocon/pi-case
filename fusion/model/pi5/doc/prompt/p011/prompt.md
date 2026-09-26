# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`, 
sowie `fusion/model/pi5/doc/prompt/p011/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Parametrischer 0/1-Schalter (enable_stress_relief_fillets, Default = 1) zur automatisierten Verrundung & Anfasung nicht-sichtbarer Innenkanten (Spannungsreduktion im FDM-3D-Druck)

Analog zu `fusion/model/marcintosh/case/stressRelief.ts` soll für das Raspberry Pi 5 Gehäuse eine automatisierte, selektive Spannungsreduktion an rechtwinkligen ($90^\circ$) Innenkanten implementiert werden:
- **Zustand 0 (`enable_stress_relief_fillets = 0`):** Deaktiviert; Kanten verbleiben scharfkantig bzw. unverändert.
- **Zustand 1 (`enable_stress_relief_fillets = 1`, Standard/Default):** Automatisierte Identifikation und Verrundung nicht-sichtbarer $90^\circ$-Innenkanten mit Radius $1.0\,\text{mm}$ (`stress_relief_fillet_radius`), um Kerbspannungen bei FDM-Druckmaterialien (PLA, PETG, ABS) abzubauen, den Filamentfluss der Düse in Innenecken zu optimieren und die Abscherfestigkeit mechanisch belasteter Bereiche (z. B. Standoff-Säulen) drastisch zu steigern.


## Analyse der Bauteil-Orientierung & FDM-Druckregeln (`print_layout = 0` vs. `print_layout = 1`)

Die Lage der Körper im CAD-Montageraum (`print_layout = 0`) unterscheidet sich maßgeblich von ihrer physischen Druckausrichtung auf dem Druckbett (`print_layout = 1`, siehe `printLayout.ts`). Um Überhänge zu vermeiden und 100% stützfreien Druck zu garantieren, müssen die Innenkanten unter Berücksichtigung beider Orientierungen analysiert werden:

1. **`Case_Bottom` (Gehäuseboden):**
   - **CAD-Raum (`print_layout = 0`):** Erstreckt sich von $Z = -10.4\,\text{mm}$ (Außenboden) bis $Z = 0.0\,\text{mm}$ (Trennebene) bzw. $Z = +1.6\,\text{mm}$ (Feder/Tongue). Innenboden liegt bei $Z = -7.4\,\text{mm}$.
   - **Druckausrichtung (`print_layout = 1`):** Keine Rotation ($0^\circ$). Der flache Außenboden ($Z = -10.4\,\text{mm}$) liegt plan auf dem Druckbett ($Z = 0$). Schichten wachsen entlang $+Z$.
   - **Nicht-sichtbare Kanten & FDM-Wirkung:**
     - **4 aufrechte Innenkanten der Schale (Wand-zu-Wand):** Verlaufen vertikal von $Z = -7.4\,\text{mm}$ bis $Z = 0.0\,\text{mm}$ parallel zur Druckachse. In jeder Druckschicht bilden sie einen horizontalen 2D-Radius ($R = 1.0\,\text{mm}$) in der XY-Ebene $\implies$ 100% stützfrei, kein plötzliches Abbremsen der Düse in scharfen $90^\circ$-Ecken, verbesserte Schichthaftung.
     - **Standoff-Wurzeln ($\varnothing 6\,\text{mm}$ Säulen am Innenboden $Z = -7.4\,\text{mm}$):** Die 4 zylindrischen Säulen treffen rechtwinklig auf den ebenen Boden. Eine Verrundung mit $R = 1.0\,\text{mm}$ beginnt flach auf der bereits gedruckten Bodenschicht und wölbt sich nach oben zur Zylinderwand. Im FDM-Schichtaufbau verjüngt sich der Ring nach oben hin $\implies$ 100% stützfrei ohne Überhänge. Verhindert das Abscheren der Standoffs beim Eindrehen von M2.5-Schrauben.
     - **Innenboden-zu-Wand-Kehle ($Z = -7.4\,\text{mm}$):** Stetiger Übergang vom ebenen Boden in die aufrechten Wände $\implies$ liegt vollständig auf den Basisschichten auf, kein Überhang.
   - **Strikte Schutzbereiche (Keine Verrundung):**
     - Obere Standoff-Auflagefläche bei $Z = -0.9\,\text{mm}$ (muss absolut plan bleiben, da die Pi5-Platine hier aufliegt).
     - M2.5-Kernlochbohrung / Gewindegänge (Durchmesser $\le 2.5\,\text{mm}$).
     - Feder (Tongue) bei $Z \in [0.0, +1.6]\,\text{mm}$ und Trennfläche bei $Z = 0.0\,\text{mm}$ (präzise Passung zu `Case_Middle`).

2. **`Case_Middle` (Gehäuse-Mittelteil):**
   - **CAD-Raum (`print_layout = 0`):** Erstreckt sich von $Z = 0.0\,\text{mm}$ (Trennebene zu Boden) bis $Z = 29.5\,\text{mm}$ (Trennebene zu Deckel).
   - **Druckausrichtung (`print_layout = 1`):** $180^\circ$-Drehung um die X-Achse (Kopfüber). Die obere Trennfläche bei $Z = 29.5\,\text{mm}$ liegt plan auf dem Druckbett. Die Schichten wachsen im CAD-Raum in Richtung $-Z_{\text{CAD}}$ (von $Z = 29.5\,\text{mm}$ hinunter zu $Z = 0.0\,\text{mm}$).
   - **Nicht-sichtbare Kanten & FDM-Wirkung:**
     - **4 aufrechte Innenkanten (Wand-zu-Wand):** Verlaufen parallel zur Druckachse $\implies$ In der XY-Druckebene stützfreie 2D-Radien ($R = 1.0\,\text{mm}$).
   - **Strikte Schutzbereiche (Keine Verrundung):**
     - Untere Nut (Groove) bei $Z \in [0.0, 2.0]\,\text{mm}$ inkl. Rastnasen-Aussparung an der Rückwand.
     - Oberer Stufenfalz bei $Z \in [24.5, 29.5]\,\text{mm}$ (plane Pass- und Trennflächen zu `Case_Top` ohne Fase für stützfreie, saubere Auflage auf dem Druckbett bei $Z = 29.5\,\text{mm}$).
     - Äußere Sichtflächen und Port-Ausschnitte an Front und rechter Seitenwand.

3. **`Case_Top` (Gehäusedeckel):**
   - **CAD-Raum (`print_layout = 0`):** Erstreckt sich von $Z = 29.5\,\text{mm}$ (bzw. Steckkragen bei $Z = 24.5\,\text{mm}$) bis $Z = 40.0\,\text{mm}$ (Deckeloberseite). Die innere Deckenfläche liegt bei $Z = 37.0\,\text{mm}$.
   - **Druckausrichtung (`print_layout = 1`):** $180^\circ$-Drehung um die X-Achse (Kopfüber). Die flache Deckelaußenfläche ($Z = 40.0\,\text{mm}$) liegt auf dem Druckbett ($Z = 0$). Schichten wachsen im CAD-Raum in Richtung $-Z_{\text{CAD}}$.
   - **Nicht-sichtbare Kanten & FDM-Wirkung:**
     - **Innere Decken-Wand-Kehle ($Z_{\text{CAD}} = 37.0\,\text{mm}$):** Im CAD-Montagezustand wirkt diese Kante wie eine "Decke". Beim realen FDM-Druck auf dem Kopf ist diese Fläche jedoch der **Boden**, der nach den ersten $3\,\text{mm}$ massiven Deckelschichten gedruckt wird! Eine Verrundung ($R = 1.0\,\text{mm}$) wächst somit direkt aus dem bereits gedruckten Boden empor $\implies$ **Keinerlei Deckenüberhang im Druck**, sondern $100\%$ stützfrei aufliegend!
     - **4 aufrechte Innenkanten (Wand-zu-Wand):** Parallel zur Z-Achse $\implies$ In der XY-Druckebene stützfreie 2D-Radien ($R = 1.0\,\text{mm}$).
     - **LED-Halterungshülse (`led.ts`):** Verrundung der inneren Anbindungs- und Übergangskanten an Gehäusedecke und Innenwand.
   - **Strikte Schutzbereiche (Keine Verrundung):**
     - Die 7 Deckel-Lüftungsschlitze (bereits mit $25^\circ$-Verjüngung formschön und stützfrei ausgeführt).
     - Die umlaufende Schattenfuge ($Z \in [29.5, 32.0]\,\text{mm}$).
     - Der dünne Steckkragen ($Z \in [24.5, 29.5]\,\text{mm}$) mit $0.5\,\text{mm}$ Mini-Fase an der äußeren Unterkante ($Z = 24.5\,\text{mm}$) zur formschlüssigen Führung in `Case_Middle`.
     - Die rechteckige LED-Lichtaustrittsöffnung an der Fugenwand.


## Ergänzung: 0.5 mm Verrundung der innenliegenden Kanten im Case_Top (siehe Referenzbild [img.png](img.png))

Zur Veredelung der Innengeometrie von `Case_Top`, Vermeidung scharfer Kanten an Durchbrüchen und Optimierung des Filamentflusses bei der Überbrückung werden die innenliegenden Linien (im CAD-Modell blau hervorgehoben in [img.png](img.png)) mit einem Radius von $0.5\,\text{mm}$ (`lid_inner_fillet_radius`) verrundet:
1. **28 Innenkanten der 7 Lüftungsschlitze:**
   - Schnittkanten der 7 Schlitze an der inneren Gehäusedecke ($Z \approx 37.0\,\text{mm}$).
   - Je 2 Längskanten (entlang X) und 2 Querkanten (entlang Y) je Schlitz.
   - Da `Case_Top` im FDM-Druck kopfüber auf der Deckelfläche liegt, stellt die Deckenfläche den ersten Schichtboden nach $3\,\text{mm}$ Vollmaterial dar. Die $0.5\,\text{mm}$ Verrundung baut somit stützfrei auf dem gedruckten Boden auf.
2. **Innenkanten der LED-Halterungshülse:**
   - Kanten der inneren Stirnfläche bei $X = -40.2\,\text{mm}$ (Außenumriss der Hülse und Einlauf der $5.2 \times 2.2\,\text{mm}$ Tunnelöffnung).
   - Untere Übergangskante bei $Z = 2.845\,\text{mm}$.
3. **LED-Halterungsblock Überhang-Fix (siehe [img_led_overhang.png](img_led_overhang.png)):**
   - Der Halterungsblock wird im CAD-Modell in $+Z$ bis zur Deckeloberseite ($Z = 40.0\,\text{mm}$) durchgezogen (`sleeveMaxZ = topHeight`), und alle Skizzenprofile werden extrudiert.
   - Beim FDM-Druck auf dem Kopf (Deckeloberseite auf dem Druckbett bei $Z = 0$) wächst der Block somit stufenlos aus der Deckelbasis empor: **Keinerlei horizontaler Überhang!**


## Steps

1) **Parameter (`parameters.ts`):**
   - Ergänzung im strikten `snake_case` (AGENTS.md §3.2 & §3.3):
     - `enable_stress_relief_fillets`: `'1'` (Einheitenloser Schalter `''`: 0 = Aus, 1 = An [Standard/Default])
     - `stress_relief_fillet_radius`: `'1mm'` (Radius für spannungsreduzierende Innenverrundungen)
     - `lid_inner_fillet_radius`: `'0.5mm'` (Radius für innenliegende Kanten der Lüftungsschlitze und LED-Halterung in `Case_Top`)
   - Erhalt bestehender Benutzerwerte in `getOrCreateParam`.

2) **CAD-Modul `stressRelief.ts` (`applyStressReliefTreatments`):**
   - Eigenständiges Modul `fusion/model/pi5/case/stressRelief.ts` gemäß AGENTS.md §2.3 ("Querschnitts- & Nachbearbeitungsfunktionen").
   - Filterfunktion `collectStressReliefEdges(comp, body, role, params)`:
     - Sammelt konkave Kanten via `body.concaveEdges`.
     - Prüft Manifold-Kanten mit 2 BRepFaces und Mindestlänge $\ge 0.8\,\text{mm}$.
     - Prüft Orthogonalität ($\approx 90^\circ$ Flächenwinkel zwischen Planar- und Zylinderflächen).
     - Wendet strikte Ausschlussfilter für Pass- und Schnittstellen an.
   - Filterfunktion `collectCaseTopInnerEdges(comp, body, params)`:
     - Isoliert die 28 Innenkanten der 7 Lüftungsschlitze an der Decke ($Z \approx 37.0\,\text{mm}$) und die Innenkanten der LED-Halterungshülse ($X \approx -40.2\,\text{mm}$).
   - Anwendungsfunktion `applyStressReliefTreatments(comp, bodies, params)`:
     - Prüft Schalter `enable_stress_relief_fillets`.
     - Wendet das 4-Stufen-Fallback-System `applyFilletWithFallbacks` auf die Kantengruppen an:
       - $1.0\,\text{mm}$ Verrundung an `Case_Bottom`, `Case_Middle` und `Case_Top` (strukturelle Innenkanten).
       - $0.5\,\text{mm}$ Verrundung an `Case_Top` für Lüftungsschlitze und LED-Halterung (`collectCaseTopInnerEdges`).
     - Gibt die aktualisierten Live-Körperreferenzen mit verifizierten Namen (`Case_Top`, `Case_Middle`, `Case_Bottom`) zurück.

3) **Orchestrierung in `case.ts:run()`:**
   - Import von `applyStressReliefTreatments`.
   - Aufruf als neuer Schritt 22 vor STEP-Board-Import (Schritt 23) und Druckanordnung (Schritt 24).
   - Aktualisierung des Skript-Headers und der Konsolen-Logs.


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrischer Schalter `enable_stress_relief_fillets` (Default `'1'`), `stress_relief_fillet_radius` (`'1mm'`) & `lid_inner_fillet_radius` (`'0.5mm'`) | `parameters.ts:setupParameters` | Abgeschlossen |
| **Nachbearbeitungs-Modul** | Kantenanalyse, Ausschlussfilterung und 4-Stufen-Fallback-Verrundung an `Case_Bottom`, `Case_Middle`, `Case_Top` (1.0 mm) | `stressRelief.ts:applyStressReliefTreatments` | Abgeschlossen |
| **Ergänzung Case_Top** | $0.5\,\text{mm}$ Verrundung der Lüftungsschlitze & LED-Halterung in `Case_Top` gemäß [img.png](img.png) | `stressRelief.ts:collectCaseTopInnerEdges` | Abgeschlossen |
| **Orchestrierung** | Schritt 22 in `case.ts:run` integriert vor Referenz-Import und Druckanordnung | `case.ts:run` | Abgeschlossen |
| **FDM-Stützfreiheit** | Stützfreie Geometrien unter Berücksichtigung von $0^\circ$- (Bottom) und $180^\circ$-Ausrichtung (Top, Middle) | `stressRelief.ts` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `enable_stress_relief_fillets`: `'1'` (Einheitenloser Schalter: 0 = Deaktiviert, 1 = Aktiviert [Default])
- `stress_relief_fillet_radius`: `'1mm'` (Radius für Innenverrundungen)
- `lid_inner_fillet_radius`: `'0.5mm'` (Radius für innenliegende Kanten der Schlitze und LED-Halterung)
- `shell_thickness`: `'3mm'`, `case_bottom_height`: `'10.4mm'`, `case_top_height`: `'40mm'`
- `lid_split_z`: `'29.5mm'`, `lid_joint_depth`: `'5mm'`

