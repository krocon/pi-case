import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import {
  CasePairBodies,
  createCollection,
  getLiveBody,
  createOffsetPlane,
  applyChamferWithFallbacks,
  draw3DRectangle
} from "./utils";

export type CaseBodies = CasePairBodies;

/**
 * Zeichnet ein planares, abgerundetes Rechteck in einer XZ-Ebene bei konstantem Y.
 * Die 4 Ecken werden durch Kreisbögen mit Radius radiusCm abgerundet.
 * Nutzt sketch.modelToSketchSpace() zur fehlerfreien Koordinatentransformation (AGENTS.md §4.4).
 */
function drawRoundedRectangleXZ(
  sketch: adsk.fusion.Sketch,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  yVal: number,
  radiusCm: number
): void {
  const r = Math.min(radiusCm, (maxX - minX) / 2.0, (maxZ - minZ) / 2.0);
  const diagOffset = r * (Math.SQRT2 / 2.0);

  // 1. Top-Right Bogen (TR): von oberer Kante (Z = maxZ) zur rechten Kante (X = maxX)
  const pTRStart = adsk.core.Point3D.create(maxX - r, yVal, maxZ);
  const pTRMid = adsk.core.Point3D.create(maxX - r + diagOffset, yVal, maxZ - r + diagOffset);
  const pTREnd = adsk.core.Point3D.create(maxX, yVal, maxZ - r);

  // 2. Bottom-Right Bogen (BR): von rechter Kante (X = maxX) zur unteren Kante (Z = minZ)
  const pBRStart = adsk.core.Point3D.create(maxX, yVal, minZ + r);
  const pBRMid = adsk.core.Point3D.create(maxX - r + diagOffset, yVal, minZ + r - diagOffset);
  const pBREnd = adsk.core.Point3D.create(maxX - r, yVal, minZ);

  // 3. Bottom-Left Bogen (BL): von unterer Kante (Z = minZ) zur linken Kante (X = minX)
  const pBLStart = adsk.core.Point3D.create(minX + r, yVal, minZ);
  const pBLMid = adsk.core.Point3D.create(minX + r - diagOffset, yVal, minZ + r - diagOffset);
  const pBLEnd = adsk.core.Point3D.create(minX, yVal, minZ + r);

  // 4. Top-Left Bogen (TL): von linker Kante (X = minX) zur oberen Kante (Z = maxZ)
  const pTLStart = adsk.core.Point3D.create(minX, yVal, maxZ - r);
  const pTLMid = adsk.core.Point3D.create(minX + r - diagOffset, yVal, maxZ - r + diagOffset);
  const pTLEnd = adsk.core.Point3D.create(minX + r, yVal, maxZ);

  // Punkte in Skizzenraum konvertieren
  const sTRStart = sketch.modelToSketchSpace(pTRStart);
  const sTRMid = sketch.modelToSketchSpace(pTRMid);
  const sTREnd = sketch.modelToSketchSpace(pTREnd);

  const sBRStart = sketch.modelToSketchSpace(pBRStart);
  const sBRMid = sketch.modelToSketchSpace(pBRMid);
  const sBREnd = sketch.modelToSketchSpace(pBREnd);

  const sBLStart = sketch.modelToSketchSpace(pBLStart);
  const sBLMid = sketch.modelToSketchSpace(pBLMid);
  const sBLEnd = sketch.modelToSketchSpace(pBLEnd);

  const sTLStart = sketch.modelToSketchSpace(pTLStart);
  const sTLMid = sketch.modelToSketchSpace(pTLMid);
  const sTLEnd = sketch.modelToSketchSpace(pTLEnd);

  // 4 Kreisbögen
  const arcs = sketch.sketchCurves.sketchArcs;
  arcs.addByThreePoints(sTRStart, sTRMid, sTREnd);
  arcs.addByThreePoints(sBRStart, sBRMid, sBREnd);
  arcs.addByThreePoints(sBLStart, sBLMid, sBLEnd);
  arcs.addByThreePoints(sTLStart, sTLMid, sTLEnd);

  // 4 verbindende Geraden
  const lines = sketch.sketchCurves.sketchLines;
  lines.addByTwoPoints(sTLEnd, sTRStart); // Oben
  lines.addByTwoPoints(sTREnd, sBRStart); // Rechts
  lines.addByTwoPoints(sBREnd, sBLStart); // Unten
  lines.addByTwoPoints(sBLEnd, sTLStart); // Links
}


/**
 * Führt einen Schnitt durch beide Gehäusehälften mit den Profilen einer Skizze aus.
 * Verwendet participantBodies = [liveTop, liveBottom] für selektives Ausschneiden (AGENTS.md §4.5).
 */
function cutProfilesThroughCase(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  sketch: adsk.fusion.Sketch,
  cutDistanceCm: number,
  logName: string
): CaseBodies {
  const extrudes = rootComp.features.extrudeFeatures;

  const profColl = adsk.core.ObjectCollection.create();
  for (let i = 0; i < sketch.profiles.count; i++) {
    const p = sketch.profiles.item(i);
    if (p) profColl.add(p);
  }

  if (profColl.count === 0) {
    console.warn(`${logName}: Keine Profile in Skizze '${sketch.name}' gefunden.`);
    return { topBody, bottomBody };
  }

  const liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");

  const cutInput = extrudes.createInput(
    profColl,
    adsk.fusion.FeatureOperations.CutFeatureOperation
  );
  cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutDistanceCm));

  // Gezielter Schnitt durch beide Gehäusehälften (AGENTS.md §4.5)
  cutInput.participantBodies = [liveTop, liveBottom];

  const cutFeat = extrudes.add(cutInput);
  if (!cutFeat) {
    throw new Error(`${logName}: Schnitt-Extrusion fehlgeschlagen.`);
  }

  return {
    topBody: getLiveBody(rootComp, liveTop, "Case_Top"),
    bottomBody: getLiveBody(rootComp, liveBottom, "Case_Bottom")
  };
}

/**
 * Schneidet die frontseitigen Gehäuseöffnungen aus (Wand bei Y = -case_depth/2 = -31.2 mm):
 * - USB-C Stromanschluss (Center X = -31.3 mm)
 * - Micro HDMI 0 (Center X = -16.7 mm)
 * - Micro HDMI 1 (Center X = -3.3 mm)
 *
 * Alle Öffnungen sind parametrisch an pi5_z_offset sowie pi5_x_offset gekoppelt.
 */
export function createFrontPortCutouts(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): CaseBodies {
  const xOffset = params.pi5XOffset.value; // in cm
  const zOffset = params.pi5ZOffset.value; // in cm

  // Konstruktionsebene außerhalb der Gehäusefront bei Y = -3.5 cm (Wand liegt bei Y = -2.9 cm)
  const planeInput = rootComp.constructionPlanes.createInput();
  planeInput.setByOffset(
    rootComp.xZConstructionPlane,
    adsk.core.ValueInput.createByReal(-3.5)
  );
  const frontPlane = rootComp.constructionPlanes.add(planeInput);
  if (!frontPlane) {
    throw new Error("Erstellung der Konstruktionsebene für Front-Ports fehlgeschlagen.");
  }
  frontPlane.name = "Plane_Front_Ports";

  const sketch = rootComp.sketches.add(frontPlane);
  sketch.name = "Sketch_Front_Ports";
  const yPlane = -3.5;

  // 1. USB-C Port: Center X = -31.3 mm (-3.13 cm), sitzt auf PCB-Oberseite (wie Netzwerk & USB)
  const usbcCenterX = -3.13 + xOffset;
  const usbcHalfW = params.portUsbcWidth.value / 2.0;
  const usbcH = params.portUsbcHeight.value;
  const usbcZMin = zOffset;
  const usbcZMax = zOffset + usbcH;

  draw3DRectangle(
    sketch,
    adsk.core.Point3D.create(usbcCenterX - usbcHalfW, yPlane, usbcZMin),
    adsk.core.Point3D.create(usbcCenterX + usbcHalfW, yPlane, usbcZMin),
    adsk.core.Point3D.create(usbcCenterX + usbcHalfW, yPlane, usbcZMax),
    adsk.core.Point3D.create(usbcCenterX - usbcHalfW, yPlane, usbcZMax)
  );

  // 2. Micro HDMI 0: Center X = -16.7 mm (-1.67 cm), sitzt auf PCB-Oberseite
  const hdmiHalfW = params.portHdmiWidth.value / 2.0;
  const hdmiH = params.portHdmiHeight.value;
  const hdmiZMin = zOffset;
  const hdmiZMax = zOffset + hdmiH;

  const hdmi0CenterX = -1.67 + xOffset;
  draw3DRectangle(
    sketch,
    adsk.core.Point3D.create(hdmi0CenterX - hdmiHalfW, yPlane, hdmiZMin),
    adsk.core.Point3D.create(hdmi0CenterX + hdmiHalfW, yPlane, hdmiZMin),
    adsk.core.Point3D.create(hdmi0CenterX + hdmiHalfW, yPlane, hdmiZMax),
    adsk.core.Point3D.create(hdmi0CenterX - hdmiHalfW, yPlane, hdmiZMax)
  );

  // 3. Micro HDMI 1: Center X = -3.3 mm (-0.33 cm), sitzt auf PCB-Oberseite
  const hdmi1CenterX = -0.33 + xOffset;
  draw3DRectangle(
    sketch,
    adsk.core.Point3D.create(hdmi1CenterX - hdmiHalfW, yPlane, hdmiZMin),
    adsk.core.Point3D.create(hdmi1CenterX + hdmiHalfW, yPlane, hdmiZMin),
    adsk.core.Point3D.create(hdmi1CenterX + hdmiHalfW, yPlane, hdmiZMax),
    adsk.core.Point3D.create(hdmi1CenterX - hdmiHalfW, yPlane, hdmiZMax)
  );

  // Schnitt nach +Y durch die Frontwand (Länge 1.5 cm reicht von Y = -3.5 auf Y = -2.0 cm)
  return cutProfilesThroughCase(
    rootComp,
    topBody,
    bottomBody,
    sketch,
    1.5,
    "FrontPortCutouts"
  );
}

