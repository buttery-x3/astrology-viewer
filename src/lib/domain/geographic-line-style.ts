import { ASTRO_ANGLES, type AstroAngle } from './astrocartography';
import { BODY_IDENTITY } from './hover-card-themes';

/** One categorical symbol system for the globe, controls and geographic key. */
export const GEOGRAPHIC_MARKER_VIEWBOX = '0 0 24 24';
export const GEOGRAPHIC_MARKER_REFERENCE = 'M3 12H21M12 3V21';
export const GEOGRAPHIC_MARKER_STROKE = 1.6;
const ring = (x: number, y: number) => `M${x + 3} ${y}a3 3 0 1 0-6 0a3 3 0 1 0 6 0`;
export const GEOGRAPHIC_ANGLE_STYLE: Record<AstroAngle, { short: string; name: string; label: string; path: string }> = {
  ac: { short: 'AC', name: 'Rising', label: 'AC · Rising', path: ring(7, 10) },
  dc: { short: 'DC', name: 'Setting', label: 'DC · Setting', path: ring(17, 14) },
  mc: { short: 'MC', name: 'Upper meridian', label: 'MC · Upper meridian', path: ring(12, 6) },
  ic: { short: 'IC', name: 'Lower meridian', label: 'IC · Lower meridian', path: ring(12, 18) },
};
export const GEOGRAPHIC_ANGLE_KEY = ASTRO_ANGLES.map(angle => ({ angle, ...GEOGRAPHIC_ANGLE_STYLE[angle] }));
export const GEOGRAPHIC_BODY_STYLE = BODY_IDENTITY;
export const GEOGRAPHIC_IDENTITY_NOTE = 'Colour identifies the body; the marker identifies the angle. All four line types have equal visual weight.';
export const GEOGRAPHIC_LINE_WIDTH = 1.1;
/** Five stable anchors over each existing semicircle; avoid pole/tangent ends. */
export const GEOGRAPHIC_MARKER_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;
