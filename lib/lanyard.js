// Lanyard renderer adapted from the supplied frontend. Scoped to one mounted pass;
// no global listeners, demo state or animation loops survive unmount.
/** @param {HTMLElement} stage @param {HTMLElement} card @param {HTMLCanvasElement} canvas
 * @param {() => boolean} getFlipped @param {() => void} onFlip */
export function mountLanyard(stage, card, canvas, getFlipped, onFlip) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dispose() {}, sync() {} };
  const innerWrap = card.querySelector(".card-faces-3d-wrap");
  const sheen = card.querySelector(".pvc-glass-highlight");
  let disposed = false, frame = 0, observer = null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DISPLAY = '"Oswald", "Bebas Neue", "Arial Narrow", Impact, sans-serif';
  const SCRIPT = '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive';

  function drawMandala(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = Math.max(0.8, r * 0.018);
    for (const k of [1, 0.9, 0.62, 0.26]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      ctx.save();
      ctx.rotate((i / 16) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.76, r * 0.07, r * 0.13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(Math.PI / 16);
      ctx.beginPath();
      ctx.arc(0, -r * 0.95, r * 0.018, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.26);
      ctx.bezierCurveTo(r * 0.12, -r * 0.4, r * 0.1, -r * 0.52, 0, -r * 0.6);
      ctx.bezierCurveTo(-r * 0.1, -r * 0.52, -r * 0.12, -r * 0.4, 0, -r * 0.26);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function makeStrap(length, width, dpr, opts) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width * dpr));
    c.height = Math.max(1, Math.round(length * dpr));
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    ctx.setTransform(0, dpr, -dpr, 0, c.width, 0);
    ctx.fillStyle = opts.color;
    ctx.fillRect(0, 0, length, width);
    ctx.strokeStyle = ctx.fillStyle = opts.ink;

    if (!opts.plain) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, length, width);
      ctx.clip();
      ctx.textBaseline = "middle";
      const scriptFont = "400 " + Math.round(width * 0.5) + "px " + SCRIPT;
      const labelFont = "700 " + Math.round(width * 0.36) + "px " + DISPLAY;
      ctx.font = scriptFont;
      const scriptW = ctx.measureText(opts.text).width;
      ctx.font = labelFont;
      const labelW = ctx.measureText(opts.label).width;
      const gap = width * 0.6;
      let x = width * 0.4;
      let flip = 1;
      while (x < length) {
        ctx.globalAlpha = 0.55;
        drawMandala(ctx, x + width * 1.3, width * (0.5 + flip * 0.28), width * 1.35);
        x += width * 2.8;
        ctx.globalAlpha = 0.95;
        ctx.font = scriptFont;
        ctx.fillText(opts.text, x, width * 0.52);
        x += scriptW + gap;
        if (opts.label) {
          ctx.font = labelFont;
          ctx.fillText("-  " + opts.label + "  -", x, width * 0.53);
          x += labelW + ctx.measureText("-    -").width + gap;
        }
        flip = -flip;
      }
      ctx.restore();
    }

    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 1.5);
    ctx.lineTo(length, 1.5);
    ctx.moveTo(0, width - 1.5);
    ctx.lineTo(length, width - 1.5);
    ctx.stroke();
    return c;
  }

  function integrate(pts, dt, gravity, damping) {
    for (const p of pts) {
      if (!p.w) continue;
      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + gravity * dt * dt;
    }
  }

  function solve(pts, links, iterations) {
    for (let k = 0; k < iterations; k++) {
      for (const [i, j, rest] of links) {
        const a = pts[i];
        const b = pts[j];
        const ws = a.w + b.w;
        if (!ws) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const f = (d - rest) / (d * ws);
        a.x += dx * f * a.w;
        a.y += dy * f * a.w;
        b.x -= dx * f * b.w;
        b.y -= dy * f * b.w;
      }
    }
  }

  function spinStep(s, target, dt, drive) {
    s.v += (-(s.a - target) * 18 - s.v * 3.2 + drive) * dt;
    s.a += s.v * dt;
  }

  function swingAngle(top, bottom) {
    return Math.atan2(bottom.x - top.x, bottom.y - top.y);
  }

    const cw = 238; // card width
    const ch = 285; // card height
    const ringR = 14;
    const clipH = 20;
    const sw = Math.max(14, Math.round(cw * 0.09));
    const lowLen = sw * 2.1;
    const arm = ringR * 2 + clipH + ch * 0.55;
    const N = 12;

    let pts = [];
    let links = [];
    let left = [];
    let right = [];
    let low = [];
    let iB = 0;
    let iT = 0;
    let iC = 0;
    let strandRest = 1;
    let dpr = 1;
    let W = 1;
    let H = 1;
    let strapTex = null;
    let plainTex = null;
    const spin = { a: 0, v: 0 };

    const add = (x, y, w) => {
      pts.push({ x, y, px: x, py: y, w });
      return pts.length - 1;
    };

    const strand = (from, to, n, slack) => {
      const a = pts[from];
      const b = pts[to];
      const rest = (Math.hypot(b.x - a.x, b.y - a.y) * slack) / n;
      const ids = [from];
      for (let i = 1; i < n; i++) ids.push(add(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 1));
      ids.push(to);
      for (let i = 0; i < n; i++) links.push([ids[i], ids[i + 1], rest]);
      return { ids, rest };
    };

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const measuredW = stage.clientWidth;
      const measuredH = stage.clientHeight;
      // Default to realistic 280x440 if element is not rendered yet (e.g. auth screen is active)
      W = measuredW > 50 ? measuredW : 280;
      H = measuredH > 50 ? measuredH : 440;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      pts = [];
      links = [];
      const cx = W / 2;
      const spread = Math.min(W * 0.22, cw * 0.38);
      const top = -sw * 1.5;
      const bY = Math.max(50, Math.min(H * 0.18, 70));

      const aL = add(cx - spread, top, 0);
      iB = add(cx, bY, 1.4);
      const l = strand(aL, iB, N, 1.03);
      const aR = add(cx + spread, top, 0);
      const r = strand(aR, iB, N, 1.03);
      iT = add(cx, bY + lowLen, 0.8);
      const lo = strand(iB, iT, 3, 1);
      iC = add(cx, bY + lowLen + arm, 0.25);
      links.push([iT, iC, arm]);
      left = l.ids;
      right = r.ids;
      low = lo.ids;
      strandRest = l.rest;

      const opts = {
        color: "#0284c7", // Innovin Sky Blue
        ink: "#ffffff",
        text: "innovin internal · cloud mesh",
        label: "INNOVIN 2026"
      };
      strapTex = makeStrap(strandRest * N + 4, sw, dpr, opts);
      plainTex = makeStrap(lowLen + 4, sw * 0.8, dpr, { ...opts, plain: true });

      // Gentle entry
      pts[iC].x += 25;
      pts[iC].px = pts[iC].x - 1;
      spin.v = 2;
    };

    const STEP = 1 / 120;
    const GRAVITY = 2400;
    const ITER = 16;

    const ribbon = (ids, tex, rest, light) => {
      const Wt = tex.width;
      for (let i = 0; i < ids.length - 1; i++) {
        const a = pts[ids[i]];
        const b = pts[ids[i + 1]];
        const dx = (b.x - a.x) * dpr;
        const dy = (b.y - a.y) * dpr;
        const len = Math.hypot(dx, dy) || 1e-6;
        const tx = dx / len;
        const ty = dy / len;
        const nx = ty;
        const ny = -tx;
        const v0 = i * rest * dpr;
        const dv = rest * dpr;
        const k = len / dv;
        ctx.setTransform(nx, ny, tx * k, ty * k, a.x * dpr - (nx * Wt) / 2 - tx * k * v0, a.y * dpr - (ny * Wt) / 2 - ty * k * v0);
        const src = Math.min(dv + 1.5, tex.height - v0);
        if (src > 0) ctx.drawImage(tex, 0, v0, Wt, src, 0, v0, Wt, src);
        const shade = 0.2 * (1 - Math.max(0, nx * light));
        ctx.fillStyle = "rgba(0,0,0," + shade.toFixed(3) + ")";
        ctx.fillRect(0, v0, Wt, dv + 1);
      }
    };

    const metal = (x0, y0, x1, y1) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "#f8fafc");
      g.addColorStop(0.45, "#cbd5e1");
      g.addColorStop(0.55, "#94a3b8");
      g.addColorStop(1, "#e2e8f0");
      return g;
    };

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!strapTex || !plainTex) return;
      ctx.imageSmoothingEnabled = true;
      ribbon(left, strapTex, strandRest, -1);
      ribbon(right, strapTex, strandRest, 1);
      ribbon(low, plainTex, (lowLen * 1) / 3, 0);

      // side-release buckle
      const B = pts[iB];
      const T = pts[iT];
      const ang = Math.atan2(T.x - B.x, T.y - B.y);
      const u = sw / 20;
      ctx.setTransform(dpr, 0, 0, dpr, B.x * dpr, B.y * dpr);
      ctx.rotate(-ang);
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 6 * dpr;
      ctx.shadowOffsetY = 2 * dpr;
      ctx.fillStyle = metal(-16 * u, 0, 16 * u, 0);
      ctx.beginPath();
      ctx.roundRect(-15 * u, -14 * u, 30 * u, 17 * u, 3 * u);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-11 * u, 1 * u, 22 * u, 15 * u, [2 * u, 2 * u, 6 * u, 6 * u]);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(15,23,42,0.6)";
      ctx.fillRect(-10 * u, -9 * u, 20 * u, 2.2 * u);
      ctx.fillRect(-5 * u, 6 * u, 10 * u, 3 * u);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 0.8 * u;
      ctx.beginPath();
      ctx.moveTo(-13 * u, -12.5 * u);
      ctx.lineTo(13 * u, -12.5 * u);
      ctx.stroke();

      // split ring
      ctx.setTransform(dpr, 0, 0, dpr, T.x * dpr, (T.y + ringR * 0.8) * dpr);
      ctx.lineWidth = Math.max(2.5, ringR * 0.38);
      ctx.strokeStyle = metal(-ringR, -ringR, ringR, ringR);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // lobster clasp hook
      ctx.fillStyle = metal(-4, 0, 4, 0);
      ctx.fillRect(-4 * dpr, (ringR * 0.6) * dpr, 8 * dpr, 12 * dpr);
    };

    const place = () => {
      const T = pts[iT];
      const C = pts[iC];
      const swing = swingAngle(T, C);
      card.style.transform =
        "translate3d(" + (T.x - cw / 2).toFixed(2) + "px," + (T.y + ringR * 0.9).toFixed(2) + "px,0) rotate(" + (-swing).toFixed(4) + "rad)";
      if (innerWrap) {
        innerWrap.style.transform = "perspective(1100px) rotateY(" + spin.a.toFixed(4) + "rad)";
      }
      if (sheen) {
        const shineX = 50 + Math.sin(spin.a) * 60 + swing * 80;
        sheen.style.background = `radial-gradient(circle at ${shineX}% 40%, rgba(255, 255, 255, 0.4) 0%, transparent 65%)`;
      }
    };

    // Pointer Interaction
    let drag = null;
    const local = (e) => {
      const r = stage.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    const onDown = (e) => {
      if (e.button > 0) return;
      // If clicking interactive child element (month arrow, calendar cell, button, leave pill), do not drag
      if (e.target.closest('#btn-flip-back-badge, .card-cal-nav-btn, .card-cal-cell, .leave-balance-card, button, a')) {
        return;
      }
      const [x, y] = local(e);
      const T = pts[iT];
      drag = { id: e.pointerId, ox: T.x - x, oy: T.y - y, tx: T.x, ty: T.y, sx: x, sy: y, moved: false };
      pts[iT].w = 0;
      card.setPointerCapture(e.pointerId);
      card.style.cursor = "grabbing";
    };

    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const [x, y] = local(e);
      drag.tx = x + drag.ox;
      drag.ty = y + drag.oy;
      if (Math.hypot(x - drag.sx, y - drag.sy) > 6) drag.moved = true;
    };

    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved) {
        onFlip();
      }
      drag = null;
      pts[iT].w = 0.8;
      card.style.cursor = "grab";
    };

    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);

    // Animation Loop
    let last = performance.now();
    let acc = 0;
    let t = 0;

    const tick = (now) => {
      // Auto-rebuild if stage was hidden on init and now has real dimensions
      if (stage.clientWidth > 50 && Math.abs(stage.clientWidth - W) > 6) {
        build();
      }
      acc += Math.min(0.05, (now - last) / 1000);
      last = now;
      let steps = 0;
      while (acc >= STEP && steps < 8) {
        acc -= STEP;
        steps++;
        t += STEP;
        if (drag) {
          const T = pts[iT];
          T.px = T.x;
          T.py = T.y;
          T.x += (drag.tx - T.x) * 0.35;
          T.y += (drag.ty - T.y) * 0.35;
        }
        const C = pts[iC];
        if (!drag) {
          // Natural subtle ambient breeze
          C.x += (20 * Math.sin(t * 0.7) + 10 * Math.sin(t * 1.8)) * STEP * STEP;
        }
        integrate(pts, STEP, GRAVITY, 0.992);
        solve(pts, links, ITER);
        const vx = (C.x - C.px) / STEP;
        spinStep(spin, (getFlipped() ? Math.PI : 0), STEP, vx * 0.03 + 0.5 * Math.sin(t * 0.5));
      }
      draw();
      place();
      if (!disposed && !reduced) frame = requestAnimationFrame(tick);
    };

    build();
    if (reduced) { for(let i=0;i<240;i++){integrate(pts,STEP,GRAVITY,0.992);solve(pts,links,ITER);} draw();place(); }
    else frame = requestAnimationFrame(tick);

    if (window.ResizeObserver) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 50 && Math.abs(entry.contentRect.width - W) > 6) {
            build();
          }
        }
      });
      observer.observe(stage);
    }

    const sync = () => { if (reduced) { spin.a = getFlipped() ? Math.PI : 0; draw(); place(); } };
    return { sync, dispose() {
      disposed = true; cancelAnimationFrame(frame); observer?.disconnect();
      card.removeEventListener("pointerdown", onDown);
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerup", onUp);
      card.removeEventListener("pointercancel", onUp);
    } };
}