/**
 * Zeichnet den kombinierten, gestuften Ausschnitt für RJ45 und Dual-USB 3.0
 * auf einer YZ-Ebene bei konstantem X (gemäß prompt/p018/img_08.png):
 * - RJ45-Bereich links: Höhe ethH (14.5 mm) mit Verrundung oben-links (rCorner)
 * - USB 3.0-Bereich rechts: Höhe usb3H (16.5 mm) mit Verrundung oben-rechts (rCorner)
 * - Harmonischer S-Kurven-Übergang über den ehemaligen Stegbereich (stepYMin bis stepYMax)
 * - Unterkante eben bei Z = zMin (Z = 0)
 */
function drawSteppedRightPortCutout(
  sketch: adsk.fusion.Sketch,
  xVal: number,
  minY: number,
  maxY: number,
  ethH: number,
  usb3H: number,
  stepYMin: number,
  stepYMax: number,
  zMin: number,
  rCorner: number
): void {
  const lines = sketch.sketchCurves.sketchLines;
  const arcs = sketch.sketchCurves.sketchArcs;
  const diagOffset = rCorner * (1.0 - Math.SQRT2 / 2.0);

  // 1. Unterkante von P0 (minY, zMin) nach P1 (maxY, zMin)
  const p0 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY, zMin));
  const p1 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY, zMin));
  lines.addByTwoPoints(p0, p1);

  // 2. Rechte Vertikalkante bis Beginn der oberen rechten Verrundung
  const p2 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY, zMin + usb3H - rCorner));
  lines.addByTwoPoints(p1, p2);

  // 3. Obere rechte Verrundung (TR Bogen)
  const pTRMid = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY - diagOffset, zMin + usb3H - diagOffset));
  const p3 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY - rCorner, zMin + usb3H));
  arcs.addByThreePoints(p2, pTRMid, p3);

  // 4. USB 3.0 Deckenlinie bis zum Beginn der Stufe bei stepYMax
  const p4 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, stepYMax, zMin + usb3H));
  lines.addByTwoPoints(p3, p4);

  // 5. S-Kurven-Stufe zwischen (stepYMax, usb3H) und (stepYMin, ethH)
  const stepDy = stepYMax - stepYMin;
  const stepDz = usb3H - ethH;
  const yMid = (stepYMin + stepYMax) / 2.0;
  const zMid = zMin + (ethH + usb3H) / 2.0;

  const pMid = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, yMid, zMid));
  // Oberer Bogen (konvex)
  const pArcUpperMid = sketch.modelToSketchSpace(
    adsk.core.Point3D.create(xVal, stepYMax - 0.25 * stepDy, zMin + usb3H - 0.135 * stepDz)
  );
  arcs.addByThreePoints(p4, pArcUpperMid, pMid);

  // Unterer Bogen (konkav)
  const p5 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, stepYMin, zMin + ethH));
  const pArcLowerMid = sketch.modelToSketchSpace(
    adsk.core.Point3D.create(xVal, stepYMin + 0.25 * stepDy, zMin + ethH + 0.135 * stepDz)
  );
  arcs.addByThreePoints(pMid, pArcLowerMid, p5);

  // 6. RJ45 Deckenlinie bis zum Beginn der oberen linken Verrundung
  const p6 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY + rCorner, zMin + ethH));
  lines.addByTwoPoints(p5, p6);

  // 7. Obere linke Verrundung (TL Bogen)
  const pTLMid = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY + diagOffset, zMin + ethH - diagOffset));
  const p7 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY, zMin + ethH - rCorner));
  arcs.addByThreePoints(p6, pTLMid, p7);

  // 8. Linke Vertikalkante zurück zu P0
  lines.addByTwoPoints(p7, p0);
}

/**
 * Zeichnet den USB 2.0 Ausschnitt mit verrundeten oberen Ecken (prompt/p018/img_08.png).
 */
function drawUsb2WithRoundedCorners(
  sketch: adsk.fusion.Sketch,
  xVal: number,
  minY: number,
  maxY: number,
  hVal: number,
  zMin: number,
  rCorner: number
): void {
  const lines = sketch.sketchCurves.sketchLines;
  const arcs = sketch.sketchCurves.sketchArcs;
  const diagOffset = rCorner * (1.0 - Math.SQRT2 / 2.0);

  const p0 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY, zMin));
  const p1 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY, zMin));
  const p2 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY, zMin + hVal - rCorner));

  const pTRMid = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY - diagOffset, zMin + hVal - diagOffset));
  const p3 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, maxY - rCorner, zMin + hVal));

  const p4 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY + rCorner, zMin + hVal));
  const pTLMid = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY + diagOffset, zMin + hVal - diagOffset));
  const p5 = sketch.modelToSketchSpace(adsk.core.Point3D.create(xVal, minY, zMin + hVal - rCorner));

  lines.addByTwoPoints(p0, p1);
  lines.addByTwoPoints(p1, p2);
  arcs.addByThreePoints(p2, pTRMid, p3);
  lines.addByTwoPoints(p3, p4);
  arcs.addByThreePoints(p4, pTLMid, p5);
  lines.addByTwoPoints(p5, p0);
}

/**
 * Schneidet die rechtsseitigen Gehäuseöffnungen aus (Wand bei X = +case_width/2 = +45.7 mm):
 * - Bei port_eth_usb3_merged === 1: Kombinierter, gestufter Ausschnitt für RJ45 und Dual-USB 3.0 (img_08.png)
 * - Dual USB 2.0 (schwarz) mit verrundeten oberen Ecken (Center Y = +19.0 mm)
 *
 * Alle Öffnungen sind parametrisch an pi5_z_offset sowie pi5_y_offset gekoppelt.
 */
export function createRightPortCutouts(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): CaseBodies {
  const yOffset = params.pi5YOffset.value; // in cm
  const zOffset = params.pi5ZOffset.value; // in cm

  // Konstruktionsebene außerhalb der rechten Gehäusewand bei X = +5.0 cm (Wand liegt bei X = +4.45 cm)
  const planeInput = rootComp.constructionPlanes.createInput();
  planeInput.setByOffset(
    rootComp.yZConstructionPlane,
    adsk.core.ValueInput.createByReal(5.0)
  );
  const rightPlane = rootComp.constructionPlanes.add(planeInput);
  if (!rightPlane) {
    throw new Error("Erstellung der Konstruktionsebene für Right-Ports fehlgeschlagen.");
  }
  rightPlane.name = "Plane_Right_Ports";

  const sketch = rootComp.sketches.add(rightPlane);
  sketch.name = "Sketch_Right_Ports";
  const xPlane = 5.0;

  const isMerged = Math.round(params.portEthUsb3Merged.value) === 1;
  const rCorner = params.portCornerRadius ? params.portCornerRadius.value : 0.15; // 1.5 mm

  const ethCenterY = -1.78 + yOffset;
  const ethHalfW = params.portEthWidth.value / 2.0;
  const ethH = params.portEthHeight.value;

  const usb3CenterY = 0.11 + yOffset;
  const usb3HalfW = params.portUsb3Width.value / 2.0;
  const usb3H = params.portUsb3Height.value;

  if (isMerged) {
    // Schritt 15 / p018: Gestufter, kombinierter Ausschnitt für Gigabit Ethernet RJ45 und Dual USB 3.0
    // ohne Zwischensteg ("erstes Bein"), mit harmonischem S-Kurven-Übergang (prompt/p018/img_08.png)
    const mergedMinY = ethCenterY - ethHalfW; // -2.605 cm (-26.05 mm)
    const mergedMaxY = usb3CenterY + usb3HalfW; // +0.860 cm (+8.60 mm)
    const stepYMin = ethCenterY + ethHalfW;   // -0.955 cm (-9.55 mm)
    const stepYMax = usb3CenterY - usb3HalfW;  // -0.640 cm (-6.40 mm)

    drawSteppedRightPortCutout(
      sketch,
      xPlane,
      mergedMinY,
      mergedMaxY,
      ethH,
      usb3H,
      stepYMin,
      stepYMax,
      zOffset,
      rCorner
    );
  } else {
    // Fallback: 1. Gigabit Ethernet RJ45 (getrennt)
    draw3DRectangle(
      sketch,
      adsk.core.Point3D.create(xPlane, ethCenterY - ethHalfW, zOffset),
      adsk.core.Point3D.create(xPlane, ethCenterY + ethHalfW, zOffset),
      adsk.core.Point3D.create(xPlane, ethCenterY + ethHalfW, zOffset + ethH),
      adsk.core.Point3D.create(xPlane, ethCenterY - ethHalfW, zOffset + ethH)
    );

    // Fallback: 2. Dual USB 3.0 (blau, getrennt)
    draw3DRectangle(
      sketch,
      adsk.core.Point3D.create(xPlane, usb3CenterY - usb3HalfW, zOffset),
      adsk.core.Point3D.create(xPlane, usb3CenterY + usb3HalfW, zOffset),
      adsk.core.Point3D.create(xPlane, usb3CenterY + usb3HalfW, zOffset + usb3H),
      adsk.core.Point3D.create(xPlane, usb3CenterY - usb3HalfW, zOffset + usb3H)
    );
  }

  // 3. Dual USB 2.0 (schwarz): Center Y = +19.0 mm (+1.90 cm) mit verrundeten oberen Ecken (img_08.png)
  const usb2CenterY = 1.90 + yOffset;
  const usb2HalfW = params.portUsb2Width.value / 2.0;
  const usb2H = params.portUsb2Height.value;

  drawUsb2WithRoundedCorners(
    sketch,
    xPlane,
    usb2CenterY - usb2HalfW,
    usb2CenterY + usb2HalfW,
    usb2H,
    zOffset,
    rCorner
  );

  // Schnitt nach -X durch die rechte Wand (Länge -1.5 cm reicht von X = +5.0 auf X = +3.5 cm)
  return cutProfilesThroughCase(
    rootComp,
    topBody,
    bottomBody,
    sketch,
    -1.5,
    "RightPortCutouts"
  );
}

