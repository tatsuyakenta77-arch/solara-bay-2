// Combat: pistol shooting (raycast), melee punch, rival enemies with health.
// Enemies chase the player on foot and shoot back (inaccurately).
import * as THREE from 'three';
import { dist2d } from './config.js';
import { burstBlood, burstSparks, muzzleFlash } from './particles.js';
import { sfx } from './audio.js';
import { nearestPed, killPed } from './pedestrians.js';

const ray = new THREE.Raycaster();

export function initCombat(W, scene) {
  W.enemies = [];
  W.gunshotTimer = 0;
  W.scene = scene;
}

export function spawnEnemies(W, x, z, count) {
  clearEnemies(W);
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0x882222 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), shirt);
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    head.position.y = 1.72; g.add(head);
    // health bar above head
    const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x330000 }));
    barBg.position.y = 2.15; g.add(barBg);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
    bar.position.y = 2.15; g.add(bar);
    // gun
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.34), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.38, 1.0, 0.25); g.add(gun);
    g.position.set(x + (Math.random() - 0.5) * 16, 0, z + (Math.random() - 0.5) * 16);
    W.scene.add(g);
    W.enemies.push({ group: g, pos: g.position, bar, health: 100, alive: true, shootTimer: 1 + Math.random() * 2 });
  }
}
export function clearEnemies(W) {
  for (const e of W.enemies || []) W.scene.remove(e.group);
  W.enemies = [];
}

function damageEnemy(W, e, dmg) {
  e.health -= dmg;
  e.bar.scale.x = Math.max(0.01, e.health / 100);
  burstBlood(e.pos.x, 1.4, e.pos.z);
  if (e.health <= 0) {
    e.alive = false; e.group.visible = false;
    W.cash += 50;
    W.showMessage('Rival down — +$50', 1600);
  }
}

export function shoot(W) {
  const P = W.player;
  if (P.car || W.ammo <= 0) return;
  W.ammo--;
  W.gunshotTimer = 1.2;
  sfx.shoot();
  const origin = new THREE.Vector3(P.pos.x, P.pos.y + 1.5, P.pos.z);
  const dir = new THREE.Vector3(Math.sin(P.heading), -0.02, Math.cos(P.heading));
  muzzleFlash(origin.x + dir.x, origin.y, origin.z + dir.z);
  ray.set(origin, dir.normalize());
  ray.far = 60;
  // enemies first
  const targets = [];
  for (const e of W.enemies) if (e.alive) targets.push(e.group);
  for (const p of W.peds) if (p.alive) targets.push(p.group);
  const hits = ray.intersectObjects(targets, true);
  if (hits.length) {
    let obj = hits[0].object;
    while (obj.parent && obj.parent !== W.scene) obj = obj.parent;
    const e = W.enemies.find((en) => en.group === obj);
    if (e) { damageEnemy(W, e, 34); return; }
    const p = W.peds.find((pd) => pd.group === obj);
    if (p) { killPed(W, p, false); W.addWanted(1, 'shots fired'); return; }
  }
  // missed: spark where the ray ends
  const end = origin.clone().add(dir.multiplyScalar(40));
  burstSparks(end.x, 1, end.z, 3);
}

export function punch(W) {
  const P = W.player;
  if (P.car || P.punchTimer > 0) return;
  P.punchTimer = 0.45;
  sfx.punch();
  const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
  const tx = P.pos.x + fx * 1.6, tz = P.pos.z + fz * 1.6;
  const e = W.enemies.find((en) => en.alive && dist2d(tx, tz, en.pos.x, en.pos.z) < 1.6);
  if (e) { damageEnemy(W, e, 25); sfx.hit(); return; }
  const p = nearestPed(W, tx, tz, 1.8);
  if (p) { killPed(W, p, false); }
}

export function updateCombat(W, dt) {
  W.gunshotTimer = Math.max(0, W.gunshotTimer - dt);
  const P = W.player;
  for (const e of W.enemies) {
    if (!e.alive) continue;
    const d = dist2d(e.pos.x, e.pos.z, P.pos.x, P.pos.z);
    if (P.car) { // enemies can't reach a driver; they stand and jeer
      e.group.lookAt(P.car.group.position.x, 0, P.car.group.position.z);
      continue;
    }
    if (d > 2.2) {
      const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      e.pos.x += (dx / len) * 4.2 * dt; e.pos.z += (dz / len) * 4.2 * dt;
      e.group.rotation.y = Math.atan2(dx, dz);
    } else {
      e.group.rotation.y = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
    }
    // shoot back from range
    e.shootTimer -= dt;
    if (d < 26 && e.shootTimer <= 0) {
      e.shootTimer = 1.6 + Math.random() * 1.4;
      muzzleFlash(e.pos.x, 1.4, e.pos.z);
      sfx.shoot();
      if (Math.random() < 0.3) {
        W.health -= 8;
        W.setHealth(W.health);
        sfx.hit();
        burstBlood(P.pos.x, 1.2, P.pos.z);
        if (W.health <= 0) respawnPlayer(W);
      }
    }
  }
}

function respawnPlayer(W) {
  const P = W.player;
  W.health = 100; W.setHealth(100);
  W.cash = Math.max(0, W.cash - 200);
  P.pos.set(0, 0, 0); P.group.position.copy(P.pos);
  W.showMessage('You got taken out — woke up at the clinic, -$200.', 4000);
  clearEnemies(W);
  // restart the current fight step if one was active
  if (W.missionState === 'active') {
    const s = W.missionStep;
    W.missionStep = s;
  }
}
