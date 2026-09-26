# Druckschalter (Taste) anstatt kleinem Loch (p028)

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p028/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel

Konstruktion einer integrierten, federnden Druckschalter-Lasche (compliant flexure button tab) in der Außenwand von `Case_Middle` (bzw. `Case_Main`) an der kurzen linken Gehäuseseite ($X = -45.7\,\text{mm}$) als Ersatz für das bisherige kreisrunde 1.0 mm Durchgangsloch für den Ein-/Ausschalter des Raspberry Pi 5 gemäß [img.png](img.png), gedreht um 90 Grad, sodass der Schalter **vertikal von oben nach unten** verläuft:

1. **Integrierte Drucktaste (Lasche):**
   - **Tastkopf & Druckpunkt:** Kreisrunder Kopf mit $\varnothing 4.00\,\text{mm}$ (Radius $2.00\,\text{mm}$, `middle_button_tab_width = 4mm`). Das Zentrum (Druckpunkt) liegt exakt an der **selben Stelle wie vorher** auf der Betätigungsachse des SMD-Tasters des Raspberry Pi 5 bei $Y = -9.60\,\text{mm}$ (`middle_hole_y_offset = -9.6mm`) und $Z = 2.95\,\text{mm}$ (`middle_hole_z_offset = 2.95mm`). Die Höhenposition ist konstant relativ zu `Case_Bottom` (bzw. zur Trennebene $Z = 0$), da der Raspberry Pi 5 auf den Standoffs in `Case_Bottom` aufliegt und seine Lage nicht von `case_middle_height_offset` abhängt.
   - **Vertikaler Verlauf von oben nach unten:**
     - **Biegesteg (Hals / Festkörpergelenk oben):** Befindet sich oben bei $Z \approx 13.95\,\text{mm} \dots 15.95\,\text{mm}$ und verjüngt sich auf $2.00\,\text{mm}$ Breite in $Y$-Richtung (`middle_button_neck_width = 2mm`) über eine vertikale Länge von $2.00\,\text{mm}$ in $Z$-Richtung (`middle_button_neck_length = 2mm`), wo die Lasche oben monolithisch mit der Gehäusewand von `Case_Middle` (bzw. `Case_Main`) verbunden bleibt.
     - **S-förmige Übergangsradien:** Doppelter Verrundungsübergang mit $R = 0.50\,\text{mm}$ (`middle_button_neck_fillet = 0.5mm`) an allen 4 Ecken zur Vermeidung von Kerbspannungen bei wiederholter Tasterbetätigung.
     - **Hebelarm:** Erstreckt sich vom Biegesteg vertikal nach unten über $10.00\,\text{mm}$ Länge (`middle_button_tab_length = 10mm`) bis zum Tastkopf-Zentrum ($Z_c = 2.95\,\text{mm}$).
     - **Unterer Abschluss:** Am unteren Scheitelpunkt des Tastkopfs schließt der Trennschnitt mit einem äußeren Halbkreis ($R_o = 2.30\,\text{mm}$) ab. Der tiefste Punkt des Schlitzes liegt bei $Z = Z_c - R_o = 0.65\,\text{mm}$ und verbleibt somit vollständig und mit Sicherheitsabstand innerhalb von `Case_Middle` oberhalb der Trennebene $Z = 0$.
   - **Kontur-Trennschnitt:** Schnittfuge mit Schnittbreite $w = 0.30\,\text{mm}$ (`middle_button_cut_width = 0.3mm`), optimiert für FDM-3D-Druck (z.B. Bambu Lab P1S/P2S/X1C mit 0.4 mm Düse), um ein Verschmelzen der Wände während des Drucks zu verhindern.

2. **Sicherheitsabstand zur linken Rastnase (Snap-Fit):**
   - Die linke Rastnase an der Steckverbindung zwischen `Case_Bottom` und `Case_Middle` liegt bei $Y = +5.0\,\text{mm}$ (`joint_snap_left_y_offset = 5mm`).
   - Da der Schalter nun vertikal ausgerichtet ist und in $Y$-Richtung nur eine Gesamtbreite von $4.6\,\text{mm}$ ($Y \in [-11.9\,\text{mm}, -7.3\,\text{mm}]$) einnimmt, besteht ein sehr großzügiger Sicherheitsabstand von über $12.3\,\text{mm}$ zwischen Tastkopf und linker Rastnase.

