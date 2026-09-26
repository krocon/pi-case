import { adsk } from "@adsk/fusion";
import { isAssemblyConstruction } from "./utils";

/**
 * Initialisiert oder liest alle benutzerdefinierten Parameter für das Raspberry Pi 5 Gehäuse.
 * Alle Parameternamen folgen strikt snake_case ohne Bindestriche (AGENTS.md §3.2).
 */
export function setupParameters(design: adsk.fusion.Design) {
  const params = design.userParameters;

  function getOrCreateParam(
    name: string,
    valueStr: string,
    unit: string,
    description: string,
    isFavorite: boolean = false
  ): adsk.fusion.UserParameter {
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
    if (isFavorite) {
      try {
        p.isFavorite = true;
      } catch (e) {
        console.warn(`Konnte isFavorite für '${name}' nicht setzen: ${e}`);
      }
    }
    return p;
  }

  function ensureParamExpression(
    p: adsk.fusion.UserParameter,
    targetExpr: string,
    legacyValues: string[]
  ): adsk.fusion.UserParameter {
    const normCurrent = p.expression.replace(/\s+/g, '');
    const normTarget = targetExpr.replace(/\s+/g, '');
    if (normCurrent !== normTarget) {
      const isLegacy = legacyValues.some(v => v.replace(/\s+/g, '') === normCurrent);
      if (isLegacy) {
        try {
          p.expression = targetExpr;
        } catch (e) {
          console.warn(`Konnte Expression für '${p.name}' nicht auf '${targetExpr}' aktualisieren: ${e}`);
        }
      }
    }
    return p;
  }

  return {
    // Raspberry Pi 5 Platinenmaße & Spiel
    boardWidth: getOrCreateParam('board_width', '85mm', 'mm', 'Breite der Raspberry Pi 5 Platine (X)'),
    boardDepth: getOrCreateParam('board_depth', '56mm', 'mm', 'Tiefe der Raspberry Pi 5 Platine (Y)'),
    boardClearance: getOrCreateParam('board_clearance', '0.2mm', 'mm', 'Umlaufendes Spiel je Seite zwischen Platine und Gehäuseinnenwand'),

    // Schritt 1: Grundabmessungen (Außenmaß = Innenmaß 85.4 x 56.4 mm + 2 * Wandstärke 3 mm + 1 mm Zuschlag rechte Wand)
    caseRightWallExtraThickness: getOrCreateParam(
      'case_right_wall_extra_thickness',
      '1mm',
      'mm',
      'Zusätzliche Wandstärke für die rechte Gehäusewand (+X, Port-Wand, p024)'
    ),
    caseWidth: (() => {
      const p = getOrCreateParam(
        'case_width',
        '91.4mm + case_right_wall_extra_thickness',
        'mm',
        'Gesamtbreite des Gehäuses (X) inklusive Wandstärken-Zuschlag'
      );
      return ensureParamExpression(p, '91.4mm + case_right_wall_extra_thickness', [
        '91.4mm',
        '91.40mm',
        '92.4mm',
        '92.40mm'
      ]);
    })(),
    caseDepth: getOrCreateParam('case_depth', '62.4mm', 'mm', 'Tiefe des Gehäuses (Y)'),

    // Gehäusehöhe & Höhenanpassung für Case_Middle (p014 / p015: Favorit)
    caseMiddleHeightOffset: (() => {
      const p = getOrCreateParam(
        'case_middle_height_offset',
        '-7mm',
        'mm',
        'Höhenabweichung für Gehäusehöhe Case_Middle (in mm, positiv zum Erhöhen, negativ zum Verkleinern)',
        true
      );
      return ensureParamExpression(p, '-7mm', ['-4mm', '-4.0mm', '-4.00mm']);
    })(),

    // Schritt 20 / p025: Zusammenführung von Deckel und Mittelteil zu einem Körper (Case_Main, Favorit)
    mergeTopAndMiddle: getOrCreateParam(
      'merge_top_and_middle',
      '1',
      '',
      'Verschmilzt Deckel und Mittelteil zu einem Körper Case_Main ohne Fuge/Sims (0=Aus, 1=Ein, p025)',
      true
    ),

    // Schritt 2 & 3: Extrusionen
    caseTopHeight: (() => {
      const p = getOrCreateParam(
        'case_top_height',
        '40mm + case_middle_height_offset',
        'mm',
        'Höhe des oberen Gehäuseteils (+Z) inklusive Höhenabweichung'
      );
      return ensureParamExpression(p, '40mm + case_middle_height_offset', ['40mm', '40.0mm']);
    })(),
    caseBottomHeight: (() => {
      const p = getOrCreateParam(
        'case_bottom_height',
        '6.4mm',
        'mm',
        'Höhe des unteren Gehäuseteils (-Z)'
      );
      return ensureParamExpression(p, '6.4mm', ['10.4mm', '10.40mm']);
    })(),

    // Schritt 4 & 5: Schalenstärke
    shellThickness: getOrCreateParam('shell_thickness', '3mm', 'mm', 'Wandstärke der Gehäuseschalen'),

    // Schritt 6 & 7: Kantenverrundungen
    cornerFilletRadius: getOrCreateParam('corner_fillet_radius', '1.5mm', 'mm', 'Verrundungsradius der 8 Außenkanten je Körper'),

    // Schritt 7b / p027: Kanten auf der inneren Grundfläche von Case_Bottom
    caseBottomInnerFilletRadius: getOrCreateParam(
      'case_bottom_inner_fillet_radius',
      '1mm',
      'mm',
      'Verrundungsradius der Kanten auf der inneren Grundfläche von Case_Bottom (parallel zur XY-Ebene für FDM-Druck)'
    ),

    // Schritt 8: Versatzebene für Fuge
    groovePlaneOffset: getOrCreateParam('groove_plane_offset', '-8mm', 'mm', 'Versatz der Hilfsebene von der Deckelfläche'),

    // Schritte 10–12: Fugen-Rechtecke (Basisrechteck = Außenmaße, mit 1.5 mm Versatz nach innen)
    grooveBaseWidth: (() => {
      const p = getOrCreateParam(
        'groove_base_width',
        'case_width',
        'mm',
        'Breite des Basis-Fugen-Rechtecks (X)'
      );
      return ensureParamExpression(p, 'case_width', [
        '91.4mm',
        '91.40mm',
        '92.4mm',
        '92.40mm'
      ]);
    })(),
    grooveBaseDepth: getOrCreateParam('groove_base_depth', '62.4mm', 'mm', 'Tiefe des Basis-Fugen-Rechtecks (Y)'),
    grooveInset: getOrCreateParam('groove_inset', '1.5mm', 'mm', 'Versatz nach innen für die Fuge'),

    // Schritt 13: Ausschneiden der Fuge
    grooveCutDepth: getOrCreateParam('groove_cut_depth', '-2.5mm', 'mm', 'Schnitttiefe der Fuge nach unten'),

    // Schritt 14: Verrundung der senkrechten Fugen-Kanten
    grooveFilletRadius: getOrCreateParam('groove_fillet_radius', '1mm', 'mm', 'Verrundungsradius der senkrechten Fugen-Innenkanten'),

    // Raspberry Pi 5 Platzierung & Z-Offset
    pi5ZOffset: getOrCreateParam('pi5_z_offset', '0mm', 'mm', 'Vertikaler Versatz der Pi5-Platine (Z-Höhe der PCB-Oberseite)'),
    pi5XOffset: getOrCreateParam('pi5_x_offset', '0mm', 'mm', 'Horizontaler Versatz der Pi5 in X-Richtung'),
    pi5YOffset: getOrCreateParam('pi5_y_offset', '0mm', 'mm', 'Horizontaler Versatz der Pi5 in Y-Richtung'),

    // Ausschnittsabmessungen der Gehäuseöffnungen
    portUsbcWidth: getOrCreateParam('port_usbc_width', '11.5mm', 'mm', 'Breite des USB-C-Ausschnitts'),
    portUsbcHeight: getOrCreateParam('port_usbc_height', '4.5mm', 'mm', 'Höhe des USB-C-Ausschnitts (ab Platinenoberseite)'),

    portHdmiWidth: getOrCreateParam('port_hdmi_width', '8mm', 'mm', 'Breite der Micro-HDMI-Ausschnitte'),
    portHdmiHeight: getOrCreateParam('port_hdmi_height', '4.5mm', 'mm', 'Höhe der Micro-HDMI-Ausschnitte (ab Platinenoberseite)'),

    portEthWidth: getOrCreateParam('port_eth_width', '16.5mm', 'mm', 'Breite des Ethernet-Ausschnitts (RJ45)'),
    portEthHeight: getOrCreateParam('port_eth_height', '14.5mm', 'mm', 'Höhe des Ethernet-Ausschnitts (RJ45)'),

    portUsb3Width: getOrCreateParam('port_usb3_width', '15mm', 'mm', 'Breite des Dual-USB-3.0-Ausschnitts'),
    portUsb3Height: getOrCreateParam('port_usb3_height', '16.5mm', 'mm', 'Höhe des Dual-USB-3.0-Ausschnitts'),

    // Schritt 15 / p018: Geekworm X1001 M.2 NVMe SSD HAT Kompatibilität & verrundete Port-Ausschnitte
    portEthUsb3Merged: getOrCreateParam(
      'port_eth_usb3_merged',
      '1',
      '',
      'Kombinierter Ausschnitt für Ethernet und USB 3.0 ohne Zwischensteg für SSD-Halterung (1 = aktiv, 0 = getrennt)'
    ),
    portCornerRadius: getOrCreateParam(
      'port_corner_radius',
      '1.5mm',
      'mm',
      'Eckenverrundungsradius für die oberen Kanten der Gehäuseöffnungen'
    ),
    ssdPocketHeight: getOrCreateParam(
      'ssd_pocket_height',
      '24mm',
      'mm',
      'Höhe der innenliegenden Aussparung für die SSD-Halterung ab Z=0'
    ),
    ssdPocketDepth: getOrCreateParam(
      'ssd_pocket_depth',
      '2.5mm',
      'mm',
      'Schnitttiefe der innenliegenden SSD-Aussparung nach außen in die Gehäusewand'
    ),
    ssdPocketCornerRadius: getOrCreateParam(
      'ssd_pocket_corner_radius',
      '3mm',
      'mm',
      'Eckenverrundungsradius der oberen Ecken der innenliegenden SSD-Aussparung'
    ),

    portUsb2Width: getOrCreateParam('port_usb2_width', '15mm', 'mm', 'Breite des Dual-USB-2.0-Ausschnitts'),
    portUsb2Height: getOrCreateParam('port_usb2_height', '16.5mm', 'mm', 'Höhe des Dual-USB-2.0-Ausschnitts'),

    portPwrBtnWidth: getOrCreateParam('port_pwr_btn_width', '5mm', 'mm', 'Breite der Power-Button-Öffnung'),
    portPwrBtnHeight: getOrCreateParam('port_pwr_btn_height', '4mm', 'mm', 'Höhe der Power-Button-Öffnung'),

    // Schritt 16 / p003: Vertiefung an der Gehäusefront für die Front-Anschlüsse
    frontRecessOffset: getOrCreateParam('front_recess_offset', '4mm', 'mm', 'Versatz der Front-Vertiefung um die Anschlüsse'),
    frontRecessCornerRadius: getOrCreateParam('front_recess_corner_radius', '3mm', 'mm', 'Eckenverrundungsradius der Front-Vertiefung'),
    frontRecessDepth: getOrCreateParam('front_recess_depth', '1.5mm', 'mm', 'Tiefe der Front-Vertiefung nach innen'),

    // Schritt 17 / p004 / p023: Lüftungsschlitze im Deckel (6 gleichverteilte Schlitze)
    lidVentSlotLength: getOrCreateParam('lid_vent_slot_length', '80mm', 'mm', 'Länge der Lüftungsschlitze im Deckel (X)'),
    lidVentSlotWidth: getOrCreateParam('lid_vent_slot_width', '2.5mm', 'mm', 'Breite der Lüftungsschlitze im Deckel (Y)'),
    lidVentSlotCount: (() => {
      const p = getOrCreateParam('lid_vent_slot_count', '6', '', 'Gesamtzahl der gleichverteilten Lüftungsschlitze im Deckel (Case_Top)');
      return ensureParamExpression(p, '6', ['7', '7.0']);
    })(),
    lidVentPatternCount: (() => {
      const p = getOrCreateParam('lid_vent_pattern_count', '3', '', 'Anzahl der Lüftungsschlitze je Richtung (3 je Richtung = 6 Schlitze gesamt)');
      return ensureParamExpression(p, '3', ['4', '4.0']);
    })(),
    lidVentPatternDistance: getOrCreateParam('lid_vent_pattern_distance', '22mm', 'mm', 'Gesamtabstand der Lüftungsschlitze vom Zentrum'),
    lidVentCutDepth: getOrCreateParam('lid_vent_cut_depth', '-4mm', 'mm', 'Schnitttiefe der Lüftungsschlitze nach innen'),
    lidVentTaperAngle: getOrCreateParam('lid_vent_taper_angle', '25 deg', 'deg', 'Verjüngungswinkel der Lüftungsschlitze'),

    // Schritt 18 / p005 / p017: 4 Befestigungssäulen (Standoffs) mit M2.5-Innengewinde auf Gehäuseboden-Innenseite
    standoffOuterDiameter: getOrCreateParam('standoff_outer_diameter', '6mm', 'mm', 'Außendurchmesser der Befestigungssäulen'),
    standoffHeight: (() => {
      const p = getOrCreateParam(
        'standoff_height',
        '1.5mm',
        'mm',
        'Höhe der Befestigungssäulen über dem Innenboden (um 1mm gekürzt auf 1.5mm für perfekte Port-Fluchtung)'
      );
      return ensureParamExpression(p, '1.5mm', ['2.5mm', '2.50mm', '6.5mm', '6.50mm', '5mm', '5.0mm']);
    })(),
    standoffFloorDepth: (() => {
      const p = getOrCreateParam(
        'standoff_floor_depth',
        '2mm',
        'mm',
        'Zusätzliche Bohrungs- und Gewindetiefe der Standoffs in den Gehäuseboden hinein'
      );
      return ensureParamExpression(p, '2mm', ['0mm', '0.0mm']);
    })(),
    standoffHoleDiameter: getOrCreateParam('standoff_hole_diameter', '2.05mm', 'mm', 'Kernlochdurchmesser für M2.5-Innengewinde in den Säulen (ISO Tap Drill)'),
    standoffSpacingX: getOrCreateParam('standoff_spacing_x', '58mm', 'mm', 'Lochabstand der Befestigungssäulen in X-Richtung'),
    standoffSpacingY: getOrCreateParam('standoff_spacing_y', '49mm', 'mm', 'Lochabstand der Befestigungssäulen in Y-Richtung'),
    standoffThreadClearance: getOrCreateParam('standoff_thread_clearance', '-0.05mm', 'mm', 'Passungsspiel (Offset Faces) für modelliertes M2.5-Gewinde im FDM-Druck'),


    // Schritt 19 / p006 / p019: Stufenfalz-Steckverbindung zwischen Case_Bottom und Case_Middle (analog Case_Middle/Case_Top)
    jointDepth: (() => {
      const p = getOrCreateParam(
        'joint_depth',
        '5mm',
        'mm',
        'Eintauchtiefe des Stufenfalzes zwischen Case_Bottom und Case_Middle'
      );
      return ensureParamExpression(p, '5mm', ['1.6mm', '1.60mm', '2mm', '2.0mm']);
    })(),
    jointChamfer: (() => {
      const p = getOrCreateParam(
        'joint_chamfer',
        '0.5mm',
        'mm',
        'Mini-Fase an der äußeren Oberkante des Steckkragens von Case_Bottom'
      );
      return ensureParamExpression(p, '0.5mm', ['0.05mm', '0.050mm']);
    })(),
    jointTongueWidth: getOrCreateParam('joint_tongue_width', '1.5mm', 'mm', 'Nenndicke des Steckkragens auf Case_Bottom (halbe Wandstärke)'),
    jointTongueHeight: (() => {
      const p = getOrCreateParam('joint_tongue_height', '5mm', 'mm', 'Höhe des Steckkragens über Trennebene Z=0');
      return ensureParamExpression(p, '5mm', ['1.6mm', '1.60mm']);
    })(),
    jointGrooveWidth: getOrCreateParam('joint_groove_width', '1.5mm', 'mm', 'Breite des Stufenausschnitts in Case_Middle'),
    jointGrooveDepth: (() => {
      const p = getOrCreateParam('joint_groove_depth', '5.3mm', 'mm', 'Tiefe des Stufenausschnitts in Case_Middle inkl. Kopfspiel');
      return ensureParamExpression(p, '5.3mm', ['2mm', '2.0mm', '5mm', '5.0mm']);
    })(),
    jointClearance: (() => {
      const p = getOrCreateParam('joint_clearance', '0.15mm', 'mm', 'Horizontales Passungsspiel je Seite zwischen Steckkragen und Stufe');
      return ensureParamExpression(p, '0.15mm', ['0.2mm', '0.20mm']);
    })(),
    jointVerticalClearance: (() => {
      const p = getOrCreateParam('joint_vertical_clearance', '0.3mm', 'mm', 'Vertikales Kopfspiel des Steckkragens in der Stufe');
      return ensureParamExpression(p, '0.3mm', ['0.4mm', '0.40mm']);
    })(),
    jointGrooveChamfer: getOrCreateParam('joint_groove_chamfer', '0.5mm', 'mm', 'Mini-Fase an der Oberkante des Steckkragens bei Z=5mm'),
    jointSnapLength: (() => {
      const p = getOrCreateParam(
        'joint_snap_length',
        '18mm',
        'mm',
        'Länge der 4 Rastnasen (2x Rückwand ecknah, 1x linke Wand, 1x Frontwand rechts)'
      );
      return ensureParamExpression(p, '18mm', ['20mm', '20.0mm']);
    })(),
    jointSnapDepth: getOrCreateParam('joint_snap_depth', '0.25mm', 'mm', 'Auskragung der 4 Rastnasen (in X- bzw. Y-Richtung)'),
    jointSnapHeight: getOrCreateParam('joint_snap_height', '0.5mm', 'mm', 'Höhe der 4 Rastnasen in Z-Richtung'),
    jointSnapLeftYOffset: getOrCreateParam(
      'joint_snap_left_y_offset',
      '5mm',
      'mm',
      'Y-Position des Zentrums der hinteren linken Seitenwand-Rastnase (nach links / +Y verschoben für Power-Button-Freigang, p028)'
    ),
    jointSnapFrontLeftYOffset: getOrCreateParam(
      'joint_snap_front_left_y_offset',
      '-20.5mm',
      'mm',
      'Y-Position des Zentrums der zusätzlichen vorderen Rastnase auf der linken Seitenwand (vor dem Power-Button)'
    ),
    jointSnapFrontLeftLength: getOrCreateParam(
      'joint_snap_front_left_length',
      '11mm',
      'mm',
      'Länge der zusätzlichen vorderen Rastnase auf der linken Seitenwand'
    ),

    // Schritt 20 / p007 / p014: Horizontale Trennung von Case_Top am unteren Fugenende & Stufenfalz
    lidSplitZ: (() => {
      const p = getOrCreateParam(
        'lid_split_z',
        '29.5mm + case_middle_height_offset',
        'mm',
        'Z-Höhe der Trennebene am unteren Ende der Einkerbung inklusive Höhenabweichung'
      );
      return ensureParamExpression(p, '29.5mm + case_middle_height_offset', ['29.5mm', '29.50mm']);
    })(),
    lidJointDepth: getOrCreateParam('lid_joint_depth', '5mm', 'mm', 'Tiefe des Stufenausschnitts und Verlängerung der dünnen Wand'),
    lidJointChamfer: (() => {
      const p = getOrCreateParam(
        'lid_joint_chamfer',
        '0.5mm',
        'mm',
        'Mini-Fase an der äußeren Kante der dünnen Wand von Case_Top'
      );
      try {
        p.comment = 'Mini-Fase an der äußeren Kante der dünnen Wand von Case_Top';
      } catch (_e) {}
      // Falls in einem bestehenden Dokument noch der alte 0.75mm Wert steht, auf 0.5mm aktualisieren
      const exprNorm = p.expression.replace(/\s+/g, '');
      if (['0.75mm'].includes(exprNorm)) {
        try { p.expression = '0.5mm'; } catch (_e) {}
      }
      return p;
    })(),
    lidJointClearance: getOrCreateParam('lid_joint_clearance', '0.15mm', 'mm', 'Horizontales Passungsspiel je Seite für FDM-3D-Druck'),
    lidJointSnapLength: (() => {
      const p = getOrCreateParam(
        'lid_joint_snap_length',
        '18mm',
        'mm',
        'Länge der 4 Rastnasen zwischen Case_Top und Case_Middle'
      );
      return ensureParamExpression(p, '18mm', ['20mm', '20.0mm']);
    })(),
    lidJointSnapDepth: getOrCreateParam('lid_joint_snap_depth', '0.25mm', 'mm', 'Auskragung der 4 Rastnasen an Case_Top in X- bzw. Y-Richtung'),
    lidJointSnapHeight: getOrCreateParam('lid_joint_snap_height', '0.5mm', 'mm', 'Höhe der 4 Rastnasen an Case_Top in Z-Richtung'),

    // Schritt 20 / p022: 45°-Fase der Auflagefläche an Case_Middle & plane Ecken für stützfreien FDM-Druck
    lidJointShelfChamfer: getOrCreateParam(
      'lid_joint_shelf_chamfer',
      '1.5mm',
      'mm',
      '45°-Fasenbreite der Auflagefläche an Case_Middle zur stützfreien FDM-Druckbarkeit'
    ),
    lidJointCornerFlatLength: getOrCreateParam(
      'lid_joint_corner_flat_length',
      '5mm',
      'mm',
      'Länge der planen Auflagefläche in den 4 Ecken von Case_Middle und Case_Top'
    ),

    // Schritt 21 / p008 / p014: Rechteckige LED-Öffnung und Halterung in der Fugenwand (kurze Seitenwand)
    ledYOffset: getOrCreateParam('led_y_offset', '-16mm', 'mm', 'Position der LED entlang der kurzen linken Seitenwand (Y-Achse)'),
    ledXOffset: getOrCreateParam('led_x_offset', '-45.7mm', 'mm', 'Referenz-Koordinate der LED-Öffnung an der linken Seitenwand'),
    ledZOffset: (() => {
      const p = getOrCreateParam(
        'led_z_offset',
        '30.75mm + case_middle_height_offset',
        'mm',
        'Z-Höhe der LED im Zentrum der horizontalen Fuge inklusive Höhenabweichung'
      );
      return ensureParamExpression(p, '30.75mm + case_middle_height_offset', ['30.75mm', '30.750mm']);
    })(),
    ledOpeningWidth: getOrCreateParam('led_opening_width', '5.2mm', 'mm', 'Breite der rechteckigen Gehäuseöffnung für die LED (entlang Y)'),
    ledOpeningHeight: getOrCreateParam('led_opening_height', '2.2mm', 'mm', 'Höhe der rechteckigen Gehäuseöffnung für die LED (entlang Z)'),
    ledBodyDepth: getOrCreateParam('led_body_depth', '2.5mm', 'mm', 'Tiefe der internen LED-Halterung nach innen ab Gehäuseinnenwand'),
    ledHolderWallThickness: getOrCreateParam('led_holder_wall_thickness', '1.2mm', 'mm', 'Wandstärke der monolithischen Haltehülse'),
    ledPinSlotWidth: getOrCreateParam('led_pin_slot_width', '3.8mm', 'mm', 'Breite des Pin-Durchbruchs für 2.54 mm DuPont-Pins'),
    ledPinSlotHeight: getOrCreateParam('led_pin_slot_height', '1.2mm', 'mm', 'Höhe des Pin-Durchbruchs in der Abschlusswand'),

    // Schritt 21b / p023: Kreisrundes Durchgangsloch in Case_Middle (Ø 1.0 mm, Power-Button)
    // (Hinweis: Die zuvor geplante rechteckige Öffnung wurde wieder entfernt; das kreisrunde Durchgangsloch bleibt bestehen)
    middleHoleDiameter: (() => {
      const existing = params.itemByName('middle_hole_diameter') || params.itemByName('middle_opening_circle_diameter');
      if (existing) return existing;
      return getOrCreateParam(
        'middle_hole_diameter',
        '1mm',
        'mm',
        'Durchmesser des kreisrunden Durchgangslochs in Case_Middle (Power-Button)'
      );
    })(),
    middleHoleYOffset: (() => {
      const existing = params.itemByName('middle_hole_y_offset');
      if (existing) return existing;
      return getOrCreateParam(
        'middle_hole_y_offset',
        '-9.6mm',
        'mm',
        'Y-Position des kreisrunden Durchgangslochs in Case_Middle'
      );
    })(),
    middleHoleZOffset: (() => {
      const existing = params.itemByName('middle_hole_z_offset') || params.itemByName('middle_opening_z_offset');
      const p = existing || getOrCreateParam(
        'middle_hole_z_offset',
        '3.45mm',
        'mm',
        'Z-Höhe des Zentrums der Druckschalter-Lasche in Case_Middle (konstant zu Case_Bottom, p028)'
      );
      if (p.expression.includes('case_middle_height_offset')) {
        try {
          p.expression = '3.45mm';
        } catch (e) {
          console.warn(`Konnte Expression für '${p.name}' nicht auf '3.45mm' aktualisieren: ${e}`);
        }
      }
      return ensureParamExpression(p, '3.45mm', [
        '2.95mm',
        '2.950mm',
        '6.95mm + case_middle_height_offset',
        '6.95mm+case_middle_height_offset',
        '6.950mm + case_middle_height_offset',
        '6.950mm+case_middle_height_offset',
        '6.95mm',
        '6.950mm',
        '-1.05mm',
        '-1.050mm'
      ]);
    })(),
    middleOpeningCircleDiameter: (() => {
      const existing = params.itemByName('middle_hole_diameter') || params.itemByName('middle_opening_circle_diameter');
      if (existing) return existing;
      return getOrCreateParam(
        'middle_hole_diameter',
        '1mm',
        'mm',
        'Durchmesser des kreisrunden Durchgangslochs in Case_Middle (Power-Button)'
      );
    })(),
    middleOpeningZOffset: (() => {
      const existing = params.itemByName('middle_hole_z_offset') || params.itemByName('middle_opening_z_offset');
      const p = existing || getOrCreateParam(
        'middle_hole_z_offset',
        '3.45mm',
        'mm',
        'Z-Höhe des Zentrums der Druckschalter-Lasche in Case_Middle (konstant zu Case_Bottom, p028)'
      );
      if (p.expression.includes('case_middle_height_offset')) {
        try {
          p.expression = '3.45mm';
        } catch (e) {
          console.warn(`Konnte Expression für '${p.name}' nicht auf '3.45mm' aktualisieren: ${e}`);
        }
      }
      return ensureParamExpression(p, '3.45mm', [
        '2.95mm',
        '2.950mm',
        '6.95mm + case_middle_height_offset',
        '6.95mm+case_middle_height_offset',
        '6.950mm + case_middle_height_offset',
        '6.950mm+case_middle_height_offset',
        '6.95mm',
        '6.950mm',
        '-1.05mm',
        '-1.050mm'
      ]);
    })(),

    // Schritt 21b / p028: Integrierter Druckschalter (Lasche) in Case_Middle (Power-Button)
    middleButtonTabLength: (() => {
      const p = getOrCreateParam(
        'middle_button_tab_length',
        '9mm',
        'mm',
        'Länge der geraden Druckschalter-Lasche von Kreiszentrum nach oben (1mm gekürzt, ohne Schnörkel, p028)'
      );
      return ensureParamExpression(p, '9mm', ['10mm', '10.0mm', '10.00mm']);
    })(),
    middleButtonTabWidth: getOrCreateParam(
      'middle_button_tab_width',
      '4mm',
      'mm',
      'Breite der Druckschalter-Lasche (Y) und Kopfdurchmesser (Ø 4mm, p028)'
    ),
    middleButtonNeckLength: getOrCreateParam(
      'middle_button_neck_length',
      '2mm',
      'mm',
      'Höhe des Biegestegs (Hals, Z) der Druckschalter-Lasche (Legacy, p028)'
    ),
    middleButtonNeckWidth: getOrCreateParam(
      'middle_button_neck_width',
      '2mm',
      'mm',
      'Breite des Biegestegs (Hals, Y) der Druckschalter-Lasche (Legacy, p028)'
    ),
    middleButtonNeckFillet: getOrCreateParam(
      'middle_button_neck_fillet',
      '0.5mm',
      'mm',
      'Verrundungsradius an den Übergängen zum Biegesteg (Legacy, p028)'
    ),
    middleButtonCutWidth: getOrCreateParam(
      'middle_button_cut_width',
      '0.3mm',
      'mm',
      'Schnittbreite / Schlitzspalt der Druckschalter-Lasche für FDM-Druck (p028)'
    ),
    collarButtonCutoutFillet: getOrCreateParam(
      'collar_button_cutout_fillet',
      '1.2mm',
      'mm',
      'Verrundungsradius für die Ecken des Kragenausschnitts in Case_Bottom (p028)'
    ),
    middleButtonInnerRecessHeight: (() => {
      const p = getOrCreateParam(
        'middle_button_inner_recess_height',
        '5.5mm',
        'mm',
        'Höhe der innenliegenden Dickenreduzierung der Druckschalter-Lasche oberhalb der Gehäusestufe (p028)'
      );
      return ensureParamExpression(p, '5.5mm', ['6mm', '6.0mm', '6.00mm']);
    })(),
    middleButtonInnerRecessChamfer: getOrCreateParam(
      'middle_button_inner_recess_chamfer',
      '1.5mm',
      'mm',
      'Fasenlänge am oberen Übergang der innenliegenden Dickenreduzierung der Druckschalter-Lasche (p028)'
    ),
    middleButtonBossHeight: getOrCreateParam(
      'middle_button_boss_height',
      '0.2mm',
      'mm',
      'Höhe der kreisrunden Erhebung (Tastkopf) an der Außenseite der Lasche (p028)'
    ),
    middleButtonBossChamfer: getOrCreateParam(
      'middle_button_boss_chamfer',
      '0.2mm',
      'mm',
      'Fasenbreite an der Kreiskante der äußeren Erhebung der Lasche (p028)'
    ),


    // Schritt 22 / p009 / p015: FDM-Druckanordnung (layout_for_print, Favorit)
    layoutForPrint: getOrCreateParam(
      'layout_for_print',
      '0',
      '',
      'Druckanordnung aktivieren: Ordnet alle druckbaren Körper stützoptimiert auf der XY-Ebene entlang der Y-Achse an (0=Aus, 1=An)',
      true
    ),
    printLayoutSpacing: getOrCreateParam(
      'print_layout_spacing',
      '20mm',
      'mm',
      'Abstand zwischen den Bauteilen bei aktivierter Druckanordnung entlang der Y-Achse'
    ),

    // Schritt 23 / p010 / p016: Referenzmodell-Import (import_pi5_board)
    // Default: '1' in einer Baugruppenkonstruktion, '0' in einer Einzelteilkonstruktion.
    // In einem Bauteilkonstruktionsdokument (PartDesignIntentType) sind Komponenten nicht zulässig -> strikt '0'.
    importPi5Board: (() => {
      const isAssembly = isAssemblyConstruction(design);
      const p = getOrCreateParam(
        'import_pi5_board',
        isAssembly ? '1' : '0',
        '',
        'Raspberry Pi 5 STEP-Referenzmodell importieren und auf Standoffs ausrichten (0=Aus, 1=An)'
      );
      // In einem reinen Bauteilkonstruktionsdokument dürfen per Fusion 360 keine Komponenten enthalten sein
      try {
        if (design.designIntent === adsk.fusion.DesignIntentTypes.PartDesignIntentType && p.expression !== '0') {
          p.expression = '0';
        }
      } catch (_e) {}
      return p;
    })(),

    // Schritt 24 / p011: Spannungsreduzierende Fasen & Verrundungen an Innenkanten
    enableStressReliefFillets: getOrCreateParam(
      'enable_stress_relief_fillets',
      '1',
      '',
      'Spannungsreduzierende Fasen und Verrundungen an 90°-Innenkanten aktivieren (0=Aus, 1=An)'
    ),
    stressReliefFilletRadius: getOrCreateParam(
      'stress_relief_fillet_radius',
      '1mm',
      'mm',
      'Radius für spannungsreduzierende Verrundungen an nicht-sichtbaren Innenkanten'
    ),
    lidInnerFilletRadius: getOrCreateParam(
      'lid_inner_fillet_radius',
      '0.5mm',
      'mm',
      'Verrundungsradius für innenliegende Kanten der Lüftungsschlitze und LED-Halterung in Case_Top'
    ),

    // Schritt 23 / p012 / p014 / p015: Logo & Passvertiefung (Mulde) an der linken Seitenwand (Case_Middle, Favorit)
    createLogo: getOrCreateParam(
      'create_logo',
      '0',
      '',
      'Logo und Passvertiefung (Mulde) an der Gehäuseseitenwand konstruieren (0=Aus, 1=An)',
      true
    ),
    logoPosY: (() => {
      const p = getOrCreateParam(
        'logo_pos_y',
        '0mm',
        'mm',
        'Y-Position des Logos und der Logo-Mulde an der linken Seitenwand (symmetrisch zentriert)'
      );
      // Falls in einem bestehenden Dokument noch ein alter Wert steht, auf 0mm aktualisieren (2mm weiter nach rechts/vorne)
      const exprNorm = p.expression.replace(/\s+/g, '');
      if (['22mm', '2mm'].includes(exprNorm)) {
        try { p.expression = '0mm'; } catch (_e) {}
      }
      return p;
    })(),
    logoPosZ: (() => {
      const p = getOrCreateParam(
        'logo_pos_z',
        '14.7mm + case_middle_height_offset / 2',
        'mm',
        'Z-Position des Logos und der Logo-Mulde an der linken Seitenwand über der Trennebene (1mm höher, zentriert auf Case_Middle)'
      );
      return ensureParamExpression(p, '14.7mm + case_middle_height_offset / 2', [
        '7mm',
        '3mm',
        '4.5mm',
        '-1mm',
        '-1.3mm',
        '13.7mm',
        '14.7mm',
        '14.70mm'
      ]);
    })(),
    logoSize: getOrCreateParam(
      'logo_size',
      '8mm',
      'mm',
      'Gesamthöhe des Logos entlang der Z-Achse'
    ),
    logoThickness: getOrCreateParam(
      'logo_thickness',
      '0.5mm',
      'mm',
      'Dicke des Logo-Körpers'
    ),
    logoRecessDepth: getOrCreateParam(
      'logo_recess_depth',
      '0.5mm',
      'mm',
      'Tiefe der Passvertiefung (Logo-Mulde) in der linken Seitenwand von Case_Middle'
    ),
    logoRecessClearance: getOrCreateParam(
      'logo_recess_clearance',
      '0.2mm',
      'mm',
      'Umlaufendes Spiel der Logo-Mulde um die Umrissform des Logos'
    ),

    // Schritt 26 / p013: Zuweisung von Material und Erscheinungsbild
    enableMaterials: getOrCreateParam(
      'enable_materials',
      '1',
      '',
      'Zuweisung von Material und Erscheinungsbild aktivieren (0=Aus, 1=An)'
    ),
  };
}

export type Params = ReturnType<typeof setupParameters>;
