# Erweiterungen (p018)

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p018/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Problem

Für eine Erweiterung mit einer SSD via **"Geekworm X1001 PCIe to M.2 HAT M.2 NVMe SSD Pip Shield for Raspberry Pi 5"** (SSD-Halterung)
ragt diese SSD-Halterung etwas zu weit in die Gehäusewand:
1. Das "erste Bein" (vertikaler Steg zwischen dem Gigabit-Ethernet-RJ45-Anschluss und dem 1. USB-Anschluss / Dual USB 3.0, siehe `img_05.png`) kollidiert mit der nach unten ragenden Montagestrebe der X1001-Halterung (`img_02.png`).
2. Wie die Photoshop-Montage (`img_07.png`) verdeutlicht, kollidiert die X1001-Baugruppe sowohl in der Höhe als auch in der Breite:
   - Der linke Befestigungspunkt (Abstandsbolzen und Platinenohr) ragt nach links über den RJ45-Ausschnitt hinaus in die Wand hinein.
   - Der M.2 Key-M Steckverbinder ragt bis zu einer Höhe von $Z \approx 20.45\,\text{mm}$ auf und stößt an die massive $3.0\,\text{mm}$ Gehäusewand an.

## Ziel 

Ändere die Gehäusewand so ab, dass die SSD-Halterung hineinpasst (siehe `img_08.png`, `img_09.png`, `img_10.png`):
1. **Außenkontur mit gestufter Decke & Verrundungen (`img_08.png`):**
   - Das Bein zwischen RJ45 und Dual USB 3.0 entfällt vollständig.
   - Die Decke des kombinierten Ausschnitts erhält eine Stufenform: RJ45-Bereich auf $14.5\,\text{mm}$ Höhe, Dual-USB 3.0-Bereich auf $16.5\,\text{mm}$ Höhe, verbunden durch einen sanften, tangentialen S-Kurven-Übergang.
   - Obere Ecken der Anschlüsse (auch Dual USB 2.0) werden harmonisch mit $R = 1.5\,\text{mm}$ verrundet (`port_corner_radius`).
2. **Innenliegende SSD-Aussparung / Tasche (`img_09.png`, `img_10.png`):**
   - Auf der Gehäuse-Innenwand ($X = +42.7\,\text{mm}$) wird eine $24.00\,\text{mm}$ hohe Tasche (`ssd_pocket_height = 24mm`) mit $R = 3.00\,\text{mm}$ Verrundung an den oberen Ecken (`ssd_pocket_corner_radius = 3mm`) erzeugt.
   - Breite: Von der Front-Innenwand ($Y = -28.2\,\text{mm}$) bis zur Außenkante des USB 3.0-Ausschnitts ($Y = +8.6\,\text{mm}$).
   - Extrusionsschnitt: $2.5\,\text{mm}$ tief nach außen in die Gehäusewand (`ssd_pocket_depth = 2.5mm`), sodass eine saubere, $0.5\,\text{mm}$ dünne Außenhaut verbleibt.
   - **Multi-Body-Schnitt:** Die Extrusion schneidet sowohl `Case_Middle` als auch `Case_Top` aus (`participantBodies = [Case_Middle, Case_Top]`), exakt wie im CAD-Schnitt in `img_10.png` dargestellt.
3. **Nut/Feder-Anpassung:** An Pfeiler 1 (zwischen RJ45 und USB 3.0) entfällt die Feder auf `Case_Bottom` und die Nut in `Case_Top`, sodass der Gehäuseboden plan bei $Z = 0$ bleibt.
4. **Stabilität:** Der zweite Steg zwischen Dual USB 3.0 und Dual USB 2.0 ($2.9\,\text{mm}$ Breite) sowie Pfeiler 2 der Nut/Feder-Verbindung bleiben für maximale mechanische Integrität vollständig erhalten.

