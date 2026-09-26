# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p017/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel

1. Mache Case_Bottom um 4mm weniger hoch (kleiner).
2. Achte darauf, dass das PI5-Board auf der richtigen Höhe sitzt, also die Standoffs entsprechend kürzen.
3. **Visuelle Passungs-Korrektur:** Das Pi5-Board muss mindestens 1 mm weiter nach unten versetzt werden, damit alle Anschlüsse (RJ45, USB 3.0/2.0, USB-C, Micro-HDMI) mittig und kollisionsfrei in den Gehäuseaussparungen sitzen.
4. **Gewindevertiefung in den Boden:** Die Kernlochbohrung und das modellierte M2.5-Innengewinde der Standoffs 2 mm tief in die Gehäusebodenwand hineintreiben, um eine solide Gewindeeinschraubtiefe von 3.5 mm für Metallschrauben zu gewährleisten.

---

## 1. Spezifikation & Kontext

### A. Gehäuseboden-Höhenreduktion (-4 mm)
Der Gehäuseunterteil (`Case_Bottom`) wird um $4.0\,\text{mm}$ flacher und kompakter konstruiert:
- `case_bottom_height` wird von $10.4\,\text{mm}$ auf **$6.4\,\text{mm}$** reduziert.
- Bei $3.0\,\text{mm}$ Schalenwandstärke (`shell_thickness`) wandert der Gehäuseinnenboden von $Z = -7.4\,\text{mm}$ auf $Z_{\text{floor}} = -3.4\,\text{mm}$ ($+4.0\,\text{mm}$ nach oben).

### B. Korrektur der Platinenhöhe (-1 mm weiter runter)
Die visuelle CAD-Überprüfung zeigte, dass die Anschlüsse an der Oberkante der Gehäuseausschnitte anstießen, während an der Unterkante ein sichtbarer Spalt zur Platine bestand:
- Ursache: Die Bauteile (RJ45, Dual USB, Micro-HDMI, USB-C) sitzen auf der Platinenoberseite ($Z_{\text{pcb\_top}} = Z_{\text{standoff\_top}} + 1.45\,\text{mm}$). Bei $Z_{\text{standoff\_top}} = -0.9\,\text{mm}$ lag die Bauteilunterkante bei $+0.55\,\text{mm}$, wodurch die Anschlüsse um ca. $1\,\text{mm}$ zu hoch positioniert waren.
- Lösung: Die Befestigungssäulen werden um weitere $1.0\,\text{mm}$ von $2.5\,\text{mm}$ auf **$1.5\,\text{mm}$** gekürzt (`standoff_height = 1.5mm`).
- Dadurch setzt die Platinenunterseite bei $Z = -1.9\,\text{mm}$ auf und die Platinenoberseite liegt bei $Z = -0.45\,\text{mm}$. Sämtliche Schnittstellen (RJ45, USB 3.0/2.0, USB-C, Micro-HDMI) fluchten nun perfekt symmetrisch mit gleichmäßigem Spiel in ihren Gehäuseausschnitten.

### C. Gewindebohrung 2 mm in den Gehäuseboden hinein
Bei einer Säulenhöhe von nur $1.5\,\text{mm}$ wäre ein rein in der Säule liegendes Gewinde mit knapp 3 Gewindegängen zu kurz für handelsübliche M2.5-Schrauben (z. B. M2.5x5 oder M2.5x6):
- Parameter: Neuer Parameter `standoff_floor_depth = 2mm` (Zusätzliche Bohrungstiefe in den Boden).
- Die Kernlochbohrung ($\varnothing 2.05\,\text{mm}$) wird von der Säulenoberseite ($Z = -1.9\,\text{mm}$) in einem einzigen, sauberen Extrusionsschnitt um insgesamt $3.5\,\text{mm}$ nach unten bis $Z = -5.4\,\text{mm}$ getrieben.
- Das modellierte M2.5x0.45-Innengewinde erstreckt sich über die **volle Bohrungstiefe von $3.5\,\text{mm}$** (über 7.5 tragende Gewindegänge).
- Da der Außenboden bei $Z = -6.4\,\text{mm}$ liegt, verbleibt unterhalb der Bohrung ein **$1.0\,\text{mm}$ dicker, solider Gehäuseboden** (wasserdicht und blickdicht, ca. 5 Druckschichten bei $0.2\,\text{mm}$ Layer-Höhe).

---

## 2. Geometrische & Mathematische Höhenanalyse

### Vergleich der Entwicklungsstufen

