# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p016/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel

wenn 'import_pi5_board' gesetzt war, belasse den Wert wie er ist.
ABER
Wenn das Script in einer Baugruppenkonstuktion augeführt wird, dann soll 'import_pi5_board' als default auf 1 sein.
Wenn das Script nicht in einer Baugruppenkonstuktion augeführt wird, dann soll 'import_pi5_board' als default auf 0 sein.

---

## 1. Spezifikation & Kontext

In Autodesk Fusion 360 besitzen Einzelteil- und Baugruppenkonstruktionen denselben Dokumenttyp (`.f3d`). Für den Anwender ergeben sich jedoch grundlegend unterschiedliche Workflows:

1. **Baugruppenkonstruktion (Assembly Context):**
   - Das Gehäuse wird im Kontext einer übergeordneten Konstruktion (z. B. MarcIntosh, Schaltschrank, Halterung oder Multi-Komponenten-System) aufgerufen.
   - In diesem Kontext ist das physische 3D-Referenzmodell des Raspberry Pi 5 (`RASPBERRY_PI_5_1.STEP`) essenziell, um Schnittstellen, Kabelabgänge, Steckerfluchtungen und Kollisionen mit umgebenden Bauteilen zu überprüfen.
   - **Anforderung:** Standardwert für `import_pi5_board` soll **`1`** (Aktiviert) sein.

2. **Einzelteilkonstruktion (Single-Part / Standalone Context):**
   - Das Gehäuse wird isoliert in einem separaten Dokument erzeugt, vorrangig zur schnellen Modellierung oder für den FDM-3D-Druck (z. B. Bambu Lab P2S).
   - Ein automatischer Import des 24 MB großen STEP-Referenzmodells ist hier standardmäßig nicht erforderlich und würde die Generierungszeit und Dateigröße unnötig belasten.
   - **Anforderung:** Standardwert für `import_pi5_board` soll **`0`** (Deaktiviert) sein.

3. **Schutz bestehender Anwenderwerte (Idempotenz):**
   - War `import_pi5_board` im Konstruktionsdokument bereits als Benutzerparameter angelegt (`design.userParameters.itemByName('import_pi5_board') !== null`), wird der vom Anwender eingestellte Wert unter keinen Umständen überschrieben.

---

## 2. Kriterien zur Baugruppenerkennung in Fusion 360 (`detectAssemblyConstruction`)

Die Hilfsfunktion `detectAssemblyConstruction(design: adsk.fusion.Design): AssemblyDetectionResult` in `utils.ts` ermittelt zuverlässig über 8 komplementäre Kriterien, ob die Ausführung im Baugruppenkontext stattfindet, und liefert den exakten Erkennungsgrund für die Diagnose im Text Commands Fenster:

| Kriterium | Fusion 360 API Eigenschaft | Bedeutung & Erkennungslogik |
| :--- | :--- | :--- |
| **0. Nativer Dokumenttyp** | `design.designIntent === PartDesignIntentType` | **Höchste Priorität:** In einem nativen Bauteilkonstruktionsdokument verbietet Fusion 360 strikt das Anlegen/Importieren von Komponenten (`"Bauteilkonstruktionsdokumente dürfen nur eine Komponente enthalten..."`). Wird sofort als `isAssembly = false` gewertet. Bei `AssemblyDesignIntentType` sofort `isAssembly = true`. |
| **1. Aktive Unterkomponente** | `!design.isRootComponentActive \|\| design.activeComponent !== rootComp \|\| design.activeOccurrence !== null` | Der Anwender hat im Modellbaum eine Unterkomponente oder Occurrence aktiviert, um darin zu konstruieren. Dies kommt ausschließlich in Baugruppen vor. |
| **2. Vorhandene Gelenke** | `rootComp.joints.count > 0 \|\| rootComp.asBuiltJoints.count > 0 \|\| rootComp.rigidGroups.count > 0` | Gelenke (Joints) und starre Gruppen dienen in Fusion 360 ausschließlich der kinematischen Verknüpfung mehrerer Baugruppenkomponenten. |
| **3. Vorhandene Occurrences** | `rootComp.occurrences.count > 0 \|\| rootComp.allOccurrences.count > 0` | In der Konstruktion existieren Occurrences (z. B. `Pi5`, `Pi5_Case`, `MarcIntosh`, `Chassis`, `Display`). Nur wenn die einzige Occurrence exakt das frühere STEP-Referenzmodell ist (`RASPBERRY_PI_5_1`), wird diese ignoriert. |
| **4. Mehrere Komponenten im Design** | `design.allComponents.count > 1` | Das Dokument enthält neben `rootComponent` weitere Komponenten (abzüglich reiner STEP-Importkomponenten). |
| **5. Mehrkörper-Baugruppe (Multi-Body)** | `rootComp.bRepBodies.count > 0` (Fremdkörper-Prüfung) | In `rootComponent` existieren Körper, die nicht zum Pi5-Gehäuse gehören (z. B. `Case_01_Top`, `Case_02_Middle_A`, `Mac_Mini_M1`, `Display_ASUS_ZenScreen_MQ16FC` im MarcIntosh-Projekt). |
| **6. Fremde Benutzerparameter** | `design.userParameters` (Fremdparameter-Prüfung) | Das Design enthält Parameter eines übergeordneten Projekts (z. B. MarcIntosh: `height_top`, `height_foot`, `recess_width`, `split_z`, `mac_mini_width` etc.). |
| **7. Dokument- oder Konstruktionsname** | `design.parentDocument.name \|\| rootComp.name` | Der Name des Dokuments weist auf eine übergeordnete Baugruppe hin (z. B. `MarcIntosh`, `Assembly`, `Baugruppe`, `Chassis`). |

