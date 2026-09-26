# Erweiterungen (p020): 4-Punkt-Einrastfunktion (Snap-Fit) für Case_Bottom und Case_Top

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p020/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Problem

Sowohl der Unterboden (`Case_Bottom`) als auch der Gehäusedeckel (`Case_Top`) hielten ohne ausreichende Rastelemente nicht zuverlässig an `Case_Middle`, wenn Zug, Verwindung oder Druck von innen (z. B. durch das Eigengewicht des Raspberry Pi 5 auf den Standoffs) ausgeübt wurde.
Die mechanischen Ursachen:
1. **Großer Hebelarm zu den Ecken:** Bei einer Gehäusebreite von $91.4\,\text{mm}$ (Rückwandkragen-Länge $81.9\,\text{mm}$) befanden sich die Ecken weit von einer etwaigen zentralen Rastung entfernt. Dadurch konnten die Ecken bei geringer Krafteinwirkung nachgeben und sich abhebeln.
2. **Fehlender Halt an Front und Seiten:** Ohne Arretierung an der Frontwand sowie der linken Seitenwand fehlte eine allseitig definierte Schließkraft.
3. **Analoge Anforderung für Case_Top:** Auch der Deckel (`Case_Top`) benötigt denselben formschlüssigen Halt gegen unbeabsichtigtes Lösen.

## Ziel

Konstruktion eines konsistenten, allseitig stabilen **4-Punkt-Einrastsystems (je 4 Rastnasen)** für beide Verbindungsfugen:
- **Fuge 1: `Case_Bottom` $\leftrightarrow$ `Case_Middle`** (in `joint.ts` bei $Z \approx 2.5\,\text{mm}$)
- **Fuge 2: `Case_Top` $\leftrightarrow$ `Case_Middle`** (in `lidJoint.ts` bei $Z \approx 27.0\,\text{mm}$)

### Die 4 Rastnasen je Verbindung:
1. **Rückwand links (Back-Left):**
   - Nahe der hinteren linken Ecke bei $X = -28.0\,\text{mm}$ zentriert ($X \in [-37.0, -19.0]\,\text{mm}$ bei $18\,\text{mm}$ Länge).
   - Auskragung $+0.25\,\text{mm}$ in $+Y$, korrespondierende $0.30\,\text{mm}$ tiefe Mulde in `Case_Middle`.
2. **Rückwand rechts (Back-Right):**
   - Nahe dem hinteren rechten Kragenende bei $X = +26.0\,\text{mm}$ zentriert ($X \in [+17.0, +35.0]\,\text{mm}$ bei $18\,\text{mm}$ Länge).
   - Auskragung $+0.25\,\text{mm}$ in $+Y$, korrespondierende $0.30\,\text{mm}$ tiefe Mulde in `Case_Middle`.
3. **Linke Seitenwand ($-X$):**
   - Auf der Außenflanke des Kragens symmetrisch zentriert bei $Y = 0\,\text{mm}$ ($Y \in [-9.0, +9.0]\,\text{mm}$ bei $18\,\text{mm}$ Länge).
   - Auskragung $-0.25\,\text{mm}$ in $-X$, korrespondierende $0.30\,\text{mm}$ tiefe Mulde in `Case_Middle`.
4. **Frontwand rechts ($-Y$):**
   - Auf der Außenflanke des Frontkragens zentriert bei $X = +22.0\,\text{mm}$ ($X \in [+13.0, +31.0]\,\text{mm}$ bei $18\,\text{mm}$ Länge).
   - Auskragung $-0.25\,\text{mm}$ in $-Y$, korrespondierende $0.30\,\text{mm}$ tiefe Mulde in `Case_Middle`.
   - Sicherheitsabstand von $> 6.5\,\text{mm}$ zur Vertiefung der Frontanschlüsse (USB-C & Micro-HDMI).
5. **Rechte Wand ($+X$):**
   - Bleibt frei von Rastnasen für uneingeschränkte Zugänglichkeit der RJ45- und USB-Anschlüsse.

---

## 1. Geometrische & Mathematische Analyse

### A) 4 Rastnasen an Case_Bottom $\leftrightarrow$ Case_Middle (`joint.ts`)

- **Kragenerstreckung:** $Z = 0\,\text{mm}$ bis $Z = 5.0\,\text{mm}$ (`joint_tongue_height`)
- **Z-Zentrum Rastnasen:** $Z = 2.50\,\text{mm}$
- **Z-Spannweite Wülste:** $Z \in [2.25, 2.75]\,\text{mm}$ ($H = 0.5\,\text{mm}$)
- **Z-Spannweite Mulden:** $Z \in [2.20, 2.80]\,\text{mm}$ ($H = 0.6\,\text{mm}$)

