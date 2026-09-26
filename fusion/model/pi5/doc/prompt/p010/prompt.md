# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`, 
sowie `fusion/model/pi5/doc/prompt/p010/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Automatisierter Import und präzise Ausrichtung des Raspberry Pi 5 Referenzmodells (RASPBERRY_PI_5_1.STEP) im Gehäuse via Parameter import_pi5_board (Default = 0)

Zur visuellen Kollisions- und Einbauprüfung im CAD-Modell soll das offizielle 3D-STEP-Modell des Raspberry Pi 5 (`fusion/model/pi5/case/RASPBERRY_PI_5_1.STEP`) automatisiert in das Fusion 360 Dokument importiert und exakt auf den 4 Befestigungssäulen (Standoffs) im Gehäuse platziert werden (siehe [Referenzbild](img.png)):
- **Zustand 0 (`import_pi5_board = 0`, Standard):** Das Referenzmodell wird nicht importiert bzw. zuvor importierte Instanzen werden bereinigt, sodass nur das reine, druckbare Gehäuse aktiv ist.
- **Zustand 1 (`import_pi5_board = 1`):** Das Pi5-STEP-Modell wird importiert, strukturiert abgelegt und im Montagezustand bündig auf den 4 Befestigungssäulen aufgesetzt, sodass alle Platinenbohrungen, Anschlüsse und Bauteile exakt mit den Gehäuseaussparungen fluchten.


## Geometrie- & Ausrichtungsanalyse (siehe fusion/model/pi5/doc/prompt/p010/img.png)

1. **Platinenmaße & Bohrungskoordinaten des Referenzmodells (`RASPBERRY_PI_5_1.STEP`):**
   - Platinengröße: $85.0 \times 56.0\,\text{mm}$ mit $3.0\,\text{mm}$ Eckenverrundungsradius.
   - Die 4 Befestigungsbohrungen ($\varnothing 2.7\,\text{mm}$, Pad $\varnothing 6.0\,\text{mm}$) im lokalen STEP-Koordinatenursprung:
     - Vorne links (Front-Left):  $X = -39.0\,\text{mm}$, $Y = -24.5\,\text{mm}$
     - Hinten links (Back-Left):   $X = -39.0\,\text{mm}$, $Y = +24.5\,\text{mm}$
     - Vorne rechts (Front-Right): $X = +19.0\,\text{mm}$, $Y = -24.5\,\text{mm}$
     - Hinten rechts (Back-Right):  $X = +19.0\,\text{mm}$, $Y = +24.5\,\text{mm}$
   - Platinendicke: $1.45\,\text{mm}$ (Unterseite bei $Z = 0.0\,\text{mm}$, Oberseite bei $Z = +1.45\,\text{mm}$).

2. **Übereinstimmung mit dem Gehäuse (`Case_Bottom` & `standoffs.ts`):**
   - Die 4 Befestigungssäulen (`standoff_outer_diameter = 6mm`, `standoff_height = 6.5mm`) auf dem Gehäuse-Innenboden ($Z_{\text{floor}} = -\text{case\_bottom\_height} + \text{shell\_thickness} = -10.4\,\text{mm} + 3.0\,\text{mm} = -7.4\,\text{mm}$) besitzen ihre Oberkanten exakt bei:
     $$Z_{\text{standoff\_top}} = Z_{\text{floor}} + \text{standoff\_height} = -7.4\,\text{mm} + 6.5\,\text{mm} = -0.9\,\text{mm} \quad (-0.09\,\text{cm})$$
   - Die Säulenzentren im Modellraum entsprechen unter Berücksichtigung von `pi5_x_offset` und `pi5_y_offset` exakt den Platinenbohrungen:
     - Front-Left:  $X = -39.0\,\text{mm} + \text{pi5\_x\_offset}$, $Y = -24.5\,\text{mm} + \text{pi5\_y\_offset}$
     - Back-Left:   $X = -39.0\,\text{mm} + \text{pi5\_x\_offset}$, $Y = +24.5\,\text{mm} + \text{pi5\_y\_offset}$
     - Front-Right: $X = +19.0\,\text{mm} + \text{pi5\_x\_offset}$, $Y = -24.5\,\text{mm} + \text{pi5\_y\_offset}$
     - Back-Right:  $X = +19.0\,\text{mm} + \text{pi5\_x\_offset}$, $Y = +24.5\,\text{mm} + \text{pi5\_y\_offset}$

3. **Raumausrichtung & Translationsvektor $(\Delta X, \Delta Y, \Delta Z)$:**
   - **Drehung (Kompensation des SolidWorks-Imports):**
     - Beim Import von SolidWorks-STEP-Dateien kippt der Fusion-360-STEP-Translator das Modell standardmäßig um $-90^\circ$ um die X-Achse (da SolidWorks $Y$ als Hochachse interpretiert).
     - Daher steht das Board nach dem Import zunächst senkrecht in der XZ-Ebene.
     - Durch eine Drehung um $+90^\circ$ ($+\pi/2$) um die X-Achse $(1, 0, 0)$ durch den Ursprung $(0, 0, 0)$ wird das Board flach in die horizontale XY-Ebene gelegt:
       - $-Y$ (Micro-HDMI 0 & 1, USB-C) zeigt zur Gehäusefront ($Y = -31.2\,\text{mm}$).
       - $+Y$ (40-Pin GPIO-Header) zeigt zur Gehäuserückwand ($Y = +31.2\,\text{mm}$).
       - $+X$ (Gigabit Ethernet RJ45 & Dual USB 3.0/2.0) zeigt zur rechten Gehäusewand ($X = +45.7\,\text{mm}$).
       - $-X$ (Micro-SD Kartenslot) zeigt zur linken Gehäusewand ($X = -45.7\,\text{mm}$).
       - $+Z$ (Kühler, Bauelemente, Pins) zeigt nach oben in Richtung Deckel (`Case_Top`).
       - $-Z$ (Platinenunterseite) zeigt nach unten in Richtung Gehäuseboden (`Case_Bottom`).
   - **Translation auf die Standoffs:**
     - $\Delta X = \text{pi5\_x\_offset}$ (Standard: $0.0\,\text{mm}$)
     - $\Delta Y = \text{pi5\_y\_offset}$ (Standard: $0.0\,\text{mm}$)
     - $\Delta Z = Z_{\text{standoff\_top}} + \text{pi5\_z\_offset} = -0.9\,\text{mm} + \text{pi5\_z\_offset}$ (Standard: $-0.9\,\text{mm} = -0.09\,\text{cm}$)
   - **Wirkung:**
     - Die Platinenunterseite setzt vollflächig und bündig auf den 4 Befestigungssäulen bei $Z = -0.9\,\text{mm}$ auf.
     - Die 4 Platinenbohrungen fluchten koaxial mit den Kernloch-Gewindebohrungen (M2.5) der Standoffs.
     - Die Anschlüsse ragen passgenau in die vorbereiteten Ausschnitte an Front und rechter Seitenwand.

4. **Kapselung & Druckanordnung (`layout_for_print`):**
   - Das importierte Board wird in einer eigenen Fusion-Komponente bzw. Occurrence (`Raspberry_Pi_5`) strukturiert abgelegt.
   - Bei aktivierter FDM-Druckanordnung (`layout_for_print = 1`) wird die gesamte Pi5-Occurrence automatisch ausgeblendet (`isLightBulbOn = false`), sodass das Druckbett ausschließlich die druckbaren Gehäuseteile (`Case_Top`, `Case_Middle`, `Case_Bottom`) enthält.


## Steps

1) **Parameter (`parameters.ts`):**
   - Ergänzung im strikten `snake_case` (AGENTS.md §3.2 & §3.3):
     - `import_pi5_board`: `'0'` (Einheitenloser Schalter `''`: 0 = Aus/Kein Import (Standard), 1 = Ein/STEP importieren und ausrichten)
   - Erhalt bestehender Benutzerwerte in `getOrCreateParam`.

2) **Modul `pi5Board.ts` (`importAndAlignPi5Board`):**
   - Eigenständiges Modul `fusion/model/pi5/case/pi5Board.ts` gemäß AGENTS.md §2.3 ("Neue eigenständige Körper & Baugruppen").
   - Robuste Auflösung des STEP-Dateipfads (`RASPBERRY_PI_5_1.STEP`).
   - Import über `app.importManager.createSTEPImportOptions` und `importToTarget2` bzw. `importToTarget` in eine dedizierte `Raspberry_Pi_5`-Occurrence.
   - Exakte Translation um $(\Delta X, \Delta Y, \Delta Z)$ mit $\Delta Z = Z_{\text{standoff\_top}} + \text{pi5\_z\_offset}$.
   - Bereinigung vorheriger Instanzen bei Skript-Wiederholung zur Vermeidung doppelter Körper.

3) **Integration in `case.ts:run()`:**
   - Aufruf von `importAndAlignPi5Board(rootComp, params)` als neuer Schritt 22 vor der Druckanordnung.
   - Aktualisierung der nachfolgenden Schritte (`arrangeBodiesForPrint` als Schritt 23).

4) **Zusammenspiel mit `printLayout.ts`:**
   - Erweiterung der Sichtbarkeitssteuerung (`isLightBulbOn`), sodass auch Komponenten/Occurrences wie `Raspberry_Pi_5` bei `layout_for_print = 1` zuverlässig ausgeblendet werden.


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrischer Schalter `import_pi5_board` (Default `'0'`, einheitenlos) | `parameters.ts:setupParameters` | Abgeschlossen |
| **Import-Modul** | Import von `RASPBERRY_PI_5_1.STEP`, Baugruppen-Kapselung in `Raspberry_Pi_5` und Translation auf Standoffs ($Z = -0.9\,\text{mm}$) | `pi5Board.ts:importAndAlignPi5Board` | Abgeschlossen |
| **Druckanordnungs-Kompatibilität** | Automatisches Ausblenden (`isLightBulbOn = false`) bei `layout_for_print = 1` | `printLayout.ts:arrangeBodiesForPrint` | Abgeschlossen |
| **Orchestrierung** | Schritt 22 in `case.ts:run` integriert vor Druckanordnung (Schritt 23) | `case.ts:run` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `import_pi5_board`: `'0'` (Einheitenloser Schalter: 0 = Board nicht importieren (Default), 1 = STEP-Modell importieren & montiert ausrichten)
- `pi5_z_offset`: `'0mm'` (Zusätzlicher vertikaler Versatz der Platine)
- `pi5_x_offset`: `'0mm'` (Horizontaler Versatz in X)
- `pi5_y_offset`: `'0mm'` (Horizontaler Versatz in Y)
- `standoff_height`: `'6.5mm'` (Säulenhöhe über Innenboden, um 1.5mm erhöht für bündigen Port-Sitz)
- `case_bottom_height`: `'10.4mm'`, `shell_thickness`: `'3mm'`