Die Maße der Halterung: siehe [img_01.png](img_01.png)  
Siehe auch:
* [img_02.png](img_02.png) – Frontansicht der Anschlüsse mit X1001 HAT und herabhängender Strebe im Zwischenraum
* [img_03.png](img_03.png) – Seitenansicht Ethernet-Port mit Abstandsbolzen und X1001 Platine
* [img_04.png](img_04.png) – Bemaßte Seitenansicht mit Zollstock (Platinenüberstand bis $87\,\text{mm}$)
* [img_05.png](img_05.png) – Markierung des zu entfernenden Stegs am 3D-Modell
* [img_06.png](img_06.png) – Referenz: Kommerzielles Blechgehäuse mit nach vorn versetztem Blech
* [img_07.png](img_07.png) – Photoshop-Montage: Kollision der X1001 HAT mit Steg, Wand und Deckenhöhe
* [img_08.png](img_08.png) – Außenansicht Zielgeometrie: Bein weg, gestufte Decke mit Verrundungen
* [img_09.png](img_09.png) – Skizze der inneren Tasche: $24.00\,\text{mm}$ Höhe, $R = 3.00\,\text{mm}$ Eckenverrundung, bis zur Frontwand
* [img_10.png](img_10.png) – 3D-Schnittansicht des finalen Ergebnisses mit $2.5\,\text{mm}$ Ausklinkung von innen (schneidet Case_Middle und Case_Top)

---

## 1. Spezifikation & Kontext

### A. Gestufter Port-Ausschnitt von außen (`img_08.png`)
- RJ45 und Dual-USB 3.0 sind zu einem durchgehenden Ausschnitt verschmolzen:
  - $Y_{\text{min}} = -26.05\,\text{mm}$ (äußere RJ45-Kante)
  - $Y_{\text{max}} = +8.60\,\text{mm}$ (äußere USB 3.0-Kante)
  - Gesamte Öffnungsbreite: **$34.65\,\text{mm}$**
- Deckenkontur:
  - Über RJ45 ($Y \in [-24.55, -9.55]\,\text{mm}$): Höhe $Z = 14.5\,\text{mm}$.
  - S-Kurven-Übergang über den ehemaligen Stegbereich ($Y \in [-9.55, -6.40]\,\text{mm}$): Zwei tangentiale Kreisbögen ($R \approx 1.74\,\text{mm}$) führen die Kontur von $14.5\,\text{mm}$ hinauf auf $16.5\,\text{mm}$.
  - Über USB 3.0 ($Y \in [-6.40, +7.10]\,\text{mm}$): Höhe $Z = 16.5\,\text{mm}$.
  - Ecken oben links ($Y = -26.05\,\text{mm}$) und oben rechts ($Y = +8.60\,\text{mm}$) sind mit $R = 1.5\,\text{mm}$ verrundet.
- Dual USB 2.0 ($Y \in [+11.50, +26.50]\,\text{mm}$, $H = 16.5\,\text{mm}$) erhält ebenfalls $R = 1.5\,\text{mm}$ Verrundungen an den beiden oberen Ecken.

### B. Innenliegende SSD-Aussparung / Tasche (`img_09.png`, `img_10.png`)
- Skizze auf der Gehäuse-Innenwand bei $X = \text{case\_width}/2 - \text{shell\_thickness} = +42.7\,\text{mm}$.
- Horizontale Ausdehnung:
  - Beginn an der Front-Innenwand bei $Y = -28.2\,\text{mm}$ (schafft Platz für den Abstandsbolzen und das linke Befestigungsohr der X1001-Platine).
  - Ende an der Kante des USB 3.0-Ausschnitts bei $Y = +8.60\,\text{mm}$ (der $2.9\,\text{mm}$ breite Pfeiler zu USB 2.0 bleibt unberührt).
  - Gesamte Taschenbreite: **$36.80\,\text{mm}$**.
- Vertikale Ausdehnung:
  - Beginn am Innenboden bei $Z = 0.0\,\text{mm}$.
  - Höhe: **$24.00\,\text{mm}$** (`ssd_pocket_height`).
  - Obere Ecken verrundet mit **$R = 3.00\,\text{mm}$** (`ssd_pocket_corner_radius`).
