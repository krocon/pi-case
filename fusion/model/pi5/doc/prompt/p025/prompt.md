# Erweiterungen (p025): Zusammenführung von Deckel und Mittelteil zu 'Case_Main' via Flag 'merge_top_and_middle'

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p025/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel

Durch das Flag `merge_top_and_middle` (Werte: `0` oder `1`, Standardwert: `0`) kann das Gehäuse zwischen zwei Bauweisen umgeschaltet werden:

### `merge_top_and_middle = 0` (Standard)
Alles wie gehabt, keine geometrischen Änderungen:
- Es entstehen 3 Körper: `Case_Top`, `Case_Middle`, `Case_Bottom` (plus optional `Logo`).
- Umlaufender Sims bzw. Schattenfuge (-2.5 mm Schnitt) bei $Z = 29.5\,\text{mm}$ bis $32.0\,\text{mm}$.
- Horizontale Trennung am unteren Fugenende mit 5 mm Stufenfalz, 45°-Rampen an den 4 Wänden, 4 planen Ecken und 4 Rastnasen.
- Rechteckige Öffnung ($5.2 \times 2.2\,\text{mm}$) und innere Halterungshülse für die LED in `Case_Top`.
- Kreisrundes Durchgangsloch ($\varnothing 1.0\,\text{mm}$) in `Case_Middle` und `Case_Bottom` (p023).

### `merge_top_and_middle = 1`
Es soll kein separater `Case_Top`-Körper konstruiert werden:
1. **Genau 2 Körper:** `Case_Bottom` (wie bisher) und `Case_Main`.
2. **Direkt aufgesetzter Deckel:** Der Deckel mit den 8 verrundeten Kanten ($R = 2.0\,\text{mm}$) und den 6 Lüftungsschlitzen ($80 \times 2.5\,\text{mm}$, 25°-Verjüngung) ist monolithischer Bestandteil von `Case_Main`.
3. **Keine LED-Öffnung:** Die rechteckige Öffnung und die innere LED-Halterungshülse entfallen vollständig.
4. **Kein Sims / glatte Wand:** Die umlaufende Schattenfuge (Schritte 8, 10–14) wird übersprungen; die Außenwand von `Case_Main` ist durchgehend glatt.
5. **Kreisrundes Durchgangsloch:** Das Loch ($\varnothing 1.0\,\text{mm}$ bei $Y = -9.6\,\text{mm}$) für den Power-Button bleibt in `Case_Main` und `Case_Bottom` erhalten.

Das resultierende Bauteil `Case_Main` entspricht exakt der Darstellung in [img.png](img.png).

---

## 1. Geometrische & Mathematische Analyse

### A) Vergleich der Modi

| Eigenschaft / Feature | `merge_top_and_middle = 0` (3 Körper) | `merge_top_and_middle = 1` (2 Körper, p025) |
| :--- | :--- | :--- |
| **Anzahl Körper** | 3 (`Case_Top`, `Case_Middle`, `Case_Bottom`) | 2 (`Case_Main`, `Case_Bottom`) |
| **Obere Gehäusehöhe (+Z)** | $40.0\,\text{mm} + \text{offset}$ (geteilt bei $Z = 29.5\,\text{mm} + \text{offset}$) | $40.0\,\text{mm} + \text{offset}$ (durchgehend als `Case_Main`) |
| **Bodenhöhe (-Z)** | $-6.4\,\text{mm}$ (`Case_Bottom`) | $-6.4\,\text{mm}$ (`Case_Bottom`, unverändert) |
| **Umlaufender Sims / Fuge** | Ja (Schritte 8, 10–14, Tiefe 2.5 mm, $R = 1.0\,\text{mm}$) | **Nein** (übersprungen, glatte Außenwand) |
| **Deckeltrennung & Rastnasen** | Ja (5 mm Stufenfalz, 4 Rastnasen, 45°-Rampen) | **Nein** (monolithisch geschlossen) |
| **Rechteckige LED-Öffnung** | Ja ($5.2 \times 2.2\,\text{mm}$ mit Haltehülse) | **Nein** (Schritt 21 übersprungen) |
| **Rundes Power-Button-Loch** | Ja ($\varnothing 1.0\,\text{mm}$ in `Case_Middle` & `Case_Bottom`) | Ja ($\varnothing 1.0\,\text{mm}$ in `Case_Main` & `Case_Bottom`) |
| **Deckel-Lüftungsschlitze** | 6 Schlitze gleichverteilt ($80 \times 2.5\,\text{mm}$) | 6 Schlitze gleichverteilt ($80 \times 2.5\,\text{mm}$) |
| **Außenkantenverrundung Deckel** | $R = 2.0\,\text{mm}$ (4 vertikal, 4 horizontal oben) | $R = 2.0\,\text{mm}$ (4 vertikal, 4 horizontal oben) |
| **Boden-Steckverbindung ($Z = 0$)** | 5.0 mm Kragen mit L-Winkeln & 4 Rastnasen | 5.0 mm Kragen mit L-Winkeln & 4 Rastnasen |
| **Rechte Gehäusewand (+X)** | 4.0 mm Wandstärke (p024) | 4.0 mm Wandstärke (p024, unverändert) |
| **Innenhohlraum ($X \times Y$)** | $85.4 \times 56.4\,\text{mm}$ (100 % unverändert) | $85.4 \times 56.4\,\text{mm}$ (100 % unverändert) |

