// Hero demo: a VOLT ADDA charger and an EV. The visitor connects the plug, watches a
// live session (kW, battery, kWh on the charger's own screen), and sees every kWh mint
// Lightnings that fly into the coin. Loaded only with WebGL and without reduced motion.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const host = document.querySelector('.stage');
const $ = (id) => document.getElementById(id);
const ui = {
  state: $('m-state'), kwh: $('m-kwh'), kw: $('m-kw'), soc: $('m-soc'), vlt: $('m-vlt'),
  bar: $('m-bar'), go: $('m-go'), hint: $('m-hint'), sig: $('m-sig'),
};
const f1 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- Renderer, camera, light ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.className = 'hero-canvas';
renderer.domElement.setAttribute('aria-hidden', 'true');
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
// Bloom: lamps, energy and the coin glow like they would on camera
let composer = null;
function makeComposer(scene) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), .32, .4, .92));
  composer.addPass(new OutputPass());
}
const draw = () => (composer ? composer.render() : renderer.render(scene, camera));
// Entrance: the camera glides in from a wide, low angle over the first seconds
const intro = { t: 0, dur: 2.6 };
const CAM = new THREE.Vector3(-5.2, 2.6, 8.4);
// ?cam=front / ?cam=rear: close-up views for checking the model
const CAMQ = new URLSearchParams(location.search).get('cam');
if (CAMQ === 'front') CAM.set(-6.2, 1.2, 0.4);
if (CAMQ === 'rear') CAM.set(6.5, 1.4, 0.4);
if (CAMQ === 'grille') CAM.set(-3.6, .75, .25);
const LOOK = new THREE.Vector3(-0.7, 1.25, 0);
if (CAMQ) LOOK.set(CAMQ === 'grille' ? -1.6 : 0, .65, 0);

const key = new THREE.DirectionalLight(0xffe2cc, 2.4);
key.position.set(-5, 7, 6);
const rimL = new THREE.DirectionalLight(0xf26212, 2.2);
rimL.position.set(4, 2, -5);
const fill = new THREE.DirectionalLight(0x00d08a, 0.6);
fill.position.set(6, 1, 4);
scene.add(key, rimL, fill);

const ORANGE = new THREE.Color(0xf26212), GREEN = new THREE.Color(0x00d08a);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .5, ...o });

