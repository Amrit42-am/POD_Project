import React, { useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * CollabNodesBackground — Reference-matched version
 *
 * Deep navy-purple background with:
 * - Very prominent large purple/blue glow blobs
 * - Bright visible network of connection lines
 * - Ring-outlined glowing nodes in clusters
 * - Small scattered sparkle particles
 * - Cursor interaction
 */

/* ── Palette ─────────────────────────────────────────────── */

const PURPLE = [147, 51, 234];
const VIOLET = [139, 92, 246];
const INDIGO = [99, 102, 241];
const BLUE   = [59, 130, 246];
const PINK   = [236, 72, 153];
const CYAN   = [6, 182, 212];

const ALL_COLORS = [PURPLE, VIOLET, INDIGO, BLUE, VIOLET, PURPLE, PINK, CYAN];

/* ── Ambient glow orbs — large & prominent ───────────────── */

const GLOW_ORBS = [
  // top-left large purple blob
  { x: 0.08, y: 0.15, r: 0.32, col: PURPLE, a: 0.18 },
  // top-right indigo blob
  { x: 0.88, y: 0.10, r: 0.26, col: INDIGO, a: 0.14 },
  // bottom-left violet
  { x: 0.05, y: 0.78, r: 0.28, col: VIOLET, a: 0.12 },
  // bottom-right purple
  { x: 0.82, y: 0.70, r: 0.22, col: PURPLE, a: 0.10 },
  // center-bottom blue
  { x: 0.45, y: 0.92, r: 0.30, col: BLUE,   a: 0.08 },
  // center purple wash
  { x: 0.50, y: 0.40, r: 0.35, col: VIOLET, a: 0.05 },
];

/* ── Node cluster positions (reference shows nodes grouped) ─ */

const CLUSTER_CENTERS = [
  // LEFT EDGE — dense column
  { x: 0.04, y: 0.10, spread: 0.09, count: 6 },
  { x: 0.06, y: 0.28, spread: 0.10, count: 6 },
  { x: 0.05, y: 0.46, spread: 0.09, count: 6 },
  { x: 0.07, y: 0.64, spread: 0.10, count: 6 },
  { x: 0.05, y: 0.82, spread: 0.09, count: 5 },
  // RIGHT EDGE — dense column
  { x: 0.96, y: 0.10, spread: 0.09, count: 6 },
  { x: 0.94, y: 0.28, spread: 0.10, count: 6 },
  { x: 0.95, y: 0.46, spread: 0.09, count: 6 },
  { x: 0.93, y: 0.64, spread: 0.10, count: 6 },
  { x: 0.95, y: 0.82, spread: 0.09, count: 5 },
  // TOP ROW
  { x: 0.22, y: 0.05, spread: 0.09, count: 5 },
  { x: 0.40, y: 0.04, spread: 0.08, count: 4 },
  { x: 0.58, y: 0.04, spread: 0.08, count: 4 },
  { x: 0.76, y: 0.05, spread: 0.09, count: 5 },
  // BOTTOM ROW
  { x: 0.18, y: 0.93, spread: 0.10, count: 5 },
  { x: 0.38, y: 0.95, spread: 0.09, count: 4 },
  { x: 0.58, y: 0.95, spread: 0.09, count: 4 },
  { x: 0.78, y: 0.93, spread: 0.10, count: 5 },
  // INNER-LEFT (bridging edge to center)
  { x: 0.20, y: 0.22, spread: 0.08, count: 4 },
  { x: 0.18, y: 0.52, spread: 0.09, count: 4 },
  { x: 0.22, y: 0.78, spread: 0.08, count: 4 },
  // INNER-RIGHT
  { x: 0.80, y: 0.22, spread: 0.08, count: 4 },
  { x: 0.82, y: 0.52, spread: 0.09, count: 4 },
  { x: 0.78, y: 0.78, spread: 0.08, count: 4 },
  // CENTER SPARSE (avoid blocking hero text)
  { x: 0.35, y: 0.30, spread: 0.07, count: 2 },
  { x: 0.65, y: 0.30, spread: 0.07, count: 2 },
  { x: 0.50, y: 0.70, spread: 0.10, count: 3 },
];

/* ── Sparkle particles ───────────────────────────────────── */

const SPARKLE_COUNT = 40;

const CONNECT_DIST = 200;
const CURSOR_RADIUS = 160;

/* ── Helpers ─────────────────────────────────────────────── */

function rand(a, b) { return a + Math.random() * (b - a); }
function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`; }

function createClusteredNodes(w, h) {
  const nodes = [];
  CLUSTER_CENTERS.forEach((cluster) => {
    for (let i = 0; i < cluster.count; i++) {
      const angle = (i / cluster.count) * Math.PI * 2 + rand(-0.5, 0.5);
      const dist = rand(0.02, cluster.spread);
      const nx = cluster.x + Math.cos(angle) * dist;
      const ny = cluster.y + Math.sin(angle) * dist;
      const col = ALL_COLORS[nodes.length % ALL_COLORS.length];
      const isLarge = Math.random() < 0.25;
      const isMedium = !isLarge && Math.random() < 0.45;
      const r = isLarge ? rand(6, 10) : isMedium ? rand(4, 6) : rand(2.5, 4);

      nodes.push({
        r,
        col,
        hasRing: r > 4.5 || Math.random() < 0.35,
        alpha: isLarge ? 0.85 : isMedium ? 0.65 : 0.45,
        glowR: r * (isLarge ? 5 : isMedium ? 4 : 3),
        hx: nx * w,
        hy: ny * h,
        x: 0, y: 0,
        driftA: Math.random() * Math.PI * 2,
        driftS: rand(0.04, 0.12),
        driftR: rand(8, 30),
        phase: Math.random() * Math.PI * 2,
        pulseP: Math.random() * Math.PI * 2,
        pulseS: rand(0.3, 0.8),
        px: 0, py: 0,
        glow: 0,
      });
    }
  });
  return nodes;
}

function createSparkles(w, h) {
  const sparkles = [];
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    sparkles.push({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(0.8, 2),
      alpha: rand(0.2, 0.6),
      twinkleS: rand(0.5, 1.5),
      twinkleP: Math.random() * Math.PI * 2,
      col: ALL_COLORS[i % ALL_COLORS.length],
    });
  }
  return sparkles;
}

/* ── Component ───────────────────────────────────────────── */

export default function CollabNodesBackground() {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const sparklesRef = useRef([]);
  const ptrRef = useRef({ x: -9999, y: -9999, on: false });
  const frameRef = useRef(0);
  const dimRef = useRef({ w: 0, h: 0 });
  const { theme } = useTheme();
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const init = useCallback((w, h) => {
    nodesRef.current = createClusteredNodes(w, h);
    sparklesRef.current = createSparkles(w, h);
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d', { alpha: false });
    if (!ctx) return;

    const resize = () => {
      const p = cvs.parentElement;
      if (!p) return;
      const w = p.clientWidth;
      const h = p.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cvs.width = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      cvs.style.width = `${w}px`;
      cvs.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dimRef.current = { w, h };
      if (!nodesRef.current.length) {
        init(w, h);
      } else {
        nodesRef.current.forEach((n) => {
          n.hx = Math.min(Math.max(20, n.hx), w - 20);
          n.hy = Math.min(Math.max(20, n.hy), h - 20);
        });
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(cvs.parentElement);
    resize();

    const onMove = (e) => {
      const rect = cvs.getBoundingClientRect();
      ptrRef.current.x = e.clientX - rect.left;
      ptrRef.current.y = e.clientY - rect.top;
      ptrRef.current.on = true;
    };
    const onLeave = () => { ptrRef.current.on = false; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    /* ---- render ---- */
    const render = (ts) => {
      const t = ts * 0.001;
      const { w, h } = dimRef.current;
      if (w === 0) { frameRef.current = requestAnimationFrame(render); return; }

      const nodes = nodesRef.current;
      const sparkles = sparklesRef.current;
      const ptr = ptrRef.current;
      const maxDim = Math.max(w, h);

      /* ═══ 1. Background ═══ */
      const isLight = themeRef.current === 'light';
      const bg = ctx.createLinearGradient(0, 0, w * 0.15, h);
      if (isLight) {
        bg.addColorStop(0, '#f8fafc');
        bg.addColorStop(0.5, '#f1f5f9');
        bg.addColorStop(1, '#e2e8f0');
      } else {
        bg.addColorStop(0, '#050714');
        bg.addColorStop(0.25, '#080b22');
        bg.addColorStop(0.5, '#0c1030');
        bg.addColorStop(0.75, '#0e0d2e');
        bg.addColorStop(1, '#07061a');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      /* ═══ 2. Large ambient glow orbs ═══ */
      for (let i = 0; i < GLOW_ORBS.length; i++) {
        const orb = GLOW_ORBS[i];
        const c = orb.col;
        const ox = (orb.x + Math.sin(t * 0.05 + i * 1.8) * 0.02) * w;
        const oy = (orb.y + Math.cos(t * 0.04 + i * 2.3) * 0.015) * h;
        const or = orb.r * maxDim;

        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, or);
        const a = isLight ? orb.a * 0.7 : orb.a; // reduce glow in light mode
        g.addColorStop(0, rgba(c, a));
        g.addColorStop(0.3, rgba(c, a * 0.5));
        g.addColorStop(0.6, rgba(c, a * 0.15));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(ox - or, oy - or, or * 2, or * 2);
      }

      /* ═══ 3. Update node positions ═══ */
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const a = n.driftA + t * n.driftS;
        n.x = n.hx + Math.cos(a + n.phase) * n.driftR;
        n.y = n.hy + Math.sin(a * 0.7 + n.phase) * n.driftR * 0.6;
        n._pulse = 1 + Math.sin(t * n.pulseS + n.pulseP) * 0.12;

        if (ptr.on) {
          const dx = n.x - ptr.x, dy = n.y - ptr.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CURSOR_RADIUS && d > 0.5) {
            const s = 1 - d / CURSOR_RADIUS;
            n.px += (dx / d) * s * s * 2.5;
            n.py += (dy / d) * s * s * 2.5;
            n.glow += (s * 0.9 - n.glow) * 0.1;
          } else { n.glow *= 0.94; }
        } else { n.glow *= 0.96; }

        n.px *= 0.9;
        n.py *= 0.9;
        n.x = Math.max(n.r, Math.min(w - n.r, n.x + n.px));
        n.y = Math.max(n.r, Math.min(h - n.r, n.y + n.py));
      }

      /* ═══ 4. Connection lines — spatial-grid optimised ═══ */
      // Build grid: cell size = CONNECT_DIST so only 9 cells need checking per node
      const cellSize = CONNECT_DIST;
      const cols = Math.ceil(w / cellSize) + 1;
      const rows = Math.ceil(h / cellSize) + 1;
      const grid = new Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = [];
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const cx = Math.floor(n.x / cellSize);
        const cy = Math.floor(n.y / cellSize);
        grid[cy * cols + cx].push(i);
      }

      ctx.lineCap = 'round';
      const drawn = new Uint8Array(nodes.length * nodes.length); // skip duplicate pairs

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const acx = Math.floor(a.x / cellSize);
        const acy = Math.floor(a.y / cellSize);

        for (let dy2 = -1; dy2 <= 1; dy2++) {
          for (let dx2 = -1; dx2 <= 1; dx2++) {
            const ncx = acx + dx2, ncy = acy + dy2;
            if (ncx < 0 || ncy < 0 || ncx >= cols || ncy >= rows) continue;
            const cell = grid[ncy * cols + ncx];
            for (let k = 0; k < cell.length; k++) {
              const j = cell[k];
              if (j <= i) continue;
              if (drawn[i * nodes.length + j]) continue;
              drawn[i * nodes.length + j] = 1;

              const b = nodes[j];
              const ddx = a.x - b.x, ddy = a.y - b.y;
              const d = Math.sqrt(ddx * ddx + ddy * ddy);
              if (d < CONNECT_DIST) {
                const strength = 1 - d / CONNECT_DIST;
                const lineA = strength * 0.25;

                // glow pass (thick, faint)
                ctx.strokeStyle = rgba(VIOLET, isLight ? lineA * 0.2 : lineA * 0.4);
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();

                // bright core
                ctx.strokeStyle = rgba(isLight ? [120, 80, 220] : [180, 160, 255], isLight ? lineA * 1.5 : lineA);
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        }
      }

      /* ═══ 5. Draw nodes ═══ */
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const c = n.col;
        const ea = Math.min(1, n.alpha + n.glow * 0.4);
        const pulse = n._pulse;
        const cr = n.r * pulse;
        const gr = n.glowR * pulse + n.glow * n.r * 3;

        // ── large glow halo ──
        const glowA = Math.min(0.55, n.alpha * 0.45 + n.glow * 0.3);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, gr);
        g.addColorStop(0, rgba(c, glowA));
        g.addColorStop(0.25, rgba(c, glowA * 0.5));
        g.addColorStop(0.55, rgba(c, glowA * 0.12));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, gr, 0, Math.PI * 2);
        ctx.fill();

        // ── bright solid core ──
        ctx.fillStyle = rgba(c, ea);
        ctx.beginPath();
        ctx.arc(n.x, n.y, cr, 0, Math.PI * 2);
        ctx.fill();

        // ── white center highlight ──
        if (cr > 3) {
          ctx.fillStyle = `rgba(255,255,255,${(0.4 * ea).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(n.x - cr * 0.2, n.y - cr * 0.2, cr * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }

        // ── ring outline (prominent, like reference) ──
        if (n.hasRing) {
          const ringR = cr * 2.0;
          const ringA = ea * 0.3 + n.glow * 0.15;
          ctx.strokeStyle = rgba(c, ringA);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
          ctx.stroke();

          // second outer ring for large nodes
          if (cr > 6) {
            ctx.strokeStyle = rgba(c, ringA * 0.4);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.arc(n.x, n.y, ringR * 1.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      /* ═══ 6. Sparkle particles ═══ */
      for (let i = 0; i < sparkles.length; i++) {
        const s = sparkles[i];
        const twinkle = 0.5 + Math.sin(t * s.twinkleS + s.twinkleP) * 0.5;
        const sa = s.alpha * twinkle;
        ctx.fillStyle = rgba(s.col, sa);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        // tiny glow around brighter sparkles
        if (s.r > 1.2 && sa > 0.3) {
          ctx.fillStyle = rgba(s.col, sa * 0.2);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* ═══ 7. Cursor glow ═══ */
      if (ptr.on) {
        const cg = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 100);
        cg.addColorStop(0, 'rgba(147,51,234,0.08)');
        cg.addColorStop(0.4, 'rgba(139,92,246,0.04)');
        cg.addColorStop(1, 'rgba(139,92,246,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(ptr.x, ptr.y, 100, 0, Math.PI * 2);
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className="collab-nodes-canvas"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
