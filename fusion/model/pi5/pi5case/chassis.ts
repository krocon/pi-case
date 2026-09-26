import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import { CasePairBodies, createCollection, createOffsetPlane, applyFilletWithFallbacks, getLiveBody } from "./utils";

export type ChassisBodies = CasePairBodies;

/**
 * Sucht eine horizontale, ebene Fläche auf einem Körper anhand eines Ziel-Z-Wertes.
 * Robust gegenüber umgekehrten Normalen (isParamReversed) und BRep-Präzisionsschwankungen.
 */
function findHorizontalPlanarFace(
  body: adsk.fusion.BRepBody,
  targetZ: number,
  preferMinOrMax: 'min' | 'max' = 'min'
): adsk.fusion.BRepFace | null {
  let bestFace: adsk.fusion.BRepFace | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < body.faces.count; i++) {
    const f = body.faces.item(i);
    if (!f || !f.isValid) continue;
    if (f.geometry.surfaceType !== adsk.core.SurfaceTypes.PlaneSurfaceType) continue;

    const plane = f.geometry as adsk.core.Plane;
    // Ebene muss horizontal sein (|normal.z| > 0.8)
    if (Math.abs(plane.normal.z) < 0.8) continue;

    const dist = Math.abs(f.centroid.z - targetZ);
    if (dist < 0.2 && dist < bestDist) {
      bestDist = dist;
      bestFace = f;
    }
  }

  // Fallback: Fläche mit minimalem bzw. maximalem Centroid-Z-Wert
  if (!bestFace) {
    let extremeZ = preferMinOrMax === 'min' ? Infinity : -Infinity;
    for (let i = 0; i < body.faces.count; i++) {
      const f = body.faces.item(i);
      if (!f || !f.isValid) continue;
      if (f.geometry.surfaceType !== adsk.core.SurfaceTypes.PlaneSurfaceType) continue;
      const plane = f.geometry as adsk.core.Plane;
      if (Math.abs(plane.normal.z) < 0.8) continue;

      if (preferMinOrMax === 'min') {
        if (f.centroid.z < extremeZ) {
          extremeZ = f.centroid.z;
          bestFace = f;
        }
      } else {
        if (f.centroid.z > extremeZ) {
          extremeZ = f.centroid.z;
          bestFace = f;
        }
      }
    }
  }

  return bestFace;
}

/**
 * Schritte 0, 1, 2, 3:
 * 0) Erstelle Skizze auf XY-Ebene
 * 1) Rechteck zeichnen (case_width x case_depth, z. B. 91.4mm x 62.4mm, zentriert auf Ursprung)
 * 2) Extrusion +40mm nach oben (neuer Körper: Case_Top)
 * 3) Wieder von der Skizze ausgehend Extrusion -6.4mm nach unten (neuer Körper: Case_Bottom)
 */