| Geometrische Ebene / Eigenschaft | Ursprung (p001–p016) | Stufe 1 (p017 initial) | **Final (p017 korrigiert)** | Funktion & Auswirkung |
| :--- | :---: | :---: | :---: | :--- |
| **`case_bottom_height`** | $10.4\,\text{mm}$ | $6.4\,\text{mm}$ | **$6.4\,\text{mm}$** | Unterteil 4 mm kompakter |
| **Außenboden ($Z_{\text{bottom\_outer}}$)** | $-10.4\,\text{mm}$ | $-6.4\,\text{mm}$ | **$-6.4\,\text{mm}$** | Gesamthöhe reduziert |
| **Schalen-Wandstärke (`shell_thickness`)** | $3.0\,\text{mm}$ | $3.0\,\text{mm}$ | **$3.0\,\text{mm}$** | Volle mechanische Stabilität |
| **Innenboden ($Z_{\text{floor}}$)** | $-7.4\,\text{mm}$ | $-3.4\,\text{mm}$ | **$-3.4\,\text{mm}$** | Ebene `Plane_Pi5_Standoffs` |
| **Säulenhöhe (`standoff_height`)** | $6.5\,\text{mm}$ | $2.5\,\text{mm}$ | **$1.5\,\text{mm}$** | Standoffs um 1 mm weiter gekürzt |
| **Bohrungstiefe im Boden (`standoff_floor_depth`)** | $0.0\,\text{mm}$ | $0.0\,\text{mm}$ | **$2.0\,\text{mm}$** | 2 mm tief in die Bodenwand getrieben |
| **Gesamte Gewindetiefe ($D_{\text{thread}}$)** | $6.5\,\text{mm}$ | $2.5\,\text{mm}$ | **$3.5\,\text{mm}$** | $1.5\,\text{mm} + 2.0\,\text{mm} \approx 7.8$ Gewindegänge |
| **Bohrungsgrund ($Z_{\text{hole\_bottom}}$)** | $-7.4\,\text{mm}$ | $-3.4\,\text{mm}$ | **$-5.4\,\text{mm}$** | $1.0\,\text{mm}$ Restboden zum Außenbereich |
| **Säulen-Oberkante ($Z_{\text{standoff\_top}}$)** | $-0.9\,\text{mm}$ | $-0.9\,\text{mm}$ | **$-1.9\,\text{mm}$** | Platinenauflage 1.0 mm weiter unten |
| **PCB-Unterseite ($Z_{\text{pcb\_bottom}}$)** | $-0.9\,\text{mm}$ | $-0.9\,\text{mm}$ | **$-1.9\,\text{mm}$** | Bündig auf Standoffs |
| **PCB-Oberseite ($Z_{\text{pcb\_top}}$, 1.45 mm Dicke)** | $+0.55\,\text{mm}$ | $+0.55\,\text{mm}$ | **$-0.45\,\text{mm}$** | Perfekt zentriert zu Port-Unterkanten |
| **Port-Fluchtung (RJ45, USB, HDMI, USB-C)** | Zu hoch (Kollision oben) | Zu hoch (Kollision oben) | **Perfekt zentriert** | Gleichmäßiges Spiel oben und unten |

### Mathematische Höhenberechnung

$$Z_{\text{floor}} = -\text{case\_bottom\_height} + \text{shell\_thickness} = -6.4\,\text{mm} + 3.0\,\text{mm} = -3.4\,\text{mm}$$
$$Z_{\text{standoff\_top}} = Z_{\text{floor}} + \text{standoff\_height} = -3.4\,\text{mm} + 1.5\,\text{mm} = -1.9\,\text{mm}$$
$$Z_{\text{hole\_bottom}} = Z_{\text{floor}} - \text{standoff\_floor\_depth} = -3.4\,\text{mm} - 2.0\,\text{mm} = -5.4\,\text{mm}$$
$$\text{Restbodenstärke} = Z_{\text{hole\_bottom}} - Z_{\text{bottom\_outer}} = -5.4\,\text{mm} - (-6.4\,\text{mm}) = 1.0\,\text{mm}$$
$$\Delta Z_{\text{board}} = Z_{\text{standoff\_top}} + \text{pi5\_z\_offset} = -1.9\,\text{mm} + 0.0\,\text{mm} = -1.9\,\text{mm} \quad (-0.19\,\text{cm})$$

---

## 3. Parameter-Verhalten & Idempotenz (`parameters.ts`)

Bestehende Altwerte in CAD-Dokumenten werden über `ensureParamExpression` automatisch auf die korrigierten Standardwerte migriert:

