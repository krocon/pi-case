# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p013/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel

Gehäusehöhe ("Case_Middle") per Parameter ändern

### Problem

Das Gehäuse soll einen Raspberry Pi 5 aufnehmen können. Dieser kann mit Kühler und oder mit Festplatte unterschiedlich hoch sein.

### Lösung

Mache einen neuen Höhenabweichungs-Parameter (in mm von - bis plus), um wieviel von der jetzigen Höhe erhöht oder verkleinert werden soll.
Bei 0mm (default) bleibt es so wie jetzt.

---

## Umsetzung & Spezifikation

### 1. Geometrische Zusammenhänge & Parametrische Formeln

1. **Rolle und Begrenzung von `Case_Middle`:**
   - `Case_Middle` ist der mittlere Gehäuserahmen, der sich vom Gehäuseboden bei $Z = 0$ bis zur horizontalen Trennebene $Z_{\text{split}} = \text{lid\_split\_z}$ erstreckt.
   - Die nominale Höhe von `Case_Middle` ohne Abweichung beträgt:
     $$H_{\text{middle, nominal}} = 29.5\,\text{mm}$$
   - Mit dem neuen Höhenabweichungs-Parameter `case_middle_height_offset` beträgt die effektive Höhe von `Case_Middle`:
     $$H_{\text{middle}} = 29.5\,\text{mm} + \text{case\_middle\_height\_offset}$$

2. **Kopplung der Primärextrusion (`case_top_height`):**
   - Der Deckelkörper (`Case_Top`) behält seine unveränderliche Dicke von $10.5\,\text{mm}$ (von $Z = 29.5\,\text{mm}$ bis $Z = 40.0\,\text{mm}$) zuzüglich des $5.0\,\text{mm}$ Stufenfalzes.
   - Die Gesamthöhe der oberen Primärextrusion wird daher dynamisch gekoppelt:
     $$\text{case\_top\_height} = 40.0\,\text{mm} + \text{case\_middle\_height\_offset}$$

3. **Kopplung der horizontalen Trennebene (`lid_split_z`):**
   - Die Trennebene liegt stets am unteren Ende der umlaufenden Schattenfuge:
     $$\text{groove\_plane} = \text{case\_top\_height} - 8.0\,\text{mm} = 32.0\,\text{mm} + \text{case\_middle\_height\_offset}$$
     $$\text{groove\_bottom} = \text{groove\_plane} - 2.5\,\text{mm} = 29.5\,\text{mm} + \text{case\_middle\_height\_offset}$$
   - Entsprechend wird `lid_split_z` verknüpft:
     $$\text{lid\_split\_z} = 29.5\,\text{mm} + \text{case\_middle\_height\_offset}$$

4. **Kopplung der LED-Öffnung (`led_z_offset`):**
   - Die rechteckige LED-Öffnung in `Case_Top` sitzt exakt im vertikalen Zentrum der $2.5\,\text{mm}$ hohen horizontalen Schattenfuge:
     $$\text{led\_z\_offset} = 30.75\,\text{mm} + \text{case\_middle\_height\_offset}$$
   - Dadurch wandert die LED-Halterung und deren tunnelartiger Durchbruch gemeinsam mit der Fuge des Deckels mit.

5. **Kopplung des Logos an der linken Seitenwand (`logo_pos_z`):**
   - Das isometrische Logo befindet sich an der linken Außenwand von `Case_Middle`.
   - Um das Logo bei veränderter Gehäusehöhe stets symmetrisch in der vertikalen Mitte von `Case_Middle` ($Z \in [0, H_{\text{middle}}]$) zu halten:
     $$\text{logo\_pos\_z} = 14.7\,\text{mm} + \frac{\text{case\_middle\_height\_offset}}{2}$$

6. **Passungen, Anschlüsse und Bauraum für den Raspberry Pi 5:**
   - Sämtliche Anschlüsse (Front: USB-C, Micro-HDMI 0, Micro-HDMI 1; Rechts: RJ45 Ethernet, Dual USB 3.0, Dual USB 2.0) verbleiben unverändert auf Platinenniveau bei $Z = 0$, da die Befestigungssäulen (Standoffs) im Boden `Case_Bottom` verankert sind.
   - Durch einen positiven Wert von `case_middle_height_offset` (z. B. `+10mm`, `+15mm` oder `+25mm`) vergrößert sich der lichte vertikale Innenraum oberhalb der Platine, sodass offizielle Raspberry Pi 5 Active Cooler, massive Passivkühler, HATs (z. B. PoE+ HAT) oder NVMe-M.2-Erweiterungsplatinen kollisionsfrei integriert werden können.

---

## 2. Parameter (`parameters.ts:setupParameters`)

| Parameter | Standardwert | Einheit | Beschreibung |
| :--- | :--- | :--- | :--- |
| `case_middle_height_offset` | `'0mm'` | `'mm'` | Höhenabweichung für Gehäusehöhe Case_Middle (in mm, positiv zum Erhöhen, negativ zum Verkleinern) |
| `case_top_height` | `'40mm + case_middle_height_offset'` | `'mm'` | Höhe des oberen Gehäuseteils (+Z) inklusive Höhenabweichung |
| `lid_split_z` | `'29.5mm + case_middle_height_offset'` | `'mm'` | Z-Höhe der Trennebene am unteren Ende der Einkerbung inklusive Höhenabweichung |
| `led_z_offset` | `'30.75mm + case_middle_height_offset'` | `'mm'` | Z-Höhe der LED im Zentrum der horizontalen Fuge inklusive Höhenabweichung |
| `logo_pos_z` | `'14.7mm + case_middle_height_offset / 2'` | `'mm'` | Z-Position des Logos und der Logo-Mulde an der linken Seitenwand über der Trennebene (zentriert auf Case_Middle) |

---

## 3. Implementierungsübersicht & Modul-Architektur (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Änderungen | Status |
| :--- | :--- | :--- |
| **`parameters.ts`** | Implementierung des neuen Parameters `case_middle_height_offset` im strikten `snake_case`. Definition der automatischen Formelausdrücke für `case_top_height`, `lid_split_z`, `led_z_offset` und `logo_pos_z` inklusive automatischer Upgrade-Funktion `ensureParamExpression` für bestehende Fusion-Konstruktionen. | Abgeschlossen |
| **`stressRelief.ts`** | Parametrisierung aller geometrischen Schutzzonen und Innenkanten-Filter in `collectStressReliefEdges` und `collectCaseTopInnerEdges` auf Basis der dynamischen Parameter `caseTopHeight`, `lidSplitZ`, `groovePlaneOffset` und `ledZOffset`. | Abgeschlossen |
| **`case.ts`** | Erweiterung der JSDoc-Schrittdokumentation und dynamische Ausgabe der Höhen- und Versatzmaße in den Konsolen-Logs der Schritte 2 und 20. | Abgeschlossen |
| **`prompt.md`** (p014) | Vollständige Spezifikation, mathematische Formelkopplungen, Parametertabelle und Architekturmatrix. | Abgeschlossen |
