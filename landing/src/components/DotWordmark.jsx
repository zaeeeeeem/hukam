import { useEffect, useRef } from 'react';

// Dot-matrix "Your AI. Anywhere." with the Hukam mark, after Kaleidly's dithered footer logo.
// The wordmark is drawn once to an offscreen canvas, averaged down to a grid, error-diffusion
// dithered into dots, and the dots are then moved by three forces:
//   - scroll: they fly in from a scatter as the footer is revealed, and ripple with scroll speed
//   - cursor: they are pushed away from the pointer
//   - click/tap: a ring wave runs out from the press
// Only transforms of plain numbers happen per frame; the loop sleeps when nothing moves.

const LINE_1 = 'Your AI.';
const LINE_2 = 'Anywhere.';
const FONT = '"General Sans", "Inter Variable", system-ui, sans-serif';
const VIOLET = [169, 155, 255];
const WHITE = [244, 242, 255];
const AMBER = [255, 179, 107];

const CURSOR_R = 110;
const CURSOR_F = 34;
const RIPPLE_SPEED = 260; // px/s
const RIPPLE_W = 40;
const RIPPLE_F = 18;
const RIPPLE_MS = 900;

function clamp(v, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// Rounded square field with the H cut out of it, like the favicon.
function drawMark(ctx, x, y, s) {
  const r = s * 0.24;
  const g = ctx.createRadialGradient(x + s * 0.5, y + s * 0.45, s * 0.05, x + s * 0.5, y + s * 0.5, s * 0.75);
  g.addColorStop(0, 'rgb(175,175,175)');
  g.addColorStop(0.6, 'rgb(225,225,225)');
  g.addColorStop(1, 'rgb(255,255,255)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, r);
  ctx.fill();
  // The italic H: two slanted strokes and a bar, cut out in black.
  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.17;
  const p = (u, v) => [x + u * s, y + v * s];
  ctx.beginPath();
  ctx.moveTo(...p(0.405, 0.24)); ctx.lineTo(...p(0.325, 0.76));
  ctx.moveTo(...p(0.695, 0.24)); ctx.lineTo(...p(0.615, 0.76));
  ctx.moveTo(...p(0.365, 0.515)); ctx.lineTo(...p(0.655, 0.495));
  ctx.stroke();
}

// Lays the mark and text out to fill `width`, draws them, and returns the dot positions.
function build(width) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `600 100px ${FONT}`;
  const m1 = probe.measureText(LINE_1);
  const m2 = probe.measureText(LINE_2);
  const space = probe.measureText(' ').width / 100;
  const asc = m2.actualBoundingBoxAscent / 100; // cap/ascender height of "Anywhere."
  const desc = m2.actualBoundingBoxDescent / 100; // the y's tail
  const markK = asc * 1.02; // mark is as tall as the capitals
  const gapK = 0.16;
  const w1 = m1.width / 100;
  const w2 = m2.width / 100;
  const oneRow = width >= 700;

  let fs, height, items;
  if (oneRow) {
    fs = width / (markK + gapK + w1 + space + w2) * 0.995;
    height = Math.ceil(fs * (asc + desc) + 8);
    const base = Math.round(fs * asc + 4);
    items = [{ mark: true, x: 0, y: base - fs * markK, s: fs * markK }, { text: `${LINE_1} ${LINE_2}`, x: fs * (markK + gapK), y: base }];
  } else {
    fs = width / Math.max(markK + gapK + w1, w2) * 0.99;
    const lh = fs * (asc + 0.2);
    height = Math.ceil(lh + fs * (asc + desc) + 8);
    const base1 = Math.round(fs * asc + 4);
    items = [
      { mark: true, x: 0, y: base1 - fs * markK, s: fs * markK },
      { text: LINE_1, x: fs * (markK + gapK), y: base1 },
      { text: LINE_2, x: 0, y: Math.round(base1 + lh) },
    ];
  }

  // Cell size: a dot every ~4.5px on desktop, a little finer on phones.
  const cell = width >= 1200 ? 4.2 : width >= 700 ? 4 : 3.4;
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);

  const src = document.createElement('canvas');
  src.width = Math.ceil(width);
  src.height = height;
  const sctx = src.getContext('2d');
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, src.width, src.height);
  sctx.fillStyle = '#fff';
  sctx.font = `600 ${fs}px ${FONT}`;
  sctx.textBaseline = 'alphabetic';
  for (const it of items) {
    if (it.mark) drawMark(sctx, it.x, it.y, it.s);
    else sctx.fillText(it.text, it.x, it.y);
  }

  // Average each cell, then dither so soft edges and the mark's gradient turn into grain.
  const grid = document.createElement('canvas');
  grid.width = cols;
  grid.height = rows;
  const gctx = grid.getContext('2d', { willReadFrequently: true });
  gctx.imageSmoothingEnabled = true;
  gctx.imageSmoothingQuality = 'high';
  gctx.drawImage(src, 0, 0, cols * cell, rows * cell, 0, 0, cols, rows);
  const px = gctx.getImageData(0, 0, cols, rows).data;
  const lum = new Float32Array(cols * rows);
  for (let i = 0; i < lum.length; i++) lum[i] = px[i * 4];

  const xs = [];
  const ys = [];
  for (let y = 0; y < rows; y++) {
    const ltr = y % 2 === 0;
    for (let k = 0; k < cols; k++) {
      const x = ltr ? k : cols - 1 - k;
      const i = y * cols + x;
      const old = lum[i];
      const on = old > 128;
      const err = old - (on ? 255 : 0);
      if (on) { xs.push(x); ys.push(y); }
      const st = ltr ? 1 : -1;
      const spread = (nx, ny, w) => { if (nx >= 0 && nx < cols && ny < rows) lum[ny * cols + nx] += err * w; };
      spread(x + st, y, 7 / 16);
      spread(x - st, y + 1, 3 / 16);
      spread(x, y + 1, 5 / 16);
      spread(x + st, y + 1, 1 / 16);
    }
  }

  const n = xs.length;
  const sys = {
    n, cell, width, height,
    bx: new Float32Array(n), by: new Float32Array(n), ox: new Float32Array(n), oy: new Float32Array(n),
    sx: new Float32Array(n), sy: new Float32Array(n), delay: new Float32Array(n), color: new Array(n),
  };
  const markRight = items[0].x + items[0].s;
  for (let i = 0; i < n; i++) {
    const x = xs[i] * cell + cell / 2;
    const y = ys[i] * cell + cell / 2;
    sys.bx[i] = x;
    sys.by[i] = y;
    // Scatter: drift down and outward, further for dots far from the centre line.
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 160;
    sys.sx[i] = Math.cos(a) * r * 1.6;
    sys.sy[i] = Math.abs(Math.sin(a)) * r + 60;
    sys.delay[i] = (x / width) * 0.35 + Math.random() * 0.15;
    const t = x / width;
    const inMark = x <= markRight + 1 && y <= items[0].y + items[0].s + 1;
    const c = inMark ? VIOLET : t < 0.5 ? mix(VIOLET, WHITE, t * 2) : mix(WHITE, AMBER, (t - 0.5) * 2);
    sys.color[i] = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  }
  // Let the page edge crop the bottom of the y's tail, like a wordmark set into the floor.
  sys.crop = Math.round(fs * desc * 0.45);
  return sys;
}