- Extrusion & Teilnehmerkörper:
  - $2.5\,\text{mm}$ Schnitttiefe nach außen in die Gehäusewand (`ssd_pocket_depth`).
  - Verbleibende Außenhaut: $0.5\,\text{mm}$ ($X \in [+45.2, +45.7]\,\text{mm}$), exakt wie in `img_10.png`.
  - Schnitt wird in Schritt 20b nach der Deckeltrennung ausgeführt und bindet beide Körper ein: `cutInput.participantBodies = [liveMiddle, liveTop]`. Dadurch werden sowohl `Case_Middle` als auch die herabreichende Wand von `Case_Top` kollisionsfrei freigestellt.

### C. Pfeiler & Nut/Feder-Verbindung (`joint.ts`)
- Segment 4 (Pfeiler 1 zwischen RJ45 & USB 3.0) ist deaktiviert:
  - Keine Feder auf `Case_Bottom`, Gehäuseboden bleibt bei $Z = 0$ plan.
  - Verhindert jede Kollision mit der herabhängenden Strebe der SSD-Halterung (`img_02.png`).
- Segment 5 (Pfeiler 2 zwischen USB 3.0 & USB 2.0) bleibt uneingeschränkt aktiv.

---

## 2. Geometrische & Mathematische Analyse

### Koordinatenübersicht der rechten Gehäusewand

| Merkmal / Element | Wert / Bereich | Bemerkung |
| :--- | :---: | :--- |
| **Innenwand-Position ($X_{\text{inner}}$)** | $+42.70\,\text{mm}$ ($+4.27\,\text{cm}$) | $\text{case\_width}/2 - \text{shell\_thickness}$ |
| **Außenwand-Position ($X_{\text{outer}}$)** | $+45.70\,\text{mm}$ ($+4.57\,\text{cm}$) | $\text{case\_width}/2$ |
| **Taschen-Schnitttiefe** | $2.50\,\text{mm}$ ($0.25\,\text{cm}$) | In $+X$ von $42.70$ auf $45.20\,\text{mm}$ |
| **Verbleibende Außenwandstärke** | $0.50\,\text{mm}$ ($0.05\,\text{cm}$) | Von $45.20$ bis $45.70\,\text{mm}$ |
| **Taschenbreite ($Y$-Spanne)** | $[-28.20, +8.60]\,\text{mm}$ | Breite $36.80\,\text{mm}$ |
| **Taschenhöhe ($Z$-Spanne)** | $[0.00, 24.00]\,\text{mm}$ | Höhe $24.00\,\text{mm}$ ab $Z = 0$ |
| **Taschen-Eckenverrundung oben** | $R = 3.00\,\text{mm}$ | Links und rechts an der Decke |
| **Port-Ausschnitt $Y$-Spanne (Außen)** | $[-26.05, +8.60]\,\text{mm}$ | Breite $34.65\,\text{mm}$ |
| **RJ45 Deckenhöhe (Außen)** | $14.50\,\text{mm}$ | $Y \in [-26.05, -9.55]\,\text{mm}$ |
| **S-Kurven Übergang (Außen)** | $Y \in [-9.55, -6.40]\,\text{mm}$ | Stufe von $14.5$ auf $16.5\,\text{mm}$ |
| **USB 3.0 Deckenhöhe (Außen)** | $16.50\,\text{mm}$ | $Y \in [-6.40, +8.60]\,\text{mm}$ |
| **Port-Eckenverrundung oben** | $R = 1.50\,\text{mm}$ | An RJ45, USB 3.0 und USB 2.0 |
| **Pfeiler 2 (USB 3.0 zu USB 2.0)** | $Y \in [+8.60, +11.50]\,\text{mm}$ | Breite $2.90\,\text{mm}$ voll erhalten |
| **USB 2.0 Ausschnitt** | $Y \in [+11.50, +26.50]\,\text{mm}$ | $15.0 \times 16.5\,\text{mm}$ |

---

## 3. Parameter-Verhalten & Idempotenz (`parameters.ts`)

In `parameters.ts` sind folgende Parameter registriert:

