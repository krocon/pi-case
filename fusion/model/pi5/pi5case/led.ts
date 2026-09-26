import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import { createCollection, getLiveBody, createOffsetPlane } from "./utils";

/**
 * Zeichnet ein planares Rechteck auf eine Skizze im lokalen Skizzenraum.
 * Nutzt sketch.modelToSketchSpace() zur fehlerfreien Koordinatentransformation (AGENTS.md §4.4).
 */
function draw3DRectangle(
  sketch: adsk.fusion.Sketch,
  p0: adsk.core.Point3D,
  p1: adsk.core.Point3D,
  p2: adsk.core.Point3D,
  p3: adsk.core.Point3D
): void {
  const s0 = sketch.modelToSketchSpace(p0);
  const s1 = sketch.modelToSketchSpace(p1);
  const s2 = sketch.modelToSketchSpace(p2);
  const s3 = sketch.modelToSketchSpace(p3);

  const lines = sketch.sketchCurves.sketchLines;
  lines.addByTwoPoints(s0, s1);
  lines.addByTwoPoints(s1, s2);
  lines.addByTwoPoints(s2, s3);
  lines.addByTwoPoints(s3, s0);
}

/**
 * Ermittelt das Profil mit der größten Fläche aus einer Skizze.
 */
function getLargestProfile(sketch: adsk.fusion.Sketch, logName: string): adsk.fusion.Profile {
  if (sketch.profiles.count === 0) {
    throw new Error(`${logName}: Kein Profil in Skizze '${sketch.name}' gefunden.`);
  }
  let bestProf: adsk.fusion.Profile | null = null;
  let maxArea = -1;
  for (let i = 0; i < sketch.profiles.count; i++) {
    const prof = sketch.profiles.item(i);
    if (prof) {
      const area = prof.areaProperties().area;
      if (area > maxArea) {
        maxArea = area;
        bestProf = prof;
      }
    }
  }
  if (!bestProf) {
    throw new Error(`${logName}: Konnte Profil in Skizze '${sketch.name}' nicht ermitteln.`);
  }
  return bestProf;
}

/**
 * Ermittelt das Richtungsvorzeichen für eine Extrusion entlang der X-Achse
 * bezogen auf die Normale der Konstruktionsebene.
 */
function getPlaneExtrudeSignX(plane: adsk.fusion.ConstructionPlane): number {
  const planeGeom = plane.geometry as adsk.core.Plane;
  return planeGeom.normal.x >= 0 ? 1.0 : -1.0;
}

/**
 * Schritt 21 (prompt/p008/prompt.md):
 * Konstruiert eine seitliche rechteckige Gehäuseöffnung und eine innenliegende Halterung
 * für eine 5.0 x 2.0 x 7.0 mm Rechteck-LED auf der kurzen linken Gehäuseseite (X = -45.7 mm)
 * im Gehäusedeckel ('Case_Top') im Retro-Look (Apple "Nutshell Pi"):
 *
 * 1. Halterungs-Außenhülse:
 *    Ein kompakter Führungsquader an der linken Innenwand von Case_Top (X = -42.7 mm bis X = -40.2 mm),
 *    der sich monolithisch mit der linken Innenwand und der Decke von Case_Top verbindet (Join).
 *    Bleibt strikt außerhalb des Lüftungsschlitzbereichs (X <= -40.0 mm) für sauberen FDM-Druck.
 *
 * 2. Gehäuseöffnung & Aufnahmetasche:
 *    Ein präziser 5.2 x 2.2 mm Schnitt von außerhalb der linken Gehäusewand (X = -5.5 cm)
 *    durch die 1.5 mm dünne Fugenwand und den Halterungsblock ins Gehäuseinnere.
 *    Erzeugt die saubere Sichtöffnung in der Schattenfuge der kurzen Seite bei Y = led_y_offset (-16 mm)
 *    und die formschlüssige Führung für den LED-Körper.
 */