3. **Freistellungs-Ausschnitt mit Verrundungen im Steckkragen von `Case_Bottom`:**
   - Im oberen Steckkragen von `Case_Bottom` ($Z \in [0.0\,\text{mm}, 5.0\,\text{mm}]$) wird hinter dem unteren Betätigungsbereich der Lasche ($Y \in [-12.4\,\text{mm}, -6.8\,\text{mm}]$) eine kompakte, $5.6\,\text{mm}$ breite Aussparung freigeschnitten.
   - **Harmonische Eckverrundungen ($R = 1.2\,\text{mm}$, `collar_button_cutout_fillet = 1.2mm`):**
     - Unten zur horizontalen Trennfläche ($Z = 0$): Weiche konkave Innenradien ($R = 1.2\,\text{mm}$) leiten die vertikalen Schnittkanten kerbspannungsfrei in den Gehäuseboden über.
     - Oben an der Kragenkante ($Z = 5.0\,\text{mm}$): Konvexe Außenradien ($R = 1.2\,\text{mm}$) brechen die oberen 90°-Kanten sauber ab.
   - Die Lasche kann sich dadurch beim Drücken ungehindert ins Gehäuseinnere durchbiegen und den Taster des Raspberry Pi 5 zuverlässig betätigen, ohne mit dem Kragen von `Case_Bottom` zu kollidieren.
4. **Innenliegende Dickenreduzierung der Lasche (flach wie Wand darunter mit 45°-Fase):**
   - **Problemstellung:** Im unteren Gehäusebereich ($Z \le 5.2\,\text{mm}$) besitzt die Innenwand von `Case_Middle` durch den Stufenfalz-Schnitt der Steckverbindung eine Restwandstärke von $1.5\,\text{mm}$ ($X = -4.42\,\text{cm}$). Oberhalb der Stufe ($Z > 5.2\,\text{mm}$) betrug die Wandstärke der Lasche bisher die vollen $3.0\,\text{mm}$ ($X = -4.27\,\text{cm}$). Dadurch sprang die Lasche innen um $1.5\,\text{mm}$ hervor und war für ein federndes Betätigen zu steif.
   - **Flache Geometrie wie die Wand darunter:**
     - Auf der Innenseite der Lasche wird der Bereich oberhalb der Stufe über eine Höhe von $6.00\,\text{mm}$ (`middle_button_inner_recess_height = 6mm`) von $Z = 5.2\,\text{mm}$ bis $Z = 11.2\,\text{mm}$ um $1.5\,\text{mm}$ abgetragen, sodass die Lasche innen exakt in derselben Ebene wie die Stufenwand darunter liegt ($X = -4.42\,\text{cm}$, Restwandstärke $1.5\,\text{mm}$).
     - Die gesamte Innenseite der Lasche verläuft somit von $Z = 0$ bis $Z = 11.2\,\text{mm}$ vollständig bündig, stufenfrei und flach.
   - **45°-Fase am oberen Übergang:**
     - Am oberen Ende der Dickenreduzierung ($Z = 11.2\,\text{mm}$) wird der Übergang zur $3.0\,\text{mm}$ starken Wand über eine Länge von $1.50\,\text{mm}$ (`middle_button_inner_recess_chamfer = 1.5mm`) mit einer $45^\circ$-Fase abgefast.
     - Der Übergang schließt bei $Z = 12.7\,\text{mm}$ sauber an die ungeschwächte $3.0\,\text{mm}$ Gehäusewand vor dem Beginn der Biegesteg-Verjüngung ($Z_1 = 12.95\,\text{mm}$) an.
     - 100 % stützfreier FDM-3D-Druck ohne Bridging und minimale Kerbspannungen durch die $45^\circ$-Schräge.

5. **Taktile kreisrunde Erhebung an der Außenseite der Lasche mit 0.2 mm Fase:**
   - **Erhebung (+0.2 mm nach außen):** Im unteren Kreisbereich der Lasche (Tastkopf) wird an der Außenwand ($X = -45.7\,\text{mm}$) ein zylindrischer Kreis mit $\varnothing 4.00\,\text{mm}$ ($R = 2.00\,\text{mm}$, konzentrisch zum Druckpunkt bei $Y = -9.60\,\text{mm}, Z = 2.95\,\text{mm}$) um $+0.20\,\text{mm}$ (`middle_button_boss_height = 0.2mm`) nach außen extrudiert (`NewBodyFeatureOperation`).
   - **Verschmelzen mit Case_Main vor dem Anfasen (Merge via Combine):** Bevor der Kreis angefast wird, wird der neu entstandene Körper der Erhebung via Combine-Feature (`operation = JoinFeatureOperation`, `isKeepToolBodies = false`) vollständig mit `Case_Main` (bzw. `Case_Middle`) verschmolzen (merge). Dadurch verbleibt kein separater Körper im Modell und die Erhebung ist monolithischer Bestandteil von `Case_Main`.
   - **Umlaufende 0.2 mm Fase:** Erst nach dem Verschmelzen wird die äußere Kreiskante dieser Erhebung an `Case_Main` um $0.20\,\text{mm}$ (`middle_button_boss_chamfer = 0.2mm`) mit einer $45^\circ$-Fase abgefast.
   - **Haptik:** Dadurch entsteht ein sanft bekränzter, haptisch fühlbarer Tastknopf mit einer ebenen Kreisdruckfläche von $\varnothing 3.60\,\text{mm}$, dessen Schräge bündig in die Laschenoberfläche und die Trennfuge übergeht.

