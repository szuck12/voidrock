// main.js
// Browser bootstrap: canvas setup, resize handling, the
// requestAnimationFrame loop, and phase transitions between menu,
// play, pause, and game over.
//
// This is the only module that touches wall-clock time and the
// DOM; everything else operates on injected dt and plain state.

import { BOARD } from "./config.js";
import { createInitialState, startNewRun, stepGame, togglePause }
  from "./game.js";
import { createInputState, attachInput } from "./input.js";
import { render } from "./render.js";
import { createHud } from "./hud.js";

/** Longest simulated step per frame (s); guards tab-switch jumps. */
const MAX_DT = 0.05;

/**
 * Size the canvas backing store to its CSS box at device
 * resolution and map board coordinates onto it.
 *
 * The stylesheet sizes the element fluidly (`width: 100%`), so the
 * backing store tracks the layout width while drawing stays in
 * fixed BOARD coordinates via a single transform.
 *
 * Args:
 *     canvas: The game canvas element.
 */
function sizeCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const cssWidth = canvas.clientWidth || BOARD.WIDTH;
  const scale =
    (cssWidth * (window.devicePixelRatio || 1)) / BOARD.WIDTH;
  canvas.width = Math.round(BOARD.WIDTH * scale);
  canvas.height = Math.round(BOARD.HEIGHT * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

/**
 * Boot the game once the DOM is ready.
 */
function boot() {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const bestScore = loadBestScore();
  const state = createInitialState({ seed: (Math.random() * 2 ** 32) >>> 0,
                                     bestScore });
  const input = createInputState();
  const detachInput = attachInput(window, input);
  const hud = createHud(document);

  sizeCanvas(canvas);
  window.addEventListener("resize", () => sizeCanvas(canvas));

  // Discrete key events for phase transitions (Enter, P, Escape).
  window.addEventListener("keydown", (e) => {
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      onConfirm(state);
    } else if (e.code === "KeyP" || e.code === "Escape") {
      if (state.phase === "playing" || state.phase === "paused") {
        togglePause(state);
        syncOverlay(state);
      }
    }
  });

  let lastTime = performance.now();
  function frame(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(rawDt, MAX_DT);

    stepGame(state, input, dt);
    render(ctx, state, now);
    hud.update(state);
    syncOverlay(state);
    drainEvents(state);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Persist the session best whenever a run ends.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveBestScore(state.bestScore);
    }
  });
  window.addEventListener("beforeunload", () => {
    detachInput();
    saveBestScore(state.bestScore);
  });

  /**
   * Advance phase on confirm keys from overlays.
   *
   * Args:
   *     state: Game state.
   */
  function onConfirm(state) {
    if (state.phase === "menu" || state.phase === "game_over") {
      startNewRun(state);
      syncOverlay(state);
    }
  }

  /**
   * Show or hide overlay screens based on phase.
   *
   * Args:
   *     state: Game state.
   */
  function syncOverlay(state) {
    const menu = document.getElementById("overlay-menu");
    const over = document.getElementById("overlay-gameover");
    const paused = document.getElementById("overlay-paused");
    const finalScore = document.getElementById("final-score");
    const finalBest = document.getElementById("final-best");
    const newBestTag = document.getElementById("new-best-tag");

    menu.classList.toggle("hidden", state.phase !== "menu");
    paused.classList.toggle("hidden", state.phase !== "paused");
    over.classList.toggle("hidden", state.phase !== "game_over");

    if (state.phase === "game_over") {
      finalScore.textContent = String(state.score);
      finalBest.textContent = String(state.bestScore);
      newBestTag.classList.toggle(
        "hidden", state.score < state.bestScore || state.score === 0);
      saveBestScore(state.bestScore);
    }
  }

  /**
   * Consume presentation events produced by the last step.
   *
   * Reserved for future audio hooks; visual feedback already reads
   * particles/shake directly from state.
   *
   * Args:
   *     state: Game state.
   */
  function drainEvents(state) {
    state.events.length = 0;
  }

  /**
   * Load the persisted best score, tolerating storage failure.
   *
   * Returns:
   *     Stored best score, or 0 when unavailable.
   */
  function loadBestScore() {
    try {
      return Number(localStorage.getItem("voidrock.best")) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Persist the best score, ignoring private-mode failures.
   *
   * Args:
   *     value: Score to store.
   */
  function saveBestScore(value) {
    try {
      localStorage.setItem("voidrock.best", String(value));
    } catch {
      // Storage unavailable (private mode): keep in-memory only.
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
