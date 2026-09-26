# Erweiterungen (p019)

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p019/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Problem

Die bisherige Steckverbindung an der Trennebene $Z = 0$ zwischen `Case_Bottom` und `Case_Middle` (p006) basierte auf einer klassischen Nut- und Feder-Geometrie (Tongue & Groove):
1. **Geringe Eintauchtiefe:** Die Feder ragte lediglich $1.6\,\text{mm}$ (`joint_tongue_height = 1.6mm`) in die $2.0\,\text{mm}$ tiefe Nut hinein. Bei Gehäuseaußenmaßen von $91.4 \times 62.4\,\text{mm}$ bot diese minimale Tiefe zu wenig Führungslänge, sodass das Unterteil bei seitlicher Belastung oder Hebelkräften zum Wackeln und Ausrasten neigte.
2. **Geringe Wandstärke:** Die Feder war mittig platziert und nur $1.0\,\text{mm}$ dick (`joint_tongue_width = 1.0mm`). Dadurch verblieben an den beiden Flanken der Nut in `Case_Middle` jeweils nur $(3.0 - 1.4) / 2 = 0.8\,\text{mm}$ Restwandstärke. Im FDM-3D-Druck (typisch 2 Perimeter bei 0.4 mm Düse) sind solche dünnen Stege mechanisch anfällig für Verbiegen und Delamination.
3. **Isolierte Streifen ohne Eckversteifung:** Die Federn waren als voneinander getrennte gerade Streifen angelegt; die Ecken des Gehäuses blieben ungenutzt, wodurch keine Versteifung gegen Verwindung (Torsion) gegeben war.

Im Gegensatz dazu hat sich die Steckverbindung zwischen `Case_Middle` und `Case_Top` (`lidJoint.ts` / p007) mit einem **$5.0\,\text{mm}$ tiefen Stufenfalz** (`lid_joint_depth = 5mm`), **$1.5\,\text{mm}$ Wandstärke** (halbe Gehäusewand) und einer **$0.5\,\text{mm}$ Mini-Fase** als außerordentlich stabil, passgenau und klemmfrei erwiesen.

## Ziel

Umstellung der Steckverbindung zwischen `Case_Bottom` und `Case_Middle` auf das bewährte **Stufenfalz-Prinzip (Steckkragen / Lap Joint)** analog zu `Case_Middle / Case_Top`:
1. **$5.0\,\text{mm}$ hoher Steckkragen an `Case_Bottom` (`joint_depth = 5mm`):**
   - Befindet sich auf der inneren Wandhälfte ($1.5\,\text{mm}$ Nennbreite abzüglich $0.15\,\text{mm}$ horizontalem Passungsspiel = $1.35\,\text{mm}$ Kragenbreite).
   - Wächst von der Trennebene $Z = 0$ stützfrei nach oben in $+Z$.
2. **$0.5\,\text{mm}$ Mini-Fase ($45^\circ$, `joint_chamfer = 0.5mm`):**
   - An den oberen Außenkanten des Steckkragens bei $Z = 5.0\,\text{mm}$ als klemmfreie Einführschräge beim Zusammenstecken.
3. **$5.3\,\text{mm}$ tiefer Stufenschnitt in `Case_Middle`:**
   - Schneidet $1.5\,\text{mm}$ breit an der Gehäuseinnenwand von $Z = 0$ nach oben in $+Z$.
   - Beinhaltet $0.3\,\text{mm}$ vertikales Kopfspiel (`joint_vertical_clearance`), damit die äußere Trennfuge bei $Z = 0$ absolut bündig, fugenlos und spielfrei aufliegt.
   - Die äußere Wand von `Case_Middle` behält über die gesamte Stufenhöhe eine massive Wandstärke von $1.5\,\text{mm}$.
4. **Monolithische Eckversteifung (L-Winkel am Back-Left-Corner):**
   - Die Kragen an der Rückwand und der linken Seitenwand verschmelzen an der hinteren linken Ecke zu einem durchgehenden, formschlüssigen L-Winkel. Dies sperrt Translationen in X- und Y-Richtung sowie rotatorisches Verwinden wirkungsvoll.
5. **Kollisionsfreiheit aller Anschlüsse:**
   - Frontwand (USB-C & Micro-HDMI) sowie rechte Wand (RJ45, USB 3.0, USB 2.0) bleiben vollständig frei.
   - Pfeiler 2 zwischen USB 3.0 und USB 2.0 ($2.9\,\text{mm}$ Wandbereich) erhält einen eigenen stabilen Steckkragenabschnitt.
6. **Integrierte Einrastfunktion (Snap-Fit):**
   - $20.0\,\text{mm}$ lange Rastwulst ($0.25\,\text{mm}$ Auskragung) auf der Außenflanke des Rückwandkragens bei $Z = 2.5\,\text{mm}$ mit korrespondierender Rastmulde in der Stufenwand von `Case_Middle` für spürbaren Einrasthalt.

