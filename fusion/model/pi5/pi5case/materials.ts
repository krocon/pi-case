import { adsk } from "@adsk/fusion";
import { Params } from "./parameters";
import { getLiveBody } from "./utils";

// =====================================================================
// MATERIAL & ERSCHEINUNGSBILD MANAGEMENT (AGENTS.md KONFORM)
// =====================================================================

interface PbrAppearanceFallback {
  surfaceType: adsk.core.AppearanceSurfaceTypes;
  color: { r: number; g: number; b: number };
  roughness: number;
}

/**
 * Durchsucht alle verfügbaren Fusion 360 Material-Bibliotheken nach einem physikalischen Material.
 */
function findMaterialInLibraries(
  app: adsk.core.Application,
  candidateNames: string[]
): adsk.core.Material | null {
  try {
    const matLibs = app.materialLibraries;
    if (!matLibs || matLibs.count === 0) return null;

    // 1. Exakter Namensabgleich über alle Bibliotheken
    for (let i = 0; i < matLibs.count; i++) {
      const lib = matLibs.item(i);
      if (!lib) continue;
      for (const name of candidateNames) {
        try {
          const mat = lib.materials.itemByName(name);
          if (mat) return mat;
        } catch (_e) {}
      }
    }

    // 2. Fallback: Case-insensitiver Teilstring-Abgleich
    for (let i = 0; i < matLibs.count; i++) {
      const lib = matLibs.item(i);
      if (!lib) continue;
      const count = lib.materials.count;
      for (let j = 0; j < count; j++) {
        const mat = lib.materials.item(j);
        if (!mat) continue;
        const matNameLower = mat.name.toLowerCase();
        for (const candidate of candidateNames) {
          const candLower = candidate.toLowerCase();
          if (matNameLower === candLower || matNameLower.includes(candLower)) {
            return mat;
          }
        }
      }
    }
  } catch (_e) {}

  return null;
}

/**
 * Durchsucht alle verfügbaren Fusion 360 Bibliotheken nach einem Erscheinungsbild (Appearance).
 */
function findAppearanceInLibraries(
  app: adsk.core.Application,
  candidateNames: string[]
): adsk.core.Appearance | null {
  try {
    const matLibs = app.materialLibraries;
    if (!matLibs || matLibs.count === 0) return null;

    // 1. Exakter Namensabgleich über alle Bibliotheken
    for (let i = 0; i < matLibs.count; i++) {
      const lib = matLibs.item(i);
      if (!lib) continue;
      for (const name of candidateNames) {
        try {
          const apper = lib.appearances.itemByName(name);
          if (apper) return apper;
        } catch (_e) {}
      }
    }

    // 2. Fallback: Case-insensitiver Teilstring-Abgleich
    for (let i = 0; i < matLibs.count; i++) {
      const lib = matLibs.item(i);
      if (!lib) continue;
      const count = lib.appearances.count;
      for (let j = 0; j < count; j++) {
        const apper = lib.appearances.item(j);
        if (!apper) continue;
        const apperNameLower = apper.name.toLowerCase();
        for (const candidate of candidateNames) {
          const candLower = candidate.toLowerCase();
          if (apperNameLower === candLower || apperNameLower.includes(candLower)) {
            return apper;
          }
        }
      }
    }
  } catch (_e) {}

  return null;
}

/**
 * Ermittelt oder kopiert ein physikalisches Material in das aktive Design-Dokument.
 */
function getOrCopyMaterial(
  design: adsk.fusion.Design,
  app: adsk.core.Application,
  targetName: string,
  candidateNames: string[]
): adsk.core.Material | null {
  // 1. Bereits im aktiven Dokument vorhanden?
  try {
    let docMat = design.materials.itemByName(targetName);
    if (docMat) return docMat;
    for (const name of candidateNames) {
      docMat = design.materials.itemByName(name);
      if (docMat) return docMat;
    }
  } catch (_e) {}

  // 2. In Bibliotheken suchen und in das Design kopieren
  const libMat = findMaterialInLibraries(app, candidateNames);
  if (libMat) {
    try {
      const copied = design.materials.addByCopy(libMat, targetName);
      if (copied) return copied;
    } catch (_e) {
      return libMat;
    }
  }

  return null;
}

/**
 * Ermittelt, kopiert oder erzeugt ein PBR-Erscheinungsbild im aktiven Design-Dokument.
 */
