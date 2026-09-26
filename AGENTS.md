# Anweisungsdatei für Antigravity AI Agent (Fusion Objects / 3D-Modelle)

Diese Datei enthält verbindliche Richtlinien, Architekturvorgaben und Best Practices für alle automatisierten Änderungen und Code-Generierungen in diesem Repository (`fusion-objects`).

---

## 1. Grundprinzipien

### 1.1 Minimale & zielgerichtete Änderungen
- **Präzise Edits:** Führe nur Änderungen durch, die für die Erfüllung der jeweiligen Aufgabe zwingend erforderlich sind.
- **Keine unerwünschten Re-writes:** Vermeide es, funktionierenden Code oder ganze Dateien komplett neu zu schreiben, wenn punktuelle Anpassungen ausreichen.
- **Erhalte Struktur & Kommentare:** Bestehende Dokumentationen, Kommentare, JSDocs und Code-Strukturen müssen bewahrt und bei Bedarf angepasst werden.

### 1.2 Wartbarer & Sauberer Code (Clean Code)
- **Modulare Funktionsaufteilung (Streng empfohlen):** Lagere jeden Konstruktionsschritt (Grundkörper, Fasen/Verrundungen, Ausklinkungen, Kanäle, Bohrungen) in eine eigene, präzise typisierte Funktion aus (z. B. `createCrossBody`, `filletBackEdges`, `createCableChannel`), anstatt monolithischen Code in `run()` zu schreiben.
- **Klarheit & Benennung:** Verwende sprechende Variablen- und Funktionsnamen in konsistentem Stil (TypeScript camelCase für Funktionen/Variablen).
- **Orchestrator-Muster:** Jedes Skript besitzt eine zentrale `run(_context: string): void`-Funktion als Einstiegspunkt, die den Ablauf logisch in nummerierte Einzelschritte gliedert und am Ende den Zielkörper eindeutig benennt (`targetBody.name = '...'`).

### 1.3 Robuste Fehlerbehandlung & Logging
- **Try...Catch-Blöcke:** Verpacke Skript-Hauptfunktionen stets in `try...catch`-Blöcke.
- **Benutzer-Feedback:** Gib kritische Fehlermeldungen sowohl über die Fusion 360 Benutzeroberfläche (`ui.messageBox`) als auch über die Konsole (`console.error`) aus.
- **Mehrstufige Fallbacks:** Bei geometrisch heiklen Nachbearbeitungen (z. B. Kantenverrundungen oder Fasen) muss das bewährte mehrstufige Fallback-System (`applyFilletWithFallbacks`) eingesetzt werden, damit nicht das gesamte Modell fehlschlägt, wenn BRep-Kanten nicht parametrisch verrundet werden können.

---

## 2. Repository- & Skript-Architektur

### 2.1 Ordnerstruktur für Fusion 360 Skripte & Modelle
Jedes parametrische Skript befindet sich in einem eigenen Unterordner unter `fusion/model/<kategorie>/<script-name>/` oder `fusion/scripts/<script-name>/` und enthält standardmäßig:
- `<script-name>.ts`: Die TypeScript-Implementierung des Bauteil-Generators.
- `<script-name>.manifest`: Die Fusion 360 Manifest-Datei (JSON) mit Metadaten (`autodeskProduct: "Fusion"`, `type: "script"`, `editEnabled: true`, `supportedOS: "windows|mac"`).
- `tsconfig.json`: Lokale TypeScript-Konfiguration, die auf das Root-Verzeichnis verweist (`{"extends": "../../../tsconfig.json"}` bzw. relative Pfadtiefe).
- `ScriptIcon.svg`: Das UI-Icon für den Fusion 360 Skript-Dialog.

*Regel bei neuen Skripten:* Werden neue Skripte angelegt, müssen Begleitdateien (`.manifest`, `tsconfig.json`, `ScriptIcon.svg`) vollständig und mit konsistentem Namen erstellt werden.

### 2.2 TypeScript-Konfiguration & Modul-Imports
- Verwende für Autodesk Fusion APIs konsistent die konfigurierten Pfade:
  ```typescript
  import { adsk } from "@adsk/fusion";
  ```