function radialTex(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const dot = radialTex([[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);

// ---------- Floor ----------
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: .55, metalness: .15, transparent: true,
    alphaMap: radialTex([[0, '#fff'], [.55, '#fff'], [1, '#000']]) }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const pad = new THREE.Mesh(
  new THREE.PlaneGeometry(7, 4),
  new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(242,98,18,.08)'], [1, 'rgba(242,98,18,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
);
pad.rotation.x = -Math.PI / 2;
pad.position.set(-0.8, 0.005, 0.3);
scene.add(pad);
// Bay markings
for (const z of [-1.5, 1.9]) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.05), new THREE.MeshBasicMaterial({ color: 0x3a3d45 }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.01, z);
  scene.add(line);
}

// ---------- The car: an original concept coupe, lofted from profile curves ----------
// Side profile, plan width and arches are VOLT's own; it is not modelled on any real car.
function table(pts) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const s = c.getPoints(400);
  return (x) => {
    let i = 1;
    while (i < s.length - 1 && s[i].x < x) i++;
    const a = s[i - 1], b = s[i];
    return a.y + (b.y - a.y) * THREE.MathUtils.clamp((x - a.x) / ((b.x - a.x) || 1), 0, 1);
  };
}
const L = 2.32;
const topY = table([[-L, .62], [-2.24, .9], [-2.0, 1.02], [-1.3, 1.08], [0, 1.12], [1.8, 1.16], [2.18, 1.14], [L, .9]]);
const roofY = table([[-1.32, 1.06], [-.75, 1.62], [-.3, 1.74], [1.2, 1.75], [1.95, 1.7], [2.2, 1.14]]);
const AXLES = [-1.4, 1.42], WR = .43;
const halfW = (x) => {
  const s = Math.abs(x / L);
  const base = .98 * Math.pow(Math.max(0, 1 - Math.pow(s, 9)), 1 / 9);
  return base * (x < 0 ? 1 - .06 * s * s : 1) + AXLES.reduce((a, c) => a + .035 * Math.exp(-((x - c) ** 2) / .18), 0);
};
const botY = (x) => {
  let y = .4 + .08 * Math.pow(Math.abs(x / L), 6);
  for (const c of AXLES) {
    const dx = x - c, r = WR + .07;
    if (Math.abs(dx) < r) y = Math.max(y, .43 + Math.sqrt(r * r - dx * dx));
  }
  return Math.min(y, topY(x) - .1);
};
function loft(x0, x1, nx, nv, section) {
  const pos = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * (i / nx);
    for (let j = 0; j < nv; j++) {
      const [y, z] = section(x, (j / nv) * Math.PI * 2);
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nv; j++) {
    const a = i * nv + j, b = i * nv + (j + 1) % nv, c = a + nv, d = b + nv;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const se = (t, n) => Math.sign(t) * Math.pow(Math.abs(t), 2 / n);
const car = new THREE.Group();
scene.add(car);
const paint = new THREE.MeshPhysicalMaterial({ color: 0xf26212, metalness: .7, roughness: .28, clearcoat: 1, clearcoatRoughness: .04 });
const body = new THREE.Mesh(loft(-L, L, 180, 64, (x, a) => {
  const t = topY(x), b = botY(x), cy = (t + b) / 2, ry = (t - b) / 2, w = halfW(x);
  // tumblehome: the upper half of each section pulls in a little
  const up = Math.max(0, Math.sin(a));
  return [cy + ry * se(Math.sin(a), 7), w * se(Math.cos(a), 7) * (1 - .05 * up * up)];
}), paint);
car.add(body);
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x050608, metalness: .4, roughness: .04, clearcoat: 1, clearcoatRoughness: 0 });
const cabin = new THREE.Mesh(loft(-1.32, 2.2, 120, 48, (x, a) => {
  const base = topY(x) - .04, ry = Math.max(.001, roofY(x) - base), w = halfW(x) * .9;
  const s = Math.sin(a), k = Math.max(0, s);
  return [base + ry * se(s, 6), w * se(Math.cos(a), 6) * (1 - .14 * k)];
}), glassMat);
car.add(cabin);
// Full-width light bars that follow the nose and tail
const lightBar = (x, y, wrap, color, intensity) => {
  const w = halfW(x) * .96, pts = [];
  for (let i = 0; i <= 24; i++) {
    const z = -w + (2 * w * i) / 24, u = z / w;
    pts.push(new THREE.Vector3(x + wrap * u * u, y, z));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .018, 6),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity }));
};
car.add(lightBar(-2.22, 1.0, .06, 0xffffff, 3), lightBar(-2.24, .74, .05, 0xdfe8ff, 1.4), lightBar(2.24, 1.08, -.05, 0xff2424, 2.4));
// Dark lower sills and diffuser
const trim = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: .3, roughness: .5 });
for (const side of [1, -1]) {
  const sillPts = [];
  for (let i = 0; i <= 30; i++) { const x = -.95 + 1.9 * (i / 30); sillPts.push(new THREE.Vector3(x, botY(x) + .05, side * (halfW(x) + .004))); }
  car.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sillPts), 30, .045, 6), trim));
}
// SUV details: black wheel-arch cladding and roof rails
for (const c of AXLES) for (const side of [1, -1]) {
  const r = WR + .1, pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (i / 24), x = c - Math.cos(a) * r;
    pts.push(new THREE.Vector3(x, .43 + Math.sin(a) * r * .92, side * (halfW(x) + .01)));
  }
  car.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, .055, 6), trim));
}
for (const side of [1, -1]) {
  const pts = [];
  for (let i = 0; i <= 20; i++) { const x = -.45 + 2.15 * (i / 20); pts.push(new THREE.Vector3(x, roofY(x) + .035, side * halfW(x) * .62)); }
  car.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .022, 6), trim));
}
// Wheels: low-profile tyres, ten-spoke turbine alloys, orange calipers
const tyreGeo = new THREE.LatheGeometry([[.3, -.15], [.4, -.155], [.43, -.12], [.43, .12], [.4, .155], [.3, .15]].map(([r, y]) => new THREE.Vector2(r, y)), 48).rotateX(Math.PI / 2);
const tyre = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: .85 });
const alloy = new THREE.MeshStandardMaterial({ color: 0xa9aeb6, metalness: 1, roughness: .2 });
const lip = new THREE.MeshStandardMaterial({ color: 0xd6d9de, metalness: 1, roughness: .15 });
const caliperMat = new THREE.MeshStandardMaterial({ color: 0xf26212, roughness: .35, metalness: .2 });
const wheels = [];
for (const x of AXLES) for (const side of [1, -1]) {
  const w = new THREE.Group();
  w.add(new THREE.Mesh(tyreGeo, tyre));
  w.add(new THREE.Mesh(new THREE.TorusGeometry(.295, .012, 8, 64), lip).translateZ(side * .12));
  w.add(new THREE.Mesh(new THREE.CylinderGeometry(.29, .29, .2, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0a0a0c })));
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.055, .27, .03), alloy);
    s.geometry.translate(0, .14, 0);
    s.rotation.set(0, side * .35, (i / 10) * Math.PI * 2);
    s.position.z = side * .115;
    w.add(s);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .04, 24).rotateX(Math.PI / 2), lip);
  hub.position.z = side * .125;
  const caliper = new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 8, 16, Math.PI * .45), caliperMat);
  caliper.rotation.z = Math.PI * .55;
  caliper.position.z = side * .06;
  w.add(hub, caliper);
  w.position.set(x, WR, side * (halfW(x) - .1));
  car.add(w);
  wheels.push(w);
}
// Contact shadow
const contact = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6),
  new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(0,0,0,.85)'], [.6, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