export function createBaseSketchAndExtrusions(
  rootComp: adsk.fusion.Component,
  params: Params
): ChassisBodies {
  const sketches = rootComp.sketches;
  const extrudes = rootComp.features.extrudeFeatures;

  // 0) Skizze auf XY-Ebene
  const xyPlane = rootComp.xYConstructionPlane;
  const sketch = sketches.add(xyPlane);
  sketch.name = "Sketch_Base_Pi5Case";

  // 1) Symmetrischer Basiskörper für den Innenhohlraum (85.4 x 56.4 mm + 2 * 3.0 mm Wandstärke = 91.4 x 62.4 mm)
  // Die Wandverstärkung der rechten Wand (+X) um 1.0 mm (p024) erfolgt gezielt nach der Schalenbildung in Schritt 5b,
  // sodass der Innenraum (Hohlraum) zu 100% unverändert bleibt.
  const nominalHalfW =
    (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 +
    params.shellThickness.value; // 4.57 cm (91.4 mm / 2)
  const halfD = params.caseDepth.value / 2.0; // 3.12 cm (62.4 mm / 2)

  const lines = sketch.sketchCurves.sketchLines;
  const p0 = adsk.core.Point3D.create(-nominalHalfW, -halfD, 0);
  const p1 = adsk.core.Point3D.create(nominalHalfW, -halfD, 0);
  const p2 = adsk.core.Point3D.create(nominalHalfW, halfD, 0);
  const p3 = adsk.core.Point3D.create(-nominalHalfW, halfD, 0);

  lines.addByTwoPoints(p0, p1);
  lines.addByTwoPoints(p1, p2);
  lines.addByTwoPoints(p2, p3);
  lines.addByTwoPoints(p3, p0);

  if (sketch.profiles.count === 0) {
    throw new Error("Kein Profil im Basisskizzen-Rechteck gefunden.");
  }
  const baseProfile = sketch.profiles.item(0);

  // 2) Extrusion +40mm nach oben (Case_Top)
  const extrudeTopInput = extrudes.createInput(
    baseProfile,
    adsk.fusion.FeatureOperations.NewBodyFeatureOperation
  );
  extrudeTopInput.setDistanceExtent(
    false,
    adsk.core.ValueInput.createByString('case_top_height')
  );
  const topExtrudeFeat = extrudes.add(extrudeTopInput);
  if (!topExtrudeFeat || topExtrudeFeat.bodies.count === 0) {
    throw new Error("Extrusion des oberen Körpers fehlgeschlagen.");
  }
  const topBody = topExtrudeFeat.bodies.item(0);
  topBody.name = "Case_Top";

  // 3) Wieder von der Skizze ausgehend Extrusion -6.4mm nach unten (Case_Bottom)
  sketch.isVisible = true;
  const extrudeBottomInput = extrudes.createInput(
    baseProfile,
    adsk.fusion.FeatureOperations.NewBodyFeatureOperation
  );
  let distVal: adsk.core.ValueInput | null = null;
  try {
    distVal = adsk.core.ValueInput.createByString('-case_bottom_height');
  } catch (_e) { }
  if (!distVal) {
    distVal = adsk.core.ValueInput.createByReal(-params.caseBottomHeight.value);
  }
  extrudeBottomInput.setDistanceExtent(false, distVal);

  const bottomExtrudeFeat = extrudes.add(extrudeBottomInput);
  if (!bottomExtrudeFeat || bottomExtrudeFeat.bodies.count === 0) {
    throw new Error("Extrusion des unteren Körpers fehlgeschlagen.");
  }
  const bottomBody = bottomExtrudeFeat.bodies.item(0);
  bottomBody.name = "Case_Bottom";

  return {
    topBody: getLiveBody(rootComp, topBody, "Case_Top"),
    bottomBody: getLiveBody(rootComp, bottomBody, "Case_Bottom")
  };
}

/**
 * Schritte 4 & 5:
 * 4) Nimm den oberen Körper und selektiere dessen Unterseite und mache Schale mit 3mm
 * 5) Nimm den unteren Körper und selektiere dessen Oberseite und mache Schale mit 3mm
 */
export function shellBodies(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  _params: Params
): ChassisBodies {
  const shellFeatures = rootComp.features.shellFeatures;

  // 4) Oberer Körper: Unterseite bei Z = 0
  const liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const bottomFaceOfTop = findHorizontalPlanarFace(liveTop, 0.0, 'min');

  if (!bottomFaceOfTop) {
    throw new Error("Unterseite des oberen Körpers für Schale nicht gefunden.");
  }

  const topShellEntities = createCollection(bottomFaceOfTop);
  const topShellInput = shellFeatures.createInput(topShellEntities, false);
  topShellInput.insideThickness = adsk.core.ValueInput.createByString('shell_thickness');
  shellFeatures.add(topShellInput);

  // 5) Unterer Körper: Oberseite bei Z = 0
  const liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");
  const topFaceOfBottom = findHorizontalPlanarFace(liveBottom, 0.0, 'max');

  if (!topFaceOfBottom) {
    throw new Error("Oberseite des unteren Körpers für Schale nicht gefunden.");
  }

  const bottomShellEntities = createCollection(topFaceOfBottom);
  const bottomShellInput = shellFeatures.createInput(bottomShellEntities, false);
  bottomShellInput.insideThickness = adsk.core.ValueInput.createByString('shell_thickness');
  shellFeatures.add(bottomShellInput);


  return {
    topBody: getLiveBody(rootComp, liveTop, "Case_Top"),
    bottomBody: getLiveBody(rootComp, liveBottom, "Case_Bottom")
  };
}

/**
 * Sucht eine planare, vertikale Außenfläche an einem Körper mit Normalenvektor in +X (rechte Gehäusewand).
 */
function findRightOuterPlanarFace(
  body: adsk.fusion.BRepBody,
  expectedXCm: number
): adsk.fusion.BRepFace | null {
  const TOL = 0.1; // 1.0 mm Toleranz
  let bestFace: adsk.fusion.BRepFace | null = null;
  let maxCentroidX = -Infinity;

  for (let i = 0; i < body.faces.count; i++) {
    const f = body.faces.item(i);
    if (!f || !f.isValid) continue;
    if (f.geometry.surfaceType !== adsk.core.SurfaceTypes.PlaneSurfaceType) continue;

    const plane = f.geometry as adsk.core.Plane;
    // Normale muss in +X zeigen (normal.x > 0.8)
    if (plane.normal.x < 0.8) continue;

    if (Math.abs(f.centroid.x - expectedXCm) < TOL) {
      return f;
    }
    if (f.centroid.x > maxCentroidX) {
      maxCentroidX = f.centroid.x;
      bestFace = f;
    }
  }

  return bestFace;
}

/**
 * Schritt 5b (p024):
 * Verstärkt die rechte Gehäusewand (+X, Port-Wand) um case_right_wall_extra_thickness (1.0 mm)
 * an Case_Top und Case_Bottom nach außen.
 * Der innere Hohlraum bleibt 100% unberührt, das Gehäuse wächst nur nach rechts von X = 45.7 mm auf X = 46.7 mm.
 */
export function thickenRightWall(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): ChassisBodies {
  const extraThickCm = params.caseRightWallExtraThickness
    ? params.caseRightWallExtraThickness.value
    : 0.1; // 1.0 mm in cm

  if (extraThickCm <= 1e-4) {
    return { topBody, bottomBody };
  }

  const offsetFeatures = rootComp.features.offsetFacesFeatures;
  const extrudes = rootComp.features.extrudeFeatures;
  const nominalOuterRightX =
    (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 +
    params.shellThickness.value; // 4.57 cm

  // 1. Case_Top rechte Außenwand versetzen
  let liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const topFace = findRightOuterPlanarFace(liveTop, nominalOuterRightX);
  if (!topFace) {
    console.warn("thickenRightWall: Äußere rechte Wand an Case_Top nicht gefunden.");
  } else {
    let topThickened = false;
    // Stufe A: OffsetFacesFeatures (Press Pull)
    try {
      let distVal = adsk.core.ValueInput.createByString('case_right_wall_extra_thickness');
      if (!distVal) distVal = adsk.core.ValueInput.createByReal(extraThickCm);
      const offsetInput = offsetFeatures.createInput([topFace], distVal);
      if (offsetInput) {
        const feat = offsetFeatures.add(offsetInput);
        if (feat) {
          topThickened = true;
          liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
          console.log(`thickenRightWall: Rechte Wand an Case_Top via OffsetFaces um ${extraThickCm * 10}mm nach außen versetzt.`);
        }
      }
    } catch (e) {
      console.warn(`thickenRightWall: OffsetFaces an Case_Top fehlgeschlagen (${e}), versuche Extrusions-Join...`);
    }

    // Stufe B: Extrusions-Join Fallback
    if (!topThickened) {
      try {
        let distVal = adsk.core.ValueInput.createByString('case_right_wall_extra_thickness');
        if (!distVal) distVal = adsk.core.ValueInput.createByReal(extraThickCm);
        const joinInput = extrudes.createInput(topFace, adsk.fusion.FeatureOperations.JoinFeatureOperation);
        joinInput.setDistanceExtent(false, distVal);
        joinInput.participantBodies = [getLiveBody(rootComp, liveTop, "Case_Top")];
        const feat = extrudes.add(joinInput);
        if (feat) {
          liveTop = getLiveBody(rootComp, liveTop, "Case_Top");
          console.log(`thickenRightWall: Rechte Wand an Case_Top via Extrude-Join um ${extraThickCm * 10}mm nach außen verstärkt.`);
        }
      } catch (eJoin) {
        console.warn(`thickenRightWall: Extrude-Join an Case_Top fehlgeschlagen: ${eJoin}`);
      }
    }
  }

  // 2. Case_Bottom rechte Außenwand versetzen
  let liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");
  const bottomFace = findRightOuterPlanarFace(liveBottom, nominalOuterRightX);
  if (!bottomFace) {
    console.warn("thickenRightWall: Äußere rechte Wand an Case_Bottom nicht gefunden.");
  } else {
    let bottomThickened = false;
    // Stufe A: OffsetFacesFeatures (Press Pull)
    try {
      let distVal = adsk.core.ValueInput.createByString('case_right_wall_extra_thickness');
      if (!distVal) distVal = adsk.core.ValueInput.createByReal(extraThickCm);
      const offsetInput = offsetFeatures.createInput([bottomFace], distVal);
      if (offsetInput) {
        const feat = offsetFeatures.add(offsetInput);
        if (feat) {
          bottomThickened = true;
          liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
          console.log(`thickenRightWall: Rechte Wand an Case_Bottom via OffsetFaces um ${extraThickCm * 10}mm nach außen versetzt.`);
        }
      }
    } catch (e) {
      console.warn(`thickenRightWall: OffsetFaces an Case_Bottom fehlgeschlagen (${e}), versuche Extrusions-Join...`);
    }

    // Stufe B: Extrusions-Join Fallback
    if (!bottomThickened) {
      try {
        let distVal = adsk.core.ValueInput.createByString('case_right_wall_extra_thickness');
        if (!distVal) distVal = adsk.core.ValueInput.createByReal(extraThickCm);
        const joinInput = extrudes.createInput(bottomFace, adsk.fusion.FeatureOperations.JoinFeatureOperation);
        joinInput.setDistanceExtent(false, distVal);
        joinInput.participantBodies = [getLiveBody(rootComp, liveBottom, "Case_Bottom")];
        const feat = extrudes.add(joinInput);
        if (feat) {
          liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
          console.log(`thickenRightWall: Rechte Wand an Case_Bottom via Extrude-Join um ${extraThickCm * 10}mm nach außen verstärkt.`);
        }
      } catch (eJoin) {
        console.warn(`thickenRightWall: Extrude-Join an Case_Bottom fehlgeschlagen: ${eJoin}`);
      }
    }
  }

  return {
    topBody: getLiveBody(rootComp, liveTop, "Case_Top"),
    bottomBody: getLiveBody(rootComp, liveBottom, "Case_Bottom")
  };
}

/**
 * Schritte 6 & 7:
 * 6) Selektiere bei beiden Körpern jeweils 8 Außenkanten:
 *    - Oberer Körper: 4 senkrechte Außenkanten + 4 obere horizontale Kanten (Trennlinie Z=0 bleibt unberührt)
 *    - Unterer Körper: 4 senkrechte Außenkanten + 4 untere horizontale Kanten (Trennlinie Z=0 bleibt unberührt)
 * 7) Mache Abrundung mit Radius 2mm
 */
export function filletOuterEdges(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): ChassisBodies {
  const radiusCm = params.cornerFilletRadius.value; // 0.2 cm (2 mm)
  const nominalHalfW =
    (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 +
    params.shellThickness.value; // 4.57 cm
  const extraThickCm = params.caseRightWallExtraThickness
    ? params.caseRightWallExtraThickness.value
    : 0.1; // 1.0 mm in cm
  const outerLeftX = -nominalHalfW; // -4.57 cm
  const outerRightX = nominalHalfW + extraThickCm; // +4.67 cm
  const halfD = params.caseDepth.value / 2.0;       // 3.12 cm
  const topHeight = params.caseTopHeight.value;     // 4.0 cm
  const bottomHeight = params.caseBottomHeight.value; // 0.64 cm
  const EDGE_TOL = 0.08; // 0.8 mm Toleranz

  // --- Kanten Oberkörper ---
  const liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const topEdgesToFillet: adsk.fusion.BRepEdge[] = [];

  for (let i = 0; i < liveTop.edges.count; i++) {
    const e = liveTop.edges.item(i);
    const pStart = e.startVertex.geometry;
    const pEnd = e.endVertex.geometry;

    // A: Obere 4 horizontale Außenkanten (Z ca. 4.0 cm, äußere Begrenzung)
    const isAtXOuter =
      Math.abs(pStart.x - outerLeftX) < EDGE_TOL ||
      Math.abs(pStart.x - outerRightX) < EDGE_TOL ||
      Math.abs(pEnd.x - outerLeftX) < EDGE_TOL ||
      Math.abs(pEnd.x - outerRightX) < EDGE_TOL;
    const isAtYOuter =
      Math.abs(Math.abs(pStart.y) - halfD) < EDGE_TOL ||
      Math.abs(Math.abs(pEnd.y) - halfD) < EDGE_TOL;

    const isTopHorizontal =
      Math.abs(pStart.z - topHeight) < EDGE_TOL &&
      Math.abs(pEnd.z - topHeight) < EDGE_TOL &&
      (isAtXOuter || isAtYOuter);

    // B: 4 senkrechte Außenkanten (Z erstreckt sich von 0 bis 4.0 cm an den Außen-Ecken)
    const isVertical =
      Math.abs(pStart.x - pEnd.x) < EDGE_TOL &&
      Math.abs(pStart.y - pEnd.y) < EDGE_TOL;

    const isTopVerticalOuter =
      isVertical &&
      Math.min(pStart.z, pEnd.z) < EDGE_TOL &&
      Math.max(pStart.z, pEnd.z) > topHeight - EDGE_TOL &&
      (Math.abs(pStart.x - outerLeftX) < EDGE_TOL || Math.abs(pStart.x - outerRightX) < EDGE_TOL) &&
      Math.abs(pStart.y) > halfD - EDGE_TOL;

    if (isTopHorizontal || isTopVerticalOuter) {
      topEdgesToFillet.push(e);
    }
  }

  console.log(`TopBody: ${topEdgesToFillet.length} Außenkanten für 2mm-Verrundung ermittelt (erwartet: 8).`);
  applyFilletWithFallbacks(
    rootComp,
    topEdgesToFillet,
    radiusCm,
    'corner_fillet_radius',
    'TopBodyOuterFillet'
  );

  // --- Kanten Unterkörper ---
  const liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");
  const bottomEdgesToFillet: adsk.fusion.BRepEdge[] = [];

  for (let i = 0; i < liveBottom.edges.count; i++) {
    const e = liveBottom.edges.item(i);
    const pStart = e.startVertex.geometry;
    const pEnd = e.endVertex.geometry;

    // A: Untere 4 horizontale Außenkanten (Z ca. -0.64 cm, äußere Begrenzung)
    const isAtBottomXOuter =
      Math.abs(pStart.x - outerLeftX) < EDGE_TOL ||
      Math.abs(pStart.x - outerRightX) < EDGE_TOL ||
      Math.abs(pEnd.x - outerLeftX) < EDGE_TOL ||
      Math.abs(pEnd.x - outerRightX) < EDGE_TOL;
    const isAtBottomYOuter =
      Math.abs(Math.abs(pStart.y) - halfD) < EDGE_TOL ||
      Math.abs(Math.abs(pEnd.y) - halfD) < EDGE_TOL;

    const isBottomHorizontal =
      Math.abs(pStart.z - (-bottomHeight)) < EDGE_TOL &&
      Math.abs(pEnd.z - (-bottomHeight)) < EDGE_TOL &&
      (isAtBottomXOuter || isAtBottomYOuter);

    // B: 4 senkrechte Außenkanten (Z erstreckt sich von -0.64 bis 0 cm an den Außen-Ecken)
    const isVertical =
      Math.abs(pStart.x - pEnd.x) < EDGE_TOL &&
      Math.abs(pStart.y - pEnd.y) < EDGE_TOL;

    const isBottomVerticalOuter =
      isVertical &&
      Math.min(pStart.z, pEnd.z) < -bottomHeight + EDGE_TOL &&
      Math.max(pStart.z, pEnd.z) > -EDGE_TOL &&
      (Math.abs(pStart.x - outerLeftX) < EDGE_TOL || Math.abs(pStart.x - outerRightX) < EDGE_TOL) &&
      Math.abs(pStart.y) > halfD - EDGE_TOL;

    if (isBottomHorizontal || isBottomVerticalOuter) {
      bottomEdgesToFillet.push(e);
    }
  }

  console.log(`BottomBody: ${bottomEdgesToFillet.length} Außenkanten für 2mm-Verrundung ermittelt (erwartet: 8).`);
  applyFilletWithFallbacks(
    rootComp,
    bottomEdgesToFillet,
    radiusCm,
    'corner_fillet_radius',
    'BottomBodyOuterFillet'
  );

  return {
    topBody: getLiveBody(rootComp, liveTop, "Case_Top"),
    bottomBody: getLiveBody(rootComp, liveBottom, "Case_Bottom")
  };
}

/**
 * Schritt 7b / p027:
 * Verrundet die Kanten auf der inneren Grundfläche von Case_Bottom, die parallel zur XY-Ebene liegen.
 *
 * Spezifikation:
 * - Bauteil: Case_Bottom
 * - Bezugsebene: Innere Grundfläche bei Z = -case_bottom_height + shell_thickness (-3.4 mm)
 * - Selektionskriterium: Ausschließlich Kanten, die parallel zur XY-Ebene verlaufen (Z_start ≈ Z_end ≈ -3.4 mm)
 * - Ausschluss: Senkrechte/aufrechte Kanten der Wände verbleiben unverrundet
 * - FDM-Druckoptimierung: Vermeidung von Kerbspannungen, stützfreier Übergang von der Bodenplatte zur Wand
 * - Radius: case_bottom_inner_fillet_radius (Standard: 1.0 mm)
 */
export function filletCaseBottomInnerFloorEdges(
  rootComp: adsk.fusion.Component,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): adsk.fusion.BRepBody {
  const liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");
  const radiusCm = params.caseBottomInnerFilletRadius.value;
  if (radiusCm <= 0.001) {
    return liveBottom;
  }

  // Z-Koordinate des inneren Gehäusebodens: Z = -case_bottom_height + shell_thickness (-0.34 cm)
  const zFloorCm = -params.caseBottomHeight.value + params.shellThickness.value;
  const TOL = 0.08; // 0.8 mm Toleranz

  // 1. Die innere Grundfläche (horizontale PlanarFace bei Z ≈ zFloorCm mit Normalenvektor in +Z) finden
  let floorFace: adsk.fusion.BRepFace | null = null;
  for (let i = 0; i < liveBottom.faces.count; i++) {
    const f = liveBottom.faces.item(i);
    if (!f || !f.isValid) continue;
    if (f.geometry.surfaceType !== adsk.core.SurfaceTypes.PlaneSurfaceType) continue;

    const plane = f.geometry as adsk.core.Plane;
    // Normale muss nach oben (+Z) zeigen (normal.z > 0.8)
    if (plane.normal.z < 0.8) continue;

    if (Math.abs(f.centroid.z - zFloorCm) < TOL) {
      floorFace = f;
      break;
    }
  }

  const edgesToFillet: adsk.fusion.BRepEdge[] = [];

  if (floorFace) {
    // Alle Kanten der inneren Grundfläche prüfen:
    // Sie müssen parallel zur XY-Ebene liegen (Start- und Endpunkt bei Z ≈ zFloorCm)
    for (let i = 0; i < floorFace.edges.count; i++) {
      const edge = floorFace.edges.item(i);
      if (!edge || !edge.isValid || edge.isDegenerate) continue;

      const sp = edge.startVertex ? edge.startVertex.geometry : null;
      const ep = edge.endVertex ? edge.endVertex.geometry : null;

      if (sp && ep) {
        // Beide Punkte müssen auf Höhe des Bodens liegen und delta Z ≈ 0 (parallel zur XY-Ebene)
        if (
          Math.abs(sp.z - zFloorCm) < TOL &&
          Math.abs(ep.z - zFloorCm) < TOL &&
          Math.abs(sp.z - ep.z) < 0.02
        ) {
          edgesToFillet.push(edge);
        }
      } else {
        // Fallback für periodische / geschlossene Kanten
        if (Math.abs(edge.pointOnEdge.z - zFloorCm) < TOL) {
          edgesToFillet.push(edge);
        }
      }
    }
  }

  // Fallback: Sollte floorFace nicht isoliert werden können, alle Kanten des Körpers bei Z ≈ zFloorCm filtern
  if (edgesToFillet.length === 0) {
    for (let i = 0; i < liveBottom.edges.count; i++) {
      const edge = liveBottom.edges.item(i);
      if (!edge || !edge.isValid || edge.isDegenerate) continue;
      const sp = edge.startVertex ? edge.startVertex.geometry : null;
      const ep = edge.endVertex ? edge.endVertex.geometry : null;
      if (sp && ep) {
        if (
          Math.abs(sp.z - zFloorCm) < TOL &&
          Math.abs(ep.z - zFloorCm) < TOL &&
          Math.abs(sp.z - ep.z) < 0.02
        ) {
          const midX = (sp.x + ep.x) / 2.0;
          const midY = (sp.y + ep.y) / 2.0;
          // Nur im Gehäuseinneren
          if (Math.abs(midX) < 4.4 && Math.abs(midY) < 3.0) {
            edgesToFillet.push(edge);
          }
        }
      }
    }
  }

  console.log(
    `filletCaseBottomInnerFloorEdges: ${edgesToFillet.length} Kanten auf der inneren Grundfläche (parallel zur XY-Ebene) für Verrundung (${(radiusCm * 10).toFixed(1)} mm) gefunden (erwartet: 4).`
  );

  if (edgesToFillet.length > 0) {
    applyFilletWithFallbacks(
      rootComp,
      edgesToFillet,
      radiusCm,
      "case_bottom_inner_fillet_radius",
      "CaseBottomInnerFloorFillet"
    );
  }

  const updatedBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
  try {
    updatedBottom.name = "Case_Bottom";
  } catch (_e) {}
  return updatedBottom;
}

/**
 * Schritte 8, 10, 11, 12, 13:
 * 8) Selektiere die Fläche oben (Deckel) und konstruiere eine Ebene bei -8mm
 * 10) Erzeuge Skizze auf Hilfsebene bei -8mm
 * 11) Konstruiere Rechteck mit 54 x 85 mm (zentriert)
 * 12) Selektiere die 4 Kanten des Rechtecks und mache Versatz von 10mm nach außen
 * 13) Selektiere den Bereich zwischen den 2 Rechtecken und mache Extrusion (Ausschneiden) nach unten mit -2.5mm
 */
export function createGrooveFeature(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  params: Params
): adsk.fusion.BRepBody {
  const liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const topHeight = params.caseTopHeight.value; // 4.0 cm
  const planeOffsetCm = params.groovePlaneOffset.value; // -0.8 cm (-8 mm)
  const grooveZ = topHeight + planeOffsetCm; // 3.2 cm

  // 8) Hilfsebene bei Z = 3.2 cm (8 mm unter Deckeloberkante bei Z = 4.0 cm) konstruieren
  const topFace = findHorizontalPlanarFace(liveTop, topHeight, 'max');
  let groovePlane: adsk.fusion.ConstructionPlane | null = null;
  if (topFace) {
    try {
      groovePlane = createOffsetPlane(rootComp, topFace, planeOffsetCm, 'groove_plane_offset');
    } catch (_e) { }
  }
  if (!groovePlane) {
    groovePlane = createOffsetPlane(
      rootComp,
      rootComp.xYConstructionPlane,
      grooveZ,
      'case_top_height + groove_plane_offset'
    );
  }
  if (!groovePlane) {
    throw new Error("Erstellung der Konstruktionsebene bei -8mm fehlgeschlagen.");
  }
  groovePlane.name = "Plane_Groove_Minus8mm";

  // 10) Skizze auf Hilfsebene
  const sketch = rootComp.sketches.add(groovePlane);
  sketch.name = "Sketch_Groove_Cut";

  // 11) Basis-Geometrie für die umlaufende Fuge:
  // Das Gehäuse erstreckt sich von outerLeftX = -45.7 mm bis outerRightX = +46.7 mm (X)
  // und von -halfBaseD = -31.2 mm bis +halfBaseD = +31.2 mm (Y).
  const nominalHalfW =
    (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 +
    params.shellThickness.value; // 4.57 cm
  const extraThickCm = params.caseRightWallExtraThickness
    ? params.caseRightWallExtraThickness.value
    : 0.1; // 1.0 mm in cm
  const outerLeftX = -nominalHalfW; // -4.57 cm (-45.7 mm)
  const outerRightX = nominalHalfW + extraThickCm; // +4.67 cm (+46.7 mm)
  const baseDCm = params.grooveBaseDepth.value;
  const halfBaseD = baseDCm / 2.0; // 3.12 cm (31.2 mm)

  // 12) Versatz nach innen um 1.5 mm (groove_inset)
  // Der innere Rand definiert die verbleibende Stufe / Schattenfuge:
  const insetCm = params.grooveInset.value; // 0.15 cm (1.5 mm)
  const innerLeftX = outerLeftX + insetCm;   // -4.42 cm (-44.2 mm)
  const innerRightX = outerRightX - insetCm; // +4.52 cm (+45.2 mm)
  const innerFrontY = -halfBaseD + insetCm;  // -2.97 cm (-29.7 mm)
  const innerBackY = halfBaseD - insetCm;    // +2.97 cm (+29.7 mm)

  // Äußeres Schneidrechteck:
  // Mit leichtem Überstand (3 mm) nach außen, damit die Fuge das Bauteil zuverlässig nach außen freischneidet
  const marginCm = 0.3; // 3 mm Überstand nach außen
  const cutOuterLeftX = outerLeftX - marginCm;
  const cutOuterRightX = outerRightX + marginCm;
  const cutOuterFrontY = -halfBaseD - marginCm;
  const cutOuterBackY = halfBaseD + marginCm;

  const lines = sketch.sketchCurves.sketchLines;

  // Äußeres Rechteck im 2D-Skizzenraum
  const p0 = adsk.core.Point3D.create(cutOuterLeftX, cutOuterFrontY, 0);
  const p1 = adsk.core.Point3D.create(cutOuterRightX, cutOuterFrontY, 0);
  const p2 = adsk.core.Point3D.create(cutOuterRightX, cutOuterBackY, 0);
  const p3 = adsk.core.Point3D.create(cutOuterLeftX, cutOuterBackY, 0);

  lines.addByTwoPoints(p0, p1);
  lines.addByTwoPoints(p1, p2);
  lines.addByTwoPoints(p2, p3);
  lines.addByTwoPoints(p3, p0);

  // Inneres Rechteck im 2D-Skizzenraum (exakte Fugen-Innenkontur)
  const pIn0 = adsk.core.Point3D.create(innerLeftX, innerFrontY, 0);
  const pIn1 = adsk.core.Point3D.create(innerRightX, innerFrontY, 0);
  const pIn2 = adsk.core.Point3D.create(innerRightX, innerBackY, 0);
  const pIn3 = adsk.core.Point3D.create(innerLeftX, innerBackY, 0);

  lines.addByTwoPoints(pIn0, pIn1);
  lines.addByTwoPoints(pIn1, pIn2);
  lines.addByTwoPoints(pIn2, pIn3);
  lines.addByTwoPoints(pIn3, pIn0);

  // 13) Ringprofil zwischen den 2 Rechtecken selektieren (profileLoops.count === 2)
  let grooveRingProfile: adsk.fusion.Profile | null = null;
  for (let i = 0; i < sketch.profiles.count; i++) {
    const prof = sketch.profiles.item(i);
    if (prof && prof.profileLoops.count === 2) {
      grooveRingProfile = prof;
      break;
    }
  }

  // Robuster Fallback: Das Profil mit der kleineren Fläche ist der Ring
  if (!grooveRingProfile && sketch.profiles.count >= 2) {
    let minArea = Infinity;
    for (let i = 0; i < sketch.profiles.count; i++) {
      const prof = sketch.profiles.item(i);
      if (prof) {
        const area = prof.areaProperties().area;
        if (area < minArea) {
          minArea = area;
          grooveRingProfile = prof;
        }
      }
    }
  }

  if (!grooveRingProfile) {
    throw new Error("Ringprofil zwischen den beiden Fugen-Rechtecken nicht gefunden.");
  }

  // Extrusion (Ausschneiden) nach unten (-Z) mit -2.5mm
  const extrudes = rootComp.features.extrudeFeatures;
  const cutInput = extrudes.createInput(
    grooveRingProfile,
    adsk.fusion.FeatureOperations.CutFeatureOperation
  );

  // Richtungsprüfung bezogen auf Normalenvektor der Hilfsebene
  const planeGeom = groovePlane.geometry as adsk.core.Plane;
  const normalZ = planeGeom.normal.z;
  let cutDistVal: adsk.core.ValueInput | null = null;
  if (normalZ >= 0) {
    try {
      cutDistVal = adsk.core.ValueInput.createByString('groove_cut_depth');
    } catch (_e) { }
  }
  if (!cutDistVal) {
    const cutSign = normalZ >= 0 ? -1.0 : 1.0;
    const cutDepthCm = Math.abs(params.grooveCutDepth.value);
    cutDistVal = adsk.core.ValueInput.createByReal(cutSign * cutDepthCm);
  }
  cutInput.setDistanceExtent(false, cutDistVal);

  // Explizit nur Case_Top als Zielkörper zuweisen (AGENTS.md §4.5)
  cutInput.participantBodies = [getLiveBody(rootComp, liveTop, "Case_Top")];

  const cutFeat = extrudes.add(cutInput);
  if (!cutFeat) {
    throw new Error("Schnitt-Extrusion der Gehäusefuge fehlgeschlagen.");
  }

  return getLiveBody(rootComp, liveTop, "Case_Top");
}

/**
 * Schritt 14:
 * Selektiere in der entstandenen Fuge die 4 senkrechten Kanten und mache eine Abrundung von 1mm
 */
export function filletGrooveEdges(
  rootComp: adsk.fusion.Component,
  topBody: adsk.fusion.BRepBody,
  params: Params
): adsk.fusion.BRepBody {
  const liveTop = getLiveBody(rootComp, topBody, "Case_Top");
  const nominalHalfW =
    (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 +
    params.shellThickness.value; // 4.57 cm
  const extraThickCm = params.caseRightWallExtraThickness
    ? params.caseRightWallExtraThickness.value
    : 0.1; // 1.0 mm in cm
  const outerLeftX = -nominalHalfW; // -4.57 cm
  const outerRightX = nominalHalfW + extraThickCm; // +4.67 cm
  const halfBaseD = params.grooveBaseDepth.value / 2.0;

  const insetCm = params.grooveInset.value; // 0.15 cm (1.5 mm)
  const innerLeftX = outerLeftX + insetCm;   // -4.42 cm (-44.2 mm)
  const innerRightX = outerRightX - insetCm; // +4.52 cm (+45.2 mm)
  const innerFrontY = -halfBaseD + insetCm;  // -2.97 cm (-29.7 mm)
  const innerBackY = halfBaseD - insetCm;    // +2.97 cm (+29.7 mm)
  const filletRadiusCm = params.grooveFilletRadius.value; // 0.1 cm (1 mm)

  // Die Fuge schneidet von Z = 3.2 cm nach unten auf Z = 3.2 - 0.25 = 2.95 cm
  const grooveZTop = params.caseTopHeight.value + params.groovePlaneOffset.value; // 4.0 + (-0.8) = 3.2 cm
  const cutDepthCm = Math.abs(params.grooveCutDepth.value); // 0.25 cm (2.5 mm)
  const grooveZBottom = grooveZTop - cutDepthCm;            // 2.95 cm
  const EDGE_TOL = 0.08;

  const grooveVerticalEdges: adsk.fusion.BRepEdge[] = [];

  for (let i = 0; i < liveTop.edges.count; i++) {
    const e = liveTop.edges.item(i);
    const pStart = e.startVertex.geometry;
    const pEnd = e.endVertex.geometry;

    // Senkrechte Kante (Start- und Endpunkt identisch in X und Y)
    const isVertical =
      Math.abs(pStart.x - pEnd.x) < EDGE_TOL &&
      Math.abs(pStart.y - pEnd.y) < EDGE_TOL;

    if (!isVertical) continue;

    // Kantenlänge ca. 2.5 mm
    const edgeLen = Math.abs(pStart.z - pEnd.z);
    const matchesLength = Math.abs(edgeLen - cutDepthCm) < EDGE_TOL;

    // Höhenbereich in der Fuge [2.95 cm ... 3.2 cm]
    const matchesZ =
      Math.min(pStart.z, pEnd.z) >= grooveZBottom - EDGE_TOL &&
      Math.max(pStart.z, pEnd.z) <= grooveZTop + EDGE_TOL;

    // Position an den 4 Ecken des inneren Fugen-Rechtecks (X bei -4.42 cm oder +4.52 cm; Y bei ±2.97 cm)
    const matchesCorner =
      (Math.abs(pStart.x - innerLeftX) < EDGE_TOL || Math.abs(pStart.x - innerRightX) < EDGE_TOL) &&
      (Math.abs(pStart.y - innerFrontY) < EDGE_TOL || Math.abs(pStart.y - innerBackY) < EDGE_TOL);

    if (matchesLength && matchesZ && matchesCorner) {
      grooveVerticalEdges.push(e);
    }
  }

  console.log(`Fuge: ${grooveVerticalEdges.length} senkrechte Kanten für 1mm-Verrundung gefunden (erwartet: 4).`);

  applyFilletWithFallbacks(
    rootComp,
    grooveVerticalEdges,
    filletRadiusCm,
    'groove_fillet_radius',
    'GrooveVerticalFillet'
  );

  return getLiveBody(rootComp, liveTop, "Case_Top");
}
