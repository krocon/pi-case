import { adsk } from "@adsk/fusion";

/** Geometrische Toleranz für Such- und Prüfaufgaben (in cm). */
export const TOL = 0.05; // 0.5 mm in cm

/** Erzeugt eine Fusion 360 ObjectCollection aus Elementen oder Arrays */
export function createCollection<T extends adsk.core.Base>(...items: (T | T[] | null | undefined)[]): adsk.core.ObjectCollection {
  const collection = adsk.core.ObjectCollection.create();
  for (const item of items) {
    if (!item) continue;
    if (Array.isArray(item)) {
      for (const subItem of item) {
        if (subItem && ('isValid' in subItem ? (subItem as any).isValid : true)) {
          collection.add(subItem);
        }
      }
    } else {
      if ('isValid' in item ? (item as any).isValid : true) {
        collection.add(item);
      }
    }
  }
  return collection;
}

/** Ermittelt den aktuellen Live-BRepBody aus comp.bRepBodies mit Schutz vor ungültigen BRep-Referenzen */
export function getLiveBody(comp: adsk.fusion.Component, fallbackBody: adsk.fusion.BRepBody, preferredName?: string): adsk.fusion.BRepBody {
  if (!comp || comp.bRepBodies.count === 0) return fallbackBody;

  // 1. Höchste Priorität: Direkte Objekt-Identität (Pointer-Vergleich)
  try {
    if (fallbackBody && fallbackBody.isValid) {
      for (let i = 0; i < comp.bRepBodies.count; i++) {
        const b = comp.bRepBodies.item(i);
        if (b && b.isValid && b === fallbackBody) {
          return b;
        }
      }
    }
  } catch (_e) { }

  // 2. Namensabgleich (falls Body durch ein Feature ersetzt oder modifiziert wurde)
  let targetName = preferredName;
  if (!targetName) {
    try {
      if (fallbackBody && fallbackBody.isValid) {
        targetName = fallbackBody.name;
      }
    } catch (_e) { }
  }

  if (targetName) {
    // 1. Zuerst nach exakter Namensübereinstimmung suchen
    for (let i = comp.bRepBodies.count - 1; i >= 0; i--) {
      try {
        const b = comp.bRepBodies.item(i);
        if (b && b.isValid && b.name === targetName) {
          return b;
        }
      } catch (_e) { }
    }
    // 2. Fallback: Prefix-Übereinstimmung (nur wenn kein exakter Name vorhanden ist)
    for (let i = comp.bRepBodies.count - 1; i >= 0; i--) {
      try {
        const b = comp.bRepBodies.item(i);
        if (b && b.isValid && b.name.startsWith(targetName)) {
          return b;
        }
      } catch (_e) { }
    }
  }

  return fallbackBody;
}

/**
 * Erzeugt eine Versatzebene (ConstructionPlane) mit sicherem Fallback-Pattern (AGENTS.md §4.3 konform).
 */
export function createOffsetPlane(
  comp: adsk.fusion.Component,
  basePlane: adsk.core.Base,
  offsetCm: number,
  paramName?: string
): adsk.fusion.ConstructionPlane | null {
  const planes = comp.constructionPlanes;

  // Stufe 1: Mit Parameter-Name verknüpfen (sofern angegeben)
  if (paramName) {
    try {
      const valInput = adsk.core.ValueInput.createByString(paramName);
      if (valInput) {
        const planeInput = planes.createInput();
        planeInput.setByOffset(basePlane, valInput);
        const plane = planes.add(planeInput);
        if (plane) return plane;
      }
    } catch (_e) { }
  }

  // Stufe 2: Fallback mit direktem Zahlenwert (in cm) auf frischem Input
  try {
    const planeInput = planes.createInput();
    planeInput.setByOffset(basePlane, adsk.core.ValueInput.createByReal(offsetCm));
    return planes.add(planeInput);
  } catch (_e) {
    return null;
  }
}

/**
 * Wendet eine Verrundung mit 4-Stufen-Fallback-System auf eine Kantengruppe an (AGENTS.md §4.10 konform).
 */