- In der Root-`tsconfig.json` müssen in `paths` sowohl `@adsk/*` als auch explizit `@adsk/fusion` auf die Typdefinitionen verweisen:
  ```json
  "paths": {
    "@adsk/*": ["fusion/lib/API/TypeScript/@adsk/*"],
    "@adsk/fusion": ["fusion/lib/API/TypeScript/@adsk/fusion/index.d.ts"]
  }
  ```
- Im `include`-Array der Root-`tsconfig.json` müssen sowohl `"fusion/scripts/**/*.ts"` als auch `"fusion/model/**/*.ts"` deklariert sein.
- Greife auf Node/FS-Module ausschließlich über die typisierten Definitionen unter `fusion/lib/API/TypeScript/` zu.

### 2.3 Modulare Architektur & Domänen-Aufteilung (Lokale `.ts`-Dateien)

- **Trennung von Orchestrierung und Konstruktion (Streng verbindlich):**
  - Die zentrale Skriptdatei (z. B. `case.ts`) fungiert **ausschließlich als Orchestrator**. Sie steuert den Gesamt-Workflow, ruft die einzelnen Konstruktionsschritte chronologisch in `run()` auf, koordiniert BRep-Referenzen über `getLiveBody` und wickelt High-Level Logging / Fehlermeldungen ab.
  - Umfangreiche Konstruktionslogiken, Geometrieerzeugungen, Feature-Ketten und Baugruppen gehören **niemals monolithisch in `case.ts`**, sondern müssen in modulare, lokale TypeScript-Dateien im selben Ordner (z. B. `fusion/model/marcintosh`) gegliedert sein.

- **Regeln: Wann muss eine neue `.ts`-Datei angelegt werden?**
  1. **Neue, eigenständige Körper & Baugruppen:**
     Sobald ein neuer physischer Körper oder ein eigenständiges Bauteil hinzukommt (z. B. ein Display, ein Tragegriff, ein Apple-Logo oder ein Rechnergehäuse wie der Mac Mini), **muss** hierfür eine eigene `.ts`-Datei erstellt werden (z. B. `display.ts`, `handle.ts`, `macMini.ts`).
  2. **In sich geschlossene mechanische Subsysteme:**
     Funktionale Baugruppen mit komplexer Wechselwirkung zwischen mehreren Körpern (z. B. Gelenk- und Schwenkmechanismen in `tiltMechanism.ts`, Verbindungselemente und Zuganker in `hardware.ts` oder Grundkörperbildung in `chassis.ts`) gehören in ein eigenes Modul.
  3. **Querschnitts- & Nachbearbeitungsfunktionen:**
     Aufgaben, die mehrere Körper analysieren oder modifizieren (z. B. Spannungsabbau-Verrundungen in `stressRelief.ts` oder Druckbett-Ausrichtungen in `printLayout.ts`), sind in eigenständigen Modulen zu kapseln.
  4. **Codeumfang & Single-Responsibility:**
     Überschreitet eine Konstruktionsfunktion oder ein logischer Schrittblock einen Umfang von ca. 150–200 Zeilen oder umfasst er mehrere spezialisierte Skizzen-, Extrusions- und Gewindeschritte, ist er aus `case.ts` in eine neue oder bestehende Fachdatei auszulagern.

