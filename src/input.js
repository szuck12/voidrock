// input.js
// Keyboard input capture for movement and firing.
//
// Tracks a plain boolean-flag object that stepGame() consumes.
// Arrow keys and Space are preventDefault()-ed so the page never
// scrolls during play.

/** Key-to-action mapping (both WASD and arrow keys). */
const KEY_MAP = Object.freeze({
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "fire",
});

/**
 * Create an empty input state.
 *
 * Returns:
 *     Object with up/down/left/right/fire booleans, all false.
 */
export function createInputState() {
  return { up: false, down: false, left: false, right: false,
           fire: false };
}

/**
 * Attach global key listeners feeding an input state.
 *
 * Args:
 *     target: Window-like object with addEventListener.
 *     input: Input state object to update (mutated).
 *
 * Returns:
 *     Detach function removing both listeners.
 */
export function attachInput(target, input) {
  const onKey = (event, down) => {
    const action = KEY_MAP[event.code];
    if (!action) {
      return;
    }
    // Keep arrows/space from scrolling the page while playing.
    event.preventDefault();
    input[action] = down;
  };
  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  return () => {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
  };
}