export function applyFilletWithFallbacks(
  comp: adsk.fusion.Component,
  edges: adsk.fusion.BRepEdge[],
  radiusCm: number,
  paramName?: string,
  logPrefix: string = 'Fillet'
): boolean {
  if (edges.length === 0) {
    console.warn(`${logPrefix}: Keine Kanten für Verrundung übergeben.`);
    return false;
  }

  const filletFeatures = comp.features.filletFeatures;

  // Stufe A: Mit Parameter-Name & Tangentenkette
  if (paramName) {
    try {
      const input = filletFeatures.createInput();
      if (input) {
        input.isRollingBallCorner = false;
        const coll = createCollection(edges);
        let valInput = adsk.core.ValueInput.createByString(paramName);
        if (!valInput) valInput = adsk.core.ValueInput.createByReal(radiusCm);
        const setInput = input.edgeSetInputs.addConstantRadiusEdgeSet(coll, valInput, true);
        if (setInput) setInput.continuity = adsk.fusion.SurfaceContinuityTypes.TangentSurfaceContinuityType;
        const feat = filletFeatures.add(input);
        if (feat) return true;
      }
    } catch (e) {
      console.warn(`${logPrefix}: Stufe A (${paramName}) fehlgeschlagen: ${e}`);
    }
  }

  // Stufe B: Mit direktem Zahlenwert & Tangentenkette
  try {
    const input = filletFeatures.createInput();
    if (input) {
      input.isRollingBallCorner = false;
      const coll = createCollection(edges);
      const valInput = adsk.core.ValueInput.createByReal(radiusCm);
      const setInput = input.edgeSetInputs.addConstantRadiusEdgeSet(coll, valInput, true);
      if (setInput) setInput.continuity = adsk.fusion.SurfaceContinuityTypes.TangentSurfaceContinuityType;
      const feat = filletFeatures.add(input);
      if (feat) return true;
    }
  } catch (e) {
    console.warn(`${logPrefix}: Stufe B (${radiusCm * 10}mm direkt) fehlgeschlagen: ${e}`);
  }

  // Stufe C: Mit direktem Zahlenwert ohne Tangentenkette
  try {
    const input = filletFeatures.createInput();
    if (input) {
      input.isRollingBallCorner = false;
      const coll = createCollection(edges);
      const valInput = adsk.core.ValueInput.createByReal(radiusCm);
      const setInput = input.edgeSetInputs.addConstantRadiusEdgeSet(coll, valInput, false);
      if (setInput) setInput.continuity = adsk.fusion.SurfaceContinuityTypes.TangentSurfaceContinuityType;
      const feat = filletFeatures.add(input);
      if (feat) return true;
    }
  } catch (e) {
    console.warn(`${logPrefix}: Stufe C (ohne Tangentenkette) fehlgeschlagen: ${e}`);
  }

  // Stufe D: Einzelkanten abrunden
  let successCount = 0;
  for (const edge of edges) {
    try {
      const input = filletFeatures.createInput();
      if (input) {
        input.isRollingBallCorner = false;
        const coll = createCollection(edge);
        const valInput = adsk.core.ValueInput.createByReal(radiusCm);
        const setInput = input.edgeSetInputs.addConstantRadiusEdgeSet(coll, valInput, false);
        if (setInput) setInput.continuity = adsk.fusion.SurfaceContinuityTypes.TangentSurfaceContinuityType;
        const feat = filletFeatures.add(input);
        if (feat) successCount++;
      }
    } catch (_e) { }
  }

  if (successCount > 0) {
    console.log(`${logPrefix}: Stufe D erfolgreich für ${successCount}/${edges.length} Kanten.`);
    return true;
  }

  console.error(`${logPrefix}: Alle 4 Fallback-Stufen fehlgeschlagen.`);
  return false;
}

/**
 * Wendet eine Fase mit mehrstufigem Fallback-System auf eine Kantenmenge an (AGENTS.md §1.3 konform).
 */
