# Druckschalter (Taste) anstatt kleinem Loch (p028)

- Arbeite nur an den Dateien `fusion/model/pi5/pi5case/pi5case.ts` und den lokalen imports `fusion/model/pi5/pi5case/*.ts`,
  sowie `fusion/model/pi5/prompt/p028/prompt.md` und evtl. den anderen `fusion/model/pi5/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../AGENTS.md)

## Ziel

Konstruktion einer integrierten, federnden Druckschalter-Lasche (compliant flexure button tab) in der Außenwand von `Case_Middle` (bzw. `Case_Main`) an der kurzen linken Gehäuseseite ($X = -45.7\,\text{mm}$) als Ersatz für das bisherige kreisrunde 1.0 mm Durchgangsloch für den Ein-/Ausschalter des Raspberry Pi 5 gemäß [img.png](img.png), gedreht um 90 Grad, sodass der Schalter **vertikal von oben nach unten** verläuft:

1. **Integrierte Drucktaste (Lasche):**
   - **Tastkopf & Druckpunkt:** Kreisrunder Kopf mit $\varnothing 4.00\,\text{mm}$ (Radius $2.00\,\text{mm}$, `middle_button_tab_width = 4mm`). Das Zentrum (Druckpunkt) liegt bei $Y = -9.60\,\text{mm}$ (`middle_hole_y_offset = -9.6mm`) und um $0.5\,\text{mm}$ nach oben verschoben bei $Z = 3.45\,\text{mm}$ (`middle_hole_z_offset = 3.45mm`). Die Höhenposition ist konstant relativ zu `Case_Bottom` (bzw. zur Trennebene $Z = 0$), da der Raspberry Pi 5 auf den Standoffs in `Case_Bottom` aufliegt und seine Lage nicht von `case_middle_height_offset` abhängt.
   - **Vertikaler Verlauf von oben nach unten (gerade Lasche ohne Schnörkel):**
     - **Gerader Hebelarm:** Erstreckt sich mit konstanter Breite von $4.00\,\text{mm}$ (`middle_button_tab_width = 4mm`) ohne Verjüngung oder S-förmige Schnörkel über $9.00\,\text{mm}$ Länge (`middle_button_tab_length = 9mm`, um 1 mm gekürzt) vom Tastkopf-Zentrum ($Z_c = 3.45\,\text{mm}$) vertikal nach oben bis $Z_{end} = 12.45\,\text{mm}$, wo die Lasche oben monolithisch mit der Gehäusewand von `Case_Middle` (bzw. `Case_Main`) verbunden bleibt.
     - **Unterer Abschluss:** Am unteren Scheitelpunkt des Tastkopfs schließt der Trennschnitt mit einem äußeren Halbkreis ($R_o = 2.30\,\text{mm}$) ab. Der tiefste Punkt des Schlitzes liegt bei $Z = Z_c - R_o = 1.15\,\text{mm}$ und verbleibt somit vollständig und mit Sicherheitsabstand innerhalb von `Case_Middle` oberhalb der Trennebene $Z = 0$.
   - **Kontur-Trennschnitt:** U-förmige Schnittfuge mit Schnittbreite $w = 0.30\,\text{mm}$ (`middle_button_cut_width = 0.3mm`), optimiert für FDM-3D-Druck (z.B. Bambu Lab P1S/P2S/X1C mit 0.4 mm Düse), um ein Verschmelzen der Wände während des Drucks zu verhindern.

2. **Sicherheitsabstand zu den beiden linken Rastnasen (Snap-Fit):**
   - Die hintere linke Rastnase an der Steckverbindung zwischen `Case_Bottom` und `Case_Middle` liegt bei $Y = +5.0\,\text{mm}$ (`joint_snap_left_y_offset = 5mm`).
   - Die zusätzliche vordere linke Rastnase liegt bei $Y = -20.5\,\text{mm}$ (`joint_snap_front_left_y_offset = -20.5mm`) mit $11.0\,\text{mm}$ Länge (`joint_snap_front_left_length = 11mm`).
   - Da der Schalter nun vertikal ausgerichtet ist und in $Y$-Richtung nur eine Gesamtbreite von $4.6\,\text{mm}$ ($Y \in [-11.9\,\text{mm}, -7.3\,\text{mm}]$) einnimmt, besteht zu beiden Rastnasen ein kollisionsfreier Sicherheitsabstand von mindestens $2.9\,\text{mm}$ (nach vorne) bzw. über $12.3\,\text{mm}$ (nach hinten).

3. **Freistellungs-Ausschnitt mit Verrundungen im Steckkragen von `Case_Bottom`:**
   - Im oberen Steckkragen von `Case_Bottom` ($Z \in [0.0\,\text{mm}, 5.0\,\text{mm}]$) wird hinter dem unteren Betätigungsbereich der Lasche ($Y \in [-12.4\,\text{mm}, -6.8\,\text{mm}]$) eine kompakte, $5.6\,\text{mm}$ breite Aussparung freigeschnitten.
   - **Harmonische Eckverrundungen ($R = 1.2\,\text{mm}$, `collar_button_cutout_fillet = 1.2mm`):**
     - Unten zur horizontalen Trennfläche ($Z = 0$): Weiche konkave Innenradien ($R = 1.2\,\text{mm}$) leiten die vertikalen Schnittkanten kerbspannungsfrei in den Gehäuseboden über.
     - Oben an der Kragenkante ($Z = 5.0\,\text{mm}$): Konvexe Außenradien ($R = 1.2\,\text{mm}$) brechen die oberen 90°-Kanten sauber ab.
   - Die Lasche kann sich dadurch beim Drücken ungehindert ins Gehäuseinnere durchbiegen und den Taster des Raspberry Pi 5 zuverlässig betätigen, ohne mit dem Kragen von `Case_Bottom` zu kollidieren.
4. **Innenliegende Dickenreduzierung der Lasche (flach wie Wand darunter mit 45°-Fase):**
   - **Problemstellung:** Im unteren Gehäusebereich ($Z \le 5.2\,\text{mm}$) besitzt die Innenwand von `Case_Middle` durch den Stufenfalz-Schnitt der Steckverbindung eine Restwandstärke von $1.5\,\text{mm}$ ($X = -4.42\,\text{cm}$). Oberhalb der Stufe ($Z > 5.2\,\text{mm}$) betrug die Wandstärke der Lasche bisher die vollen $3.0\,\text{mm}$ ($X = -4.27\,\text{cm}$). Dadurch sprang die Lasche innen um $1.5\,\text{mm}$ hervor und war für ein federndes Betätigen zu steif.
   - **Flache Geometrie wie die Wand darunter:**
     - Auf der Innenseite der Lasche wird der Bereich oberhalb der Stufe über eine Höhe von $5.50\,\text{mm}$ (`middle_button_inner_recess_height = 5.5mm`) von $Z = 5.2\,\text{mm}$ bis $Z = 10.7\,\text{mm}$ um $1.5\,\text{mm}$ abgetragen, sodass die Lasche innen exakt in derselben Ebene wie die Stufenwand darunter liegt ($X = -4.42\,\text{cm}$, Restwandstärke $1.5\,\text{mm}$).
     - Die gesamte Innenseite der Lasche verläuft somit von $Z = 0$ bis $Z = 10.7\,\text{mm}$ vollständig bündig, stufenfrei und flach.
   - **45°-Fase am oberen Übergang:**
     - Am oberen Ende der Dickenreduzierung ($Z = 10.7\,\text{mm}$) wird der Übergang zur $3.0\,\text{mm}$ starken Wand über eine Länge von $1.50\,\text{mm}$ (`middle_button_inner_recess_chamfer = 1.5mm`) mit einer $45^\circ$-Fase abgefast.
     - Der Übergang schließt bei $Z = 12.2\,\text{mm}$ sauber an die ungeschwächte $3.0\,\text{mm}$ Gehäusewand vor dem oberen Ende der Lasche ($Z_{end} = 12.45\,\text{mm}$) an.
     - 100 % stützfreier FDM-3D-Druck ohne Bridging und minimale Kerbspannungen durch die $45^\circ$-Schräge.

5. **Taktile kreisrunde Erhebung an der Außenseite der Lasche mit 0.2 mm Fase:**
   - **Erhebung (+0.2 mm nach außen):** Im unteren Kreisbereich der Lasche (Tastkopf) wird an der Außenwand ($X = -45.7\,\text{mm}$) ein zylindrischer Kreis mit $\varnothing 4.00\,\text{mm}$ ($R = 2.00\,\text{mm}$, konzentrisch zum Druckpunkt bei $Y = -9.60\,\text{mm}, Z = 3.45\,\text{mm}$) um $+0.20\,\text{mm}$ (`middle_button_boss_height = 0.2mm`) nach außen extrudiert (`NewBodyFeatureOperation`).
   - **Verschmelzen mit Case_Main vor dem Anfasen (Merge via Combine):** Bevor der Kreis angefast wird, wird der neu entstandene Körper der Erhebung via Combine-Feature (`operation = JoinFeatureOperation`, `isKeepToolBodies = false`) vollständig mit `Case_Main` (bzw. `Case_Middle`) verschmolzen (merge). Dadurch verbleibt kein separater Körper im Modell und die Erhebung ist monolithischer Bestandteil von `Case_Main`.
   - **Umlaufende 0.2 mm Fase:** Erst nach dem Verschmelzen wird die äußere Kreiskante dieser Erhebung an `Case_Main` um $0.20\,\text{mm}$ (`middle_button_boss_chamfer = 0.2mm`) mit einer $45^\circ$-Fase abgefast.
   - **Haptik:** Dadurch entsteht ein sanft bekränzter, haptisch fühlbarer Tastknopf mit einer ebenen Kreisdruckfläche von $\varnothing 3.60\,\text{mm}$, dessen Schräge bündig in die Laschenoberfläche und die Trennfuge übergeht.

---

## 1. Geometrische & Mathematische Analyse

| Parameter / Bezugsmaß | Wert / Formel | Beschreibung |
| :--- | :--- | :--- |
| `middle_button_tab_length` | $9.0\,\text{mm}$ | Vertikale Hebelarmlänge vom Kreiszentrum in $+Z$ nach oben (gerader Verlauf ohne Schnörkel, 1 mm kürzer) |
| `middle_button_tab_width` | $4.0\,\text{mm}$ | Horizontale Breite des Hebelarms (in $Y$) und Tastkopfdurchmesser ($\varnothing 4.00\,\text{mm}$) |
| `middle_button_neck_length` | $2.0\,\text{mm}$ | Legacy-Parameter (Biegesteghöhe; bei geradem Verlauf nicht mehr aktiv) |
| `middle_button_neck_width` | $2.0\,\text{mm}$ | Legacy-Parameter (Biegestegbreite; bei geradem Verlauf nicht mehr aktiv) |
| `middle_button_neck_fillet` | $0.5\,\text{mm}$ | Legacy-Parameter (Übergangsradien; bei geradem Verlauf nicht mehr aktiv) |
| `middle_button_cut_width` | $0.3\,\text{mm}$ | Schnittbreite des Trennschlitzes (FDM-optimiert für sauberen Spalt) |
| `middle_button_inner_recess_height` | $5.5\,\text{mm}$ | Höhe der innenliegenden Dickenreduzierung auf $1.5\,\text{mm}$ Restwandstärke oberhalb der Stufe |
| `middle_button_inner_recess_chamfer` | $1.5\,\text{mm}$ | $45^\circ$-Fasenlänge am oberen Übergang von $1.5\,\text{mm}$ auf $3.0\,\text{mm}$ Wandstärke |
| `middle_button_boss_height` | $0.2\,\text{mm}$ | Höhe der kreisrunden taktilen Erhebung an der Außenseite der Lasche |
| `middle_button_boss_chamfer` | $0.2\,\text{mm}$ | $45^\circ$-Fasenbreite an der Kreiskante der äußeren Erhebung |
| `collar_button_cutout_fillet` | $1.2\,\text{mm}$ | Verrundungsradius an den 4 Ecken des Kragenausschnitts in `Case_Bottom` (oben konvex, unten konkav) |
| `middle_hole_y_offset` | $-9.6\,\text{mm}$ | Y-Position des Tastkopf-Zentrums / Druckpunkts auf der linken Seitenwand (unverändert) |
| `middle_hole_z_offset` | $3.45\,\text{mm}$ | Z-Höhe des Tastkopf-Zentrums / Druckpunkts (+0.5 mm nach oben verschoben, konstant relativ zu `Case_Bottom`) |
| `joint_snap_left_y_offset` | $5.0\,\text{mm}$ | Mittenposition der hinteren linken Rastnase auf `Case_Bottom` & `Case_Middle` |
| `joint_snap_front_left_y_offset` | $-20.5\,\text{mm}$ | Mittenposition der zusätzlichen vorderen linken Rastnase vor dem Druckschalter |
| `joint_snap_front_left_length` | $11.0\,\text{mm}$ | Länge der zusätzlichen vorderen linken Rastnase |
| Kragenausschnitt `Case_Bottom` | $Y \in [-12.4, -6.8]\,\text{mm}$, $Z \in [0.0, 5.0]\,\text{mm}$, $R = 1.2\,\text{mm}$ | Freistellung im Steckkragen von `Case_Bottom` hinter dem Tastkopf mit verrundeten Ecken |
| Hilfsebene (`Plane_Middle_Button_Tab`) | $X = -5.5\,\text{cm}$ | Konstruktionsebene außerhalb der Gehäusewand |
| Hilfsebene (`Plane_Middle_Button_Inner_Recess`) | $Y = -1.175\,\text{cm}$ | Konstruktionsebene parallel zu XZ für den Dickenreduzierungs-Schnitt |
| Hilfsebene (`Plane_Middle_Button_Outer_Boss`) | $X = -4.57\,\text{cm}$ | Konstruktionsebene an der Außenwand für die taktile Erhebung |

---

## 2. Implementierungsdetails

1. **Parameter (`parameters.ts`):**
   - `joint_snap_left_y_offset`: `5mm` (Verschiebung der hinteren linken Rastnase nach links / $+Y$ für Kollisionsfreiheit).
   - `joint_snap_front_left_y_offset`: `-20.5mm` (Position der zusätzlichen vorderen linken Rastnase vor dem Taster).
   - `joint_snap_front_left_length`: `11mm` (Länge der zusätzlichen vorderen linken Rastnase).
   - `middle_button_tab_length`: `9mm` (vertikale Hebelarmlänge nach oben, 1 mm kürzer, gerader Verlauf ohne Schnörkel).
   - `middle_button_tab_width`: `4mm` (Hebelarmbreite in $Y$ & Kopfdurchmesser).
   - `middle_button_cut_width`: `0.3mm` (Schnittbreite / Schlitzspalt).
   - `middle_button_inner_recess_height`: `5.5mm` (Höhe der innenliegenden Dickenreduzierung).
   - `middle_button_inner_recess_chamfer`: `1.5mm` ($45^\circ$-Fase an der Übergangskante).
   - `middle_button_boss_height`: `0.2mm` (Höhe der äußeren taktilen Erhebung).
   - `middle_button_boss_chamfer`: `0.2mm` (Fasenbreite an der Kreiskante der äußeren Erhebung).
   - `collar_button_cutout_fillet`: `1.2mm` (Verrundungsradius für die Ecken des Kragenausschnitts in `Case_Bottom`).
   - Rückwärtskompatibilität für `middle_hole_diameter`, `middle_hole_y_offset` und `middle_hole_z_offset` bleibt vollständig gewahrt; `middle_hole_z_offset` (bzw. `middle_opening_z_offset`) ist fest auf `3.45mm` definiert (+0.5 mm nach oben verschoben, konstant zu `Case_Bottom`, unabhängig von `case_middle_height_offset`).

2. **Steckverbindung (`joint.ts`, Schritt 19):**
   - Die beiden linken Rastwülste auf `Case_Bottom` und Rastmulden in `Case_Middle` nutzen `leftSnapCenterY = params.jointSnapLeftYOffset.value` ($+5.0\,\text{mm}$) und `frontLeftSnapCenterY = params.jointSnapFrontLeftYOffset.value` ($-20.5\,\text{mm}$).

3. **Geometrieerzeugung (`openings.ts`, Schritt 21b):**
   - `createMiddleButtonTab` (mit Aliase `createMiddleSideHole` & `createMiddleSideOpening`):
     - **Schlitzkontur:** Erzeugt Ebene `Plane_Middle_Button_Tab` bei $X = -5.5\,\text{cm}$. Schneidet die vertikale, 8-teilige geschlossene U-Schlitzkontur (2 parallele vertikale Schnittkantenpaare, 2 untere Halbkreisbögen, 2 obere Querschnitte, gerader Verlauf ohne Schnörkel) durch `Case_Middle` (bzw. `Case_Main`) mit `CutFeatureOperation` frei.
     - **Innenliegende Dickenreduzierung & Fase:** Erzeugt Ebene `Plane_Middle_Button_Inner_Recess` bei $Y = -1.175\,\text{cm}$. Zeichnet ein 5-teiliges XZ-Polygon mit gerader Wand bei $X = -4.42\,\text{cm}$ ($1.5\,\text{mm}$ Dicke) von $Z = 0$ bis $Z = 10.7\,\text{mm}$ und einer $45^\circ$-Fase von $(X=-4.42, Z=10.7)$ auf $(X=-4.27, Z=12.2)$. Schneidet die Lasche über eine Breite von $4.3\,\text{mm}$ (exakt zwischen den beiden Schnittfugen) auf der Innenseite frei.
     - **Taktile äußere Erhebung mit Fase & Verschmelzung (Merge):** Erzeugt Ebene `Plane_Middle_Button_Outer_Boss` bei $X = -4.57\,\text{cm}$. Extrudiert einen Kreis mit $\varnothing 4.00\,\text{mm}$ am Druckpunkt um $+0.20\,\text{mm}$ nach außen (`NewBodyFeatureOperation`). Verschmilzt (merge) den neu entstandenen Körper ZUERST über ein Combine-Feature (`JoinFeatureOperation`, `isKeepToolBodies = false`) vollständig mit `Case_Main` (bzw. `Case_Middle`), sodass kein separater Restkörper im Modell verbleibt. Erst DANACH wird die äußere Kreiskante an `Case_Main` mit `applyChamferWithFallbacks` um $0.20\,\text{mm}$ abgefast.
     - **Kragenausschnitt:** Schneidet eine kompakte $5.6 \times 5.0\,\text{mm}$ Freistellung im Steckkragen von `Case_Bottom` hinter dem Schalter mit 10-teiligem, verrundetem Schnittprofil frei (`participantBodies = [liveBottom]`, $R = 1.2\,\text{mm}$, konkave Innenradien unten zum Gehäuseboden, konvexe Außenradien oben am Kragenkopf).

4. **Orchestrierung (`pi5case.ts`):**
   - Schritt 21b ruft `createMiddleButtonTab` auf und aktualisiert die BRep-Referenzen von `Case_Middle` (bzw. `Case_Main`) und `Case_Bottom` über `getLiveBody`.
