// Particles: pooled small meshes for smoke, sparks, muzzle flash and explosions.
import * as THREE from 'three';

let pool = [];
let sceneRef = null;
const GEO = new THREE.BoxGeometry(0.22, 0.22, 0.22);
const MATS = {};
function mat(color) {
  if (!MATS[color]) MATS[color] = new THREE.MeshBasicMaterial({ color, transparent: true });
  return MATS[color];
}
export function initParticles(scene) {
  sceneRef = scene;
  pool = [];
  for (let i = 0; i < 220; i++) {
    const m = new THREE.Mesh(GEO, mat(0xffffff));
    m.visible = false; scene.add(m);
    pool.push({ mesh: m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 0 });
  }
}
function spawn(x, y, z, color, vx, vy, vz, life, grow) {
  const p = pool.find((q) => q.life <= 0);
  if (!p) return;
  p.mesh.visible = true; p.mesh.position.set(x, y, z);
  p.mesh.material = mat(color); p.mesh.material.opacity = 1;
  p.mesh.scale.setScalar(1);
  p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.grow = grow || 0;
}
export function burstSmoke(x, y, z, n) {
  for (let i = 0; i < (n || 6); i++) {
    spawn(x + (Math.random() - 0.5), y + Math.random() * 0.4, z + (Math.random() - 0.5),
      0x999999, (Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2, 0.9, 1.6);
  }
}
export function burstSparks(x, y, z, n) {
  for (let i = 0; i < (n || 10); i++) {
    spawn(x, y, z, Math.random() < 0.5 ? 0xffcc33 : 0xff6622,
      (Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8, 0.5, 0);
  }
}
export function burstBlood(x, y, z) {
  for (let i = 0; i < 8; i++) {
    spawn(x, y, z, 0xaa1111, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.6, 0);
  }
}
export function burstExplosion(x, y, z) {
  for (let i = 0; i < 26; i++) {
    const c = [0xff4400, 0xffaa00, 0xffdd55, 0x777777][i % 4];
    spawn(x, y + 0.5, z, c, (Math.random() - 0.5) * 12, Math.random() * 9, (Math.random() - 0.5) * 12, 0.9, 2.2);
  }
}
export function muzzleFlash(x, y, z) {
  spawn(x, y, z, 0xffee88, 0, 0, 0, 0.08, 3);
}
export function updateParticles(dt) {
  for (const p of pool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
    p.vy -= 1.5 * dt;
    if (p.grow) p.mesh.scale.addScalar(p.grow * dt);
    p.mesh.material.opacity = Math.max(0, p.life / p.max);
  }
}