export function applyChamferWithFallbacks(
  comp: adsk.fusion.Component,
  edges: adsk.fusion.BRepEdge[],
  distanceCm: number,
  paramName?: string,
  logPrefix: string = 'Chamfer'
): boolean {
  if (edges.length === 0) {
    console.warn(`${logPrefix}: Keine Kanten für Fase übergeben.`);
    return false;
  }

  const chamferFeatures = comp.features.chamferFeatures;

  // Stufe A: createInput2 mit addEqualDistanceChamferEdgeSet & Parameter-Name
  if (paramName) {
    try {
      const input = chamferFeatures.createInput2();
      if (input) {
        const coll = createCollection(edges);
        let valInput = adsk.core.ValueInput.createByString(paramName);
        if (!valInput) valInput = adsk.core.ValueInput.createByReal(distanceCm);
        const added = input.chamferEdgeSets.addEqualDistanceChamferEdgeSet(coll, valInput, true);
        if (added) {
          const feat = chamferFeatures.add(input);
          if (feat) return true;
        }
      }
    } catch (e) {
      console.warn(`${logPrefix}: Stufe A (mit Parameter ${paramName}) fehlgeschlagen: ${e}`);
    }
  }

  // Stufe B: createInput2 mit direktem Zahlenwert & Tangentenkette
  try {
    const input = chamferFeatures.createInput2();
    if (input) {
      const coll = createCollection(edges);
      const valInput = adsk.core.ValueInput.createByReal(distanceCm);
      const added = input.chamferEdgeSets.addEqualDistanceChamferEdgeSet(coll, valInput, true);
      if (added) {
        const feat = chamferFeatures.add(input);
        if (feat) return true;
      }
    }
  } catch (e) {
    console.warn(`${logPrefix}: Stufe B (${distanceCm * 10}mm direkt) fehlgeschlagen: ${e}`);
  }

  // Stufe C: createInput2 mit direktem Zahlenwert ohne Tangentenkette
  try {
    const input = chamferFeatures.createInput2();
    if (input) {
      const coll = createCollection(edges);
      const valInput = adsk.core.ValueInput.createByReal(distanceCm);
      const added = input.chamferEdgeSets.addEqualDistanceChamferEdgeSet(coll, valInput, false);
      if (added) {
        const feat = chamferFeatures.add(input);
        if (feat) return true;
      }
    }
  } catch (e) {
    console.warn(`${logPrefix}: Stufe C (ohne Tangentenkette) fehlgeschlagen: ${e}`);
  }

  // Stufe D: Einzelkanten anfasen
  let successCount = 0;
  for (const edge of edges) {
    try {
      const input = chamferFeatures.createInput2();
      if (input) {
        const coll = createCollection(edge);
        const valInput = adsk.core.ValueInput.createByReal(distanceCm);
        input.chamferEdgeSets.addEqualDistanceChamferEdgeSet(coll, valInput, false);
        const feat = chamferFeatures.add(input);
        if (feat) successCount++;
      }
    } catch (_e) { }
  }

  if (successCount > 0) {
    console.log(`${logPrefix}: Stufe D erfolgreich für ${successCount}/${edges.length} Kanten.`);
    return true;
  }

  console.warn(`${logPrefix}: Alle Fallback-Stufen für Anfasung fehlgeschlagen.`);
  return false;
}

/**
 * Wendet eine spezifische RGB-Farbe auf eine Fläche oder einen Körper an.
 * Fängt Fehler sicher ab, falls Bibliotheken oder Erscheinungsbild-Objekte nicht verfügbar sind.
 */
export function applyColorToEntity(
  design: adsk.fusion.Design,
  entity: adsk.fusion.BRepFace | adsk.fusion.BRepBody,
  colorName: string,
  r: number,
  g: number,
  b: number
): void {
  try {
    let appearance = design.appearances.itemByName(colorName);
    if (!appearance) {
      try {
        appearance = design.appearances.add(
          colorName,
          adsk.core.AppearanceSurfaceTypes.OpaqueAppearanceSurface
        );
      } catch (_e) {
        if (design.appearances.count > 0) {
          const firstApp = design.appearances.item(0);
          if (firstApp) {
            appearance = design.appearances.addByCopy(firstApp, colorName);
          }
        }
      }
    }
    if (appearance) {
      try {
        const colorProp = appearance.appearanceProperties.itemByName('Color');
        if (colorProp && 'value' in colorProp) {
          (colorProp as any).value = adsk.core.Color.create(r, g, b, 255);
        }
      } catch (_e) {}
      entity.appearance = appearance;
    }
  } catch (e) {
    console.warn(`Farbe '${colorName}' konnte nicht zugewiesen werden: ${e}`);
  }
}

/**
 * Aktualisiert den Viewport live und pumpt die UI-Event-Queue.
 */
export function stepRefresh(app: adsk.core.Application | null, enabled: boolean): void {
  if (!enabled || !app) return;
  try {
    if (app.activeViewport) {
      app.activeViewport.refresh();
    }
    adsk.doEvents();
  } catch (e) {
    console.warn(`Fehler beim Aktualisieren des Viewports: ${e}`);
  }
}