contact.rotation.x = -Math.PI / 2;
contact.position.y = .012;
car.add(contact);
// Charge port on the front-left fender, with an LED ring
const PX = -1.98, PY = (topY(PX) + botY(PX)) / 2 + .04;
const PORT = new THREE.Vector3(PX, PY, halfW(PX) * .97 + .01);
const portRing = new THREE.Mesh(new THREE.TorusGeometry(.07, .013, 8, 32), mat(0x00d08a, { emissive: 0x00d08a, emissiveIntensity: .2 }));
portRing.position.copy(PORT);
const portHole = new THREE.Mesh(new THREE.CircleGeometry(.065, 24), mat(0x050506));
portHole.position.copy(PORT).add(new THREE.Vector3(0, 0, -.002));
car.add(portRing, portHole);
// State-of-charge light along the sill
const socBar = new THREE.Mesh(new THREE.BoxGeometry(1.8, .022, .012).translate(.9, 0, 0), mat(0x00d08a, { emissive: 0x00d08a, emissiveIntensity: 1.6 }));
socBar.position.set(-.9, botY(0) + .12, halfW(0) * .985 + .01);
car.add(socBar);

// ---------- The charger ----------
const charger = new THREE.Group();
charger.position.set(-3.55, 0, 1.35);
charger.rotation.y = 0.35;
scene.add(charger);
const shell = mat(0x1c1e23, { metalness: .5, roughness: .35 });
const post = new THREE.Mesh(new RoundedBoxGeometry(.72, 2.2, .46, 4, .1), shell);
post.position.y = 1.1;
const plinth = new THREE.Mesh(new RoundedBoxGeometry(.95, .1, .7, 2, .04), mat(0x101114, { metalness: .4, roughness: .5 }));
plinth.position.y = .05;
const strip = new THREE.Mesh(new RoundedBoxGeometry(.04, 1.9, .02, 1, .01), mat(0xf26212, { emissive: 0xf26212, emissiveIntensity: 1.6 }));
strip.position.set(-.3, 1.12, .235);
const cap = new THREE.Mesh(new RoundedBoxGeometry(.8, .08, .54, 2, .03), mat(0xf26212, { metalness: .3, roughness: .4 }));
cap.position.y = 2.22;
charger.add(post, plinth, strip, cap);

// Live screen, drawn to a canvas
const sc = document.createElement('canvas');
sc.width = 256; sc.height = 384;
const sg = sc.getContext('2d');
const screenTex = new THREE.CanvasTexture(sc);
screenTex.colorSpace = THREE.SRGBColorSpace;
const screen = new THREE.Mesh(new THREE.PlaneGeometry(.46, .69), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
screen.position.set(.04, 1.5, .232);
charger.add(screen);

// Holster on the car-facing side, and the plug
const holster = new THREE.Mesh(new RoundedBoxGeometry(.14, .3, .2, 2, .04), mat(0x0e0f12));
holster.position.set(.4, 1.0, 0);
charger.add(holster);
const plug = new THREE.Group();
const handle = new THREE.Mesh(new RoundedBoxGeometry(.11, .34, .13, 3, .05), mat(0x24262c, { metalness: .3, roughness: .4 }));
handle.position.y = -.17;
const head = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .1, 24), mat(0x30333a, { metalness: .5, roughness: .3 }));
head.position.y = .04;
const tip = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .02, 24), mat(0x00d08a, { emissive: 0x00d08a, emissiveIntensity: .6 }));
tip.position.y = .1;
plug.add(handle, head, tip);
scene.add(plug);
// Pulsing ring that invites a click while idle
const invite = new THREE.Mesh(new THREE.RingGeometry(.2, .23, 48), new THREE.MeshBasicMaterial({ color: 0x00d08a, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
scene.add(invite);

charger.updateMatrixWorld(true);
car.updateMatrixWorld(true);
const HOLSTER_POS = charger.localToWorld(new THREE.Vector3(.4, 1.12, .05));
const HOLSTER_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .35, 0));
const PORT_W = car.localToWorld(PORT.clone());
let PORT_POS = PORT_W.clone().add(new THREE.Vector3(0, 0, .12));
const PORT_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); // head points into the port
const OUTLET = charger.localToWorld(new THREE.Vector3(.2, .35, -.1));

