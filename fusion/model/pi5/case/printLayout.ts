import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import { createCollection, getLiveBody } from "./utils";

export interface PrintableBodiesInput {
  top?: adsk.fusion.BRepBody;
  middle?: adsk.fusion.BRepBody;
  bottom: adsk.fusion.BRepBody;
  main?: adsk.fusion.BRepBody;
  logo?: adsk.fusion.BRepBody;
}

export interface PrintableBodiesResult {
  top?: adsk.fusion.BRepBody;
  middle?: adsk.fusion.BRepBody;
  bottom: adsk.fusion.BRepBody;
  main?: adsk.fusion.BRepBody;
  logo?: adsk.fusion.BRepBody;
}

/**
 * Ordnet alle druckbaren Gehäusekörper des Raspberry Pi 5 für den FDM-Druck
 * nebeneinander auf der XY-Ebene entlang der Y-Achse an.
 * Gesteuert über den booleschen Parameter layout_for_print (0 = Normalzustand montiert, 1 = Druckanordnung).
 *
 * Ausrichtungsstrategie zur Vermeidung von Stützstrukturen an Sichtflächen (AGENTS.md §4.11 & §2.3):
 * 1. Case_Top / Case_Main:
 *    - Rotation: 180° um die X-Achse (Kopfüber / Upside-Down).
 *    - Auflage: Die ebene Gehäusedeckelfläche bei Z=40mm liegt plan auf dem Druckbett (Z=0).
 *    - Wirkung: Der Steckkragen bzw. die Gehäuseinnenwand wächst vertikal nach oben.
 *      Die Lüftungsschlitze (25° Verjüngung) drucken 100% stützfrei.
 * 2. Case_Middle:
 *    - Rotation: 180° um die X-Achse (oben und unten vertauscht / Kopfüber).
 *    - Auflage: Obere Trennfläche bei Z=29.5mm liegt auf dem Druckbett (Z=0).
 *    - Wirkung: Untere Steckverbindung zum Boden zeigt nach oben (+Z).
 * 3. Case_Bottom:
 *    - Rotation: Keine (0°).
 *    - Auflage: Große ebene Gehäuseunterseite (Z=-6.4mm) liegt vollflächig auf dem Druckbett (Z=0).
 *    - Wirkung: 4 Standoffs mit M2.5-Innengewinde und die Rastfeder wachsen stützfrei nach oben.
 * 4. Referenzkörper (z. B. importierte Pi 5 Platine):
 *    - Werden bei aktivierter Druckanordnung automatisch ausgeblendet (isLightBulbOn = false).
 */