/**
 * Schaltet die Sichtbarkeit aller Skizzen und Konstruktionselemente (Ebenen, Achsen, Punkte)
 * sowie der übergeordneten Ordner im Fusion 360 Browserbaum aus (Sichtbar = off).
 */
export function hideSketchesAndConstruction(rootComp: adsk.fusion.Component): void {
  try {
    // 1. Skizzen-Ordner (Browser-Glühbirne) ausschalten
    try {
      rootComp.isSketchFolderLightBulbOn = false;
    } catch (_e) {}

    // 2. Alle einzelnen Skizzen ausschalten
    for (let i = 0; i < rootComp.sketches.count; i++) {
      try {
        const sk = rootComp.sketches.item(i);
        if (sk) {
          sk.isLightBulbOn = false;
          sk.isVisible = false;
        }
      } catch (_e) {}
    }

    // 3. Konstruktions-Ordner (Browser-Glühbirne) ausschalten
    try {
      rootComp.isConstructionFolderLightBulbOn = false;
    } catch (_e) {}

    // 4. Alle einzelnen Konstruktionsebenen, -achsen und -punkte ausschalten
    for (let i = 0; i < rootComp.constructionPlanes.count; i++) {
      try {
        const cp = rootComp.constructionPlanes.item(i);
        if (cp) cp.isLightBulbOn = false;
      } catch (_e) {}
    }

    for (let i = 0; i < rootComp.constructionAxes.count; i++) {
      try {
        const ca = rootComp.constructionAxes.item(i);
        if (ca) ca.isLightBulbOn = false;
      } catch (_e) {}
    }

    for (let i = 0; i < rootComp.constructionPoints.count; i++) {
      try {
        const cpt = rootComp.constructionPoints.item(i);
        if (cpt) cpt.isLightBulbOn = false;
      } catch (_e) {}
    }

    // 5. Rekursiv für Unterkomponenten / Occurrences (z.B. importiertes Pi5 Board) anwenden
    if (rootComp.allOccurrences) {
      for (let i = 0; i < rootComp.allOccurrences.count; i++) {
        try {
          const occ = rootComp.allOccurrences.item(i);
          if (occ && occ.component) {
            try {
              occ.component.isSketchFolderLightBulbOn = false;
            } catch (_e) {}
            try {
              occ.component.isConstructionFolderLightBulbOn = false;
            } catch (_e) {}
          }
        } catch (_e) {}
      }
    }
  } catch (e) {
    console.warn(`hideSketchesAndConstruction: Fehler beim Ausblenden: ${e}`);
  }
}

/**
 * Detailliertes Ergebnis der Baugruppenprüfung inklusive Erkennungsgrund.
 */
export interface AssemblyDetectionResult {
  isAssembly: boolean;
  reason: string;
}

/**
 * Prüft umfassend, ob das Skript in einer Baugruppenkonstruktion (Assembly) ausgeführt wird.
 *
 * Eine Konstruktion in Autodesk Fusion 360 gilt als Baugruppenkonstruktion, wenn
 * mindestens eines der folgenden Kriterien erfüllt ist:
 *
 * 1. Aktive Bearbeitungsebene:
 *    - Die Root-Komponente ist nicht aktiv (!design.isRootComponentActive),
 *    - oder die aktive Komponente ist eine Unterkomponente (design.activeComponent !== rootComp),
 *    - oder eine Occurrence ist aktiv (design.activeOccurrence !== null).
 *
 * 2. Kinematische Gelenke / Starre Gruppen:
 *    - rootComp.joints.count > 0, rootComp.asBuiltJoints.count > 0 oder rootComp.rigidGroups.count > 0.
 *
 * 3. Vorhandene Occurrences (Komponenteninstanzen):
 *    - rootComp.occurrences.count > 0 oder rootComp.allOccurrences.count > 0.
 *    - Jede benutzerdefinierte Komponente (z. B. "Pi5", "Pi5_Case", "MarcIntosh", "Chassis")
 *      belegt eindeutig eine Baugruppenkonstruktion.
 *    - Reines STEP-Board aus einem früheren Lauf (Name startet mit "RASPBERRY_PI_5_1")
 *      wird ignoriert, sofern es die einzige Occurrence ist.
 *
 * 4. Mehrere Komponenten im Gesamtdesign (allComponents):
 *    - design.allComponents.count > 1 (abzüglich reiner STEP-Importkomponenten).
 *
 * 5. Mehrkörper-Baugruppe in rootComponent (Multi-Body Assembly, z. B. MarcIntosh):
 *    - rootComp.bRepBodies enthält Körper, die nicht originär zum Pi5-Gehäuse gehören
 *      (also ungleich Case_Top, Case_Middle, Case_Bottom, Logo und nicht mit Pi5_ beginnend).
 *      Beispiele: Case_01_Top, Case_02_Middle_A, Mac_Mini_M1, Display_ASUS_ZenScreen_MQ16FC.
 *
 * 6. Fremde Benutzerparameter aus einem übergeordneten Projekt:
 *    - design.userParameters enthält Parameter eines übergeordneten Projekts (z. B. MarcIntosh:
 *      height_top, height_foot, recess_width, split_z, mac_mini_width etc.).
 *
 * 7. Dokument- oder Konstruktionsname:
 *    - Der Name des Dokuments oder der Root-Komponente weist auf eine Baugruppe hin
 *      (z. B. "MarcIntosh", "Baugruppe", "Assembly", "Chassis").
 *
 * @param design Das aktive Fusion 360 Design.
 * @returns AssemblyDetectionResult mit isAssembly und genauer Begründung.
 */
