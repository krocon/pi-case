import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import { createOffsetPlane, getLiveBody } from "./utils";

/**
 * Konstruiert die 4 zylindrischen Befestigungssäulen (Standoffs) auf der Gehäuseboden-Innenseite
 * mit modelliertem M2.5-Innengewinde zur Verschraubung des Raspberry Pi 5 Boards (Schritt 18 / p005).
 *
 * Spezifikation:
 * - Ebene auf Gehäuseinnenboden: Z = -case_bottom_height + shell_thickness (-3.4 mm bei 6.4 mm Bodenhöhe)
 * - 4 Säulen an den Pi5-Montagebohrungen:
 *   - Lochabstand X = 58.0 mm, Lochabstand Y = 49.0 mm
 *   - Front-Left:  X = -39.0 mm, Y = -24.5 mm
 *   - Back-Left:   X = -39.0 mm, Y = +24.5 mm
 *   - Front-Right: X = +19.0 mm, Y = -24.5 mm
 *   - Back-Right:  X = +19.0 mm, Y = +24.5 mm
 * - Außendurchmesser: 6.0 mm (standoff_outer_diameter)
 * - Kernlochbohrung für M2.5: 2.05 mm (standoff_hole_diameter, ISO Tap Drill)
 * - Höhe: +1.5 mm nach oben (+Z, standoff_height, p017)
 * - Operation: Join (Verbinden) der Säulenkörper mit Case_Bottom
 * - Bohrungstiefe in den Boden: 2.0 mm (standoff_floor_depth, Gesamttiefe 3.5 mm)
 * - Innengewinde: ISO Metric Profile M2.5x0.45 6H, modelliert (isModeled = true, volle Tiefe 3.5 mm)
 * - FDM-Passungsspiel: OffsetFacesFeatures auf Gewindeflächen (-0.05 mm, standoff_thread_clearance)
 */