/**
 * Schneidet die innenliegende Aussparung (Tasche) für die Geekworm X1001 SSD-Halterung
 * in die rechte Gehäusewand (prompt/p018/img_09.png & img_10.png):
 * - Ebene auf der Gehäuse-Innenwand: X = case_width/2 - shell_thickness (+42.7 mm)
 * - Breite: von der Front-Innenwand (Y = -case_depth/2 + shell_thickness = -28.2 mm)
 *   bis zur Kante des USB 3.0-Ausschnitts (Y = +8.60 mm)
 * - Höhe: ssd_pocket_height (24.00 mm ab Z=0)
 * - Obere Ecken verrundet mit R = ssd_pocket_corner_radius (3.00 mm)
 * - Extrusionsschnitt nach außen (+X): ssd_pocket_depth (2.5 mm Schnitttiefe, 0.5 mm Restwand)
 */
export function createInnerSsdPocket(
  rootComp: adsk.fusion.Component,
  middleBody: adsk.fusion.BRepBody,
  topBody: adsk.fusion.BRepBody,
  params: Params
): { middleBody: adsk.fusion.BRepBody; topBody: adsk.fusion.BRepBody } {
  const isMerged = Math.round(params.portEthUsb3Merged.value) === 1;
  if (!isMerged) {
    return { middleBody, topBody };
  }

  const innerX =
    (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0; // +4.27 cm
  const frontInnerY = -params.caseDepth.value / 2.0 + params.shellThickness.value; // -2.82 cm
  const usb3CenterY = 0.11 + params.pi5YOffset.value;
  const usb3HalfW = params.portUsb3Width.value / 2.0;
  const backY = usb3CenterY + usb3HalfW; // +0.86 cm

  const pocketHeight = params.ssdPocketHeight.value; // 2.40 cm (24 mm)
  const pocketDepth = params.ssdPocketDepth.value;   // 0.25 cm (2.5 mm)
  const rCorner = params.ssdPocketCornerRadius.value; // 0.30 cm (3 mm)
  const zMin = params.pi5ZOffset.value; // 0.0 cm

  // 1. Hilfsebene auf der Innenwand bei X = +4.27 cm erzeugen
  const planeInput = rootComp.constructionPlanes.createInput();
  planeInput.setByOffset(
    rootComp.yZConstructionPlane,
    adsk.core.ValueInput.createByReal(innerX)
  );
  const pocketPlane = rootComp.constructionPlanes.add(planeInput);
  if (!pocketPlane) {
    throw new Error("createInnerSsdPocket: Erstellung der Konstruktionsebene auf der Innenwand fehlgeschlagen.");
  }
  pocketPlane.name = "Plane_Right_SsdPocket";

  // 2. Skizze auf der Hilfsebene erzeugen
  const sketch = rootComp.sketches.add(pocketPlane);
  sketch.name = "Sketch_Right_SsdPocket";

  const lines = sketch.sketchCurves.sketchLines;
  const arcs = sketch.sketchCurves.sketchArcs;
  const diagOffset = rCorner * (1.0 - Math.SQRT2 / 2.0);

  const minY = frontInnerY;
  const maxY = backY;
  const maxZ = zMin + pocketHeight;

  const pBottomLeft = sketch.modelToSketchSpace(adsk.core.Point3D.create(innerX, minY, zMin));
  const pBottomRight = sketch.modelToSketchSpace(adsk.core.Point3D.create(innerX, maxY, zMin));

  const pRightTop = sketch.modelToSketchSpace(adsk.core.Point3D.create(innerX, maxY, maxZ - rCorner));
  const pTRMid = sketch.modelToSketchSpace(adsk.core.Point3D.create(innerX, maxY - diagOffset, maxZ - diagOffset));
  const pTopRight = sketch.modelToSketchSpace(adsk.core.Point3D.create(innerX, maxY - rCorner, maxZ));

  const pTopLeft = sketch.modelToSketchSpace(adsk.core.Point3D.create(innerX, minY + rCorner, maxZ));
  const pTLMid = sketch.modelToSketchSpace(adsk.core.Point3D.create(innerX, minY + diagOffset, maxZ - diagOffset));
  const pLeftTop = sketch.modelToSketchSpace(adsk.core.Point3D.create(innerX, minY, maxZ - rCorner));

  lines.addByTwoPoints(pBottomLeft, pBottomRight);
  lines.addByTwoPoints(pBottomRight, pRightTop);
  arcs.addByThreePoints(pRightTop, pTRMid, pTopRight);
  lines.addByTwoPoints(pTopRight, pTopLeft);
  arcs.addByThreePoints(pTopLeft, pTLMid, pLeftTop);
  lines.addByTwoPoints(pLeftTop, pBottomLeft);

  // 3. Extrusionsschnitt nach außen (+X)
  const extrudes = rootComp.features.extrudeFeatures;
  const profColl = adsk.core.ObjectCollection.create();
  for (let i = 0; i < sketch.profiles.count; i++) {
    const p = sketch.profiles.item(i);
    if (p) profColl.add(p);
  }

  if (profColl.count === 0) {
    throw new Error("createInnerSsdPocket: Keine Profile in Skizze 'Sketch_Right_SsdPocket' gefunden.");
  }

  const isMergedMode = (middleBody && middleBody.name === "Case_Main") || middleBody === topBody;
  const middleName = isMergedMode ? "Case_Main" : "Case_Middle";
  const liveMiddle = getLiveBody(rootComp, middleBody, middleName);
  const liveTop = isMergedMode ? null : getLiveBody(rootComp, topBody, "Case_Top");
  const cutInput = extrudes.createInput(profColl, adsk.fusion.FeatureOperations.CutFeatureOperation);

  // Normale der Ebene zeigt nach +X; Schnitt nach außen in die Wand hinein
  const planeNormX = (pocketPlane.geometry as adsk.core.Plane).normal.x;
  const cutSign = planeNormX >= 0 ? 1.0 : -1.0;

  let depthVal: adsk.core.ValueInput | null = null;
  try {
    depthVal = adsk.core.ValueInput.createByString('ssd_pocket_depth');
  } catch (_e) {}
  if (!depthVal) {
    depthVal = adsk.core.ValueInput.createByReal(cutSign * pocketDepth);
  } else if (cutSign < 0) {
    depthVal = adsk.core.ValueInput.createByReal(cutSign * pocketDepth);
  }

  cutInput.setDistanceExtent(false, depthVal);
  // Schneidet Case_Middle (oder Case_Main) und ggf. Case_Top aus (AGENTS.md §4.5, prompt/p018/img_10.png)
  const participants: adsk.fusion.BRepBody[] = [];
  if (liveMiddle && liveMiddle.isValid) participants.push(liveMiddle);
  if (liveTop && liveTop.isValid && liveTop !== liveMiddle && !participants.includes(liveTop)) {
    participants.push(liveTop);
  }
  cutInput.participantBodies = participants;

  const cutFeat = extrudes.add(cutInput);
  if (!cutFeat) {
    // Fallback: Falls der kombinierte Schnitt fehlschlägt, versuche Einzelschnitte
    console.warn("createInnerSsdPocket: Kombinierter Schnitt fehlgeschlagen, versuche Einzelschnitte...");
    try {
      const cutInputMid = extrudes.createInput(profColl, adsk.fusion.FeatureOperations.CutFeatureOperation);
      cutInputMid.setDistanceExtent(false, depthVal);
      cutInputMid.participantBodies = [liveMiddle];
      extrudes.add(cutInputMid);
    } catch (e) {
      console.warn(`createInnerSsdPocket: Schnitt in ${middleName} fehlgeschlagen: ${e}`);
    }
    if (liveTop && liveTop !== liveMiddle) {
      try {
        const cutInputTop = extrudes.createInput(profColl, adsk.fusion.FeatureOperations.CutFeatureOperation);
        cutInputTop.setDistanceExtent(false, depthVal);
        cutInputTop.participantBodies = [liveTop];
        extrudes.add(cutInputTop);
      } catch (e) {
        console.warn(`createInnerSsdPocket: Schnitt in Case_Top fehlgeschlagen: ${e}`);
      }
    }
  }

  const finalMiddle = getLiveBody(rootComp, liveMiddle, middleName);
  finalMiddle.name = middleName;
  const finalTop = liveTop ? getLiveBody(rootComp, liveTop, "Case_Top") : finalMiddle;
  if (liveTop) {
    finalTop.name = "Case_Top";
  }

  console.log(
    `createInnerSsdPocket: SSD-Tasche (${((maxY - minY) * 10).toFixed(1)}x${(pocketHeight * 10).toFixed(1)}mm, ${(pocketDepth * 10).toFixed(1)}mm tief, R${(rCorner * 10).toFixed(1)}mm) erfolgreich in ${middleName}${liveTop ? ' und Case_Top' : ''} ausgeschnitten.`
  );
  return {
    middleBody: finalMiddle,
    topBody: finalTop
  };
}

/**
 * Schneidet sämtliche Anschlüsse des Raspberry Pi 5 in das Gehäuse.
 */
export function createAllPortCutouts(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): CaseBodies {
  console.log("Schneide Front-Anschlüsse (USB-C, Micro HDMI 0, Micro HDMI 1)...");
  let bodies = createFrontPortCutouts(rootComp, topBody, bottomBody, params);

  console.log("Schneide rechte Anschlüsse (RJ45, Dual USB 3.0, Dual USB 2.0)...");
  bodies = createRightPortCutouts(rootComp, bodies.topBody, bodies.bottomBody, params);

  // Linke Gehäusewand bleibt geschlossen
  console.log("Linke Gehäusewand bleibt geschlossen.");

  return bodies;
}

/**
 * Schneidet die frontseitige Vertiefung (Recess / Bezel) um die Front-Anschlüsse
 * (USB-C, Micro HDMI 0, Micro HDMI 1) aus:
 * - Umschließt die drei Anschlüsse mit einem Versatz von front_recess_offset (4 mm)
 * - Rundet die 4 Ecken mit front_recess_corner_radius (3 mm) ab
 * - Schneidet front_recess_depth (1.5 mm) tief nach innen (+Y) in beide Gehäusekörper
 */
export function createFrontPortRecess(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): CaseBodies {
  const xOffset = params.pi5XOffset.value; // in cm
  const zOffset = params.pi5ZOffset.value; // in cm
  const recessOffset = params.frontRecessOffset.value; // in cm (0.4 cm)
  const cornerRadius = params.frontRecessCornerRadius.value; // in cm (0.3 cm)
  const recessDepth = params.frontRecessDepth.value; // in cm (0.15 cm)

  // 1. Min/Max der drei Front-Ports ermitteln (wie in createFrontPortCutouts)
  const usbcCenterX = -3.13 + xOffset;
  const usbcHalfW = params.portUsbcWidth.value / 2.0;
  const usbcH = params.portUsbcHeight.value;

  const hdmiH = params.portHdmiHeight.value;
  const hdmi1CenterX = -0.33 + xOffset;
  const hdmiHalfW = params.portHdmiWidth.value / 2.0;

  // Äußere Bounding-Box der 3 Anschlüsse
  const minXPorts = usbcCenterX - usbcHalfW;
  const maxXPorts = hdmi1CenterX + hdmiHalfW;
  const minZPorts = zOffset;
  const maxZPorts = zOffset + Math.max(usbcH, hdmiH);

  // Bounding-Box mit Versatz erweitern (4 mm)
  const rectMinX = minXPorts - recessOffset;
  const rectMaxX = maxXPorts + recessOffset;
  const rectMinZ = minZPorts - recessOffset;
  const rectMaxZ = maxZPorts + recessOffset;

  // 2. Konstruktionsebene an der Gehäusefront bei Y = -(case_depth / 2)
  const frontY = -params.caseDepth.value / 2.0;
  const planeInput = rootComp.constructionPlanes.createInput();
  planeInput.setByOffset(
    rootComp.xZConstructionPlane,
    adsk.core.ValueInput.createByReal(frontY)
  );
  const recessPlane = rootComp.constructionPlanes.add(planeInput);
  if (!recessPlane) {
    throw new Error("Erstellung der Konstruktionsebene für Front-Vertiefung fehlgeschlagen.");
  }
  recessPlane.name = "Plane_Front_Recess";

  // 3. Skizze auf dieser Hilfsebene erzeugen
  const sketch = rootComp.sketches.add(recessPlane);
  sketch.name = "Sketch_Front_Recess";

  // Abgerundetes Rechteck zeichnen
  drawRoundedRectangleXZ(
    sketch,
    rectMinX,
    rectMaxX,
    rectMinZ,
    rectMaxZ,
    frontY,
    cornerRadius
  );

  // 4. Profil ermitteln
  if (sketch.profiles.count === 0) {
    throw new Error("createFrontPortRecess: Kein Profil in Skizze 'Sketch_Front_Recess' gefunden.");
  }
  let recessProfile: adsk.fusion.Profile | null = null;
  let maxArea = -1;
  for (let i = 0; i < sketch.profiles.count; i++) {
    const p = sketch.profiles.item(i);
    if (p && p.areaProperties().area > maxArea) {
      maxArea = p.areaProperties().area;
      recessProfile = p;
    }
  }
  if (!recessProfile) {
    throw new Error("createFrontPortRecess: Konnte Profil für Front-Vertiefung nicht ermitteln.");
  }

  // 5. Schnitt nach innen (+Y) um recessDepth ausführen
  const extrudes = rootComp.features.extrudeFeatures;
  const liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");

  // Richtung bestimmen: Normalenvektor der Ebene in Y-Richtung prüfen
  const planeNormalY = (recessPlane.geometry as adsk.core.Plane).normal.y;
  const extrudeSign = planeNormalY >= 0 ? 1.0 : -1.0;
  const cutDistance = extrudeSign * recessDepth;

  const cutInput = extrudes.createInput(
    createCollection([recessProfile]),
    adsk.fusion.FeatureOperations.CutFeatureOperation
  );
  cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutDistance));
  cutInput.participantBodies = [liveTop, liveBottom];

  const cutFeat = extrudes.add(cutInput);
  if (!cutFeat) {
    throw new Error("createFrontPortRecess: Schnitt-Extrusion für Front-Vertiefung fehlgeschlagen.");
  }

  return {
    topBody: getLiveBody(rootComp, liveTop, "Case_Top"),
    bottomBody: getLiveBody(rootComp, liveBottom, "Case_Bottom")
  };
}

