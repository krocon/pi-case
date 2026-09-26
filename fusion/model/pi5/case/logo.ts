import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import { TOL, createCollection, getLiveBody, applyColorToEntity, createOffsetPlane } from "./utils";

export interface LogoResult {
  middleBody: adsk.fusion.BRepBody;
  bottomBody?: adsk.fusion.BRepBody;
  logoBody?: adsk.fusion.BRepBody;
}

/**
 * Rohkoordinaten des 17-Punkte-Umrisses des Logos aus 'logo.svg' (im SVG-Vektorraum).
 * Die Form entspricht der exakten isometrischen "G"-Geometrie aus doc/prompt/p012/img_1.png.
 */
const SVG_OUTLINE: [number, number][] = [
  [69.92, 0.52],   // 0: Oberer Zenit (Apex)
  [0.74, 38.70],   // 1: Äußere linke Dachkante
  [0.74, 117.37],  // 2: Äußere linke vertikale Ecke unten
  [68.74, 156.63], // 3: Unterer Zenit (Boden-Apex)
  [136.14, 117.03],// 4: Äußere rechte Bodenecke
  [137.45, 77.70], // 5: Äußere rechte Zungen-Oberkante
  [102.74, 58.48], // 6: Obere Schrägkante der Zunge
  [86.43, 67.91],  // 7: Zungenspitze oben
  [86.34, 88.91],  // 8: Zungenspitze unten
  [102.17, 97.75], // 9: Untere Schrägkante der Zunge
  [68.74, 117.37], // 10: Bodenrinne Mitte
  [34.52, 97.74],  // 11: Bodenrinne links
  [34.58, 58.65],  // 12: Innere linke Vertikalkante oben
  [69.18, 38.68],  // 13: Innere Dachfirst-Ecke
  [85.74, 48.65],  // 14: Innere Haken-Verbindungsecke
  [102.74, 39.65], // 15: Hakenspitze unten
  [103.42, 19.64]  // 16: Hakenspitze oben
];

/** Bounding-Box-Zentrum und Höhe des SVG-Originals (in SVG-Einheiten) */
const SVG_CX = (0.74 + 137.45) / 2.0; // 69.095
const SVG_CY = (0.52 + 156.63) / 2.0; // 78.575
const SVG_HEIGHT = 156.63 - 0.52;      // 156.11

/**
 * Berechnet die orientierten (Y, Z)-Koordinaten im Fusion-Modellraum (in cm)
 * für einen Punkt aus dem SVG-Vektorraum.
 *
 * Ausrichtung an der linken Seitenwand (X = -case_width / 2):
 * - Blick von außen auf die Wand (in +X-Richtung):
 *   - +Z ist oben (SVG min_y -> maximales Z)
 *   - +Y ist hinten/links (SVG min_x -> maximales Y)
 *   - -Y ist vorne/rechts (SVG max_x -> minimales Y, G-Öffnung zeigt nach vorne zu den Front-Ports)
 */
function svgToCadPoint(
  sx: number,
  sy: number,
  posYCm: number,
  posZCm: number,
  sizeCm: number
): [number, number] {
  const scale = sizeCm / SVG_HEIGHT;
  const yCad = posYCm - (sx - SVG_CX) * scale;
  const zCad = posZCm - (sy - SVG_CY) * scale;
  return [yCad, zCad];
}

/**
 * Berechnet die vorzeichenbehaftete 2D-Fläche eines Polygons (Shoelace-Formel).
 * Positiv = gegen den Uhrzeigersinn (CCW), Negativ = im Uhrzeigersinn (CW).
 */
function computeSignedArea(pts: [number, number][]): number {
  const n = pts.length;
  let a = 0.0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return a / 2.0;
}

/**
 * Erzeugt einen mathematisch exakten, gleichmäßigen 2D-Außenversatz (Offset)
 * eines einfachen Polygons um clearanceCm nach außen.
 * Garantiert saubere Kantenverlängerungen ohne Kantenkollaps.
 */