- **Übersicht: Was befindet sich in welchem `.ts`-File? (Modul-Zuständigkeiten am Beispiel `fusion/model/marcintosh`):**
  - **`case.ts` (Orchestrator):**
    Zentraler Einstiegspunkt (`run()`). Ruft die Konstruktionsschritte in nummerierter Abfolge (Schritte 1 bis 26+) auf, übergibt Zwischenkörper an Folgefunktionen und fängt Ausführungsfehler zentral ab.
  - **`parameters.ts` (Parameter-Management):**
    Zentrales `setupParameters(design)`. Verwaltet sämtliche parametrischen Maße (`UserParameters`) mit Standardwerten, Einheiten und Beschreibungen im strikten `snake_case`. Exportiert den Typ `Params`.
  - **`utils.ts` (Gemeinsame Hilfswerkzeuge):**
    Generische API-Helfer wie `createCollection`, robuste Live-Körper-Ermittlung `getLiveBody`, fehlertolerante Ebenenerzeugung `createOffsetPlane`, mehrstufige Kantenverrundung `applyFilletWithFallbacks` und Toleranzkonstanten (`TOL`).
  - **`chassis.ts` (Gehäuse-Grundstruktur):**
    Hauptprofilskizze (YZ-Ebene), symmetrische Primärextrusionen, frontseitige Hauptausklinkung (Display-Recess), Schalen-Aushöhlung (CaseBottom, CaseTop, CaseMiddle), horizontale Trennschnitte und Boden-Auffüllung bei $Z = 6.5\,\text{mm}$.
  - **`tiltMechanism.ts` (Neige- & Schwenkmechanik):**
    Mechanische Führung im Standfuß: Schwenk-Gleitbahnen, Sperr-Pins (`Pin_01`, `Pin_02`), M4-Verschraubungskanäle, Sechskant-Mutterntaschen, Halteplatten (`Tilt_Plate_01`, `Tilt_Plate_02`) und Spiegelfunktionen.
  - **`handle.ts` (Tragegriff & Lagerung):**
    Drehbarer Griffkörper (`Case_Handle`): Bündige Griffbettung in der Wölbung von `Case_01_Top`, koaxiale Drehachsenbohrungen für 3mm-Stifte, Grifffinger-Mulde und Neodym-Magnettaschen.
  - **`macMini.ts` (Mac Mini M1 Referenz & Einbau):**
    Referenzkörper `Mac_Mini_M1` mit Standfuß, runde rückseitige Lüftungsöffnung (Ø 174mm), seitliche I/O-Anschlussaussparung, vertikaler Einschubkanal und interne Haltestege.
  - **`hardware.ts` (Verschraubungen & Verbindungstechnik):**
    Wiederöffenbare M6-Zuganker-Verbindungen (`tie_rod`), Schraubendome, D-Säulen und die Gehäusefront-Bohrung inkl. D-Ring-Flachsenkung für die 1/4"-Stativschraube (`createScreenMountHole`).
  - **`aesthetics.ts` (Design & Formensprache):**
    Gehäuse-Stilelemente im Apple-80er-Jahre-Look ("Snow White" Lüftungsschlitze mit 45°-Fasen an den Flanken) und mehrfarbiges Apple-Logo (`Apple_Logo`) im Standfuß.
  - **`stressRelief.ts` (Spannungsreduktion für FDM):**
    Automatisierte Analyse und selektive Verrundung (1.0mm) sowie Anfasung (0.8mm) von 90°-Innenkanten (`enable_stress_relief_fillets`) zur Reduzierung von Kerbspannungen bei PETG/PLA unter striktem Schutz aller Trenn- und Passflächen.
  - **`display.ts` (Monitor & Front-Integration):**
    ASUS ZenScreen OLED MQ16FC (`Display_ASUS_ZenScreen_MQ16FC`): Quader mit abgerundeten Ecken, 0.5mm Display-Vertiefung (211 x 341 mm), rückseitigem 1/4"-20 UNC Stativ-Innengewinde und fluchtender Ausrichtung an der Gehäusefront.
  - **`printLayout.ts` (FDM-Druckvorbereitung):**
    Stützfreie 3D-Druckanordnung (`layout_for_print`): Aufreihung aller druckbaren Bauteile auf der XY-Ebene ($Z = 0$) entlang der Y-Achse, optimale Ausrichtung auf flache Montageflächen zur Vermeidung von Stützstrukturen an Sichtflächen und Ausblenden von Referenzkörpern.

---

## 3. Parameter-Management (`UserParameters`)

