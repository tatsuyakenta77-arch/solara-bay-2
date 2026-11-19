// Save / load: localStorage progress (cash, missions, position, wanted).
const KEY = 'meridian-heat-save-v1';
export function saveGame(state) {
  try {
    const data = {
      cash: state.cash, missionIndex: state.missionIndex, missionsDone: state.missionsDone,
      health: state.health, ammo: state.ammo,
      x: state.player.pos.x, z: state.player.pos.z,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function hasSave() { return !!loadGame(); }
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