export function DotWordmark({ className = '' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let sys = null;
    let raf = 0;
    let visible = false;
    let progress = reduced ? 1 : 0; // shown progress (eased toward target)
    let energy = 0; // scroll-speed ripple
    let lastY = window.scrollY;
    const cursor = { x: 0, y: 0, on: false };
    const ripples = [];
    let dpr = 1;
    let disposed = false;

    // Share of the footer that has been revealed: 0 when its top meets the viewport bottom, 1 at the end of the page.
    const target = () => {
      if (reduced) return 1;
      const footer = wrap.closest('footer') || wrap;
      const doc = document.documentElement;
      const fh = footer.offsetHeight;
      const revealed = window.scrollY + window.innerHeight - (doc.scrollHeight - fh);
      return clamp(revealed / (fh * 0.85));
    };

    let builtWidth = 0;
    const size = async () => {
      const width = wrap.clientWidth;
      if (!width || width === builtWidth) return; // our own height changes also land here
      builtWidth = width;
      try { await document.fonts.load(`600 100px ${FONT}`); } catch { /* fall back to the system font */ }
      if (disposed) return;
      sys = build(width);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(sys.height * dpr);
      canvas.style.height = `${sys.height}px`;
      wrap.style.height = `${sys.height - sys.crop}px`;
      kick();
    };

    const draw = (now) => {
      const { n, bx, by, ox, oy, sx, sy, delay, color, cell } = sys;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, sys.width, sys.height);
      const d = cell * 0.62;
      const half = d / 2;
      let lastColor = '';
      for (let i = 0; i < n; i++) {
        // Each dot assembles over its own window, so the word builds left to right.
        const local = clamp((progress - delay[i]) / 0.5);
        const e = easeOut(local);
        const k = 1 - e;
        const wave = energy ? Math.sin(bx[i] * 0.018 + now * 0.004) * energy : 0;
        const x = bx[i] + ox[i] + sx[i] * k;
        const y = by[i] + oy[i] + sy[i] * k + wave;
        if (color[i] !== lastColor) { ctx.fillStyle = color[i]; lastColor = color[i]; }
        ctx.globalAlpha = 0.15 + 0.85 * e;
        ctx.fillRect(x - half, y - half, d, d);
      }
      ctx.globalAlpha = 1;
    };

    const step = (now) => {
      raf = 0;
      if (!sys) return;
      const goal = target();
      progress += (goal - progress) * 0.09;
      if (Math.abs(goal - progress) < 0.001) progress = goal;
      const y = window.scrollY;
      const v = Math.abs(y - lastY);
      lastY = y;
      energy += (Math.min(v * 0.22, 7) - energy) * 0.12;
      if (energy < 0.02) energy = 0;

      for (let k = ripples.length - 1; k >= 0; k--) if (now - ripples[k].t > RIPPLE_MS) ripples.splice(k, 1);
      let moving = false;
      const { n, bx, by, ox, oy } = sys;
      for (let i = 0; i < n; i++) {
        let fx = 0;
        let fy = 0;
        if (cursor.on) {
          const vx = bx[i] - cursor.x;
          const vy = by[i] - cursor.y;
          const d2 = vx * vx + vy * vy;
          if (d2 > 0.1 && d2 < CURSOR_R * CURSOR_R) {
            const dd = Math.sqrt(d2);
            const f = (1 - dd / CURSOR_R) ** 3 * CURSOR_F;
            fx += (vx / dd) * f;
            fy += (vy / dd) * f;
          }
        }
        for (const r of ripples) {
          const el = now - r.t;
          const rad = (el / 1000) * RIPPLE_SPEED;
          const vx = bx[i] - r.x;
          const vy = by[i] - r.y;
          const dd = Math.sqrt(vx * vx + vy * vy);
          const band = Math.abs(dd - rad);
          if (dd > 0.1 && band < RIPPLE_W) {
            const f = (1 - band / RIPPLE_W) * (1 - el / RIPPLE_MS) * RIPPLE_F;
            fx += (vx / dd) * f;
            fy += (vy / dd) * f;
          }
        }
        ox[i] += (fx - ox[i]) * 0.12;
        oy[i] += (fy - oy[i]) * 0.12;
        if (Math.abs(ox[i]) < 0.01) ox[i] = 0;
        if (Math.abs(oy[i]) < 0.01) oy[i] = 0;
        if (ox[i] || oy[i]) moving = true;
      }
      draw(now);
      if (visible && (moving || cursor.on || ripples.length || energy || progress !== goal)) raf = requestAnimationFrame(step);
    };

    function kick() { if (!raf && sys) raf = requestAnimationFrame(step); }

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { rootMargin: '200px 0px' });
    io.observe(wrap);
    const ro = new ResizeObserver(() => { clearTimeout(ro.t); ro.t = setTimeout(size, 120); });
    ro.observe(wrap);
    const onScroll = () => visible && kick();
    window.addEventListener('scroll', onScroll, { passive: true });

    const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const onMove = (e) => { if (reduced) return; [cursor.x, cursor.y] = local(e); cursor.on = true; kick(); };
    const onLeave = () => { cursor.on = false; kick(); };
    const onUp = (e) => { if (reduced) return; const [x, y] = local(e); ripples.push({ x, y, t: performance.now() }); if (e.pointerType !== 'mouse') cursor.on = false; kick(); };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointercancel', onLeave);
    canvas.addEventListener('pointerup', onUp);
    size();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      clearTimeout(ro.t);
      window.removeEventListener('scroll', onScroll);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`dot-wordmark ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