Treffen keine dieser Kriterien zu, liegt eine reine **Einzelteilkonstruktion** vor.

---

## 3. Parameter-Verhalten (`parameters.ts:setupParameters`)

| Zustand bei Skriptausführung | Parameter `import_pi5_board` vorhanden? | Kontext | Gesetzter Wert | Bemerkung |
| :--- | :---: | :--- | :---: | :--- |
| **Bereits vorhanden** | **Ja** | Baugruppenkonstruktion | **Unverändert** | Anwendereinstellung bleibt strikt erhalten |
| **Bereits vorhanden (Wert = 1)** | **Ja** | Bauteilkonstruktionsdokument (`PartDesignIntentType`) | **Korrektur auf `0`** | In einem Bauteildokument erzwingt Fusion 360 `0`, um den blockierenden Fehler *"Bauteilkonstruktionsdokumente dürfen nur eine Komponente enthalten"* abzufangen |
| **Neuinitialisierung** | **Nein** | Baugruppenkonstruktion | **`1`** | STEP-Referenzmodell wird für Passungsprüfung importiert und auf Standoffs ausgerichtet |
| **Neuinitialisierung** | **Nein** | Einzelteilkonstruktion | **`0`** | Schnelle Generierung für 3D-Druck ohne Referenzkörper-Ballast |

---

## 4. Implementierungsübersicht & Modul-Architektur (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Änderungen | Status |
| :--- | :--- | :--- |
| **`utils.ts`** | `detectAssemblyConstruction`: Höchste Priorität für `design.designIntent === PartDesignIntentType` (sofort `false`) bzw. `AssemblyDesignIntentType` (sofort `true`). Multi-Body- und Occurrences-Erkennung. | Abgeschlossen |
| **`parameters.ts`** | Vorgabe von `import_pi5_board` über `isAssemblyConstruction(design) ? '1' : '0'`. Automatische Korrektur auf `'0'` in `PartDesignIntentType`-Dokumenten zur Vermeidung des Fusion 360 Komponentenfehlers. | Abgeschlossen |
| **`pi5Board.ts`** | Zusätzlicher Schutz in `importAndAlignPi5Board`: Bricht den STEP-Import in `PartDesignIntentType`-Dokumenten frühzeitig ab und loggt eine saubere Warnung, falls ein Anwender den Import dennoch erzwingen wollte. | Abgeschlossen |
| **`case.ts`** | Orchestrator-Protokollierung in Schritt 1 gibt den erkannten Kontext (`Baugruppenkonstruktion` vs. `Einzelteilkonstruktion`) zusammen mit dem konkreten Erkennungsgrund (`detection.reason`) transparent im Text Commands Fenster aus. Schritt 24 protokolliert den Zustand vor dem Importaufruf. | Abgeschlossen |
| **`prompt.md`** (p016) | Ausführliche Dokumentation der Spezifikation, Fusion 360 `designIntent`-Handling, Multi-Body- und Baugruppenkriterien, Verhaltenstabelle und Modul-Architektur. | Abgeschlossen |