/**
 * Schritt 17 (prompt/p004 / p023):
 * Lüftungsschlitze im Deckel von 'Case_Top' erzeugen:
 * - Konstruktionsebene auf der Deckeloberseite bei Z = case_top_height (40 mm)
 * - 6 Schlitze gleichverteilt: Rechtecke 80 mm (X) x 2.5 mm (Y)
 * - Symmetrische Anordnung über 22 mm Gesamtabstand vom Zentrum nach ±Y (Spanne 44 mm)
 *   Rasterabstand Delta Y = 44 mm / 5 = 8.80 mm
 *   (Y = ±4.40 mm, ±13.20 mm, ±22.00 mm)
 * - Schnitt-Extrusion um -4 mm nach innen in Case_Top mit 25° Verjüngungswinkel
 */
export function createLidVentilationSlots(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  params: Params
): adsk.fusion.BRepBody {
  let liveTop = getLiveBody(rootComp, topBody, "Case_Top");

  const topHeightCm = params.caseTopHeight.value; // 4.0 cm (40 mm)
  const slotLengthCm = params.lidVentSlotLength.value; // 8.0 cm (80 mm)
  const slotWidthCm = params.lidVentSlotWidth.value; // 0.25 cm (2.5 mm)
  const patternDistCm = params.lidVentPatternDistance.value; // 2.2 cm (22 mm)
  const slotCount = params.lidVentSlotCount
    ? Math.max(2, Math.round(params.lidVentSlotCount.value))
    : 6;
  const intervals = slotCount - 1; // 5
  const stepCm = (2.0 * patternDistCm) / intervals; // 4.4 cm / 5 = 0.88 cm (8.8 mm)

  // 1. Konstruktionsebene auf Deckeloberseite
  const lidPlane = createOffsetPlane(
    rootComp,
    rootComp.xYConstructionPlane,
    topHeightCm,
    "case_top_height"
  );
  if (!lidPlane) {
    throw new Error("createLidVentilationSlots: Konstruktionsebene für Deckel-Lüftungsschlitze konnte nicht erstellt werden.");
  }
  lidPlane.name = "Plane_Lid_Vents";

  // 2. Skizze auf Deckelebene
  const sketch = rootComp.sketches.add(lidPlane);
  sketch.name = "Sketch_Lid_Vent_Slots";

  // 3. Alle 6 Schlitz-Rechtecke einzeichnen (gleichverteilt und symmetrisch zu Y = 0)
  const halfLCm = slotLengthCm / 2.0; // 4.0 cm (40 mm)
  const halfWCm = slotWidthCm / 2.0; // 0.125 cm (1.25 mm)

  for (let k = 0; k < slotCount; k++) {
    const centerYCm = -patternDistCm + k * stepCm;
    const p0 = adsk.core.Point3D.create(-halfLCm, centerYCm - halfWCm, topHeightCm);
    const p1 = adsk.core.Point3D.create(halfLCm, centerYCm - halfWCm, topHeightCm);
    const p2 = adsk.core.Point3D.create(halfLCm, centerYCm + halfWCm, topHeightCm);
    const p3 = adsk.core.Point3D.create(-halfLCm, centerYCm + halfWCm, topHeightCm);
    draw3DRectangle(sketch, p0, p1, p2, p3);
  }

  // 4. Profile der Schlitze ermitteln
  const expectedAreaCm2 = slotLengthCm * slotWidthCm; // 8.0 * 0.25 = 2.0 cm²
  const slotProfiles = adsk.core.ObjectCollection.create();

  for (let i = 0; i < sketch.profiles.count; i++) {
    const prof = sketch.profiles.item(i);
    if (!prof) continue;
    const area = prof.areaProperties().area;
    // Profil entspricht einem Schlitz-Rechteck
    if (Math.abs(area - expectedAreaCm2) < 0.25) {
      slotProfiles.add(prof);
    }
  }

  // Fallback: Falls Flächenberechnung abweicht, nimm alle Profile bis max. slotCount
  if (slotProfiles.count === 0 && sketch.profiles.count > 0) {
    for (let i = 0; i < sketch.profiles.count; i++) {
      const p = sketch.profiles.item(i);
      if (p) slotProfiles.add(p);
    }
  }

  if (slotProfiles.count === 0) {
    throw new Error("createLidVentilationSlots: Keine Profile für Deckel-Lüftungsschlitze gefunden.");
  }

  console.log(`Deckel-Lüftungsschlitze: ${slotProfiles.count} Profile erkannt (erwartet: ${slotCount}).`);

  // 5. Schnitt-Extrusion mit mehrstufigem Fallback (Taper Angle & Tiefe)
  const extrudes = rootComp.features.extrudeFeatures;
  let cutFeat: adsk.fusion.ExtrudeFeature | null = null;
  const cutDepthVal = params.lidVentCutDepth.value; // in cm: -0.4 cm (-4 mm)
  const taperVal = params.lidVentTaperAngle.value; // in rad (25 deg)

  // Stufe 1: Voll parametrisch mit Parameternamen
  try {
    const cutInput = extrudes.createInput(
      slotProfiles,
      adsk.fusion.FeatureOperations.CutFeatureOperation
    );
    cutInput.participantBodies = [liveTop];
    cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByString('lid_vent_cut_depth'));
    cutInput.taperAngle = adsk.core.ValueInput.createByString('lid_vent_taper_angle');
    cutFeat = extrudes.add(cutInput);
  } catch (e1) {
    console.warn(`Lid Vents: Stufe 1 (parametrisch) fehlgeschlagen: ${e1}`);
  }

  // Stufe 2: Direkte Zahlenwerte mit positivem Taper Angle
  if (!cutFeat) {
    try {
      const cutInput = extrudes.createInput(
        slotProfiles,
        adsk.fusion.FeatureOperations.CutFeatureOperation
      );
      cutInput.participantBodies = [liveTop];
      cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutDepthVal));
      cutInput.taperAngle = adsk.core.ValueInput.createByReal(taperVal);
      cutFeat = extrudes.add(cutInput);
    } catch (e2) {
      console.warn(`Lid Vents: Stufe 2 (direkte Werte mit taperAngle) fehlgeschlagen: ${e2}`);
    }
  }

  // Stufe 3: Direkte Zahlenwerte mit invertiertem Taper Angle (falls Fusion Vorzeichen umkehrt)
  if (!cutFeat) {
    try {
      const cutInput = extrudes.createInput(
        slotProfiles,
        adsk.fusion.FeatureOperations.CutFeatureOperation
      );
      cutInput.participantBodies = [liveTop];
      cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutDepthVal));
      cutInput.taperAngle = adsk.core.ValueInput.createByReal(-taperVal);
      cutFeat = extrudes.add(cutInput);
    } catch (e3) {
      console.warn(`Lid Vents: Stufe 3 (invertierter Taper Angle) fehlgeschlagen: ${e3}`);
    }
  }

  // Stufe 4: Schnitt ohne Taper Angle als robuster Fallback
  if (!cutFeat) {
    try {
      const cutInput = extrudes.createInput(
        slotProfiles,
        adsk.fusion.FeatureOperations.CutFeatureOperation
      );
      cutInput.participantBodies = [liveTop];
      cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutDepthVal));
      cutFeat = extrudes.add(cutInput);
    } catch (e4) {
      throw new Error(`createLidVentilationSlots: Alle Extrusions-Stufen fehlgeschlagen: ${e4}`);
    }
  }

  return getLiveBody(rootComp, liveTop, "Case_Top");
}

