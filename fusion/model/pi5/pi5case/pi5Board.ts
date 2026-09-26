import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";

declare const __dirname: string | undefined;

/**
 * Ermittelt den gültigen Dateipfad zur Raspberry Pi 5 STEP-Datei.
 * Prüft relative Pfade (bezogen auf __dirname bzw. das Skript-Arbeitsverzeichnis)
 * sowie den absoluten Pfad im Workspace.
 */
function resolveStepPathCandidates(): string[] {
  const candidates: string[] = [];

  // 1. Pfad über __dirname (sofern in Node-/Transpiler-Umgebung verfügbar)
  try {
    if (typeof __dirname !== "undefined" && __dirname) {
      candidates.push(`${__dirname}/RASPBERRY_PI_5_1.STEP`);
      candidates.push(`${__dirname}/pi5case/RASPBERRY_PI_5_1.STEP`);
    }
  } catch (_e) {}

  // 2. Absoluter Standard-Pfad im aktuellen Workspace
  candidates.push(
    "/Users/marckronberg/WebstormProjects/pi-case/fusion/model/pi5/pi5case/RASPBERRY_PI_5_1.STEP"
  );

  // 3. Relativer Pfad im Fusion-Skript-Arbeitsverzeichnis
  candidates.push("RASPBERRY_PI_5_1.STEP");
  candidates.push("./RASPBERRY_PI_5_1.STEP");

  return candidates;
}

/**
 * Bereinigt zuvor importierte Pi5-Körper oder Occurrences bei Skript-Neuausführung.
 */
function cleanupPreviousPi5Entities(rootComp: adsk.fusion.Component): void {
  // Occurrences bereinigen
  for (let i = rootComp.occurrences.count - 1; i >= 0; i--) {
    const occ = rootComp.occurrences.item(i);
    if (
      occ &&
      occ.isValid &&
      (occ.name.toLowerCase().includes("raspberry_pi_5") ||
        occ.name.toLowerCase().includes("pi5"))
    ) {
      try {
        occ.deleteMe();
      } catch (_e) {}
    }
  }

  // BRep-Körper bereinigen (Präfix Pi5_ oder RASPBERRY_PI_5)
  for (let i = rootComp.bRepBodies.count - 1; i >= 0; i--) {
    const b = rootComp.bRepBodies.item(i);
    if (
      b &&
      b.isValid &&
      (b.name.startsWith("Pi5_") ||
        b.name.startsWith("RASPBERRY_PI_5") ||
        b.name.toLowerCase().includes("pi5"))
    ) {
      try {
        b.deleteMe();
      } catch (_e) {}
    }
  }
}

/**
 * Importiert das offizielle Raspberry Pi 5 STEP-Modell (RASPBERRY_PI_5_1.STEP)
 * und richtet es präzise auf den 4 Befestigungssäulen (Standoffs) im Gehäuseboden aus (p010).
 *
 * Ausrichtungsstrategie (2-stufige Transformation):
 * 1. Drehung um +90° um die X-Achse:
 *    - Der Fusion-STEP-Konverter kippt SolidWorks-STEP-Dateien beim Import standardmäßig
 *      um -90° (da in SolidWorks Y die Hochachse ist).
 *    - Eine Drehung um +90° (+Math.PI / 2.0) um die X-Achse bringt die Platine aus der
 *      senkrechten XZ-Lage flach in die horizontale XY-Ebene:
 *      - Platinenunterseite zeigt nach unten (-Z).
 *      - Bauteile, Kühler und GPIO-Pins zeigen nach oben (+Z).
 *      - USB-C & Micro-HDMI fluchten an der Frontseite (-Y).
 *      - Ethernet & Dual-USB fluchten an der rechten Seitenwand (+X).
 * 2. Translation auf die Standoffs:
 *    - deltaZ = zStandoffTopCm + pi5_z_offset (-1.9 mm bei 1.5 mm Standoffs und 6.4 mm Gehäuseboden)
 *    - deltaX = pi5_x_offset, deltaY = pi5_y_offset
 *    - Setzt die Platinenunterseite plan auf die 4 Standoffs auf.
 */
