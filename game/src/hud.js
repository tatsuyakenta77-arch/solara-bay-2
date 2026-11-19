// HUD: cash, health, ammo, wanted stars, speed, mission objective,
// message toasts, minimap (2D canvas, top-down), start & pause menus.
import { CFG } from './config.js';

let els = {};
let minimap = null, mctx = null;
let objectiveTimer = null;

export function initHUD(W) {
  els = {
    cash: document.getElementById('hudCash'),
    health: document.getElementById('hudHealth'),
    healthBar: document.getElementById('healthBar'),
    ammo: document.getElementById('hudAmmo'),
    stars: document.getElementById('hudStars'),
    speed: document.getElementById('hudSpeed'),
    objective: document.getElementById('hudObjective'),
    mission: document.getElementById('hudMission'),
    msg: document.getElementById('hudMessage'),
    hint: document.getElementById('hudHint'),
    crosshair: document.getElementById('crosshair'),
    start: document.getElementById('startScreen'),
    pause: document.getElementById('pauseMenu'),
    vignette: document.getElementById('vignette'),
  };
  minimap = document.getElementById('minimap');
  mctx = minimap.getContext('2d');
  W.hud = { els };
}

export function showMessage(W, text, ms) {
  els.msg.textContent = text;
  els.msg.style.opacity = '1';
  clearTimeout(objectiveTimer);
  objectiveTimer = setTimeout(() => { els.msg.style.opacity = '0'; }, ms || 3000);
}
export function setObjective(W, text) { els.objective.textContent = text; }
export function setCash(W, v) { els.cash.textContent = '$' + v.toLocaleString('en-US'); }
export function setHealth(W, v) {
  els.health.textContent = Math.max(0, Math.round(v));
  els.healthBar.style.width = Math.max(0, Math.min(100, v)) + '%';
  els.healthBar.style.background = v > 50 ? '#37d67a' : v > 25 ? '#ffb02e' : '#ff4444';
  els.vignette.style.opacity = v < 35 ? String(0.55 - v / 100) : '0';
}
export function setAmmo(W, v) { els.ammo.textContent = v; }
export function setWanted(W, v) {
  els.stars.textContent = '★'.repeat(v) + '☆'.repeat(5 - v);
  els.stars.style.color = v > 0 ? '#ffd23e' : '#666';
}
export function setSpeed(W, v) { els.speed.textContent = Math.round(Math.abs(v) * 3.6) + ' km/h'; }
export function setHint(W, text) { els.hint.textContent = text; }

export function updateHUD(W) {
  setCash(W, W.cash);
  setAmmo(W, W.ammo);
  setWanted(W, W.wanted);
  const P = W.player;
  setSpeed(W, P.car ? P.car.speed : P.speed);
  els.crosshair.style.display = (!P.car && W.started) ? 'block' : 'none';
  // mission label
  if (W.missionState === 'active') {
    const m = W.missions ? W.missions[Math.min(W.missionIndex, W.missions.length - 1)] : null;
    els.mission.textContent = m ? `MISSION ${m.id} · ${m.name}` : '';
  } else if (W.missionState === 'done') els.mission.textContent = 'FREE ROAM';
  else els.mission.textContent = '';
  drawMinimap(W);
}

function drawMinimap(W) {
  if (!mctx) return;
  const S = 180, scale = S / 500;
  mctx.clearRect(0, 0, S, S);
  mctx.fillStyle = 'rgba(12,18,24,0.85)';
  mctx.fillRect(0, 0, S, S);
  // roads
  mctx.strokeStyle = '#5a6b7d'; mctx.lineWidth = 4;
  for (const s of W.streets) {
    const p = (s + 250) * scale;
    mctx.beginPath(); mctx.moveTo(p, 0); mctx.lineTo(p, S); mctx.stroke();
    mctx.beginPath(); mctx.moveTo(0, p); mctx.lineTo(S, p); mctx.stroke();
  }
  // water edge
  mctx.fillStyle = '#1e6f8e'; mctx.fillRect(0, (250 + 250) * scale - 6, S, 6);
  const dot = (x, z, color, r) => {
    mctx.fillStyle = color;
    mctx.beginPath(); mctx.arc((x + 250) * scale, (z + 250) * scale, r, 0, Math.PI * 2); mctx.fill();
  };
  // mission marker
  if (W.marker && W.marker.visible) dot(W.marker.position.x, W.marker.position.z, '#ffcc00', 6);
  for (const c of W.traffic || []) dot(c.group.position.x, c.group.position.z, '#cccccc', 2);
  for (const c of W.cops || []) dot(c.group.position.x, c.group.position.z, '#ff3333', 3);
  for (const p of W.peds || []) if (p.alive) dot(p.pos.x, p.pos.z, '#88bbff', 1.5);
  // player arrow
  const P = W.player;
  const px = P.car ? P.car.group.position.x : P.pos.x;
  const pz = P.car ? P.car.group.position.z : P.pos.z;
  const heading = P.car ? P.car.heading : P.heading;
  mctx.save();
  mctx.translate((px + 250) * scale, (pz + 250) * scale);
  mctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)) + Math.PI);
  mctx.fillStyle = '#ffffff';
  mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
  mctx.restore();
  // north tick
  mctx.fillStyle = '#fff'; mctx.font = 'bold 11px sans-serif'; mctx.fillText('N', S - 14, 14);
}

export function showStart(W, hasSave) {
  els.start.style.display = 'flex';
  els.pause.style.display = 'none';
  document.getElementById('continueBtn').style.display = hasSave ? 'inline-block' : 'none';
}
export function hideStart() { els.start.style.display = 'none'; }
export function showPause(W, show) { els.pause.style.display = show ? 'flex' : 'none'; }
