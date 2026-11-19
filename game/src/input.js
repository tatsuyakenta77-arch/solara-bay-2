// Input: keyboard + mouse state, shared by player, vehicles and combat.
export const keys = {};
export const mouse = { dx: 0, dy: 0, down: false, clicked: false, dragging: false, lastX: 0, lastY: 0 };

let attached = false;
export function initInput() {
  if (attached) return;
  attached = true;
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
  addEventListener('mousedown', (e) => {
    if (e.target.closest('button, .menu, #startScreen, #pauseMenu')) return;
    mouse.down = true; mouse.clicked = true; mouse.dragging = true;
    mouse.lastX = e.clientX; mouse.lastY = e.clientY;
  });
  addEventListener('mouseup', () => { mouse.down = false; mouse.dragging = false; });
  addEventListener('mousemove', (e) => {
    if (!mouse.dragging) return;
    mouse.dx += e.clientX - mouse.lastX;
    mouse.dy += e.clientY - mouse.lastY;
    mouse.lastX = e.clientX; mouse.lastY = e.clientY;
  });
}
export function consumeClick() { const c = mouse.clicked; mouse.clicked = false; return c; }
export function consumeMouseDelta() { const d = { x: mouse.dx, y: mouse.dy }; mouse.dx = 0; mouse.dy = 0; return d; }
export function pressed(code) { return !!keys[code]; }
export function axis() {
  // Returns {f, s}: forward/back (-1..1) and strafe/steer (-1..1).
  const f = (pressed('KeyW') || pressed('ArrowUp') ? 1 : 0) - (pressed('KeyS') || pressed('ArrowDown') ? 1 : 0);
  const s = (pressed('KeyD') || pressed('ArrowRight') ? 1 : 0) - (pressed('KeyA') || pressed('ArrowLeft') ? 1 : 0);
  return { f, s };
}