function getOrCopyAppearance(
  design: adsk.fusion.Design,
  app: adsk.core.Application,
  targetName: string,
  candidateNames: string[],
  fallback: PbrAppearanceFallback
): adsk.core.Appearance | null {
  // 1. Bereits im aktiven Dokument vorhanden?
  try {
    let docApp = design.appearances.itemByName(targetName);
    if (docApp) return docApp;
    for (const name of candidateNames) {
      docApp = design.appearances.itemByName(name);
      if (docApp) return docApp;
    }
  } catch (_e) {}

  // 2. In Bibliotheken suchen und ins Design kopieren
  const libApp = findAppearanceInLibraries(app, candidateNames);
  if (libApp) {
    try {
      const copied = design.appearances.addByCopy(libApp, targetName);
      if (copied) return copied;
    } catch (_e) {
      return libApp;
    }
  }

  // 3. Fallback: Neues PBR-Erscheinungsbild im Dokument erzeugen
  let newApp: adsk.core.Appearance | null = null;
  try {
    newApp = design.appearances.add(targetName, fallback.surfaceType);
  } catch (_e) {
    // Fallback falls add() fehlschlägt: Kopie des ersten vorhandenen Erscheinungsbilds
    try {
      if (design.appearances.count > 0) {
        const first = design.appearances.item(0);
        if (first) {
          newApp = design.appearances.addByCopy(first, targetName);
        }
      }
    } catch (_e2) {}
  }

  // PBR-Eigenschaften konfigurieren (Farbe, Rauheit)
  if (newApp) {
    try {
      newApp.color = adsk.core.Color.create(
        fallback.color.r,
        fallback.color.g,
        fallback.color.b,
        255
      );
    } catch (_e) {
      try {
        const colorProp = newApp.appearanceProperties.itemByName("Color");
        if (colorProp && "value" in colorProp) {
          (colorProp as any).value = adsk.core.Color.create(
            fallback.color.r,
            fallback.color.g,
            fallback.color.b,
            255
          );
        }
      } catch (_e2) {}
    }

    try {
      newApp.roughness = fallback.roughness;
    } catch (_e) {
      try {
        const roughProp = newApp.appearanceProperties.itemByName("surface_roughness");
        if (roughProp && "value" in roughProp) {
          (roughProp as any).value = fallback.roughness;
        }
      } catch (_e2) {}
    }
  }

  return newApp;
}

/**
 * Weist einem BRepBody Material und Erscheinungsbild zu.
 * Bereinigt optional Einzelflächen-Erscheinungsbilder (Face Overrides), um einen homogenen Look zu gewährleisten.
 */
function applyMaterialAndAppearanceToBody(
  body: adsk.fusion.BRepBody,
  material: adsk.core.Material | null,
  appearance: adsk.core.Appearance | null,
  clearFaceOverrides: boolean = true
): void {
  if (!body || !body.isValid) return;

  // 1. Optionale Bereinigung von Einzelflächen-Erscheinungsbildern
  if (clearFaceOverrides) {
    try {
      for (let f = 0; f < body.faces.count; f++) {
        const face = body.faces.item(f);
        if (
          face &&
          face.isValid &&
          face.appearanceSourceType === adsk.core.AppearanceSourceTypes.OverrideAppearanceSource
        ) {
          try {
            face.appearance = null;
          } catch (_e) {
            if (appearance) {
              try {
                face.appearance = appearance;
              } catch (_e2) {}
            }
          }
        }
      }
    } catch (_e) {}
  }

  // 2. Physikalisches Material zuweisen
  if (material) {
    try {
      body.material = material;
    } catch (e) {
      console.warn(`Material '${material.name}' konnte '${body.name}' nicht zugewiesen werden: ${e}`);
    }
  }

  // 3. Erscheinungsbild zuweisen
  if (appearance) {
    try {
      body.appearance = appearance;
    } catch (e) {
      console.warn(
        `Erscheinungsbild '${appearance.name}' konnte '${body.name}' nicht zugewiesen werden: ${e}`
      );
    }
  }
}

/**
 * Weist den Bauteilen im Raspberry Pi 5 Gehäuse die geforderten Materialien und Erscheinungsbilder zu:
 * - 'Case_Top', 'Case_Middle', 'Case_Bottom' : Kunststoff ABS weiss
 * - 'Logo' : Kunststoff schwarz
 * - 'Pi5_*' / 'RASPBERRY_PI_5*' : Referenzkörper des Boards werden geschützt (bestehende STEP-Darstellung beibehalten)
 *
 * @param rootComp Die Hauptbaugruppe (Root Component).
 * @param params Die aktuellen Benutzerparameter (steuert u.a. enable_materials).
 * @param explicitBodies Optionale Sammlung benannter Körper zur direkten Referenzierung.
 */