---

## 1. Geometrische & Mathematische Analyse

| Parameter / Bezugsmaß | Wert / Formel | Beschreibung |
| :--- | :--- | :--- |
| `middle_button_tab_length` | $10.0\,\text{mm}$ | Vertikale Hebelarmlänge vom Kreiszentrum in $+Z$ nach oben bis zum Beginn der Halsverjüngung |
| `middle_button_tab_width` | $4.0\,\text{mm}$ | Horizontale Breite des Hebelarms (in $Y$) und Tastkopfdurchmesser ($\varnothing 4.00\,\text{mm}$) |
| `middle_button_neck_length` | $2.0\,\text{mm}$ | Vertikale Höhe des Biegestegs in $Z$-Richtung (Hals / Gelenkzone oben) |
| `middle_button_neck_width` | $2.0\,\text{mm}$ | Horizontale Breite des Biegestegs in $Y$-Richtung ($4.0 - 2 \times 1.0\,\text{mm}$) |
| `middle_button_neck_fillet` | $0.5\,\text{mm}$ | Radius der 4 Übergangsradien am Biegesteg ($R = 0.50\,\text{mm}$) |
| `middle_button_cut_width` | $0.3\,\text{mm}$ | Schnittbreite des Trennschlitzes (FDM-optimiert für sauberen Spalt) |
| `middle_button_inner_recess_height` | $6.0\,\text{mm}$ | Höhe der innenliegenden Dickenreduzierung auf $1.5\,\text{mm}$ Restwandstärke oberhalb der Stufe |
| `middle_button_inner_recess_chamfer` | $1.5\,\text{mm}$ | $45^\circ$-Fasenlänge am oberen Übergang von $1.5\,\text{mm}$ auf $3.0\,\text{mm}$ Wandstärke |
| `middle_button_boss_height` | $0.2\,\text{mm}$ | Höhe der kreisrunden taktilen Erhebung an der Außenseite der Lasche |
| `middle_button_boss_chamfer` | $0.2\,\text{mm}$ | $45^\circ$-Fasenbreite an der Kreiskante der äußeren Erhebung |
| `collar_button_cutout_fillet` | $1.2\,\text{mm}$ | Verrundungsradius an den 4 Ecken des Kragenausschnitts in `Case_Bottom` (oben konvex, unten konkav) |
| `middle_hole_y_offset` | $-9.6\,\text{mm}$ | Y-Position des Tastkopf-Zentrums / Druckpunkts auf der linken Seitenwand (unverändert) |
| `middle_hole_z_offset` | $2.95\,\text{mm}$ | Z-Höhe des Tastkopf-Zentrums / Druckpunkts (unverändert, konstant relativ zu `Case_Bottom`) |
| `joint_snap_left_y_offset` | $5.0\,\text{mm}$ | Mittenposition der linken Rastnase auf `Case_Bottom` & `Case_Middle` |
| Kragenausschnitt `Case_Bottom` | $Y \in [-12.4, -6.8]\,\text{mm}$, $Z \in [0.0, 5.0]\,\text{mm}$, $R = 1.2\,\text{mm}$ | Freistellung im Steckkragen von `Case_Bottom` hinter dem Tastkopf mit verrundeten Ecken |
| Hilfsebene (`Plane_Middle_Button_Tab`) | $X = -5.5\,\text{cm}$ | Konstruktionsebene außerhalb der Gehäusewand |
| Hilfsebene (`Plane_Middle_Button_Inner_Recess`) | $Y = -1.175\,\text{cm}$ | Konstruktionsebene parallel zu XZ für den Dickenreduzierungs-Schnitt |
| Hilfsebene (`Plane_Middle_Button_Outer_Boss`) | $X = -4.57\,\text{cm}$ | Konstruktionsebene an der Außenwand für die taktile Erhebung |

---

## 2. Implementierungsdetails