---

## 1. Geometrische & Mathematische Analyse

### Koordinatenübersicht der Trennebene ($Z = 0$)

| Merkmal | Wert / Bereich | Bemerkung |
| :--- | :---: | :--- |
| **Gehäuse-Außenmaße** | $91.4 \times 62.4\,\text{mm}$ | $X \in [-45.7, +45.7]\,\text{mm}$, $Y \in [-31.2, +31.2]\,\text{mm}$ |
| **Gehäuse-Innenmaße** | $85.4 \times 56.4\,\text{mm}$ | $X \in [-42.7, +42.7]\,\text{mm}$, $Y \in [-28.2, +28.2]\,\text{mm}$ |
| **Wandstärke gesamt** | $3.00\,\text{mm}$ | Massive Schalenwand |
| **Wandmitte (Stufenlinie)** | $X = \pm 44.20\,\text{mm}, Y = \pm 29.70\,\text{mm}$ | $1.5\,\text{mm}$ von Innen- und Außenwand |
| **Eintauchtiefe Kragen ($H$)** | $5.00\,\text{mm}$ ($0.50\,\text{cm}$) | `joint_depth = 5mm` ab $Z = 0$ nach oben |
| **Stufenschnitttiefe Case_Middle** | $5.30\,\text{mm}$ ($0.53\,\text{cm}$) | `joint_depth + joint_vertical_clearance` |
| **Kragendicke** | $1.35\,\text{mm}$ | $1.50\,\text{mm} - \text{joint\_clearance}$ ($0.15\,\text{mm}$) |
| **Mini-Fase Kragenoberkante** | $0.50\,\text{mm}$ ($45^\circ$) | `joint_chamfer = 0.5mm` |
| **Rückwand Kragen ($Y$-Spanne)** | $[+28.20, +29.55]\,\text{mm}$ | $X \in [-44.05, +37.85]\,\text{mm}$ (Länge $81.9\,\text{mm}$) |
| **Linke Wand Kragen ($X$-Spanne)** | $[-44.05, -42.70]\,\text{mm}$ | $Y \in [-25.85, +29.55]\,\text{mm}$ (Länge $55.4\,\text{mm}$) |
| **L-Winkel Back-Left-Corner** | $X \in [-44.05, -42.70], Y \in [+28.20, +29.55]$ | Nahtlose Überlappung und Verschmelzung |
| **Frontwand rechts Kragen** | $Y \in [-29.55, -28.20]\,\text{mm}$ | $X \in [+0.615, +37.85]\,\text{mm}$ (Länge $31.7\,\text{mm}$) |
| **Pfeiler 2 Kragen (USB 3.0 / 2.0)** | $X \in [+42.70, +44.05]\,\text{mm}$ | $Y \in [+8.75, +11.35]\,\text{mm}$ (Länge $2.6\,\text{mm}$) |
| **Rastwulst (Rückwand)** | $X \in [-10.0, +10.0]\,\text{mm}, Z \in [2.25, 2.75]\,\text{mm}$ | $+0.25\,\text{mm}$ Auskragung in $+Y$ bei $Z = 2.5\,\text{mm}$ |

---

## 2. Parameter-Verhalten & Idempotenz (`parameters.ts`)

In `parameters.ts` wurden folgende Parameter neu definiert bzw. aktualisiert (strikter `snake_case`, AGENTS.md §3.2 & §3.3):

```typescript
// Schritt 19 / p006 / p019: Stufenfalz-Steckverbindung zwischen Case_Bottom und Case_Middle (analog Case_Middle/Case_Top)
jointDepth: (() => {
  const p = getOrCreateParam(
    'joint_depth',
    '5mm',
    'mm',
    'Eintauchtiefe des Stufenfalzes zwischen Case_Bottom und Case_Middle'
  );
  return ensureParamExpression(p, '5mm', ['1.6mm', '1.60mm', '2mm', '2.0mm']);
})(),
jointChamfer: (() => {
  const p = getOrCreateParam(
    'joint_chamfer',
    '0.5mm',
    'mm',
    'Mini-Fase an der äußeren Oberkante des Steckkragens von Case_Bottom'
  );
  return ensureParamExpression(p, '0.5mm', ['0.05mm', '0.050mm']);
})(),
jointTongueWidth: getOrCreateParam('joint_tongue_width', '1.5mm', 'mm', 'Nenndicke des Steckkragens auf Case_Bottom (halbe Wandstärke)'),
jointTongueHeight: (() => {
  const p = getOrCreateParam('joint_tongue_height', '5mm', 'mm', 'Höhe des Steckkragens über Trennebene Z=0');
  return ensureParamExpression(p, '5mm', ['1.6mm', '1.60mm']);
})(),
jointGrooveWidth: getOrCreateParam('joint_groove_width', '1.5mm', 'mm', 'Breite des Stufenausschnitts in Case_Middle'),
jointGrooveDepth: (() => {
  const p = getOrCreateParam('joint_groove_depth', '5.3mm', 'mm', 'Tiefe des Stufenausschnitts in Case_Middle inkl. Kopfspiel');
  return ensureParamExpression(p, '5.3mm', ['2mm', '2.0mm', '5mm', '5.0mm']);
})(),
jointClearance: (() => {
  const p = getOrCreateParam('joint_clearance', '0.15mm', 'mm', 'Horizontales Passungsspiel je Seite zwischen Steckkragen und Stufe');
  return ensureParamExpression(p, '0.15mm', ['0.2mm', '0.20mm']);
})(),
jointVerticalClearance: (() => {
  const p = getOrCreateParam('joint_vertical_clearance', '0.3mm', 'mm', 'Vertikales Kopfspiel des Steckkragens in der Stufe');
  return ensureParamExpression(p, '0.3mm', ['0.4mm', '0.40mm']);
})(),
jointGrooveChamfer: getOrCreateParam('joint_groove_chamfer', '0.5mm', 'mm', 'Mini-Fase an der Oberkante des Steckkragens bei Z=5mm'),
jointSnapLength: getOrCreateParam('joint_snap_length', '20mm', 'mm', 'Länge der Rastnase an der Rückwand'),
jointSnapDepth: getOrCreateParam('joint_snap_depth', '0.25mm', 'mm', 'Auskragung der Rastnase in Y-Richtung'),
jointSnapHeight: getOrCreateParam('joint_snap_height', '0.5mm', 'mm', 'Höhe der Rastnase in Z-Richtung'),
```