export function assignBodyMaterials(
  rootComp: adsk.fusion.Component,
  params: Params,
  explicitBodies?: Record<string, adsk.fusion.BRepBody | null | undefined>
): void {
  // Überprüfen, ob Materialzuweisung parametrisch aktiviert ist
  if (params.enableMaterials && Math.round(params.enableMaterials.value) === 0) {
    console.log("Materialzuweisung deaktiviert (enable_materials = 0).");
    return;
  }

  const design = rootComp.parentDesign;
  const app = adsk.core.Application.get();
  if (!app) {
    console.warn("Application-Instanz nicht verfügbar für Materialzuweisung.");
    return;
  }

  console.log("Schritt 26: Starte Zuweisung von Material und Erscheinungsbild...");

  // =====================================================================
  // 1. Definition & Vorbereitung der Materialien (Physikalisch)
  // =====================================================================
  const matPlasticAbs = getOrCopyMaterial(design, app, "ABS-Kunststoff", [
    "ABS-Kunststoff",
    "ABS Plastic",
    "ABS",
    "Kunststoff",
    "Plastic"
  ]);

  const matPlasticBlack = getOrCopyMaterial(design, app, "Kunststoff", [
    "Kunststoff",
    "Plastic",
    "ABS-Kunststoff",
    "ABS Plastic",
    "ABS"
  ]);

  // =====================================================================
  // 2. Definition & Vorbereitung der Erscheinungsbilder (PBR Visuals)
  // =====================================================================

  // A: Gehäuseteile -> Kunststoff ABS weiss
  const appCaseAbsWhite = getOrCopyAppearance(
    design,
    app,
    "Kunststoff ABS - weiss",
    [
      "ABS (weiß)",
      "ABS (White)",
      "Kunststoff - matt (weiß)",
      "Plastik - matt (weiß)",
      "Plastic - Matte (White)",
      "Plastic - Textured - White",
      "White",
      "Weiß"
    ],
    {
      surfaceType: adsk.core.AppearanceSurfaceTypes.OpaqueAppearanceSurface,
      color: { r: 242, g: 242, b: 240 }, // Klassisches vintage Apple Warmweiß
      roughness: 0.45 // Seidenmatter ABS-Spritzguss-Look
    }
  );

  // B: Logo -> Kunststoff schwarz
  const appLogoPlasticBlack = getOrCopyAppearance(
    design,
    app,
    "Kunststoff - matt (schwarz)",
    [
      "Kunststoff - matt (schwarz)",
      "Plastik - matt (schwarz)",
      "Plastic - Matte (Black)",
      "ABS (schwarz)",
      "ABS (Black)",
      "Plastic - Textured - Black",
      "Black",
      "Schwarz"
    ],
    {
      surfaceType: adsk.core.AppearanceSurfaceTypes.OpaqueAppearanceSurface,
      color: { r: 30, g: 30, b: 32 }, // Edles, tiefes Mattschwarz
      roughness: 0.5 // Seidenmattes Kunststoff-Finish
    }
  );

  // =====================================================================
  // 3. Zuweisung an alle Körper in rootComp
  // =====================================================================
  const processedBodyNames = new Set<string>();

  // A: Explizit übergebene Körper verarbeiten
  if (explicitBodies) {
    for (const [key, bodyRef] of Object.entries(explicitBodies)) {
      if (!bodyRef) continue;
      const liveBody = getLiveBody(rootComp, bodyRef, bodyRef.name);
      if (!liveBody) continue;

      assignMaterialToSpecificBody(
        liveBody,
        matPlasticAbs,
        matPlasticBlack,
        appCaseAbsWhite,
        appLogoPlasticBlack
      );
      processedBodyNames.add(liveBody.name);
    }
  }

  // B: Alle weiteren Körper in rootComp.bRepBodies verarbeiten (sichert Vollständigkeit ab)
  for (let i = 0; i < rootComp.bRepBodies.count; i++) {
    const body = rootComp.bRepBodies.item(i);
    if (!body || processedBodyNames.has(body.name)) continue;

    assignMaterialToSpecificBody(
      body,
      matPlasticAbs,
      matPlasticBlack,
      appCaseAbsWhite,
      appLogoPlasticBlack
    );
    processedBodyNames.add(body.name);
  }

  console.log(
    `Schritt 26: Material- und Erscheinungsbildzuweisung für ${processedBodyNames.size} Körper erfolgreich abgeschlossen.`
  );
}

/**
 * Hilfsfunktion zur Kategorisierung und Zuweisung eines einzelnen Körpers.
 */
function assignMaterialToSpecificBody(
  body: adsk.fusion.BRepBody,
  matPlasticAbs: adsk.core.Material | null,
  matPlasticBlack: adsk.core.Material | null,
  appAbsWhite: adsk.core.Appearance | null,
  appPlasticBlack: adsk.core.Appearance | null
): void {
  const name = body.name;

  // 1. Raspberry Pi 5 Board-Referenzkörper: STEP-Erscheinungsbilder beibehalten
  if (
    name.startsWith("Pi5_") ||
    name.startsWith("RASPBERRY_PI_5") ||
    name.toLowerCase().includes("pi5")
  ) {
    console.log(`- '${name}' wird bei Materialzuweisung geschützt (STEP-Darstellung beibehalten).`);
    return;
  }

  // 2. Logo: Kunststoff schwarz
  if (name === "Logo" || name.startsWith("Logo")) {
    applyMaterialAndAppearanceToBody(body, matPlasticBlack, appPlasticBlack, true);
    console.log(`- '${name}' zugewiesen: Kunststoff schwarz`);
    return;
  }

  // 3. Gehäusekörper (Case_Top, Case_Middle, Case_Bottom und alle weiteren Gehäusebauteile): ABS weiss
  applyMaterialAndAppearanceToBody(body, matPlasticAbs, appAbsWhite, true);
  console.log(`- '${name}' zugewiesen: ABS weiss`);
}
