import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import { createCollection, getLiveBody, createOffsetPlane, applyChamferWithFallbacks } from "./utils";

export interface CaseJointBodies {
  topBody: adsk.fusion.BRepBody;
  bottomBody: adsk.fusion.BRepBody;
}

/**
 * Zeichnet ein planares Rechteck auf einer Skizze in der XY-Ebene bei Z = 0.
 * Nutzt sketch.modelToSketchSpace() zur fehlerfreien Koordinatentransformation (AGENTS.md §4.4).
 */
function drawRectOnXY(
  sketch: adsk.fusion.Sketch,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): void {
  const p0 = sketch.modelToSketchSpace(adsk.core.Point3D.create(minX, minY, 0));
  const p1 = sketch.modelToSketchSpace(adsk.core.Point3D.create(maxX, minY, 0));
  const p2 = sketch.modelToSketchSpace(adsk.core.Point3D.create(maxX, maxY, 0));
  const p3 = sketch.modelToSketchSpace(adsk.core.Point3D.create(minX, maxY, 0));

  const lines = sketch.sketchCurves.sketchLines;
  lines.addByTwoPoints(p0, p1);
  lines.addByTwoPoints(p1, p2);
  lines.addByTwoPoints(p2, p3);
  lines.addByTwoPoints(p3, p0);
}

/**
 * Zeichnet ein planares Rechteck auf einer Skizze in einer XZ-Ebene bei konstantem Y.
 * Nutzt sketch.modelToSketchSpace() zur fehlerfreien Koordinatentransformation (AGENTS.md §4.4).
 */
function drawRectOnXZ(
  sketch: adsk.fusion.Sketch,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  yVal: number
): void {
  const p0 = sketch.modelToSketchSpace(adsk.core.Point3D.create(minX, yVal, minZ));
  const p1 = sketch.modelToSketchSpace(adsk.core.Point3D.create(maxX, yVal, minZ));
  const p2 = sketch.modelToSketchSpace(adsk.core.Point3D.create(maxX, yVal, maxZ));
  const p3 = sketch.modelToSketchSpace(adsk.core.Point3D.create(minX, yVal, maxZ));

  const lines = sketch.sketchCurves.sketchLines;
  lines.addByTwoPoints(p0, p1);
  lines.addByTwoPoints(p1, p2);
  lines.addByTwoPoints(p2, p3);
  lines.addByTwoPoints(p3, p0);
}

/**
 * Zeichnet ein planares Rechteck auf einer Skizze in einer YZ-Ebene bei konstantem X.
 * Nutzt sketch.modelToSketchSpace() zur fehlerfreien Koordinatentransformation (AGENTS.md §4.4).
 */
function drawRectOnYZ(
  sketch: adsk.fusion.Sketch,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
  xVal: number
): void {
  const p0 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY, minZ));
  const p1 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY, minZ));
  const p2 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY, maxZ));
  const p3 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY, maxZ));

  const lines = sketch.sketchCurves.sketchLines;
  lines.addByTwoPoints(p0, p1);
  lines.addByTwoPoints(p1, p2);
  lines.addByTwoPoints(p2, p3);
  lines.addByTwoPoints(p3, p0);
}

/**
 * Schritt 19 (doc/prompt/p006 / p019 / p020):
 * Erzeugt eine hochstabile Stufenfalz-Steckverbindung (Steckkragen / Lap Joint) mit 4-Punkt-Einrastfunktion (Snap-Fit, 4 Nasen)
 * zwischen Case_Bottom und Case_Middle (analog zur bewährten Steckverbindung zwischen Case_Middle und Case_Top in lidJoint.ts):
 *
 * 1. Steckkragen an Case_Bottom:
 *    - Breite: 1.5 mm nominal auf der inneren Wandhälfte (minus 0.15 mm Passungsspiel = 1.35 mm)
 *    - Höhe: 5.0 mm über Trennebene Z = 0 in +Z (joint_depth)
 *    - Monolithische L-Winkel-Versteifung über alle 4 Ecken (Back-Left, Back-Right, Front-Right & Front-Left) für allseitig strammen, spielfreien Formschluss
 * 2. 0.5 mm Mini-Fase (45°) an den oberen Außenkanten des Steckkragens von Case_Bottom bei Z = 5.0 mm
 * 3. Stufenschnitt in Case_Middle:
 *    - Breite: 1.5 mm Stufe an der Gehäuseinnenwand inkl. aller 4 L-Winkel-Ecken
 *    - Tiefe: 5.3 mm nach oben in +Z (inkl. 0.3 mm vertikalem Kopfspiel)
 * 4. 4-Punkt-Einrastfunktion (Snap-Fit) mit 4 Rastnasen (p020):
 *    - Rückwand (+Y): 2 ecknahe Rastwülste bei X = -28 mm und X = +26 mm (Länge 18 mm)
 *    - Linke Seitenwand (-X): 1 Rastwulst zentriert bei Y = 0 (Länge 18 mm)
 *    - Frontwand rechts (-Y): 1 Rastwulst zentriert bei X = +22.0 mm (Länge 18 mm)
 *    - Korrespondierende Rastmulden in den Stufenwänden von Case_Middle
 * 5. Schutz der Port-Ausschnitte:
 *    - Frontanschlüsse (USB-C & Micro-HDMI) sowie rechte Anschlüsse (RJ45, USB 3.0, USB 2.0) bleiben 100% frei
 */
