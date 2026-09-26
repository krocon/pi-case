import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import {
  createOffsetPlane,
  applyChamferWithFallbacks,
  getLiveBody,
  drawRectOnXZ,
  drawRectOnYZ
} from "./utils";

export interface LidJointResult {
  topBody: adsk.fusion.BRepBody;
  middleBody: adsk.fusion.BRepBody;
}

/**
 * Sucht eine horizontale, ebene Fläche auf einem Körper anhand eines Ziel-Z-Wertes und Normalen-Richtung.
 */
function findHorizontalPlanarFaceWithNormal(
  body: adsk.fusion.BRepBody,
  targetZ: number,
  expectedNormalZ: number, // z. B. -1 für nach unten schauend, +1 für nach oben
  tolZ: number = 0.15
): adsk.fusion.BRepFace | null {
  let bestFace: adsk.fusion.BRepFace | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < body.faces.count; i++) {
    const f = body.faces.item(i);
    if (!f || !f.isValid) continue;
    if (f.geometry.surfaceType !== adsk.core.SurfaceTypes.PlaneSurfaceType) continue;

    const plane = f.geometry as adsk.core.Plane;
    if (Math.abs(plane.normal.z) < 0.8) continue;

    // Vorzeichen der Z-Normale prüfen
    if (Math.sign(plane.normal.z) !== Math.sign(expectedNormalZ)) continue;

    const dist = Math.abs(f.centroid.z - targetZ);
    if (dist < tolZ && dist < bestDist) {
      bestDist = dist;
      bestFace = f;
    }
  }

  return bestFace;
}

/**
 * Schritt 20d2 (prompt/p022):
 * Erzeugt 45°-Schrägen an der horizontalen Auflagefläche (Stufenfalz bei Z = lid_split_z - lid_joint_depth)
 * zwischen Case_Middle und Case_Top:
 * 1) Case_Middle: 45°-Rampen (1.5 x 1.5 mm) an den 4 Wänden via JoinFeatureOperation
 *    -> Beim FDM-Druck kopfüber (180° um X gedreht) zu 100 % stützfreier 45°-Überhang!
 * 2) Case_Top: Korrespondierender 45°-Schnitt an der Unterkante des Steckkragens via CutFeatureOperation
 * 3) Die 4 Ecken (Back-Left, Back-Right, Front-Left, Front-Right) verbleiben auf einer Länge von
 *    je 5.0 mm horizontal plan, damit Case_Top definiert und rechtwinklig aufliegt.
 */