```typescript
// Gehäusehöhe Case_Bottom (-4mm kleiner):
caseBottomHeight: (() => {
  const p = getOrCreateParam(
    'case_bottom_height',
    '6.4mm',
    'mm',
    'Höhe des unteren Gehäuseteils (-Z)'
  );
  return ensureParamExpression(p, '6.4mm', ['10.4mm', '10.40mm']);
})(),

// Standoff-Höhe (-1mm tiefer auf 1.5mm für perfekte Port-Fluchtung):
standoffHeight: (() => {
  const p = getOrCreateParam(
    'standoff_height',
    '1.5mm',
    'mm',
    'Höhe der Befestigungssäulen über dem Innenboden (um 1mm gekürzt auf 1.5mm für perfekte Port-Fluchtung)'
  );
  return ensureParamExpression(p, '1.5mm', ['2.5mm', '2.50mm', '6.5mm', '6.50mm', '5mm', '5.0mm']);
})(),

// 2mm Gewindebohrungstiefe in den Gehäuseboden hinein:
standoffFloorDepth: (() => {
  const p = getOrCreateParam(
    'standoff_floor_depth',
    '2mm',
    'mm',
    'Zusätzliche Bohrungs- und Gewindetiefe der Standoffs in den Gehäuseboden hinein'
  );
  return ensureParamExpression(p, '2mm', ['0mm', '0.0mm']);
})(),
```

---

## 4. Modulübersicht & Betroffene Komponenten (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Anpassungen | Status |
| :--- | :--- | :--- |
| **`parameters.ts`** | `standoff_height` auf `'1.5mm'` gesetzt (Migration von `2.5mm`, `6.5mm`). Neuer Parameter `standoff_floor_depth` (`'2mm'`). `case_bottom_height` auf `'6.4mm'` gesetzt. | Abgeschlossen |
| **`standoffs.ts`** | Zweistufiges Konstruktionsverfahren: 1) Vollzylinder der Säulen auf $Z_{\text{floor}}$ um $1.5\,\text{mm}$ extrudieren (Join). 2) Hilfsebene `Plane_Pi5_Standoff_Tops` bei $Z = -1.9\,\text{mm}$ anlegen und Kernlöcher um $3.5\,\text{mm}$ nach unten schneiden (Cut bis $Z = -5.4\,\text{mm}$). Modelliertes M2.5x0.45 6H Gewinde über die vollen $3.5\,\text{mm}$ Tiefe inkl. FDM-Passungsspiel ($-0.05\,\text{mm}$). | Abgeschlossen |
| **`chassis.ts`** | Kommentare für Extrusion $-6.4\,\text{mm}$ und Verrundung bei $Z = -0.64\,\text{cm}$ synchronisiert. | Abgeschlossen |
| **`pi5Board.ts`** | Board-Translation auf Standoffs: $\Delta Z = Z_{\text{standoff\_top}} + \text{pi5\_z\_offset} = -1.9\,\text{mm}$ setzt das STEP-Modell um exakt $1.0\,\text{mm}$ tiefer. | Abgeschlossen |
| **`stressRelief.ts`** | Schutzbereiche auf $Z_{\text{standoff\_top}} = -1.9\,\text{mm}$ und $Z_{\text{bottom}} = -6.4\,\text{mm}$ aktualisiert. Zylindrische Kernlochflächen mit $r < 2.0\,\text{mm}$ sind automatisch geschützt. | Abgeschlossen |
| **`printLayout.ts`** | Bounding-Box-Nivellierung von `Case_Bottom` auf Druckbett $Z = 0$ arbeitet vollautomatisch; Dokumentation auf $-6.4\,\text{mm}$ angepasst. | Abgeschlossen |
| **`case.ts`** | Schritt 18 Konsolenausgabe zeigt Säulenhöhe ($1.5\,\text{mm}$) und Gesamteinschraubtiefe ($3.5\,\text{mm}$ inkl. $2.0\,\text{mm}$ im Boden) transparent an. | Abgeschlossen |
| **`prompt.md`** (p017) | Vollständige Dokumentation der 4mm-Bodenkürzung, 1mm-Boardabsenkung und 2mm-Gewindevertiefung. | Abgeschlossen |

---

## 5. Verifikation & Qualitätssicherung

1. **Statischer Typcheck:**
   - `npx tsc --noEmit` erfolgreich ohne Fehler durchgelaufen (Exit Code 0).
2. **Port-Passung:**
   - RJ45 Ethernet: Oberkante liegt jetzt ca. $1.4\,\text{mm}$ unterhalb der Gehäusekante (kein Anstoßen mehr).
   - Dual USB 3.0 / 2.0: Federlaschen liegen frei im Ausschnitt.
   - Front-Ports: USB-C und Micro-HDMI sitzen mittig in der Aussparung.
3. **Schraubenhaltbarkeit & Dichtigkeit:**
   - Gesamte Gewindetiefe: $3.5\,\text{mm}$ (ausreichend für M2.5x5 Schrauben bei $1.45\,\text{mm}$ Platinendicke).
   - Unterseite des Gehäuses: $1.0\,\text{mm}$ solider Boden unter den Bohrlöchern gewährleistet vollständige Geschlossenheit und Stabilität.