1. **Parameter (`parameters.ts`):**
   - `joint_snap_left_y_offset`: `5mm` (Verschiebung der linken Rastnase nach links / $+Y$ für Kollisionsfreiheit).
   - `middle_button_tab_length`: `10mm` (vertikale Hebelarmlänge nach oben).
   - `middle_button_tab_width`: `4mm` (Hebelarmbreite in $Y$ & Kopfdurchmesser).
   - `middle_button_neck_length`: `2mm` (vertikale Biegesteghöhe).
   - `middle_button_neck_width`: `2mm` (horizontale Biegestegbreite).
   - `middle_button_neck_fillet`: `0.5mm` (Fillet-Radius).
   - `middle_button_cut_width`: `0.3mm` (Schnittbreite / Schlitzspalt).
   - `middle_button_inner_recess_height`: `6mm` (Höhe der innenliegenden Dickenreduzierung).
   - `middle_button_inner_recess_chamfer`: `1.5mm` ($45^\circ$-Fase an der Übergangskante).
   - `middle_button_boss_height`: `0.2mm` (Höhe der äußeren taktilen Erhebung).
   - `middle_button_boss_chamfer`: `0.2mm` (Fasenbreite an der Kreiskante der äußeren Erhebung).
   - `collar_button_cutout_fillet`: `1.2mm` (Verrundungsradius für die Ecken des Kragenausschnitts in `Case_Bottom`).
   - Rückwärtskompatibilität für `middle_hole_diameter`, `middle_hole_y_offset` und `middle_hole_z_offset` bleibt vollständig gewahrt; `middle_hole_z_offset` (bzw. `middle_opening_z_offset`) ist fest auf `2.95mm` definiert (konstant zu `Case_Bottom`, unabhängig von `case_middle_height_offset`).

2. **Steckverbindung (`joint.ts`, Schritt 19):**
   - Die linke Rastwulst auf `Case_Bottom` und die Rastmulde in `Case_Middle` nutzen `leftSnapCenterY = params.jointSnapLeftYOffset.value` ($+5.0\,\text{mm}$).

3. **Geometrieerzeugung (`openings.ts`, Schritt 21b):**
   - `createMiddleButtonTab` (mit Aliase `createMiddleSideHole` & `createMiddleSideOpening`):
     - **Schlitzkontur:** Erzeugt Ebene `Plane_Middle_Button_Tab` bei $X = -5.5\,\text{cm}$. Schneidet die vertikale 20-teilige Schlitzkontur durch `Case_Middle` (bzw. `Case_Main`) mit `CutFeatureOperation` frei.
     - **Innenliegende Dickenreduzierung & Fase:** Erzeugt Ebene `Plane_Middle_Button_Inner_Recess` bei $Y = -1.175\,\text{cm}$. Zeichnet ein 5-teiliges XZ-Polygon mit gerader Wand bei $X = -4.42\,\text{cm}$ ($1.5\,\text{mm}$ Dicke) von $Z = 0$ bis $Z = 11.2\,\text{mm}$ und einer $45^\circ$-Fase von $(X=-4.42, Z=11.2)$ auf $(X=-4.27, Z=12.7)$. Schneidet die Lasche über eine Breite von $4.3\,\text{mm}$ (exakt zwischen den beiden Schnittfugen) auf der Innenseite frei.
     - **Taktile äußere Erhebung mit Fase & Verschmelzung (Merge):** Erzeugt Ebene `Plane_Middle_Button_Outer_Boss` bei $X = -4.57\,\text{cm}$. Extrudiert einen Kreis mit $\varnothing 4.00\,\text{mm}$ am Druckpunkt um $+0.20\,\text{mm}$ nach außen (`NewBodyFeatureOperation`). Verschmilzt (merge) den neu entstandenen Körper ZUERST über ein Combine-Feature (`JoinFeatureOperation`, `isKeepToolBodies = false`) vollständig mit `Case_Main` (bzw. `Case_Middle`), sodass kein separater Restkörper im Modell verbleibt. Erst DANACH wird die äußere Kreiskante an `Case_Main` mit `applyChamferWithFallbacks` um $0.20\,\text{mm}$ abgefast.
     - **Kragenausschnitt:** Schneidet eine kompakte $5.6 \times 5.0\,\text{mm}$ Freistellung im Steckkragen von `Case_Bottom` hinter dem Schalter mit 10-teiligem, verrundetem Schnittprofil frei (`participantBodies = [liveBottom]`, $R = 1.2\,\text{mm}$, konkave Innenradien unten zum Gehäuseboden, konvexe Außenradien oben am Kragenkopf).

4. **Orchestrierung (`case.ts`):**
   - Schritt 21b ruft `createMiddleButtonTab` auf und aktualisiert die BRep-Referenzen von `Case_Middle` (bzw. `Case_Main`) und `Case_Bottom` über `getLiveBody`.
