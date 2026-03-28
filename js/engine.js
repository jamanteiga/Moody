/**
 * MOTOR DE CÁLCULO — FACTOR DE FRICCIÓN Y FLUJO EN TUBERÍAS
 * Correlaciones implementadas:
 *   - Colebrook-White (implícita, iteración)
 *   - Swamee-Jain (explícita, error < 3%)
 *   - Churchill (explícita, válida todo Re)
 *   - Haaland (explícita, error < 2%)
 *   - Laminar: f = 64/Re
 *
 * Referencia: Moody (1944), Colebrook (1939), Swamee & Jain (1976)
 */

// ── CONSTANTES ────────────────────────────────────────────────────────────────
export const G = 9.81;            // m/s²
export const PI = Math.PI;
export const RHO_AGUA = 998.2;    // kg/m³ a 20°C
export const NU_AGUA  = 1.004e-6; // m²/s  a 20°C
export const MU_AGUA  = 1.002e-3; // Pa·s  a 20°C

// ── FACTOR DE FRICCIÓN ────────────────────────────────────────────────────────

/** Colebrook-White implícita — iteración punto fijo (converge en 5-8 iter) */
export function colebrookWhite(Re, eps_D, tol = 1e-10, maxIter = 50) {
  if (Re <= 0) return NaN;
  if (Re < 2300) return 64 / Re;
  // Semilla: Swamee-Jain
  let f = swameeJain(Re, eps_D);
  for (let i = 0; i < maxIter; i++) {
    const rhs = -2 * Math.log10(eps_D / 3.7 + 2.51 / (Re * Math.sqrt(f)));
    const fNew = 1 / (rhs * rhs);
    if (Math.abs(fNew - f) < tol) return fNew;
    f = fNew;
  }
  return f;
}

/** Swamee-Jain — explícita, error < 3% para 1e-6 ≤ ε/D ≤ 0.01, 5000 ≤ Re ≤ 1e8 */
export function swameeJain(Re, eps_D) {
  if (Re < 2300) return 64 / Re;
  const a = eps_D / 3.7;
  const b = 5.74 / Math.pow(Re, 0.9);
  return 0.25 / Math.pow(Math.log10(a + b), 2);
}

/** Haaland — explícita, error < 2% */
export function haaland(Re, eps_D) {
  if (Re < 2300) return 64 / Re;
  const inner = Math.pow(eps_D / 3.7, 1.11) + 6.9 / Re;
  return 1 / Math.pow(-1.8 * Math.log10(inner), 2);
}

/** Churchill (1977) — explícita, válida para todo Re incluyendo transición */
export function churchill(Re, eps_D) {
  if (Re <= 0) return NaN;
  const A = Math.pow(2.457 * Math.log(1 / (Math.pow(7/Re, 0.9) + 0.27*eps_D)), 16);
  const B = Math.pow(37530 / Re, 16);
  return 8 * Math.pow(Math.pow(8/Re, 12) + 1/Math.pow(A+B, 1.5), 1/12);
}

/** Serghides (1984) — explícita, error < 0.003% (casi exacta) */
export function serghides(Re, eps_D) {
  if (Re < 2300) return 64 / Re;
  const A = -2 * Math.log10(eps_D/3.7 + 12/Re);
  const B = -2 * Math.log10(eps_D/3.7 + 2.51*A/Re);
  const C = -2 * Math.log10(eps_D/3.7 + 2.51*B/Re);
  return 1 / Math.pow(A - Math.pow(B-A, 2)/(C-2*B+A), 2);
}

/** Zona de régimen */
export function regime(Re) {
  if (Re < 2300)  return { label: 'Laminar',     color: '#34c759', short: 'LAM' };
  if (Re < 4000)  return { label: 'Transición',  color: '#ff9500', short: 'TRA' };
  return           { label: 'Turbulento',         color: '#007aff', short: 'TUR' };
}

// ── PÉRDIDA DE CARGA ──────────────────────────────────────────────────────────

/** Darcy-Weisbach: hf [m] */
export function headLossDW(f, L, D, v) {
  return f * (L / D) * v * v / (2 * G);
}

/** Velocidad media [m/s] dado Q [m³/s] y D [m] */
export function velocity(Q, D) {
  return Q / (PI * D * D / 4);
}

/** Reynolds dado v, D, nu */
export function reynolds(v, D, nu) {
  return Math.abs(v) * D / nu;
}

/** Q dado v y D */
export function flowRate(v, D) {
  return v * PI * D * D / 4;
}

