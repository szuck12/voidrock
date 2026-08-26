// hud.js
// HUD DOM synchronization.
//
// Reads game state and updates the score, lives, best score, and
// active-power-up chips above the playfield.  Only textContent and
// class toggling are used — no innerHTML — so no user-controlled
// string can ever reach the parser.

import { LIVES } from "./config.js";
import { effectRemaining } from "./systems/powerups.js";
import { POWERUP_TYPES } from "./config.js";

/** Timed effects shown as countdown chips, in display order. */
const CHIP_KEYS = [
  "speed_boost",
  "points_boost",
  "rapid_fire",
  "multi_shot",
  "slow_asteroids",
  "protective_border",
  "score_3x",
  "score_5x",
];

/**
 * Create a HUD controller bound to DOM elements.
 *
 * Args:
 *     doc: Document to query (injectable for tests).
 *
 * Returns:
 *     Controller object with an update(state) method.
 */
export function createHud(doc) {
  const els = {
    score: doc.getElementById("hud-score"),
    best: doc.getElementById("hud-best"),
    lives: doc.getElementById("hud-lives"),
    chips: doc.getElementById("hud-chips"),
  };

  /**
   * Refresh all HUD elements from state.
   *
   * Args:
   *     state: Game state to read.
   */
  function update(state) {
    els.score.textContent = String(state.score);
    els.best.textContent = String(state.bestScore);

    // Lives as ship glyphs; dimmed slots show lost lives.
    let livesText = "";
    for (let i = 0; i < LIVES.MAX; i++) {
      livesText += i < state.lives ? "\u25b2" : "\u25af";
      if (i < LIVES.MAX - 1) {
        livesText += " ";
      }
    }
    els.lives.textContent = livesText;

    syncChips(state);
  }

  /**
   * Rebuild the active-power-up chip row with countdowns.
   *
   * Args:
   *     state: Game state to read.
   */
  function syncChips(state) {
    const active = [];
    for (const key of CHIP_KEYS) {
      const remaining = effectRemaining(state, key);
      if (remaining > 0) {
        active.push({ key, remaining });
      }
    }

    // Cheap diff: skip DOM writes when the set is unchanged.
    const signature = active.map((a) => a.key).join(",");
    if (signature === els.chips.dataset.signature &&
        active.length > 0) {
      // Same set: update only countdown text.
      const children = els.chips.children;
      for (let i = 0; i < active.length && i < children.length; i++) {
        const label = POWERUP_TYPES[active[i].key]?.label || active[i].key;
        const text = `${label} ${Math.ceil(active[i].remaining)}s`;
        if (children[i].textContent !== text) {
          children[i].textContent = text;
        }
      }
      return;
    }
    if (signature !== els.chips.dataset.signature) {
      els.chips.replaceChildren();
      for (const item of active) {
        const chip = doc.createElement("span");
        chip.className = `chip chip-${item.key}`;
        els.chips.appendChild(chip);
      }
      els.chips.dataset.signature = signature;
    }
    const children = els.chips.children;
    for (let i = 0; i < active.length; i++) {
      const label = POWERUP_TYPES[active[i].key]?.label || active[i].key;
      children[i].textContent =
        `${label} ${Math.ceil(active[i].remaining)}s`;
    }
  }

  return { update };
}