function offsetPolygon(
  pts: [number, number][],
  clearanceCm: number
): [number, number][] {
  const n = pts.length;
  const isCcw = computeSignedArea(pts) > 0;

  const normals: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const dy = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const len = Math.hypot(dy, dz) || 1.0;
    const uy = dy / len;
    const uz = dz / len;
    if (isCcw) {
      normals.push([uz, -uy]);
    } else {
      normals.push([-uz, uy]);
    }
  }

  const offsetPts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const n1 = normals[prev];
    const n2 = normals[i];

    // Geradengleichungen der beiden um clearanceCm nach außen verschobenen Kanten
    const c1 = (pts[i][0] + clearanceCm * n1[0]) * n1[0] + (pts[i][1] + clearanceCm * n1[1]) * n1[1];
    const c2 = (pts[i][0] + clearanceCm * n2[0]) * n2[0] + (pts[i][1] + clearanceCm * n2[1]) * n2[1];

    const det = n1[0] * n2[1] - n1[1] * n2[0];
    if (Math.abs(det) < 1e-6) {
      offsetPts.push([pts[i][0] + clearanceCm * n1[0], pts[i][1] + clearanceCm * n1[1]]);
    } else {
      const y = (c1 * n2[1] - c2 * n1[1]) / det;
      const z = (n1[0] * c2 - n2[0] * c1) / det;
      offsetPts.push([y, z]);
    }
  }

  return offsetPts;
}

/**
 * Zeichnet ein geschlossenes 2D-Polygon auf einer Skizze an der Wand X = xWallCm.
 * Transformiert Weltkoordinaten sauber via sketch.modelToSketchSpace (AGENTS.md §4.4).
 */
function drawPolygonOnWall(
  sketch: adsk.fusion.Sketch,
  xWallCm: number,
  polygonPts: [number, number][]
): void {
  const lines = sketch.sketchCurves.sketchLines;
  const n = polygonPts.length;
  const sketchPts: adsk.fusion.SketchPoint[] = [];

  for (let i = 0; i < n; i++) {
    const p3D = adsk.core.Point3D.create(xWallCm, polygonPts[i][0], polygonPts[i][1]);
    const sp = sketch.modelToSketchSpace(p3D);
    const skPt = sketch.sketchPoints.add(sp);
    sketchPts.push(skPt);
  }

  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    lines.addByTwoPoints(sketchPts[i], sketchPts[nextIdx]);
  }
}


/**
 * 23. Logo & Passvertiefung (Mulde) an der linken Seitenwand (doc/prompt/p012/prompt.md):
 * - Ermittelt die äußere Seitenwand von 'Case_Middle' bei X = -45.7 mm
 * - Schneidet eine Passvertiefung (Mulde) in der Umrissform des Logos mit +0.2 mm Spiel ein
 * - Erzeugt das Logo als eigenständigen BRep-Körper 'Logo' mit 0.5 mm Dicke in der Mulde
 * - Unterteilt die Frontfläche des Logos in die isometrischen Facetten aus logo.svg und
 *   weist passende Graustufen (Hell-, Mittel-, Dunkelgrau) für den plastischen 3D-Look zu
 */
