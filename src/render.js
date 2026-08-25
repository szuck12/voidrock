// render.js
// Canvas rendering of game state.
//
// Pure presentation: reads state, draws geometry, mutates nothing.
// All drawing happens in board coordinates; the caller applies the
// device-pixel-ratio transform.  The visual language is minimalist
// monochrome line art on black, with restrained metallic accents
// reserved for special asteroids and power-ups.

import { BOARD } from "./config.js";

/** Stroke colours per asteroid class. */
const ASTEROID_COLORS = Object.freeze({
  normal: "#aab4bf",
  bronze: "#d08a3e",
  silver: "#cfd6dd",
  gold: "#ffd700",
});

/** Accent colour for the player and UI flourishes. */
const ACCENT = "#7ef9ff";

/**
 * Draw one complete frame.
 *
 * Args:
 *     ctx: 2D canvas context already scaled to board pixels.
 *     state: Game state to draw.
 *     timeMs: Wall-clock milliseconds, for animations that should
 *         continue during pause/menu (twinkle, pulses).
 */
export function render(ctx, state, timeMs) {
  const t = timeMs / 1000;
  const shake = state.shakeTimer > 0 ? state.shakeTimer * 14 : 0;

  ctx.clearRect(0, 0, BOARD.WIDTH, BOARD.HEIGHT);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, BOARD.WIDTH, BOARD.HEIGHT);

  ctx.save();
  if (shake > 0) {
    const phase = t * 60;
    ctx.translate(
      Math.sin(phase * 1.3) * shake,
      Math.cos(phase * 1.7) * shake);
  }

  drawStars(ctx, state.stars, t);
  drawPowerUps(ctx, state.powerups, t);
  drawAsteroids(ctx, state.asteroids);
  drawProjectiles(ctx, state.projectiles);
  drawParticles(ctx, state.particles);
  if (state.phase === "playing" || state.phase === "paused") {
    drawPlayer(ctx, state.player, t);
    drawShield(ctx, state, t);
  }
  drawBorder(ctx);

  ctx.restore();
}

/**
 * Draw the faint twinkling starfield.
 *
 * Args:
 *     ctx: Canvas context.
 *     stars: Star descriptors from state.
 *     t: Seconds for twinkle phase.
 */
