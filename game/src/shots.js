// Staging mode for screenshots: ?shot=cover|chase|mission|street&seed=7
// Sets up the scene, camera, HUD and wanted state deterministically,
// then flags window.__shotReady so the capture script can shoot.
import { makeCar } from './vehicles.js';

export function applyShot(W, params) {
  const shot = params.get('shot') || 'cover';
  const seed = Number(params.get('seed') || 7);
  // deterministic-ish placement (Math.random is fine: staging is visual, not scored)
  const P = W.player;
  W.started = true;
  W.hideStartScreen();
  if (shot === 'cover') {
    // wide city view: player in a car on a main avenue, skyline behind
    W.setWanted(0);
    P.car = W.starterCar;
    W.starterCar.isPlayer = true; W.starterCar.parked = false;
    P.group.visible = false;
    W.starterCar.group.position.set(0, 0, 116);
    W.starterCar.heading = Math.PI; // facing north up the avenue
    W.starterCar.group.rotation.y = Math.PI;
    W.starterCar.speed = 14;
    W.camera.position.set(-14, 9, 150);
    W.camera.lookAt(0, 4, 60);
    W.setObjective('Mission 1: First Gear — Drive to the meet point at the north-east corner');
    W.setMissionLabel('MISSION 1 · FIRST GEAR');
  } else if (shot === 'chase') {
    W.setWanted(3);
    P.car = W.starterCar;
    W.starterCar.isPlayer = true; W.starterCar.parked = false;
    P.group.visible = false;
    W.starterCar.group.position.set(0, 0, 58);
    W.starterCar.heading = 0;
    W.starterCar.group.rotation.y = 0;
    W.starterCar.speed = 26;
    W.camera.position.set(-12, 8, 24);
    W.camera.lookAt(0, 2, 58);
    W.setObjective('Lose the cops — 3 stars, Port Meridian PD on your tail');
    W.setMissionLabel('MISSION 5 · THE GETAWAY');
  } else if (shot === 'mission') {
    W.setWanted(0);
    // on foot at the docks with the objective marker visible
    P.pos.set(-28, 0, 218); P.group.position.copy(P.pos);
    P.heading = Math.PI * 0.85; P.group.rotation.y = P.heading;
    W.camera.position.set(-62, 8, 200);
    W.camera.lookAt(-40, 2, 232);
    W.setObjective('Mission 4: Dockside Trouble — Take out the rival crew (click to shoot, F to punch)');
    W.setMissionLabel('MISSION 4 · DOCKSIDE TROUBLE');
    W.spawnEnemies(-40, 232, 3);
    W.setMissionMarker(-40, 232);
  } else { // street
    W.setWanted(0);
    P.pos.set(10, 0, 58); P.group.position.copy(P.pos);
    P.heading = Math.PI / 2; P.group.rotation.y = P.heading;
    W.camera.position.set(-6, 4.5, 44);
    W.camera.lookAt(30, 2, 58);
    W.setObjective('Free roam — explore Port Meridian on foot or steal a car (E)');
    W.setMissionLabel('FREE ROAM');
    // a parked car nearby for the street shot
    const car = makeCar(0x2255cc, { x: 24, z: 62, heading: Math.PI / 2, parked: true });
    W.scene.add(car.group);
    W.parkedCars.push(car);
  }
  // let one frame render, then signal readiness
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
