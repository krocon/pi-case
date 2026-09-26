import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import { CaseAssemblyBodies, getLiveBody, applyFilletWithFallbacks } from "./utils";

// =====================================================================
// SPANNUNGSREDUZIERENDE FASEN & VERRUNDUNGEN FÜR FDM-DRUCK (SCHRITT 22)
// =====================================================================

/**
 * Prüft, ob eine Fläche eine äußere Sichtfläche der Gehäuseaußenwand darstellt.
 */
function isOuterWallFace(face: adsk.fusion.BRepFace): boolean {
  if (face.geometry.surfaceType === adsk.core.SurfaceTypes.PlaneSurfaceType) {
    const pln = face.geometry as adsk.core.Plane;
    const c = face.centroid;
    // Kurze Seitenwände (X ≈ ±45.7 mm)
    if (Math.abs(pln.normal.x) > 0.9 && Math.abs(c.x) > 4.2) return true;
    // Lange Seitenwände (Y ≈ ±31.2 mm)
    if (Math.abs(pln.normal.y) > 0.9 && Math.abs(c.y) > 2.8) return true;
  }
  return false;
}

/**
 * Filtert und sammelt nicht-sichtbare 90°-Innenkanten eines Gehäusekörpers zur Spannungsreduktion im FDM-Druck.
 * Schließt strikt alle Trennebenen (Z=0, Z=29.5mm), Führungs- und Rastnasen (Nut/Feder),
 * Stufenfalze, Platinen-Auflageflächen (Standoff-Köpfe), Gewindebohrungen, Lüftungsschlitze
 * und äußere Sichtflächen aus.
 */