### 3.1 Standardisiertes Setup-Pattern
Verwende in jedem Skript eine zentrale Funktion `setupParameters(design: adsk.fusion.Design)`, die existierende Parameter abruft oder neu erzeugt:
```typescript
function setupParameters(design: adsk.fusion.Design) {
  const params = design.userParameters;

  function getOrCreateParam(name: string, valueStr: string, unit: string, description: string): adsk.fusion.UserParameter {
    let p = params.itemByName(name);
    if (!p) {
      const valInput = adsk.core.ValueInput.createByString(valueStr);
      if (!valInput) {
        throw new Error(`Ungültiger Parameterwert für '${name}': ${valueStr}`);
      }
      p = params.add(name, valInput, unit, description);
      if (!p) {
        throw new Error(`Parameter '${name}' konnte nicht erstellt werden.`);
      }
    }
    // Falls Parameter bereits existiert: Aktuellen Wert des Benutzers beibehalten und nicht überschreiben!
    return p;
  }

  return {
    beamWidth: getOrCreateParam('beam_width', '8mm', 'mm', 'Breite der Kreuzbalken'),
    legLength: getOrCreateParam('leg_length', '18mm', 'mm', 'Länge des Schaftes'),
    zLength: getOrCreateParam('z_length', '6mm', 'mm', 'Dicke des Bauteils in Z-Richtung')
  };
}

type Params = ReturnType<typeof setupParameters>;
```

### 3.2 Wichtige Namenskonvention für Parameter (Kritisch!)
- **Ausschließlich `snake_case` verwenden:** Verwende für Fusion 360 Parameternamen ausschließlich Unterstriche (z. B. `outer_diameter`, `pipe_length`, `thread_clearance`).
- **Niemals Bindestriche nutzen:** Verwende **niemals** Bindestriche (z. B. `pipe-length`), da Fusion 360 den Bindestrich als Minus-Operator (`pipe minus length`) interpretiert und beim Erstellen des Parameters mit einem Syntaxfehler abbricht.
- **Kompakte Einheitenangabe:** Verwende bei Strings vorzugsweise Werte ohne Leerzeichen (z. B. `'8mm'`, `'18mm'`, `'0.8mm'`), um Parsing-Diskrepanzen zu vermeiden.

### 3.3 Einheiten für Prozent- und Dimensionslose Werte (Kritisch!)
- **Kein `%`-Zeichen als Einheit:** In Autodesk Fusion 360 ist `%` kein gültiger Einheitenbezeichner. Übergaben wie `params.add(name, valInput, '%', ...)` oder Strings wie `'50 %'` brechen mit `GETLASTERROR: Invalid expression` ab.
- **Einheitenlos via `''` oder `'ul'`:** Lege Prozentwerte oder Stückzahlen stets als einheitenlose Parameter an (z. B. `unit: ''` und Wert `'50'`).
- **Winkelparameter:** Verwende für Winkel die Einheit `'deg'` und Ausdrücke wie `'15 deg'` (oder Bogenmaß-Zahlenwerte via `ValueInput.createByReal`).

---

## 4. Fusion 360 API Spezifika & Best Practices

### 4.1 Strikte Typenkonformität
- Alle API-Aufrufe müssen konform zu den Typdefinitionen unter `fusion/lib/API/TypeScript/@adsk/fusion/fusion.d.ts` und `core.d.ts` sein.
- Keine Methoden halluzinieren. Überprüfe Methodensignaturen und Parameter immer in `fusion.d.ts`.

### 4.2 Einheiten-System & Maße
- **Standardeinheit:** Die interne Standard-Längeneinheit der Fusion 360 API ist **Zentimeter (cm)**.
- `userParam.value` gibt Längenwerte immer in **cm** zurück (Winkelwerte in **Radiant**).
- Bei direkter Angabe von mm-Werten in Rechnungen muss durch `10.0` geteilt werden (z. B. `const radiusCm = (43.0 / 2.0) / 10.0`).
- Bei Übergabe via `ValueInput` können Ausdrücke mit Maßeinheit (`adsk.core.ValueInput.createByString('42.8mm')`) oder direkte cm-Reals (`adsk.core.ValueInput.createByReal(4.28)`) genutzt werden.

