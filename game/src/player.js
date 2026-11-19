// Player: on-foot movement, enter/exit cars, third-person camera.
// Camera orbits with mouse drag; while driving it trails behind the car.
import * as THREE from 'three';
import { CFG, angleLerp } from './config.js';
import { axis, pressed, consumeMouseDelta } from './input.js';
import { collideBuildings, clampCity } from './world.js';
import { sfx } from './audio.js';

export function makePlayer(scene) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1e5c46 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.72; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46),
    new THREE.MeshLambertMaterial({ color: 0xd8b13c }));
  cap.position.y = 1.96; g.add(cap);
  for (const sx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.26), pants);
    leg.position.set(sx, 0.35, 0); g.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.22), jacket);
    arm.position.set(sx * 1.7, 1.05, 0); g.add(arm);
  }
  // pistol in hand (visible when armed)
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.38, 1.0, 0.25); gun.visible = false; g.add(gun);
  scene.add(g);
  return {
    group: g, gun, pos: g.position, heading: 0, speed: 0,
    car: null, // car object when driving
    velY: 0, onGround: true, punchTimer: 0, stepTimer: 0,
  };
}

export function updatePlayer(W, dt) {
  const P = W.player;
  const cam = W.camera;
  // mouse orbit
  const md = consumeMouseDelta();
  W.camYaw -= md.x * 0.005;
  W.camPitch = Math.max(-0.1, Math.min(0.9, W.camPitch + md.y * 0.003));

  if (P.car) { updateDrivingCamera(W, dt); return; }

  const a = axis();
  const run = pressed('ShiftLeft') || pressed('ShiftRight');
  const speed = run ? CFG.playerRun : CFG.playerWalk;
  // movement relative to camera yaw
  const fx = Math.sin(W.camYaw), fz = Math.cos(W.camYaw);
  const rx = Math.cos(W.camYaw), rz = -Math.sin(W.camYaw);
  let mx = fx * a.f + rx * a.s;
  let mz = fz * a.f + rz * a.s;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    P.pos.x += mx * speed * dt; P.pos.z += mz * speed * dt;
    P.heading = angleLerp(P.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
    P.speed = speed;
    P.stepTimer -= dt;
  } else P.speed = 0;
  // simple jump
  if (pressed('Space') && P.onGround) { P.velY = 6.5; P.onGround = false; }
  if (!P.onGround) {
    P.velY -= 18 * dt; P.pos.y += P.velY * dt;
    if (P.pos.y <= 0) { P.pos.y = 0; P.velY = 0; P.onGround = true; }
  }
  collideBuildings(W, P.pos, 0.6);
  clampCity(P.pos, 1);
  P.group.position.copy(P.pos);
  P.group.rotation.y = P.heading;
  // walk bob
  P.group.position.y = P.pos.y + (P.speed > 0 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.06 : 0);
  P.punchTimer = Math.max(0, P.punchTimer - dt);

  // camera: behind player at camYaw
  const dist = 7.5, height = 3.2 + W.camPitch * 4;
  const tx = P.pos.x - Math.sin(W.camYaw) * dist;
  const tz = P.pos.z - Math.cos(W.camYaw) * dist;
  cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 6);
  cam.position.y += (height - cam.position.y) * Math.min(1, dt * 6);
  cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 6);
  cam.lookAt(P.pos.x, P.pos.y + 1.6, P.pos.z);
}

function updateDrivingCamera(W, dt) {
  const P = W.player, car = P.car, cam = W.camera;
  // camera follows car heading, mouse can offset yaw
  const md = { x: 0, y: 0 };
  const followYaw = car.heading + Math.PI + W.driveCamOffset;
  const dist = 10.5, height = 4.2 + W.camPitch * 3;
  const tx = car.group.position.x + Math.sin(followYaw) * dist;
  const tz = car.group.position.z + Math.cos(followYaw) * dist;
  cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 4.5);
  cam.position.y += (height - cam.position.y) * Math.min(1, dt * 4.5);
  cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 4.5);
  cam.lookAt(car.group.position.x, 1.4, car.group.position.z);
  // decay the mouse offset back to straight behind
  W.driveCamOffset *= Math.max(0, 1 - dt * 0.4);
}

export function enterCar(W, car) {
  const P = W.player;
  P.car = car; car.isPlayer = true; car.parked = false;
  P.group.visible = false;
  W.driveCamOffset = 0;
  sfx.click();
}
export function exitCar(W) {
  const P = W.player;
  if (!P.car) return;
  const car = P.car;
  car.isPlayer = false;
  const fwd = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
  P.pos.set(car.group.position.x - fwd.x * 2.4, 0, car.group.position.z - fwd.z * 2.4);
  P.group.position.copy(P.pos);
  P.group.visible = true;
  P.car = null;
  W.camYaw = car.heading;
}
