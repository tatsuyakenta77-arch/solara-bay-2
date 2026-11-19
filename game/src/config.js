// Meridian Heat — configuration, city layout constants and mission data.
// Original game: city of Port Meridian, story of driver Jace Marlowe.
export const CFG = {
  title: 'MERIDIAN HEAT',
  city: 'Port Meridian',
  block: 44,          // size of one city block (metres)
  road: 14,           // road width
  blocks: 4,          // blocks from centre to edge (grid is 2*blocks+1 wide)
  groundSize: 460,
  playerWalk: 7,
  playerRun: 11,
  carAccel: 26,
  carMaxSpeed: 38,
  carReverseMax: 14,
  carBrake: 40,
  carTurn: 1.9,
  trafficSpeed: 9,
  copSpeed: 30,
  maxHealth: 100,
  startCash: 250,
  startAmmo: 60,
  wantedDecay: 6,     // seconds hidden before a star drops
  colors: {
    sky: 0x87b5d6, fog: 0x9db8c8,
    road: 0x2c2f36, sidewalk: 0x8d8f94, ground: 0x3f6b3a,
    water: 0x1e6f8e, sand: 0xd8c28a,
  },
};

// Mission script: six story missions. Each step is one objective.
// step types: goto | enterCar | steal | collect | fight | deliver | escape
export const MISSIONS = [
  {
    id: 1, name: 'First Gear', pay: 400,
    brief: 'Mara Quinn needs a driver. Get in the car by the garage and drive to the meet point.',
    steps: [
      { type: 'enterCar', text: 'Get in the car (press E near it)' },
      { type: 'goto', x: 120, z: -120, r: 10, text: 'Drive to the meet point at the north-east corner' },
    ],
  },
  {
    id: 2, name: 'The Pickup', pay: 600,
    brief: 'A package is waiting at the docks. Drive there, get out and collect it on foot.',
    steps: [
      { type: 'goto', x: -40, z: 232, r: 12, text: 'Drive to the docks (south marina)' },
      { type: 'collect', x: -40, z: 255, r: 4, text: 'Get out and collect the package (walk into the marker)' },
    ],
  },
  {
    id: 3, name: 'Hot Wheels', pay: 900,
    brief: 'Mara wants a specific sports car. Steal the yellow coupe in the plaza — the cops will notice.',
    steps: [
      { type: 'steal', x: 40, z: 40, r: 6, text: 'Steal the yellow coupe in the central plaza' },
      { type: 'deliver', x: -120, z: -40, r: 10, text: 'Deliver it to the garage — lose the cops on the way' },
    ],
  },
  {
    id: 4, name: 'Dockside Trouble', pay: 1200,
    brief: 'Rival crew The Gulls jumped Mara\'s people at the docks. Go there and deal with them.',
    steps: [
      { type: 'goto', x: -40, z: 232, r: 12, text: 'Drive to the docks' },
      { type: 'fight', x: -40, z: 232, r: 26, count: 3, text: 'Take out the rival crew (click to shoot, F to punch)' },
    ],
  },
  {
    id: 5, name: 'The Getaway', pay: 1500,
    brief: 'The job went loud. Grab the cash from the bank steps and get to the hideout before the cops box you in.',
    steps: [
      { type: 'collect', x: 116, z: -58, r: 4, text: 'Grab the cash bag at the bank steps' },
      { type: 'deliver', x: 150, z: 120, r: 10, text: 'Reach the hideout — wanted level 3, don\'t get busted' },
    ],
  },
  {
    id: 6, name: 'Meridian Heat', pay: 3000,
    brief: 'One last run. Deliver the money to Mara at the marina while the whole city is after you.',
    steps: [
      { type: 'deliver', x: -40, z: -170, r: 10, text: 'Deliver the money to Mara at the marina — 4 stars, stay moving' },
    ],
  },
];

// Deterministic pseudo-random helper (seeded, for staged shots).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
