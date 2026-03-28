/**
 * RENDERIZADOR DEL DIAGRAMA DE MOODY — Canvas 2D
 * Ejes log-log: Re (x) vs f Darcy (y)
 */
import { isoRoughnessLine, laminarLine, smoothLine, colebrookWhite } from './engine.js';

// Rugosidades relativas a mostrar en el diagrama
const ISO_EPS = [
  { eps_D: 0,        label: '0 (liso)',    color: '#5856d6' },
  { eps_D: 1e-6,     label: '10⁻⁶',       color: '#007aff' },
  { eps_D: 1e-5,     label: '10⁻⁵',       color: '#30b0c7' },
  { eps_D: 5e-5,     label: '5×10⁻⁵',     color: '#34c759' },
  { eps_D: 1e-4,     label: '10⁻⁴',       color: '#a3e635' },
  { eps_D: 5e-4,     label: '5×10⁻⁴',     color: '#f59e0b' },
  { eps_D: 1e-3,     label: '10⁻³',       color: '#ff9500' },
  { eps_D: 5e-3,     label: '5×10⁻³',     color: '#ff6b35' },
  { eps_D: 1e-2,     label: '10⁻²',       color: '#ff3b30' },
  { eps_D: 5e-2,     label: '5×10⁻²',     color: '#af52de' },
];

const RE_MIN = 5e2,  RE_MAX = 1e8;
const F_MIN  = 0.008, F_MAX = 0.1;

