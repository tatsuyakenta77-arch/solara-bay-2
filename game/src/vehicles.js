// Vehicles: car factory (box-built bodies, no external art) and arcade driving.
// Cars are groups: body, cabin, wheels, lights. Player car and parked cars share this.
import * as THREE from 'three';
import { CFG, clamp, angleLerp } from './config.js';
import { collideBuildings, clampCity } from './world.js';
import { burstSmoke, burstSparks } from './particles.js';
import { sfx } from './audio.js';

const BODY_COLORS = [0xcc2222, 0x2255cc, 0x22aa55, 0xdddddd, 0x222222, 0xff8800, 0x8833cc, 0x33aabb];
let colorIdx = 0;

export function makeCar(color, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: color ?? BODY_COLORS[colorIdx++ % BODY_COLORS.length] });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18242e, emissive: 0x0a1a24 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.18, -0.2); g.add(cabin);
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.25, 0.3), dark);
  bumpF.position.set(0, 0.42, 2.2); g.add(bumpF);
  const bumpR = bumpF.clone(); bumpR.position.z = -2.2; g.add(bumpR);
  // headlights / taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hl);
    h.position.set(sx, 0.68, 2.24); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    t.position.set(sx, 0.68, -2.24); g.add(t);
  }
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
  }
  const car = {
    group: g, wheels, speed: 0, heading: o.heading ?? 0, steer: 0,
    isCop: !!o.isCop, isPlayer: false, parked: !!o.parked, target: o.target || null,
    health: 100, smokeTimer: 0, color,
  };
  g.position.set(o.x || 0, 0, o.z || 0);
  g.rotation.y = car.heading;
  if (o.isCop) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    bar.position.set(0, 1.55, -0.2); g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar2.position.set(0, 1.55, -0.2); bar2.position.x = 0.35; g.add(bar2);
    car.lightBar = [bar, bar2];
    const decal = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    decal.position.set(0, 0.75, 0.6); g.add(decal);
  }
  return car;
}

// Arcade driving: accelerate, steer (speed-scaled), drag, building collision.
export function driveCar(W, car, fwd, steer, dt) {
  const prevX = car.group.position.x, prevZ = car.group.position.z;
  if (fwd > 0) car.speed += CFG.carAccel * fwd * dt;
  else if (fwd < 0) car.speed += (car.speed > 0.5 ? -CFG.carBrake : CFG.carAccel * 0.55 * fwd) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (Math.abs(car.speed) < 0.05 && fwd === 0) car.speed = 0;
  car.speed = clamp(car.speed, -CFG.carReverseMax, CFG.carMaxSpeed);
  const steerTarget = steer * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * CFG.carTurn * clamp(Math.abs(car.speed) / 12, 0, 1) * dt * (car.speed >= 0 ? 1 : -1);
  const p = car.group.position;
  p.x += Math.sin(car.heading) * car.speed * dt;
  p.z += Math.cos(car.heading) * car.speed * dt;
  const hit = collideBuildings(W, p, 2.2);
  if (hit) {
    if (Math.abs(car.speed) > 12) { burstSparks(p.x, 0.8, p.z, 8); sfx.crash(); car.health -= 6; }
    car.speed *= 0.4;
    // if still stuck inside, roll back
    if (collideBuildings(W, p, 2.2)) { p.x = prevX; p.z = prevZ; car.speed *= 0.3; }
  }
  clampCity(p, 4);
  car.group.rotation.y = car.heading;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
  // damage smoke
  car.smokeTimer -= dt;
  if (car.health < 45 && car.smokeTimer <= 0) {
    car.smokeTimer = 0.12;
    burstSmoke(p.x, 1.2, p.z, 2);
  }
  if (car.health <= 0) return 'wrecked';
  return 'ok';
}

export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}