export function createPi5Standoffs(
  rootComp: adsk.fusion.Component,
  bottomBody: adsk.fusion.BRepBody,
  params: Params
): adsk.fusion.BRepBody {
  const sketches = rootComp.sketches;
  const extrudes = rootComp.features.extrudeFeatures;

  const liveBottom = getLiveBody(rootComp, bottomBody, "Case_Bottom");

  // 1. Hilfsebene auf dem Gehäuse-Innenboden erzeugen
  // Z_floor = -case_bottom_height + shell_thickness (-0.64 cm + 0.3 cm = -0.34 cm)
  const zFloorCm = -params.caseBottomHeight.value + params.shellThickness.value;
  const floorPlane = createOffsetPlane(
    rootComp,
    rootComp.xYConstructionPlane,
    zFloorCm,
    "-case_bottom_height + shell_thickness"
  );
  if (!floorPlane) {
    throw new Error("Erstellung der Hilfsebene für Pi5-Befestigungssäulen fehlgeschlagen.");
  }
  floorPlane.name = "Plane_Pi5_Standoffs";

  // 2. Skizze auf der Hilfsebene erstellen (Solid-Zylinder der Säulen)
  const sketchPillars = sketches.add(floorPlane);
  sketchPillars.name = "Sketch_Pi5_Standoffs";

  // 3. 4 Montagepunkte berechnen (Modellraum)
  const xOffset = params.pi5XOffset.value; // in cm
  const yOffset = params.pi5YOffset.value; // in cm

  // Raspberry Pi 5 Board: 85 mm x 56 mm zentriert auf (0,0)
  // Linke Bohrungen: X = -4.25 + 0.35 = -3.9 cm (-39 mm)
  // Rechte Bohrungen: X = -3.9 + 5.8 = +1.9 cm (+19 mm)
  // Vordere Bohrungen: Y = -2.8 + 0.35 = -2.45 cm (-24.5 mm)
  // Hintere Bohrungen: Y = +2.8 - 0.35 = +2.45 cm (+24.5 mm)
  const centers3D = [
    adsk.core.Point3D.create(-3.9 + xOffset, -2.45 + yOffset, zFloorCm), // Front-Left
    adsk.core.Point3D.create(-3.9 + xOffset,  2.45 + yOffset, zFloorCm), // Back-Left
    adsk.core.Point3D.create( 1.9 + xOffset, -2.45 + yOffset, zFloorCm), // Front-Right
    adsk.core.Point3D.create( 1.9 + xOffset,  2.45 + yOffset, zFloorCm), // Back-Right
  ];

  const outerRadiusCm = params.standoffOuterDiameter.value / 2.0; // 3 mm = 0.3 cm
  const holeRadiusCm = params.standoffHoleDiameter.value / 2.0;   // 1.025 mm = 0.1025 cm

  const circles = sketchPillars.sketchCurves.sketchCircles;
  for (const c3d of centers3D) {
    const centerSketch = sketchPillars.modelToSketchSpace(c3d);
    circles.addByCenterRadius(centerSketch, outerRadiusCm);
  }

  // 4. Vollzylinder-Profile der Säulen ermitteln
  const pillarProfColl = adsk.core.ObjectCollection.create();
  const expectedPillarArea = Math.PI * (outerRadiusCm * outerRadiusCm);

  for (let i = 0; i < sketchPillars.profiles.count; i++) {
    const prof = sketchPillars.profiles.item(i);
    if (!prof) continue;
    const area = prof.areaProperties().area;
    if (Math.abs(area - expectedPillarArea) < 0.20 * expectedPillarArea) {
      pillarProfColl.add(prof);
    }
  }

  if (pillarProfColl.count === 0) {
    throw new Error("Keine geeigneten Säulenprofile in 'Sketch_Pi5_Standoffs' gefunden.");
  }

  // 5. Extrusion der Säulenkörper nach oben (+Z) mit Join an Case_Bottom
  const extrudePillarsInput = extrudes.createInput(
    pillarProfColl,
    adsk.fusion.FeatureOperations.JoinFeatureOperation
  );

  let heightValInput: adsk.core.ValueInput | null = null;
  try {
    heightValInput = adsk.core.ValueInput.createByString('standoff_height');
  } catch (_e) { }
  if (!heightValInput) {
    heightValInput = adsk.core.ValueInput.createByReal(params.standoffHeight.value);
  }

  extrudePillarsInput.setDistanceExtent(false, heightValInput);
  extrudePillarsInput.participantBodies = [liveBottom];

  const extrudePillarsFeat = extrudes.add(extrudePillarsInput);
  if (!extrudePillarsFeat) {
    throw new Error("Extrusion der Pi5-Befestigungssäulen fehlgeschlagen.");
  }

  let updatedBottom = getLiveBody(rootComp, liveBottom, "Case_Bottom");
  updatedBottom.name = "Case_Bottom";

  // 6. Hilfsebene auf Säulenoberkante erzeugen und Kernlochbohrungen schneiden
  // Z_standoff_top = Z_floor + standoff_height
  const zStandoffTopCm = zFloorCm + params.standoffHeight.value;
  const topPlane = createOffsetPlane(
    rootComp,
    rootComp.xYConstructionPlane,
    zStandoffTopCm,
    "-case_bottom_height + shell_thickness + standoff_height"
  );
  if (!topPlane) {
    throw new Error("Erstellung der Hilfsebene auf Standoff-Oberkante fehlgeschlagen.");
  }
  topPlane.name = "Plane_Pi5_Standoff_Tops";

  const sketchHoles = sketches.add(topPlane);
  sketchHoles.name = "Sketch_Pi5_Standoff_Holes";

  for (const c3d of centers3D) {
    const cTop3D = adsk.core.Point3D.create(c3d.x, c3d.y, zStandoffTopCm);
    const centerSketch = sketchHoles.modelToSketchSpace(cTop3D);
    sketchHoles.sketchCurves.sketchCircles.addByCenterRadius(centerSketch, holeRadiusCm);
  }

  const holeProfColl = adsk.core.ObjectCollection.create();
  const expectedHoleArea = Math.PI * (holeRadiusCm * holeRadiusCm);

  for (let i = 0; i < sketchHoles.profiles.count; i++) {
    const prof = sketchHoles.profiles.item(i);
    if (!prof) continue;
    const area = prof.areaProperties().area;
    if (Math.abs(area - expectedHoleArea) < 0.20 * expectedHoleArea) {
      holeProfColl.add(prof);
    }
  }

  if (holeProfColl.count === 4) {
    // 7. Kernlöcher von der Säulenoberseite nach unten (-Z) schneiden:
    // Gesamttiefe = standoff_height + standoff_floor_depth (z. B. 1.5 mm + 2.0 mm = 3.5 mm)
    const cutInput = extrudes.createInput(
      holeProfColl,
      adsk.fusion.FeatureOperations.CutFeatureOperation
    );

    let cutDistVal: adsk.core.ValueInput | null = null;
    try {
      cutDistVal = adsk.core.ValueInput.createByString("-(standoff_height + standoff_floor_depth)");
    } catch (_e) { }
    if (!cutDistVal) {
      cutDistVal = adsk.core.ValueInput.createByReal(
        -(params.standoffHeight.value + params.standoffFloorDepth.value)
      );
    }

    cutInput.setDistanceExtent(false, cutDistVal);
    cutInput.participantBodies = [updatedBottom];

    const cutFeat = extrudes.add(cutInput);
    if (cutFeat) {
      updatedBottom = getLiveBody(rootComp, updatedBottom, "Case_Bottom");
      updatedBottom.name = "Case_Bottom";
    }
  } else {
    console.warn(
      `Konnte ${holeProfColl.count} von 4 Kernloch-Profilen identifizieren, versuche Bohrungen zu überspringen...`
    );
  }

  // 8. M2.5-Innengewinde für Metallschrauben über die volle Bohrungstiefe modellieren
  try {
    const threadFeatures = rootComp.features.threadFeatures;
    let threadInfo = threadFeatures.createThreadInfo(true, "ISO Metric Profile", "M2.5x0.45", "6H");
    if (!threadInfo) {
      const query = threadFeatures.threadDataQuery;
      if (query) {
        try {
          const [ok, desig, cls] = query.recommendThreadData(
            holeRadiusCm * 2.0,
            true,
            "ISO Metric Profile"
          );
          if (ok && desig) {
            threadInfo = threadFeatures.createThreadInfo(true, "ISO Metric Profile", desig, cls || "6H");
          }
        } catch (_qErr) { }
      }
    }

    if (threadInfo) {
      let threadedCount = 0;

      for (let idx = 0; idx < centers3D.length; idx++) {
        const c3d = centers3D[idx];
        updatedBottom = getLiveBody(rootComp, updatedBottom, "Case_Bottom");

        // Zylindrische Kernlochfläche der jeweiligen Säule dynamisch ermitteln
        let holeFace: adsk.fusion.BRepFace | null = null;
        for (let f = 0; f < updatedBottom.faces.count; f++) {
          const face = updatedBottom.faces.item(f);
          if (!face || !face.isValid) continue;
          if (face.geometry.surfaceType !== adsk.core.SurfaceTypes.CylinderSurfaceType) continue;

          const cyl = face.geometry as adsk.core.Cylinder;
          if (Math.abs(cyl.axis.z) < 0.9) continue;

          const distXY = Math.hypot(cyl.origin.x - c3d.x, cyl.origin.y - c3d.y);
          if (distXY < 0.15) {
            holeFace = face;
            break;
          }
        }

        if (holeFace) {
          let threadFeat: adsk.fusion.ThreadFeature | null = null;

          // Stufe A: Vollständig modelliertes 3D-Gewinde über die volle Tiefe (AGENTS.md §4.9)
          try {
            const threadInput = threadFeatures.createInput(holeFace, threadInfo);
            threadInput.isModeled = true;
            threadInput.isFullLength = true;
            threadFeat = threadFeatures.add(threadInput);
            if (threadFeat) threadedCount++;
          } catch (errModeled) {
            console.warn(
              `Modelliertes M2.5-Gewinde an Säule ${idx + 1} fehlgeschlagen (${errModeled}), versuche kosmetisches Gewinde...`
            );
            // Stufe B: Kosmetisches Gewinde als Fallback
            try {
              updatedBottom = getLiveBody(rootComp, updatedBottom, "Case_Bottom");
              let retryFace: adsk.fusion.BRepFace | null = null;
              for (let f = 0; f < updatedBottom.faces.count; f++) {
                const face = updatedBottom.faces.item(f);
                if (!face || !face.isValid) continue;
                if (face.geometry.surfaceType !== adsk.core.SurfaceTypes.CylinderSurfaceType) continue;
                const cyl = face.geometry as adsk.core.Cylinder;
                if (Math.abs(cyl.axis.z) < 0.9) continue;
                if (Math.hypot(cyl.origin.x - c3d.x, cyl.origin.y - c3d.y) < 0.15) {
                  retryFace = face;
                  break;
                }
              }
              if (retryFace) {
                const cosmeticInput = threadFeatures.createInput(retryFace, threadInfo);
                cosmeticInput.isModeled = false;
                cosmeticInput.isFullLength = true;
                threadFeat = threadFeatures.add(cosmeticInput);
                if (threadFeat) threadedCount++;
              }
            } catch (errCosmetic) {
              console.warn(`Kosmetisches M2.5-Gewinde an Säule ${idx + 1} fehlgeschlagen: ${errCosmetic}`);
            }
          }

          // Stufe C: Passungsspiel für FDM-3D-Druck (OffsetFacesFeatures)
          if (threadFeat && Math.abs(params.standoffThreadClearance.value) > 0.0001) {
            try {
              const facesToOffset: adsk.fusion.BRepFace[] = [];
              for (let j = 0; j < threadFeat.faces.count; j++) {
                const tf = threadFeat.faces.item(j);
                if (tf && tf.isValid) facesToOffset.push(tf);
              }
              if (facesToOffset.length > 0) {
                const offsetFeatures = rootComp.features.offsetFacesFeatures;
                let clearanceVal = adsk.core.ValueInput.createByString("standoff_thread_clearance");
                if (!clearanceVal) {
                  clearanceVal = adsk.core.ValueInput.createByReal(params.standoffThreadClearance.value);
                }
                const offsetInput = offsetFeatures.createInput(facesToOffset, clearanceVal);
                if (offsetInput) {
                  offsetFeatures.add(offsetInput);
                }
              }
            } catch (errClearance) {
              console.warn(
                `FDM-Passungsspiel für M2.5-Gewinde an Säule ${idx + 1} konnte nicht angewendet werden: ${errClearance}`
              );
            }
          }
        }
      }

      const totalThreadDepthMm =
        (params.standoffHeight.value + params.standoffFloorDepth.value) * 10;
      console.log(
        `M2.5-Innengewinde (ISO Metric Profile M2.5x0.45 6H, Gesamttiefe ${totalThreadDepthMm.toFixed(1)}mm [inkl. ${(params.standoffFloorDepth.value * 10).toFixed(1)}mm im Boden]) an ${threadedCount} von 4 Säulen erfolgreich erzeugt.`
      );
    }
  } catch (errThreadOverall) {
    console.warn(`Erstellung der M2.5-Innengewinde in den Befestigungssäulen fehlgeschlagen: ${errThreadOverall}`);
  }

  const finalBottom = getLiveBody(rootComp, updatedBottom, "Case_Bottom");
  finalBottom.name = "Case_Bottom";

  console.log(
    `Pi5-Befestigungssäulen (4 Stück, H = ${(params.standoffHeight.value * 10).toFixed(1)} mm, Gewindetiefe ${((params.standoffHeight.value + params.standoffFloorDepth.value) * 10).toFixed(1)} mm) erfolgreich mit Case_Bottom verbunden.`
  );
  return finalBottom;
}