// ── MATERIALES CON RUGOSIDAD TÍPICA ──────────────────────────────────────────
export const MATERIALS = [
  { name: 'Acero comercial',        eps: 0.000046 },
  { name: 'Acero soldado',          eps: 0.000046 },
  { name: 'Acero galvanizado',      eps: 0.000150 },
  { name: 'Hierro fundido',         eps: 0.000260 },
  { name: 'Hierro fundido (viejo)', eps: 0.001200 },
  { name: 'Hormigón liso',          eps: 0.000300 },
  { name: 'Hormigón rugoso',        eps: 0.003000 },
  { name: 'Cobre / latón (liso)',   eps: 0.0000015 },
  { name: 'PVC / PE (liso)',        eps: 0.0000015 },
  { name: 'Vidrio / plástico liso', eps: 0.0000010 },
  { name: 'Madera cepillada',       eps: 0.000180 },
  { name: 'Goma',                   eps: 0.0000016 },
  { name: 'Personalizado',          eps: null },
];

// ── FLUIDOS ───────────────────────────────────────────────────────────────────
export const FLUIDS = [
  { name: 'Agua  20°C',  rho: 998.2,  nu: 1.004e-6 },
  { name: 'Agua  60°C',  rho: 983.2,  nu: 0.474e-6 },
  { name: 'Agua  80°C',  rho: 971.8,  nu: 0.365e-6 },
  { name: 'Aceite SAE 30', rho: 891, nu: 1.1e-4    },
  { name: 'Glicol 50%',  rho: 1060,   nu: 3.0e-6   },
  { name: 'Aire  20°C',  rho: 1.204,  nu: 1.516e-5  },
  { name: 'Personalizado', rho: null, nu: null       },
];

// ── CÁLCULO COMPLETO DE UN ESTADO ────────────────────────────────────────────
export function calcState({ Re, eps_D, L, D, nu, rho, Q, v }) {
  // Resolución: a partir de Re y eps_D calcular todo
  const f_cw  = colebrookWhite(Re, eps_D);
  const f_sj  = swameeJain(Re, eps_D);
  const f_ha  = haaland(Re, eps_D);
  const f_ch  = churchill(Re, eps_D);
  const f_se  = serghides(Re, eps_D);
  const reg   = regime(Re);

  const vel   = v || (Q ? velocity(Q, D) : Re * nu / D);
  const q     = Q || flowRate(vel, D);
  const hf    = L && D ? headLossDW(f_cw, L, D, vel) : null;
  const dP    = hf && rho ? hf * rho * G : null;

  return {
    Re, eps_D, f_cw, f_sj, f_ha, f_ch, f_se,
    regime: reg, vel, q, hf, dP,
    L, D, nu, rho,
    // Errores relativos vs Colebrook-White
    err_sj: Math.abs(f_sj - f_cw) / f_cw * 100,
    err_ha: Math.abs(f_ha - f_cw) / f_cw * 100,
    err_ch: Math.abs(f_ch - f_cw) / f_cw * 100,
    err_se: Math.abs(f_se - f_cw) / f_cw * 100,
  };
}

// ── LÍNEAS ISO DEL DIAGRAMA ───────────────────────────────────────────────────

/** Genera puntos de una línea iso-rugosidad relativa (ε/D = const) para el diagrama */
export function isoRoughnessLine(eps_D, Re_min = 2300, Re_max = 1e8, nPts = 200) {
  const pts = [];
  const logMin = Math.log10(Re_min), logMax = Math.log10(Re_max);
  for (let i = 0; i < nPts; i++) {
    const Re = Math.pow(10, logMin + (logMax - logMin) * i / (nPts - 1));
    const f  = colebrookWhite(Re, eps_D);
    if (isFinite(f) && f > 0) pts.push({ Re, f });
  }
  return pts;
}

/** Línea laminar f = 64/Re */
export function laminarLine(Re_min = 100, Re_max = 2300, nPts = 60) {
  const pts = [];
  for (let i = 0; i < nPts; i++) {
    const Re = Re_min + (Re_max - Re_min) * i / (nPts - 1);
    pts.push({ Re, f: 64 / Re });
  }
  return pts;
}

/** Línea turbulenta rugosidad = 0 (tubo liso, Prandtl-Kármán) */
export function smoothLine(Re_min = 4000, Re_max = 1e8, nPts = 200) {
  return isoRoughnessLine(0, Re_min, Re_max, nPts);
}
