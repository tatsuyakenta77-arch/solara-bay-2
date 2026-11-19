// Traffic: AI cars cruising the street grid, turning at intersections,
// braking for the car ahead. They use the right-hand lane of each street.
import { makeCar, driveCar } from './vehicles.js';
import { CFG, mulberry32 } from './config.js';

export function initTraffic(W, scene, count) {
  const rnd = mulberry32(777);
  W.traffic = [];
  for (let i = 0; i < (count || 14); i++) {
    const horizontal = rnd() < 0.5;
    const street = W.streets[Math.floor(rnd() * W.streets.length)];
    const along = -220 + rnd() * 440;
    const lane = 3.2;
    const x = horizontal ? along : street + lane;
    const z = horizontal ? street + lane : along;
    const heading = horizontal ? (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rnd() < 0.5 ? 0 : Math.PI);
    const car = makeCar(undefined, { x, z, heading, parked: false });
    car.speed = CFG.trafficSpeed * (0.8 + rnd() * 0.4);
    car.ai = { horizontal, street, lane, turnCooldown: 0 };
    scene.add(car.group);
    W.traffic.push(car);
  }
}

export function updateTraffic(W, dt) {
  const pitch = CFG.block + CFG.road;
  for (const car of W.traffic) {
    const p = car.group.position;
    const ai = car.ai;
    // slow down if a car (or the player) is right ahead
    let blocked = false;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const all = W.traffic.concat(W.cops || []).concat(W.player.car ? [W.player.car] : []);
    for (const o of all) {
      if (o === car) continue;
      const dx = o.group.position.x - p.x, dz = o.group.position.z - p.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
    }
    const targetSpeed = blocked ? 0 : CFG.trafficSpeed;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    // at an intersection, sometimes turn
    ai.turnCooldown -= dt;
    const nearX = W.streets.reduce((a, s) => Math.abs(s - p.x) < Math.abs(a - p.x) ? s : a, W.streets[0]);
    const nearZ = W.streets.reduce((a, s) => Math.abs(s - p.z) < Math.abs(a - p.z) ? s : a, W.streets[0]);
    const atX = Math.abs(p.x - nearX) < 1.2, atZ = Math.abs(p.z - nearZ) < 1.2;
    if (atX && atZ && ai.turnCooldown <= 0 && Math.random() < 0.35) {
      ai.turnCooldown = 4;
      // turn 90 degrees: pick a new heading along the other axis
      const turnLeft = Math.random() < 0.5;
      car.heading += turnLeft ? Math.PI / 2 : -Math.PI / 2;
      // snap to the new lane
      if (Math.abs(Math.sin(car.heading)) > 0.5) { p.z = nearZ + 3.2 * Math.sign(Math.cos(car.heading) || 1); }
      else { p.x = nearX + 3.2 * Math.sign(Math.sin(car.heading) || 1); }
    }
    // keep on the lane: gentle pull toward the street line
    if (Math.abs(Math.sin(car.heading)) > 0.5) {
      const wantZ = nearZ + 3.2;
      p.z += (wantZ - p.z) * Math.min(1, dt * 0.5);
    } else {
      const wantX = nearX + 3.2;
      p.x += (wantX - p.x) * Math.min(1, dt * 0.5);
    }
    p.x += Math.sin(car.heading) * car.speed * dt;
    p.z += Math.cos(car.heading) * car.speed * dt;
    // wrap around the city edge
    if (p.x > 240) p.x = -240; if (p.x < -240) p.x = 240;
    if (p.z > 240) p.z = -240; if (p.z < -240) p.z = 240;
    car.group.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
  }
}