### 4.3 Versatzebenen (`ConstructionPlaneInput`)
- Erzeuge Versatzebenen direkt mit `adsk.core.ValueInput.createByReal(offsetInCm)`.
- *Wichtig:* Führe **keine mehrfachen `setByOffset`-Aufrufe** auf demselben `planeInput`-Objekt durch. Ein fehlerhafter Aufruf korrumpiert das `planeInput`-Objekt, woraufhin Fusion fälschlicherweise eine unversetzte Ebene durch den Ursprung `(0,0,0)` erzeugt.

### 4.4 2D-Skizzenkoordinaten & `modelToSketchSpace`
- 2D-Skizzenfunktionen (z. B. `sketchCircles.addByCenterRadius`) werten nur `x` und `y` des übergebenen `Point3D` aus. Die `z`-Koordinate wird ignoriert.
- **Verwende für Punkte im 3D-Modellraum stets den vollständigen 3D-Punkt inkl. Ebenen-Offset und konvertiere ihn mit `sketch.modelToSketchSpace(...)` in den lokalen Skizzenraum:**
  ```typescript
  const center3D = adsk.core.Point3D.create(holeOffsetCm, 0, holeHeightCm);
  const centerPoint = sketch.modelToSketchSpace(center3D);
  sketch.sketchCurves.sketchCircles.addByCenterRadius(centerPoint, radiusCm);
  ```
- **Niemals globale 3D-Richtungsvektoren direkt auf 2D-Skizzenpunkte aufaddieren:** Berechne stets Start- und Endpunkte zuerst im 3D-Weltraum und transformiere beide Punkte separat via `sketch.modelToSketchSpace`.

### 4.5 Gezielte Körperbearbeitung (`participantBodies` bei Schnitten)
- Unendliche Schnittebenen (`SplitBody` mit `isSplittingToolExtended = true`) können unbeabsichtigt benachbarte Körper durchschneiden.
- Für das gezielte Schneiden/Ausklinken einzelner Körper empfiehlt sich ein begrenzter Schnitt (`extrudeFeatures.createInput` mit `CutFeatureOperation`) und die explizite Einschränkung auf den Zielkörper:
  ```typescript
  extrudeInput.participantBodies = [getLiveBody(rootComp, targetBody)];
  ```

### 4.6 Schalen-Features & Flächenselektion (`ShellFeatures` & `SurfaceTypes`)
- Zur Identifikation ebener Schnittflächen (Planar Faces) nach Schnitten: Nutze das typisierte Enum `face.geometry.surfaceType === adsk.core.SurfaceTypes.PlaneSurfaceType`.
- Zur Erzeugung offener Schalen mit definierter Wandstärke wird die ebene Schnittfläche als Öffnung an `shellInput.inputEntities` übergeben und `shellInput.insideThickness` (bzw. `outsideThickness`) gesetzt:
  ```typescript
  const inputEntities = adsk.core.ObjectCollection.create();
  inputEntities.add(planarFace);
  const shellInput = shellFeatures.createInput(inputEntities, false);
  shellInput.insideThickness = adsk.core.ValueInput.createByString('shell_thickness');
  shellFeatures.add(shellInput);
  ```

### 4.7 Universelle 3D-Kugelerzeugung
- Erzeuge Kugeln an beliebigen 3D-Zentren $(x, y, z)$ über eine definierte Versatzebene (z. B. parallel zur XZ-Ebene bei $Y = \text{center.y}$).
- Konvertiere stets alle 3D-Punkte (Zentrum, oberer/unterer Pol) über `sketch.modelToSketchSpace(...)` in den lokalen Skizzenraum:
  ```typescript
  const centerSketch = sketch.modelToSketchSpace(center3D);
  const pBottomSketch = sketch.modelToSketchSpace(adsk.core.Point3D.create(center3D.x, center3D.y, center3D.z - radiusCm));
  const pTopSketch = sketch.modelToSketchSpace(adsk.core.Point3D.create(center3D.x, center3D.y, center3D.z + radiusCm));
  sketch.sketchCurves.sketchCircles.addByCenterRadius(centerSketch, radiusCm);
  const axisLine = sketch.sketchCurves.sketchLines.addByTwoPoints(pBottomSketch, pTopSketch);
  ```

