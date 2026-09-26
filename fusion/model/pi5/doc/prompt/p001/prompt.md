# Erweiterungen

- Arbeite nur an der Dateien fusion/model/pi5/case/case.ts und den lokalen imports 'fusion/model/pi5/case/*.ts', 
sowie fusion/model/pi5/doc/prompt/p001/prompt.md und evtl. den anderen fusion/model/pi5/doc/prompt/**/prompt.md
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Ein Gehäuse für einen Raspberry-Pi5 im apple-Design der 80er


## Steps

0) Erstelle eine Skizze auf der XY-Ebene
1) Zentriertes Rechteck zeichnen mit 91.4 mm x 62.4 mm (Breite X = 91.4 mm, Tiefe Y = 62.4 mm, zentriert um Ursprung; ergibt bei 3 mm Wandstärke einen Innenraum von 85.4 mm x 56.4 mm, passend für die 85 mm x 56 mm Platine des Raspberry Pi 5 inkl. +0.2 mm umlaufendem Spiel je Seite)
2) Extrusion nach oben um +40 mm (oberer Körper `Case_Top`, NewBody)
3) Wieder von der Basisskizze ausgehend Extrusion nach unten um -10.4 mm (unterer Körper `Case_Bottom`, NewBody, nicht verschmelzen)
4) Nimm den oberen Körper, selektiere dessen Unterseite (Trennfläche bei Z = 0) und erstelle eine Schale mit 3 mm Wandstärke nach innen
5) Nimm den unteren Körper, selektiere dessen Oberseite (Trennfläche bei Z = 0) und erstelle eine Schale mit 3 mm Wandstärke nach innen
6) Selektiere bei beiden Körpern jeweils 8 Außenkanten:
   - Oberkörper: 4 senkrechte Außenkanten an den Ecken + 4 obere horizontale Kanten der Deckelfläche (Trennlinie bei Z = 0 bleibt unberührt)
   - Unterkörper: 4 senkrechte Außenkanten an den Ecken + 4 untere horizontale Kanten der Bodenfläche (Trennlinie bei Z = 0 bleibt unberührt)
7) Führe an diesen jeweils 8 Außenkanten eine Kantenverrundung mit Radius 2 mm durch
8) Selektiere die obere Deckelfläche (bei Z = 40 mm) und konstruiere eine Versatzebene (Hilfsebene) bei -8 mm (Z = 32 mm)
10) Erzeuge eine Skizze auf dieser Hilfsebene bei -8 mm
11) Skizziere ein Rechteck mit 91.4 mm x 62.4 mm (zentriert um den Ursprung)
12) Erstelle einen Versatz nach innen um 1.5 mm (inneres Rechteck mit 88.4 mm x 59.4 mm)
13) Selektiere das entstandene Ringprofil zwischen den beiden Rechtecken und führe eine Schnitt-Extrusion (Ausschneiden) nach unten um -2.5 mm aus (umlaufende Gehäusefuge)
14) Selektiere in der entstandenen Fuge die 4 senkrechten Innenkanten an den Ecken und führe eine Abrundung mit Radius 1 mm durch

---

## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **0 & 1** | Skizze auf XY-Ebene, zentriertes Rechteck 91.4 mm x 62.4 mm (Innenraum 85.4 x 56.4 mm) | `chassis.ts:createBaseSketchAndExtrusions` | Abgeschlossen |
| **2** | Extrusion +40 mm (Körper: `Case_Top`) | `chassis.ts:createBaseSketchAndExtrusions` | Abgeschlossen |
| **3** | Extrusion -10.4 mm (Körper: `Case_Bottom`, NewBody) | `chassis.ts:createBaseSketchAndExtrusions` | Abgeschlossen |
| **4 & 5** | Schalen mit 3 mm Wandstärke an Trennfläche ($Z = 0$) | `chassis.ts:shellBodies` | Abgeschlossen |
| **6 & 7** | Verrundung von jeweils 8 Außenkanten mit Radius 2 mm | `chassis.ts:filletOuterEdges` | Abgeschlossen |
| **8** | Konstruktionsebene bei -8 mm von oberer Deckelfläche | `chassis.ts:createGrooveFeature` | Abgeschlossen |
| **10–12**| Skizze auf Hilfsebene: Rechteck 91.4 x 62.4 mm, 1.5 mm Versatz nach innen | `chassis.ts:createGrooveFeature` | Abgeschlossen |
| **13** | Ausschneiden (-2.5 mm Schnitt) des Ringprofils | `chassis.ts:createGrooveFeature` | Abgeschlossen |
| **14** | Verrundung der 4 senkrechten Fugen-Innenkanten (1 mm) | `chassis.ts:filletGrooveEdges` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `board_width`: `85mm` (Breite der Platine)
- `board_depth`: `56mm` (Tiefe der Platine)
- `board_clearance`: `0.2mm` (Umlaufendes Spiel je Seite)
- `case_width`: `91.4mm` (Außenbreite = 85 + 2*0.2 + 2*3)
- `case_depth`: `62.4mm` (Außentiefe = 56 + 2*0.2 + 2*3)
- `case_top_height`: `40mm`
- `case_bottom_height`: `10.4mm`
- `shell_thickness`: `3mm`
- `corner_fillet_radius`: `2mm`
- `groove_plane_offset`: `-8mm`
- `groove_base_width`: `91.4mm`
- `groove_base_depth`: `62.4mm`
- `groove_inset`: `1.5mm`
- `groove_cut_depth`: `-2.5mm`
- `groove_fillet_radius`: `1mm`