export function createCaseLogo(
  rootComp: adsk.fusion.Component,
  middleBody: adsk.fusion.BRepBody,
  params: Params,
  bottomBody?: adsk.fusion.BRepBody
): LogoResult {
  const middleName = (middleBody && middleBody.name === "Case_Main") ? "Case_Main" : "Case_Middle";
  let liveMiddle = getLiveBody(rootComp, middleBody, middleName);
  let liveBottom = bottomBody ? getLiveBody(rootComp, bottomBody, "Case_Bottom") : undefined;

  // 0. Schalter prüfen: Falls create_logo = 0, Erstellung überspringen
  if (Math.round(params.createLogo.value) === 0) {
    console.log("createCaseLogo: Logo-Erstellung ist deaktiviert (create_logo = 0).");
    return {
      middleBody: liveMiddle,
      bottomBody: liveBottom
    };
  }

  const extrudes = rootComp.features.extrudeFeatures;
  const sketches = rootComp.sketches;

  const leftOuterXCm =
    - (params.boardWidth.value + 2.0 * params.boardClearance.value) / 2.0 -
    params.shellThickness.value; // -4.57 cm (-45.7 mm)
  const targetXCm = leftOuterXCm; // -4.57 cm (linke Seitenwand)

  const posYCm = params.logoPosY.value; // 0.0 cm (0 mm)
  const posZCm = params.logoPosZ.value; // 1.47 cm (14.7 mm)
  const sizeCm = params.logoSize.value; // 0.8 cm (8 mm)
  const thicknessCm = params.logoThickness.value; // 0.05 cm (0.5 mm)
  const recessDepthCm = params.logoRecessDepth.value; // 0.05 cm (0.5 mm)
  const clearanceCm = params.logoRecessClearance.value; // 0.02 cm (0.2 mm)

  // 1. Äußere, planare Seitenwand an Case_Middle bei X = -45.7 mm ermitteln
  let sideFace: adsk.fusion.BRepFace | null = null;
  let maxArea = 0;
  for (let i = 0; i < liveMiddle.faces.count; i++) {
    const face = liveMiddle.faces.item(i);
    if (!face || !face.isValid) continue;
    if (face.geometry.surfaceType !== adsk.core.SurfaceTypes.PlaneSurfaceType) continue;
    const plane = face.geometry as adsk.core.Plane;
    if (plane.normal.x < -0.9 && Math.abs(face.centroid.x - targetXCm) < TOL) {
      if (face.area > maxArea) {
        maxArea = face.area;
        sideFace = face;
      }
    }
  }

  if (!sideFace) {
    throw new Error(
      `createCaseLogo: Äußere Planarfläche an Case_Middle bei X = ${targetXCm * 10} mm nicht gefunden.`
    );
  }

  const xWallCm = sideFace.centroid.x;

  // 2. Nominale CAD-Punkte des Logos berechnen
  const nominalCadPts: [number, number][] = SVG_OUTLINE.map(([sx, sy]) =>
    svgToCadPoint(sx, sy, posYCm, posZCm, sizeCm)
  );

  // 3. Vergrößerte CAD-Punkte für die Mulde (+0.2 mm Spiel) berechnen
  const recessCadPts = offsetPolygon(nominalCadPts, clearanceCm);

  // 4. Robuste Konstruktionsebene an der Seitenwand (X = xWallCm) erzeugen.
  // Dadurch werden keine BRep-Kanten der Wandflächen (z. B. Trennebene Z = 0)
  // in die Skizze projiziert, die das Logo unerwünscht in getrennte Profile aufteilen würden.
  const wallPlane = createOffsetPlane(
    rootComp,
    rootComp.yZConstructionPlane,
    xWallCm,
    "Plane_Logo_Wall"
  );
  if (wallPlane) {
    wallPlane.isLightBulbOn = false;
  }
  const sketchPlane: adsk.core.Base = wallPlane || sideFace;

  // -------------------------------------------------------------------
  // A. Passvertiefung (Mulde) in Case_Middle / Case_Bottom ausschneiden
  // -------------------------------------------------------------------
  console.log(
    `Logo-Mulde: Schneide Vertiefung (${recessDepthCm * 10} mm tief, +${clearanceCm * 10} mm Spiel) in Gehäusewand...`
  );

  const recessSketch = sketches.add(sketchPlane);
  recessSketch.name = "Sketch_Logo_Recess";
  drawPolygonOnWall(recessSketch, xWallCm, recessCadPts);

  // Alle geschlossenen Profile der Skizze erfassen (sicher vor Aufteilungen an Trennebenen)
  const recessProfiles: adsk.fusion.Profile[] = [];
  for (let i = 0; i < recessSketch.profiles.count; i++) {
    const prof = recessSketch.profiles.item(i);
    if (prof && prof.areaProperties().area > 0.001) {
      recessProfiles.push(prof);
    }
  }

  if (recessProfiles.length === 0) {
    throw new Error("createCaseLogo: Kein Profil für die Logo-Mulde in der Skizze gefunden.");
  }

  // Schnittrichtung: Normalenvektor der Skizzenebene prüfen (Schnitt immer in den Körper hinein, d. h. in +X)
  let recessCutDist = recessDepthCm;
  try {
    const pGeo = (sketchPlane as any).geometry as adsk.core.Plane;
    if (pGeo && pGeo.normal) {
      recessCutDist = pGeo.normal.x > 0 ? recessDepthCm : -recessDepthCm;
    }
  } catch (_e) { }

  liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
  if (liveBottom) {
    liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
  }

  // Schnittkörper ermitteln: je nach Z-Erstreckung Case_Middle, Case_Bottom oder beide
  const minRecessZ = Math.min(...recessCadPts.map(p => p[1]));
  const maxRecessZ = Math.max(...recessCadPts.map(p => p[1]));
  const participants: adsk.fusion.BRepBody[] = [];
  if (maxRecessZ > -TOL && liveMiddle && liveMiddle.isValid) {
    participants.push(liveMiddle);
  }
  if (minRecessZ < TOL && liveBottom && liveBottom.isValid) {
    participants.push(liveBottom);
  }
  if (participants.length === 0) {
    participants.push(liveMiddle);
  }

  let cutFeat: adsk.fusion.ExtrudeFeature | null = null;

  // Stufe 1: Schnitt mit berechneter Richtung
  try {
    const cutInput = extrudes.createInput(
      createCollection(recessProfiles),
      adsk.fusion.FeatureOperations.CutFeatureOperation
    );
    cutInput.participantBodies = participants;
    cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(recessCutDist));
    cutFeat = extrudes.add(cutInput);
  } catch (_e1) { }

  // Stufe 2: Falls Koordinatenrichtung invertiert ist
  if (!cutFeat) {
    try {
      const cutInput = extrudes.createInput(
        createCollection(recessProfiles),
        adsk.fusion.FeatureOperations.CutFeatureOperation
      );
      cutInput.participantBodies = participants;
      cutInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(-recessCutDist));
      cutFeat = extrudes.add(cutInput);
    } catch (_e2) {
      throw new Error(`createCaseLogo: Schnitt-Extrusion für Logo-Mulde fehlgeschlagen: ${_e2}`);
    }
  }

  recessSketch.isVisible = false;

  liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
  if (liveBottom) {
    liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
  }

  // -------------------------------------------------------------------
  // B. Logo als neuen Körper 'Logo' erzeugen (0.5 mm Dicke)
  // -------------------------------------------------------------------
  console.log(
    `Logo-Körper: Erstelle neuen BRep-Körper 'Logo' (${thicknessCm * 10} mm Dicke) in der Mulde...`
  );

  // Skizze auf der Konstruktionsebene (X = xWallCm) für die nominale Kontur
  const logoSketch = sketches.add(sketchPlane);
  logoSketch.name = "Sketch_Logo_Body";
  drawPolygonOnWall(logoSketch, xWallCm, nominalCadPts);

  const logoProfiles: adsk.fusion.Profile[] = [];
  for (let i = 0; i < logoSketch.profiles.count; i++) {
    const prof = logoSketch.profiles.item(i);
    if (prof && prof.areaProperties().area > 0.001) {
      logoProfiles.push(prof);
    }
  }

  if (logoProfiles.length === 0) {
    throw new Error("createCaseLogo: Kein Profil für den Logo-Körper in der Skizze gefunden.");
  }

  let logoExtrudeDist = thicknessCm;
  try {
    const pGeo = (sketchPlane as any).geometry as adsk.core.Plane;
    if (pGeo && pGeo.normal) {
      logoExtrudeDist = pGeo.normal.x > 0 ? thicknessCm : -thicknessCm;
    }
  } catch (_e) { }

  let logoFeat: adsk.fusion.ExtrudeFeature | null = null;

  // Stufe 1: Extrusion in die Mulde hinein
  try {
    const logoInput = extrudes.createInput(
      createCollection(logoProfiles),
      adsk.fusion.FeatureOperations.NewBodyFeatureOperation
    );
    logoInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(logoExtrudeDist));
    logoFeat = extrudes.add(logoInput);
  } catch (_e1) { }

  // Stufe 2: Fallback mit entgegengesetztem Vorzeichen
  if (!logoFeat) {
    try {
      const logoInput = extrudes.createInput(
        createCollection(logoProfiles),
        adsk.fusion.FeatureOperations.NewBodyFeatureOperation
      );
      logoInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(-logoExtrudeDist));
      logoFeat = extrudes.add(logoInput);
    } catch (_e2) {
      throw new Error(`createCaseLogo: Extrusion des Logo-Körpers fehlgeschlagen: ${_e2}`);
    }
  }

  if (!logoFeat || logoFeat.bodies.count === 0) {
    throw new Error("createCaseLogo: Erzeugung des Logo-Körpers hat keinen Körper geliefert.");
  }

  logoSketch.isVisible = false;

  let logoBody = logoFeat.bodies.item(0);
  logoBody.name = "Logo";

  // -------------------------------------------------------------------
  // C. Isometrische Facetten & Graustufen-Farbgebung (gemäß img_1.png)
  // -------------------------------------------------------------------
  try {
    applyLogoFacetsAndColors(rootComp, logoBody, posYCm, posZCm, sizeCm, xWallCm);
  } catch (facetErr) {
    console.warn(`Visuelle Facettierung des Logos übersprungen: ${facetErr}`);
  }

  logoBody = getLiveBody(rootComp, logoBody, "Logo");
  liveMiddle = getLiveBody(rootComp, liveMiddle, middleName);
  liveMiddle.name = middleName;
  if (liveBottom) {
    liveBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
  }

  return {
    middleBody: liveMiddle,
    bottomBody: liveBottom,
    logoBody
  };
}