### B) FDM-Druckanordnung (`layout_for_print = 1`)

Im Modus `merge_top_and_middle = 1` werden nur noch die beiden Körper `Case_Main` und `Case_Bottom` (sowie optional `Logo`) auf dem Druckbett aufgereiht:
- **`Case_Main`:** Wird um 180° um die X-Achse gedreht (Kopfüber / Upside-Down), sodass die ebene Deckelfläche plan auf $Z = 0$ aufliegt. Die 6 Lüftungsschlitze und die 3 mm Decke drucken stützfrei; der Gehäuseinnenraum und die Stufe zum Boden wachsen vertikal nach oben.
- **`Case_Bottom`:** Liegt mit der planen Unterseite direkt auf $Z = 0$; 4 Standoff-Befestigungssäulen und der Steckkragen wachsen nach oben.

---

## 2. Implementierungsdetails

1. **Parameter-Management (`parameters.ts`):**
   - Parameter `merge_top_and_middle`:
     - Standard: `'0'`
     - Einheit: `''` (einheitenlos gemäß AGENTS.md §3.3)
     - Beschreibung: `'Verschmilzt Deckel und Mittelteil zu einem Körper Case_Main ohne Fuge/Sims (0=Aus, 1=Ein, p025)'`
   - Dynamisch im `Params`-Typ exportiert.

2. **Gehäuseöffnungen & Features (`openings.ts`):**
   - `createInnerSsdPocket`: Unterstützt `Case_Main` – wenn `merge_top_and_middle = 1`, wird der Schnitt nur in `Case_Main` ausgeführt (keine Duplikate in `participantBodies`). Der Körpername `"Case_Main"` bleibt erhalten.
   - `createMiddleSideHole`: Erkennt dynamisch, ob der Zielkörper `"Case_Main"` oder `"Case_Middle"` heißt, und benennt ihn entsprechend konsistent.

3. **Spannungsreduzierende Verrundungen (`stressRelief.ts`):**
   - `collectStressReliefEdges`: Neue Rolle `'main'` für `Case_Main`:
     - Unterer Stufenfalz bei $Z \le 5.5\,\text{mm}$ bleibt geschützt.
     - Wand-Decken-Kehlen und aufrechte Wand-Innenecken werden mit $R = 1.0\,\text{mm}$ verrundet.
     - 6 Deckel-Lüftungsschlitze erhalten $0.5\,\text{mm}$ Kantenverrundungen.
   - `applyStressReliefTreatments`: Unterstützt `{ main, bottom }` und liefert korrekte Live-Referenzen zurück.

4. **FDM-Druckanordnung (`printLayout.ts`):**
   - `PrintableBodiesInput` und `PrintableBodiesResult` um `main?: adsk.fusion.BRepBody` erweitert.
   - `Case_Main` wird bei aktivierter Druckanordnung kopfüber (180° um X) ausgerichtet und stützoptimiert auf $Z = 0$ platziert.
   - `"Case_Main"` zu `knownCaseNames` hinzugefügt, damit der Körper nicht versehentlich ausgeblendet wird.

5. **Material- & Erscheinungsbildzuweisung (`materials.ts`):**
   - Weist `Case_Main` automatisch das ABS Weiss Erscheinungsbild zu.

6. **Logo-Mulde (`logo.ts`):**
   - Schnittoperationen und Namenserhalt für `Case_Main` abgesichert.

7. **Orchestrierung (`case.ts`):**
   - Liest `isMerged = Math.round(params.mergeTopAndMiddle.value) === 1`.
   - Bei `isMerged`:
     - Schritte 8, 10–14 (Fuge / Sims): Vollständig übersprungen.
     - Schritt 20 (Deckeltrennung): Übersprungen, `topBody` wird direkt als `Case_Main` fortgeführt.
     - Schritt 21 (Rechteckige LED-Öffnung): Übersprungen.
     - Schritt 21b (Rundes Durchgangsloch): Auf `Case_Main` und `Case_Bottom` angewendet.
     - Schritte 22, 23, 25, 26, 27: Alle nachfolgenden Schritte arbeiten mit `Case_Main` und `Case_Bottom`.