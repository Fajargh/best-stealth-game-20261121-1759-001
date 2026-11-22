// Keyboard and mouse, in one place: WASD or arrows to sneak, Shift to run,
// Space or click to confirm, P or Escape to pause, and click-to-move.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas, toWorld) {
  const keys = new Set();
  let actions = 0;
  let click = null;

  function onKeyDown(event) {
    const code = event.code;
    if (code in MOVE_KEYS || code === "Space" || code === "ShiftLeft" || code === "ShiftRight") {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(code);
    if (code === "Space" || code === "Enter") actions |= ACTION_CONFIRM;
    if (code === "KeyP" || code === "Escape") actions |= ACTION_PAUSE;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const world = toWorld(x, y);
    if (world) click = world;
    actions |= ACTION_CONFIRM;
  }

  function onBlur() {
    keys.clear();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("pointerdown", onPointerDown);

  return {
    /** The keyboard direction this frame, each component in [-1, 1]. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      return { x, y };
    },
    running() {
      return keys.has("ShiftLeft") || keys.has("ShiftRight");
    },
    /** Actions pressed since the last read, then cleared. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** A clicked world point since the last read, then cleared. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
