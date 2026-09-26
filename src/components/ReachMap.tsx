import { useEffect, useRef } from "react";
import type { Conversation } from "../lib/types";

interface Node {
  label: string;
  sub: string;
  followers: number;
  overlap: number;
  score: number;
  active: boolean;
}

interface Props {
  you: { followers: number; name: string };
  rooms: { conversation: Conversation; score: number }[];
  replied: string[];
  /** How many of the top rooms get a tendril. */
  reach?: number;
}

function cssVar(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/**
 * Your audience at the centre; live rooms around it. Distance from the centre is how
 * little of that room already knows you. Tendrils run to the rooms worth joining today.
 */
export function ReachMap({ you, rooms, replied, reach = 3 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t0 = performance.now();

    const nodes: Node[] = rooms.map((r, i) => ({
      label: r.conversation.author,
      sub: `${formatK(r.conversation.authorFollowers)} audience`,
      followers: r.conversation.authorFollowers,
      overlap: r.conversation.audienceOverlap,
      score: r.score,
      active: i < reach || replied.includes(r.conversation.id),
    }));

    const draw = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const c = {
        moss: cssVar(canvas, "--moss"),
        pollen: cssVar(canvas, "--pollen"),
        line: cssVar(canvas, "--line"),
        lineStrong: cssVar(canvas, "--line-strong"),
        ink: cssVar(canvas, "--ink"),
        muted: cssVar(canvas, "--muted"),
        surface: cssVar(canvas, "--surface"),
        mossSoft: cssVar(canvas, "--moss-soft"),
        body: cssVar(canvas, "--font-body"),
      };

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) / 2 - 26;
      const youR = Math.max(16, Math.min(34, Math.sqrt(you.followers) * 0.6));

      // Rings: how much of each ring's audience already follows you.
      ctx.setLineDash([2, 5]);
      ctx.lineWidth = 1;
      [0.45, 0.72, 1].forEach((f) => {
        ctx.strokeStyle = c.line;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * f, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.fillStyle = c.muted;
      ctx.font = `500 10px ${c.body}`;
      ctx.textAlign = "center";
      ctx.fillText("outer ring: rooms that barely know you", cx, cy + maxR * 0.92 + 20);

      // Leave room at the sides for labels.
      const xScale = Math.max(0.7, Math.min(1.08, (w / 2 - 105) / maxR));
      const positions = nodes.map((n, i) => {
        const angle = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2 + 0.35;
        const dist = youR + 26 + (maxR - youR - 26) * Math.min(1, (1 - n.overlap) * 1.02);
        const r = Math.max(5, Math.min(18, Math.log10(n.followers) * 3.4 - 6));
        return { x: cx + Math.cos(angle) * dist * xScale, y: cy + Math.sin(angle) * dist * 0.92, r, n };
      });

      const elapsed = (now - t0) / 1000;

      // Tendrils
      positions.forEach((p, i) => {
        const mx = (cx + p.x) / 2 + (p.y - cy) * 0.28;
        const my = (cy + p.y) / 2 - (p.x - cx) * 0.28;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(mx, my, p.x, p.y);
        ctx.strokeStyle = p.n.active ? c.moss : c.line;
        ctx.lineWidth = p.n.active ? 2 : 1;
        ctx.stroke();

        if (p.n.active && !reduce) {
          const k = (elapsed * 0.35 + i * 0.27) % 1;
          const x = (1 - k) * (1 - k) * cx + 2 * (1 - k) * k * mx + k * k * p.x;
          const y = (1 - k) * (1 - k) * cy + 2 * (1 - k) * k * my + k * k * p.y;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = c.pollen;
          ctx.fill();
        }
      });

      // Room nodes
      positions.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2);
        ctx.fillStyle = c.surface;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.n.active ? c.moss : c.mossSoft;
        ctx.fill();
        ctx.strokeStyle = p.n.active ? c.moss : c.lineStrong;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (p.n.active) {
          ctx.font = `600 12px ${c.body}`;
          const labelW = Math.max(ctx.measureText(p.n.label).width, ctx.measureText(p.n.sub).width * 0.9);
          let right = p.x >= cx;
          if (right && p.x + p.r + 7 + labelW > w - 2) right = false;
          if (!right && p.x - p.r - 7 - labelW < 2) right = true;
          ctx.textAlign = right ? "left" : "right";
          const lx = p.x + (right ? p.r + 7 : -p.r - 7);
          ctx.fillStyle = c.ink;
          ctx.fillText(p.n.label, lx, p.y - 1);
          ctx.fillStyle = c.muted;
          ctx.font = `500 10.5px ${c.body}`;
          ctx.fillText(p.n.sub, lx, p.y + 12);
        }
      });

      // You
      ctx.beginPath();
      ctx.arc(cx, cy, youR + 6, 0, Math.PI * 2);
      ctx.fillStyle = c.mossSoft;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, youR, 0, Math.PI * 2);
      ctx.fillStyle = c.moss;
      ctx.fill();
      ctx.fillStyle = c.surface;
      ctx.textAlign = "center";
      ctx.font = `700 12px ${c.body}`;
      ctx.fillText("You", cx, cy - 1);
      ctx.font = `500 10px ${c.body}`;
      ctx.fillText(formatK(you.followers), cx, cy + 11);

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    const redraw = () => {
      cancelAnimationFrame(raf);
      t0 = performance.now();
      raf = requestAnimationFrame(draw);
    };
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", redraw);
    window.addEventListener("resize", redraw);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      mq.removeEventListener("change", redraw);
      window.removeEventListener("resize", redraw);
    };
  }, [you, rooms, replied, reach]);

  return <canvas ref={ref} role="img" aria-label={`Map of ${rooms.length} live conversations around your audience. Tendrils mark the ${reach} worth joining today.`} />;
}

export function formatK(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}