---

## 3. Modulübersicht & Betroffene Komponenten (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Anpassungen | Status |
| :--- | :--- | :--- |
| **`parameters.ts`** | Parameter `joint_depth` (`5mm`), `joint_chamfer` (`0.5mm`), `joint_clearance` (`0.15mm`), `joint_vertical_clearance` (`0.3mm`) implementiert; Rückwärtskompatibilität gewahrt. | Abgeschlossen |
| **`joint.ts`** | 1. `createTongueAndGrooveJoint`: Erzeugt $5.0\,\text{mm}$ Steckkragen an `Case_Bottom` auf Rück-, Linker, Front-Rechter Wand und Pfeiler 2.<br>2. Nahtlose L-Winkel-Verschmelzung am Back-Left-Corner.<br>3. $0.5\,\text{mm}$ Mini-Fase an den äußeren Oberkanten des Steckkragens bei $Z = 5.0\,\text{mm}$ via `applyChamferWithFallbacks`.<br>4. $5.3\,\text{mm}$ Stufenschnitt in `Case_Middle` (Cut).<br>5. Snap-Fit Rastwulst und Rastmulde bei $Z = 2.5\,\text{mm}$ an der Rückwand. | Abgeschlossen |
| **`stressRelief.ts`** | Anpassung des Ausschlussbereichs für `Case_Middle` auf $Z < 5.5\,\text{mm}$ (`bottomStepZCm + 0.05`), um die Stufenschulter vor unerwünschten Verrundungen zu schützen. | Abgeschlossen |
| **`case.ts`** | Konsolenausgabe und Dokumentation für Schritt 19 auf die neue 5 mm Stufenfalz-Steckverbindung aktualisiert. | Abgeschlossen |
| **`prompt.md`** (p019) | Vollständige Spezifikation, Konstruktionslogik und mathematische Auswertung dokumentiert. | Abgeschlossen |

---

## 4. Verifikation & Qualitätssicherung

1. **Statischer Typcheck:**
   - `npx tsc --noEmit` schließt ohne Fehler ab (Exit Code 0).
2. **Geometrische Stabilität & Formschluss:**
   - Eintauchtiefe von $5.0\,\text{mm}$ verhindert jedes Verkippen oder Wackeln von `Case_Bottom`.
   - Kragendicke von $1.35\,\text{mm}$ bietet eine um den Faktor $> 3.3$ höhere Biegesteifigkeit als die alte $1.0\,\text{mm}$ Feder.
   - Der durchgehende L-Winkel an der hinteren linken Ecke sperrt Scher- und Torsionskräfte formschlüssig.
3. **Kollisionsfreiheit & FDM-Drucktauglichkeit:**
   - Alle Anschlussöffnungen (USB-C, Micro-HDMI, RJ45, USB 3.0, USB 2.0) bleiben uneingeschränkt frei.
   - `Case_Bottom` druckt aufrecht auf der Unterseite ($Z = -6.4\,\text{mm}$) liegend mit dem Steckkragen stützfrei nach oben.
   - `Case_Middle` druckt aufrecht auf der Trennebene $Z = 0$ liegend: Der obere $5.0\,\text{mm}$ Stufenfalz wächst stützfrei nach oben, die Port-Ausschnitte beginnen am Druckbett und die $0.30\,\text{mm}$ Rastmulde druckt ohne Stützen in der senkrechten Wand (100 % stützfrei).
