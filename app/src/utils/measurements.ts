export type MeasurementKind = 'count' | 'volume' | 'weight' | 'unknown';

type UnitInfo =
  | {
      kind: 'count';
      canonicalUnit: '' | 'each';
      prettyUnit: '' | 'each';
      baseUnit: 'each';
      toBaseFactor: 1;
    }
  | {
      kind: 'volume';
      canonicalUnit: 'tsp' | 'tbsp' | 'cup' | 'ml' | 'l' | 'fl oz' | 'pt' | 'qt' | 'gal';
      prettyUnit: 'tsp' | 'tbsp' | 'cup' | 'ml' | 'l';
      baseUnit: 'ml';
      toBaseFactor: number;
    }
  | {
      kind: 'weight';
      canonicalUnit: 'g' | 'kg' | 'oz' | 'lb';
      prettyUnit: 'g' | 'kg' | 'oz' | 'lb';
      baseUnit: 'g';
      toBaseFactor: number;
    }
  | {
      kind: 'unknown';
      canonicalUnit: string;
      prettyUnit: string;
      baseUnit: null;
      toBaseFactor: null;
    };

const UNICODE_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅐': '1/7',
  '⅑': '1/9',
  '⅒': '1/10',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

function parseFractionToken(token: string): number | null {
  const m = token.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!den) return null;
  return num / den;
}

/**
 * Parses quantities like:
 * - "2" -> 2
 * - "1/2" -> 0.5
 * - "2 1/2" -> 2.5
 * - "1½" -> 1.5
 * - "about 1/2" -> 0.5
 * - "1-2" -> 1 (takes the first value of a range)
 */