// Cable, rebuilt as the plug moves
const cableMat = mat(0x15161a, { roughness: .6 });
let cable = null, cableCurve = null;
function rebuildCable() {
  const tail = plug.localToWorld(new THREE.Vector3(0, -.34, 0));
  const span = OUTLET.distanceTo(tail);
  const a = OUTLET.clone().lerp(tail, .33), b = OUTLET.clone().lerp(tail, .66);
  a.y = Math.max(.04, Math.min(a.y, tail.y) - span * .35);
  b.y = Math.max(.04, Math.min(b.y, tail.y) - span * .3);
  cableCurve = new THREE.CatmullRomCurve3([OUTLET, a, b, tail.clone().add(new THREE.Vector3(0, -.15, 0)), tail]);
  if (cable) { cable.geometry.dispose(); scene.remove(cable); }
  cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 60, .035, 8), cableMat);
  scene.add(cable);
}

// ---------- The coin ----------
const coin = new THREE.Group();
coin.position.set(1.7, 3.15, -0.9);
coin.scale.setScalar(.5);
scene.add(coin);
{
  const R = 1.35, T = .22;
  const prof = [[0, -T * .62], [R * .84, -T * .62], [R * .88, -T], [R * .985, -T], [R, -T * .9], [R, T * .9], [R * .985, T], [R * .88, T], [R * .84, T * .62], [0, T * .62]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const metal = new THREE.MeshStandardMaterial({ color: 0xe0773a, metalness: 1, roughness: .3 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), metal);
  body.rotation.x = Math.PI / 2;
  coin.add(body);
  const S = .03, mark = new THREE.Shape();
  [[33, 4], [5, 42], [22, 42], [14, 70], [44, 30], [27, 30]].forEach(([x, y], i) => (i ? mark.lineTo : mark.moveTo).call(mark, (x - 24.5) * S, (37 - y) * S));
  const ext = { depth: .06, bevelEnabled: true, bevelThickness: .025, bevelSize: .02, bevelSegments: 3 };
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(mark, ext), new THREE.MeshStandardMaterial({ color: 0xffb27a, metalness: 1, roughness: .12 }));
    m.scale.setScalar(.62);
    m.position.z = side * T * .62;
    if (side < 0) m.rotation.y = Math.PI;
    coin.add(m);
  }
}
const coinGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: GREEN, transparent: true, opacity: .15, depthWrite: false, blending: THREE.AdditiveBlending }));
coinGlow.scale.setScalar(2.4);
coin.add(coinGlow);
const rings = [];
function coinPulse() {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.4, .02, 8, 96), new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.userData.age = 0;
  coin.add(m);
  rings.push(m);
  coinGlow.material.opacity = .7;
}

