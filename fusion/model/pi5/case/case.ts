import { adsk } from "@adsk/fusion";
import { setupParameters } from "./parameters";
import {
  getLiveBody,
  stepRefresh,
  hideSketchesAndConstruction,
  isAssemblyConstruction,
  detectAssemblyConstruction
} from "./utils";
import {
  createBaseSketchAndExtrusions,
  shellBodies,
  thickenRightWall,
  filletOuterEdges,
  filletCaseBottomInnerFloorEdges,
  createGrooveFeature,
  filletGrooveEdges
} from "./chassis";
import {
  createAllPortCutouts,
  createFrontPortRecess,
  createLidVentilationSlots,
  createInnerSsdPocket,
  createMiddleButtonTab,
  createMiddleSideHole
} from "./openings";
import { createPi5Standoffs } from "./standoffs";
import { createTongueAndGrooveJoint } from "./joint";
import { splitAndCreateLidJoint } from "./lidJoint";
import { createLedOpeningAndMount } from "./led";
import { applyStressReliefTreatments } from "./stressRelief";
import { createCaseLogo } from "./logo";
import { importAndAlignPi5Board } from "./pi5Board";
import { arrangeBodiesForPrint } from "./printLayout";
import { assignBodyMaterials } from "./materials";

const app = adsk.core.Application.get();
const ui = app ? app.userInterface : null;

/**
 * Haupteinstiegspunkt für das Fusion 360 Skript.
 * Konstruiert das Gehäuse für den Raspberry Pi 5 im Apple-Design der 80er Jahre ("Nutshell Pi"):
 *
 * Schritt 0: Skizze auf XY-Ebene
 * Schritt 1: Rechteck 91.4 mm x 62.4 mm (zentriert, Innenraum 85.4 x 56.4 mm bei 3 mm Wandstärke)
 * Schritt 2: Extrusion nach oben via case_top_height ('40mm + case_middle_height_offset') (oberer Körper: Case_Top)
 * Schritt 3: Extrusion -6.4 mm (unterer Körper: Case_Bottom, neuer Körper)
 * Schritt 4: Oberer Körper: Schale 3 mm an Unterseite
 * Schritt 5: Unterer Körper: Schale 3 mm an Oberseite
 * Schritt 5b: Rechte Gehäusewand (+X, Port-Wand) um 1 mm nach außen verstärken (p024, Wandstärke neu 4 mm; Innenhohlraum bleibt exakt erhalten, Gesamtlänge 92.4 mm)
 * Schritt 6 & 7: Je 8 Außenkanten mit Radius 2 mm verrunden
 * Schritt 7b: Verrundung der Kanten auf der inneren Grundfläche von Case_Bottom parallel zur XY-Ebene für FDM-Druck (1.0 mm, p027)
 * Schritt 8–14: Umlaufende Fuge / Sims auf Hilfsebene bei -8 mm (-2.5 mm Schnitt, 1 mm Eckenverrundung; entfällt bei merge_top_and_middle = 1 für glatte Außenwand, p025)
 * Schritt 15: Öffnungen für Pi5-Anschlüsse (Front, Rechts; linke Wand geschlossen)
 * Schritt 16: Vertiefung an der Gehäusefront für Anschlüsse (-1.5 mm Schnitt, R3 mm Verrundung)
 * Schritt 17: Lüftungsschlitze im Deckel (6 Schlitze gleichverteilt, 80x2.5 mm, -4 mm Schnitt mit 25° Verjüngung)
 * Schritt 18: 4 Befestigungssäulen auf Gehäuseboden-Innenseite mit M2.5-Innengewinde (Ø 6 mm, H 5 mm, ISO Metric Profile M2.5x0.45 6H)
 * Schritt 19: Stabile Stufenfalz-Steckverbindung (5 mm Kragentiefe & 0.5 mm Mini-Fase analog Case_Middle/Case_Top) mit L-Winkel-Ecken (Back-Left, Back-Right, Front-Right; Front-Left massiv geschlossen zum Schutz der Front-Vertiefung) & 4 Rastnasen (2x Rückwand ecknah, 1x linke Wand, 1x Frontwand rechts) zwischen Case_Bottom und Case_Middle/Case_Main
 * Schritt 20: Horizontale Trennung von Case_Top am unteren Fugenende (Z = lid_split_z, nominal 29.5 mm + case_middle_height_offset) in Case_Top & Case_Middle mit 5 mm Stufenfalz & 4 Rastnasen (entfällt bei merge_top_and_middle = 1; es entsteht stattdessen der durchgehende monolithische Körper Case_Main, p025)
 * Schritt 21: Rechteckige LED-Öffnung (5.2x2.2 mm) und innenliegende LED-Halterung in Case_Top (entfällt bei merge_top_and_middle = 1, p025)
 * Schritt 21b: Integrierter Druckschalter (Lasche Ø 4mm, L 10mm, Hals 2x2mm, R0.5mm) in Case_Middle/Case_Main & Kragenausschnitt in Case_Bottom (p028)
 * Schritt 22: Spannungsreduzierende Fasen & Verrundungen an nicht-sichtbaren 90°-Innenkanten (enable_stress_relief_fillets, R = 1.0 mm)
 * Schritt 23: Logo & Passvertiefung (Mulde) an der linken Seitenwand von Case_Middle/Case_Main (+0.2 mm Spiel, 0.5 mm Logo-Dicke, 'Logo', Z = logo_pos_z zentriert)
 * Schritt 24: Import und Ausrichtung des Raspberry Pi 5 STEP-Referenzmodells auf den 4 Standoffs (import_pi5_board)
 * Schritt 25: FDM-Druckanordnung (layout_for_print): Stützfreie Aufreihung der druckbaren Bauteile (Case_Main bzw. Case_Top/Case_Middle, Case_Bottom, Logo) auf der XY-Ebene (Z = 0) entlang der Y-Achse
 * Schritt 26: Zuweisung von Material und Erscheinungsbild (assignBodyMaterials): Case_Main bzw. Case_Top, Case_Middle, Case_Bottom in ABS weiss; Logo in Kunststoff schwarz (enable_materials)
 */
