// Meridian Heat — main entry. Boots Three.js, wires every system, runs the loop.
// Original open-world crime game set in Port Meridian.
import * as THREE from 'three';
import { CFG, MISSIONS, clamp } from './config.js';
import { initInput, pressed, axis, consumeClick } from './input.js';
import { initAudio, resumeAudio, setEngine, sfx, toggleMute } from './audio.js';
import { initParticles, updateParticles, burstSmoke } from './particles.js';
import { buildWorld } from './world.js';
import { makePlayer, updatePlayer, enterCar, exitCar } from './player.js';
import { makeCar, driveCar } from './vehicles.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPeds, updatePeds, nearestPed } from './pedestrians.js';
import { initPolice, updatePolice, addWanted, updateCopCount } from './police.js';
import { initMissions, updateMissions, currentMission } from './missions.js';
import { initCombat, updateCombat, shoot, punch, spawnEnemies } from './combat.js';
import { initHUD, updateHUD, showMessage, setObjective, setHealth, showStart, hideStart, showPause } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { applyShot } from './shots.js';

const W = {
  running: true, started: false, paused: false, shotMode: false,
  cash: CFG.startCash, health: CFG.maxHealth, ammo: CFG.startAmmo,
  wanted: 0, missionIndex: 0, missionsDone: 0, missionState: 'idle',
  missions: MISSIONS, camYaw: 0, camPitch: 0.25, driveCamOffset: 0,
  parkedCars: [], traffic: [], peds: [], cops: [], enemies: [],
  gunshotTimer: 0, interactCooldown: 0, saveTimer: 0,
};

function boot() {
  const params = new URLSearchParams(location.search);
  W.shotMode = params.has('shot');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.getElementById('game').appendChild(renderer.domElement);
  W.renderer = renderer;

  const scene = new THREE.Scene();
  W.scene = scene;
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
  camera.position.set(0, 8, -14);
  W.camera = camera;

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  initInput();
  initAudio();
  initParticles(scene);
  buildWorld(scene, W);
  initHUD(W);

  // player
  W.player = makePlayer(scene);
  W.player.pos.set(0, 0, 20);
  W.player.group.position.copy(W.player.pos);

  // starter car by the garage + parked cars around the city
  W.starterCar = makeCar(0xcc2222, { x: 6, z: 26, heading: Math.PI / 2, parked: true });
  scene.add(W.starterCar.group);
  W.parkedCars.push(W.starterCar);
  const spots = [
    [0xff8800, -58, 62, 0], [0x2255cc, 116, -58, Math.PI / 2], [0xdddddd, -116, -116, 0],
    [0x22aa55, 58, 174, Math.PI], [0x8833cc, -174, 58, Math.PI / 2], [0x222222, 174, -116, 0],
    [0xffcc33, 40, 40, Math.PI / 4], // the yellow coupe for mission 3 (target)
  ];
  for (const [color, x, z, h] of spots) {
    const car = makeCar(color, { x, z, heading: h, parked: true });
    scene.add(car.group);
    W.parkedCars.push(car);
  }
  W.targetCoupe = W.parkedCars[W.parkedCars.length - 1];

  initTraffic(W, scene, 14);
  initPeds(W, scene, 22);
  initPolice(W, scene);
  initCombat(W, scene);

  // ---- HUD / state helpers used by other modules (defined BEFORE missions init) ----
  W.showMessage = (t, ms) => showMessage(W, t, ms);
  W.setObjective = (t) => setObjective(W, t);
  W.setHealth = (v) => { W.health = v; setHealth(W, v); };
  W.setWanted = (v) => { W.wanted = clamp(v, 0, 5); updateCopCount(W); };
  W.addWanted = (stars, reason) => addWanted(W, stars, reason);
  W.spawnEnemies = (x, z, n) => spawnEnemies(W, x, z, n);
  W.setMissionMarker = (x, z) => {
    W.marker.visible = true; W.marker.position.set(x, 0.15, z);
  };
  W.setMissionLabel = (t) => { document.getElementById('hudMission').textContent = t; };
  W.hideStartScreen = () => hideStart();

  initMissions(W, scene);

  // ---- menus ----
  showStart(W, hasSave());
  document.getElementById('startBtn').addEventListener('click', () => startGame(false));
  document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
  document.getElementById('howBtn').addEventListener('click', () => {
    document.getElementById('howPanel').style.display =
      document.getElementById('howPanel').style.display === 'block' ? 'none' : 'block';
  });
  document.getElementById('resumeBtn').addEventListener('click', () => togglePause(false));
  document.getElementById('restartBtn').addEventListener('click', () => location.reload());
  document.getElementById('quitBtn').addEventListener('click', () => { saveGame(W); togglePause(false); showStart(W, true); W.started = false; });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && W.started) togglePause(!W.paused);
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'KeyE') tryInteract();
  });

  // ---- shot staging ----
  if (W.shotMode) {
    applyShot(W, params);
    W.paused = false;
  }

  const clock = new THREE.Clock();
  let fpsFrames = 0, fpsTime = 0;
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (W.started && !W.paused) tick(dt);
    // beacons blink even on the menu
    if (W.beacons) for (const b of W.beacons) b.visible = Math.floor(performance.now() / 500) % 2 === 0;
    renderer.render(scene, camera);
    fpsFrames++; fpsTime += dt;
    if (fpsTime >= 1) { W.fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
  }
  loop();
  window.__game = W; // exposed for playtesting / debugging
  window.__ready = true;
}