### 4.8 Profil- und BRep-Selektion
- **Ringprofile bei Hohlkörpern:** Wenn eine Skizze zwei konzentrische Kreise enthält, wähle das Profil mit `prof.profileLoops.count === 2` oder das Profil mit der größeren Fläche:
  ```typescript
  let pipeProfile: adsk.fusion.Profile | null = null;
  for (let i = 0; i < sketch.profiles.count; i++) {
    const prof = sketch.profiles.item(i);
    if (prof && prof.profileLoops.count === 2) {
      pipeProfile = prof;
      break;
    }
  }
  ```
- **Toleranzbasierte BRep-Selektion:** Vergleiche bei der Identifikation von BRep-Kanten (`BRepEdge`) oder Flächen (`BRepFace`) Radien und Positionen stets mit Toleranzen (`const TOL = 0.05; // 0.5 mm in cm`), niemals mit strikter Gleichheit (`===`).

### 4.9 Modellierte Gewinde & FDM-3D-Druck-Passungen
- **Gewindeerzeugung (`ThreadFeatures`):**
  - Nutze für gedruckte Gewinde stets `threadInput.isModeled = true` und `threadInput.isFullLength = true`.
  - Beispiel für metrisches ISO-Gewinde:
    ```typescript
    const threadInfo = threadFeatures.createThreadInfo(true, "ISO Metric Profile", "M40x2.5", "6H");
    const threadInput = threadFeatures.createInput(targetFace, threadInfo);
    threadInput.isModeled = true;
    ```
- **Gewindespiel via `OffsetFacesFeatures`:**
  - Im FDM-3D-Druck (z.B. Bambu Lab P2S) führen modellierte Gewinde ohne Spiel zu Schwergängigkeit.
  - Wende auf die resultierenden Gewindeflächen (`threadFeature.faces`) ein Offset-Faces-Feature mit negativem Spiel an (z. B. `thread_clearance = '-0.2mm'`):
    ```typescript
    const offsetFeatures = rootComp.features.offsetFacesFeatures;
    const offsetInput = offsetFeatures.createInput(facesToOffset, adsk.core.ValueInput.createByString(clearanceStr));
    if (offsetInput) offsetFeatures.add(offsetInput);
    ```

### 4.10 Robuste Kantenverrundung mit mehrstufigem Fallback (`applyFilletWithFallbacks`)
- Kantenverrundungen scheitern im BRep-Kernel häufig, wenn Kantenketten nicht eindeutig auflösbar sind. Verwende stets das standardisierte 4-Stufen-Fallback-System:
  1. **Stufe A:** Mit Parameternamen (`createByString`) und Tangentenkette (`isTangentChain = true`).
  2. **Stufe B:** Mit direktem Zahlenwert (`createByReal`) und Tangentenkette.
  3. **Stufe C:** Mit direktem Zahlenwert ohne Tangentenkette (`isTangentChain = false`).
  4. **Stufe D:** Iterative Einzelkanten-Abrundung.
- Setze stets `input.isRollingBallCorner = false` und `setInput.continuity = adsk.fusion.SurfaceContinuityTypes.TangentSurfaceContinuityType`.

### 4.11 FDM-optimierte Kabelkanäle & interne Hohlräume (Stützfreier 3D-Druck)
- **Problem bei horizontalen runden Bohrungen:** Bei liegend gedruckten Bauteilen (z. B. auf der XY-Druckplatte) führt die obere Decke einer horizontalen runden Bohrung zu steilen Überhängen (> 45°) und unsauberen Filament-Brücken.
- **Dreieckiges Dachprofil (Giebelquerschnitt):**
  - Querschnitt in der vertikalen Schnittebene (XZ bzw. YZ) als Dreieck konstruieren:
    - Horizontale Basis unten (schließt eben an darunterliegende Schichten an)
    - Nach oben in $+Z$ spitz zulaufendes Dach mit $\ge 45^\circ$-Winkel zum Zenit.
  - Dadurch baut jede Druckschicht stufenlos auf der vorherigen auf: **100 % stützfreier Druck ohne Bridging auf FDM-Druckern (Bambu Lab P2S, PLA)**.

