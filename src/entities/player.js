// player.js
// Player ship entity: creation, movement physics, and board bounds.
//
// Movement is acceleration-based with exponential damping, which
// gives a responsive but slightly weighty arcade feel.  The ship
// always remains fully inside the playfield — edges clamp instead
// of wrapping.

import { BOARD, PLAYER } from "../config.js";
import { angleDelta, clamp, length } from "../utils/math.js";

/**
 * Create a player ship at a position (default: board centre).
 *
 * Args:
 *     x: Optional starting X position.
 *     y: Optional starting Y position.
 *
 * Returns:
 *     Player state object with position, velocity, facing, lives,
 *     and invulnerability timer fields.
 */
export function createPlayer(x = BOARD.WIDTH / 2,
                             y = BOARD.HEIGHT / 2) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: PLAYER.START_FACING,
    radius: PLAYER.RADIUS,
    thrusting: false,
    invulnerableFor: 0, // s of remaining post-hit safety
  };
}

/**
 * Apply one step of input-driven movement to the player.
 *
 * The ship accelerates along the combined input direction, velocity
 * decays exponentially, and the position is clamped fully inside
 * the board.  Facing turns toward the input direction; with no
 * input the last facing holds so the ship can hold an aim while
 * drifting.  The equilibrium cruise speed equals
 * ACCELERATION * speedMult / DAMPING, so `speedMult` (Speed Boost)
 * raises both agility and top speed.
 *
 * Args:
 *     player: Player state object (mutated in place).
 *     input: Object with boolean up/down/left/right flags.
 *     dt: Elapsed seconds for this step.
 *     speedMult: Optional multiplier for thrust and max speed
 *         (Speed Boost power-up); defaults to 1.
 */
export function updatePlayer(player, input, dt, speedMult = 1) {
  const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const iy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const moving = ix !== 0 || iy !== 0;

  if (moving) {
    // Normalize diagonals so moving diagonally is not faster.
    const invLen = 1 / length(ix, iy);
    const ax = ix * invLen * PLAYER.ACCELERATION * speedMult;
    const ay = iy * invLen * PLAYER.ACCELERATION * speedMult;
    player.vx += ax * dt;
    player.vy += ay * dt;

    // Turn toward the movement direction at a bounded rate.
    const target = Math.atan2(iy, ix);
    const d = angleDelta(player.facing, target);
    const maxTurn = PLAYER.TURN_SPEED * dt;
    player.facing += Math.abs(d) <= maxTurn ? d : Math.sign(d) * maxTurn;
  }

  decayVelocity(player, dt);

  const maxSpeed = PLAYER.MAX_SPEED * speedMult;
  const speed = length(player.vx, player.vy);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    player.vx *= scale;
    player.vy *= scale;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  clampToBoard(player);

  if (player.invulnerableFor > 0) {
    player.invulnerableFor = Math.max(0, player.invulnerableFor - dt);
  }
}

/**
 * Apply exponential velocity damping for one step.
 *
 * Args:
 *     player: Player state object (mutated in place).
 *     dt: Elapsed seconds.
 */
function decayVelocity(player, dt) {
  const factor = Math.exp(-PLAYER.DAMPING * dt);
  player.vx *= factor;
  player.vy *= factor;
  if (Math.abs(player.vx) < 1 && Math.abs(player.vy) < 1) {
    player.vx = 0;
    player.vy = 0;
  }
}

/**
 * Clamp the ship so its full circle stays inside the playfield.
 * Zeroes the velocity component pushing into the wall to avoid
 * sticky sliding.
 *
 * Args:
 *     player: Player state object (mutated in place).
 */
export function clampToBoard(player) {
  const r = player.radius;

  if (player.x - r < 0) {
    player.x = r;
    if (player.vx < 0) {
      player.vx = 0;
    }
  } else if (player.x + r > BOARD.WIDTH) {
    player.x = BOARD.WIDTH - r;
    if (player.vx > 0) {
      player.vx = 0;
    }
  }

  if (player.y - r < 0) {
    player.y = r;
    if (player.vy < 0) {
      player.vy = 0;
    }
  } else if (player.y + r > BOARD.HEIGHT) {
    player.y = BOARD.HEIGHT - r;
    if (player.vy > 0) {
      player.vy = 0;
    }
  }
}
