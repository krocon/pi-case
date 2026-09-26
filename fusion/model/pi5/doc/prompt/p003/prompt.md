# Erweiterungen

- Arbeite nur an der Dateien fusion/model/pi5/case/case.ts und den lokalen imports 'fusion/model/pi5/case/*.ts', 
sowie fusion/model/pi5/doc/prompt/p003/prompt.md und evtl. den anderen fusion/model/pi5/doc/prompt/**/prompt.md
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Vertiefung / Einsenkung an der Gehäusefront für die Anschlüsse (USB-C & Micro-HDMI)


## Steps

1) **Skizze auf Ebene:**
   - Erstelle eine Skizze auf einer Ebene an der Gehäusefront (parallel zur XZ-Ebene an der Frontwand bei $Y = -\text{case\_depth}/2 = -31.2\,\text{mm}$ bzw. auf einer davorliegenden Konstruktionsebene).

2) **Rechteck um die 3 kleinen Rechtecke mit 4 mm Versatz:**
   - Erzeuge ein umschließendes Rechteck um die 3 Front-Port-Ausschnitte (USB-C, Micro HDMI 0, Micro HDMI 1).
   - Wende an allen 4 Seiten einen Versatz von 4 mm nach außen an (links, rechts, oben und unten jeweils 4 mm Abstand zu den Außenkanten der Port-Ausschnitte).

3) **Ecken abrunden (R3 mm):**
   - Runde die 4 Ecken des großen Rechtecks mit einem Radius von 3 mm (R3 mm) ab.

4) **Extrusions-Schnitt um 1.5 mm nach innen:**
   - Führe mit dem abgerundeten Profil eine Extrusion um 1.5 mm nach innen (in Richtung $+Y$) als Schnitt (Ausschneiden / Cut) durch.
   - Der Schnitt muss gezielt beide Gehäusekörper (`Case_Top` und `Case_Bottom`) erfassen (`participantBodies`), da die Vertiefung über die Trennebene bei $Z = 0$ reicht.

5) **Parameter (`parameters.ts`):**
   - Parametrisierung im strikten `snake_case` (AGENTS.md §3.2):
     - `front_recess_offset`: `4mm` (Versatz um die Anschlüsse)
     - `front_recess_corner_radius`: `3mm` (Eckenverrundung des Profils)
     - `front_recess_depth`: `1.5mm` (Tiefe der Einsenkung nach innen)

---

## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrische Maße `front_recess_offset` (4 mm), `front_recess_corner_radius` (3 mm), `front_recess_depth` (1.5 mm) | `parameters.ts:setupParameters` | Abgeschlossen |
| **Ebene & Skizze** | Konstruktionsebene bei $Y = -(\text{case\_depth} / 2)$ und Skizze `Sketch_Front_Recess` | `openings.ts:createFrontPortRecess` | Abgeschlossen |
| **Abgerundetes Rechteck** | Umschließendes Profil um die 3 Front-Ports mit 4 mm Versatz und 4x R3 mm Eckenverrundung | `openings.ts:drawRoundedRectangleXZ` | Abgeschlossen |
| **Extrusions-Schnitt** | Gezieltes Ausschneiden um 1.5 mm nach innen in `Case_Top` und `Case_Bottom` (`participantBodies`) | `openings.ts:createFrontPortRecess` | Abgeschlossen |
| **Orchestrierung** | Schritt 16 in `run()` integriert inkl. BRep-Live-Referenzen | `case.ts:run` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `front_recess_offset`: `4mm` (Versatz um die Front-Anschlüsse)
- `front_recess_corner_radius`: `3mm` (Eckenverrundungsradius des Profils)
- `front_recess_depth`: `1.5mm` (Einschnitttiefe nach innen)