export function arrangeBodiesForPrint(
  comp: adsk.fusion.Component,
  bodies: PrintableBodiesInput,
  params: Params
): PrintableBodiesResult {
  const isEnabled = Math.round(params.layoutForPrint.value) === 1;

  // Sichtbarkeit von Referenzkörpern ermitteln und anpassen
  const knownCaseNames = ["Case_Top", "Case_Middle", "Case_Bottom", "Case_Main", "Logo"];
  for (let i = 0; i < comp.bRepBodies.count; i++) {
    try {
      const b = comp.bRepBodies.item(i);
      if (b && b.isValid && !knownCaseNames.includes(b.name)) {
        b.isLightBulbOn = !isEnabled;
      }
    } catch (_e) { }
  }

  // Sichtbarkeit von Referenz-Occurrences (z. B. Raspberry_Pi_5) anpassen
  for (let i = 0; i < comp.occurrences.count; i++) {
    try {
      const occ = comp.occurrences.item(i);
      if (occ && occ.isValid) {
        occ.isLightBulbOn = !isEnabled;
      }
    } catch (_e) { }
  }

  if (!isEnabled) {
    console.log("Druckanordnung ist deaktiviert (layout_for_print = 0). Alle Körper verbleiben im Montagezustand.");
    return {
      top: bodies.top ? getLiveBody(comp, bodies.top, "Case_Top") : undefined,
      middle: bodies.middle ? getLiveBody(comp, bodies.middle, "Case_Middle") : undefined,
      bottom: getLiveBody(comp, bodies.bottom, "Case_Bottom"),
      main: bodies.main ? getLiveBody(comp, bodies.main, "Case_Main") : undefined,
      logo: bodies.logo ? getLiveBody(comp, bodies.logo, "Logo") : undefined
    };
  }

  console.log("FDM-Druckanordnung wird ausgeführt (layout_for_print = 1)...");

  const moveFeatures = comp.features.moveFeatures;
  const spacingCm = params.printLayoutSpacing.value; // z.B. 2.0 cm (20mm)

  let currentY = 0.0;
  const resultBodies: Record<string, adsk.fusion.BRepBody> = {};

  /** Hilfsfunktion: Dreht einen Körper und platziert ihn an currentY zentriert auf Z=0 */
  function alignAndPlaceBody(
    body: adsk.fusion.BRepBody,
    targetName: string,
    rotAxis: "x" | "y" | "z" | "none",
    rotAngleRad: number
  ): { liveBody: adsk.fusion.BRepBody; yDim: number } {
    let live = getLiveBody(comp, body, targetName);
    try {
      live.name = targetName;
    } catch (_e) { }

    // 1. Rotation ausführen (falls erforderlich)
    if (rotAxis !== "none" && Math.abs(rotAngleRad) > 1e-4) {
      const box = live.boundingBox;
      const centerPt = adsk.core.Point3D.create(
        (box.minPoint.x + box.maxPoint.x) / 2.0,
        (box.minPoint.y + box.maxPoint.y) / 2.0,
        (box.minPoint.z + box.maxPoint.z) / 2.0
      );

      let axisVec: adsk.core.Vector3D;
      if (rotAxis === "x") axisVec = adsk.core.Vector3D.create(1, 0, 0);
      else if (rotAxis === "y") axisVec = adsk.core.Vector3D.create(0, 1, 0);
      else axisVec = adsk.core.Vector3D.create(0, 0, 1);

      const rotTransform = adsk.core.Matrix3D.create();
      rotTransform.setToRotation(rotAngleRad, axisVec, centerPt);

      const rotInput = moveFeatures.createInput2(createCollection(live));
      if (rotInput) {
        rotInput.defineAsFreeMove(rotTransform);
        moveFeatures.add(rotInput);
      }

      live = getLiveBody(comp, live, targetName);
    }

    // 2. Ausgerichtete Bounding Box ermitteln & an currentY auf Z=0 platzieren
    const box = live.boundingBox;
    const deltaX = -(box.minPoint.x + box.maxPoint.x) / 2.0; // In X auf 0 zentrieren
    const deltaY = currentY - box.minPoint.y; // In Y am aktuellen Layout-Fortschritt anlegen
    const deltaZ = -box.minPoint.z; // In Z exakt auf Z=0 (XY-Druckbett) nivellieren

    if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001 || Math.abs(deltaZ) > 0.001) {
      const transTransform = adsk.core.Matrix3D.create();
      transTransform.translation = adsk.core.Vector3D.create(deltaX, deltaY, deltaZ);

      const transInput = moveFeatures.createInput2(createCollection(live));
      if (transInput) {
        transInput.defineAsFreeMove(transTransform);
        moveFeatures.add(transInput);
      }

      live = getLiveBody(comp, live, targetName);
    }

    try {
      live.name = targetName;
    } catch (_e) { }

    const yDim = live.boundingBox.maxPoint.y - live.boundingBox.minPoint.y;
    return { liveBody: live, yDim };
  }

  // -------------------------------------------------------------------
  // 1. Case_Main (p025 Merged-Modus): 180° um X drehen (Deckeloberseite Z=40mm liegt auf Z=0)
  // -------------------------------------------------------------------
  if (bodies.main) {
    try {
      const { liveBody: placedMain, yDim: mainYDim } = alignAndPlaceBody(
        bodies.main,
        "Case_Main",
        "x",
        Math.PI
      );
      resultBodies.main = placedMain;
      currentY += mainYDim + spacingCm;
    } catch (e) {
      console.warn(`Druckanordnung für Case_Main fehlgeschlagen: ${e}`);
      resultBodies.main = getLiveBody(comp, bodies.main, "Case_Main");
    }
  } else {
    // -------------------------------------------------------------------
    // 1b. Case_Top: 180° um X drehen (Deckeloberseite Z=40mm liegt auf Z=0)
    // -------------------------------------------------------------------
    if (bodies.top) {
      try {
        const { liveBody: placedTop, yDim: topYDim } = alignAndPlaceBody(
          bodies.top,
          "Case_Top",
          "x",
          Math.PI
        );
        resultBodies.top = placedTop;
        currentY += topYDim + spacingCm;
      } catch (e) {
        console.warn(`Druckanordnung für Case_Top fehlgeschlagen: ${e}`);
        resultBodies.top = getLiveBody(comp, bodies.top, "Case_Top");
      }
    }

    // -------------------------------------------------------------------
    // 2. Case_Middle: 180° um X drehen (oben und unten vertauscht)
    // -------------------------------------------------------------------
    if (bodies.middle) {
      try {
        const { liveBody: placedMiddle, yDim: midYDim } = alignAndPlaceBody(
          bodies.middle,
          "Case_Middle",
          "x",
          Math.PI
        );
        resultBodies.middle = placedMiddle;
        currentY += midYDim + spacingCm;
      } catch (e) {
        console.warn(`Druckanordnung für Case_Middle fehlgeschlagen: ${e}`);
        resultBodies.middle = getLiveBody(comp, bodies.middle, "Case_Middle");
      }
    }
  }

  // -------------------------------------------------------------------
  // 3. Case_Bottom: Keine Drehung (ebene Unterseite Z=-6.4mm liegt auf Z=0)
  // -------------------------------------------------------------------
  try {
    const { liveBody: placedBottom, yDim: botYDim } = alignAndPlaceBody(
      bodies.bottom,
      "Case_Bottom",
      "none",
      0
    );
    resultBodies.bottom = placedBottom;
    currentY += botYDim + spacingCm;
  } catch (e) {
    console.warn(`Druckanordnung für Case_Bottom fehlgeschlagen: ${e}`);
    resultBodies.bottom = getLiveBody(comp, bodies.bottom, "Case_Bottom");
  }

  // -------------------------------------------------------------------
  // 4. Logo: 90° um Y drehen (Flache 0.5mm Logo-Rückseite liegt auf Z=0)
  // -------------------------------------------------------------------
  if (bodies.logo) {
    try {
      const { liveBody: placedLogo, yDim: logoYDim } = alignAndPlaceBody(
        bodies.logo,
        "Logo",
        "y",
        Math.PI / 2
      );
      resultBodies.logo = placedLogo;
      currentY += logoYDim + spacingCm;
    } catch (e) {
      console.warn(`Druckanordnung für Logo fehlgeschlagen: ${e}`);
      resultBodies.logo = getLiveBody(comp, bodies.logo, "Logo");
    }
  }

  return {
    top: resultBodies.top,
    middle: resultBodies.middle,
    bottom: resultBodies.bottom,
    main: resultBodies.main,
    logo: resultBodies.logo
  };
}