function startGame(continueSave) {
  initAudio(); resumeAudio();
  if (continueSave) {
    const s = loadGame();
    if (s) {
      W.cash = s.cash; W.missionIndex = s.missionIndex; W.missionsDone = s.missionsDone || 0;
      W.health = s.health ?? CFG.maxHealth; W.ammo = s.ammo ?? CFG.startAmmo;
      W.player.pos.set(s.x || 0, 0, s.z || 20);
      W.player.group.position.copy(W.player.pos);
      W.showMessage('Save loaded — welcome back to Port Meridian.', 3000);
    }
  }
  W.started = true;
  hideStart();
  sfx.mission();
  W.setObjective(currentMission(W).steps[0].text);
}

function togglePause(on) {
  W.paused = on;
  showPause(W, on);
  if (!on) resumeAudio();
}

function tryInteract() {
  if (!W.started || W.paused || W.interactCooldown > 0) return;
  const P = W.player;
  if (P.car) { exitCar(W); W.interactCooldown = 0.35; return; }
  // nearest parked / traffic car within reach
  let best = null, bd = 3.2;
  for (const car of [...W.parkedCars, ...W.traffic]) {
    const d = Math.hypot(car.group.position.x - P.pos.x, car.group.position.z - P.pos.z);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) {
    enterCar(W, best);
    W.parkedCars = W.parkedCars.filter((c) => c !== best);
    W.traffic = W.traffic.filter((c) => c !== best); // carjacked out of traffic
    if (best.parked || best === W.targetCoupe) {
      // stealing a parked car is a crime
      W.addWanted(1, 'car stolen — witnesses called the cops');
      sfx.horn();
    }
    W.interactCooldown = 0.35;
  }
}

function tick(dt) {
  const P = W.player;
  W.interactCooldown = Math.max(0, W.interactCooldown - dt);
  if (!W.shotMode) updatePlayer(W, dt);
  else if (P.car) {
    // staged shots: keep the car rolling slowly for life, camera stays staged
    P.car.speed = P.car.speed || 0;
    P.car.group.position.x += Math.sin(P.car.heading) * P.car.speed * dt;
    P.car.group.position.z += Math.cos(P.car.heading) * P.car.speed * dt;
    P.car.group.rotation.y = P.car.heading;
    for (const w of P.car.wheels) w.rotation.x += P.car.speed * dt * 2;
  }

  // driving
  if (P.car && !W.shotMode) {
    const a = axis();
    const handbrake = pressed('Space');
    const res = driveCar(W, P.car, handbrake ? 0 : a.f, a.s, dt);
    if (handbrake) P.car.speed -= Math.sign(P.car.speed) * Math.min(Math.abs(P.car.speed), 30 * dt);
    if (res === 'wrecked') { W.showMessage('Car wrecked!', 2500); }
    setEngine(Math.abs(P.car.speed) / CFG.carMaxSpeed, true);
    // exhaust puffs
    if (Math.abs(P.car.speed) > 5 && Math.random() < dt * 6) {
      const b = P.car.group.position;
      burstSmoke(b.x - Math.sin(P.car.heading) * 2.2, 0.5, b.z - Math.cos(P.car.heading) * 2.2, 1);
    }
  } else if (P.car) {
    setEngine(Math.abs(P.car.speed) / CFG.carMaxSpeed, true);
  } else setEngine(0, false);

  // combat input
  if (!P.car) {
    if (consumeClick()) shoot(W);
    if (pressed('KeyF')) punch(W);
  }
  // health regen (slow) when not wanted
  if (W.wanted === 0 && W.health < CFG.maxHealth) W.setHealth(W.health + 2 * dt);
  // ammo pickup: walking over a parked car trunk? no — ammo refills on mission start; keep simple

  updateTraffic(W, dt);
  updatePeds(W, dt);
  updatePolice(W, dt);
  updateMissions(W, dt);
  updateCombat(W, dt);
  updateParticles(dt);
  updateHUD(W);

  // autosave
  W.saveTimer += dt;
  if (W.saveTimer > 20) { W.saveTimer = 0; if (W.missionState === 'active') saveGame(W); }
}

boot();