export function collectStressReliefEdges(
  _comp: adsk.fusion.Component,
  body: adsk.fusion.BRepBody,
  role: 'top' | 'middle' | 'bottom' | 'main',
  params: Params
): adsk.fusion.BRepEdge[] {
  const result: adsk.fusion.BRepEdge[] = [];
  if (!body || !body.isValid) return result;

  const concaveIds = new Set<number>();
  try {
    for (let i = 0; i < body.concaveEdges.count; i++) {
      const ce = body.concaveEdges.item(i);
      if (ce && ce.isValid) concaveIds.add(ce.tempId);
    }
  } catch (_e) {
    // Bei BRep-Ausnahmen still abfangen
  }

  // Parameter-Höhenbezüge (in cm)
  const zBottomCm = -params.caseBottomHeight.value; // z.B. -0.64 cm (-6.4 mm)
  const zFloorCm = zBottomCm + params.shellThickness.value; // z.B. -0.34 cm (-3.4 mm)
  const standoffHeightCm = params.standoffHeight.value; // z.B. 0.15 cm (1.5 mm)
  const standoffTopZCm = zFloorCm + standoffHeightCm; // z.B. -0.19 cm (-1.9 mm)
  const splitZCm = params.lidSplitZ.value; // z.B. 2.95 cm (29.5 mm)
  const jointDepthCm = params.lidJointDepth.value; // z.B. 0.5 cm (5.0 mm)
  const zTopCm = params.caseTopHeight.value; // z.B. 4.0 cm (40 mm)

  for (let i = 0; i < body.edges.count; i++) {
    const edge = body.edges.item(i);
    if (!edge || !edge.isValid) continue;

    // Nur echte Innenkanten (konkav)
    if (!concaveIds.has(edge.tempId)) continue;

    // Nur Manifold-Kanten mit genau zwei angrenzenden BRepFaces
    if (edge.faces.count !== 2) continue;
    if (edge.isDegenerate) continue;
    if (edge.length < 0.08) continue; // Mindestens 0.8mm Kantenlänge

    const face1 = edge.faces.item(0);
    const face2 = edge.faces.item(1);
    if (!face1 || !face2 || !face1.isValid || !face2.isValid) continue;

    // 1. Rechtwinkligkeitsprüfung (ca. 90° Winkel)
    const s1 = face1.geometry.surfaceType;
    const s2 = face2.geometry.surfaceType;
    let isOrthogonal = false;

    if (
      s1 === adsk.core.SurfaceTypes.PlaneSurfaceType &&
      s2 === adsk.core.SurfaceTypes.PlaneSurfaceType
    ) {
      const n1 = (face1.geometry as adsk.core.Plane).normal;
      const n2 = (face2.geometry as adsk.core.Plane).normal;
      const dot = Math.abs(n1.dotProduct(n2));
      if (dot < 0.15) {
        isOrthogonal = true;
      }
    } else if (
      (s1 === adsk.core.SurfaceTypes.CylinderSurfaceType && s2 === adsk.core.SurfaceTypes.PlaneSurfaceType) ||
      (s2 === adsk.core.SurfaceTypes.CylinderSurfaceType && s1 === adsk.core.SurfaceTypes.PlaneSurfaceType)
    ) {
      const cyl = (s1 === adsk.core.SurfaceTypes.CylinderSurfaceType ? face1.geometry : face2.geometry) as adsk.core.Cylinder;
      const pln = (s1 === adsk.core.SurfaceTypes.PlaneSurfaceType ? face1.geometry : face2.geometry) as adsk.core.Plane;
      const dot = Math.abs(cyl.axis.dotProduct(pln.normal));
      if (dot < 0.15 || dot > 0.85) {
        isOrthogonal = true;
      }
    }

    if (!isOrthogonal) continue;

    // 2. Kantenpositionen ermitteln
    const sp = edge.startVertex ? edge.startVertex.geometry : null;
    const ep = edge.endVertex ? edge.endVertex.geometry : null;
    const midZ = sp && ep ? (sp.z + ep.z) / 2.0 : edge.pointOnEdge.z;
    const midX = sp && ep ? (sp.x + ep.x) / 2.0 : edge.pointOnEdge.x;
    const midY = sp && ep ? (sp.y + ep.y) / 2.0 : edge.pointOnEdge.y;

    // Keine Kanten an äußeren Sichtflächen
    if (isOuterWallFace(face1) || isOuterWallFace(face2)) continue;

    // -----------------------------------------------------------------
    // A. Rolle: Case_Bottom (Gehäuseboden)
    // -----------------------------------------------------------------
    if (role === 'bottom') {
      // Nur Kanten parallel zur XY-Ebene auf der inneren Grundfläche (sp.z ≈ ep.z)
      // Aufrechte/vertikale Wand-Innenecken strikt ausschließen (p027)
      if (sp && ep && Math.abs(sp.z - ep.z) > 0.02) continue;

      // Trennebene bei Z = 0 und Feder (Tongue) bei Z in [0, 1.6 mm] schützen
      if (midZ > -0.05) continue;
      if (sp && sp.z > -0.05) continue;
      if (ep && ep.z > -0.05) continue;

      // Standoff-Kopf (Platinen-Auflagefläche) bei Z = -0.9 mm schützen
      if (Math.abs(midZ - standoffTopZCm) < 0.05) continue;
      if (sp && Math.abs(sp.z - standoffTopZCm) < 0.03 && ep && Math.abs(ep.z - standoffTopZCm) < 0.03) continue;

      // M2.5-Kernloch / Innengewinde in den Säulen (Bohrungsradius < 2.0 mm) schützen
      if (s1 === adsk.core.SurfaceTypes.CylinderSurfaceType) {
        const cyl = face1.geometry as adsk.core.Cylinder;
        if (cyl.radius < 0.20) continue;
      }
      if (s2 === adsk.core.SurfaceTypes.CylinderSurfaceType) {
        const cyl = face2.geometry as adsk.core.Cylinder;
        if (cyl.radius < 0.20) continue;
      }

      // Außenbodenunterseite bei Z = -6.4 mm schützen
      if (Math.abs(midZ - zBottomCm) < 0.05) continue;

    }

    // -----------------------------------------------------------------
    // B. Rolle: Case_Middle (Gehäuse-Mittelteil)
    // -----------------------------------------------------------------
    if (role === 'middle') {
      // Unterer Stufenfalz & Rastnase bei Z in [0, 5.5 mm] schützen
      const bottomStepZCm = params.jointDepth ? params.jointDepth.value + params.jointVerticalClearance.value : 0.53;
      if (midZ < bottomStepZCm + 0.05) continue;
      if (sp && sp.z < bottomStepZCm + 0.05) continue;
      if (ep && ep.z < bottomStepZCm + 0.05) continue;

      // Oberer Stufenfalz bei Z in [24.5, 29.5 mm] schützen (plane Pass- und Trennflächen zu Case_Top)
      const stepCutZCm = splitZCm - jointDepthCm; // 2.45 cm
      if (midZ > stepCutZCm - 0.05) continue;
      if (sp && sp.z > stepCutZCm - 0.05) continue;
      if (ep && ep.z > stepCutZCm - 0.05) continue;
    }

    // -----------------------------------------------------------------
    // C. Rolle: Case_Top (Gehäusedeckel)
    // -----------------------------------------------------------------
    if (role === 'top') {
      // Unterer Steckkragen und Trennebene bei Z <= splitZCm schützen (inkl. Mini-Fase bei Z=24.5 mm)
      if (midZ < splitZCm + 0.02) continue;
      if (sp && sp.z < splitZCm + 0.02) continue;
      if (ep && ep.z < splitZCm + 0.02) continue;

      // Deckel-Lüftungsschlitze (7 Schlitze, 80x2.5mm, Z in Deckelnähe) schützen
      const ceilingZ = zTopCm - params.shellThickness.value;
      if (midZ > ceilingZ - 0.15 && Math.abs(midX) < 4.1 && Math.abs(midY) < 2.5) continue;

      // Äußere Deckeloberseite bei Z = zTopCm schützen
      if (Math.abs(midZ - zTopCm) < 0.05) continue;

      // Umlaufende Schattenfuge (Z in [grooveZBottom, grooveZTop]) schützen
      const grooveTopZ = zTopCm + params.groovePlaneOffset.value;
      if (midZ < grooveTopZ + 0.05 && (Math.abs(midX) > 4.2 || Math.abs(midY) > 2.8)) continue;
    }

    // -----------------------------------------------------------------
    // D. Rolle: Case_Main (Zusammengeführtes Gehäuse ohne Sims, p025)
    // -----------------------------------------------------------------
    if (role === 'main') {
      // Unterer Stufenfalz & Rastnase bei Z in [0, 5.5 mm] schützen
      const bottomStepZCm = params.jointDepth ? params.jointDepth.value + params.jointVerticalClearance.value : 0.53;
      if (midZ < bottomStepZCm + 0.05) continue;
      if (sp && sp.z < bottomStepZCm + 0.05) continue;
      if (ep && ep.z < bottomStepZCm + 0.05) continue;

      // Deckel-Lüftungsschlitze (6 Schlitze, 80x2.5mm, Z in Deckelnähe) schützen
      const ceilingZ = zTopCm - params.shellThickness.value;
      if (midZ > ceilingZ - 0.15 && Math.abs(midX) < 4.1 && Math.abs(midY) < 2.5) continue;

      // Äußere Deckeloberseite bei Z = zTopCm schützen
      if (Math.abs(midZ - zTopCm) < 0.05) continue;
    }

    result.push(edge);
  }

  return result;
}

