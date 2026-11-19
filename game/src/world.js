// World: builds Port Meridian — grid streets, buildings with lit windows,
// lamps, trees, marina water at the south edge, sky and lighting.
// Also records building colliders used by player, cars and AI.
import * as THREE from 'three';
import { CFG, mulberry32 } from './config.js';

function windowTexture(base, lit) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const rnd = mulberry32(base.length * 7919 + lit.length);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 22) {
      const on = rnd() < 0.42;
      g.fillStyle = on ? lit : '#10151c';
      g.fillRect(x, y, 14, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene, W) {
  const rnd = mulberry32(20261119);
  W.colliders = [];
  W.streets = [];
  const pitch = CFG.block + CFG.road; // 58
  for (let i = -CFG.blocks; i <= CFG.blocks; i++) W.streets.push(i * pitch);

  // Sky, fog, lights
  scene.background = new THREE.Color(CFG.colors.sky);
  scene.fog = new THREE.Fog(CFG.colors.fog, 180, 520);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(120, 180, 60); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.9));

  // Ground + water + beach (marina at the south edge, z > 250)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: CFG.colors.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0); scene.add(ground);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 120),
    new THREE.MeshLambertMaterial({ color: CFG.colors.water }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, 310); scene.add(water);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 22),
    new THREE.MeshLambertMaterial({ color: CFG.colors.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, 242); scene.add(sand);

  // Roads: dark strips along every street line, plus sidewalk frames
  const roadMat = new THREE.MeshLambertMaterial({ color: CFG.colors.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: CFG.colors.sidewalk });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c0 });
  for (const s of W.streets) {
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(520, CFG.road), roadMat);
    r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.01, s); scene.add(r1);
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(CFG.road, 520), roadMat);
    r2.rotation.x = -Math.PI / 2; r2.position.set(s, 0.01, 0); scene.add(r2);
    // dashed centre lines
    for (let d = -240; d <= 240; d += 16) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
      a.rotation.x = -Math.PI / 2; a.position.set(d, 0.03, s); scene.add(a);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
      b.rotation.x = -Math.PI / 2; b.position.set(s, 0.03, d); scene.add(b);
    }
  }

  // Buildings: 1-3 towers per block, varied heights and facades
  const facades = [
    windowTexture('#5a6b7d', '#ffd98a'),
    windowTexture('#7d5a4a', '#ffe9b0'),
    windowTexture('#4a5a6b', '#aee2ff'),
    windowTexture('#6b5a7d', '#ffd98a'),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x223344, emissive: 0x113344 });
  let built = 0;
  for (let bx = -CFG.blocks; bx < CFG.blocks; bx++) {
    for (let bz = -CFG.blocks; bz < CFG.blocks; bz++) {
      const cx = bx * pitch + pitch / 2, cz = bz * pitch + pitch / 2;
      // skip central plaza block (0,0) and the marina block row
      if (bx === 0 && bz === 0) continue;
      if (bz === CFG.blocks - 1 && bx >= 0) continue; // open marina promenade
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const w = 12 + rnd() * 10, d = 12 + rnd() * 10;
        const h = 14 + rnd() * rnd() * 55;
        const ox = (k % 2 === 0 ? -1 : 1) * (6 + rnd() * 6);
        const oz = (k < 2 ? -1 : 1) * (6 + rnd() * 6);
        const x = cx + ox, z = cz + oz;
        const mat = new THREE.MeshLambertMaterial({ map: facades[Math.floor(rnd() * facades.length)] });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2, z); scene.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
        roof.position.set(x, h + 0.4, z); scene.add(roof);
        if (h > 42) { // rooftop beacon
          const bc = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff3344 }));
          bc.position.set(x, h + 1.6, z); scene.add(bc);
          W.beacons = W.beacons || []; W.beacons.push(bc);
        }
        W.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        built++;
      }
    }
  }
  W.buildingCount = built;

  // Central plaza: fountain, benches, the yellow coupe's home
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 0.6, 24),
    new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }));
  plaza.position.set(29, 0.3, 29); scene.add(plaza);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 1.6, 16),
    new THREE.MeshLambertMaterial({ color: 0x2e7f9e }));
  fountain.position.set(29, 1.1, 29); scene.add(fountain);

  // Lamps along streets + trees on sidewalks
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222528 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3d24 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  for (const s of W.streets) {
    for (let d = -220; d <= 220; d += 58) {
      if (Math.abs(d - s) < 20) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 6), poleMat);
      pole.position.set(d, 2.5, s + CFG.road / 2 + 1.2); scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampMat);
      lamp.position.set(d, 5.1, s + CFG.road / 2 + 1.2); scene.add(lamp);
      if (rnd() < 0.5) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), trunkMat);
        trunk.position.set(d + 4, 1.2, s - CFG.road / 2 - 1.6); scene.add(trunk);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 8), leafMat);
        leaf.position.set(d + 4, 4.4, s - CFG.road / 2 - 1.6); scene.add(leaf);
      }
    }
  }

  // Marina: pier + boats at the south edge
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 0.8, 8),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
  pier.position.set(-40, 0.4, 262); scene.add(pier);
  for (let i = 0; i < 4; i++) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 3),
      new THREE.MeshLambertMaterial({ color: [0xffffff, 0xff5533, 0x33aaff, 0xffcc33][i] }));
    hull.position.set(-62 + i * 16, 0.8, 276); scene.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 6), poleMat);
    mast.position.set(-62 + i * 16, 4, 276); scene.add(mast);
  }

  // Landmark towers so the skyline reads at a glance
  const tower = new THREE.Mesh(new THREE.BoxGeometry(16, 78, 16),
    new THREE.MeshLambertMaterial({ map: facades[2], emissive: 0x0a1420 }));
  tower.position.set(-174, 39, -174); scene.add(tower);
  W.colliders.push({ minX: -182, maxX: -166, minZ: -182, maxZ: -166 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xd8a03c, emissive: 0x332200 }));
  dome.position.set(174, 26, 174); scene.add(dome);
  W.colliders.push({ minX: 165, maxX: 183, minZ: 165, maxZ: 183 });
}

// Push a circle (radius r) out of every building collider it overlaps.
export function collideBuildings(W, pos, r) {
  for (const c of W.colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r; pos.z = nz + (dz / d) * r;
      return true;
    }
    if (d2 <= 0.0001) { pos.x += r; return true; }
  }
  return false;
}
export function clampCity(pos, margin) {
  const m = margin || 0;
  pos.x = Math.max(-235 + m, Math.min(235 - m, pos.x));
  pos.z = Math.max(-235 + m, Math.min(238 - m, pos.z));
}