export class MoodyChart {
  constructor(canvas, onHover) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.onHover = onHover || (() => {});
    this.pad     = { top: 20, right: 20, bottom: 52, left: 58 };
    this.point   = null;   // { Re, f, eps_D }
    this._cache  = null;
    this.resize();
    this._bindEvents();
  }

  resize() {
    const dpr  = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width  * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.W  = rect.width;
    this.H  = rect.height;
    this.cw = this.W - this.pad.left - this.pad.right;
    this.ch = this.H - this.pad.top  - this.pad.bottom;
    this._cache = null;
  }

  // ── COORDENADAS ────────────────────────────────────────────────────────────
  xOf(Re) {
    return this.pad.left + Math.log10(Re / RE_MIN) / Math.log10(RE_MAX / RE_MIN) * this.cw;
  }
  yOf(f) {
    return this.pad.top + (1 - Math.log10(f / F_MIN) / Math.log10(F_MAX / F_MIN)) * this.ch;
  }
  invX(px) { return RE_MIN * Math.pow(10, (px - this.pad.left) / this.cw * Math.log10(RE_MAX / RE_MIN)); }
  invY(py) { return F_MIN  * Math.pow(10, (1 - (py - this.pad.top) / this.ch) * Math.log10(F_MAX / F_MIN)); }

  inChart(x, y) {
    return x >= this.pad.left && x <= this.pad.left + this.cw &&
           y >= this.pad.top  && y <= this.pad.top  + this.ch;
  }

  // ── DRAW ───────────────────────────────────────────────────────────────────
  draw(point) {
    if (point !== undefined) this.point = point;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    if (!this._cache) this._renderBase();
    ctx.drawImage(this._cacheCanvas, 0, 0);

    if (this.point) this._drawPoint(this.point);
  }

  _renderBase() {
    // Render base to offscreen canvas for caching
    this._cacheCanvas = document.createElement('canvas');
    this._cacheCanvas.width  = this.canvas.width;
    this._cacheCanvas.height = this.canvas.height;
    const ctx2 = this._cacheCanvas.getContext('2d');
    const dpr  = window.devicePixelRatio || 1;
    ctx2.scale(dpr, dpr);

    const save = this.ctx;
    this.ctx = ctx2;
    this._drawBg();
    this._drawZones();
    this._drawGrid();
    this._drawIsoLines();
    this._drawLaminar();
    this._drawAxes();
    this._drawLegend();
    this.ctx = save;
  }

  _drawBg() {
    const ctx = this.ctx;
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.pad.left, this.pad.top, this.cw, this.ch);
  }

  _drawZones() {
    const ctx = this.ctx;
    // Laminar zone
    const x0 = this.xOf(RE_MIN), x1 = this.xOf(2300);
    ctx.fillStyle = 'rgba(52,199,89,0.07)';
    ctx.fillRect(x0, this.pad.top, x1 - x0, this.ch);
    // Transition zone
    const x2 = this.xOf(4000);
    ctx.fillStyle = 'rgba(255,149,0,0.07)';
    ctx.fillRect(x1, this.pad.top, x2 - x1, this.ch);
    // Turbulent zone
    ctx.fillStyle = 'rgba(0,122,255,0.04)';
    ctx.fillRect(x2, this.pad.top, this.xOf(RE_MAX) - x2, this.ch);

    // Zone labels
    ctx.font = `bold ${Math.max(8,10)}px DM Sans,-apple-system,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(52,199,89,0.6)';
    ctx.fillText('LAMINAR', (x0+x1)/2, this.pad.top + 14);
    ctx.fillStyle = 'rgba(255,149,0,0.7)';
    ctx.fillText('TRANS.', (x1+x2)/2, this.pad.top + 14);
    ctx.fillStyle = 'rgba(0,122,255,0.5)';
    ctx.fillText('TURBULENTO', (x2 + this.xOf(RE_MAX))/2, this.pad.top + 14);

    // Vertical boundaries
    ctx.setLineDash([4,4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,149,0,0.5)';
    ctx.beginPath(); ctx.moveTo(x1, this.pad.top); ctx.lineTo(x1, this.pad.top+this.ch); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,122,255,0.4)';
    ctx.beginPath(); ctx.moveTo(x2, this.pad.top); ctx.lineTo(x2, this.pad.top+this.ch); ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 0.7;
    // Vertical (Re)
    [1,2,3,4,5,6,7,8].forEach(exp => {
      [1,2,3,4,5,6,7,8,9].forEach(m => {
        const Re = m * Math.pow(10, exp);
        if (Re < RE_MIN || Re > RE_MAX) return;
        const x = this.xOf(Re);
        ctx.beginPath(); ctx.moveTo(x, this.pad.top); ctx.lineTo(x, this.pad.top+this.ch); ctx.stroke();
      });
    });
    // Horizontal (f)
    [0.009,0.01,0.012,0.014,0.016,0.018,0.02,0.025,0.03,0.04,0.05,0.06,0.07,0.08,0.09,0.1].forEach(f => {
      if (f < F_MIN || f > F_MAX) return;
      const y = this.yOf(f);
      ctx.beginPath(); ctx.moveTo(this.pad.left, y); ctx.lineTo(this.pad.left+this.cw, y); ctx.stroke();
    });
  }

  _drawIsoLines() {
    const ctx = this.ctx;
    ISO_EPS.forEach(({ eps_D, label, color }) => {
      const pts = eps_D === 0 ? smoothLine(4000, RE_MAX) : isoRoughnessLine(eps_D, 3000, RE_MAX);
      if (!pts.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.4;
      ctx.beginPath();
      let started = false;
      for (const { Re, f } of pts) {
        const x = this.xOf(Re), y = this.yOf(f);
        if (y < this.pad.top - 2 || y > this.pad.top + this.ch + 2) { started = false; continue; }
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Label at right edge
      const last = pts[pts.length - 1];
      if (last) {
        const x = this.xOf(last.Re) - 2, y = this.yOf(last.f);
        if (y > this.pad.top && y < this.pad.top + this.ch) {
          ctx.fillStyle = color;
          ctx.font = '8px DM Mono,monospace';
          ctx.textAlign = 'right';
          ctx.fillText(label, x, y - 3);
        }
      }
    });
  }

  _drawLaminar() {
    const ctx = this.ctx;
    const pts = laminarLine(RE_MIN, 2300);
    ctx.strokeStyle = '#34c759';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    pts.forEach(({ Re, f }, i) => {
      const x = this.xOf(Re), y = this.yOf(f);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  _drawAxes() {
    const ctx = this.ctx;
    // Border
    ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.strokeRect(this.pad.left, this.pad.top, this.cw, this.ch);

    // X ticks + labels (Re)
    ctx.fillStyle = '#6c757d';
    ctx.font = '10px DM Mono,-apple-system,sans-serif';
    ctx.textAlign = 'center';
    [1e3,1e4,1e5,1e6,1e7,1e8].forEach(Re => {
      const x = this.xOf(Re);
      const exp = Math.round(Math.log10(Re));
      ctx.fillText(`10${superscript(exp)}`, x, this.pad.top + this.ch + 14);
      ctx.strokeStyle = '#dee2e6'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x, this.pad.top+this.ch); ctx.lineTo(x, this.pad.top+this.ch+4); ctx.stroke();
    });
    // X axis label
    ctx.fillStyle = '#495057';
    ctx.font = '11px DM Sans,-apple-system,sans-serif';
    ctx.fillText('Número de Reynolds  Re', this.pad.left + this.cw/2, this.pad.top + this.ch + 30);

    // Y ticks + labels (f)
    ctx.textAlign = 'right';
    ctx.font = '10px DM Mono,monospace';
    [0.01,0.015,0.02,0.03,0.04,0.05,0.06,0.07,0.08,0.09,0.1].forEach(f => {
      if (f < F_MIN || f > F_MAX) return;
      const y = this.yOf(f);
      ctx.fillStyle = '#6c757d';
      ctx.fillText(f.toFixed(3), this.pad.left - 5, y + 3);
    });
    // Y axis label (rotated)
    ctx.save();
    ctx.translate(12, this.pad.top + this.ch/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle = '#495057'; ctx.font = '11px DM Sans,-apple-system,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Factor de fricción de Darcy  f', 0, 0);
    ctx.restore();
  }

  _drawLegend() {
    const ctx = this.ctx;
    // ε/D label top-right
    ctx.fillStyle = '#6c757d';
    ctx.font = 'italic 10px DM Mono,monospace';
    ctx.textAlign = 'right';
    ctx.fillText('ε/D →', this.pad.left + this.cw - 2, this.pad.top + 26);
  }

  // ── PUNTO DE ESTADO ────────────────────────────────────────────────────────
  _drawPoint(p) {
    const ctx = this.ctx;
    if (!p || !isFinite(p.Re) || !isFinite(p.f)) return;
    const x = this.xOf(p.Re), y = this.yOf(p.f);
    if (!this.inChart(x, y)) return;

    // Crosshairs
    ctx.strokeStyle = 'rgba(220,53,69,0.35)';
    ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(this.pad.left, y); ctx.lineTo(x, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, this.pad.top+this.ch); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]);

    // Dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#dc3545';
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.fill();

    // Callout
    const lbl1 = `Re = ${p.Re.toExponential(2)}`;
    const lbl2 = `f  = ${p.f.toFixed(5)}`;
    ctx.font = 'bold 10px DM Mono,monospace';
    const w1 = ctx.measureText(lbl1).width, w2 = ctx.measureText(lbl2).width;
    const bw = Math.max(w1, w2) + 18, bh = 36;
    let bx = x + 12, by = y - bh - 8;
    if (bx + bw > this.pad.left + this.cw) bx = x - bw - 12;
    if (by < this.pad.top) by = y + 10;

    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 8;
    this._rRect(ctx, bx, by, bw, bh, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#dee2e6'; ctx.lineWidth = 1;
    this._rRect(ctx, bx, by, bw, bh, 7); ctx.stroke();

    ctx.fillStyle = '#dc3545';
    ctx.fillText(lbl1, bx + 9, by + 15);
    ctx.fillStyle = '#212529';
    ctx.fillText(lbl2, bx + 9, by + 28);
  }

  _rRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  // ── INTERACTIVIDAD ─────────────────────────────────────────────────────────
  _bindEvents() {
    const handler = e => {
      e.preventDefault();
      const rect  = this.canvas.getBoundingClientRect();
      const src   = e.touches ? e.touches[0] : e;
      const cx    = src.clientX - rect.left;
      const cy    = src.clientY - rect.top;
      if (!this.inChart(cx, cy)) return;
      const Re = this.invX(cx);
      const f  = this.invY(cy);
      this.onHover({ Re, f, cx, cy });
    };
    this.canvas.addEventListener('mousemove',  handler);
    this.canvas.addEventListener('click',      handler);
    this.canvas.addEventListener('touchmove',  handler, { passive: false });
    this.canvas.addEventListener('touchend',   handler, { passive: false });
  }
}

// Superíndice unicode
function superscript(n) {
  const map = { '-': '⁻', '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
  return String(n).split('').map(c => map[c] || c).join('');
}
