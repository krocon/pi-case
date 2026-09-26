# Erweiterungen

- Arbeite nur an der Dateien fusion/model/pi5/case/case.ts und den lokalen imports 'fusion/model/pi5/case/*.ts', 
sowie fusion/model/pi5/doc/prompt/p002/prompt.md und evtl. den anderen fusion/model/pi5/doc/prompt/**/prompt.md
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Öffnungen in das Gehäuse schneiden


## Steps

Analysiere die Bilder in fusion/model/pi5/doc/pi5 und schneide an den Seiten des Gehäuse die entsprechenden Rechtecke aus, so dass die Öffnungen für die Pi5 passen.
Mache einen Extra-Parameter für einen z-Offset, damit die Öffnungen angepasst werden können, je nachdem, wie die Pi5 im Gehäuse platziert wird (unterschiedliche Höhen).


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Analyse** | Bemaßungsanalyse der Pi5-Zeichnungen (`img*.png`) und STEP-Modell (`RASPBERRY_PI_5_1.STEP`) | `fusion/model/pi5/doc/pi5/` | Abgeschlossen |
| **Parameter** | Parametrischer Z-Offset (`pi5_z_offset`), X/Y-Offsets und Ausschnittsmaße (strict `snake_case`) | `parameters.ts:setupParameters` | Abgeschlossen |
| **Front-Ports** | Ausschnitt-Rechtecke für USB-C, Micro HDMI 0 und Micro HDMI 1 an der Vorderseite ($Y = -\text{case\_depth}/2 = -31.2\,\text{mm}$) | `openings.ts:createFrontPortCutouts` | Abgeschlossen |
| **Right-Ports** | Ausschnitt-Rechtecke für RJ45 (Ethernet), Dual USB 3.0 und Dual USB 2.0 an rechter Seite ($X = +\text{case\_width}/2 = +45.7\,\text{mm}$) | `openings.ts:createRightPortCutouts` | Abgeschlossen |
| **Left-Ports** | Linke Gehäusewand ($X = -\text{case\_width}/2 = -45.7\,\text{mm}$): Micro-SD-Slot und Power-Button-Öffnung wurden auf Benutzeranforderung entfernt (Wand bleibt geschlossen) | `openings.ts:createAllPortCutouts` | Entfernt / Geschlossen |
| **Orchestrierung** | Integration der Port-Schnitte in `run()` über `createAllPortCutouts` (Front & Rechts) | `case.ts:run` | Abgeschlossen |

### Übersicht der Gehäuseöffnungen

1. **Frontseite ($Y = -31.2\,\text{mm}$):**
   - **USB-C:** Center $X = -31.3\,\text{mm}$, Ausschnitt $11.5 \times 4.5\,\text{mm}$, von `pi5_z_offset` bis `pi5_z_offset + 4.5mm` (Unterkante bündig mit Platinenoberseite, identisch zu Netzwerk & USB).
   - **Micro HDMI 0:** Center $X = -16.7\,\text{mm}$, Ausschnitt $8.0 \times 4.5\,\text{mm}$, von `pi5_z_offset` bis `pi5_z_offset + 4.5mm`.
   - **Micro HDMI 1:** Center $X = -3.3\,\text{mm}$, Ausschnitt $8.0 \times 4.5\,\text{mm}$, von `pi5_z_offset` bis `pi5_z_offset + 4.5mm`.

2. **Rechte Seite ($X = +45.7\,\text{mm}$):**
   - **Gigabit Ethernet (RJ45):** Center $Y = -17.8\,\text{mm}$, Ausschnitt $16.5 \times 14.5\,\text{mm}$, von `pi5_z_offset` bis `pi5_z_offset + 14.5mm`.
   - **Dual USB 3.0 (blau):** Center $Y = +1.1\,\text{mm}$, Ausschnitt $15.0 \times 16.5\,\text{mm}$, von `pi5_z_offset` bis `pi5_z_offset + 16.5mm`.
   - **Dual USB 2.0 (schwarz):** Center $Y = +19.0\,\text{mm}$, Ausschnitt $15.0 \times 16.5\,\text{mm}$, von `pi5_z_offset` bis `pi5_z_offset + 16.5mm`.

3. **Linke Seite ($X = -45.7\,\text{mm}$):**
   - *Auf Benutzeranforderung geschlossen:* Die Ausschnitte für den Micro-SD-Kartenschlitz und die Power-Button-Öffnung wurden entfernt. Die linke Gehäusewand bleibt vollständig geschlossen.

### Verwendete Parameter (`parameters.ts`)
- `pi5_z_offset`: `0mm` (Höhenverstellung der Platine im Gehäuse)
- `pi5_x_offset`: `0mm` (Horizontaler Versatz in X)
- `pi5_y_offset`: `0mm` (Horizontaler Versatz in Y)
- `port_usbc_width`: `11.5mm`, `port_usbc_height`: `4.5mm`
- `port_hdmi_width`: `8mm`, `port_hdmi_height`: `4.5mm`
- `port_eth_width`: `16.5mm`, `port_eth_height`: `14.5mm`
- `port_usb3_width`: `15mm`, `port_usb3_height`: `16.5mm`
- `port_usb2_width`: `15mm`, `port_usb2_height`: `16.5mm`
- `port_sd_width`: `14mm`, `port_sd_height`: `3mm`
- `port_pwr_btn_width`: `5mm`, `port_pwr_btn_height`: `4mm`