/**
 * Ergebnis-Objekt für Schritt 21b (createMiddleSideHole).
 */
export interface MiddleOpeningResult {
  middleBody: adsk.fusion.BRepBody;
  bottomBody: adsk.fusion.BRepBody;
}

/**
 * Schritt 21b (prompt/p023/prompt.md):
 * Konstruiert ein kreisrundes Durchgangsloch auf der kurzen linken Gehäuseseite (X = -45.7 mm)
 * in 'Case_Middle' und dem Kragen von 'Case_Bottom' (prompt/p023/img_1.png):
 *
 * - Kreisdurchmesser 1.0 mm (Radius 0.5 mm, middle_hole_diameter bzw. middle_opening_circle_diameter).
 * - Position Y-Achse: Y = -9.6 mm (middle_hole_y_offset).
 * - Position Z-Achse: Z = 2.95 mm (middle_hole_z_offset bzw. middle_opening_z_offset, konstant zu Case_Bottom).
 * - Vollständiger Durchgangsschnitt von außerhalb (X = -5.5 cm) komplett durch die Wand ins Gehäuseinnere
 *   durch 'Case_Middle' und den Steckkragen von 'Case_Bottom'.
 *
 * Hinweis: Die zuvor vorgesehene rechteckige Öffnung mit 0.4 mm Außenhaut wurde wieder entfernt.
 */