export function run(_context: string): void {
  try {
    if (!app || !ui) {
      return;
    }

    const design = app.activeProduct as adsk.fusion.Design;
    if (!design) {
      ui.messageBox("Bitte öffnen Sie ein aktives Konstruktionsdokument (Design).");
      return;
    }

    const rootComp = design.rootComponent;

    // -----------------------------------------------------------------
    // 1. Parameter initialisieren
    // -----------------------------------------------------------------
    const detection = detectAssemblyConstruction(design);
    const contextStr = detection.isAssembly ? "Baugruppenkonstruktion" : "Einzelteilkonstruktion";
    console.log(
      `Schritt 1: Initialisiere Parameter (Kontext: ${contextStr}, Grund: ${detection.reason})...`
    );
    const params = setupParameters(design);
    const isMerged = Math.round(params.mergeTopAndMiddle.value) === 1;
    console.log(
      `Schritt 1: Parameter initialisiert (merge_top_and_middle = ${isMerged ? "1" : "0"}, import_pi5_board = ${Math.round(params.importPi5Board.value)} [Default: ${detection.isAssembly ? "1" : "0"}], Favoriten: case_middle_height_offset, create_logo, layout_for_print).`
    );

    // -----------------------------------------------------------------
    // 2. Schritte 0–3: Basisskizze und Primärextrusionen (+40 mm / -6.4 mm)
    // -----------------------------------------------------------------
    const offsetMm = params.caseMiddleHeightOffset.value * 10;
    const topHeightMm = params.caseTopHeight.value * 10;
    const bottomHeightMm = params.caseBottomHeight.value * 10;
    console.log(`Schritte 0–3: Erstelle Basisskizze (91.4x62.4mm) und Extrusionen (+${topHeightMm.toFixed(1)}mm / -${bottomHeightMm.toFixed(1)}mm, Höhenversatz: ${offsetMm >= 0 ? '+' : ''}${offsetMm.toFixed(1)}mm)...`);
    let { topBody, bottomBody } = createBaseSketchAndExtrusions(rootComp, params);
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 3. Schritte 4–5: Schalenbildung mit 3 mm Wandstärke
    // -----------------------------------------------------------------
    console.log("Schritte 4–5: Erzeuge Schalen (3 mm Wandstärke) an Ober- und Unterkörper...");
    const shelled = shellBodies(rootComp, topBody, bottomBody, params);
    topBody = shelled.topBody;
    bottomBody = shelled.bottomBody;
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 3b. Schritt 5b: Rechte Gehäusewand (+X) um 1 mm verstärken (p024)
    // -----------------------------------------------------------------
    const extraThickMm = params.caseRightWallExtraThickness.value * 10;
    console.log(
      `Schritt 5b: Verstärke die rechte Gehäusewand (+X) um ${extraThickMm.toFixed(1)} mm (Wandstärke neu: 4.0 mm, p024)...`
    );
    const thickened = thickenRightWall(rootComp, topBody, bottomBody, params);
    topBody = thickened.topBody;
    bottomBody = thickened.bottomBody;
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 4. Schritte 6–7: Verrundung von je 8 Außenkanten (Radius 2 mm)
    // -----------------------------------------------------------------
    console.log("Schritte 6–7: Verrunde je 8 Außenkanten mit Radius 2 mm...");
    const filleted = filletOuterEdges(rootComp, topBody, bottomBody, params);
    topBody = filleted.topBody;
    bottomBody = filleted.bottomBody;
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 4b. Schritt 7b: Verrundung der inneren Bodenkanten von Case_Bottom (parallel zur XY-Ebene, p027)
    // -----------------------------------------------------------------
    const innerFloorFilletMm = params.caseBottomInnerFilletRadius.value * 10;
    console.log(
      `Schritt 7b: Verrunde innere Kanten auf der Grundfläche von Case_Bottom (${innerFloorFilletMm.toFixed(1)} mm, parallel zur XY-Ebene für FDM-Druck, p027)...`
    );
    bottomBody = filletCaseBottomInnerFloorEdges(rootComp, bottomBody, params);
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 5. Schritte 8, 10–14: Umlaufende Fuge / Sims auf Hilfsebene bei -8 mm
    //    (wird bei merge_top_and_middle = 1 übersprungen, p025)
    // -----------------------------------------------------------------
    if (!isMerged) {
      console.log("Schritte 8, 10–13: Erzeuge Hilfsebene bei -8 mm und schneide umlaufende Fuge (-2.5 mm)...");
      topBody = createGrooveFeature(rootComp, topBody, params);
      stepRefresh(app, true);

      console.log("Schritt 14: Verrunde 4 senkrechte Fugen-Innenkanten mit 1 mm...");
      topBody = filletGrooveEdges(rootComp, topBody, params);
      stepRefresh(app, true);
    } else {
      console.log("Schritte 8, 10–14 übersprungen: Glatte Außenwand ohne Sims/Fuge (merge_top_and_middle = 1, p025)...");
    }

    // -----------------------------------------------------------------
    // 8. Anschlüsse Raspberry Pi 5 ausschneiden (Front, Rechts)
    // -----------------------------------------------------------------
    const ssdMergedStr = Math.round(params.portEthUsb3Merged.value) === 1
      ? " [gestufter RJ45/USB3-Ausschnitt für Geekworm X1001]"
      : "";
    console.log(`Schritt 15: Schneide Öffnungen für Pi5-Anschlüsse (Front, Rechts; linke Wand geschlossen)${ssdMergedStr}...`);
    const portCut = createAllPortCutouts(rootComp, topBody, bottomBody, params);
    topBody = portCut.topBody;
    bottomBody = portCut.bottomBody;
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 9. Vertiefung an der Gehäusefront für die Anschlüsse ausschneiden
    // -----------------------------------------------------------------
    console.log("Schritt 16: Schneide Vertiefung für Front-Anschlüsse (USB-C & Micro-HDMI)...");
    const recessCut = createFrontPortRecess(rootComp, topBody, bottomBody, params);
    topBody = recessCut.topBody;
    bottomBody = recessCut.bottomBody;
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 10. Schritt 17: Lüftungsschlitze im Deckel ausschneiden
    // -----------------------------------------------------------------
    console.log("Schritt 17: Schneide Lüftungsschlitze im Deckel (6 Schlitze gleichverteilt, 80x2.5mm, -4mm Schnitt, 25° Verjüngung)...");
    topBody = createLidVentilationSlots(rootComp, topBody, params);
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 11. Schritt 18: 4 Befestigungssäulen auf Gehäuseboden-Innenseite
    // -----------------------------------------------------------------
    const standoffHMm = params.standoffHeight.value * 10;
    const floorDepthMm = params.standoffFloorDepth.value * 10;
    console.log(
      `Schritt 18: Erzeuge 4 Befestigungssäulen auf Gehäuseboden-Innenseite mit M2.5-Innengewinde (Ø 6mm, H ${standoffHMm.toFixed(1)}mm, Kernloch Ø 2.05mm, Gewindetiefe ${(standoffHMm + floorDepthMm).toFixed(1)}mm [inkl. ${floorDepthMm.toFixed(1)}mm im Boden])...`
    );
    bottomBody = createPi5Standoffs(rootComp, bottomBody, params);
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 12. Schritt 19: Stabile Stufenfalz-Steckverbindung mit Einrastfunktion
    // -----------------------------------------------------------------
    console.log("Schritt 19: Erzeuge stabile Stufenfalz-Steckverbindung (5 mm Kragentiefe & 0.5 mm Mini-Fase) mit L-Winkel-Ecken (Front-Left massiv für Front-Vertiefung) & 4 Rastnasen (2x Rückwand ecknah, 1x Linke Wand, 1x Frontwand)...");
    const jointBodies = createTongueAndGrooveJoint(rootComp, topBody, bottomBody, params);
    topBody = jointBodies.topBody;
    bottomBody = jointBodies.bottomBody;
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 13. Schritt 20: Deckeltrennung bzw. Weiterführung als monolithischer Case_Main
    // -----------------------------------------------------------------
    let middleBody: adsk.fusion.BRepBody | undefined = undefined;
    let mainBody: adsk.fusion.BRepBody | undefined = undefined;

    if (!isMerged) {
      const splitZMm = params.lidSplitZ.value * 10;
      console.log(`Schritt 20: Trenne Case_Top am unteren Ende der Einkerbung (Z = ${splitZMm.toFixed(1)}mm) in Case_Top und Case_Middle mit 5 mm Stufenfalz, Mini-Fase, 45°-Fasen (p022, 4 plane Ecken) & 4 Rastnasen (2x Rückwand ecknah, 1x linke Wand, 1x Frontwand rechts)...`);
      const lidResult = splitAndCreateLidJoint(rootComp, topBody, params);
      topBody = lidResult.topBody;
      middleBody = lidResult.middleBody;
      stepRefresh(app, true);
    } else {
      console.log("Schritt 20 übersprungen: Deckel und Mittelteil werden nicht getrennt (merge_top_and_middle = 1, Körper: Case_Main)...");
      topBody = getLiveBody(rootComp, topBody, "Case_Top");
      topBody.name = "Case_Main";
      mainBody = topBody;
      stepRefresh(app, true);
    }

    // -----------------------------------------------------------------
    // Schritt 20b / p018: Innere Aussparung (Tasche) für die Geekworm X1001 SSD-Halterung
    //                     Schneidet Case_Middle & Case_Top bzw. Case_Main aus (doc/prompt/p018/img_10.png)
    // -----------------------------------------------------------------
    if (Math.round(params.portEthUsb3Merged.value) === 1) {
      console.log(
        `Schritt 20b: Schneide innere SSD-Tasche (${(params.ssdPocketHeight.value * 10).toFixed(1)}mm Höhe, ${(params.ssdPocketDepth.value * 10).toFixed(1)}mm Tiefe) in ${isMerged ? "Case_Main" : "Case_Middle und Case_Top"}...`
      );
      if (isMerged && mainBody) {
        const pocketResult = createInnerSsdPocket(rootComp, mainBody, mainBody, params);
        mainBody = pocketResult.middleBody;
      } else if (middleBody) {
        const pocketResult = createInnerSsdPocket(rootComp, middleBody, topBody, params);
        middleBody = pocketResult.middleBody;
        topBody = pocketResult.topBody;
      }
      stepRefresh(app, true);
    }

    // -----------------------------------------------------------------
    // 14. Schritt 21: Rechteckige LED-Öffnung und Halterung
    //     (wird bei merge_top_and_middle = 1 übersprungen, p025)
    // -----------------------------------------------------------------
    if (!isMerged) {
      console.log("Schritt 21: Erzeuge rechteckige LED-Öffnung (5.2x2.2mm) und Halterung in Case_Top...");
      topBody = createLedOpeningAndMount(rootComp, topBody, params);
      stepRefresh(app, true);
    } else {
      console.log("Schritt 21 übersprungen: Keine LED-Öffnung und Halterung (merge_top_and_middle = 1, p025)...");
    }

    // -----------------------------------------------------------------
    // 14b. Schritt 21b / p028: Integrierter Druckschalter (Lasche) in Case_Middle bzw. Case_Main & Kragenausschnitt in Case_Bottom
    // -----------------------------------------------------------------
    console.log(
      `Schritt 21b: Erzeuge integrierten Druckschalter (Lasche Ø4mm, L 10mm, Hals 2x2mm, R0.5mm, vertikal von oben nach unten, p028) in ${isMerged ? "Case_Main" : "Case_Middle"} und Kragenausschnitt in Case_Bottom...`
    );
    const targetUpperForHole = isMerged ? mainBody! : middleBody!;
    const middleCut = createMiddleButtonTab(rootComp, targetUpperForHole, bottomBody, params);
    if (isMerged) {
      mainBody = middleCut.middleBody;
    } else {
      middleBody = middleCut.middleBody;
    }
    bottomBody = middleCut.bottomBody;
    stepRefresh(app, true);


    // -----------------------------------------------------------------
    // 15. Schritt 22: Spannungsreduzierende Fasen & Verrundungen an Innenkanten
    // -----------------------------------------------------------------
    console.log("Schritt 22: Wende spannungsreduzierende Verrundungen an nicht-sichtbaren Innenkanten an (enable_stress_relief_fillets)...");
    const stressResult = applyStressReliefTreatments(
      rootComp,
      isMerged
        ? {
            bottom: bottomBody,
            main: mainBody!
          }
        : {
            top: topBody,
            middle: middleBody!,
            bottom: bottomBody
          },
      params
    );
    if (isMerged) {
      mainBody = stressResult.main!;
      bottomBody = stressResult.bottom;
    } else {
      topBody = stressResult.top!;
      middleBody = stressResult.middle!;
      bottomBody = stressResult.bottom;
    }
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 16. Schritt 23: Logo & Passvertiefung (Mulde) an linker Seitenwand
    // -----------------------------------------------------------------
    let logoBody: adsk.fusion.BRepBody | undefined = undefined;
    if (Math.round(params.createLogo.value) === 1) {
      console.log("Schritt 23: Schneide Logo-Mulde (+0.2mm Spiel) und erzeuge Logo-Körper (0.5mm Dicke)...");
      const targetUpperForLogo = isMerged ? mainBody! : middleBody!;
      const logoResult = createCaseLogo(rootComp, targetUpperForLogo, params, bottomBody);
      if (isMerged) {
        mainBody = logoResult.middleBody;
      } else {
        middleBody = logoResult.middleBody;
      }
      if (logoResult.bottomBody) {
        bottomBody = logoResult.bottomBody;
      }
      logoBody = logoResult.logoBody;
      stepRefresh(app, true);
    } else {
      console.log("Schritt 23: Logo-Erstellung ist deaktiviert (create_logo = 0).");
    }

    // -----------------------------------------------------------------
    // 17. Schritt 24: Raspberry Pi 5 Referenzmodell importieren & ausrichten
    // -----------------------------------------------------------------
    console.log(
      `Schritt 24: Raspberry Pi 5 Referenzmodell prüfen (import_pi5_board = ${Math.round(params.importPi5Board.value)}, Kontext: ${contextStr})...`
    );
    importAndAlignPi5Board(rootComp, params);
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 18. Schritt 25: FDM-Druckanordnung (layout_for_print)
    // -----------------------------------------------------------------
    console.log("Schritt 25: FDM-Druckanordnung prüfen und anwenden (layout_for_print)...");
    const printResult = arrangeBodiesForPrint(
      rootComp,
      isMerged
        ? {
            main: mainBody!,
            bottom: bottomBody,
            logo: logoBody
          }
        : {
            top: topBody,
            middle: middleBody!,
            bottom: bottomBody,
            logo: logoBody
          },
      params
    );
    if (isMerged) {
      mainBody = printResult.main || mainBody;
      bottomBody = printResult.bottom;
    } else {
      topBody = printResult.top || topBody;
      middleBody = printResult.middle || middleBody;
      bottomBody = printResult.bottom;
    }
    if (printResult.logo) {
      logoBody = printResult.logo;
    }
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 19. Schritt 26: Material- und Erscheinungsbildzuweisung (enable_materials)
    //     - 'Case_Main' bzw. 'Case_Top', 'Case_Middle', 'Case_Bottom': ABS weiss
    //     - 'Logo': Kunststoff schwarz
    // -----------------------------------------------------------------
    console.log("Schritt 26: Zuweisung von Material und Erscheinungsbild ausführen (assignBodyMaterials)...");
    assignBodyMaterials(
      rootComp,
      params,
      isMerged
        ? {
            main: mainBody!,
            bottom: bottomBody,
            logo: logoBody
          }
        : {
            top: topBody,
            middle: middleBody!,
            bottom: bottomBody,
            logo: logoBody
          }
    );
    stepRefresh(app, true);

    // -----------------------------------------------------------------
    // 20. Schritt 27: Abschluss, Hilfsgeometrien ausblenden & Live-Referenzbestätigung
    // -----------------------------------------------------------------
    hideSketchesAndConstruction(rootComp);
    stepRefresh(app, true);

    if (isMerged && mainBody) {
      mainBody = getLiveBody(rootComp, mainBody, "Case_Main");
      bottomBody = getLiveBody(rootComp, bottomBody, "Case_Bottom");
      mainBody.name = "Case_Main";
      bottomBody.name = "Case_Bottom";

      if (logoBody) {
        logoBody = getLiveBody(rootComp, logoBody, "Logo");
        logoBody.name = "Logo";
      }

      const logoMsg = logoBody ? `, ${logoBody.name} (Logo)` : "";
      console.log(
        `Raspberry Pi 5 Gehäuse erfolgreich generiert: ${mainBody.name} (Hauptgehäuse), ${bottomBody.name} (Boden)${logoMsg}.`
      );
    } else {
      topBody = getLiveBody(rootComp, topBody, "Case_Top");
      middleBody = getLiveBody(rootComp, middleBody!, "Case_Middle");
      bottomBody = getLiveBody(rootComp, bottomBody, "Case_Bottom");
      topBody.name = "Case_Top";
      middleBody.name = "Case_Middle";
      bottomBody.name = "Case_Bottom";

      if (logoBody) {
        logoBody = getLiveBody(rootComp, logoBody, "Logo");
        logoBody.name = "Logo";
      }

      const logoMsg = logoBody ? `, ${logoBody.name} (Logo)` : "";
      console.log(
        `Raspberry Pi 5 Gehäuse erfolgreich generiert: ${topBody.name} (Deckel), ${middleBody.name} (Mittelteil), ${bottomBody.name} (Boden)${logoMsg}.`
      );
    }
  } catch (e) {
    console.error(`Fehler bei der Ausführung des Skripts: ${e}`);
    if (ui) {
      ui.messageBox(`Kritischer Fehler beim Ausführen des Skripts:\n${e}`);
    }
  }
}