export function importAndAlignPi5Board(
  rootComp: adsk.fusion.Component,
  params: Params
): adsk.fusion.Occurrence | adsk.fusion.BRepBody[] | null {
  const isEnabled = Math.round(params.importPi5Board.value) === 1;
  if (!isEnabled) {
    console.log("Raspberry Pi 5 Board-Import ist deaktiviert (import_pi5_board = 0).");
    cleanupPreviousPi5Entities(rootComp);
    return null;
  }

  // Schutz vor Ausführung in einem Bauteilkonstruktionsdokument (PartDesignIntentType)
  try {
    const design = rootComp.parentDesign;
    if (design && design.designIntent === adsk.fusion.DesignIntentTypes.PartDesignIntentType) {
      console.warn(
        "Raspberry Pi 5 Board-Import übersprungen: Bauteilkonstruktionsdokumente dürfen nur eine Komponente enthalten."
      );
      cleanupPreviousPi5Entities(rootComp);
      return null;
    }
  } catch (_e) {}

  const app = adsk.core.Application.get();
  if (!app) {
    console.warn("Application-Objekt nicht verfügbar.");
    return null;
  }

  const importManager = app.importManager;
  if (!importManager) {
    console.warn("ImportManager nicht verfügbar.");
    return null;
  }

  // 1. Vorherige Instanzen bereinigen
  cleanupPreviousPi5Entities(rootComp);

  // 2. Gültige STEP-Importoptionen über Pfadkandidaten ermitteln
  const candidates = resolveStepPathCandidates();
  let stepOptions: adsk.core.STEPImportOptions | null = null;
  let chosenPath = "";

  for (const candidate of candidates) {
    try {
      const opts = importManager.createSTEPImportOptions(candidate);
      if (opts) {
        stepOptions = opts;
        chosenPath = candidate;
        break;
      }
    } catch (_e) {}
  }

  if (!stepOptions) {
    console.error(
      `STEP-Import fehlgeschlagen: Keine gültige STEP-Datei gefunden unter Kandidaten: ${candidates.join(", ")}`
    );
    return null;
  }
  stepOptions.isViewFit = false;

  console.log(`Importiere Raspberry Pi 5 STEP-Modell von: '${chosenPath}'...`);

  // 3. Vorhandene Körper und Occurrences vor dem Import erfassen
  const bodiesBefore = new Set<adsk.fusion.BRepBody>();
  for (let i = 0; i < rootComp.bRepBodies.count; i++) {
    const b = rootComp.bRepBodies.item(i);
    if (b) bodiesBefore.add(b);
  }
  const occsBefore = new Set<adsk.fusion.Occurrence>();
  for (let i = 0; i < rootComp.occurrences.count; i++) {
    const o = rootComp.occurrences.item(i);
    if (o) occsBefore.add(o);
  }

  // 4. STEP direkt in rootComponent importieren
  let importSuccess = false;
  try {
    importSuccess = importManager.importToTarget(stepOptions, rootComp);
  } catch (eImport) {
    console.error("importToTarget fehlgeschlagen:", eImport);
  }

  if (!importSuccess) {
    console.warn("STEP-Import fehlgeschlagen.");
    return null;
  }

  // 5. Neu erstellte Occurrences und BRep-Körper erfassen
  const newOccs: adsk.fusion.Occurrence[] = [];
  for (let i = 0; i < rootComp.occurrences.count; i++) {
    const o = rootComp.occurrences.item(i);
    if (o && !occsBefore.has(o)) {
      try {
        o.isGrounded = false;
      } catch (_e) {}
      newOccs.push(o);
    }
  }
  const newBodies: adsk.fusion.BRepBody[] = [];
  for (let i = 0; i < rootComp.bRepBodies.count; i++) {
    const b = rootComp.bRepBodies.item(i);
    if (b && !bodiesBefore.has(b)) {
      newBodies.push(b);
    }
  }

  console.log(
    `Import abgeschlossen: ${newBodies.length} Körper, ${newOccs.length} Occurrences neu erstellt.`
  );

  // Namen der importierten Körper anpassen (Präfix Pi5_)
  for (const b of newBodies) {
    try {
      if (!b.name.startsWith("Pi5_")) {
        b.name = `Pi5_${b.name}`;
      }
    } catch (_e) {}
  }

  const moveColl = adsk.core.ObjectCollection.create();
  for (const o of newOccs) moveColl.add(o);
  for (const b of newBodies) moveColl.add(b);

  if (moveColl.count === 0) {
    console.warn("Keine importierten Pi5-Objekte zum Ausrichten gefunden.");
    return null;
  }

  const moveFeatures = rootComp.features.moveFeatures;

  // 6. SCHRITT 1: 90° Drehung um die X-Achse (+90° / +Math.PI / 2)
  // Bringt das Board von der senkrechten XZ-Ebene in die waagerechte XY-Ebene
  console.log("Richte Raspberry Pi 5 aus: Wende +90° Drehung um X-Achse an...");
  const rotTransform = adsk.core.Matrix3D.create();
  rotTransform.setToRotation(
    Math.PI / 2.0,
    adsk.core.Vector3D.create(1, 0, 0),
    adsk.core.Point3D.create(0, 0, 0)
  );

  let rotSuccess = false;
  try {
    const rotInput = moveFeatures.createInput2(moveColl);
    if (rotInput) {
      rotInput.defineAsFreeMove(rotTransform);
      const rotFeat = moveFeatures.add(rotInput);
      if (rotFeat) rotSuccess = true;
    }
  } catch (eRot) {
    console.warn("MoveFeature für 90°-Drehung fehlgeschlagen:", eRot);
  }

  // Fallback: Falls MoveFeature auf Occurrence nicht gegriffen hat, transform2 direkt anwenden
  if (!rotSuccess && newOccs.length > 0) {
    for (const occ of newOccs) {
      try {
        const currTrans = occ.transform2 ? occ.transform2.copy() : adsk.core.Matrix3D.create();
        currTrans.transformBy(rotTransform);
        occ.transform2 = currTrans;
      } catch (_eOccRot) {}
    }
  }

  // 7. SCHRITT 2: Translation auf die 4 Standoffs (Z = -0.9 mm + pi5_z_offset)
  const zFloorCm = -params.caseBottomHeight.value + params.shellThickness.value;
  const zStandoffTopCm = zFloorCm + params.standoffHeight.value;
  const deltaZ = zStandoffTopCm + params.pi5ZOffset.value;
  const deltaX = params.pi5XOffset.value;
  const deltaY = params.pi5YOffset.value;

  console.log(
    `Verschiebe Raspberry Pi 5 auf Standoffs: dx=${(deltaX * 10).toFixed(2)}mm, dy=${(deltaY * 10).toFixed(2)}mm, dz=${(deltaZ * 10).toFixed(2)}mm...`
  );

  const transTransform = adsk.core.Matrix3D.create();
  transTransform.translation = adsk.core.Vector3D.create(deltaX, deltaY, deltaZ);

  let transSuccess = false;
  try {
    const transInput = moveFeatures.createInput2(moveColl);
    if (transInput) {
      transInput.defineAsFreeMove(transTransform);
      const transFeat = moveFeatures.add(transInput);
      if (transFeat) transSuccess = true;
    }
  } catch (eTrans) {
    console.warn("MoveFeature für Translation fehlgeschlagen:", eTrans);
  }

  // Fallback für Translation via transform2
  if (!transSuccess && newOccs.length > 0) {
    for (const occ of newOccs) {
      try {
        const currTrans = occ.transform2 ? occ.transform2.copy() : adsk.core.Matrix3D.create();
        currTrans.transformBy(transTransform);
        occ.transform2 = currTrans;
      } catch (_eOccTrans) {}
    }
  }

  console.log("Raspberry Pi 5 Ausrichtung erfolgreich abgeschlossen.");
  return newOccs.length > 0 ? newOccs[0] : newBodies;
}