function applyLidJointShelfChamfers(
  rootComp: adsk.fusion.Component,
  upperBody: adsk.fusion.BRepBody,
  middleBody: adsk.fusion.BRepBody,
  params: Params
): { topBody: adsk.fusion.BRepBody; middleBody: adsk.fusion.BRepBody } {
  console.log("applyLidJointShelfChamfers: Erzeuge 45°-Fasen an der Auflagefläche für stützfreien FDM-Druck (p022)...");

  const sketches = rootComp.sketches;
  const extrudes = rootComp.features.extrudeFeatures;

  const splitZCm = params.lidSplitZ.value; // z.B. 2.95 cm
  const depthCm = params.lidJointDepth.value; // 0.5 cm
  const shelfZCm = splitZCm - depthCm; // 2.45 cm (Auflage-Niveau)

  const nominalHalfWCm =
    (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 +
    params.shellThickness.value; // 4.57 cm
  const extraThickCm = params.caseRightWallExtraThickness
    ? params.caseRightWallExtraThickness.value
    : 0.1; // 1.0 mm in cm
  const outerRightXCm = nominalHalfWCm + extraThickCm; // +4.67 cm

  const halfDCm = params.caseDepth.value / 2.0; // 3.12 cm
  const shellThickCm = params.shellThickness.value; // 0.3 cm
  const innerXCm = nominalHalfWCm - shellThickCm; // 4.27 cm
  const innerYCm = halfDCm - shellThickCm; // 2.82 cm

  const insetCm = params.grooveInset.value; // 0.15 cm
  const lipLeftXCm = -(nominalHalfWCm - insetCm); // -4.42 cm
  const lipRightXCm = outerRightXCm - insetCm; // +4.52 cm
  const lipYCm = halfDCm - insetCm; // 2.97 cm

  // Fasenbreite & -höhe bei 45°
  const chamferWidthCm = params.lidJointShelfChamfer.value; // 0.15 cm (1.5 mm)
  const chamferHeightCm = chamferWidthCm; // 45°: tan(45°) = 1.0 -> 0.15 cm
  const chamferTopZCm = shelfZCm + chamferHeightCm; // 2.60 cm

  // Plane Eckauflagen
  const cornerFlatLenCm = params.lidJointCornerFlatLength.value; // 0.50 cm (5.0 mm)
  const chamferHalfXC = innerXCm - cornerFlatLenCm; // 3.77 cm
  const chamferHalfYC = innerYCm - cornerFlatLenCm; // 2.32 cm

  // -----------------------------------------------------------------
  // 1. Rückwand (+Y) & Frontwand (-Y): Skizze auf YZ-Hilfsebene bei X = -chamferHalfXC
  // -----------------------------------------------------------------
  try {
    const planeYZ = createOffsetPlane(rootComp, rootComp.yZConstructionPlane, -chamferHalfXC, undefined);
    if (planeYZ) {
      planeYZ.name = "Plane_LidChamfer_YZ";
      const sketchYZ = sketches.add(planeYZ);
      sketchYZ.name = "Sketch_LidChamfer_BackFront";

      // Rückwand (+Y): Dreieck von innerYCm bis lipYCm und shelfZCm bis chamferTopZCm
      const pB0 = sketchYZ.modelToSketchSpace(adsk.core.Point3D.create(-chamferHalfXC, innerYCm, shelfZCm));
      const pB1 = sketchYZ.modelToSketchSpace(adsk.core.Point3D.create(-chamferHalfXC, lipYCm, shelfZCm));
      const pB2 = sketchYZ.modelToSketchSpace(adsk.core.Point3D.create(-chamferHalfXC, lipYCm, chamferTopZCm));

      sketchYZ.sketchCurves.sketchLines.addByTwoPoints(pB0, pB1);
      sketchYZ.sketchCurves.sketchLines.addByTwoPoints(pB1, pB2);
      sketchYZ.sketchCurves.sketchLines.addByTwoPoints(pB2, pB0);

      // Frontwand (-Y): Dreieck von -innerYCm bis -lipYCm und shelfZCm bis chamferTopZCm
      const pF0 = sketchYZ.modelToSketchSpace(adsk.core.Point3D.create(-chamferHalfXC, -innerYCm, shelfZCm));
      const pF1 = sketchYZ.modelToSketchSpace(adsk.core.Point3D.create(-chamferHalfXC, -lipYCm, shelfZCm));
      const pF2 = sketchYZ.modelToSketchSpace(adsk.core.Point3D.create(-chamferHalfXC, -lipYCm, chamferTopZCm));

      sketchYZ.sketchCurves.sketchLines.addByTwoPoints(pF0, pF1);
      sketchYZ.sketchCurves.sketchLines.addByTwoPoints(pF1, pF2);
      sketchYZ.sketchCurves.sketchLines.addByTwoPoints(pF2, pF0);

      const planeNormX = (planeYZ.geometry as adsk.core.Plane).normal.x;
      const extrudeSignX = planeNormX >= 0 ? 1.0 : -1.0;
      const distValX = adsk.core.ValueInput.createByReal(extrudeSignX * 2.0 * chamferHalfXC);

      if (sketchYZ.profiles.count > 0) {
        // 1a. Join an Case_Middle
        const profCollJoin = adsk.core.ObjectCollection.create();
        for (let i = 0; i < sketchYZ.profiles.count; i++) {
          const prof = sketchYZ.profiles.item(i);
          if (prof) profCollJoin.add(prof);
        }

        try {
          const joinInput = extrudes.createInput(profCollJoin, adsk.fusion.FeatureOperations.JoinFeatureOperation);
          joinInput.setDistanceExtent(false, distValX);
          joinInput.participantBodies = [getLiveBody(rootComp, middleBody, "Case_Middle")];
          const joinFeat = extrudes.add(joinInput);
          if (joinFeat) {
            middleBody = getLiveBody(rootComp, middleBody, "Case_Middle");
            console.log("applyLidJointShelfChamfers: 45°-Rampen an Rück- und Frontwand von Case_Middle angefügt.");
          }
        } catch (e) {
          console.warn(`applyLidJointShelfChamfers: Join an Case_Middle (YZ) fehlgeschlagen: ${e}`);
        }

        // 1b. Cut aus Case_Top
        try {
          sketchYZ.isVisible = true;
          const profCollCut = adsk.core.ObjectCollection.create();
          for (let i = 0; i < sketchYZ.profiles.count; i++) {
            const prof = sketchYZ.profiles.item(i);
            if (prof) profCollCut.add(prof);
          }
          const cutInput = extrudes.createInput(profCollCut, adsk.fusion.FeatureOperations.CutFeatureOperation);
          cutInput.setDistanceExtent(false, distValX);
          cutInput.participantBodies = [getLiveBody(rootComp, upperBody, "Case_Top")];
          const cutFeat = extrudes.add(cutInput);
          if (cutFeat) {
            upperBody = getLiveBody(rootComp, upperBody, "Case_Top");
            console.log("applyLidJointShelfChamfers: 45°-Fase an Rück- und Frontwand von Case_Top ausgeschnitten.");
          }
        } catch (e) {
          console.warn(`applyLidJointShelfChamfers: Cut an Case_Top (YZ) fehlgeschlagen: ${e}`);
        }
      }
    }
  } catch (errYZ) {
    console.warn(`applyLidJointShelfChamfers: Rück- und Frontwand-Fasen fehlgeschlagen: ${errYZ}`);
  }

  // -----------------------------------------------------------------
  // 2. Linke (-X) & Rechte Wand (+X): Skizze auf XZ-Hilfsebene bei Y = -chamferHalfYC
  // -----------------------------------------------------------------
  try {
    const planeXZ = createOffsetPlane(rootComp, rootComp.xZConstructionPlane, -chamferHalfYC, undefined);
    if (planeXZ) {
      planeXZ.name = "Plane_LidChamfer_XZ";
      const sketchXZ = sketches.add(planeXZ);
      sketchXZ.name = "Sketch_LidChamfer_LeftRight";

      // Linke Wand (-X): Dreieck von -innerXCm bis lipLeftXCm und shelfZCm bis chamferTopZCm
      const pL0 = sketchXZ.modelToSketchSpace(adsk.core.Point3D.create(-innerXCm, -chamferHalfYC, shelfZCm));
      const pL1 = sketchXZ.modelToSketchSpace(adsk.core.Point3D.create(lipLeftXCm, -chamferHalfYC, shelfZCm));
      const pL2 = sketchXZ.modelToSketchSpace(adsk.core.Point3D.create(lipLeftXCm, -chamferHalfYC, chamferTopZCm));

      sketchXZ.sketchCurves.sketchLines.addByTwoPoints(pL0, pL1);
      sketchXZ.sketchCurves.sketchLines.addByTwoPoints(pL1, pL2);
      sketchXZ.sketchCurves.sketchLines.addByTwoPoints(pL2, pL0);

      // Rechte Wand (+X): Dreieck von innerXCm bis lipRightXCm und shelfZCm bis 45°-Oberkante
      const rightShelfWidthCm = lipRightXCm - innerXCm; // 0.25 cm (2.5 mm)
      const rightChamferTopZCm = shelfZCm + rightShelfWidthCm; // 45°: tan(45°) = 1.0 -> 2.45 + 0.25 = 2.70 cm (unterhalb Z=2.95 cm)
      const pR0 = sketchXZ.modelToSketchSpace(adsk.core.Point3D.create(innerXCm, -chamferHalfYC, shelfZCm));
      const pR1 = sketchXZ.modelToSketchSpace(adsk.core.Point3D.create(lipRightXCm, -chamferHalfYC, shelfZCm));
      const pR2 = sketchXZ.modelToSketchSpace(adsk.core.Point3D.create(lipRightXCm, -chamferHalfYC, rightChamferTopZCm));

      sketchXZ.sketchCurves.sketchLines.addByTwoPoints(pR0, pR1);
      sketchXZ.sketchCurves.sketchLines.addByTwoPoints(pR1, pR2);
      sketchXZ.sketchCurves.sketchLines.addByTwoPoints(pR2, pR0);

      const planeNormY = (planeXZ.geometry as adsk.core.Plane).normal.y;
      const extrudeSignY = planeNormY >= 0 ? 1.0 : -1.0;
      const distValY = adsk.core.ValueInput.createByReal(extrudeSignY * 2.0 * chamferHalfYC);

      if (sketchXZ.profiles.count > 0) {
        // 2a. Join an Case_Middle
        const profCollJoin = adsk.core.ObjectCollection.create();
        for (let i = 0; i < sketchXZ.profiles.count; i++) {
          const prof = sketchXZ.profiles.item(i);
          if (prof) profCollJoin.add(prof);
        }

        try {
          const joinInput = extrudes.createInput(profCollJoin, adsk.fusion.FeatureOperations.JoinFeatureOperation);
          joinInput.setDistanceExtent(false, distValY);
          joinInput.participantBodies = [getLiveBody(rootComp, middleBody, "Case_Middle")];
          const joinFeat = extrudes.add(joinInput);
          if (joinFeat) {
            middleBody = getLiveBody(rootComp, middleBody, "Case_Middle");
            console.log("applyLidJointShelfChamfers: 45°-Rampen an linker und rechter Wand von Case_Middle angefügt.");
          }
        } catch (e) {
          console.warn(`applyLidJointShelfChamfers: Join an Case_Middle (XZ) fehlgeschlagen: ${e}`);
        }

        // 2b. Cut aus Case_Top
        try {
          sketchXZ.isVisible = true;
          const profCollCut = adsk.core.ObjectCollection.create();
          for (let i = 0; i < sketchXZ.profiles.count; i++) {
            const prof = sketchXZ.profiles.item(i);
            if (prof) profCollCut.add(prof);
          }
          const cutInput = extrudes.createInput(profCollCut, adsk.fusion.FeatureOperations.CutFeatureOperation);
          cutInput.setDistanceExtent(false, distValY);
          cutInput.participantBodies = [getLiveBody(rootComp, upperBody, "Case_Top")];
          const cutFeat = extrudes.add(cutInput);
          if (cutFeat) {
            upperBody = getLiveBody(rootComp, upperBody, "Case_Top");
            console.log("applyLidJointShelfChamfers: 45°-Fase an linker und rechter Wand von Case_Top ausgeschnitten.");
          }
        } catch (e) {
          console.warn(`applyLidJointShelfChamfers: Cut an Case_Top (XZ) fehlgeschlagen: ${e}`);
        }
      }
    }
  } catch (errXZ) {
    console.warn(`applyLidJointShelfChamfers: Linke und Rechte Wand-Fasen fehlgeschlagen: ${errXZ}`);
  }

  return {
    topBody: getLiveBody(rootComp, upperBody, "Case_Top"),
    middleBody: getLiveBody(rootComp, middleBody, "Case_Middle")
  };
}

/**
 * Schritt 20 (prompt/p007 / p020 / p022):
 * Trennung des Gehäuse-Oberteils (Case_Top) am unteren Ende der Einkerbung (Z = 29.5 mm)
 * in zwei separate Bauteile für einen besseren FDM-3D-Druck:
 * 1) Horizontale Trennung bei Z = 29.5 mm via SplitBodyFeatures -> Case_Top und Case_Middle
 * 2) Untere Fläche der 1.5 mm dünnen Wand von Case_Top ermitteln
 * 3) Extrusions-Schnitt 5 mm nach unten in das abgetrennte Unterteil (Case_Middle) (bleibt plan ohne Fase)
 * 4) Verlängerung der dünnen Wand von Case_Top um 5 mm nach unten (Join)
 * 5) Mini-Fase (0.5 mm) an der äußeren Unterkante der dünnen Wand von Case_Top
 * 6) 45°-Fasen an den 4 Wänden für stützfreien FDM-Druck (p022, 4 plane Ecken bleiben für stabilen Deckelsitz erhalten)
 * 7) 4-Punkt-Einrastfunktion (Snap-Fit, 4 Rastnasen) zwischen Case_Top und Case_Middle (p020)
 */
export function splitAndCreateLidJoint(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  params: Params
): LidJointResult {
  console.log("Schritt 20: Starte Trennung von Case_Top am unteren Ende der Einkerbung (Z = 29.5 mm)...");

  let liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const splitZCm = params.lidSplitZ.value; // 2.95 cm (29.5 mm)
  const depthCm = params.lidJointDepth.value; // 0.5 cm (5.0 mm)
  const chamferCm = params.lidJointChamfer.value; // 0.05 cm (0.5 mm)

  // -----------------------------------------------------------------
  // 1. Hilfsebene bei Z = 29.5 mm erzeugen
  // -----------------------------------------------------------------
  const xyPlane = rootComp.xYConstructionPlane;
  const splitPlane = createOffsetPlane(rootComp, xyPlane, splitZCm, "lid_split_z");
  if (!splitPlane) {
    throw new Error(`Erstellung der Trennebene bei Z=${splitZCm * 10}mm fehlgeschlagen.`);
  }
  splitPlane.name = "Plane_Lid_Split_29_5mm";

  // -----------------------------------------------------------------
  // 2. Case_Top an der Hilfsebene trennen (SplitBodyFeatures)
  // -----------------------------------------------------------------
  const splitFeatures = rootComp.features.splitBodyFeatures;
  const splitInput = splitFeatures.createInput(liveTop, splitPlane, true);
  if (!splitInput) {
    throw new Error("SplitBodyFeatureInput für Case_Top konnte nicht erzeugt werden.");
  }

  const splitFeat = splitFeatures.add(splitInput);
  if (!splitFeat) {
    throw new Error(`Trennung von Case_Top bei Z=${splitZCm * 10}mm fehlgeschlagen.`);
  }

  // -----------------------------------------------------------------
  // 3. Resultierende Körper identifizieren:
  //    - Oberer Teil (Z > 29.5 mm): Case_Top (Deckel)
  //    - Unterer Teil (Z <= 29.5 mm): Case_Middle (abgetrenntes Unterteil)
  // -----------------------------------------------------------------
  let upperBody: adsk.fusion.BRepBody | null = null;
  let middleBody: adsk.fusion.BRepBody | null = null;

  for (let i = 0; i < rootComp.bRepBodies.count; i++) {
    const b = rootComp.bRepBodies.item(i);
    if (!b || !b.isValid || b.name === "Case_Bottom") continue;

    // Unterscheidung anhand der maximalen Z-Höhe
    if (b.boundingBox.maxPoint.z > splitZCm + 0.2) {
      upperBody = b;
    } else if (b.boundingBox.maxPoint.z <= splitZCm + 0.2 && b.boundingBox.minPoint.z < splitZCm - 0.2) {
      middleBody = b;
    }
  }

  if (!upperBody || !middleBody) {
    throw new Error("Identifikation der getrennten Körper (Case_Top und Case_Middle) fehlgeschlagen.");
  }

  upperBody.name = "Case_Top";
  middleBody.name = "Case_Middle";
  console.log(`Körper erfolgreich getrennt: ${upperBody.name} (Z bis ${upperBody.boundingBox.maxPoint.z * 10}mm), ${middleBody.name} (Z bis ${middleBody.boundingBox.maxPoint.z * 10}mm).`);

  // -----------------------------------------------------------------
  // 4. Untere Planarfläche der 1.5 mm dünnen Wand am oberen Körper (Case_Top) ermitteln
  //    Normalenvektor zeigt in -Z (nach unten)
  // -----------------------------------------------------------------
  upperBody = getLiveBody(rootComp, upperBody, "Case_Top");
  let thinWallFace = findHorizontalPlanarFaceWithNormal(upperBody, splitZCm, -1.0, 0.1);

  if (!thinWallFace) {
    // Fallback: jede horizontale Fläche nahe splitZCm auf upperBody suchen
    for (let i = 0; i < upperBody.faces.count; i++) {
      const f = upperBody.faces.item(i);
      if (!f || !f.isValid) continue;
      if (f.geometry.surfaceType === adsk.core.SurfaceTypes.PlaneSurfaceType) {
        if (Math.abs(f.centroid.z - splitZCm) < 0.15) {
          thinWallFace = f;
          break;
        }
      }
    }
  }

  if (!thinWallFace) {
    throw new Error("Untere Stirnfläche der dünnen Wand an Case_Top bei Z=29.5mm nicht gefunden.");
  }

  // -----------------------------------------------------------------
  // 5. Extrusions-Schnitt 5 mm nach unten in Case_Middle
  //    (unter Verwendung der Kontur der dünnen Wand)
  // -----------------------------------------------------------------
  console.log("Schritt 20b: Schneide Stufe (5 mm Tiefe) in Case_Middle aus...");
  const extrudes = rootComp.features.extrudeFeatures;

  // Stufe 5a: Versuche Direktextrusion von der BRepFace
  let cutSucceeded = false;
  try {
    const cutInput = extrudes.createInput(thinWallFace, adsk.fusion.FeatureOperations.CutFeatureOperation);
    if (cutInput) {
      // Normale der Fläche zeigt in -Z; positive Extrusion bewegt sich entlang der Normalen (nach unten)
      let distVal = adsk.core.ValueInput.createByString("lid_joint_depth");
      if (!distVal) distVal = adsk.core.ValueInput.createByReal(depthCm);
      cutInput.setDistanceExtent(false, distVal);
      cutInput.participantBodies = [getLiveBody(rootComp, middleBody, "Case_Middle")];

      const cutFeat = extrudes.add(cutInput);
      if (cutFeat) {
        cutSucceeded = true;
      }
    }
  } catch (e) {
    console.warn(`Direktextrusions-Schnitt mit BRepFace fehlgeschlagen: ${e}`);
  }

  // Stufe 5b: Fallback über Skizze auf Hilfsebene und Flächenprojektion
  if (!cutSucceeded) {
    console.log("Verwende Skizzen-Projektions-Fallback für Stufenschnitt in Case_Middle...");
    const sketch = rootComp.sketches.add(splitPlane);
    sketch.name = "Sketch_LidJoint_Cut";
    sketch.project(thinWallFace);

    let ringProfile: adsk.fusion.Profile | null = null;
    for (let i = 0; i < sketch.profiles.count; i++) {
      const prof = sketch.profiles.item(i);
      if (prof && prof.profileLoops.count >= 2) {
        ringProfile = prof;
        break;
      }
    }
    if (!ringProfile && sketch.profiles.count > 0) {
      ringProfile = sketch.profiles.item(0);
    }

    if (!ringProfile) {
      throw new Error("Profil für Stufenschnitt-Fallback konnte nicht ermittelt werden.");
    }

    const cutInput = extrudes.createInput(ringProfile, adsk.fusion.FeatureOperations.CutFeatureOperation);
    // Auf Skizzenebene XY bei Z=29.5mm zeigt Normalenvektor nach +Z, Schnitt nach unten erfordert -depthCm
    cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(-depthCm));
    cutInput.participantBodies = [getLiveBody(rootComp, middleBody, "Case_Middle")];
    const cutFeat = extrudes.add(cutInput);
    if (!cutFeat) {
      throw new Error("Stufenschnitt in Case_Middle fehlgeschlagen.");
    }
  }

  middleBody = getLiveBody(rootComp, middleBody, "Case_Middle");
  console.log("Stufenschnitt in Case_Middle erfolgreich ausgeführt.");

  // -----------------------------------------------------------------
  // 6. Verlängerung der dünnen Wand von Case_Top um 5 mm nach unten (Join)
  // -----------------------------------------------------------------
  console.log("Schritt 20c: Verlängere dünne Wand von Case_Top um 5 mm nach unten...");
  upperBody = getLiveBody(rootComp, upperBody, "Case_Top");

  // Frische Referenz auf die untere Stirnfläche der dünnen Wand an Case_Top
  thinWallFace = findHorizontalPlanarFaceWithNormal(upperBody, splitZCm, -1.0, 0.1);
  if (!thinWallFace) {
    for (let i = 0; i < upperBody.faces.count; i++) {
      const f = upperBody.faces.item(i);
      if (f && f.isValid && f.geometry.surfaceType === adsk.core.SurfaceTypes.PlaneSurfaceType) {
        if (Math.abs(f.centroid.z - splitZCm) < 0.15) {
          thinWallFace = f;
          break;
        }
      }
    }
  }

  if (!thinWallFace) {
    throw new Error("Stirnfläche für Verlängerung der dünnen Wand an Case_Top nicht gefunden.");
  }

  let joinSucceeded = false;
  try {
    const joinInput = extrudes.createInput(thinWallFace, adsk.fusion.FeatureOperations.JoinFeatureOperation);
    if (joinInput) {
      let distVal = adsk.core.ValueInput.createByString("lid_joint_depth");
      if (!distVal) distVal = adsk.core.ValueInput.createByReal(depthCm);
      joinInput.setDistanceExtent(false, distVal);
      joinInput.participantBodies = [getLiveBody(rootComp, upperBody, "Case_Top")];

      const joinFeat = extrudes.add(joinInput);
      if (joinFeat) {
        joinSucceeded = true;
      }
    }
  } catch (e) {
    console.warn(`Direkte Verlängerung der dünnen Wand fehlgeschlagen: ${e}`);
  }

  if (!joinSucceeded) {
    console.log("Verwende Skizzen-Projektions-Fallback für Verlängerung der dünnen Wand an Case_Top...");
    const sketchJoin = rootComp.sketches.add(splitPlane);
    sketchJoin.name = "Sketch_LidJoint_Extension";
    sketchJoin.project(thinWallFace);

    let ringProfile: adsk.fusion.Profile | null = null;
    for (let i = 0; i < sketchJoin.profiles.count; i++) {
      const prof = sketchJoin.profiles.item(i);
      if (prof && prof.profileLoops.count >= 2) {
        ringProfile = prof;
        break;
      }
    }
    if (!ringProfile && sketchJoin.profiles.count > 0) {
      ringProfile = sketchJoin.profiles.item(0);
    }

    if (!ringProfile) {
      throw new Error("Profil für Verlängerungs-Fallback konnte nicht ermittelt werden.");
    }

    const joinInput = extrudes.createInput(ringProfile, adsk.fusion.FeatureOperations.JoinFeatureOperation);
    joinInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(-depthCm));
    joinInput.participantBodies = [getLiveBody(rootComp, upperBody, "Case_Top")];
    const joinFeat = extrudes.add(joinInput);
    if (!joinFeat) {
      throw new Error("Verlängerung der dünnen Wand an Case_Top fehlgeschlagen.");
    }
  }

  upperBody = getLiveBody(rootComp, upperBody, "Case_Top");
  console.log(`Dünne Wand an Case_Top erfolgreich um 5 mm nach unten verlängert (Z-Min: ${upperBody.boundingBox.minPoint.z * 10}mm).`);

  // -----------------------------------------------------------------
  // 7. Mini-Fase (0.5 mm) an der äußeren Unterkante der dünnen Wand von Case_Top
  //    (Case_Middle bleibt plan ohne Fase für saubere Bettauflage & fugenlose Passung)
  // -----------------------------------------------------------------
  console.log("Schritt 20d: Wende Mini-Fase an der äußeren Unterkante der dünnen Wand von Case_Top an...");
  upperBody = getLiveBody(rootComp, upperBody, "Case_Top");

  const tipZCm = splitZCm - depthCm; // 2.95 - 0.50 = 2.45 cm (24.5 mm)
  const edgesToChamfer: adsk.fusion.BRepEdge[] = [];
  const EDGE_TOL = 0.08; // 0.8 mm Toleranz

  // Kanten an Z = 24.5 mm suchen, die an der Außenkontur der verlängerten dünnen Wand liegen
  // (Innenhohlraum liegt bei |X| <= 4.27 cm, |Y| <= 2.82 cm; Außenkante liegt bei |X| ~ 4.42 cm, |Y| ~ 2.97 cm)
  for (let i = 0; i < upperBody.edges.count; i++) {
    const e = upperBody.edges.item(i);
    if (!e || !e.isValid) continue;

    const pStart = e.startVertex.geometry;
    const pEnd = e.endVertex.geometry;

    // Nur horizontale Kanten auf der unteren Stirnfläche des Steckkragens bei Z = 24.5 mm
    const isAtTipZ = Math.abs(pStart.z - tipZCm) < EDGE_TOL && Math.abs(pEnd.z - tipZCm) < EDGE_TOL;
    if (!isAtTipZ) continue;

    // Kante muss an der Außenkontur der dünnen Wand liegen (|X| > 4.30 cm oder |Y| > 2.85 cm)
    const isOuterEdge =
      Math.max(Math.abs(pStart.x), Math.abs(pEnd.x)) > 4.30 ||
      Math.max(Math.abs(pStart.y), Math.abs(pEnd.y)) > 2.85;

    if (isOuterEdge) {
      edgesToChamfer.push(e);
    }
  }

  console.log(`Case_Top: ${edgesToChamfer.length} äußere Kanten der dünnen Wand bei Z = 24.5 mm für Mini-Fase ermittelt.`);

  if (edgesToChamfer.length > 0) {
    applyChamferWithFallbacks(
      rootComp,
      edgesToChamfer,
      chamferCm,
      "lid_joint_chamfer",
      "LidJointMiniChamfer"
    );
  } else {
    console.warn("Keine passenden Kanten für die Mini-Fase an Case_Top gefunden.");
  }

  // -----------------------------------------------------------------
  // 7b. 45°-Fasen an der Auflagefläche (Case_Middle) & Steckkragen (Case_Top) (p022)
  //     (zur Vermeidung von FDM-Stützstrukturen beim Druck kopfüber;
  //      die 4 Ecken bleiben auf je 5.0 mm Länge horizontal plan für stabilen Deckelsitz)
  // -----------------------------------------------------------------
  console.log("Schritt 20d2: Erzeuge 45°-Fasen an der Auflagefläche von Case_Middle und passe Case_Top an (p022)...");
  const chamferResult = applyLidJointShelfChamfers(rootComp, upperBody, middleBody, params);
  upperBody = chamferResult.topBody;
  middleBody = chamferResult.middleBody;

  // -----------------------------------------------------------------
  // 8. 4-Punkt-Einrastfunktion (Snap-Fit, 4 Rastnasen) zwischen Case_Top und Case_Middle (p020)
  //    - 2x an der Rückwand (+Y, ecknah bei X = -28 mm und X = +26 mm)
  //    - 1x an der linken Seitenwand (-X, zentriert bei Y = 0)
  //    - 1x an der Frontwand rechts (-Y, zentriert bei X = +22.0 mm)
  // -----------------------------------------------------------------
  try {
    console.log("Schritt 20e: Erzeuge 4 Rastnasen für Case_Top (2x Rückwand ecknah, 1x Linke Wand, 1x Frontwand)...");

    const sketches = rootComp.sketches;
    const snapLengthCm = params.lidJointSnapLength.value; // 1.8 cm (18 mm)
    const snapDepthCm = params.lidJointSnapDepth.value;   // 0.025 cm (0.25 mm)
    const snapHeightCm = params.lidJointSnapHeight.value; // 0.05 cm (0.5 mm)

    const halfSnapLen = snapLengthCm / 2.0;              // 0.9 cm
    // Kragen von Case_Top reicht von splitZCm (29.5 mm) nach unten bis tipZCm (24.5 mm)
    const snapZCenter = splitZCm - (depthCm / 2.0);      // 2.70 cm (27.0 mm)
    const snapZMin = snapZCenter - (snapHeightCm / 2.0); // 2.675 cm
    const snapZMax = snapZCenter + (snapHeightCm / 2.0); // 2.725 cm

    const recessHalfLen = halfSnapLen + 0.02;            // +0.2 mm je Seite
    const recessZMin = snapZMin - 0.005;                // +0.05 mm nach unten
    const recessZMax = snapZMax + 0.005;                // +0.05 mm nach oben
    const recessDepthCm = snapDepthCm + 0.005;           // 0.30 mm

    // Wandmitten der Fuge (Außenflanken des Kragens von Case_Top):
    const backMidY = 2.97;   // +2.97 cm
    const frontMidY = -2.97; // -2.97 cm
    const leftMidX = -4.42;  // -4.42 cm

    // 8a. Rückwand (+Y): 2 ecknahe Rastnasen (Back-Left und Back-Right)
    try {
      const leftSnapCenterX = -2.80; // in cm (-28.0 mm)
      const rightSnapCenterX = 2.60; // in cm (+26.0 mm)

      const leftMinX = leftSnapCenterX - halfSnapLen;
      const leftMaxX = leftSnapCenterX + halfSnapLen;
      const rightMinX = rightSnapCenterX - halfSnapLen;
      const rightMaxX = rightSnapCenterX + halfSnapLen;

      // Zwei Rastwülste auf der Außenflanke des Rückwand-Kragens von Case_Top
      const snapPlaneRidgeBack = createOffsetPlane(
        rootComp,
        rootComp.xZConstructionPlane,
        backMidY,
        undefined
      );

      if (snapPlaneRidgeBack) {
        snapPlaneRidgeBack.name = "Plane_LidSnap_Ridge_Back";
        const sketchRidgeBack = sketches.add(snapPlaneRidgeBack);
        sketchRidgeBack.name = "Sketch_LidSnap_Ridge_Back";

        drawRectOnXZ(sketchRidgeBack, leftMinX, leftMaxX, snapZMin, snapZMax, backMidY);
        drawRectOnXZ(sketchRidgeBack, rightMinX, rightMaxX, snapZMin, snapZMax, backMidY);

        if (sketchRidgeBack.profiles.count > 0) {
          const ridgeProfiles = adsk.core.ObjectCollection.create();
          for (let i = 0; i < sketchRidgeBack.profiles.count; i++) {
            const prof = sketchRidgeBack.profiles.item(i);
            if (prof) ridgeProfiles.add(prof);
          }

          const ridgeInput = extrudes.createInput(
            ridgeProfiles,
            adsk.fusion.FeatureOperations.JoinFeatureOperation
          );
          const planeNormY = (snapPlaneRidgeBack.geometry as adsk.core.Plane).normal.y;
          const ridgeSign = planeNormY >= 0 ? 1.0 : -1.0;
          ridgeInput.setDistanceExtent(
            false,
            adsk.core.ValueInput.createByReal(ridgeSign * snapDepthCm)
          );
          ridgeInput.participantBodies = [getLiveBody(rootComp, upperBody, "Case_Top")];
          const ridgeFeat = extrudes.add(ridgeInput);
          if (ridgeFeat) {
            upperBody = getLiveBody(rootComp, upperBody, "Case_Top");
            console.log(`splitAndCreateLidJoint: 2 ecknahe Rückwand-Rastwülste an Case_Top angefügt.`);
          }
        }
      }

      // Zwei korrespondierende Rastmulden in der oberen Stufenwand von Case_Middle
      const snapPlaneRecessBack = createOffsetPlane(
        rootComp,
        rootComp.xZConstructionPlane,
        backMidY,
        undefined
      );

      if (snapPlaneRecessBack) {
        snapPlaneRecessBack.name = "Plane_LidSnap_Recess_Back";
        const sketchRecessBack = sketches.add(snapPlaneRecessBack);
        sketchRecessBack.name = "Sketch_LidSnap_Recess_Back";

        const leftRecessMinX = leftSnapCenterX - recessHalfLen;
        const leftRecessMaxX = leftSnapCenterX + recessHalfLen;
        const rightRecessMinX = rightSnapCenterX - recessHalfLen;
        const rightRecessMaxX = rightSnapCenterX + recessHalfLen;

        drawRectOnXZ(sketchRecessBack, leftRecessMinX, leftRecessMaxX, recessZMin, recessZMax, backMidY);
        drawRectOnXZ(sketchRecessBack, rightRecessMinX, rightRecessMaxX, recessZMin, recessZMax, backMidY);

        if (sketchRecessBack.profiles.count > 0) {
          const recessProfiles = adsk.core.ObjectCollection.create();
          for (let i = 0; i < sketchRecessBack.profiles.count; i++) {
            const prof = sketchRecessBack.profiles.item(i);
            if (prof) recessProfiles.add(prof);
          }

          const recessInput = extrudes.createInput(
            recessProfiles,
            adsk.fusion.FeatureOperations.CutFeatureOperation
          );
          const planeNormY = (snapPlaneRecessBack.geometry as adsk.core.Plane).normal.y;
          const recessSign = planeNormY >= 0 ? 1.0 : -1.0;
          recessInput.setDistanceExtent(
            false,
            adsk.core.ValueInput.createByReal(recessSign * recessDepthCm)
          );
          recessInput.participantBodies = [getLiveBody(rootComp, middleBody, "Case_Middle")];
          const recessFeat = extrudes.add(recessInput);
          if (recessFeat) {
            middleBody = getLiveBody(rootComp, middleBody, "Case_Middle");
            console.log(`splitAndCreateLidJoint: 2 ecknahe Rückwand-Rastmulden in Case_Middle ausgeschnitten.`);
          }
        }
      }
    } catch (errBack) {
      console.warn(`splitAndCreateLidJoint: Rückwand-Rastnasen für Case_Top fehlgeschlagen: ${errBack}`);
    }

    // 8b. Linke Seitenwand (-X): 1 Rastnase bei Y = 0
    try {
      const snapPlaneRidgeLeft = createOffsetPlane(
        rootComp,
        rootComp.yZConstructionPlane,
        leftMidX,
        undefined
      );

      if (snapPlaneRidgeLeft) {
        snapPlaneRidgeLeft.name = "Plane_LidSnap_Ridge_Left";
        const sketchRidgeLeft = sketches.add(snapPlaneRidgeLeft);
        sketchRidgeLeft.name = "Sketch_LidSnap_Ridge_Left";

        drawRectOnYZ(sketchRidgeLeft, -halfSnapLen, halfSnapLen, snapZMin, snapZMax, leftMidX);

        if (sketchRidgeLeft.profiles.count > 0) {
          const ridgeProf = sketchRidgeLeft.profiles.item(0);
          const ridgeInput = extrudes.createInput(
            ridgeProf,
            adsk.fusion.FeatureOperations.JoinFeatureOperation
          );
          const planeNormX = (snapPlaneRidgeLeft.geometry as adsk.core.Plane).normal.x;
          const ridgeSign = planeNormX >= 0 ? -1.0 : 1.0;
          ridgeInput.setDistanceExtent(
            false,
            adsk.core.ValueInput.createByReal(ridgeSign * snapDepthCm)
          );
          ridgeInput.participantBodies = [getLiveBody(rootComp, upperBody, "Case_Top")];
          const ridgeFeat = extrudes.add(ridgeInput);
          if (ridgeFeat) {
            upperBody = getLiveBody(rootComp, upperBody, "Case_Top");
            console.log(`splitAndCreateLidJoint: Linke Rastwulst an Case_Top angefügt.`);
          }
        }
      }

      const snapPlaneRecessLeft = createOffsetPlane(
        rootComp,
        rootComp.yZConstructionPlane,
        leftMidX,
        undefined
      );

      if (snapPlaneRecessLeft) {
        snapPlaneRecessLeft.name = "Plane_LidSnap_Recess_Left";
        const sketchRecessLeft = sketches.add(snapPlaneRecessLeft);
        sketchRecessLeft.name = "Sketch_LidSnap_Recess_Left";

        drawRectOnYZ(sketchRecessLeft, -recessHalfLen, recessHalfLen, recessZMin, recessZMax, leftMidX);

        if (sketchRecessLeft.profiles.count > 0) {
          const recessProf = sketchRecessLeft.profiles.item(0);
          const recessInput = extrudes.createInput(
            recessProf,
            adsk.fusion.FeatureOperations.CutFeatureOperation
          );
          const planeNormX = (snapPlaneRecessLeft.geometry as adsk.core.Plane).normal.x;
          const recessSign = planeNormX >= 0 ? -1.0 : 1.0;
          recessInput.setDistanceExtent(
            false,
            adsk.core.ValueInput.createByReal(recessSign * recessDepthCm)
          );
          recessInput.participantBodies = [getLiveBody(rootComp, middleBody, "Case_Middle")];
          const recessFeat = extrudes.add(recessInput);
          if (recessFeat) {
            middleBody = getLiveBody(rootComp, middleBody, "Case_Middle");
            console.log(`splitAndCreateLidJoint: Linke Rastmulde in Case_Middle ausgeschnitten.`);
          }
        }
      }
    } catch (errLeft) {
      console.warn(`splitAndCreateLidJoint: Linke Rastnase für Case_Top fehlgeschlagen: ${errLeft}`);
    }

    // 8c. Frontwand rechts (-Y): 1 Rastnase bei X = +22.0 mm
    try {
      const frontSnapCenterX = 2.20; // 22.0 mm
      const frontMinX = frontSnapCenterX - halfSnapLen;
      const frontMaxX = frontSnapCenterX + halfSnapLen;

      const snapPlaneRidgeFront = createOffsetPlane(
        rootComp,
        rootComp.xZConstructionPlane,
        frontMidY,
        undefined
      );

      if (snapPlaneRidgeFront) {
        snapPlaneRidgeFront.name = "Plane_LidSnap_Ridge_Front";
        const sketchRidgeFront = sketches.add(snapPlaneRidgeFront);
        sketchRidgeFront.name = "Sketch_LidSnap_Ridge_Front";

        drawRectOnXZ(sketchRidgeFront, frontMinX, frontMaxX, snapZMin, snapZMax, frontMidY);

        if (sketchRidgeFront.profiles.count > 0) {
          const ridgeProf = sketchRidgeFront.profiles.item(0);
          const ridgeInput = extrudes.createInput(
            ridgeProf,
            adsk.fusion.FeatureOperations.JoinFeatureOperation
          );
          const planeNormY = (snapPlaneRidgeFront.geometry as adsk.core.Plane).normal.y;
          const ridgeSign = planeNormY >= 0 ? -1.0 : 1.0;
          ridgeInput.setDistanceExtent(
            false,
            adsk.core.ValueInput.createByReal(ridgeSign * snapDepthCm)
          );
          ridgeInput.participantBodies = [getLiveBody(rootComp, upperBody, "Case_Top")];
          const ridgeFeat = extrudes.add(ridgeInput);
          if (ridgeFeat) {
            upperBody = getLiveBody(rootComp, upperBody, "Case_Top");
            console.log(`splitAndCreateLidJoint: Frontwand-Rastwulst an Case_Top angefügt.`);
          }
        }
      }

      const snapPlaneRecessFront = createOffsetPlane(
        rootComp,
        rootComp.xZConstructionPlane,
        frontMidY,
        undefined
      );

      if (snapPlaneRecessFront) {
        snapPlaneRecessFront.name = "Plane_LidSnap_Recess_Front";
        const sketchRecessFront = sketches.add(snapPlaneRecessFront);
        sketchRecessFront.name = "Sketch_LidSnap_Recess_Front";

        const recessFrontMinX = frontSnapCenterX - recessHalfLen;
        const recessFrontMaxX = frontSnapCenterX + recessHalfLen;

        drawRectOnXZ(sketchRecessFront, recessFrontMinX, recessFrontMaxX, recessZMin, recessZMax, frontMidY);

        if (sketchRecessFront.profiles.count > 0) {
          const recessProf = sketchRecessFront.profiles.item(0);
          const recessInput = extrudes.createInput(
            recessProf,
            adsk.fusion.FeatureOperations.CutFeatureOperation
          );
          const planeNormY = (snapPlaneRecessFront.geometry as adsk.core.Plane).normal.y;
          const recessSign = planeNormY >= 0 ? -1.0 : 1.0;
          recessInput.setDistanceExtent(
            false,
            adsk.core.ValueInput.createByReal(recessSign * recessDepthCm)
          );
          recessInput.participantBodies = [getLiveBody(rootComp, middleBody, "Case_Middle")];
          const recessFeat = extrudes.add(recessInput);
          if (recessFeat) {
            middleBody = getLiveBody(rootComp, middleBody, "Case_Middle");
            console.log(`splitAndCreateLidJoint: Frontwand-Rastmulde in Case_Middle ausgeschnitten.`);
          }
        }
      }
    } catch (errFront) {
      console.warn(`splitAndCreateLidJoint: Frontwand-Rastnase für Case_Top fehlgeschlagen: ${errFront}`);
    }
  } catch (snapErr) {
    console.warn(`splitAndCreateLidJoint: 4-Punkt-Einrastfunktion für Case_Top konnte nicht erstellt werden: ${snapErr}`);
  }

  // -----------------------------------------------------------------
  // 9. Abschluss & Rückgabe der Live-Körper
  // -----------------------------------------------------------------
  upperBody = getLiveBody(rootComp, upperBody, "Case_Top");
  middleBody = getLiveBody(rootComp, middleBody, "Case_Middle");
  upperBody.name = "Case_Top";
  middleBody.name = "Case_Middle";

  console.log(
    `Schritt 20 erfolgreich abgeschlossen: ${upperBody.name} (Deckel) und ${middleBody.name} (Mittelteil) generiert.`
  );

  return {
    topBody: upperBody,
    middleBody
  };
}
