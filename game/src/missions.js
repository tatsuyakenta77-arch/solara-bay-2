// Missions: story state machine. Steps: goto / enterCar / steal / collect /
// fight / deliver. A glowing marker ring shows the current objective.
import * as THREE from 'three';
import { MISSIONS, dist2d } from './config.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';

let marker = null, markerRing = null;

export function initMissions(W, scene) {
  W.missionIndex = W.missionIndex ?? 0;
  W.missionsDone = W.missionsDone ?? 0;
  W.missionStep = 0;
  W.missionState = 'idle'; // idle | active | done
  const geo = new THREE.CylinderGeometry(3.2, 3.2, 0.25, 24);
  marker = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.75 }));
  marker.visible = false; scene.add(marker);
  const ringGeo = new THREE.TorusGeometry(3.2, 0.18, 8, 32);
  markerRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffee55 }));
  markerRing.rotation.x = Math.PI / 2; markerRing.visible = false; scene.add(markerRing);
  W.marker = marker;
  startMission(W, W.missionIndex, true);
}

export function currentMission(W) { return MISSIONS[Math.min(W.missionIndex, MISSIONS.length - 1)]; }
export function currentStep(W) {
  const m = currentMission(W);
  return m.steps[Math.min(W.missionStep, m.steps.length - 1)];
}
export function allMissionsDone(W) { return W.missionIndex >= MISSIONS.length; }

export function startMission(W, idx, silent) {
  if (idx >= MISSIONS.length) { W.missionState = 'done'; marker.visible = false; markerRing.visible = false; W.setObjective('All missions complete — Port Meridian is yours. Free roam!'); return; }
  W.missionIndex = idx; W.missionStep = 0; W.missionState = 'active';
  const m = MISSIONS[idx];
  W.setObjective(`Mission ${m.id}: ${m.name} — ${m.steps[0].text}`);
  if (!silent) { W.showMessage(`MISSION ${m.id} — ${m.name}`, 3200); W.showMessage(m.brief, 5000); sfx.mission(); }
  placeMarker(W);
}

function placeMarker(W) {
  const s = currentStep(W);
  const hasPos = s.x !== undefined;
  marker.visible = hasPos; markerRing.visible = hasPos;
  if (hasPos) { marker.position.set(s.x, 0.15, s.z); markerRing.position.set(s.x, 0.4, s.z); }
  // fight steps spawn the rival crew
  if (s.type === 'fight') W.spawnEnemies(s.x, s.z, s.count || 3);
  // steal step highlights the target coupe
  if (s.type === 'steal' && W.targetCoupe) {
    W.targetCoupe.group.position.set(s.x, 0, s.z);
    W.targetCoupe.parked = true;
  }
  // deliver steps with wanted: set the heat
  if (s.type === 'deliver' && W.missionIndex === 4) W.setWanted(3);
  if (s.type === 'deliver' && W.missionIndex === 5) W.setWanted(4);
}

function advance(W) {
  const m = currentMission(W);
  W.missionStep++;
  if (W.missionStep >= m.steps.length) {
    W.cash += m.pay; W.missionsDone++;
    sfx.cash();
    W.showMessage(`MISSION COMPLETE — ${m.name}  +$${m.pay}`, 4200);
    W.setObjective(`Mission complete! +$${m.pay}`);
    saveGame(W);
    setTimeout(() => { if (W.running) startMission(W, W.missionIndex + 1); }, 2500);
    W.missionStep = m.steps.length - 1; // hold last step text until next starts
    W.missionState = 'complete';
    return;
  }
  const s = currentStep(W);
  W.setObjective(`Mission ${m.id}: ${m.name} — ${s.text}`);
  placeMarker(W);
  sfx.pickup();
}

export function updateMissions(W, dt) {
  if (W.missionState !== 'active') return;
  const s = currentStep(W);
  const P = W.player;
  const px = P.car ? P.car.group.position.x : P.pos.x;
  const pz = P.car ? P.car.group.position.z : P.pos.z;
  // marker pulse
  if (marker.visible) {
    const t = performance.now() * 0.004;
    markerRing.position.y = 0.4 + Math.sin(t) * 0.25;
    markerRing.scale.setScalar(1 + Math.sin(t) * 0.08);
  }
  switch (s.type) {
    case 'enterCar':
      if (P.car) advance(W);
      break;
    case 'goto':
    case 'deliver':
    case 'collect':
      if (dist2d(px, pz, s.x, s.z) < (s.r || 8)) {
        if (s.type === 'collect' && P.car) break; // must be on foot to collect
        advance(W);
      }
      break;
    case 'steal':
      if (P.car === W.targetCoupe) advance(W);
      break;
    case 'fight':
      if ((W.enemies || []).filter((e) => e.alive).length === 0) advance(W);
      break;
  }
}
