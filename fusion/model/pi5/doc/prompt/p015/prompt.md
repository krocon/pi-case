# Erweiterungen

- Arbeite nur an den Dateien `fusion/model/pi5/case/case.ts` und den lokalen imports `fusion/model/pi5/case/*.ts`,
  sowie `fusion/model/pi5/doc/prompt/p015/prompt.md` und evtl. den anderen `fusion/model/pi5/doc/prompt/**/prompt.md`
- Beachte [AGENTS.md](../../../../../../AGENTS.md)

## Frage und Ziel

Bitte setze die wichtigsten Parametern als Favorit.
Wichtige Parameter wären:

* `case_middle_height_offset`
* `create_logo`
* `layout_for_print`

---

## 1. Spezifikation & API-Hintergrund (`isFavorite`)

In Autodesk Fusion 360 können benutzerdefinierte Parameter im Dialog **Parameter ändern** (*Change Parameters*) als Favorit (Sternchen-Symbol ★) markiert werden. Dadurch erscheinen sie prominent ganz oben in der Favoriten-Liste und können vom Anwender sofort ohne langes Suchen in der Parameterhierarchie modifiziert werden.

### Fusion 360 API Eigenschaft `isFavorite`
- In der Fusion 360 TypeScript/C++ API erbt `adsk.fusion.UserParameter` von `adsk.fusion.Parameter`.
- Die Eigenschaft `isFavorite: boolean` (`adsk/fusion/fusion.d.ts:40619`) erlaubt sowohl das lesende Abfragen als auch das schreibende Setzen:
  ```typescript
  // Setzt den Parameter als Favoriten in der Fusion 360 Benutzeroberfläche
  p.isFavorite = true;
  ```
- **Robustheit bei Bestandsmodellen:** Durch die Erweiterung von `getOrCreateParam(name, valueStr, unit, description, isFavorite = false)` in `parameters.ts` wird die Favoriten-Eigenschaft auch dann zuverlässig gesetzt, wenn der Parameter in einem bereits geöffneten Fusion-Dokument schon existiert hat.

---

## 2. Parameter (`parameters.ts:setupParameters`)

| Parameter | Standardwert | Einheit | Favorit | Beschreibung |
| :--- | :--- | :--- | :---: | :--- |
| `case_middle_height_offset` | `'0mm'` | `'mm'` | **Ja (★)** | Höhenabweichung für Gehäusehöhe Case_Middle (in mm, positiv zum Erhöhen, negativ zum Verkleinern) |
| `create_logo` | `'1'` | `''` | **Ja (★)** | Logo und Passvertiefung (Mulde) an der Gehäuseseitenwand konstruieren (0=Aus, 1=An) |
| `layout_for_print` | `'0'` | `''` | **Ja (★)** | Druckanordnung aktivieren: Ordnet alle druckbaren Körper stützoptimiert auf der XY-Ebene entlang der Y-Achse an (0=Aus, 1=An) |

---

## 3. Implementierungsübersicht & Modul-Architektur (AGENTS.md konform)

| Modul / Datei | Zuständigkeit & Änderungen | Status |
| :--- | :--- | :--- |
| **`parameters.ts`** | Erweiterung der internen Hilfsfunktion `getOrCreateParam` um den optionalen Parameter `isFavorite: boolean = false`. Automatische Zuweisung von `p.isFavorite = true` im geschützten `try...catch`-Block. Kennzeichnung der drei Kernparameter `case_middle_height_offset`, `create_logo` und `layout_for_print` als Favoriten. | Abgeschlossen |
| **`case.ts`** | Erweiterung der Orchestrator-Protokollierung in Schritt 1 (`console.log`), um die konfigurierten Favoriten-Parameter transparent im Ausgabefenster aufzuführen. | Abgeschlossen |
| **`prompt.md`** (p015) | Vollständige Dokumentation der Spezifikation, API-Referenz (`Parameter.isFavorite`), Parametertabelle und Architekturmatrix. | Abgeschlossen |