// ---------- Particles: energy down the cable, Lightnings up to the coin ----------
const EN = 160;
const ePos = new Float32Array(EN * 3), eCol = new Float32Array(EN * 3);
const eT = Array.from({ length: EN }, (_, i) => i / EN);
const eGeo = new THREE.BufferGeometry();
eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
const energy = new THREE.Points(eGeo, new THREE.PointsMaterial({ size: .09, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
energy.visible = false;
scene.add(energy);

const tokens = [];
function launchToken() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: GREEN, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(.35);
  const from = car.localToWorld(new THREE.Vector3(-.2 + Math.random() * .8, 1.5, 0));
  const to = coin.position.clone();
  const mid = from.clone().lerp(to, .5).add(new THREE.Vector3(-.4, .8, .3));
  s.userData = { curve: new THREE.QuadraticBezierCurve3(from, mid, to), t: 0 };
  scene.add(s);
  tokens.push(s);
}

// ---------- Session state ----------
const BATTERY_KWH = 60, START_SOC = 22, END_SOC = 80;
const S = { mode: 'idle', k: 0, kw: 0, kwh: 0, minted: 0, nextToken: 1 };

function drawScreen() {
  const g = sg, w = 256, h = 384;
  g.fillStyle = '#0b0c0f'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f26212'; g.fillRect(0, 0, w, 6);
  g.font = '600 22px Archivo, Roboto, sans-serif'; g.fillStyle = '#f4f4f5';
  g.fillText('VOLT ADDA', 18, 44);
  g.font = '400 14px Roboto, sans-serif'; g.fillStyle = '#8a8d94';
  g.fillText('Bay 2 · CCS2 · 160 kW', 18, 66);
  const soc = START_SOC + (S.kwh / BATTERY_KWH) * 100;
  if (S.mode === 'idle' || S.mode === 'done') {
    g.font = '600 26px Archivo, Roboto, sans-serif'; g.fillStyle = S.mode === 'done' ? '#3fd39a' : '#f4f4f5';
    g.fillText(S.mode === 'done' ? 'Complete' : 'Ready', 18, 150);
    g.font = '400 15px Roboto, sans-serif'; g.fillStyle = '#a1a3aa';
    g.fillText(S.mode === 'done' ? `${f2.format(S.kwh)} kWh delivered` : 'Plug in to start', 18, 178);
    if (S.mode === 'done') { g.fillStyle = '#3fd39a'; g.fillText(`+${f1.format(S.minted)} Lightnings`, 18, 202); }
    // QR placeholder
    g.fillStyle = '#f4f4f5'; g.fillRect(70, 240, 116, 116);
    g.fillStyle = '#0b0c0f';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3 + i * j) % 3 === 0) g.fillRect(78 + i * 11, 248 + j * 11, 10, 10);
  } else {
    g.font = '500 13px Roboto, sans-serif'; g.fillStyle = '#3fd39a';
    g.fillText(S.mode === 'charging' ? '● CHARGING' : 'CONNECTING…', 18, 112);
    g.font = '600 64px Archivo, Roboto, sans-serif'; g.fillStyle = '#f4f4f5';
    const kwW = g.measureText(String(Math.round(S.kw))).width;
    g.fillText(String(Math.round(S.kw)), 18, 180);
    g.font = '400 18px Roboto, sans-serif'; g.fillStyle = '#a1a3aa';
    g.fillText('kW', 18 + kwW + 8, 180);
    g.fillStyle = '#24272d'; g.fillRect(18, 214, 220, 12);
    g.fillStyle = '#00d08a'; g.fillRect(18, 214, 220 * soc / 100, 12);
    g.font = '500 16px "Roboto Mono", monospace'; g.fillStyle = '#f4f4f5';
    g.fillText(`${Math.round(soc)}%`, 18, 252);
    g.fillText(`${f2.format(S.kwh)} kWh`, 18, 282);
    g.fillStyle = '#3fd39a';
    g.fillText(`+${f1.format(S.minted)} LTN`, 18, 312);
  }
  screenTex.needsUpdate = true;
}

const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
function paintUI() {
  const soc = START_SOC + (S.kwh / BATTERY_KWH) * 100;
  ui.kwh.textContent = f2.format(S.kwh);
  ui.vlt.textContent = f1.format(S.minted);
  ui.kw.textContent = Math.round(S.kw);
  ui.soc.textContent = Math.round(soc) + '%';
  ui.bar.style.width = ((soc - START_SOC) / (END_SOC - START_SOC) * 100).toFixed(1) + '%';
}
function setMode(mode) {
  S.mode = mode;
  const label = { idle: 'Ready', connecting: 'Connecting', charging: 'Charging', stopping: 'Finishing', done: 'Session complete' }[mode];
  ui.state.lastChild.textContent = label;
  ui.state.dataset.mode = mode;
  ui.go.disabled = mode === 'connecting' || mode === 'stopping';
  ui.go.textContent = mode === 'charging' ? 'Stop charging' : mode === 'done' ? 'Charge again' : 'Connect charger';
  ui.hint.textContent = {
    idle: 'Tap the plug on the charger, or press Connect.',
    connecting: 'Plugging in…',
    charging: 'Every kWh is signed by the Volt Box and earns you 5 Lightnings.',
    stopping: 'Unplugging…',
    done: `You earned ${f1.format(S.minted)} Lightnings from ${f2.format(S.kwh)} kWh.`,
  }[mode];
  invite.visible = mode === 'idle' || mode === 'done';
  drawScreen();
}
function primary() {
  if (S.mode === 'idle') { S.kwh = 0; S.minted = 0; S.kw = 0; S.nextToken = 1; paintUI(); setMode('connecting'); }
  else if (S.mode === 'charging') setMode('stopping');
  else if (S.mode === 'done') { S.kwh = 0; S.minted = 0; S.kw = 0; paintUI(); setMode('connecting'); }
}
ui.go.addEventListener('click', primary);