### 4.12 3D-Transformationen (`MoveFeatures`, `Matrix3D`)
- Führe Drehungen und Verschiebungen mathematisch exakt über `adsk.core.Matrix3D` und `adsk.core.Vector3D` durch:
  ```typescript
  const transform = adsk.core.Matrix3D.create();
  const centerPoint = adsk.core.Point3D.create(0, 0, totalHeightCm / 2.0);
  const axisVector = adsk.core.Vector3D.create(1, 0, 0); // X-Achse
  transform.setToRotation(Math.PI, axisVector, centerPoint); // 180° Drehung
  
  const moveInput = moveFeatures.createInput2(bodyColl);
  moveInput.defineAsFreeMove(transform);
  moveFeatures.add(moveInput);
  ```

---

## 5. Standard-Hilfsfunktionen (`Helper Utilities`)

Verwende in jedem Skript die bewährten Hilfsfunktionen:
```typescript
/** Erzeugt eine Fusion 360 ObjectCollection aus Elementen oder Arrays */
function createCollection<T extends adsk.core.Base>(...items: (T | T[] | null | undefined)[]): adsk.core.ObjectCollection {
  const collection = adsk.core.ObjectCollection.create();
  for (const item of items) {
    if (!item) continue;
    if (Array.isArray(item)) {
      for (const subItem of item) {
        if (subItem) collection.add(subItem);
      }
    } else {
      collection.add(item);
    }
  }
  return collection;
}

/** Ermittelt den aktuellen Live-BRepBody aus rootComp.bRepBodies */
function getLiveBody(rootComp: adsk.fusion.Component, fallbackBody: adsk.fusion.BRepBody): adsk.fusion.BRepBody {
  if (rootComp.bRepBodies.count > 0) {
    for (let i = 0; i < rootComp.bRepBodies.count; i++) {
      const b = rootComp.bRepBodies.item(i);
      if (b && (b === fallbackBody || b.name === fallbackBody.name)) {
        return b;
      }
    }
    const firstBody = rootComp.bRepBodies.item(0);
    if (firstBody) return firstBody;
  }
  return fallbackBody;
}

/** Wendet eine Verrundung mit 4-Stufen-Fallback-System auf eine Kantengruppe an */
function applyFilletWithFallbacks(
  rootComp: adsk.fusion.Component,
  edges: adsk.fusion.BRepEdge[],
  radiusCm: number,
  paramName?: string,
  logPrefix: string = 'Fillet'
): boolean {
  if (edges.length === 0) {
    console.warn(`${logPrefix}: Keine Kanten für Verrundung übergeben.`);
    return false;
  }

  const filletFeatures = rootComp.features.filletFeatures;

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
      console.warn(`${logPrefix}: Stufe A (mit Parameter ${paramName}) fehlgeschlagen: ${e}`);
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
        const coll = createCollection([edge]);
        const setInput = input.edgeSetInputs.addConstantRadiusEdgeSet(coll, adsk.core.ValueInput.createByReal(radiusCm), false);
        if (setInput) setInput.continuity = adsk.fusion.SurfaceContinuityTypes.TangentSurfaceContinuityType;
        const feat = filletFeatures.add(input);
        if (feat) successCount++;
      }
    } catch (_e) { }
  }

  return successCount > 0;
}
```

---

## 6. Workflow & Verifikation

- **TypeScript-Kompilierung prüfen:** Führe nach Änderungen stets die Typprüfung im Projekt-Root aus:
  ```bash
  npm run typecheck
  ```
- **Alte Artefakte bereinigen:** Falls temporäre `.js`-Kompilate in `fusion/scripts/` oder `fusion/model/` liegen, entferne diese mit:
  ```bash
  npm run clean
  ```
- **Logische Verifikation:** Stelle sicher, dass Maße, Vorzeichen (z. B. Schnittrichtungen bei Extrusionen) und Toleranzen plausibel und konsistent zu den CAD-Spezifikationen sind.