/**
 * Unterteilt die sichtbare Frontfläche des Logos in die isometrischen Facetten
 * aus 'logo.svg' und weist die drei Schattierungsfarben zu:
 * - Hellgrau / Weiß: Obere Flächen (Dachflächen, Zungen-Oberseite, Trittfläche)
 * - Mittelgrau: Nach rechts/vorn gewandte Flächen
 * - Dunkelgrau: Nach links/hinten gewandte Schattenflächen
 */
function applyLogoFacetsAndColors(
  comp: adsk.fusion.Component,
  logoBody: adsk.fusion.BRepBody,
  posYCm: number,
  posZCm: number,
  sizeCm: number,
  xWallCm: number
): void {
  // 1. Äußere Planarfläche des Logo-Körpers finden (bei X ≈ xWallCm)
  let logoFrontFace: adsk.fusion.BRepFace | null = null;
  let minX = 999;

  for (let i = 0; i < logoBody.faces.count; i++) {
    const f = logoBody.faces.item(i);
    if (!f || !f.isValid) continue;
    if (f.geometry.surfaceType !== adsk.core.SurfaceTypes.PlaneSurfaceType) continue;
    const plane = f.geometry as adsk.core.Plane;
    if (plane.normal.x < -0.8 && f.centroid.x < minX) {
      minX = f.centroid.x;
      logoFrontFace = f;
    }
  }

  if (!logoFrontFace) return;

  // 2. Interne Facetten-Trennlinien aus logo.svg zeichnen
  const INTERNAL_EDGES: [[number, number], [number, number]][] = [
    [[102.74, 58.48], [86.43, 67.91]],
    [[137.45, 77.70], [102.74, 58.48]],
    [[68.74, 117.37], [102.17, 97.75]],
    [[34.52, 97.74], [68.74, 117.37]],
    [[85.89, 29.11], [85.74, 48.65]],
    [[85.74, 48.65], [69.34, 38.49]],
    [[69.34, 38.49], [69.18, 19.13]],
    [[85.90, 29.64], [85.75, 49.28]],
    [[102.74, 39.65], [85.75, 49.28]],
    [[34.58, 58.65], [69.18, 38.68]],
    [[16.89, 48.66], [68.56, 18.81]],
    [[17.55, 48.88], [17.52, 107.55]],
    [[17.52, 107.55], [33.89, 98.10]],
    [[119.74, 87.13], [119.74, 107.56]],
    [[119.74, 107.56], [102.17, 97.75]],
    [[102.17, 97.75], [86.34, 88.91]],
    [[86.34, 88.91], [86.43, 67.91]],
    [[68.74, 156.63], [68.14, 137.34]],
    [[68.14, 137.34], [17.74, 107.55]],
    [[68.74, 136.99], [119.74, 107.55]]
  ];

  const splitSketch = comp.sketches.add(logoFrontFace);
  splitSketch.name = "Sketch_Logo_Facets";
  const lines = splitSketch.sketchCurves.sketchLines;
  const splitCurveColl = adsk.core.ObjectCollection.create();

  for (const [pA, pB] of INTERNAL_EDGES) {
    const cadA = svgToCadPoint(pA[0], pA[1], posYCm, posZCm, sizeCm);
    const cadB = svgToCadPoint(pB[0], pB[1], posYCm, posZCm, sizeCm);

    const ptA3D = adsk.core.Point3D.create(xWallCm, cadA[0], cadA[1]);
    const ptB3D = adsk.core.Point3D.create(xWallCm, cadB[0], cadB[1]);

    const sA = splitSketch.modelToSketchSpace(ptA3D);
    const sB = splitSketch.modelToSketchSpace(ptB3D);

    const line = lines.addByTwoPoints(sA, sB);
    if (line) splitCurveColl.add(line);
  }

  // 3. Flächenteilung via splitFaceFeatures ausführen
  if (splitCurveColl.count > 0) {
    const splitFeatures = comp.features.splitFaceFeatures;
    const splitInput = splitFeatures.createInput(
      createCollection([logoFrontFace]),
      splitCurveColl,
      true
    );
    if (splitInput) {
      splitFeatures.add(splitInput);
    }
  }

  // 4. Farben für die isometrischen Facetten anlegen
  const design = comp.parentDesign;
  const colors = {
    light: { name: "Logo_Light_Shade", r: 242, g: 243, b: 245 },   // Fast Weiß / Helles Lichtgrau
    medium: { name: "Logo_Medium_Shade", r: 155, g: 160, b: 170 }, // Neutrales Mittelgrau
    dark: { name: "Logo_Dark_Shade", r: 55, g: 60, b: 72 }         // Tiefes Dunkelgrau
  };

  // 5. Flächen anhand ihrer geometrischen Schwerpunkte klassifizieren
  const liveLogo = getLiveBody(comp, logoBody, "Logo");
  const scale = sizeCm / SVG_HEIGHT;

  for (let f = 0; f < liveLogo.faces.count; f++) {
    const face = liveLogo.faces.item(f);
    if (!face || !face.isValid) continue;
    if (face.geometry.surfaceType !== adsk.core.SurfaceTypes.PlaneSurfaceType) continue;

    const plane = face.geometry as adsk.core.Plane;
    // Nur nach außen zeigende Frontflächen (Normale in -X)
    if (plane.normal.x < -0.8 && Math.abs(face.centroid.x - xWallCm) < TOL) {
      // Transformation zurück in SVG-Koordinaten zur Klassifikation
      const yCad = face.centroid.y;
      const zCad = face.centroid.z;
      const sx = SVG_CX - (yCad - posYCm) / scale;
      const sy = SVG_CY - (zCad - posZCm) / scale;

      // Klassifikation anhand von Position & Schattierung
      // A: Top Faces (Dachflächen, Zungen-Oberkante, Bodenstufe) -> Hellgrau
      if (
        (sy < 35 && sx > 15 && sx < 110) || // Obere Dachfläche
        (sy > 55 && sy < 85 && sx > 85 && sx < 140) || // Zungen-Oberseite
        (sy > 95 && sy < 138 && sx > 25 && sx < 125) // Bodenstufe
      ) {
        applyColorToEntity(design, face, colors.light.name, colors.light.r, colors.light.g, colors.light.b);
      }
      // B: Dunkelgraue Flächen (Schattenflächen)
      else if (
        (sy > 105 && sx > 68) || // Rechter Außenkeil unten
        (sy < 52 && sx > 84 && sx < 105) || // Hakenseite
        (sy > 45 && sy < 100 && sx > 33 && sx < 70) // Innere Schattenschulter
      ) {
        applyColorToEntity(design, face, colors.dark.name, colors.dark.r, colors.dark.g, colors.dark.b);
      }
      // C: Mittelgraue Flächen
      else {
        applyColorToEntity(design, face, colors.medium.name, colors.medium.r, colors.medium.g, colors.medium.b);
      }
    }
  }
}