export function createTongueAndGrooveJoint(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): CaseJointBodies {
  const xyPlane = rootComp.xYConstructionPlane;
  const sketches = rootComp.sketches;
  const extrudes = rootComp.features.extrudeFeatures;

  let liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  let liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");

  // Maße in cm
  const depthCm = params.jointDepth ? params.jointDepth.value : params.jointTongueHeight.value; // 0.50 cm (5.0 mm)
  const chamferCm = params.jointChamfer ? params.jointChamfer.value : 0.05;                      // 0.05 cm (0.5 mm)
  const clearanceCm = params.jointClearance.value;                                              // 0.015 cm (0.15 mm)
  const vClearanceCm = params.jointVerticalClearance.value;                                      // 0.03 cm (0.30 mm)
  const stepDepthCm = depthCm + vClearanceCm;                                                   // 0.53 cm (5.3 mm)

  // Gehäuse-Innenwandgrenzen (in cm):
  // Außenmaß 91.4 x 62.4 mm (Halbe: 4.57 x 3.12 cm), Wandstärke 3.0 mm (0.30 cm)
  // Innenraum: 85.4 x 56.4 mm (Halbe: 4.27 x 2.82 cm)
  const innerBackY = 2.82;   // +2.82 cm (+28.2 mm)
  const innerFrontY = -2.82; // -2.82 cm (-28.2 mm)
  const innerLeftX = -4.27;  // -4.27 cm (-42.7 mm)
  const innerRightX = 4.27;  // +4.27 cm (+42.7 mm)

  // Wandmitten (Stufenlinie, halbe 3.0 mm Wand = 1.5 mm Versatz nach außen):
  const backMidY = 2.97;   // +2.97 cm
  const frontMidY = -2.97; // -2.97 cm
  const leftMidX = -4.42;  // -4.42 cm
  const rightMidX = 4.42;  // +4.42 cm

  // Koordinaten der Pfeiler an der rechten Gehäusewand (zwischen den Ports):
  const yOffset = params.pi5YOffset.value;
  const ethHalfW = params.portEthWidth.value / 2.0;
  const usb3HalfW = params.portUsb3Width.value / 2.0;
  const usb2HalfW = params.portUsb2Width.value / 2.0;

  // Pfeiler 1 (zwischen RJ45 Ethernet und Dual USB 3.0):
  const pillar1YMin = -1.78 + yOffset + ethHalfW; // z. B. -0.955 cm (-9.55 mm)
  const pillar1YMax = 0.11 + yOffset - usb3HalfW;  // z. B. -0.640 cm (-6.40 mm)

  // Pfeiler 2 (zwischen Dual USB 3.0 und Dual USB 2.0):
  const pillar2YMin = 0.11 + yOffset + usb3HalfW;  // z. B. +0.860 cm (+8.60 mm)
  const pillar2YMax = 1.90 + yOffset - usb2HalfW;  // z. B. +1.150 cm (+11.50 mm)

  // Eckbegrenzungen auf rechter und vorderer Gehäusewand (L-Winkel-Umfassung mit Sicherheitsabstand vor den Ports):
  // RJ45 Ethernet beginnt bei Y = -2.605 cm; USB 2.0 endet bei Y = +2.650 cm
  const cornerFrontRightYMax = -2.70; // -2.70 cm (-27.0 mm), 0.95 mm Sicherheitsabstand vor RJ45 Ethernet
  const cornerBackRightYMin = 2.70;   // +2.70 cm (+27.0 mm), 0.50 mm Sicherheitsabstand nach Dual USB 2.0
  // Hinweis Front-Left: Die frontseitige Anschlussvertiefung (createFrontPortRecess) reicht von X = -4.105 cm
  // bis X = +0.34 cm (Tiefe 1.5 mm). Da die Wandstärke 3.0 mm beträgt und der Stufenschnitt 1.5 mm tief ist,
  // darf an der Frontwand im Bereich der Vertiefung kein Steckkragen/Stufenschnitt liegen (Restwandstärke wäre 0 mm).
  // Die linke Seitenwand ist durch Segment 2 bereits vollständig bis zur Frontwandmitte (Y = -2.97 cm)
  // mit dem Steckkragen versehen. Ein Eckschenkel auf die Frontwand entfällt daher links vollständig,
  // um die Frontwand hinter der Vertiefung 100% massiv und geschlossen zu halten (schließt die Lücke bei Z=5.0-5.3mm).

  const isEthUsb3Merged = Math.round(params.portEthUsb3Merged.value) === 1;

  console.log(`createTongueAndGrooveJoint: Erzeuge 5.0 mm Stufenfalz-Steckkragen mit allen 4 L-Winkel-Ecken auf Case_Bottom (Tiefe: ${depthCm * 10}mm)...`);

  // =========================================================================
  // 1. STECKKRAGEN (Collar) auf Case_Bottom erzeugen
  // =========================================================================
  const sketchCollar = sketches.add(xyPlane);
  sketchCollar.name = "Sketch_Case_Collar";

  // Segment 1: Rückwand (Back Wall)
  // X: von linker Wandmitte (-4.42 cm + clearance) bis rechter Wandmitte (+4.42 cm - clearance)
  // Y: von Gehäuse-Innenwand (+2.82 cm) bis Wandmitte minus Spiel (+2.97 cm - clearance)
  drawRectOnXY(
    sketchCollar,
    leftMidX + clearanceCm,
    rightMidX - clearanceCm,
    innerBackY,
    backMidY - clearanceCm
  );

  // Segment 2: Linke Seitenwand (Left Wall)
  // X: von Wandmitte plus Spiel (-4.42 cm + clearance) bis Innenwand (-4.27 cm)
  // Y: von Frontwandmitte plus Spiel (-2.97 cm + clearance) bis zur Rückwandmitte minus Spiel (+2.97 cm - clearance)
  // -> Verschmilzt an BEIDEN Ecken (Back-Left und Front-Left) nahtlos zu stabilen L-Winkeln!
  drawRectOnXY(
    sketchCollar,
    leftMidX + clearanceCm,
    innerLeftX,
    frontMidY + clearanceCm,
    backMidY - clearanceCm
  );

  // Segment 3: Frontwand rechts (Front-Right Wall, neben Frontanschluss-Vertiefung)
  // X: +0.615 cm bis rechter Wandmitte minus Spiel (+4.42 cm - clearance)
  // Y: von Wandmitte plus Spiel (-2.97 cm + clearance) bis Innenwand (-2.82 cm)
  drawRectOnXY(
    sketchCollar,
    0.615,
    rightMidX - clearanceCm,
    frontMidY + clearanceCm,
    innerFrontY
  );

  // Segment 4: Eckschenkel Front-Right auf rechter Gehäusewand (L-Winkel um die Ecke)
  // X: Innenwand (+4.27 cm) bis Wandmitte minus Spiel (+4.42 cm - clearance)
  // Y: von Frontwandmitte plus Spiel (-2.97 cm + clearance) bis -2.70 cm (vor RJ45-Port)
  drawRectOnXY(
    sketchCollar,
    innerRightX,
    rightMidX - clearanceCm,
    frontMidY + clearanceCm,
    cornerFrontRightYMax
  );

  // Segment 5: Eckschenkel Back-Right auf rechter Gehäusewand (L-Winkel um die Ecke)
  // X: Innenwand (+4.27 cm) bis Wandmitte minus Spiel (+4.42 cm - clearance)
  // Y: von +2.70 cm (nach USB-2.0-Port) bis Rückwandmitte minus Spiel (+2.97 cm - clearance)
  drawRectOnXY(
    sketchCollar,
    innerRightX,
    rightMidX - clearanceCm,
    cornerBackRightYMin,
    backMidY - clearanceCm
  );

  // Segment 6 (Eckschenkel Front-Left auf Frontwand) entfällt vollständig:
  // Verhindert das Durchtrennen der 1.5 mm tiefen Frontanschluss-Vertiefung (X >= -4.105 cm).
  // Die linke Gehäusewand ist durch Segment 2 bereits vollflächig bis frontMidY abgedeckt.

  // Segment 7: Rechte Wand Pfeiler 1 (zwischen RJ45 & Dual USB 3.0)
  // Entfällt für SSD-HAT Kompatibilität (port_eth_usb3_merged)
  if (!isEthUsb3Merged) {
    drawRectOnXY(
      sketchCollar,
      innerRightX,
      rightMidX - clearanceCm,
      pillar1YMin + clearanceCm,
      pillar1YMax - clearanceCm
    );
  }

  // Segment 8: Rechte Wand Pfeiler 2 (zwischen Dual USB 3.0 & Dual USB 2.0)
  // X: Innenwand (+4.27 cm) bis Wandmitte minus Spiel (+4.42 cm - clearance)
  // Y: von Pfeilerbeginn (+0.86 cm + clearance) bis Pfeilerende (+1.15 cm - clearance)
  drawRectOnXY(
    sketchCollar,
    innerRightX,
    rightMidX - clearanceCm,
    pillar2YMin + clearanceCm,
    pillar2YMax - clearanceCm
  );

  // Profile des Steckkragens einsammeln
  const collarProfiles = adsk.core.ObjectCollection.create();
  for (let i = 0; i < sketchCollar.profiles.count; i++) {
    const prof = sketchCollar.profiles.item(i);
    if (prof) collarProfiles.add(prof);
  }

  if (collarProfiles.count === 0) {
    throw new Error("createTongueAndGrooveJoint: Keine Profile in Skizze 'Sketch_Case_Collar' gefunden.");
  }

  // Extrusion nach oben (+Z) mit Join an Case_Bottom
  const collarExtrudeInput = extrudes.createInput(
    collarProfiles,
    adsk.fusion.FeatureOperations.JoinFeatureOperation
  );

  let depthVal: adsk.core.ValueInput | null = null;
  try {
    depthVal = adsk.core.ValueInput.createByString('joint_depth');
  } catch (_e) { }
  if (!depthVal) {
    depthVal = adsk.core.ValueInput.createByReal(depthCm);
  }

  collarExtrudeInput.setDistanceExtent(false, depthVal);
  collarExtrudeInput.participantBodies = [getLiveBody(rootComp, liveBottom, "Case_Bottom")];

  const collarFeat = extrudes.add(collarExtrudeInput);
  if (!collarFeat) {
    throw new Error("createTongueAndGrooveJoint: Extrusion des Steckkragens an Case_Bottom fehlgeschlagen.");
  }
  liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
  console.log(`createTongueAndGrooveJoint: Steckkragen (+${(depthCm * 10).toFixed(1)} mm Höhe) erfolgreich mit Case_Bottom verbunden.`);

  // =========================================================================
  // 1b. MINI-FASE (0.5 mm) an den äußeren Oberkanten des Steckkragens (Z = 5.0 mm)
  // =========================================================================
  try {
    const collarEdgesToChamfer: adsk.fusion.BRepEdge[] = [];
    const Z_TOL = 0.05;

    for (let i = 0; i < liveBottom.edges.count; i++) {
      const e = liveBottom.edges.item(i);
      if (!e || !e.isValid) continue;

      const pStart = e.startVertex.geometry;
      const pEnd = e.endVertex.geometry;

      // Kante muss horizontal bei Z = depthCm (+5.0 mm) liegen
      if (Math.abs(pStart.z - depthCm) > Z_TOL || Math.abs(pEnd.z - depthCm) > Z_TOL) continue;
      if (Math.abs(pStart.z - pEnd.z) > 0.01) continue;

      const midX = (pStart.x + pEnd.x) / 2.0;
      const midY = (pStart.y + pEnd.y) / 2.0;

      // Äußere Kanten des Steckkragens selektieren (Flanke zur Gehäusewand hin):
      // Rückwand Kragen-Außenkante: Y nahe 2.955 cm
      const isBackOuter = midY > 2.90 && midX >= -4.45 && midX <= 4.45;

      // Linke Wand Kragen-Außenkante: X nahe -4.405 cm (vollflächig von Frontwand bis Rückwand)
      const isLeftOuter = midX < -4.35 && midY >= -2.98 && midY <= 2.98;

      // Frontwand rechts Kragen-Außenkante: Y nahe -2.955 cm
      const isFrontOuter = midY < -2.90 && midX >= 0.55 && midX <= 4.45;

      // Rechte Wand Kragen-Außenkanten (Pfeiler 2 sowie die beiden L-Eckschenkel):
      const isRightOuter =
        midX > 4.35 &&
        ((midY >= pillar2YMin - 0.05 && midY <= pillar2YMax + 0.05) ||
          (midY >= -2.98 && midY <= cornerFrontRightYMax + 0.05) ||
          (midY >= cornerBackRightYMin - 0.05 && midY <= 2.98));

      if (isBackOuter || isLeftOuter || isFrontOuter || isRightOuter) {
        collarEdgesToChamfer.push(e);
      }
    }

    console.log(`createTongueAndGrooveJoint: ${collarEdgesToChamfer.length} äußere Oberkanten des Steckkragens bei Z = ${(depthCm * 10).toFixed(1)} mm ermittelt.`);

    if (collarEdgesToChamfer.length > 0) {
      applyChamferWithFallbacks(
        rootComp,
        collarEdgesToChamfer,
        chamferCm,
        "joint_chamfer",
        "CaseCollarMiniChamfer"
      );
      liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
    }
  } catch (chamferErr) {
    console.warn(`createTongueAndGrooveJoint: Mini-Fase an Steckkragen konnte nicht angewendet werden: ${chamferErr}`);
  }

  // =========================================================================
  // 2. STUFENSCHNITT (Step Cut) in Case_Middle ausschneiden
  // =========================================================================
  console.log(`createTongueAndGrooveJoint: Schneide Stufe (Tiefe: ${(stepDepthCm * 10).toFixed(1)} mm) in Case_Middle aus...`);

  const sketchStep = sketches.add(xyPlane);
  sketchStep.name = "Sketch_Case_StepCut";

  // Segment 1: Rückwand Stufe
  // X: von -4.42 cm bis +4.42 cm (vollständige Breite)
  // Y: von Innenwand (+2.82 cm) bis zur Nenn-Wandmitte (+2.97 cm) -> 1.5 mm Stufenbreite
  drawRectOnXY(
    sketchStep,
    leftMidX,
    rightMidX,
    innerBackY,
    backMidY
  );

  // Segment 2: Linke Seitenwand Stufe
  // X: von Nenn-Wandmitte (-4.42 cm) bis Innenwand (-4.27 cm) -> 1.5 mm Stufenbreite
  // Y: von Frontwandmitte (-2.97 cm) bis zur Nenn-Wandmitte (+2.97 cm)
  // -> Verschmilzt an BEIDEN Ecken (Back-Left und Front-Left) nahtlos!
  drawRectOnXY(
    sketchStep,
    leftMidX,
    innerLeftX,
    frontMidY,
    backMidY
  );

  // Segment 3: Frontwand rechts Stufe
  // X: von +0.60 cm bis +4.42 cm (vollständige rechte Frontwand)
  // Y: von Nenn-Wandmitte (-2.97 cm) bis Innenwand (-2.82 cm)
  drawRectOnXY(
    sketchStep,
    0.60,
    rightMidX,
    frontMidY,
    innerFrontY
  );

  // Segment 4: Eckschenkel Front-Right Stufe auf rechter Gehäusewand
  // X: Innenwand (+4.27 cm) bis Nenn-Wandmitte (+4.42 cm)
  // Y: von Frontwandmitte (-2.97 cm) bis -2.70 cm (vor RJ45-Port)
  drawRectOnXY(
    sketchStep,
    innerRightX,
    rightMidX,
    frontMidY,
    cornerFrontRightYMax
  );

  // Segment 5: Eckschenkel Back-Right Stufe auf rechter Gehäusewand
  // X: Innenwand (+4.27 cm) bis Nenn-Wandmitte (+4.42 cm)
  // Y: von +2.70 cm (nach USB-2.0-Port) bis Rückwandmitte (+2.97 cm)
  drawRectOnXY(
    sketchStep,
    innerRightX,
    rightMidX,
    cornerBackRightYMin,
    backMidY
  );

  // Segment 6 (Eckschenkel Front-Left Stufe auf Frontwand) entfällt analog sketchCollar:
  // Hält die Frontwand hinter der Anschlussvertiefung 100% massiv und geschlossen.

  // Segment 7: Rechte Wand Pfeiler 1 Stufe
  if (!isEthUsb3Merged) {
    drawRectOnXY(
      sketchStep,
      innerRightX,
      rightMidX,
      pillar1YMin - 0.01,
      pillar1YMax + 0.01
    );
  }

  // Segment 8: Rechte Wand Pfeiler 2 Stufe
  drawRectOnXY(
    sketchStep,
    innerRightX,
    rightMidX,
    pillar2YMin - 0.01,
    pillar2YMax + 0.01
  );

  // Profile der Stufe einsammeln
  const stepProfiles = adsk.core.ObjectCollection.create();
  for (let i = 0; i < sketchStep.profiles.count; i++) {
    const prof = sketchStep.profiles.item(i);
    if (prof) stepProfiles.add(prof);
  }

  if (stepProfiles.count === 0) {
    throw new Error("createTongueAndGrooveJoint: Keine Profile in Skizze 'Sketch_Case_StepCut' gefunden.");
  }

  // Schnitt-Extrusion nach oben (+Z) in liveTop (Case_Middle)
  const stepCutInput = extrudes.createInput(
    stepProfiles,
    adsk.fusion.FeatureOperations.CutFeatureOperation
  );

  let stepDepthVal: adsk.core.ValueInput | null = null;
  try {
    stepDepthVal = adsk.core.ValueInput.createByString('joint_depth + joint_vertical_clearance');
  } catch (_e) { }
  if (!stepDepthVal) {
    stepDepthVal = adsk.core.ValueInput.createByReal(stepDepthCm);
  }

  stepCutInput.setDistanceExtent(false, stepDepthVal);
  stepCutInput.participantBodies = [getLiveBody(rootComp, liveTop, "Case_Top")];

  const stepCutFeat = extrudes.add(stepCutInput);
  if (!stepCutFeat) {
    throw new Error("createTongueAndGrooveJoint: Stufenschnitt in Case_Middle fehlgeschlagen.");
  }
  liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
  console.log(`createTongueAndGrooveJoint: Stufenschnitt (${(stepDepthCm * 10).toFixed(1)} mm Tiefe, 1.5 mm Breite) erfolgreich in Case_Middle ausgeführt.`);

  // =========================================================================
  // 3. EINRASTFUNKTION (Snap-Fit) an 3 Wänden: 4 Rastnasen insgesamt (p020)
  //    - 2x an der Rückwand (+Y, ecknah bei X = -28 mm und X = +26 mm)
  //    - 1x an der linken Seitenwand (-X, zentriert bei Y = 0)
  //    - 1x an der Frontwand rechts (-Y, zentriert bei X = +22.0 mm)
  // =========================================================================
  try {
    console.log("createTongueAndGrooveJoint: Erzeuge 4 Rastnasen (2x Rückwand ecknah, 1x Linke Wand, 1x Frontwand)...");

    const snapLengthCm = params.jointSnapLength.value;   // 1.8 cm (18 mm)
    const snapDepthCm = params.jointSnapDepth.value;     // 0.025 cm (0.25 mm)
    const snapHeightCm = params.jointSnapHeight.value;   // 0.05 cm (0.5 mm)

    const halfSnapLen = snapLengthCm / 2.0;              // 0.9 cm
    const snapZCenter = depthCm / 2.0;                   // 0.25 cm (2.5 mm über Z=0)
    const snapZMin = snapZCenter - (snapHeightCm / 2.0); // 0.225 cm
    const snapZMax = snapZCenter + (snapHeightCm / 2.0); // 0.275 cm

    const recessHalfLen = halfSnapLen + 0.02;            // +0.2 mm je Seite
    const recessZMin = snapZMin - 0.005;                // +0.05 mm nach unten
    const recessZMax = snapZMax + 0.005;                // +0.05 mm nach oben
    const recessDepthCm = snapDepthCm + 0.005;           // 0.30 mm

    // -----------------------------------------------------------------------
    // 3a. Rückwand (+Y): 2 ecknahe Rastnasen (Back-Left und Back-Right)
    // -----------------------------------------------------------------------
    try {
      const leftSnapCenterX = -2.80; // in cm (-28.0 mm)
      const rightSnapCenterX = 2.60; // in cm (+26.0 mm)

      const leftMinX = leftSnapCenterX - halfSnapLen;
      const leftMaxX = leftSnapCenterX + halfSnapLen;
      const rightMinX = rightSnapCenterX - halfSnapLen;
      const rightMaxX = rightSnapCenterX + halfSnapLen;

      // Zwei Rastwülste auf der Außenflanke des Rückwand-Kragens (Case_Bottom)
      const collarOuterYBack = backMidY - clearanceCm; // 2.955 cm
      const snapPlaneRidgeBack = createOffsetPlane(
        rootComp,
        rootComp.xZConstructionPlane,
        collarOuterYBack,
        undefined
      );

      if (snapPlaneRidgeBack) {
        snapPlaneRidgeBack.name = "Plane_Snap_Ridge_Back";
        const sketchRidgeBack = sketches.add(snapPlaneRidgeBack);
        sketchRidgeBack.name = "Sketch_Snap_Ridge_Back";

        // Linke Rastwulst nahe Back-Left Corner
        drawRectOnXZ(
          sketchRidgeBack,
          leftMinX,
          leftMaxX,
          snapZMin,
          snapZMax,
          collarOuterYBack
        );

        // Rechte Rastwulst nahe Back-Right Corner
        drawRectOnXZ(
          sketchRidgeBack,
          rightMinX,
          rightMaxX,
          snapZMin,
          snapZMax,
          collarOuterYBack
        );

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
          ridgeInput.participantBodies = [getLiveBody(rootComp, liveBottom, "Case_Bottom")];
          const ridgeFeat = extrudes.add(ridgeInput);
          if (ridgeFeat) {
            liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
            console.log(`createTongueAndGrooveJoint: 2 ecknahe Rückwand-Rastwülste (${snapLengthCm * 10}x${snapHeightCm * 10}x${snapDepthCm * 10}mm) angefügt.`);
          }
        }
      }

      // Zwei korrespondierende Rastmulden in der Stufen-Außenwand der Rückwand (Case_Middle)
      const stepOuterYBack = backMidY; // 2.97 cm
      const snapPlaneRecessBack = createOffsetPlane(
        rootComp,
        rootComp.xZConstructionPlane,
        stepOuterYBack,
        undefined
      );

      if (snapPlaneRecessBack) {
        snapPlaneRecessBack.name = "Plane_Snap_Recess_Back";
        const sketchRecessBack = sketches.add(snapPlaneRecessBack);
        sketchRecessBack.name = "Sketch_Snap_Recess_Back";

        const leftRecessMinX = leftSnapCenterX - recessHalfLen;
        const leftRecessMaxX = leftSnapCenterX + recessHalfLen;
        const rightRecessMinX = rightSnapCenterX - recessHalfLen;
        const rightRecessMaxX = rightSnapCenterX + recessHalfLen;

        drawRectOnXZ(
          sketchRecessBack,
          leftRecessMinX,
          leftRecessMaxX,
          recessZMin,
          recessZMax,
          stepOuterYBack
        );

        drawRectOnXZ(
          sketchRecessBack,
          rightRecessMinX,
          rightRecessMaxX,
          recessZMin,
          recessZMax,
          stepOuterYBack
        );

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
          recessInput.participantBodies = [getLiveBody(rootComp, liveTop, "Case_Top")];
          const recessFeat = extrudes.add(recessInput);
          if (recessFeat) {
            liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
            console.log(`createTongueAndGrooveJoint: 2 ecknahe Rückwand-Rastmulden in Stufenwand von Case_Middle ausgeschnitten.`);
          }
        }
      }
    } catch (errBack) {
      console.warn(`createTongueAndGrooveJoint: Rückwand-Rastnasen fehlgeschlagen: ${errBack}`);
    }

    // -----------------------------------------------------------------------
    // 3b. Linke Seitenwand (-X, Left Wall, nach links / +Y verschoben für Taster-Freigang) (p020, p028)
    // -----------------------------------------------------------------------
    try {
      const leftSnapCenterY = params.jointSnapLeftYOffset ? params.jointSnapLeftYOffset.value : 0.5; // in cm (+5.0 mm nach links / +Y verschoben, p028)
      const collarOuterXLeft = leftMidX + clearanceCm; // -4.405 cm
      const snapPlaneRidgeLeft = createOffsetPlane(
        rootComp,
        rootComp.yZConstructionPlane,
        collarOuterXLeft,
        undefined
      );

      if (snapPlaneRidgeLeft) {
        snapPlaneRidgeLeft.name = "Plane_Snap_Ridge_Left";
        const sketchRidgeLeft = sketches.add(snapPlaneRidgeLeft);
        sketchRidgeLeft.name = "Sketch_Snap_Ridge_Left";

        drawRectOnYZ(
          sketchRidgeLeft,
          leftSnapCenterY - halfSnapLen,
          leftSnapCenterY + halfSnapLen,
          snapZMin,
          snapZMax,
          collarOuterXLeft
        );

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
          ridgeInput.participantBodies = [getLiveBody(rootComp, liveBottom, "Case_Bottom")];
          const ridgeFeat = extrudes.add(ridgeInput);
          if (ridgeFeat) {
            liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
            console.log(`createTongueAndGrooveJoint: Linke Seitenwand-Rastwulst (${snapLengthCm * 10}x${snapHeightCm * 10}x${snapDepthCm * 10}mm bei Y = ${(leftSnapCenterY * 10).toFixed(1)}mm) angefügt.`);
          }
        }
      }

      const stepOuterXLeft = leftMidX; // -4.42 cm
      const snapPlaneRecessLeft = createOffsetPlane(
        rootComp,
        rootComp.yZConstructionPlane,
        stepOuterXLeft,
        undefined
      );

      if (snapPlaneRecessLeft) {
        snapPlaneRecessLeft.name = "Plane_Snap_Recess_Left";
        const sketchRecessLeft = sketches.add(snapPlaneRecessLeft);
        sketchRecessLeft.name = "Sketch_Snap_Recess_Left";

        drawRectOnYZ(
          sketchRecessLeft,
          leftSnapCenterY - recessHalfLen,
          leftSnapCenterY + recessHalfLen,
          recessZMin,
          recessZMax,
          stepOuterXLeft
        );

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
          recessInput.participantBodies = [getLiveBody(rootComp, liveTop, "Case_Top")];
          const recessFeat = extrudes.add(recessInput);
          if (recessFeat) {
            liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
            console.log(`createTongueAndGrooveJoint: Linke Seitenwand-Rastmulde (${recessHalfLen * 20}x${((recessZMax - recessZMin) * 10).toFixed(1)}x${(recessDepthCm * 10).toFixed(2)}mm bei Y = ${(leftSnapCenterY * 10).toFixed(1)}mm) ausgeschnitten.`);
          }
        }
      }
    } catch (errLeft) {
      console.warn(`createTongueAndGrooveJoint: Linke Seitenwand-Rastnase fehlgeschlagen: ${errLeft}`);
    }

    // -----------------------------------------------------------------------
    // 3c. Frontwand rechts (-Y, Front-Right Wall, zentriert bei X = 2.20 cm) (p020)
    // -----------------------------------------------------------------------
    try {
      const frontSnapCenterX = (0.615 + 3.785) / 2.0; // 2.20 cm
      const frontMinX = frontSnapCenterX - halfSnapLen;
      const frontMaxX = frontSnapCenterX + halfSnapLen;

      const collarOuterYFront = frontMidY + clearanceCm; // -2.955 cm
      const snapPlaneRidgeFront = createOffsetPlane(
        rootComp,
        rootComp.xZConstructionPlane,
        collarOuterYFront,
        undefined
      );

      if (snapPlaneRidgeFront) {
        snapPlaneRidgeFront.name = "Plane_Snap_Ridge_Front";
        const sketchRidgeFront = sketches.add(snapPlaneRidgeFront);
        sketchRidgeFront.name = "Sketch_Snap_Ridge_Front";

        drawRectOnXZ(
          sketchRidgeFront,
          frontMinX,
          frontMaxX,
          snapZMin,
          snapZMax,
          collarOuterYFront
        );

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
          ridgeInput.participantBodies = [getLiveBody(rootComp, liveBottom, "Case_Bottom")];
          const ridgeFeat = extrudes.add(ridgeInput);
          if (ridgeFeat) {
            liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
            console.log(`createTongueAndGrooveJoint: Frontwand-Rastwulst (${snapLengthCm * 10}x${snapHeightCm * 10}x${snapDepthCm * 10}mm) angefügt.`);
          }
        }
      }

      const stepOuterYFront = frontMidY; // -2.97 cm
      const snapPlaneRecessFront = createOffsetPlane(
        rootComp,
        rootComp.xZConstructionPlane,
        stepOuterYFront,
        undefined
      );

      if (snapPlaneRecessFront) {
        snapPlaneRecessFront.name = "Plane_Snap_Recess_Front";
        const sketchRecessFront = sketches.add(snapPlaneRecessFront);
        sketchRecessFront.name = "Sketch_Snap_Recess_Front";

        const recessFrontMinX = frontSnapCenterX - recessHalfLen;
        const recessFrontMaxX = frontSnapCenterX + recessHalfLen;

        drawRectOnXZ(
          sketchRecessFront,
          recessFrontMinX,
          recessFrontMaxX,
          recessZMin,
          recessZMax,
          stepOuterYFront
        );

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
          recessInput.participantBodies = [getLiveBody(rootComp, liveTop, "Case_Top")];
          const recessFeat = extrudes.add(recessInput);
          if (recessFeat) {
            liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
            console.log(`createTongueAndGrooveJoint: Frontwand-Rastmulde (${recessHalfLen * 20}x${((recessZMax - recessZMin) * 10).toFixed(1)}x${(recessDepthCm * 10).toFixed(2)}mm) ausgeschnitten.`);
          }
        }
      }
    } catch (errFront) {
      console.warn(`createTongueAndGrooveJoint: Frontwand-Rastnase fehlgeschlagen: ${errFront}`);
    }
  } catch (snapErr) {
    console.warn(`createTongueAndGrooveJoint: Einrastfunktion konnte nicht erstellt werden: ${snapErr}`);
  }

  return {
    topBody: getLiveBody(rootComp, liveTop, "Case_Top"),
    bottomBody: getLiveBody(rootComp, liveBottom, "Case_Bottom")
  };
}
