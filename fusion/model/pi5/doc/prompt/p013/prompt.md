# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p013/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Ziel: Material setzen

Mache die Körper Case_Top, Case_Middle, Case_Bottom in ABS weiss
Mache Körper Logo in Kunststoff schwarz

---

## Umsetzung & Spezifikation

### 1. Körper & Materialzuweisung (Physikalisch & Visuelles Erscheinungsbild)

1. **Gehäusekörper (`Case_Top`, `Case_Middle`, `Case_Bottom`):**
   - **Physikalisches Material:** `ABS-Kunststoff` (Dichte & physikalische Eigenschaften für CAD-Gewichts- und Schwerpunktberechnungen).
     - Bibliotheks-Suchkandidaten: `ABS-Kunststoff`, `ABS Plastic`, `ABS`, `Kunststoff`, `Plastic`.
   - **Visuelles Erscheinungsbild (PBR Appearance):** `Kunststoff ABS - weiss`
     - Bibliotheks-Suchkandidaten: `ABS (weiß)`, `ABS (White)`, `Kunststoff - matt (weiß)`, `Plastik - matt (weiß)`, `Plastic - Matte (White)`, `Plastic - Textured - White`, `White`, `Weiß`.
     - **PBR-Fallback (falls Bibliothek nicht geladen):**
       - Typ: `OpaqueAppearanceSurface`
       - Farbe: `RGB(242, 242, 240)` (Klassisches vintage Apple Warmweiß)
       - Rauheit (Roughness): `0.45` (Seidenmatter ABS-Spritzguss-/FDM-Look)
   - **Oberflächen-Bereinigung:** Sämtliche früheren Einzelflächen-Overrides werden bereinigt (`clearFaceOverrides: true`), sodass alle Gehäuseteile einheitlich im warmen ABS-Weiß erstrahlen.

2. **Logo-Körper (`Logo`):**
   - **Physikalisches Material:** `Kunststoff` / `ABS-Kunststoff`.
     - Bibliotheks-Suchkandidaten: `Kunststoff`, `Plastic`, `ABS-Kunststoff`, `ABS Plastic`, `ABS`.
   - **Visuelles Erscheinungsbild (PBR Appearance):** `Kunststoff - matt (schwarz)`
     - Bibliotheks-Suchkandidaten: `Kunststoff - matt (schwarz)`, `Plastik - matt (schwarz)`, `Plastic - Matte (Black)`, `ABS (schwarz)`, `ABS (Black)`, `Plastic - Textured - Black`, `Black`, `Schwarz`.
     - **PBR-Fallback (falls Bibliothek nicht geladen):**
       - Typ: `OpaqueAppearanceSurface`
       - Farbe: `RGB(30, 30, 32)` (Tiefes, edles Mattschwarz)
       - Rauheit (Roughness): `0.5` (Seidenmattes Kunststoff-Finish)
   - **Bereinigung früherer Facetten-Farben:** Die aus p012 stammenden Einzelflächen-Farben (`Logo_Light_Shade`, `Logo_Medium_Shade`, `Logo_Dark_Shade`) werden auf Flächenebene vollständig bereinigt (`clearFaceOverrides: true`), sodass der Körper `Logo` homogen in mattschwarzem Kunststoff erscheint. Die geometrischen Facettenlinien (`splitFaceFeatures`) bleiben als feine Relief- und Lichtkanten im CAD und 3D-Druck erhalten.

3. **Schutz des Raspberry Pi 5 Referenzmodells:**
   - Alle Körper des importierten STEP-Boards (`Pi5_*`, `RASPBERRY_PI_5*` oder Namen mit `pi5`) werden bei der Materialzuweisung strikt übersprungen. Ihre originalen Farben und Texturen (grünes PCB, Metallgehäuse von USB/Ethernet, goldene Kontakte) bleiben vollständig erhalten.

---

### 2. Parameter (`parameters.ts:setupParameters`)

| Parameter | Standardwert | Einheit | Beschreibung |
| :--- | :--- | :--- | :--- |
| `enable_materials` | `'1'` | `''` | Zuweisung von Material und Erscheinungsbild aktivieren (0=Aus, 1=An) |

---

### 3. Implementierungsübersicht & Modul-Architektur (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Änderungen | Status |
| :--- | :--- | :--- |
| **`materials.ts`** (NEU) | Eigenständiges Querschnittsmodul gemäß AGENTS.md §2.3: Bibliotheksabfrage mit 2-Stufen-Suche (exakt, Teilstring), Fallback-PBR-Generierung, Face-Override-Bereinigung und bodiespezifische Zuweisung (`assignBodyMaterials`). | Abgeschlossen |
| **`utils.ts`** | Implementierung der Funktion `hideSketchesAndConstruction(rootComp)` zum sauberen Ausschalten der Sichtbarkeit aller Skizzen, Konstruktionsebenen/-achsen/-punkte und der übergeordneten Ordner-Glühbirnen im Fusion 360 Modellbaum. | Abgeschlossen |
| **`parameters.ts`** | Definition des Parameters `enable_materials` im strikten `snake_case` und einheitenlos (`unit: ''`). | Abgeschlossen |
| **`case.ts`** | Orchestrierung in `run()`: Schritt 26 Materialzuweisung (`assignBodyMaterials`) und Schritt 27 sauberes Ausblenden aller Hilfsgeometrien via `hideSketchesAndConstruction`. | Abgeschlossen |
| **`prompt.md`** (p013) | Vollständige Spezifikation und Dokumentation von Material- und Farbvorgaben, Parametern, Sichtbarkeitsbereinigung und Architektur. | Abgeschlossen |