export function createLedOpeningAndMount(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  params: Params
): adsk.fusion.BRepBody {
  console.log("Schritt 21: Erzeuge rechteckige LED-Öffnung und Halterung auf der kurzen Gehäuseseite in Case_Top (p008)...");

  let liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const extrudes = rootComp.features.extrudeFeatures;

  // -----------------------------------------------------------------
  // 1. Geometriedaten und Positionen berechnen
  // -----------------------------------------------------------------
  const ledY = params.ledYOffset.value; // z. B. -1.60 cm (-16.0 mm auf kurzer Seitenwand)
  const ledZ = params.ledZOffset.value; // z. B. 3.075 cm (30.75 mm in Fugenzentrum)

  const openingW = params.ledOpeningWidth.value; // z. B. 0.52 cm (5.2 mm entlang Y)
  const openingH = params.ledOpeningHeight.value; // z. B. 0.22 cm (2.2 mm entlang Z)
  const bodyDepth = params.ledBodyDepth.value; // z. B. 0.25 cm (2.5 mm nach innen)
  const wallThick = params.ledHolderWallThickness.value; // z. B. 0.12 cm (1.2 mm)

  // Gehäuse-Referenzebenen in X-Richtung (kurze linke Seitenwand)
  const leftOuterX =
    - (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 -
    params.shellThickness.value; // -4.57 cm (-45.7 mm)
  const grooveWallX = leftOuterX + params.grooveInset.value; // -4.42 cm (-44.2 mm)
  const innerWallX = leftOuterX + params.shellThickness.value; // -4.27 cm (-42.7 mm)

  // Halterungs-Tiefe nach innen (+X Richtung):
  // 2.5 mm Tiefe endet bei X = -4.02 cm, strikt vor den Deckelschlitzen (X >= -4.00 cm)
  const sleeveDepthInward = bodyDepth; // 0.25 cm (2.5 mm)
  const sleeveEndX = innerWallX + sleeveDepthInward; // -4.27 + 0.25 = -4.02 cm (-40.2 mm)

  // Gehäusedecke von Case_Top (Deckelaußenfläche bei topHeight = 4.0 cm, Innenfläche bei ceilingZ = 3.70 cm)
  const topHeight = params.caseTopHeight.value; // 4.0 cm (40.0 mm)
  const ceilingZ = topHeight - params.shellThickness.value; // 3.70 cm (37.0 mm)

  // Halterungs-Außenabmessungen entlang Y und Z
  const sleeveMinY = ledY - (openingW / 2.0 + wallThick);
  const sleeveMaxY = ledY + (openingW / 2.0 + wallThick);
  const sleeveMinZ = ledZ - (openingH / 2.0 + wallThick);
  // Obere Kante verbindet sich vollständig und nahtlos mit der Gehäusedecke (+Z bis topHeight = 40.0 mm),
  // sodass beim Drucken von Case_Top auf dem Kopf (Druckbett bei Z = 40.0 mm) keinerlei Überhang entsteht.
  const sleeveMaxZ = topHeight;

  console.log(
    `LED-Position (kurze Seite): X=${leftOuterX * 10}mm (Wand), Y=${ledY * 10}mm, Z=${ledZ * 10}mm, Öffnung=${openingW * 10}x${openingH * 10}mm, Block-Tiefe nach innen=${sleeveDepthInward * 10}mm (Ende bei X=${sleeveEndX * 10}mm, Z bis Decke=${sleeveMaxZ * 10}mm, stützfrei).`
  );

  // -----------------------------------------------------------------
  // 2. Halterungs-Außenkörper erzeugen (Join an Case_Top)
  //    Extrusion von der linken Innenwand (X = -4.27 cm) nach innen (+X) bis X = -4.02 cm
  // -----------------------------------------------------------------
  const planeSleeve = createOffsetPlane(
    rootComp,
    rootComp.yZConstructionPlane,
    innerWallX,
    "Plane_Led_Sleeve_Base"
  );
  if (!planeSleeve) {
    throw new Error("Erstellung der Konstruktionsebene für Halterungs-Basis auf linker Seitenwand fehlgeschlagen.");
  }

  const sketchSleeve = rootComp.sketches.add(planeSleeve);
  sketchSleeve.name = "Sketch_Led_Sleeve_Outer";

  draw3DRectangle(
    sketchSleeve,
    adsk.core.Point3D.create(innerWallX, sleeveMinY, sleeveMinZ),
    adsk.core.Point3D.create(innerWallX, sleeveMaxY, sleeveMinZ),
    adsk.core.Point3D.create(innerWallX, sleeveMaxY, sleeveMaxZ),
    adsk.core.Point3D.create(innerWallX, sleeveMinY, sleeveMaxZ)
  );

  // Alle Profile der Skizze erfassen, um sicherzustellen, dass keine Teilprofile ausgelassen werden
  const sleeveProfiles = adsk.core.ObjectCollection.create();
  for (let i = 0; i < sketchSleeve.profiles.count; i++) {
    const p = sketchSleeve.profiles.item(i);
    if (p) sleeveProfiles.add(p);
  }
  if (sleeveProfiles.count === 0) {
    throw new Error("createLedOpeningAndMount: Kein Profil für LED-Halterungs-Außenhülse gefunden.");
  }

  const sleeveSign = getPlaneExtrudeSignX(planeSleeve);
  const sleeveDistX = sleeveDepthInward; // 0.25 cm (2.5 mm nach innen in +X)

  const sleeveInput = extrudes.createInput(
    sleeveProfiles,
    adsk.fusion.FeatureOperations.JoinFeatureOperation
  );
  sleeveInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(sleeveSign * sleeveDistX));
  sleeveInput.participantBodies = [liveTop];

  const sleeveFeat = extrudes.add(sleeveInput);
  if (!sleeveFeat) {
    throw new Error("Extrusion der Halterungs-Außenhülse an linker Seitenwand fehlgeschlagen.");
  }
  liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
  console.log("Halterungs-Außenkörper an linker Seitenwand erfolgreich monolithisch mit Case_Top verbunden.");

  // -----------------------------------------------------------------
  // 3. Rechteckige Gehäuseöffnung & LED-Führungstunnel komplett durchschneiden (Cut)
  //    Schnitt von außerhalb der linken Gehäusewand (X = -5.5 cm) komplett durch den Block (bis X = -3.85 cm)
  // -----------------------------------------------------------------
  const sidePlaneX = -5.5;
  const planeSide = createOffsetPlane(
    rootComp,
    rootComp.yZConstructionPlane,
    sidePlaneX,
    "Plane_Led_Side_Cut"
  );
  if (!planeSide) {
    throw new Error("Erstellung der Konstruktionsebene für Seiten-LED-Schnitt fehlgeschlagen.");
  }

  const sketchPocket = rootComp.sketches.add(planeSide);
  sketchPocket.name = "Sketch_Led_Pocket_Cut";

  const pocketMinY = ledY - openingW / 2.0;
  const pocketMaxY = ledY + openingW / 2.0;
  const pocketMinZ = ledZ - openingH / 2.0;
  const pocketMaxZ = ledZ + openingH / 2.0;

  draw3DRectangle(
    sketchPocket,
    adsk.core.Point3D.create(sidePlaneX, pocketMinY, pocketMinZ),
    adsk.core.Point3D.create(sidePlaneX, pocketMaxY, pocketMinZ),
    adsk.core.Point3D.create(sidePlaneX, pocketMaxY, pocketMaxZ),
    adsk.core.Point3D.create(sidePlaneX, pocketMinY, pocketMaxZ)
  );

  const pocketProfile = getLargestProfile(sketchPocket, "LedPocketCut");
  const cutSign = getPlaneExtrudeSignX(planeSide);
  // Schneidet komplett durch linke Fugenwand und Halterungsblock hindurch ins Gehäuseinnere
  const throughCutDistX = (sleeveEndX + 0.15) - sidePlaneX; // z. B. -3.87 - (-5.50) = 1.63 cm

  const pocketInput = extrudes.createInput(
    createCollection([pocketProfile]),
    adsk.fusion.FeatureOperations.CutFeatureOperation
  );
  pocketInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cutSign * throughCutDistX));
  pocketInput.participantBodies = [liveTop];

  const pocketFeat = extrudes.add(pocketInput);
  if (!pocketFeat) {
    throw new Error("Schnitt-Extrusion für LED-Gehäuseöffnung an linker Seitenwand fehlgeschlagen.");
  }
  liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
  console.log("LED-Gehäuseöffnung (5.2x2.2mm) und durchgehender Führungstunnel an linker Seitenwand erfolgreich ausgeschnitten.");

  // -----------------------------------------------------------------
  // 4. Abschluss & Rückgabe des Live-Körpers
  // -----------------------------------------------------------------
  liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
  liveTop.name = "Case_Top";

  console.log("Schritt 21 erfolgreich abgeschlossen: LED-Öffnung und Halterung auf der kurzen Gehäuseseite generiert.");
  return liveTop;
}