| Merkmal | 1. Rückwand links ($-X$) | 2. Rückwand rechts ($+X$) | 3. Linke Wand ($-X$) | 4. Frontwand rechts ($-Y$) |
| :--- | :---: | :---: | :---: | :---: |
| **Wandposition (Nenn)** | $Y = +29.70\,\text{mm}$ | $Y = +29.70\,\text{mm}$ | $X = -44.20\,\text{mm}$ | $Y = -29.70\,\text{mm}$ |
| **Kragen-Außenflanke (Bottom)** | $Y = +29.55\,\text{mm}$ | $Y = +29.55\,\text{mm}$ | $X = -44.05\,\text{mm}$ | $Y = -29.55\,\text{mm}$ |
| **Zentrum** | $X = -28.00\,\text{mm}$ | $X = +26.00\,\text{mm}$ | $Y = 0\,\text{mm}$ | $X = +22.00\,\text{mm}$ |
| **Spannweite Rastwulst** | $X \in [-37.0, -19.0]\,\text{mm}$ | $X \in [+17.0, +35.0]\,\text{mm}$ | $Y \in [-9.0, +9.0]\,\text{mm}$ | $X \in [+13.0, +31.0]\,\text{mm}$ |
| **Länge & Höhe Wulst** | $L = 18.0\,\text{mm}, H = 0.5\,\text{mm}$ | $L = 18.0\,\text{mm}, H = 0.5\,\text{mm}$ | $L = 18.0\,\text{mm}, H = 0.5\,\text{mm}$ | $L = 18.0\,\text{mm}, H = 0.5\,\text{mm}$ |
| **Z-Bereich Rastwulst** | $Z \in [2.25, 2.75]\,\text{mm}$ | $Z \in [2.25, 2.75]\,\text{mm}$ | $Z \in [2.25, 2.75]\,\text{mm}$ | $Z \in [2.25, 2.75]\,\text{mm}$ |
| **Auskragung & Richtung** | $+0.25\,\text{mm}$ in $+Y$ | $+0.25\,\text{mm}$ in $+Y$ | $+0.25\,\text{mm}$ in $-X$ | $+0.25\,\text{mm}$ in $-Y$ |
| **Stufenebene (Middle)** | $Y = +29.70\,\text{mm}$ | $Y = +29.70\,\text{mm}$ | $X = -44.20\,\text{mm}$ | $Y = -29.70\,\text{mm}$ |
| **Spannweite Rastmulde** | $X \in [-37.2, -18.8]\,\text{mm}$ | $X \in [+16.8, +35.2]\,\text{mm}$ | $Y \in [-9.2, +9.2]\,\text{mm}$ | $X \in [+12.8, +31.2]\,\text{mm}$ |
| **Z-Bereich Rastmulde** | $Z \in [2.20, 2.80]\,\text{mm}$ | $Z \in [2.20, 2.80]\,\text{mm}$ | $Z \in [2.20, 2.80]\,\text{mm}$ | $Z \in [2.20, 2.80]\,\text{mm}$ |
| **Schnitttiefe & Richtung** | $0.30\,\text{mm}$ in $+Y$ | $0.30\,\text{mm}$ in $+Y$ | $0.30\,\text{mm}$ in $-X$ | $0.30\,\text{mm}$ in $-Y$ |
| **Restwandstärke Middle** | $1.20\,\text{mm}$ | $1.20\,\text{mm}$ | $1.20\,\text{mm}$ | $1.20\,\text{mm}$ |

---

### B) 4 Rastnasen an Case_Top $\leftrightarrow$ Case_Middle (`lidJoint.ts`)

- **Kragenerstreckung:** $Z = 29.5\,\text{mm}$ (`lid_split_z`) nach unten bis $Z = 24.5\,\text{mm}$ (`lid_split_z - lid_joint_depth`)
- **Z-Zentrum Rastnasen:** $Z = 27.00\,\text{mm}$
- **Z-Spannweite Wülste:** $Z \in [26.75, 27.25]\,\text{mm}$ ($H = 0.5\,\text{mm}$)
- **Z-Spannweite Mulden:** $Z \in [26.70, 27.30]\,\text{mm}$ ($H = 0.6\,\text{mm}$)