export function detectAssemblyConstruction(design: adsk.fusion.Design): AssemblyDetectionResult {
  try {
    if (!design) return { isAssembly: false, reason: "Kein Design-Objekt vorhanden" };

    const rootComp = design.rootComponent;
    if (!rootComp) return { isAssembly: false, reason: "Keine rootComponent vorhanden" };

    // 0. Höchste Priorität: Fusion 360 nativer Dokumenttyp (designIntent)
    try {
      if (design.designIntent === adsk.fusion.DesignIntentTypes.PartDesignIntentType) {
        return {
          isAssembly: false,
          reason: "Bauteilkonstruktionsdokument (designIntent === PartDesignIntentType, erlaubt per Fusion 360 nur 1 Komponente)"
        };
      }
      if (design.designIntent === adsk.fusion.DesignIntentTypes.AssemblyDesignIntentType) {
        return {
          isAssembly: true,
          reason: "Baugruppenkonstruktionsdokument (designIntent === AssemblyDesignIntentType)"
        };
      }
    } catch (_e) {}

    // 1. Aktive Bearbeitungsebene: Unterkomponente / Occurrence aktiv
    try {
      if (!design.isRootComponentActive) {
        return { isAssembly: true, reason: "Root-Komponente ist nicht die aktive Bearbeitungsebene" };
      }
      if (design.activeComponent && design.activeComponent !== rootComp) {
        return {
          isAssembly: true,
          reason: `Aktive Komponente '${design.activeComponent.name}' ist eine Unterkomponente`
        };
      }
      if (design.activeOccurrence) {
        return {
          isAssembly: true,
          reason: `Aktive Occurrence '${design.activeOccurrence.name}' vorhanden`
        };
      }
    } catch (_e) {}

    // 2. Kinematische Gelenke / Starre Gruppen
    try {
      if (rootComp.joints && rootComp.joints.count > 0) {
        return { isAssembly: true, reason: `${rootComp.joints.count} Gelenk(e) (Joints) vorhanden` };
      }
      if (rootComp.asBuiltJoints && rootComp.asBuiltJoints.count > 0) {
        return { isAssembly: true, reason: `${rootComp.asBuiltJoints.count} As-Built-Gelenk(e) vorhanden` };
      }
      if (rootComp.rigidGroups && rootComp.rigidGroups.count > 0) {
        return { isAssembly: true, reason: `${rootComp.rigidGroups.count} starre Gruppe(n) vorhanden` };
      }
    } catch (_e) {}

    // Hilfsfunktion: Prüft, ob ein Name exakt der STEP-Referenzbaugruppe des Pi5 entspricht
    const isPureStepImportName = (name: string): boolean => {
      const lower = name.toLowerCase().trim();
      return lower.startsWith("raspberry_pi_5_1") || lower.startsWith("raspberry-pi-5-1");
    };

    // 3. Occurrences in rootComponent oder der gesamten Baugruppenhierarchie (allOccurrences)
    try {
      const occCount = rootComp.occurrences ? rootComp.occurrences.count : 0;
      const allOccCount = rootComp.allOccurrences ? rootComp.allOccurrences.count : 0;
      const totalOccs = Math.max(occCount, allOccCount);

      if (totalOccs > 0) {
        const occList = rootComp.allOccurrences || rootComp.occurrences;
        let nonStepOccFound = false;
        let sampleOccName = "";

        for (let i = 0; i < occList.count; i++) {
          const occ = occList.item(i);
          if (occ && occ.isValid) {
            if (!isPureStepImportName(occ.name)) {
              nonStepOccFound = true;
              sampleOccName = occ.name;
              break;
            }
          }
        }

        if (nonStepOccFound) {
          return {
            isAssembly: true,
            reason: `Baugruppen-Occurrence vorhanden (z. B. '${sampleOccName}', gesamt: ${totalOccs})`
          };
        }

        if (totalOccs > 1) {
          return {
            isAssembly: true,
            reason: `Mehrere Occurrences (${totalOccs}) in der Konstruktion vorhanden`
          };
        }
      }
    } catch (_e) {}

    // 4. Komponentenliste im Gesamtdesign (allComponents)
    try {
      if (design.allComponents && design.allComponents.count > 1) {
        for (let i = 0; i < design.allComponents.count; i++) {
          const comp = design.allComponents.item(i);
          if (comp && comp.isValid && comp !== rootComp) {
            if (!isPureStepImportName(comp.name)) {
              return {
                isAssembly: true,
                reason: `Komponente '${comp.name}' im Design vorhanden (gesamt: ${design.allComponents.count})`
              };
            }
          }
        }
      }
    } catch (_e) {}

    // 5. Mehrkörper-Baugruppe: Fremdkörper in rootComponent.bRepBodies (z. B. MarcIntosh)
    try {
      const pi5CaseBodyNames = new Set(["case_top", "case_middle", "case_bottom", "logo"]);
      for (let i = 0; i < rootComp.bRepBodies.count; i++) {
        const b = rootComp.bRepBodies.item(i);
        if (b && b.isValid) {
          const bName = b.name.toLowerCase().trim();
          if (
            !pi5CaseBodyNames.has(bName) &&
            !bName.startsWith("pi5_") &&
            !isPureStepImportName(bName)
          ) {
            return {
              isAssembly: true,
              reason: `Fremdkörper '${b.name}' in Konstruktion gefunden (Mehrkörper-Baugruppe, z. B. MarcIntosh)`
            };
          }
        }
      }
    } catch (_e) {}

    // 6. Explizit bekannte Fremdparameter aus übergeordneten Baugruppen (z. B. MarcIntosh)
    try {
      const knownMarcIntoshParams = new Set([
        "height_top", "height_foot", "recess_width", "recess_height", "recess_depth",
        "shell_thickness_top", "shell_thickness_middle", "split_z", "split_z_middle",
        "slot_offset_x", "slot_depth", "slot_outer_offset", "mac_mini_width"
      ]);
      for (let i = 0; i < design.userParameters.count; i++) {
        const p = design.userParameters.item(i);
        if (p && p.isValid) {
          const pName = p.name.toLowerCase().trim();
          if (knownMarcIntoshParams.has(pName)) {
            return {
              isAssembly: true,
              reason: `MarcIntosh-Parameter '${p.name}' gefunden (übergeordnete Baugruppenkonstruktion)`
            };
          }
        }
      }
    } catch (_e) {}

    // 7. Dokumentname oder Root-Komponentenname weist auf Baugruppe hin
    try {
      const docName = (
        design.parentDocument && design.parentDocument.name
          ? design.parentDocument.name
          : rootComp.name
      ).toLowerCase();
      if (
        docName.includes("marcintosh") ||
        docName.includes("baugruppe") ||
        docName.includes("assembly") ||
        docName.includes("chassis")
      ) {
        return {
          isAssembly: true,
          reason: `Konstruktionsname '${design.parentDocument ? design.parentDocument.name : rootComp.name}' weist auf Baugruppe hin`
        };
      }
    } catch (_e) {}

    return {
      isAssembly: false,
      reason: "Reine Einzelteilkonstruktion (nur Pi5-Gehäusekörper, keine Fremdkomponenten/Occurrences/Gelenke)"
    };
  } catch (e) {
    console.warn(`detectAssemblyConstruction: Fehler bei der Prüfung: ${e}`);
    return { isAssembly: false, reason: `Ausnahmefehler bei Prüfung: ${e}` };
  }
}


/**
 * Gibt true zurück, wenn das Skript im Kontext einer Baugruppe ausgeführt wird, andernfalls false.
 */
export function isAssemblyConstruction(design: adsk.fusion.Design): boolean {
  return detectAssemblyConstruction(design).isAssembly;
}