// Click the plug or the charger to connect
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const clickable = [plug, charger];
function hit(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(clickable, true).length > 0;
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if ((S.mode === 'idle' || S.mode === 'done') && hit(e)) primary();
});

let px = 0, py = 0;
host.addEventListener('pointermove', (e) => {
  const r = host.getBoundingClientRect();
  px = (e.clientX - r.left) / r.width - .5;
  py = (e.clientY - r.top) / r.height - .5;
  renderer.domElement.style.cursor = (S.mode === 'idle' || S.mode === 'done') && hit(e) ? 'pointer' : '';
});
host.addEventListener('pointerleave', () => { px = py = 0; });

// ---------- Sizing ----------
function resize() {
  const { width, height } = renderer.domElement.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  composer?.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);

// ---------- Loop ----------
const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const tmp = new THREE.Vector3(), col = new THREE.Color();
let elapsed = 0, screenClock = 0, sigClock = 0;
function placePlug(k) {
  const e = ease(k);
  const lift = Math.sin(e * Math.PI) * .7;
  plug.position.copy(HOLSTER_POS).lerp(PORT_POS, e);
  plug.position.y += lift;
  plug.quaternion.copy(HOLSTER_Q).slerp(PORT_Q, e);
}
function step(dt) {
  elapsed += dt;
  const t = elapsed;

  // camera drift and parallax
  const fit = Math.max(1, 1.35 / camera.aspect);
  intro.t = Math.min(1, intro.t + dt / intro.dur);
  const ie = 1 - Math.pow(1 - intro.t, 3), wide = 1 + (1 - ie) * .55;
  camera.position.set((CAM.x * fit + px * 1.2) * wide - (1 - ie) * 3, (CAM.y * fit - py * .6) * (1 - (1 - ie) * .5), CAM.z * fit * wide);
  camera.lookAt(LOOK);

  if (S.mode === 'connecting') {
    S.k = Math.min(1, S.k + dt / 1.4);
    if (S.k >= 1) setMode('charging');
  } else if (S.mode === 'stopping') {
    S.k = Math.max(0, S.k - dt / 1.2);
    S.kw = Math.max(0, S.kw - dt * 300);
    if (S.k <= 0) setMode('done');
  }
  if (S.mode === 'connecting' || S.mode === 'stopping' || !cable) { placePlug(S.k); rebuildCable(); }

  if (S.mode === 'charging') {
    const soc = START_SOC + (S.kwh / BATTERY_KWH) * 100;
    const target = soc > 70 ? 142 - (soc - 70) * 9 : 142;   // taper near the top
    S.kw += (target - S.kw) * Math.min(1, dt * 1.5);
    S.kwh += (S.kw / 142) * 1.4 * dt;
    S.minted = S.kwh * 5;
    if (S.kwh >= S.nextToken) { S.nextToken += 1; launchToken(); }
    if (START_SOC + (S.kwh / BATTERY_KWH) * 100 >= END_SOC) setMode('stopping');
    paintUI();
  }
  portRing.material.emissiveIntensity = S.mode === 'charging' ? 1.2 + Math.sin(t * 6) * .6 : .2;
  socBar.scale.x = Math.max(.02, (START_SOC + (S.kwh / BATTERY_KWH) * 100) / 100);

  // energy down the cable
  energy.visible = S.mode === 'charging' && !!cableCurve;
  if (energy.visible) {
    for (let i = 0; i < EN; i++) {
      eT[i] = (eT[i] + dt * .6 * (S.kw / 142 + .2)) % 1;
      cableCurve.getPointAt(eT[i], tmp);
      ePos.set([tmp.x, tmp.y, tmp.z], i * 3);
      col.copy(ORANGE).lerp(GREEN, eT[i]);
      eCol.set([col.r, col.g, col.b], i * 3);
    }
    eGeo.attributes.position.needsUpdate = true;
    eGeo.attributes.color.needsUpdate = true;
  }

  // Lightnings flying to the coin
  for (let i = tokens.length - 1; i >= 0; i--) {
    const s = tokens[i];
    s.userData.t += dt * .9;
    const e = ease(Math.min(1, s.userData.t));
    s.userData.curve.getPointAt(e, s.position);
    s.scale.setScalar(.35 + Math.sin(e * Math.PI) * .2);
    if (s.userData.t >= 1) { scene.remove(s); s.material.dispose(); tokens.splice(i, 1); coinPulse(); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const m = rings[i];
    m.userData.age += dt;
    const k = m.userData.age / 1.2;
    m.scale.setScalar(1 + k * .5);
    m.material.opacity = .8 * (1 - k);
    if (k >= 1) { coin.remove(m); m.geometry.dispose(); m.material.dispose(); rings.splice(i, 1); }
  }
  coinGlow.material.opacity += (.15 - coinGlow.material.opacity) * dt * 2;
  coin.rotation.y = t * .8;
  coin.position.y = 3.15 + Math.sin(t * 1.1) * .08;

  // idle invitation around the plug
  if (invite.visible) {
    invite.position.copy(plug.position).add(new THREE.Vector3(0, -.05, .12));
    invite.quaternion.copy(camera.quaternion);
    const p = (t % 1.6) / 1.6;
    invite.scale.setScalar(1 + p * .8);
    invite.material.opacity = .8 * (1 - p);
  }

  screenClock += dt;
  if (screenClock > .25 && S.mode !== 'idle') { screenClock = 0; drawScreen(); }
  sigClock += dt;
  if (sigClock > 1.2 && S.mode === 'charging') { sigClock = 0; ui.sig.textContent = '0x' + hex() + '…' + hex(); }
}

function frame() {
  requestAnimationFrame(frame);
  if (!visible || document.hidden) { clock.getDelta(); return; }
  step(Math.min(clock.getDelta(), .05));
  draw();
}
const clock = new THREE.Clock();

// ---------- Real car model (models/car.glb) ----------
// The model keeps its own textured materials. Its body-paint material ("primary") is
// swapped for a clear-coated paint that the picker recolours. Lamps get a soft glow.
// Falls back to the procedural SUV above if the file is missing.
const PAINTS = { orig: null, orange: 0xf26212, graphite: 0x2a2d33, pearl: 0xe9e7e2, jade: 0x0a7d5a };
const BODY = /^(primary|carpaint|body|paint)/i;
const LAMP = /light|lamp|headl/i;
const carPaint = new THREE.MeshPhysicalMaterial({ color: 0xf26212, metalness: .6, roughness: .28, clearcoat: 1, clearcoatRoughness: .04 });
let origPaint = null;
// Textured body panels carry the factory red inside their texture. This shader tweak swaps
// red-dominant texels for the chosen paint, keeping their brightness, and leaves trim alone.
const TINTED = /^(chassis\.1|chassis\.2|boot\.2)$/i;
const tintU = { uPaint: { value: new THREE.Color(0xf26212) }, uTint: { value: 1 } };
function addTint(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPaint = tintU.uPaint;
    sh.uniforms.uTint = tintU.uTint;
    sh.fragmentShader = 'uniform vec3 uPaint;\nuniform float uTint;\n' + sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       {
         vec3 c = diffuseColor.rgb;
         float red = smoothstep(.15, .45, (c.r - max(c.g, c.b)) / max(c.r, 1e-3));
         float lum = dot(c, vec3(.2126, .7152, .0722)) / max(dot(uPaint, vec3(.2126, .7152, .0722)), 1e-3);
         vec3 painted = uPaint * clamp(lum * 1.6, .25, 1.6);
         diffuseColor.rgb = mix(c, painted, red * uTint);
       }`);
  };
  m.customProgramCacheKey = () => 'volt-tint';
  m.needsUpdate = true;
}
function setPaint(name) {
  const hex = PAINTS[name];
  carPaint.color.copy(hex == null && origPaint ? origPaint : new THREE.Color(hex ?? PAINTS.orange));
  tintU.uTint.value = hex == null ? 0 : 1;
  if (hex != null) tintU.uPaint.value.setHex(hex);
  paint.color.copy(carPaint.color);
  document.querySelectorAll('.mc-swatch').forEach((b) => b.setAttribute('aria-pressed', b.dataset.paint === name));
}
document.querySelectorAll('.mc-swatch').forEach((b) => b.addEventListener('click', () => setPaint(b.dataset.paint)));

new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('models/car.glb', (gltf) => {
  const model = gltf.scene;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (BODY.test(m.name)) {
        if (!origPaint) origPaint = m.color.clone();
        carPaint.normalMap = m.normalMap || null;
        return carPaint;
      }
      // Dashboard and infotainment screens carry a third-party watermark: show them switched off
      if (/^stea\.[56]$/i.test(m.name)) return new THREE.MeshStandardMaterial({ color: 0x050607, roughness: .15, metalness: .3 });
      if (TINTED.test(m.name)) addTint(m);
      if (LAMP.test(m.name) && m.emissive) { m.emissive.setHex(/rear/i.test(m.name) ? 0x661010 : 0x777777); }
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });

  // Normalise: length along x, 3.8 m long, wheels on the floor, centred, nose toward the charger
  let box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  if (size.z > size.x) model.rotation.y = Math.PI / 2;
  if (new URLSearchParams(location.search).get('flip') === '1') model.rotation.y += Math.PI;
  box = new THREE.Box3().setFromObject(model); size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(4.2 / size.x);
  box = new THREE.Box3().setFromObject(model);
  const ctr = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(ctr.x, box.min.y, ctr.z));
  // De-badge: drop chrome triangles at the centre of the nose and tail, where the
  // maker's emblems sit, so the car reads as a generic hatchback.
  {
    model.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(model), Lx = bb.max.x - bb.min.x, Wz = bb.max.z - bb.min.z, Hy = bb.max.y - bb.min.y;
    const zc = (bb.max.z + bb.min.z) / 2, v = new THREE.Vector3(), c = new THREE.Vector3();
    model.traverse((o) => {
      if (!o.isMesh || !o.geometry.index) return;
      const mats = [].concat(o.material);
      if (!mats.some((m) => /^ste/i.test(m.name))) return;
      const pos = o.geometry.attributes.position, ix = o.geometry.index, arr = ix.array.slice();
      let cut = 0;
      for (let t = 0; t < arr.length; t += 3) {
        c.set(0, 0, 0);
        for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, arr[t + k]).applyMatrix4(o.matrixWorld));
        c.divideScalar(3);
        const nose = c.x < bb.min.x + Lx * .07, tail = c.x > bb.max.x - Lx * .07;
        if ((nose || tail) && Math.abs(c.z - zc) < Wz * .14 && c.y > bb.min.y + Hy * .25) { arr[t + 1] = arr[t]; arr[t + 2] = arr[t]; cut++; }
      }
      if (cut) o.geometry.setIndex(new THREE.BufferAttribute(arr, 1));
    });
  }

  // Swap out the procedural body, keep the port ring and shadow
  car.children.slice().forEach((c) => { if (c !== portRing && c !== portHole && c !== contact) c.visible = false; });
  car.add(model);
  wheels.length = 0;
  box = new THREE.Box3().setFromObject(model);
  const H = box.max.y - box.min.y, Lx = box.max.x - box.min.x;
  PORT.set(box.min.x + Lx * .14, H * .55, box.max.z - .04);
  portRing.position.copy(PORT);
  portHole.position.copy(PORT).add(new THREE.Vector3(0, 0, -.002));
  car.updateMatrixWorld(true);
  PORT_POS = car.localToWorld(PORT.clone()).add(new THREE.Vector3(0, 0, .12));
  if (S.mode === 'idle') { placePlug(0); rebuildCable(); }
  setPaint(new URLSearchParams(location.search).get('paint') || 'orange');
  document.querySelector('.model-credit')?.removeAttribute('hidden');
}, undefined, () => { /* no model file: keep the procedural SUV */ });

// Bloom (makeComposer) stays off: the bloom pass drops canvas transparency and paints a dark box over the hero.
host.prepend(renderer.domElement);
host.classList.add('is-3d');
resize();
paintUI();
setMode('idle');
document.fonts?.ready.then(drawScreen);
// ?t=<seconds> starts a session and fast-forwards it, for screenshots and reviews
const warm = Number(new URLSearchParams(location.search).get('t')) || 0;
if (warm) primary();
for (let s = 0; s < warm; s += 1 / 60) step(1 / 60);
step(0);
draw();
frame();