| Merkmal | 1. Rückwand links ($-X$) | 2. Rückwand rechts ($+X$) | 3. Linke Wand ($-X$) | 4. Frontwand rechts ($-Y$) |
| :--- | :---: | :---: | :---: | :---: |
| **Wandposition (Nenn)** | $Y = +29.70\,\text{mm}$ | $Y = +29.70\,\text{mm}$ | $X = -44.20\,\text{mm}$ | $Y = -29.70\,\text{mm}$ |
| **Kragen-Außenflanke (Top)** | $Y = +29.70\,\text{mm}$ | $Y = +29.70\,\text{mm}$ | $X = -44.20\,\text{mm}$ | $Y = -29.70\,\text{mm}$ |
| **Zentrum** | $X = -28.00\,\text{mm}$ | $X = +26.00\,\text{mm}$ | $Y = 0\,\text{mm}$ | $X = +22.00\,\text{mm}$ |
| **Spannweite Rastwulst** | $X \in [-37.0, -19.0]\,\text{mm}$ | $X \in [+17.0, +35.0]\,\text{mm}$ | $Y \in [-9.0, +9.0]\,\text{mm}$ | $X \in [+13.0, +31.0]\,\text{mm}$ |
| **Länge & Höhe Wulst** | $L = 18.0\,\text{mm}, H = 0.5\,\text{mm}$ | $L = 18.0\,\text{mm}, H = 0.5\,\text{mm}$ | $L = 18.0\,\text{mm}, H = 0.5\,\text{mm}$ | $L = 18.0\,\text{mm}, H = 0.5\,\text{mm}$ |
| **Z-Bereich Rastwulst** | $Z \in [26.75, 27.25]\,\text{mm}$ | $Z \in [26.75, 27.25]\,\text{mm}$ | $Z \in [26.75, 27.25]\,\text{mm}$ | $Z \in [26.75, 27.25]\,\text{mm}$ |
| **Auskragung & Richtung** | $+0.25\,\text{mm}$ in $+Y$ | $+0.25\,\text{mm}$ in $+Y$ | $+0.25\,\text{mm}$ in $-X$ | $+0.25\,\text{mm}$ in $-Y$ |
| **Stufenebene (Middle)** | $Y = +29.70\,\text{mm}$ | $Y = +29.70\,\text{mm}$ | $X = -44.20\,\text{mm}$ | $Y = -29.70\,\text{mm}$ |
| **Spannweite Rastmulde** | $X \in [-37.2, -18.8]\,\text{mm}$ | $X \in [+16.8, +35.2]\,\text{mm}$ | $Y \in [-9.2, +9.2]\,\text{mm}$ | $X \in [+12.8, +31.2]\,\text{mm}$ |
| **Z-Bereich Rastmulde** | $Z \in [26.70, 27.30]\,\text{mm}$ | $Z \in [26.70, 27.30]\,\text{mm}$ | $Z \in [26.70, 27.30]\,\text{mm}$ | $Z \in [26.70, 27.30]\,\text{mm}$ |
| **Schnitttiefe & Richtung** | $0.30\,\text{mm}$ in $+Y$ | $0.30\,\text{mm}$ in $+Y$ | $0.30\,\text{mm}$ in $-X$ | $0.30\,\text{mm}$ in $-Y$ |
| **Restwandstärke Middle** | $1.20\,\text{mm}$ | $1.20\,\text{mm}$ | $1.20\,\text{mm}$ | $1.20\,\text{mm}$ |

---

## 2. Parameter-Verhalten & Idempotenz (`parameters.ts`)

Die standardisierten Parameter steuern alle 8 Rastnasen konsistent in `snake_case`:

```typescript
// Rastnasen für Case_Bottom <-> Case_Middle (Schritt 19)
jointSnapLength: (() => {
  const p = getOrCreateParam(
    'joint_snap_length',
    '18mm',
    'mm',
    'Länge der 4 Rastnasen (2x Rückwand ecknah, 1x linke Wand, 1x Frontwand rechts)'
  );
  return ensureParamExpression(p, '18mm', ['20mm', '20.0mm']);
})(),
jointSnapDepth: getOrCreateParam('joint_snap_depth', '0.25mm', 'mm', 'Auskragung der 4 Rastnasen (in X- bzw. Y-Richtung)'),
jointSnapHeight: getOrCreateParam('joint_snap_height', '0.5mm', 'mm', 'Höhe der 4 Rastnasen in Z-Richtung'),

// Rastnasen für Case_Top <-> Case_Middle (Schritt 20)
lidJointSnapLength: (() => {
  const p = getOrCreateParam(
    'lid_joint_snap_length',
    '18mm',
    'mm',
    'Länge der 4 Rastnasen zwischen Case_Top und Case_Middle'
  );
  return ensureParamExpression(p, '18mm', ['20mm', '20.0mm']);
})(),
lidJointSnapDepth: getOrCreateParam('lid_joint_snap_depth', '0.25mm', 'mm', 'Auskragung der 4 Rastnasen an Case_Top in X- bzw. Y-Richtung'),
lidJointSnapHeight: getOrCreateParam('lid_joint_snap_height', '0.5mm', 'mm', 'Höhe der 4 Rastnasen an Case_Top in Z-Richtung'),
```

