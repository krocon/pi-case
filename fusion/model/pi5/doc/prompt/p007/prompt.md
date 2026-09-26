# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`, 
sowie `fusion/model/pi5/doc/prompt/p007/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Horizontale Trennung des Gehäuse-Oberteils (Case_Top) am unteren Ende der Einkerbung für optimierten FDM-3D-Druck inklusive 5 mm Stufenfalz-Verbindung und Mini-Fase an Case_Top

Für einen qualitativ hochwertigen, stützfreien FDM-3D-Druck (z. B. auf Bambu Lab P2S mit PLA/PETG) wird das bisher monolithische Gehäuse-Oberteil (`Case_Top`) horizontal in zwei separate Bauteile getrennt:
1. **`Case_Top` (Deckel / Lid):** Oberster Gehäusedeckel mit den 7 Lüftungsschlitzen (Druck flach liegend auf der Oberseite oder der Trennebene).
2. **`Case_Middle` (abgetrenntes Unterteil / Hauptrahmen):** Vertikaler Gehäusekörper mit den Anschlüssen für USB-C, Micro-HDMI, Ethernet, USB 3.0/2.0 sowie der Nut-Verbindung zum Gehäuseboden (`Case_Bottom`) (linke Wand bleibt geschlossen).

Zur formschlüssigen, werkzeuglosen Steckverbindung zwischen den beiden Teilen:
- Ausgehend von der $1.5\,\text{mm}$ dünnen Wand am unteren Ende der umlaufenden Einkerbung wird ein **$5.0\,\text{mm}$ tiefer Ausschnitt** nach unten in das abgetrennte Unterteil (`Case_Middle`) geschnitten.
- Die korrespondierende **dünne Wand am oberen Deckelteil (`Case_Top`) wird um $5.0\,\text{mm}$ nach unten verlängert**, sodass sie passgenau in die Aussparung eintaucht.
- **Keine Fase an `Case_Middle`:** Die obere Stufen- und Trennfläche von `Case_Middle` bei $Z = 29.5\,\text{mm}$ bleibt plan ohne Fase. Dies gewährleistet eine perfekte ebene Auflage auf dem 3D-Druckbett beim invertierten Druck (`layout_for_print = 1`) sowie eine optisch saubere, geschlossene Fugenkante im zusammengebauten Zustand.
- **Mini-Fase an `Case_Top`:** An der **äußeren Unterkante der $1.5\,\text{mm}$ dünnen Wand des Deckelkörpers (`Case_Top`) bei $Z = 24.5\,\text{mm}$** wird eine **$45^\circ$-Mini-Fase ($0.5\,\text{mm}$, `lid_joint_chamfer`)** angebracht. Sie dient als Einsteck- und Zentrierhilfe (Einführschräge), die beim Fügen klemmfrei in die Stufe von `Case_Middle` gleitet und im geschlossenen Gehäuse unsichtbar innenliegt.


## Geometriebeschreibung

- **Trennebene (Split Plane am unteren Ende der Einkerbung):**
  - Die Gehäuse-Einkerbung (Fuge) beginnt bei $Z = 32.0\,\text{mm}$ ($8.0\,\text{mm}$ unterhalb der Deckelfläche bei $Z = 40.0\,\text{mm}$, `groove_plane_offset = -8mm`).
  - Die Schnitttiefe der Fuge beträgt $-2.5\,\text{mm}$ (`groove_cut_depth = -2.5mm`).
  - Das untere Ende der Einkerbung liegt somit exakt auf der horizontalen Ebene:
    $$Z_{\text{split}} = 40.0\,\text{mm} - 8.0\,\text{mm} - 2.5\,\text{mm} = 29.5\,\text{mm}$$
  - Hilfsebene `Plane_Lid_Split` wird parallel zur XY-Ebene bei $Z = 29.5\,\text{mm}$ konstruiert (`lid_split_z = 29.5mm`).
  - Trennung via `SplitBodyFeatures` beschränkt auf `Case_Top`:
    - Oberer Körper ($Z \in [29.5, 40.0]\,\text{mm}$): Neuer `Case_Top` (Deckel).
    - Unterer Körper ($Z \in [0.0, 29.5]\,\text{mm}$): `Case_Middle` (abgetrenntes Unterteil).

- **Querschnitt der $1.5\,\text{mm}$ dünnen Wand am Deckel (`Case_Top` bei $Z = 29.5\,\text{mm}$):**
  - Innenmaß der Schale: $85.4\,\text{mm} \times 56.4\,\text{mm}$ ($X \in [-42.7, +42.7]\,\text{mm}$, $Y \in [-28.2, +28.2]\,\text{mm}$).
  - Außenmaß der Fuge: $88.4\,\text{mm} \times 59.4\,\text{mm}$ ($X \in [-44.2, +44.2]\,\text{mm}$, $Y \in [-29.7, +29.7]\,\text{mm}$ mit $R = 1.0\,\text{mm}$ Eckverrundung).
  - Wandstärke der dünnen Wand: $(88.4 - 85.4) / 2 = 1.5\,\text{mm}$.
  - An der Unterseite von `Case_Top` bildet diese dünne Wand eine ebene, nach unten gerichtete Planarfläche bei $Z = 29.5\,\text{mm}$ (Normalenvektor $(0, 0, -1)$).

- **Extrusions-Schnitt (Ausschneiden) 5 mm nach unten in `Case_Middle`:**
  - Unter Verwendung der Kontur der unteren Planarfläche der dünnen Wand wird eine Schnitt-Extrusion (`CutFeatureOperation`) um $5.0\,\text{mm}$ nach unten (in $-Z$-Richtung, von $Z = 29.5\,\text{mm}$ auf $Z = 24.5\,\text{mm}$) ausgeführt.
  - Zielkörper: Ausschließlich das abgetrennte Unterteil (`participantBodies = [Case_Middle]`).
  - Am oberen Rand von `Case_Middle` entsteht eine $5.0\,\text{mm}$ tiefe Stufe (Innenfalz) mit $1.5\,\text{mm}$ Wandstärke, während der äußere $1.5\,\text{mm}$ Steg bis $Z = 29.5\,\text{mm}$ stehen bleibt.
  - An `Case_Middle` wird keine Fase angebracht; alle Kanten bei $Z = 29.5\,\text{mm}$ bleiben scharfkantig bzw. plan für stützfreien Druck auf dem Druckbett.

- **Verlängerung der dünnen Wand um 5 mm nach unten an `Case_Top`:**
  - Die untere Fläche der dünnen Wand an `Case_Top` wird um $5.0\,\text{mm}$ nach unten (in $-Z$-Richtung von $Z = 29.5\,\text{mm}$ auf $Z = 24.5\,\text{mm}$) extrudiert (`JoinFeatureOperation`).
  - Zielkörper: Ausschließlich der obere Deckelkörper (`participantBodies = [Case_Top]`).
  - Es entsteht ein $5.0\,\text{mm}$ hoher, passgenauer Steckkragen (männlicher Stufenfalz) mit Stirnfläche bei $Z = 24.5\,\text{mm}$.

- **Mini-Fase an der äußeren Unterkante der dünnen Wand von `Case_Top`:**
  - An der unteren Begrenzung des Steckkragens bei $Z = 24.5\,\text{mm}$ wird die äußere Umfangskante (Übergang zur vertikalen Außenfläche der dünnen Wand bei $|X| \approx 44.2\,\text{mm}, |Y| \approx 29.7\,\text{mm}$) mit einer $45^\circ$-Mini-Fase von $0.5\,\text{mm}$ (`lid_joint_chamfer`) angefast.
  - Zweck:
    - Einführschräge für müheloses, klemmfreies Fügen ("Zusammenstecken").
    - Die Fase liegt vollständig im Inneren der Aussparung von `Case_Middle` und ist von außen im zusammengebauten Zustand nicht sichtbar.
    - Die ebene Stirnfläche von $1.0\,\text{mm}$ Breite bleibt als horizontaler Anschlag erhalten.


## Steps

1) **Parameter (`parameters.ts`):**
   - Ergänzung im strikten `snake_case` (AGENTS.md §3.2 & §3.3):
     - `lid_split_z`: `29.5mm` (Z-Höhe der Trennebene am unteren Fugenende)
     - `lid_joint_depth`: `5mm` (Tiefe des Ausschnitts & Verlängerung der dünnen Wand)
     - `lid_joint_chamfer`: `0.5mm` (Mini-Fase an der äußeren Unterkante der dünnen Wand von Case_Top)
     - `lid_joint_clearance`: `0.15mm` (Horizontales FDM-Passungsspiel)

2) **Hilfsebene & Bauteiltrennung (`SplitBodyFeatures`):**
   - Erzeuge Konstruktionsebene `Plane_Lid_Split` parallel zur XY-Ebene bei $Z = 29.5\,\text{mm}$.
   - Führe `splitBodyFeatures.createInput(liveTop, splitPlane, true)` aus.
   - Identifiziere die zwei resultierenden BRep-Körper:
     - `Case_Top` ($Z \ge 29.5\,\text{mm}$, Bounding-Box bis $40.0\,\text{mm}$)
     - `Case_Middle` ($Z \le 29.5\,\text{mm}$, Bounding-Box ab $0.0\,\text{mm}$)

3) **Ausschneiden der 5 mm Stufe in `Case_Middle`:**
   - Ermittle die untere Planarfläche der $1.5\,\text{mm}$ dünnen Wand an `Case_Top` bei $Z = 29.5\,\text{mm}$.
   - Führe eine Schnitt-Extrusion von $5.0\,\text{mm}$ in $-Z$-Richtung gezielt auf `Case_Middle` aus (`CutFeatureOperation`, `participantBodies = [Case_Middle]`).
   - Keine Anfasung an `Case_Middle`.

4) **Verlängerung der dünnen Wand an `Case_Top`:**
   - Extrudiere die untere Stirnfläche der dünnen Wand an `Case_Top` um $5.0\,\text{mm}$ in $-Z$-Richtung mit `JoinFeatureOperation` (`participantBodies = [Case_Top]`).
   - Der Steckkragen erstreckt sich nun von $Z = 29.5\,\text{mm}$ bis $Z = 24.5\,\text{mm}$.

5) **Mini-Fase an `Case_Top`:**
   - Selektiere die äußeren horizontalen Umfangskanten an der unteren Stirnfläche ($Z = 24.5\,\text{mm}$) der dünnen Wand des Körpers `Case_Top`.
   - Wende eine $0.5\,\text{mm}$ Mini-Fase (`lid_joint_chamfer`) mit dem bewährten 4-Stufen-Fallback-System an.

6) **Modul & Orchestrierung (`lidJoint.ts`, `case.ts`):**
   - Neues Modul `fusion/model/pi5/case/lidJoint.ts` mit Funktion `splitAndCreateLidJoint`.
   - Einbindung als Schritt 20 in `case.ts:run()` nach Schritt 19.
   - Sicherung und Benennung der 3 Live-Körper: `Case_Top`, `Case_Middle`, `Case_Bottom`.


## Implementierungsstatus & Dokumentation (AGENTS.md konform)

| Schritt | Beschreibung | Implementierungsort | Status |
| :--- | :--- | :--- | :--- |
| **Parameter** | Parametrische Maße `lid_split_z` (29.5 mm), `lid_joint_depth` (5 mm), `lid_joint_chamfer` (0.5 mm), `lid_joint_clearance` (0.15 mm) | `parameters.ts:setupParameters` | Abgeschlossen |
| **Bauteiltrennung** | Horizontale Trennung von `Case_Top` bei $Z = 29.5\,\text{mm}$ via `SplitBodyFeatures` in `Case_Top` und `Case_Middle` | `lidJoint.ts:splitAndCreateLidJoint` | Abgeschlossen |
| **Stufen-Ausschnitt** | 5.0 mm Schnitt nach unten in `Case_Middle` mit dem Profil der dünnen Wand (plan ohne Fase) | `lidJoint.ts:splitAndCreateLidJoint` | Abgeschlossen |
| **Wand-Verlängerung** | 5.0 mm Extrusion der dünnen Wand nach unten an `Case_Top` (Join) | `lidJoint.ts:splitAndCreateLidJoint` | Abgeschlossen |
| **Mini-Fase** | 0.5 mm $45^\circ$-Einführfase an den äußeren Kanten der verlängerten dünnen Wand von `Case_Top` bei $Z = 24.5\,\text{mm}$ | `lidJoint.ts:splitAndCreateLidJoint` | Abgeschlossen |
| **Orchestrierung** | Schritt 20 in `case.ts:run` integriert inkl. Benennung aller 3 Körper (`Case_Top`, `Case_Middle`, `Case_Bottom`) | `case.ts:run` | Abgeschlossen |

### Verwendete Parameter (`parameters.ts`)
- `lid_split_z`: `29.5mm` (Z-Höhe der Trennebene am unteren Ende der Einkerbung)
- `lid_joint_depth`: `5mm` (Tiefe des Stufenausschnitts & Verlängerung des Steckkragens)
- `lid_joint_chamfer`: `0.5mm` (Mini-Fase an der äußeren Unterkante der dünnen Wand von Case_Top)
- `lid_joint_clearance`: `0.15mm` (Horizontales Passungsspiel)
