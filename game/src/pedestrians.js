// Pedestrians: walkers on the sidewalks with random waypoints.
// They flee when a car comes close or a shot is fired; hitting one raises wanted.
import * as THREE from 'three';
import { CFG, mulberry32, dist2d } from './config.js';
import { burstBlood } from './particles.js';

const SHIRTS = [0xd84a4a, 0x4a7dd8, 0x4ad87d, 0xd8c24a, 0x9a4ad8, 0xdddddd, 0x222222, 0xe08a3c];

export function makePed(scene, x, z, rnd) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rnd() * SHIRTS.length)] });
  const skin = new THREE.MeshLambertMaterial({ color: [0xc98d64, 0x8a5a3b, 0xe8b98a][Math.floor(rnd() * 3)] });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), shirt);
  body.position.y = 1.0; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
  head.position.y = 1.62; g.add(head);
  for (const sx of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pants);
    leg.position.set(sx, 0.31, 0); g.add(leg);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  return { group: g, pos: g.position, heading: rnd() * Math.PI * 2, speed: 1.2 + rnd() * 1.2, tx: x, tz: z, flee: 0, alive: true, bob: rnd() * 6 };
}

export function initPeds(W, scene, count) {
  const rnd = mulberry32(4242);
  W.peds = [];
  for (let i = 0; i < (count || 22); i++) {
    const x = -220 + rnd() * 440, z = -220 + rnd() * 440;
    W.peds.push(makePed(scene, x, z, rnd));
    pickTarget(W.peds[W.peds.length - 1]);
  }
}
function pickTarget(p) {
  p.tx = p.pos.x + (Math.random() - 0.5) * 120;
  p.tz = p.pos.z + (Math.random() - 0.5) * 120;
  p.tx = Math.max(-230, Math.min(230, p.tx));
  p.tz = Math.max(-230, Math.min(230, p.tz));
}

export function updatePeds(W, dt) {
  const P = W.player;
  for (const p of W.peds) {
    if (!p.alive) continue;
    // flee from the player's car or from gunfire
    const dCar = P.car ? dist2d(p.pos.x, p.pos.z, P.car.group.position.x, P.car.group.position.z) : 999;
    const dFoot = dist2d(p.pos.x, p.pos.z, P.pos.x, P.pos.z);
    if ((P.car && dCar < 8) || W.gunshotTimer > 0) p.flee = 2.5;
    p.flee = Math.max(0, p.flee - dt);
    let tx = p.tx, tz = p.tz;
    if (p.flee > 0) { tx = p.pos.x + (p.pos.x - P.pos.x); tz = p.pos.z + (p.pos.z - P.pos.z); }
    const dx = tx - p.pos.x, dz = tz - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) { if (p.flee <= 0) pickTarget(p); }
    else {
      const sp = p.speed * (p.flee > 0 ? 2.6 : 1);
      p.pos.x += (dx / d) * sp * dt; p.pos.z += (dz / d) * sp * dt;
      p.heading = Math.atan2(dx, dz);
    }
    p.bob += dt * (p.flee > 0 ? 14 : 8);
    p.group.position.y = Math.abs(Math.sin(p.bob)) * 0.05;
    p.group.rotation.y = p.heading;
    // run over by the player's car
    if (P.car && Math.abs(P.car.speed) > 4 && dCar < 2.2) {
      killPed(W, p, true);
    }
  }
}
export function killPed(W, p, byCar) {
  if (!p.alive) return;
  p.alive = false;
  p.group.visible = false;
  burstBlood(p.pos.x, 1, p.pos.z);
  if (byCar || true) W.addWanted(1, 'pedestrian down');
  // respawn a fresh walker elsewhere after a while
  setTimeout(() => {
    if (!W.running) return;
    p.pos.set(-220 + Math.random() * 440, 0, -220 + Math.random() * 440);
    p.group.position.copy(p.pos);
    p.group.visible = true; p.alive = true;
    pickTarget(p);
  }, 20000);
}
export function nearestPed(W, x, z, maxD) {
  let best = null, bd = maxD;
  for (const p of W.peds) {
    if (!p.alive) continue;
    const d = dist2d(x, z, p.pos.x, p.pos.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