export function parseQuantityToNumber(input: string | null | undefined): number {
  if (!input) return 0;

  let s = String(input).trim().toLowerCase();
  if (!s) return 0;

  // Normalize unicode fractions (including attached, e.g. "1½" -> "1 1/2")
  for (const [u, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    s = s.replace(new RegExp(`(\\d)${u}`, 'g'), `$1 ${ascii}`);
    s = s.replace(new RegExp(u, 'g'), ascii);
  }

  // Remove common qualifiers
  s = s
    .replace(/[~≈]/g, ' ')
    .replace(/\b(about|approx\.?|approximately|around|roughly)\b/g, ' ');

  // Treat numeric ranges as the first number (e.g. "1-2" -> "1")
  s = s.replace(/(\d+(?:\.\d+)?)(?:\s*[-–]\s*)(\d+(?:\.\d+)?)/g, '$1');

  // Tokenize and sum numeric parts (supports mixed numbers: "2 1/2")
  const tokens = s
    .split(/\s+/g)
    .map(t => t.replace(/[^0-9./]/g, ''))
    .filter(Boolean);

  let total = 0;
  for (const t of tokens) {
    const frac = parseFractionToken(t);
    if (frac !== null) {
      total += frac;
      continue;
    }
    const n = Number.parseFloat(t);
    if (!Number.isNaN(n)) total += n;
  }

  return total;
}

function normalizeUnitString(raw: string | null | undefined): string {
  return (raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');
}

export function getUnitInfo(rawUnit: string | null | undefined): UnitInfo {
  const u = normalizeUnitString(rawUnit);

  if (!u) {
    return {
      kind: 'count',
      canonicalUnit: '',
      prettyUnit: '',
      baseUnit: 'each',
      toBaseFactor: 1,
    };
  }

  // Count-ish
  if (['each', 'ea', 'pc', 'pcs', 'piece', 'pieces'].includes(u)) {
    return {
      kind: 'count',
      canonicalUnit: 'each',
      prettyUnit: 'each',
      baseUnit: 'each',
      toBaseFactor: 1,
    };
  }

  // Volume (base: ml)
  const volumeAliases: Record<
    string,
    { canonical: 'tsp' | 'tbsp' | 'cup' | 'ml' | 'l' | 'fl oz' | 'pt' | 'qt' | 'gal'; toMl: number }
  > = {
    tsp: { canonical: 'tsp', toMl: 4.92892159375 },
    teaspoon: { canonical: 'tsp', toMl: 4.92892159375 },
    teaspoons: { canonical: 'tsp', toMl: 4.92892159375 },
    tbsp: { canonical: 'tbsp', toMl: 14.78676478125 },
    tablespoon: { canonical: 'tbsp', toMl: 14.78676478125 },
    tablespoons: { canonical: 'tbsp', toMl: 14.78676478125 },
    cup: { canonical: 'cup', toMl: 236.5882365 },
    cups: { canonical: 'cup', toMl: 236.5882365 },
    ml: { canonical: 'ml', toMl: 1 },
    milliliter: { canonical: 'ml', toMl: 1 },
    milliliters: { canonical: 'ml', toMl: 1 },
    l: { canonical: 'l', toMl: 1000 },
    liter: { canonical: 'l', toMl: 1000 },
    liters: { canonical: 'l', toMl: 1000 },
    litre: { canonical: 'l', toMl: 1000 },
    litres: { canonical: 'l', toMl: 1000 },
    'fl oz': { canonical: 'fl oz', toMl: 29.5735295625 },
    floz: { canonical: 'fl oz', toMl: 29.5735295625 },
    'fluid ounce': { canonical: 'fl oz', toMl: 29.5735295625 },
    'fluid ounces': { canonical: 'fl oz', toMl: 29.5735295625 },
    pt: { canonical: 'pt', toMl: 473.176473 },
    pint: { canonical: 'pt', toMl: 473.176473 },
    pints: { canonical: 'pt', toMl: 473.176473 },
    qt: { canonical: 'qt', toMl: 946.352946 },
    quart: { canonical: 'qt', toMl: 946.352946 },
    quarts: { canonical: 'qt', toMl: 946.352946 },
    gal: { canonical: 'gal', toMl: 3785.411784 },
    gallon: { canonical: 'gal', toMl: 3785.411784 },
    gallons: { canonical: 'gal', toMl: 3785.411784 },
  };

  const v = volumeAliases[u];
  if (v) {
    return {
      kind: 'volume',
      canonicalUnit: v.canonical,
      prettyUnit: v.canonical === 'l' ? 'l' : v.canonical === 'ml' ? 'ml' : v.canonical === 'tsp' ? 'tsp' : v.canonical === 'tbsp' ? 'tbsp' : 'cup',
      baseUnit: 'ml',
      toBaseFactor: v.toMl,
    };
  }

  // Weight (base: g)
  const weightAliases: Record<string, { canonical: 'g' | 'kg' | 'oz' | 'lb'; toG: number }> = {
    g: { canonical: 'g', toG: 1 },
    gram: { canonical: 'g', toG: 1 },
    grams: { canonical: 'g', toG: 1 },
    kg: { canonical: 'kg', toG: 1000 },
    kilogram: { canonical: 'kg', toG: 1000 },
    kilograms: { canonical: 'kg', toG: 1000 },
    oz: { canonical: 'oz', toG: 28.349523125 },
    ounce: { canonical: 'oz', toG: 28.349523125 },
    ounces: { canonical: 'oz', toG: 28.349523125 },
    lb: { canonical: 'lb', toG: 453.59237 },
    lbs: { canonical: 'lb', toG: 453.59237 },
    pound: { canonical: 'lb', toG: 453.59237 },
    pounds: { canonical: 'lb', toG: 453.59237 },
  };

  const w = weightAliases[u];
  if (w) {
    return {
      kind: 'weight',
      canonicalUnit: w.canonical,
      prettyUnit: w.canonical,
      baseUnit: 'g',
      toBaseFactor: w.toG,
    };
  }

  return {
    kind: 'unknown',
    canonicalUnit: u,
    prettyUnit: rawUnit || u,
    baseUnit: null,
    toBaseFactor: null,
  };
}

function roundForDisplay(n: number): number {
  // keep simple, but avoid 2.999999999 -> 3
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return rounded;
}

export function formatVolumeFromMl(totalMl: number, preferredCanonicalUnits?: Set<string>): { quantity: number; unit: string } {
  const cupMl = 236.5882365;
  const tbspMl = 14.78676478125;
  const tspMl = 4.92892159375;

  const preferred = preferredCanonicalUnits || new Set<string>();
  const preferCup = preferred.has('cup');
  const preferTbsp = preferred.has('tbsp');
  const preferTsp = preferred.has('tsp');
  const preferL = preferred.has('l');
  const preferMl = preferred.has('ml');

  let unit: 'l' | 'ml' | 'cup' | 'tbsp' | 'tsp';
  if (preferL || totalMl >= 1000) unit = 'l';
  else if (preferCup || totalMl >= cupMl / 4) unit = 'cup';
  else if (preferTbsp || totalMl >= tbspMl) unit = 'tbsp';
  else if (preferTsp || totalMl >= tspMl) unit = 'tsp';
  else unit = preferMl ? 'ml' : 'tsp';

  const quantity =
    unit === 'l'
      ? totalMl / 1000
      : unit === 'ml'
        ? totalMl
        : unit === 'cup'
          ? totalMl / cupMl
          : unit === 'tbsp'
            ? totalMl / tbspMl
            : totalMl / tspMl;

  return { quantity: roundForDisplay(quantity), unit };
}

export function formatWeightFromG(totalG: number, preferredCanonicalUnits?: Set<string>): { quantity: number; unit: string } {
  const preferred = preferredCanonicalUnits || new Set<string>();
  const preferLb = preferred.has('lb');
  const preferOz = preferred.has('oz');
  const preferKg = preferred.has('kg');

  let unit: 'kg' | 'g' | 'lb' | 'oz';
  if (preferKg || totalG >= 1000) unit = 'kg';
  else if (preferLb || totalG >= 453.59237) unit = 'lb';
  else if (preferOz || totalG >= 28.349523125) unit = 'oz';
  else unit = 'g';

  const quantity =
    unit === 'kg' ? totalG / 1000 : unit === 'lb' ? totalG / 453.59237 : unit === 'oz' ? totalG / 28.349523125 : totalG;

  return { quantity: roundForDisplay(quantity), unit };
}