```typescript
// Schritt 15 / p018: Geekworm X1001 M.2 NVMe SSD HAT Kompatibilität & verrundete Port-Ausschnitte
portEthUsb3Merged: getOrCreateParam(
  'port_eth_usb3_merged',
  '1',
  '',
  'Kombinierter Ausschnitt für Ethernet und USB 3.0 ohne Zwischensteg für SSD-Halterung (1 = aktiv, 0 = getrennt)'
),
portCornerRadius: getOrCreateParam(
  'port_corner_radius',
  '1.5mm',
  'mm',
  'Eckenverrundungsradius für die oberen Kanten der Gehäuseöffnungen'
),
ssdPocketHeight: getOrCreateParam(
  'ssd_pocket_height',
  '24mm',
  'mm',
  'Höhe der innenliegenden Aussparung für die SSD-Halterung ab Z=0'
),
ssdPocketDepth: getOrCreateParam(
  'ssd_pocket_depth',
  '2.5mm',
  'mm',
  'Schnitttiefe der innenliegenden SSD-Aussparung nach außen in die Gehäusewand'
),
ssdPocketCornerRadius: getOrCreateParam(
  'ssd_pocket_corner_radius',
  '3mm',
  'mm',
  'Eckenverrundungsradius der oberen Ecken der innenliegenden SSD-Aussparung'
),
```

---

## 4. Modulübersicht & Betroffene Komponenten (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Anpassungen | Status |
| :--- | :--- | :--- |
| **`parameters.ts`** | Parameter `port_eth_usb3_merged`, `port_corner_radius` (`1.5mm`), `ssd_pocket_height` (`24mm`), `ssd_pocket_depth` (`2.5mm`), `ssd_pocket_corner_radius` (`3mm`) implementiert. | Abgeschlossen |
| **`openings.ts`** | 1. `drawSteppedRightPortCutout`: Profil mit RJ45 ($14.5\,\text{mm}$), S-Kurve und USB 3.0 ($16.5\,\text{mm}$) mit $R=1.5\,\text{mm}$ Eckenverrundung.<br>2. `drawUsb2WithRoundedCorners`: USB 2.0 mit $R=1.5\,\text{mm}$ Verrundung.<br>3. `createInnerSsdPocket`: Tasche auf $X = +4.27\,\text{cm}$, $Y \in [-28.2, +8.6]\,\text{mm}$, $Z \in [0, 24]\,\text{mm}$, $R=3.0\,\text{mm}$, Schnitttiefe $2.5\,\text{mm}$ nach außen mit `participantBodies = [Case_Middle, Case_Top]`. | Abgeschlossen |
| **`joint.ts`** | Pfeiler 1 (Segment 4) übersprungen; Boden bleibt plan bei $Z = 0$. Pfeiler 2 (Segment 5) bleibt aktiv. | Abgeschlossen |
| **`case.ts`** | Import von `createInnerSsdPocket` und Ausführung in Schritt 20b nach der Deckeltrennung, schneidet simultan `Case_Middle` und `Case_Top`. | Abgeschlossen |
| **`prompt.md`** (p018) | Vollständige technische Dokumentation mit `img_07.png` bis `img_10.png`. | Abgeschlossen |

---

## 5. Verifikation & Qualitätssicherung

1. **Statischer Typcheck:**
   - `npx tsc --noEmit` schließt fehlerfrei ohne Fehler ab (Exit Code 0).
2. **Exakte Übereinstimmung mit Benutzer-Vorgaben:**
   - Außenkontur entspricht exakt `img_08.png`.
   - Innere Tasche entspricht exakt der Skizze in `img_09.png` ($24.00\,\text{mm}$ Höhe, $R = 3.00\,\text{mm}$).
   - Resultierende 3D-Geometrie entspricht exakt dem Schnittmodell in `img_10.png`.
3. **Kollisionsfreiheit der Geekworm X1001 HAT:**
   - Linker Abstandsbolzen und Platinenohr sitzen frei in der bis $Y = -28.2\,\text{mm}$ reichenden Tasche.
   - Der M.2 Key-M Steckverbinder ($H \approx 20.45\,\text{mm}$) hat mehr als $3.5\,\text{mm}$ vertikales Spiel in der $24\,\text{mm}$ hohen Tasche.
   - Die herabhängende Montagestrebe zwischen RJ45 und USB 3.0 hat freien Durchgang bis auf den Gehäuseboden.