function drawStars(ctx, stars, t) {
  ctx.save();
  for (const s of stars) {
    const tw = 0.35 + 0.3 * Math.sin(t * 1.4 + s.twinklePhase);
    ctx.globalAlpha = tw;
    ctx.fillStyle = "#8fa3b0";
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.restore();
}

/**
 * Draw all asteroids as irregular stroked polygons.
 *
 * Args:
 *     ctx: Canvas context.
 *     asteroids: Asteroid states.
 */
function drawAsteroids(ctx, asteroids) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  for (const a of asteroids) {
    ctx.strokeStyle = ASTEROID_COLORS[a.type] || ASTEROID_COLORS.normal;
    ctx.fillStyle = "rgba(10, 14, 18, 0.92)";
    ctx.beginPath();
    const n = a.shape.length;
    for (let i = 0; i < n; i++) {
      const angle = a.rotation + (i / n) * Math.PI * 2;
      const r = a.radius * a.shape[i];
      const px = a.x + Math.cos(angle) * r;
      const py = a.y + Math.sin(angle) * r;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw projectiles as bright tracer bolts with short trails.
 *
 * Args:
 *     ctx: Canvas context.
 *     projectiles: Projectile states.
 */
function drawProjectiles(ctx, projectiles) {
  ctx.save();
  ctx.lineCap = "round";
  for (const p of projectiles) {
    // Trail points opposite to travel.
    const tx = p.x - Math.cos(p.angle) * 12;
    const ty = p.y - Math.sin(p.angle) * 12;
    ctx.strokeStyle = "rgba(126, 249, 255, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((tx + p.x) / 2, (ty + p.y) / 2);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw the player ship: chevron hull, cockpit dot, thrust flame.
 *
 * Blinks while invulnerable so the safety window is legible.
 *
 * Args:
 *     ctx: Canvas context.
 *     player: Player state.
 *     t: Seconds for flame flicker and blink timing.
 */
function drawPlayer(ctx, player, t) {
  if (player.invulnerableFor > 0 && Math.floor(t * 12) % 2 === 0) {
    return; // blink off-phase
  }
  const r = player.radius;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);

  if (player.thrusting) {
    const flicker = 6 + Math.sin(t * 40) * 3;
    ctx.strokeStyle = ACCENT;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.45);
    ctx.lineTo(-r - flicker, 0);
    ctx.lineTo(-r * 0.5, r * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#0a0e12";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(r * 1.25, 0);
  ctx.lineTo(-r * 0.75, r * 0.8);
  ctx.lineTo(-r * 0.35, 0);
  ctx.lineTo(-r * 0.75, -r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = ACCENT;
  ctx.fillRect(-r * 0.15, -1.5, 3, 3);
  ctx.restore();
}

/**
 * Draw the Protective Border barrier around the ship when active.
 *
 * Args:
 *     ctx: Canvas context.
 *     state: Game state (checks effect expiry).
 *     t: Seconds for pulse animation.
 */
function drawShield(ctx, state, t) {
  const expiry = state.effects.protective_border;
  if (expiry == null || state.elapsed >= expiry) {
    return;
  }
  const remaining = expiry - state.elapsed;
  const pulse = 1 + Math.sin(t * 6) * 0.06;
  const radius = (state.player.radius + 16) * pulse;

  ctx.save();
  // Fade out over the last second so expiry is never surprising.
  ctx.globalAlpha = Math.min(1, remaining);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 7]);
  ctx.lineDashOffset = -t * 30;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw power-ups: gold ring, dark core, vector glyph.
 *
 * Args:
 *     ctx: Canvas context.
 *     powerups: Power-up states.
 *     t: Seconds for pulse animation.
 */
function drawPowerUps(ctx, powerups, t) {
  ctx.save();
  for (const p of powerups) {
    const pulse = 1 + Math.sin(t * 4 + p.x * 0.05) * 0.08;
    const r = p.radius * pulse;

    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#000";

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;

    drawPowerUpGlyph(ctx, p.type, p.x, p.y);
  }
  ctx.restore();
}

/**
 * Draw the centre glyph communicating a power-up's function.
 *
 * Vector glyphs stay crisp at any canvas scale without font
 * dependencies; Points Boost uses digits via fillText.
 *
 * Args:
 *     ctx: Canvas context.
 *     type: Power-up type key.
 *     x: Centre X.
 *     y: Centre Y.
 */
function drawPowerUpGlyph(ctx, type, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#ffd700";
  ctx.fillStyle = "#ffd700";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  switch (type) {
    case "speed_boost":
      // Double chevron pointing right: fast-forward.
      for (const off of [-4, 2]) {
        ctx.beginPath();
        ctx.moveTo(off - 3, -5);
        ctx.lineTo(off + 3, 0);
        ctx.lineTo(off - 3, 5);
        ctx.stroke();
      }
      break;
    case "points_boost":
      ctx.font = 'bold 11px ui-monospace, Menlo, monospace';
      ctx.fillText("x2", 0, 1);
      break;
    case "extra_life":
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      break;
    case "slow_asteroids":
      // Hourglass.
      ctx.beginPath();
      ctx.moveTo(-4, -6);
      ctx.lineTo(4, -6);
      ctx.lineTo(-4, 6);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.stroke();
      break;
    case "protective_border":
      // Corner brackets: containment.
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(sx * 6, sy * 2.5);
        ctx.lineTo(sx * 6, sy * 6);
        ctx.lineTo(sx * 2.5, sy * 6);
        ctx.stroke();
      }
      break;
    case "rapid_fire":
      // Three vertical bolt bars.
      for (const ox of [-4.5, 0, 4.5]) {
        ctx.beginPath();
        ctx.moveTo(ox, -5);
        ctx.lineTo(ox, 5);
        ctx.stroke();
      }
      break;
    case "multi_shot":
      // Three diverging shot lines.
      for (const angle of [-0.55, 0, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(Math.sin(angle) * 2, 3);
        ctx.lineTo(Math.sin(angle) * 6, -5);
        ctx.stroke();
      }
      break;
    default:
      break;
  }
  ctx.restore();
}

/**
 * Draw explosion particles as fading squares.
 *
 * Args:
 *     ctx: Canvas context.
 *     particles: Particle states.
 */
function drawParticles(ctx, particles) {
  const COLORS = ASTEROID_COLORS;
  ctx.save();
  for (const pt of particles) {
    const lifeLeft = 1 - pt.age / pt.lifetime;
    if (lifeLeft <= 0) {
      continue;
    }
    ctx.globalAlpha = lifeLeft;
    ctx.fillStyle = pt.colorKey === "normal" ? "#c9d4dd" : COLORS[pt.colorKey];
    const s = 1 + 2 * lifeLeft;
    ctx.fillRect(pt.x - s / 2, pt.y - s / 2, s, s);
  }
  ctx.restore();
}

/**
 * Draw the subtle playfield boundary.
 *
 * Args:
 *     ctx: Canvas context.
 */
function drawBorder(ctx) {
  ctx.save();
  ctx.strokeStyle = "rgba(140, 160, 175, 0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, BOARD.WIDTH - 1, BOARD.HEIGHT - 1);
  ctx.restore();
}