---

## 3. Modulübersicht & Betroffene Komponenten (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Anpassungen | Status |
| :--- | :--- | :--- |
| **`joint.ts`** | `createTongueAndGrooveJoint`: Schritt 3 erzeugt alle 4 Rastnasen an `Case_Bottom` (3a: 2x Rückwand ecknah, 3b: 1x linke Wand, 3c: 1x Frontwand rechts) mit den zugehörigen Rastmulden in `Case_Middle`. | Abgeschlossen |
| **`lidJoint.ts`** | `splitAndCreateLidJoint`: Schritt 8 erzeugt die 4 Rastnasen an `Case_Top` am nach unten ragenden Kragen ($Z \in [24.5, 29.5]\,\text{mm}$) mit korrespondierenden Rastmulden in `Case_Middle`. | Abgeschlossen |
| **`parameters.ts`** | `joint_snap_*` und `lid_joint_snap_*` voll parametrisch implementiert ($18\,\text{mm}$ Länge, $0.25\,\text{mm}$ Auskragung, $0.5\,\text{mm}$ Höhe). | Abgeschlossen |
| **`case.ts`** | Dokumentation und Konsolenausgabe für Schritt 19 und Schritt 20 auf "4 Rastnasen (2x Rückwand ecknah, 1x linke Wand, 1x Frontwand)" aktualisiert. | Abgeschlossen |
| **`prompt.md`** (p020) | Vollständige Spezifikation, Konstruktionslogik und mathematische Koordinatentabellen für Bottom und Top hinterlegt. | Abgeschlossen |

---

## 4. Verifikation & Qualitätssicherung

1. **Statischer Typcheck:**
   - `npx tsc --noEmit` schließt ohne Fehler ab (Exit Code 0).
2. **Formschluss & Zugfestigkeit:**
   - Durch die 4 Rastnasen sind sowohl `Case_Bottom` als auch `Case_Top` an allen 3 geschlossenen Wänden formschlüssig verriegelt.
   - Alle Ecken sind durch die ecknahen Nasen an der Rückwand gegen Hebelkräfte und Durchbiegen gesichert.
   - Front- und linke Wand verhindern ein Verkippen oder Ausrasten unter mechanischer Belastung.
3. **Kollisionsfreiheit & FDM-Drucktauglichkeit:**
   - Frontseitige Rastnasen ($X \in [13.0, 31.0]\,\text{mm}$) liegen $> 6.5\,\text{mm}$ außerhalb der Frontaussparung für USB-C und Micro-HDMI.
   - Linke Rastnase an Bottom ($Z = 2.5\,\text{mm}$) liegt $> 10\,\text{mm}$ unterhalb der Logo-Tasche ($Z = 14.7\,\text{mm}$).
   - Linke Rastnase an Top ($Z = 27.0\,\text{mm}$) liegt $> 11\,\text{mm}$ oberhalb der Logo-Tasche ($Z = 14.7\,\text{mm}$) und unterhalb der LED-Öffnung ($Z = 30.75\,\text{mm}$).
   - Innere SSD-Tasche reicht bis $Z = 24.0\,\text{mm}$, liegt also sicher unterhalb des Top-Kragens ($Z \ge 24.5\,\text{mm}$).
   - Alle $0.25\,\text{mm}$ Rastwülste und $0.30\,\text{mm}$ Mulden drucken aufrecht zu 100 % stützfrei.
4. **L-Winkel-Eckenumfassung für strammen Sitz von Case_Bottom:**
   - Front-Right-Eckschenkel ($Y \in [-29.55, -27.00]\,\text{mm}$) und Back-Right-Eckschenkel ($Y \in [+27.00, +29.55]\,\text{mm}$) auf der rechten Wand schließen die vormaligen $6.3\,\text{mm}$ Lücken.
   - Front-Left-Eckschenkel ($X \in [-44.05, -39.50]\,\text{mm}$) auf der Frontwand schließt die Lücke an der vorderen linken Ecke mit $2.45\,\text{mm}$ Sicherheitsabstand vor dem USB-C-Ausschnitt.
   - Bildet an allen vier Ecken (Back-Left, Back-Right, Front-Right, Front-Left) hochfeste L-Winkel-Führungen mit $0.5\,\text{mm}$ Mini-Fase.
   - Volle Kompatibilität mit allen Ports (USB-C, RJ45 Ethernet, Dual USB 2.0).
   - Korrespondierende Stufenschnitte in `Case_Middle` garantieren einen spielfreien, strammen Formschluss des Bodendeckels an allen 4 Ecken.