/**
 * Sammelt die in p011-Ergänzung spezifizierten Innenlinien von Case_Top (siehe Referenzbild):
 * 1) Die 28 Innenkanten der 7 Deckel-Lüftungsschlitze an der Gehäusedecke (Z ≈ 3.7 cm)
 * 2) Die Innenkanten der LED-Halterungshülse an der Innenwand/Decke (X in [-4.27, -4.02 cm])
 */
export function collectCaseTopInnerEdges(
  _comp: adsk.fusion.Component,
  body: adsk.fusion.BRepBody,
  params: Params
): adsk.fusion.BRepEdge[] {
  const result: adsk.fusion.BRepEdge[] = [];
  if (!body || !body.isValid) return result;

  const zTopCm = params.caseTopHeight.value;
  const ceilingZ = zTopCm - params.shellThickness.value; // 3.70 cm (37.0 mm nominal)
  const leftOuterX =
    - (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 -
    params.shellThickness.value; // -4.57 cm
  const innerWallX = leftOuterX + params.shellThickness.value; // -4.27 cm
  const sleeveDepth = params.ledBodyDepth.value; // 0.25 cm
  const sleeveEndX = innerWallX + sleeveDepth; // -4.02 cm
  const splitZCm = params.lidSplitZ.value; // 2.95 cm nominal
  const ledSleeveMinZ = params.ledZOffset.value - (params.ledOpeningHeight.value / 2.0 + params.ledHolderWallThickness.value);

  for (let i = 0; i < body.edges.count; i++) {
    const edge = body.edges.item(i);
    if (!edge || !edge.isValid) continue;
    if (edge.faces.count !== 2) continue;
    if (edge.isDegenerate) continue;
    if (edge.length < 0.04) continue; // Mindestens 0.4 mm

    const face1 = edge.faces.item(0);
    const face2 = edge.faces.item(1);
    if (!face1 || !face2 || !face1.isValid || !face2.isValid) continue;

    // Keine Kanten an den Gehäuse-Außenwänden
    if (isOuterWallFace(face1) || isOuterWallFace(face2)) continue;

    const sp = edge.startVertex ? edge.startVertex.geometry : null;
    const ep = edge.endVertex ? edge.endVertex.geometry : null;
    const mid = edge.pointOnEdge;
    const midZ = sp && ep ? (sp.z + ep.z) / 2.0 : mid.z;
    const midX = sp && ep ? (sp.x + ep.x) / 2.0 : mid.x;
    const midY = sp && ep ? (sp.y + ep.y) / 2.0 : mid.y;

    // Keine Kanten an der äußeren Deckelfläche (Z = zTopCm)
    if (midZ > zTopCm - 0.05) continue;

    // Keine Kanten am Steckkragen unten (Z <= splitZCm)
    if (midZ < splitZCm + 0.02) continue;

    // -----------------------------------------------------------------
    // 1. Innenkanten der 7 Lüftungsschlitze an der Decke (Z ≈ ceilingZ)
    // -----------------------------------------------------------------
    const isCeilingFace = (f: adsk.fusion.BRepFace) => {
      if (f.geometry.surfaceType === adsk.core.SurfaceTypes.PlaneSurfaceType) {
        const pln = f.geometry as adsk.core.Plane;
        return Math.abs(pln.normal.z) > 0.85 && Math.abs(f.centroid.z - ceilingZ) < 0.12;
      }
      return false;
    };

    const touchesCeiling = isCeilingFace(face1) || isCeilingFace(face2);

    if (
      touchesCeiling &&
      Math.abs(midZ - ceilingZ) < 0.08 &&
      Math.abs(midX) <= 4.15 &&
      Math.abs(midY) <= 2.50
    ) {
      const otherFace = isCeilingFace(face1) ? face2 : face1;
      if (otherFace.centroid.z > ceilingZ - 0.15) {
        result.push(edge);
        continue;
      }
    }

    // -----------------------------------------------------------------
    // 2. Innenkanten der LED-Halterungshülse
    // -----------------------------------------------------------------
    if (
      midX >= innerWallX - 0.02 &&
      midX <= sleeveEndX + 0.04 &&
      midY >= -2.15 &&
      midY <= -1.05 &&
      midZ >= ledSleeveMinZ - 0.05 &&
      midZ <= ceilingZ + 0.05
    ) {
      // Kanten an der Innenstirnfläche bei X ≈ -4.02 cm (Tunnelöffnung & Außenkontur der Hülse)
      if (Math.abs(midX - sleeveEndX) < 0.05) {
        result.push(edge);
        continue;
      }
      // Untere Kante der Hülse
      if (Math.abs(midZ - ledSleeveMinZ) < 0.08) {
        result.push(edge);
        continue;
      }
    }
  }

  return result;
}

export type StressReliefBodiesInput = CaseAssemblyBodies;
export type StressReliefResult = CaseAssemblyBodies;

/**
 * Führt die spannungsreduzierenden Behandlungen an allen Gehäusekörpern aus.
 * Gesteuert über den Parameter 'enable_stress_relief_fillets' (0=Aus, 1=An, Default=1).
 */
export function applyStressReliefTreatments(
  comp: adsk.fusion.Component,
  bodies: StressReliefBodiesInput,
  params: Params
): StressReliefResult {
  const isEnabled = Math.round(params.enableStressReliefFillets.value) === 1;

  if (!isEnabled) {
    console.log("Spannungsreduzierende Verrundungen sind deaktiviert (enable_stress_relief_fillets = 0).");
    return {
      top: bodies.top ? getLiveBody(comp, bodies.top, "Case_Top") : undefined,
      middle: bodies.middle ? getLiveBody(comp, bodies.middle, "Case_Middle") : undefined,
      bottom: getLiveBody(comp, bodies.bottom, "Case_Bottom"),
      main: bodies.main ? getLiveBody(comp, bodies.main, "Case_Main") : undefined
    };
  }

  console.log("Wende spannungsreduzierende Verrundungen an nicht-sichtbaren Innenkanten an (enable_stress_relief_fillets = 1)...");

  const filletRadiusCm = params.stressReliefFilletRadius.value; // z.B. 0.1 cm (1.0 mm)
  const filletParamName = "stress_relief_fillet_radius";

  // 1. Case_Bottom: Kanten auf der inneren Grundfläche (ausschließlich parallel zur XY-Ebene, p027)
  try {
    const liveBottom = getLiveBody(comp, bodies.bottom, "Case_Bottom");
    const edgesBottom = collectStressReliefEdges(comp, liveBottom, 'bottom', params);
    if (edgesBottom.length > 0) {
      console.log(`StressRelief_Bottom: ${edgesBottom.length} nicht-sichtbare Innenkanten (parallel zur XY-Ebene) gefunden.`);
      applyFilletWithFallbacks(comp, edgesBottom, filletRadiusCm, filletParamName, "StressRelief_Bottom");
    } else {
      console.log("StressRelief_Bottom: Keine passenden Innenkanten identifiziert (bereits in Schritt 7b verrundet).");
    }
  } catch (e) {
    console.warn(`Spannungsreduzierende Verrundung an Case_Bottom: ${e}`);
  }

  // 2. Case_Main (p025 Merged-Modus):
  if (bodies.main) {
    try {
      let liveMain = getLiveBody(comp, bodies.main, "Case_Main");
      const edgesMain = collectStressReliefEdges(comp, liveMain, 'main', params);
      if (edgesMain.length > 0) {
        console.log(`StressRelief_Main: ${edgesMain.length} nicht-sichtbare Innenkanten gefunden.`);
        applyFilletWithFallbacks(comp, edgesMain, filletRadiusCm, filletParamName, "StressRelief_Main");
      } else {
        console.log("StressRelief_Main: Keine passenden Innenkanten identifiziert.");
      }

      liveMain = getLiveBody(comp, liveMain, "Case_Main");
      const innerEdgesMain = collectCaseTopInnerEdges(comp, liveMain, params);
      if (innerEdgesMain.length > 0) {
        console.log(`StressRelief_Main_InnerFeatures: ${innerEdgesMain.length} Kanten für 0.5mm Verrundung gefunden.`);
        const lidFilletRadiusCm = params.lidInnerFilletRadius.value; // 0.05 cm (0.5 mm)
        const lidFilletParamName = "lid_inner_fillet_radius";
        applyFilletWithFallbacks(comp, innerEdgesMain, lidFilletRadiusCm, lidFilletParamName, "StressRelief_Main_InnerFeatures");
      }
    } catch (e) {
      console.warn(`Spannungsreduzierende Verrundung an Case_Main: ${e}`);
    }

    const finalMain = getLiveBody(comp, bodies.main, "Case_Main");
    try { finalMain.name = "Case_Main"; } catch (_e) { }
    const finalBottom = getLiveBody(comp, bodies.bottom, "Case_Bottom");
    try { finalBottom.name = "Case_Bottom"; } catch (_e) { }

    return {
      bottom: finalBottom,
      main: finalMain
    };
  }

  // 3. Case_Middle (regulärer 3-Körper-Modus): Aufrechte Wand-Innenecken der Schale
  if (bodies.middle) {
    try {
      const liveMiddle = getLiveBody(comp, bodies.middle, "Case_Middle");
      const edgesMiddle = collectStressReliefEdges(comp, liveMiddle, 'middle', params);
      if (edgesMiddle.length > 0) {
        console.log(`StressRelief_Middle: ${edgesMiddle.length} nicht-sichtbare Innenkanten gefunden.`);
        applyFilletWithFallbacks(comp, edgesMiddle, filletRadiusCm, filletParamName, "StressRelief_Middle");
      } else {
        console.log("StressRelief_Middle: Keine passenden Innenkanten identifiziert.");
      }
    } catch (e) {
      console.warn(`Spannungsreduzierende Verrundung an Case_Middle: ${e}`);
    }
  }

  // 4. Case_Top (regulärer 3-Körper-Modus): Decken-zu-Wand-Kehle, Wand-Innenecken und LED-Halterungsansätze
  if (bodies.top) {
    try {
      let liveTop = getLiveBody(comp, bodies.top, "Case_Top");
      const edgesTop = collectStressReliefEdges(comp, liveTop, 'top', params);
      if (edgesTop.length > 0) {
        console.log(`StressRelief_Top: ${edgesTop.length} nicht-sichtbare Innenkanten gefunden.`);
        applyFilletWithFallbacks(comp, edgesTop, filletRadiusCm, filletParamName, "StressRelief_Top");
      } else {
        console.log("StressRelief_Top: Keine passenden Innenkanten identifiziert.");
      }

      // Case_Top (p011-Ergänzung): 0.5 mm Verrundung der Lüftungsschlitz- und LED-Halterungskanten
      liveTop = getLiveBody(comp, bodies.top, "Case_Top");
      const innerEdgesTop = collectCaseTopInnerEdges(comp, liveTop, params);
      if (innerEdgesTop.length > 0) {
        console.log(`StressRelief_Top_InnerFeatures: ${innerEdgesTop.length} Kanten für 0.5mm Verrundung gefunden.`);
        const lidFilletRadiusCm = params.lidInnerFilletRadius.value; // 0.05 cm (0.5 mm)
        const lidFilletParamName = "lid_inner_fillet_radius";
        applyFilletWithFallbacks(comp, innerEdgesTop, lidFilletRadiusCm, lidFilletParamName, "StressRelief_Top_InnerFeatures");
      } else {
        console.log("StressRelief_Top_InnerFeatures: Keine Kanten für 0.5mm Verrundung identifiziert.");
      }
    } catch (e) {
      console.warn(`Spannungsreduzierende Verrundung an Case_Top: ${e}`);
    }
  }

  // Alle Live-Körper mit garantiert korrekten Namen zurückgeben
  const finalTop = bodies.top ? getLiveBody(comp, bodies.top, "Case_Top") : undefined;
  if (finalTop) { try { finalTop.name = "Case_Top"; } catch (_e) { } }

  const finalMiddle = bodies.middle ? getLiveBody(comp, bodies.middle, "Case_Middle") : undefined;
  if (finalMiddle) { try { finalMiddle.name = "Case_Middle"; } catch (_e) { } }

  const finalBottom = getLiveBody(comp, bodies.bottom, "Case_Bottom");
  try { finalBottom.name = "Case_Bottom"; } catch (_e) { }

  return {
    top: finalTop,
    middle: finalMiddle,
    bottom: finalBottom
  };
}
