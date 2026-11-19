// Police: wanted level, cop spawning, pursuit AI, bust and escape rules.
import { makeCar } from './vehicles.js';
import { dist2d, clamp } from './config.js';
import { setSiren, sfx } from './audio.js';
import { burstExplosion } from './particles.js';

export function initPolice(W, scene) {
  W.cops = [];
  W.wanted = 0;
  W.hiddenTimer = 0;
  W.bustedTimer = 0;
  W.sirenOn = false;
}

export function addWanted(W, stars, reason) {
  const before = W.wanted;
  W.wanted = clamp(W.wanted + stars, 0, 5);
  W.hiddenTimer = 0;
  if (W.wanted > before) {
    W.showMessage(`WANTED ${'★'.repeat(W.wanted)} — ${reason || 'the cops are coming'}`, 2600);
    if (W.wanted >= 2) sfx.sirenBlip();
  }
  updateCopCount(W);
}

export function updateCopCount(W) {
  const want = W.wanted === 0 ? 0 : Math.min(6, 1 + W.wanted);
  while (W.cops.length < want) spawnCop(W);
  while (W.cops.length > want) {
    const c = W.cops.pop();
    W.scene.remove(c.group);
  }
}

function spawnCop(W) {
  const P = W.player;
  const px = P.car ? P.car.group.position.x : P.pos.x;
  const pz = P.car ? P.car.group.position.z : P.pos.z;
  const ang = Math.random() * Math.PI * 2;
  const x = Math.max(-230, Math.min(230, px + Math.cos(ang) * 55));
  const z = Math.max(-230, Math.min(230, pz + Math.sin(ang) * 55));
  const car = makeCar(0x111111, { x, z, heading: ang, isCop: true });
  // white body with black hood reads as a police car
  car.group.children[0].material = car.group.children[0].material.clone();
  W.scene.add(car.group);
  W.cops.push(car);
  return car;
}

export function updatePolice(W, dt) {
  const P = W.player;
  const px = P.car ? P.car.group.position.x : P.pos.x;
  const pz = P.car ? P.car.group.position.z : P.pos.z;
  const seen = W.wanted > 0;
  setSiren(seen);
  // wanted decay: stay out of cop sight for a while and a star drops
  if (W.wanted > 0) {
    let nearest = 999;
    for (const c of W.cops) nearest = Math.min(nearest, dist2d(px, pz, c.group.position.x, c.group.position.z));
    if (nearest > 60) {
      W.hiddenTimer += dt;
      if (W.hiddenTimer > 6) { W.wanted--; W.hiddenTimer = 0; W.showMessage(`Wanted level dropped to ${W.wanted} ★`, 2000); updateCopCount(W); }
    } else W.hiddenTimer = 0;
  }
  for (const cop of W.cops) {
    const p = cop.group.position;
    const d = dist2d(px, pz, p.x, p.z);
    // steer toward the player, arcade style
    const wantHeading = Math.atan2(px - p.x, pz - p.z);
    let dh = wantHeading - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    cop.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
    const speed = d > 12 ? 30 : 22;
    cop.speed += (speed - cop.speed) * Math.min(1, dt * 1.2);
    p.x += Math.sin(cop.heading) * cop.speed * dt;
    p.z += Math.cos(cop.heading) * cop.speed * dt;
    cop.group.rotation.y = cop.heading;
    for (const w of cop.wheels) w.rotation.x += cop.speed * dt * 2;
    // flashing light bar
    if (cop.lightBar) {
      const on = Math.floor(performance.now() / 180) % 2 === 0;
      cop.lightBar[0].material.color.setHex(on ? 0xff0000 : 0x330000);
      cop.lightBar[1].material.color.setHex(on ? 0x002266 : 0x2266ff);
    }
    // ram the player's car
    if (P.car && d < 3.4) {
      P.car.health -= 14 * dt;
      cop.speed *= 0.92;
      if (Math.random() < dt * 2) sfx.crash();
      if (P.car.health <= 0) {
        burstExplosion(p.x, 1, p.z);
        sfx.crash();
        W.showMessage('Your car is wrecked — get out and run!', 3000);
        P.car.health = 40; // limp on, don't soft-lock the player
      }
    }
    // bust: cop reaches the player on foot and stays close
    if (!P.car && d < 2.6) {
      W.bustedTimer += dt;
      if (W.bustedTimer > 1.6) { bustPlayer(W); return; }
    }
  }
  if (!P.car && W.cops.every((c) => dist2d(px, pz, c.group.position.x, c.group.position.z) > 3)) W.bustedTimer = Math.max(0, W.bustedTimer - dt);
}

function bustPlayer(W) {
  const P = W.player;
  W.bustedTimer = 0;
  const fine = Math.min(W.cash, 300);
  W.cash -= fine;
  W.wanted = 0;
  updateCopCount(W);
  sfx.busted();
  W.showMessage(`BUSTED! The cops took $${fine} and dropped you at the precinct.`, 4200);
  P.pos.set(0, 0, 0); P.group.position.copy(P.pos);
  P.health = Math.max(50, P.health);
  W.setHealth(P.health);
}