export function createMiddleButtonTab(
  rootComp: adsk.fusion.Component,
  middleBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): MiddleOpeningResult {
  console.log("Schritt 21b: Erzeuge integrierten Druckschalter (Lasche) in Case_Middle und Case_Bottom (p028)...");

  const middleName = (middleBody && middleBody.name === "Case_Main") ? "Case_Main" : "Case_Middle";
  let liveMiddle = getLiveBody(rootComp, middleBody, middleName);
  let liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");
  const extrudes = rootComp.features.extrudeFeatures;

  const circleCenterY = params.middleHoleYOffset ? params.middleHoleYOffset.value : -0.96;           // -0.96 cm (-9.6 mm)
  const circleCenterZ = (params.middleHoleZOffset || params.middleOpeningZOffset)
    ? (params.middleHoleZOffset || params.middleOpeningZOffset).value
    : 0.295;                                                                                          // 0.295 cm (2.95 mm, konstant zu Case_Bottom)
  const tabLenCm = params.middleButtonTabLength ? params.middleButtonTabLength.value : 1.0;          // 1.0 cm (10.0 mm)
  const tabWidthCm = params.middleButtonTabWidth ? params.middleButtonTabWidth.value : 0.4;         // 0.4 cm (4.0 mm)
  const neckLenCm = params.middleButtonNeckLength ? params.middleButtonNeckLength.value : 0.2;       // 0.2 cm (2.0 mm)
  const neckWidthCm = params.middleButtonNeckWidth ? params.middleButtonNeckWidth.value : 0.2;       // 0.2 cm (2.0 mm)
  const neckFilletCm = params.middleButtonNeckFillet ? params.middleButtonNeckFillet.value : 0.05;   // 0.05 cm (0.5 mm)
  const cutWidthCm = params.middleButtonCutWidth ? params.middleButtonCutWidth.value : 0.03;        // 0.03 cm (0.3 mm)

  const headRadiusCm = tabWidthCm / 2.0;    // 0.20 cm (2.0 mm)
  const neckHalfWCm = neckWidthCm / 2.0;    // 0.10 cm (1.0 mm)
  const outerRadiusCm = headRadiusCm + cutWidthCm; // 0.23 cm

  const sidePlaneX = -5.5; // in cm (außerhalb der linken Außenwand bei X = -4.57 cm)
  const planeTab = createOffsetPlane(
    rootComp,
    rootComp.yZConstructionPlane,
    sidePlaneX
  );
  if (!planeTab) {
    throw new Error("Erstellung der Konstruktionsebene für Druckschalter-Lasche fehlgeschlagen.");
  }
  planeTab.name = "Plane_Middle_Button_Tab";

  // -----------------------------------------------------------------
  // 1. Schnitt-Schlitz der Lasche in Case_Middle (bzw. Case_Main)
  // -----------------------------------------------------------------
  const sketchTab = rootComp.sketches.add(planeTab);
  sketchTab.name = "Sketch_Middle_Button_Tab";

  const pt = (y: number, z: number) =>
    sketchTab.modelToSketchSpace(adsk.core.Point3D.create(sidePlaneX, y, z));
  const lines = sketchTab.sketchCurves.sketchLines;
  const arcs = sketchTab.sketchCurves.sketchArcs;

  const Yc = circleCenterY;
  const Zc = circleCenterZ;
  const Rh = headRadiusCm;
  const Hn = neckHalfWCm;
  const Rf = neckFilletCm;
  const w = cutWidthCm;
  const Ro = outerRadiusCm;

  const Z0 = Zc;
  const Z1 = Z0 + tabLenCm;
  const Zmid = Z1 + neckFilletCm;
  const Z2 = Z1 + 2.0 * neckFilletCm;
  const Zend = Z2 + neckLenCm;

  const diag = Rf * Math.SQRT1_2; // Rf * cos(45 deg) = Rf * sin(45 deg)

  // 1. Innenkontur rechter Hebelarm: Gerade von (Yc + Rh, Z0) nach (Yc + Rh, Z1)
  lines.addByTwoPoints(pt(Yc + Rh, Z0), pt(Yc + Rh, Z1));

  // 2. Innenkontur Übergangsbogen 1 rechts (konvex): von (Yc + Rh, Z1) nach (Yc + Rh - Rf, Zmid)
  arcs.addByThreePoints(
    pt(Yc + Rh, Z1),
    pt(Yc + Rh - Rf + diag, Zmid - Rf + diag),
    pt(Yc + Rh - Rf, Zmid)
  );

  // 3. Innenkontur Übergangsbogen 2 rechts (konkav): von (Yc + Rh - Rf, Zmid) nach (Yc + Hn, Z2)
  arcs.addByThreePoints(
    pt(Yc + Rh - Rf, Zmid),
    pt(Yc + Hn + Rf - diag, Zmid + Rf - diag),
    pt(Yc + Hn, Z2)
  );

  // 4. Innenkontur Hals rechts: Gerade von (Yc + Hn, Z2) nach (Yc + Hn, Zend)
  lines.addByTwoPoints(pt(Yc + Hn, Z2), pt(Yc + Hn, Zend));

  // 5. Oberer rechter Abschluss (Schnittbreite w): Gerade von (Yc + Hn, Zend) nach (Yc + Hn + w, Zend)
  lines.addByTwoPoints(pt(Yc + Hn, Zend), pt(Yc + Hn + w, Zend));

  // 6. Außenkontur Hals rechts: Gerade von (Yc + Hn + w, Zend) nach (Yc + Hn + w, Z2)
  lines.addByTwoPoints(pt(Yc + Hn + w, Zend), pt(Yc + Hn + w, Z2));

  // 7. Außenkontur Übergangsbogen 2 rechts (konkav): von (Yc + Hn + w, Z2) nach (Yc + Rh - Rf + w, Zmid)
  arcs.addByThreePoints(
    pt(Yc + Hn + w, Z2),
    pt(Yc + Hn + Rf - diag + w, Zmid + Rf - diag),
    pt(Yc + Rh - Rf + w, Zmid)
  );

  // 8. Außenkontur Übergangsbogen 1 rechts (konvex): von (Yc + Rh - Rf + w, Zmid) nach (Yc + Rh + w, Z1)
  arcs.addByThreePoints(
    pt(Yc + Rh - Rf + w, Zmid),
    pt(Yc + Rh - Rf + diag + w, Zmid - Rf + diag),
    pt(Yc + Rh + w, Z1)
  );

  // 9. Außenkontur rechter Hebelarm: Gerade von (Yc + Rh + w, Z1) nach (Yc + Ro, Z0)
  lines.addByTwoPoints(pt(Yc + Rh + w, Z1), pt(Yc + Ro, Z0));

  // 10. Äußerer Tastkopf-Halbkreis unten (Radius Ro): von (Yc + Ro, Zc) über Scheitel (Yc, Zc - Ro) nach (Yc - Ro, Zc)
  arcs.addByThreePoints(
    pt(Yc + Ro, Zc),
    pt(Yc, Zc - Ro),
    pt(Yc - Ro, Zc)
  );

  // 11. Außenkontur linker Hebelarm: Gerade von (Yc - Ro, Z0) nach (Yc - Rh - w, Z1)
  lines.addByTwoPoints(pt(Yc - Ro, Z0), pt(Yc - Rh - w, Z1));

  // 12. Außenkontur Übergangsbogen 1 links (konvex): von (Yc - Rh - w, Z1) nach (Yc - Rh + Rf - w, Zmid)
  arcs.addByThreePoints(
    pt(Yc - Rh - w, Z1),
    pt(Yc - Rh + Rf - diag - w, Zmid - Rf + diag),
    pt(Yc - Rh + Rf - w, Zmid)
  );

  // 13. Außenkontur Übergangsbogen 2 links (konkav): von (Yc - Rh + Rf - w, Zmid) nach (Yc - Hn - w, Z2)
  arcs.addByThreePoints(
    pt(Yc - Rh + Rf - w, Zmid),
    pt(Yc - Hn - Rf + diag - w, Zmid + Rf - diag),
    pt(Yc - Hn - w, Z2)
  );

  // 14. Außenkontur Hals links: Gerade von (Yc - Hn - w, Z2) nach (Yc - Hn - w, Zend)
  lines.addByTwoPoints(pt(Yc - Hn - w, Z2), pt(Yc - Hn - w, Zend));

  // 15. Oberer linker Abschluss (Schnittbreite w): Gerade von (Yc - Hn - w, Zend) nach (Yc - Hn, Zend)
  lines.addByTwoPoints(pt(Yc - Hn - w, Zend), pt(Yc - Hn, Zend));

  // 16. Innenkontur Hals links: Gerade von (Yc - Hn, Zend) nach (Yc - Hn, Z2)
  lines.addByTwoPoints(pt(Yc - Hn, Zend), pt(Yc - Hn, Z2));

  // 17. Innenkontur Übergangsbogen 2 links (konkav): von (Yc - Hn, Z2) nach (Yc - Rh + Rf, Zmid)
  arcs.addByThreePoints(
    pt(Yc - Hn, Z2),
    pt(Yc - Hn - Rf + diag, Zmid + Rf - diag),
    pt(Yc - Rh + Rf, Zmid)
  );

  // 18. Innenkontur Übergangsbogen 1 links (konvex): von (Yc - Rh + Rf, Zmid) nach (Yc - Rh, Z1)
  arcs.addByThreePoints(
    pt(Yc - Rh + Rf, Zmid),
    pt(Yc - Rh + Rf - diag, Zmid - Rf + diag),
    pt(Yc - Rh, Z1)
  );

  // 19. Innenkontur linker Hebelarm: Gerade von (Yc - Rh, Z1) nach (Yc - Rh, Z0)
  lines.addByTwoPoints(pt(Yc - Rh, Z1), pt(Yc - Rh, Z0));

  // 20. Innerer Tastkopf-Halbkreis unten (Radius Rh): von (Yc - Rh, Z0) über Scheitel (Yc, Zc - Rh) nach (Yc + Rh, Z0)
  arcs.addByThreePoints(
    pt(Yc - Rh, Z0),
    pt(Yc, Zc - Rh),
    pt(Yc + Rh, Z0)
  );

  // Profil für den Schnittschlitz ermitteln
  let slotProfile: adsk.fusion.Profile | null = null;
  const expectedSlotArea = (2.0 * (tabLenCm + 2.0 * Rf + neckLenCm) + Math.PI * Rh) * w;
  let minAreaDiff = 1e9;

  for (let i = 0; i < sketchTab.profiles.count; i++) {
    const prof = sketchTab.profiles.item(i);
    if (prof) {
      const area = prof.areaProperties().area;
      if (area < 0.35) {
        const diff = Math.abs(area - expectedSlotArea);
        if (diff < minAreaDiff) {
          minAreaDiff = diff;
          slotProfile = prof;
        }
      }
    }
  }
  if (!slotProfile && sketchTab.profiles.count > 0) {
    slotProfile = sketchTab.profiles.item(0);
  }
  if (!slotProfile) {
    throw new Error("createMiddleButtonTab: Kein Profil für Schlitz der Druckschalter-Lasche gefunden.");
  }

  const tabPlaneGeom = planeTab.geometry as adsk.core.Plane;
  const cutSignX = tabPlaneGeom.normal.x >= 0 ? 1.0 : -1.0;
  const cutDistX = 1.8; // 18 mm von X = -5.5 cm bis X = -3.7 cm

  const tabCutInput = extrudes.createInput(
    createCollection([slotProfile]),
    adsk.fusion.FeatureOperations.CutFeatureOperation
  );
  tabCutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutSignX * cutDistX));
  tabCutInput.participantBodies = [liveMiddle];

  const tabCutFeat = extrudes.add(tabCutInput);
  if (!tabCutFeat) {
    throw new Error("createMiddleButtonTab: Schnitt der Druckschalter-Lasche in Case_Middle fehlgeschlagen.");
  }
  liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
  console.log(`createMiddleButtonTab: Druckschalter-Lasche in ${middleName} erfolgreich freigeschnitten.`);

  // -----------------------------------------------------------------
  // 1b. Innenliegende Dickenreduzierung der Lasche (flach wie Wand darunter mit 45°-Fase, p028)
  // -----------------------------------------------------------------
  const nominalHalfW = params.caseWidth.value / 2.0;
  const shellThick = params.shellThickness.value;
  const xInner = -nominalHalfW + shellThick;         // -4.27 cm (Innenwand)
  const xStep = -nominalHalfW + shellThick / 2.0;    // -4.42 cm (Stufenfläche / "Wand darunter")
  const xAir = xInner + 0.15;                        // -4.12 cm (im Gehäuseinnenraum)

  const jointDepthCm = params.jointDepth ? params.jointDepth.value : 0.5;
  const vClearanceCm = params.jointVerticalClearance ? params.jointVerticalClearance.value : 0.03;
  const zStep = jointDepthCm + vClearanceCm; // ~0.53 cm

  const recessHeightCm = params.middleButtonInnerRecessHeight
    ? params.middleButtonInnerRecessHeight.value
    : 0.6; // 6.0 mm (0.6 cm)
  const recessChamferCm = params.middleButtonInnerRecessChamfer
    ? params.middleButtonInnerRecessChamfer.value
    : 0.15; // 1.5 mm (0.15 cm)

  let zTop = zStep + recessHeightCm;
  let zChamferEnd = zTop + recessChamferCm;

  // Begrenzung: Fase endet sicher vor dem Ende des geraden Hebelarms (Z1)
  const maxZChamferEnd = (circleCenterZ + tabLenCm) - 0.02;
  if (zChamferEnd > maxZChamferEnd) {
    const overflow = zChamferEnd - maxZChamferEnd;
    zTop = Math.max(zStep + 0.1, zTop - overflow);
    zChamferEnd = zTop + recessChamferCm;
  }

  // Y-Grenzen: Erstreckt sich mittig über die Laschenbreite bis mitten in die beiden Schlitze hinein
  const halfCutWCm = (tabWidthCm + cutWidthCm) / 2.0; // 0.215 cm
  const yStart = circleCenterY - halfCutWCm;          // -0.96 - 0.215 = -1.175 cm
  const extDistY = tabWidthCm + cutWidthCm;           // 0.43 cm

  const planeRecess = createOffsetPlane(
    rootComp,
    rootComp.xZConstructionPlane,
    yStart
  );
  if (planeRecess) {
    planeRecess.name = "Plane_Middle_Button_Inner_Recess";
    const sketchRecess = rootComp.sketches.add(planeRecess);
    sketchRecess.name = "Sketch_Middle_Button_Inner_Recess";

    const ptR = (x: number, z: number) =>
      sketchRecess.modelToSketchSpace(adsk.core.Point3D.create(x, yStart, z));
    const linesR = sketchRecess.sketchCurves.sketchLines;

    // 5-teiliges geschlossenes Profil in der XZ-Ebene:
    // 1. Vertikale Schnittlinie bei xStep (Wand darunter, 1.5 mm Restdicke)
    linesR.addByTwoPoints(ptR(xStep, 0), ptR(xStep, zTop));
    // 2. Diagonale Fase (45 Grad) von xStep auf xInner
    linesR.addByTwoPoints(ptR(xStep, zTop), ptR(xInner, zChamferEnd));
    // 3. Horizontale Linie in den Gehäuseinnenraum (Luft)
    linesR.addByTwoPoints(ptR(xInner, zChamferEnd), ptR(xAir, zChamferEnd));
    // 4. Vertikale Linie im Innenraum abwärts
    linesR.addByTwoPoints(ptR(xAir, zChamferEnd), ptR(xAir, 0));
    // 5. Horizontale Abschlusslinie am Boden (Z = 0) zurück zu xStep
    linesR.addByTwoPoints(ptR(xAir, 0), ptR(xStep, 0));

    if (sketchRecess.profiles.count > 0) {
      const recessProf = sketchRecess.profiles.item(0);
      const recessCutInput = extrudes.createInput(
        createCollection([recessProf]),
        adsk.fusion.FeatureOperations.CutFeatureOperation
      );
      const planeRecessGeom = planeRecess.geometry as adsk.core.Plane;
      const cutSignY = planeRecessGeom.normal.y >= 0 ? 1.0 : -1.0;
      recessCutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutSignY * extDistY));
      recessCutInput.participantBodies = [liveMiddle];

      try {
        const recessFeat = extrudes.add(recessCutInput);
        if (recessFeat) {
          liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
          console.log(
            `createMiddleButtonTab: Innenliegende Dickenreduzierung (${((recessHeightCm + recessChamferCm) * 10).toFixed(1)}mm Höhe, flach wie Wand darunter mit ${(recessChamferCm * 10).toFixed(1)}mm Fase) erfolgreich erzeugt.`
          );
        }
      } catch (eRecess) {
        console.warn(`createMiddleButtonTab: Dickenreduzierung der Lasche fehlgeschlagen: ${eRecess}`);
      }
    }
  }

  // -----------------------------------------------------------------
  // 1c. Taktile kreisrunde Erhebung an der Außenseite der Lasche (+0.2 mm) mit 0.2 mm Fase (p028, Bild 2)
  // -----------------------------------------------------------------
  const bossHeightCm = params.middleButtonBossHeight
    ? params.middleButtonBossHeight.value
    : 0.02; // 0.2 mm (0.02 cm) nach außen
  const bossChamferCm = params.middleButtonBossChamfer
    ? params.middleButtonBossChamfer.value
    : 0.02; // 0.2 mm (0.02 cm) Fase

  const xOuter = -nominalHalfW; // -4.57 cm (Außenwand)
  const bossOverlapCm = 0.05;   // 0.5 mm (0.05 cm) Überlappung in das Innere der 1.5 mm starken Laschenwand
  const xPlane = xOuter + bossOverlapCm; // -4.52 cm (0.5 mm innerhalb der Lasche)
  const planeOuter = createOffsetPlane(
    rootComp,
    rootComp.yZConstructionPlane,
    xPlane
  );

  if (planeOuter && bossHeightCm > 0.001) {
    planeOuter.name = "Plane_Middle_Button_Outer_Boss";
    const sketchBoss = rootComp.sketches.add(planeOuter);
    sketchBoss.name = "Sketch_Middle_Button_Outer_Boss";

    const centerBossPt = sketchBoss.modelToSketchSpace(
      adsk.core.Point3D.create(xPlane, circleCenterY, circleCenterZ)
    );
    sketchBoss.sketchCurves.sketchCircles.addByCenterRadius(centerBossPt, headRadiusCm);

    if (sketchBoss.profiles.count > 0) {
      const bossProf = sketchBoss.profiles.item(0);
      // Körper vor der Extrusion erfassen, um neu erzeugte Körper sicher zu erkennen
      const existingBodies = new Set<adsk.fusion.BRepBody>();
      for (let i = 0; i < rootComp.bRepBodies.count; i++) {
        const b = rootComp.bRepBodies.item(i);
        if (b) existingBodies.add(b);
      }

      const bossExtrudeInput = extrudes.createInput(
        createCollection([bossProf]),
        adsk.fusion.FeatureOperations.NewBodyFeatureOperation
      );
      const planeOuterGeom = planeOuter.geometry as adsk.core.Plane;
      // Nach außen ist in -X Richtung (weg vom Gehäuse):
      const bossSignX = planeOuterGeom.normal.x >= 0 ? -1.0 : 1.0;
      const totalExtrudeDistCm = bossOverlapCm + bossHeightCm; // 0.05 + 0.02 = 0.07 cm (0.7 mm)
      bossExtrudeInput.setDistanceExtent(
        false,
        adsk.core.ValueInput.createByReal(bossSignX * totalExtrudeDistCm)
      );

      try {
        const bossFeat = extrudes.add(bossExtrudeInput);
        if (bossFeat) {
          // Neu entstandenen Körper der taktilen Erhebung ermitteln
          let bossBody: adsk.fusion.BRepBody | null = null;
          if (bossFeat.bodies && bossFeat.bodies.count > 0) {
            for (let i = 0; i < bossFeat.bodies.count; i++) {
              const b = bossFeat.bodies.item(i);
              if (b && b.isValid && b !== liveMiddle && b.name !== middleName) {
                bossBody = b;
                break;
              }
            }
          }
          if (!bossBody) {
            for (let i = rootComp.bRepBodies.count - 1; i >= 0; i--) {
              const b = rootComp.bRepBodies.item(i);
              if (b && b.isValid && !existingBodies.has(b) && b !== liveMiddle && b.name !== middleName) {
                bossBody = b;
                break;
              }
            }
          }

          console.log(
            `createMiddleButtonTab: Äußere Erhebung (Ø ${(headRadiusCm * 20).toFixed(1)}mm, +${(bossHeightCm * 10).toFixed(2)}mm nach außen, ${(bossOverlapCm * 10).toFixed(1)}mm Überlappung) erfolgreich erzeugt.`
          );

          // 1. ZUERST: Verschmelzen (merge / combine) des neuen Körpers mit Case_Main bzw. Case_Middle
          liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
          if (bossBody && bossBody.isValid) {
            try {
              const combineFeatures = rootComp.features.combineFeatures;
              const toolColl = createCollection([bossBody]);
              const combineInput = combineFeatures.createInput(liveMiddle, toolColl);
              if (combineInput) {
                combineInput.operation = adsk.fusion.FeatureOperations.JoinFeatureOperation;
                combineInput.isKeepToolBodies = false;
                combineInput.isNewComponent = false;
                const combFeat = combineFeatures.add(combineInput);
                if (combFeat) {
                  liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
                  liveMiddle.name = middleName;
                  console.log(
                    `createMiddleButtonTab: Taktile Erhebung erfolgreich mit ${middleName} verschmolzen (merge).`
                  );
                } else {
                  console.warn(
                    `createMiddleButtonTab: Combine-Feature zum Verschmelzen der Erhebung gab null zurück.`
                  );
                }
              }
            } catch (eComb) {
              console.warn(
                `createMiddleButtonTab: Fehler beim Verschmelzen (merge) der Erhebung mit ${middleName}: ${eComb}`
              );
            }
          }

          // Fallback falls der Tool-Körper wider Erwarten noch existieren sollte:
          if (bossBody && bossBody.isValid) {
            try {
              const retryColl = createCollection([bossBody]);
              const retryInput = rootComp.features.combineFeatures.createInput(liveMiddle, retryColl);
              if (retryInput) {
                retryInput.operation = adsk.fusion.FeatureOperations.JoinFeatureOperation;
                retryInput.isKeepToolBodies = false;
                rootComp.features.combineFeatures.add(retryInput);
                liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
                liveMiddle.name = middleName;
              }
            } catch (_eRetry) { }
          }

          // 2. DANACH: Kreiskante der Erhebung an Case_Main (bzw. Case_Middle) anfasen (0.2 mm)
          if (bossChamferCm > 0.001) {
            liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
            const targetX = xOuter + bossSignX * bossHeightCm;
            const bossEdges: adsk.fusion.BRepEdge[] = [];
            for (let e = 0; e < liveMiddle.edges.count; e++) {
              const edge = liveMiddle.edges.item(e);
              if (!edge || !edge.isValid) continue;
              const pMid = edge.pointOnEdge;
              if (Math.abs(pMid.x - targetX) < 0.005) {
                const distYZ = Math.hypot(pMid.y - circleCenterY, pMid.z - circleCenterZ);
                if (Math.abs(distYZ - headRadiusCm) < 0.05) {
                  bossEdges.push(edge);
                }
              }
            }

            if (bossEdges.length > 0) {
              const chamferDone = applyChamferWithFallbacks(
                rootComp,
                bossEdges,
                bossChamferCm,
                "middle_button_boss_chamfer",
                "ButtonBossChamfer"
              );
              if (!chamferDone && bossChamferCm >= bossHeightCm) {
                // Fallback mit 0.19 mm (95%), falls 0.20 mm am Zylinderfuß zu einer ASM-Singularität führt
                applyChamferWithFallbacks(
                  rootComp,
                  bossEdges,
                  bossChamferCm * 0.95,
                  undefined,
                  "ButtonBossChamferFallback"
                );
              }
              liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
              liveMiddle.name = middleName;
            }
          }
        }
      } catch (eBoss) {
        console.warn(`createMiddleButtonTab: Äußere Erhebung fehlgeschlagen: ${eBoss}`);
      }
    }
  }

  // -----------------------------------------------------------------
  // 2. Kragenausschnitt in Case_Bottom hinter dem Taster erzeugen (mit verrundeten Ecken, p028)
  // -----------------------------------------------------------------
  const sketchCollarCut = rootComp.sketches.add(planeTab);
  sketchCollarCut.name = "Sketch_Bottom_Collar_Button_Clearance";

  // Aussparungsbereich im Kragen:
  // Hinter dem Taster (Druckkopf und Hebelarm):
  // Entlang Y: Von kurz vor der linken Kante (Y = Yc - Ro - 0.05 cm)
  // bis kurz hinter die rechte Kante (Y = Yc + Ro + 0.05 cm)
  // In Z: von Z = 0 bis knapp über Kragenoberkante
  const collarCutMinY = Yc - Ro - 0.05;
  const collarCutMaxY = Yc + Ro + 0.05;
  const collarCutMinZ = 0.0;
  const collarHeightCm = params.jointDepth ? params.jointDepth.value : 0.5; // 5.0 mm
  const collarCutMaxZ = collarHeightCm + 0.15; // 6.5 mm (oberhalb des Kragens)

  const rawFilletCm = params.collarButtonCutoutFillet ? params.collarButtonCutoutFillet.value : 0.12; // 1.2 mm
  const collarFilletCm = Math.min(rawFilletCm, (collarCutMaxY - collarCutMinY) / 4.0, collarHeightCm / 2.0);

  if (collarFilletCm > 0.01) {
    // 10-teiliger, vollständig geschlossener Verrundungspfad:
    // - Unten (Z = 0): Konkave Innenradien (R = collarFilletCm) an beiden Ecken
    // - Oben (Z = collarHeightCm): Konvexe Außenradien (R = collarFilletCm) an den Kragen-Oberkanten
    const ptC = (y: number, z: number) =>
      sketchCollarCut.modelToSketchSpace(adsk.core.Point3D.create(sidePlaneX, y, z));
    const linesC = sketchCollarCut.sketchCurves.sketchLines;
    const arcsC = sketchCollarCut.sketchCurves.sketchArcs;
    const Rc = collarFilletCm;
    const diagC = Rc * Math.SQRT1_2;

    // 1. Untere Horizontale bei Z = collarCutMinZ (0.0)
    linesC.addByTwoPoints(ptC(collarCutMinY + Rc, collarCutMinZ), ptC(collarCutMaxY - Rc, collarCutMinZ));

    // 2. Konkave Rundung unten-rechts (Radius Rc von horizontal zu vertikal)
    arcsC.addByThreePoints(
      ptC(collarCutMaxY - Rc, collarCutMinZ),
      ptC(collarCutMaxY - Rc + diagC, collarCutMinZ + Rc - diagC),
      ptC(collarCutMaxY, collarCutMinZ + Rc)
    );

    // 3. Rechte Vertikale von Z = collarCutMinZ + Rc bis Z = collarHeightCm - Rc
    linesC.addByTwoPoints(ptC(collarCutMaxY, collarCutMinZ + Rc), ptC(collarCutMaxY, collarHeightCm - Rc));

    // 4. Konvexe Rundung oben-rechts (Radius Rc von vertikal zu horizontal am Kragen-Kopf)
    arcsC.addByThreePoints(
      ptC(collarCutMaxY, collarHeightCm - Rc),
      ptC(collarCutMaxY + Rc - diagC, collarHeightCm - Rc + diagC),
      ptC(collarCutMaxY + Rc, collarHeightCm)
    );

    // 5. Rechte Vertikale oberhalb des Kragens bis zur Schnitthöhe Z = collarCutMaxZ
    linesC.addByTwoPoints(ptC(collarCutMaxY + Rc, collarHeightCm), ptC(collarCutMaxY + Rc, collarCutMaxZ));

    // 6. Obere Horizontale oberhalb des Kragens
    linesC.addByTwoPoints(ptC(collarCutMaxY + Rc, collarCutMaxZ), ptC(collarCutMinY - Rc, collarCutMaxZ));

    // 7. Linke Vertikale oberhalb des Kragens von Schnitthöhe hinab auf Kragenhöhe
    linesC.addByTwoPoints(ptC(collarCutMinY - Rc, collarCutMaxZ), ptC(collarCutMinY - Rc, collarHeightCm));

    // 8. Konvexe Rundung oben-links (Radius Rc von horizontal zu vertikal am Kragen-Kopf)
    arcsC.addByThreePoints(
      ptC(collarCutMinY - Rc, collarHeightCm),
      ptC(collarCutMinY - Rc + diagC, collarHeightCm - Rc + diagC),
      ptC(collarCutMinY, collarHeightCm - Rc)
    );

    // 9. Linke Vertikale von Z = collarHeightCm - Rc hinab auf Z = collarCutMinZ + Rc
    linesC.addByTwoPoints(ptC(collarCutMinY, collarHeightCm - Rc), ptC(collarCutMinY, collarCutMinZ + Rc));

    // 10. Konkave Rundung unten-links (Radius Rc von vertikal zu horizontal)
    arcsC.addByThreePoints(
      ptC(collarCutMinY, collarCutMinZ + Rc),
      ptC(collarCutMinY + Rc - diagC, collarCutMinZ + Rc - diagC),
      ptC(collarCutMinY + Rc, collarCutMinZ)
    );
  } else {
    // Fallback: Einfaches Rechteck ohne Verrundung
    draw3DRectangle(
      sketchCollarCut,
      adsk.core.Point3D.create(sidePlaneX, collarCutMinY, collarCutMinZ),
      adsk.core.Point3D.create(sidePlaneX, collarCutMaxY, collarCutMinZ),
      adsk.core.Point3D.create(sidePlaneX, collarCutMaxY, collarCutMaxZ),
      adsk.core.Point3D.create(sidePlaneX, collarCutMinY, collarCutMaxZ)
    );
  }

  if (sketchCollarCut.profiles.count > 0) {
    const collarCutProf = sketchCollarCut.profiles.item(0);
    const collarCutInput = extrudes.createInput(
      createCollection([collarCutProf]),
      adsk.fusion.FeatureOperations.CutFeatureOperation
    );
    collarCutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutSignX * cutDistX));
    collarCutInput.participantBodies = [liveBottom];
    try {
      const feat = extrudes.add(collarCutInput);
      if (feat) {
        liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
        console.log(
          `createMiddleButtonTab: Kragenausschnitt (${((collarCutMaxY - collarCutMinY) * 10).toFixed(1)}x${(collarHeightCm * 10).toFixed(1)}mm, R${(collarFilletCm * 10).toFixed(1)}mm) in Case_Bottom ausgeschnitten.`
        );
      }
    } catch (eCollar) {
      console.warn(`createMiddleButtonTab: Kragenausschnitt in Case_Bottom fehlgeschlagen: ${eCollar}`);
    }
  }

  liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
  liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
  liveMiddle.name = middleName;
  liveBottom.name = "Case_Bottom";

  console.log(
    `Schritt 21b erfolgreich: Druckschalter-Lasche (Ø ${(headRadiusCm * 20).toFixed(1)}mm, L ${(tabLenCm * 10).toFixed(1)}mm, Hals ${(neckLenCm * 10).toFixed(1)}x${(neckWidthCm * 10).toFixed(1)}mm, vertikal von oben nach unten) in ${middleName} und Kragenausschnitt in Case_Bottom erzeugt.`
  );

  return { middleBody: liveMiddle, bottomBody: liveBottom };
}

// Aliase für Rückwärtskompatibilität
export const createMiddleSideHole = createMiddleButtonTab;
export const createMiddleSideOpening = createMiddleButtonTab;
