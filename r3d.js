// Tous les fichiers du jeu sont à plat, à côté d'index.html (plus simple à envoyer sur GitHub depuis un téléphone)
// EverAscend : rendu 3D réel (three.js r169, modèles KayKit CC0).
// Ce module ne touche ni à la logique ni aux sauvegardes : il observe la scène du jeu (classes et contenus du DOM)
// et dessine le même combat en 3D derrière l'interface. Les zones tactiles restent celles du jeu.
import * as THREE from './three.module.min.js';
import { GLTFLoader } from './GLTFLoader.js';
import * as SkeletonUtils from './SkeletonUtils.js';

export function create(G) {
const canvas = G.canvas;
const HQ = () => G.q() === 0;
const BASE = new URL('./', import.meta.url).href;

// un seul contexte WebGL pour tout (combat et vitrines des menus) : les téléphones en tolèrent peu
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
let glLost = false;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); glLost = true; if (G.lost) G.lost(true); }, false);
canvas.addEventListener('webglcontextrestored', () => { glLost = false; if (G.lost) G.lost(false); }, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0a14);
scene.fog = new THREE.FogExp2(0x0d0a14, 0.042);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
const baseCam = camera.clone();

const hemi = new THREE.HemisphereLight(0x7f8cff, 0x3a2414, 0.9); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xc8d4ff, 1.6);
moon.position.set(-6, 12, 7); moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 });
moon.shadow.bias = -0.0008; moon.shadow.normalBias = 0.03;
scene.add(moon);
const torches = [];
const heroLight = new THREE.PointLight(0xffffff, 0, 4.5, 2); scene.add(heroLight);
const projLight = new THREE.PointLight(0xffffff, 0, 6, 2); scene.add(projLight);

/* ---------- chargement des modèles (GLB en base64 dans des .json, comme le prototype) ---------- */
const loader = new GLTFLoader();
const cache = {}, packs = {};
const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
const parse = buf => new Promise((res, rej) => loader.parse(buf, '', res, rej));
const getJSON = f => fetch(BASE + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
function pack(name) { return packs[name] || (packs[name] = getJSON(name + '.json')); }
function load(path) {
  if (cache[path]) return cache[path];
  const m = path.match(/^assets\/dg\/(.+)\.glb$/), e = path.match(/^env\/((forest|hex|hw|w)\/.+)$/);
  const md = path.match(/^assets\/md\/(.+)\.glb$/), vl = path.match(/^assets\/vil\/(.+)\.glb$/);
  if (vl) cache[path] = pack('vil').then(p => { if (!p[vl[1]]) throw new Error('modèle absent : ' + vl[1]); return parse(b64(p[vl[1]])); });
  else if (md) cache[path] = pack('modes').then(p => { if (!p[md[1]]) throw new Error('modèle absent : ' + md[1]); return parse(b64(p[md[1]])); });
  else if (m) cache[path] = pack('dg').then(p => parse(b64(p[m[1]])));
  else if (e) cache[path] = pack('env_' + e[2]).then(p => { if (!p[e[1]]) throw new Error('modèle absent : ' + e[1]); return parse(b64(p[e[1]])); });
  else cache[path] = getJSON(path.replace(/^assets\//, '').replace(/\.glb$/, '.json')).then(j => parse(b64(j.glb)));
  cache[path].catch(() => { delete cache[path]; });
  return cache[path];
}

const DG = ['floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_small_broken_A', 'wall', 'wall_archedwindow_gated', 'wall_pillar', 'wall_doorway', 'wall_corner', 'pillar_decorated', 'torch_mounted', 'banner_patternA_red', 'banner_shield_red', 'banner_thin_yellow', 'barrel_large', 'crates_stacked', 'chest_gold', 'coin_stack_large', 'rubble_large', 'candle_triple', 'keg_decorated', 'sword_shield_gold'];
let world = new THREE.Group(); scene.add(world);
function prop(g, x, z, ry = 0, s = 1, y = 0) {
  const o = g.scene.clone(true);
  o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s);
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  o.userData.prop = true; world.add(o); return o;
}
async function buildRoom() {
  setLook({ bg: 0x0d0a14, fog: [0x0d0a14, 0.042], hemi: [0x7f8cff, 0x3a2414, 0.9], sun: [0xc8d4ff, 1.6, -6, 12, 7], dust: 0xbfc8ff, exp: 1.15 });
  const g = {}; await Promise.all(DG.map(async n => { g[n] = await load('assets/dg/' + n + '.glb'); }));
  // sol : dalles de 4 m, quelques variantes
  for (let x = -12; x <= 12; x += 4) for (let z = -10; z <= 10; z += 4) {
    const r = Math.abs(Math.sin(x * 12.9 + z * 78.2)) % 1;
    prop(r < 0.12 ? g.floor_tile_large_rocks : r < 0.24 ? g.floor_tile_small_broken_A : g.floor_tile_large, x, z, Math.floor(r * 4) * Math.PI / 2, r < 0.24 && r >= 0.12 ? 2 : 1);
  }
  // mur du fond (z = -11) et murs latéraux
  const back = ['wall', 'wall_archedwindow_gated', 'wall_pillar', 'wall_doorway', 'wall_pillar', 'wall_archedwindow_gated', 'wall'];
  back.forEach((n, i) => prop(g[n], -12 + i * 4, -11.5));
  for (let z = -8; z <= 8; z += 4) { prop(g[z === 0 ? 'wall_archedwindow_gated' : 'wall'], -14.5, z - 1, Math.PI / 2); prop(g[z === 0 ? 'wall_archedwindow_gated' : 'wall'], 14.5, z - 1, -Math.PI / 2); }
  prop(g.wall_corner, -14.5, -11.5); prop(g.wall_corner, 14.5, -11.5, -Math.PI / 2);
  // piliers sculptés, bannières, trésor, tonneaux
  prop(g.pillar_decorated, -7, -6.5); prop(g.pillar_decorated, 7, -6.5);
  prop(g.banner_shield_red, -4, -11.2); prop(g.banner_shield_red, 4, -11.2); prop(g.banner_thin_yellow, 0, -11.2);
  prop(g.chest_gold, 9.5, -8.5, -0.5); prop(g.coin_stack_large, 11, -6.5, 0.4); prop(g.sword_shield_gold, 0, -11.15).position.y = 2.6;
  prop(g.barrel_large, -11.5, -8.5); prop(g.crates_stacked, -10.5, -5.5, 0.6); prop(g.keg_decorated, 11.5, 2, -Math.PI / 2);
  prop(g.rubble_large, -11, 5, 1.2, 0.8); prop(g.candle_triple, -6.4, -5.6); prop(g.candle_triple, 7.6, -5.6);
  // torches murales, chacune avec une lumière qui vacille
  [[-8, -11.0], [8, -11.0], [-14, -4], [14, -4]].forEach(([x, z], i) => {
    const t = prop(g.torch_mounted, x, z, i === 2 ? Math.PI / 2 : i === 3 ? -Math.PI / 2 : 0); t.position.y = 2.2;
    const L = new THREE.PointLight(0xff8a3a, 18, 13, 1.8);
    L.position.set(x + (i === 2 ? 0.6 : i === 3 ? -0.6 : 0), 3.1, z + (i < 2 ? 0.7 : 0));
    world.add(L); torches.push({ L, base: 18, ph: i * 1.7, fl: flame(L.position) });
  });
}
function setLook(o) {
  scene.background = new THREE.Color(o.bg);
  scene.fog = o.fog.length === 2 ? new THREE.FogExp2(o.fog[0], o.fog[1]) : new THREE.Fog(o.fog[0], o.fog[1], o.fog[2]);
  hemi.color.set(o.hemi[0]); hemi.groundColor.set(o.hemi[1]); hemi.intensity = o.hemi[2];
  moon.color.set(o.sun[0]); moon.intensity = o.sun[1]; moon.position.set(o.sun[2], o.sun[3], o.sun[4]);
  dustMat.color.set(o.dust); renderer.toneMappingExposure = o.exp;
}
let placeFx = { clouds: [], blades: null, mist: false, lava: [], float: [], snow: null, embers: false, fireflies: null, sea: null, foam: null };
async function buildPlace(k) {
  scene.remove(world); world = new THREE.Group(); scene.add(world);
  torches.length = 0; placeFx = { clouds: [], blades: null, mist: false, lava: [], float: [], snow: null, embers: false, fireflies: null, sea: null, foam: null };
  const B2 = { prairie: buildPrairie, marais: buildMarais, foret: buildForet, chateau: buildChateau, cote: buildCote, neige: buildNeige, desert: buildDesert, volcan: buildVolcan, cristal: buildCristal, ciel: buildCiel, tour0: () => buildTour(0), tour1: () => buildTour(1), tour2: () => buildTour(2), arene: buildArene, couloir: buildCouloir };
  await (B2[k] || buildRoom)();
}
// petit générateur pseudo-aléatoire : le décor est le même à chaque visite
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// garde la zone du combat et l'axe de la caméra dégagés
const CAMDIR = new THREE.Vector2(Math.sin(0.72), Math.cos(0.72));
function clear(x, z, r0 = 4) { const d = Math.hypot(x, z); if (d < r0) return false; return !(d < 17 && (x * CAMDIR.x + z * CAMDIR.y) / d > 0.55); }
function scatter(R, n, rMin, rMax, cb, r0) {
  let k = 0, tries = 0;
  while (k < n && tries++ < n * 20) { const a = R() * 6.283, d = rMin + R() * (rMax - rMin), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!clear(x, z, r0)) continue; cb(x, z, R); k++; }
}
async function loadAll(names) { const g = {}; await Promise.all(names.map(async n => { g[n] = await load('env/' + n); })); return g; }
function ground(col, r = 80) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, roughness: 1 }));
  m.receiveShadow = true; world.add(m); return m;
}
async function buildPrairie() {
  setLook({ bg: 0x9fd2f2, fog: [0xc4e3f4, 24, 80], hemi: [0xdcefff, 0x5f7f2e, 1.25], sun: [0xfff0d4, 2.7, 8, 15, 7], dust: 0xfff2a8, exp: 1.0 });
  const g = await loadAll(['forest/Tree_1_A', 'forest/Tree_1_B', 'forest/Tree_2_A', 'forest/Tree_2_C', 'forest/Tree_3_A', 'forest/Tree_4_A', 'forest/Bush_2_C', 'forest/Bush_4_A', 'forest/Rock_1_E', 'forest/Rock_2_C', 'forest/Rock_1_A', 'forest/Grass_1_A', 'forest/Grass_2_B', 'hex/mountain_A_grass', 'hex/mountain_B', 'hex/mountain_C_grass_trees', 'hex/cloud_big', 'hex/cloud_small', 'hex/building_windmill_red', 'hex/hills_A_trees']);
  ground(0x7fb24a);
  const path = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb79c66, roughness: 1 }));
  path.position.y = 0.012; path.receiveShadow = true; world.add(path);
  const R = rng(11);
  const pick = a => a[Math.floor(R() * a.length)];
  scatter(R, HQ() ? 160 : 70, 2.5, 22, (x, z) => prop(g[pick(['forest/Grass_1_A', 'forest/Grass_2_B'])], x, z, R() * 6.28, 1.4 + R()), 3.2);
  scatter(R, 38, 9, 26, (x, z) => prop(g[pick(['forest/Tree_1_A', 'forest/Tree_1_B', 'forest/Tree_2_A', 'forest/Tree_2_C', 'forest/Tree_3_A', 'forest/Tree_4_A'])], x, z, R() * 6.28, 1.1 + R() * 0.6));
  scatter(R, 22, 6, 18, (x, z) => prop(g[pick(['forest/Bush_2_C', 'forest/Bush_4_A'])], x, z, R() * 6.28, 1 + R()));
  scatter(R, 14, 5, 20, (x, z) => prop(g[pick(['forest/Rock_1_E', 'forest/Rock_2_C', 'forest/Rock_1_A'])], x, z, R() * 6.28, 0.9 + R()));
  // horizon : collines, montagnes, moulin (modèles du pack Medieval Hexagon, agrandis)
  for (let i = 0; i < 9; i++) { const a = -2.6 + i * 0.42, d = 46 + R() * 8; prop(g[pick(['hex/mountain_A_grass', 'hex/mountain_B', 'hex/mountain_C_grass_trees'])], Math.cos(a) * d, Math.sin(a) * d, R() * 6.28, 13 + R() * 6); }
  for (let i = 0; i < 6; i++) { const a = -2.4 + i * 0.6, d = 32; prop(g['hex/hills_A_trees'], Math.cos(a) * d, Math.sin(a) * d, R() * 6.28, 9); }
  const mill = prop(g['hex/building_windmill_red'], -17, -24, 0.5, 7); mill.traverse(o => { if (!placeFx.blades && /blade|wing|sail|propel|fan/i.test(o.name)) placeFx.blades = o; });
  for (let i = 0; i < 9; i++) { const c = prop(g[pick(['hex/cloud_big', 'hex/cloud_small'])], -40 + R() * 80, -30 - R() * 25, R() * 6.28, 3.5 + R() * 3, 15 + R() * 8); c.traverse(o => { if (o.isMesh) o.castShadow = false; }); placeFx.clouds.push(c); }
}

/* Marais : sol boueux, flaques, arbres morts, tombes, crypte, lanternes et brume */
async function buildMarais() {
  setLook({ bg: 0x1a2523, fog: [0x26332f, 0.05], hemi: [0x86ab94, 0x1a140c, 0.8], sun: [0xbcd4ff, 0.95, -7, 13, 5], dust: 0xa8ff9a, exp: 1.25 });
  const g = await loadAll(['hw/tree_dead_large', 'hw/tree_dead_medium', 'hw/tree_dead_large_decorated', 'hw/grave_A', 'hw/grave_B', 'hw/gravestone', 'hw/gravemarker_A', 'hw/fence', 'hw/fence_broken', 'hw/fence_pillar', 'hw/lantern_standing', 'hw/post_lantern', 'hw/crypt', 'hw/pumpkin_orange_jackolantern', 'hw/pumpkin_orange_small', 'hw/bone_A', 'hw/skull_candle', 'hw/floor_dirt', 'hw/ribcage', 'hw/shrine_candles', 'forest/Grass_2_B', 'forest/Rock_1_E']);
  ground(0x39392a);
  const R = rng(5), pick = a => a[Math.floor(R() * a.length)];
  const water = new THREE.MeshStandardMaterial({ color: 0x18282a, metalness: 0.85, roughness: 0.12 });
  scatter(R, 9, 4.5, 16, (x, z) => { const w = new THREE.Mesh(new THREE.CircleGeometry(1.3 + R() * 2, 28).rotateX(-Math.PI / 2), water); w.position.set(x, 0.015, z); w.scale.set(1, 1, 0.6 + R() * 0.6); w.receiveShadow = true; world.add(w); });
  scatter(R, 10, 4, 14, (x, z) => prop(g['hw/floor_dirt'], x, z, R() * 6.28, 1).position.y = 0.01);
  scatter(R, 26, 10, 26, (x, z) => prop(g[pick(['hw/tree_dead_large', 'hw/tree_dead_medium', 'hw/tree_dead_large_decorated'])], x, z, R() * 6.28, 1.1 + R() * 0.5));
  scatter(R, 40, 3.5, 18, (x, z) => prop(g['forest/Grass_2_B'], x, z, R() * 6.28, 1.2 + R()).traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setRGB(0.55, 0.6, 0.35); } }), 3.2);
  // cimetière derrière le combat : clôture en arc, tombes, crypte
  for (let i = 0; i < 9; i++) { const a = -2.2 + i * 0.28, d = 12.5; prop(g[i % 3 === 1 ? 'hw/fence_broken' : 'hw/fence'], Math.cos(a) * d, Math.sin(a) * d, -a - Math.PI / 2); prop(g['hw/fence_pillar'], Math.cos(a - 0.14) * d, Math.sin(a - 0.14) * d); }
  for (let i = 0; i < 14; i++) { const a = -2.1 + R() * 2.2, d = 14 + R() * 5; prop(g[pick(['hw/grave_A', 'hw/grave_B', 'hw/gravestone', 'hw/gravemarker_A'])], Math.cos(a) * d, Math.sin(a) * d, -a - Math.PI / 2 + (R() - 0.5) * 0.4); }
  prop(g['hw/crypt'], 2, -22, 0, 1.1);
  prop(g['hw/shrine_candles'], -5.5, -5, 0.6); prop(g['hw/ribcage'], -4.6, -0.6, 1); prop(g['hw/bone_A'], -2.8, -2.4, 2); prop(g['hw/skull_candle'], 4.4, -3.6, -0.6); prop(g['forest/Rock_1_E'], -6, 2, 1).traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setRGB(0.5, 0.5, 0.45); } });
  // sources de lumière : lanternes vertes et citrouilles
  [[-4.6, -3.2, 'hw/lantern_standing', 0xbfff6a], [5.4, -4.6, 'hw/post_lantern', 0xbfff6a], [-3.4, 3.6, 'hw/pumpkin_orange_jackolantern', 0xff8a2a], [6.4, 1.4, 'hw/pumpkin_orange_small', 0xff8a2a]].forEach(([x, z, n, c], i) => {
    prop(g[n], x, z, R() * 6.28, n === 'hw/pumpkin_orange_small' ? 1.2 : 1);
    const L = new THREE.PointLight(c, 10, 8, 1.8); L.position.set(x, n === 'hw/post_lantern' ? 2.4 : n === 'hw/lantern_standing' ? 0.9 : 0.7, z); world.add(L);
    torches.push({ L, base: 10, ph: i * 2.1, fl: null });
  });
  placeFx.mist = true;
}
let mistAcc = 0;
function placeTick(t, dt) {
  placeFx.clouds.forEach((c, i) => { c.position.x += dt * (0.5 + (i % 3) * 0.2); if (c.position.x > 45) c.position.x = -45; });
  if (placeFx.blades) placeFx.blades.rotation.z += dt * 0.8;
  if (placeFx.snow) { const sn = placeFx.snow; sn.acc = (sn.acc || 0) + dt * sn.rate * (HQ() ? 1 : 0.4); while (sn.acc > 1) { sn.acc -= 1; emit(new THREE.Vector3((Math.random() - 0.5) * 30, 7 + Math.random() * 3, (Math.random() - 0.5) * 24), { x: sn.wind || 0.3, y: sn.fall, z: 0 }, sn.col, sn.size * 2.4, 7, 0, 0); } }
  if (placeFx.embers && Math.random() < dt * (HQ() ? 30 : 10)) { const a = Math.random() * 6.28, d = 2 + Math.random() * 14; emit(new THREE.Vector3(Math.cos(a) * d, 0.1, Math.sin(a) * d), { x: (Math.random() - 0.5) * 0.4, y: 1 + Math.random() * 1.5, z: (Math.random() - 0.5) * 0.4 }, [1, 0.4 + Math.random() * 0.3, 0.08], 0.2, 2.5, 0.2, 0.3); }
  if (placeFx.fireflies && Math.random() < dt * (HQ() ? 12 : 4)) { tmpC.set(placeFx.fireflies); const a = Math.random() * 6.28, d = 3 + Math.random() * 12; emit(new THREE.Vector3(Math.cos(a) * d, 0.4 + Math.random() * 2.5, Math.sin(a) * d), { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.5 }, [tmpC.r, tmpC.g, tmpC.b], 0.22, 3 + Math.random() * 2, 0, 0); }
  placeFx.lava.forEach((m, i) => { m.emissiveIntensity = 1.4 + 0.5 * Math.sin(t * 1.7 + i); });
  placeFx.float.forEach(f => { f.o.position.y = f.y + Math.sin(t * 0.5 + f.ph) * 0.6; f.o.rotation.y += dt * 0.03; });
  if (placeFx.sea) { const p = placeFx.sea.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 0.25 + t * 1.2) * 0.18 + Math.cos(z * 0.3 + t * 0.9) * 0.14); } p.needsUpdate = true; placeFx.sea.geometry.computeVertexNormals(); }
  if (placeFx.foam) placeFx.foam.material.opacity = 0.35 + 0.2 * Math.sin(t * 1.3);
  if (placeFx.mist) { mistAcc += dt * (HQ() ? 10 : 4); while (mistAcc > 1) { mistAcc -= 1; const a = Math.random() * 6.28, d = 2 + Math.random() * 12; emit(new THREE.Vector3(Math.cos(a) * d, 0.2 + Math.random() * 0.5, Math.sin(a) * d), { x: 0.2, y: 0.02, z: 0 }, [0.1, 0.16, 0.13], 2.6 + Math.random() * 2, 5, 0, 0.1); } }
}
function codeMonster(kind, hue, big, opts = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const S0 = big ? 1.5 : 1, col = kind === 'loup' ? new THREE.Color().setHSL(0.5 + (hue % 0.12), 0.7, 0.62) : new THREE.Color().setHSL(hue, kind === 'follet' ? 1 : 0.65, kind === 'follet' ? 0.58 : 0.5);
  const A = { code: true, kind, root, body, acts: {}, t: Math.random() * 9, st: 'idle', stT: 0, dur: 0, then: null, spawning: false, S0, col };
  const keep = m => { m.userData.keep = true; return m; };
  const eye = (x, y, z, r, white) => {
    if (white) { const w = keep(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }))); w.position.set(x, y, z); body.add(w); }
    const p = keep(new THREE.Mesh(new THREE.SphereGeometry(r * (white ? 0.52 : 1), 14, 10), new THREE.MeshStandardMaterial({ color: 0x120c18, roughness: 0.2 }))); p.position.set(x, y, z + (white ? r * 0.62 : 0)); body.add(p);
  };
  if (kind === 'gelee') {
    const geo = new THREE.SphereGeometry(0.9, 36, 24), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < -0.3) pos.setY(i, -0.3 + (y + 0.3) * 0.22); }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.84, emissive: col.clone().multiplyScalar(0.18) });
    A.blob = new THREE.Mesh(geo, mat); A.blob.position.y = 0.37; A.blob.castShadow = true; body.add(A.blob);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.45), transparent: true, opacity: 0.9 })); core.position.set(0.1, 0.38, -0.1); body.add(core);
    for (let i = 0; i < 4; i++) { const b = keep(new THREE.Mesh(new THREE.SphereGeometry(0.05 + i * 0.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }))); b.position.set(-0.3 + i * 0.2, 0.2 + i * 0.12, 0.2 - i * 0.1); body.add(b); }
    eye(-0.27, 0.62, 0.62, 0.17, true); eye(0.27, 0.62, 0.62, 0.17, true);
    const mouth = keep(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2a0a14 }))); mouth.scale.set(1.3, 0.45, 0.4); mouth.position.set(0, 0.38, 0.84); body.add(mouth);
    const shine = keep(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }))); shine.scale.set(1, 0.6, 0.5); shine.position.set(-0.38, 0.92, 0.42); body.add(shine);
  } else if (kind === 'golem') {
    const stone = new THREE.MeshStandardMaterial({ color: opts.wood ? new THREE.Color(0x6b4a2c) : new THREE.Color().setHSL(hue, 0.25, 0.32), roughness: 0.85, flatShading: true });
    const glowC = new THREE.Color().setHSL(hue, 1, 0.6);
    const gem = keep(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: glowC, emissive: glowC, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true })));
    const blk = (r, x, y, z, sx = 1, sy = 1, sz = 1, par = body) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), stone); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; par.add(m); return m; };
    A.parts = [];
    A.torso = new THREE.Group(); A.torso.position.y = 1.15; body.add(A.torso);
    A.parts.push(blk(0.62, 0, 0, 0, 1.15, 1, 0.85, A.torso), blk(0.36, 0, 0.78, 0.08, 1, 0.9, 1, A.torso));
    const core = gem.clone(); core.scale.setScalar(0.2); core.position.set(0, 0.05, 0.5); A.torso.add(core); A.core = core;
    [-1, 1].forEach(sd => {
      const eye = gem.clone(); eye.scale.setScalar(0.07); eye.position.set(sd * 0.13, 0.82, 0.38); A.torso.add(eye);
      const sh = new THREE.Group(); sh.position.set(sd * 0.78, 0.25, 0); A.torso.add(sh);
      A.parts.push(blk(0.3, 0, 0, 0, 1, 1, 1, sh), blk(0.27, 0, -0.5, 0.05, 1, 1.2, 1, sh), blk(0.32, 0, -0.98, 0.12, 1.1, 1, 1.1, sh));
      (sd < 0 ? A.armL = sh : A.armR = sh);
      A.parts.push(blk(0.3, sd * 0.3, 0.32, 0, 1, 1.1, 1));
      const c = gem.clone(); c.scale.set(0.12, 0.38, 0.12); c.position.set(sd * 0.55, 0.65, -0.25); c.rotation.z = -sd * 0.5; A.torso.add(c);
    });
    const c2 = gem.clone(); c2.scale.set(0.14, 0.5, 0.14); c2.position.set(0, 0.55, -0.45); c2.rotation.x = -0.5; A.torso.add(c2);
    A.light = new THREE.PointLight(glowC, 6, 5, 1.8); A.light.position.set(0, 1.2, 0.8); body.add(A.light);
    if (opts.wood) { const leaf = new THREE.MeshStandardMaterial({ color: 0x4f8f2f, roughness: 0.8, flatShading: true }); [[0, 1.05, 0, 0.42], [-0.3, 0.95, -0.15, 0.3], [0.32, 0.92, -0.1, 0.32], [-0.8, 0.5, 0, 0.26], [0.8, 0.5, 0, 0.26]].forEach(([x, y, z, r]) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf); m.position.set(x, y, z); m.castShadow = true; A.torso.add(m); }); }
  } else if (kind === 'loup') {
    // loup spectral : silhouette en volumes simples, translucide et lumineux
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col.clone().multiplyScalar(0.55), transparent: true, opacity: 0.72, roughness: 0.4, flatShading: true });
    const sph = (r, x, y, z, sx, sy, sz, par = body) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; par.add(m); return m; };
    A.torso = new THREE.Group(); A.torso.position.y = 0.9; body.add(A.torso);
    sph(0.5, 0, 0, -0.1, 0.75, 0.68, 1.45, A.torso); sph(0.45, 0, 0.12, 0.42, 0.95, 1, 0.9, A.torso);
    A.head = new THREE.Group(); A.head.position.set(0, 0.42, 0.9); A.torso.add(A.head);
    sph(0.28, 0, 0, 0, 0.95, 0.85, 1.1, A.head);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 8).rotateX(Math.PI / 2), mat); snout.position.set(0, -0.06, 0.32); A.head.add(snout);
    [-1, 1].forEach(sd => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), mat); ear.position.set(sd * 0.14, 0.26, -0.05); ear.rotation.z = -sd * 0.25; A.head.add(ear);
      const e = keep(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xeaffff }))); e.position.set(sd * 0.12, 0.07, 0.2); A.head.add(e);
    });
    A.legs = [];
    [[-1, 0.42], [1, 0.42], [-1, -0.5], [1, -0.5]].forEach(([sd, z]) => { const g = new THREE.Group(); g.position.set(sd * 0.24, 0.85, z); body.add(g); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.8, 7), mat); l.position.y = -0.4; g.add(l); A.legs.push(g); });
    A.tail = new THREE.Group(); A.tail.position.set(0, 0.15, -0.75); A.torso.add(A.tail);
    const tl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 7), mat); tl.position.y = 0.3; A.tail.add(tl); A.tail.rotation.x = -1.0;
    A.mat = mat;
  } else if (kind === 'wyverne') {
    const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.5, 0.4), roughness: 0.6, flatShading: true });
    const memb = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.55, 0.3), roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
    A.fly = new THREE.Group(); A.fly.position.y = 1.7; body.add(A.fly);
    const sph = (r, x, y, z, sx, sy, sz, par = A.fly, m = skin) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; par.add(o); return o; };
    sph(0.5, 0, 0, 0, 0.8, 0.75, 1.5);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.8, 8), skin); neck.position.set(0, 0.38, 0.62); neck.rotation.x = 0.7; A.fly.add(neck);
    A.head = new THREE.Group(); A.head.position.set(0, 0.72, 0.98); A.fly.add(A.head);
    sph(0.22, 0, 0, 0, 1, 0.85, 1.25, A.head);
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 7).rotateX(Math.PI / 2), skin); jaw.position.set(0, -0.04, 0.32); A.head.add(jaw);
    [-1, 1].forEach(sd => {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 })); h.position.set(sd * 0.1, 0.18, -0.12); h.rotation.x = -0.9; A.head.add(h);
      const e = keep(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd040 }))); e.position.set(sd * 0.13, 0.06, 0.15); A.head.add(e);
    });
    const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(1.9, 0.5); shp.lineTo(1.5, -0.1); shp.lineTo(1.15, -0.35); shp.lineTo(0.7, -0.3); shp.lineTo(0.3, -0.45); shp.lineTo(0, -0.3);
    const wg = new THREE.ShapeGeometry(shp).rotateX(-Math.PI / 2);
    A.wings = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(sd * 0.3, 0.25, 0.15); const w = new THREE.Mesh(wg, memb); w.scale.set(sd * 0.72, 1, 0.8); w.castShadow = true; g.add(w); A.fly.add(g); return g; });
    A.tail = []; let par = A.fly, z = -0.7;
    for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set(0, i ? 0 : 0, z); par.add(g); const c = new THREE.Mesh(new THREE.ConeGeometry(0.18 - i * 0.035, 0.55, 7).rotateX(-Math.PI / 2), skin); c.position.z = -0.22; g.add(c); A.tail.push(g); par = g; z = -0.45; }
    A.mouthCol = new THREE.Color().setHSL(hue, 1, 0.6);
  } else if (kind === 'araignee') {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.3, 0.2), roughness: 0.55 });
    const glowC = new THREE.Color().setHSL(hue, 1, 0.55);
    A.torso = new THREE.Group(); A.torso.position.y = 0.62; body.add(A.torso);
    const ab = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12), mat); ab.scale.set(1, 0.82, 1.2); ab.position.set(0, 0.18, -0.55); ab.castShadow = true; A.torso.add(ab);
    for (let i = 0; i < 3; i++) { const sp = keep(new THREE.Mesh(new THREE.SphereGeometry(0.09 - i * 0.02, 8, 6), new THREE.MeshBasicMaterial({ color: glowC }))); sp.position.set(0, 0.62 - i * 0.04, -0.4 - i * 0.25); A.torso.add(sp); }
    const th = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10), mat); th.position.set(0, 0, 0.15); th.castShadow = true; A.torso.add(th);
    [[-0.08, 0.14], [0.08, 0.14], [-0.15, 0.08], [0.15, 0.08], [-0.05, 0.22], [0.05, 0.22]].forEach(([x, y]) => { const e = keep(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3030 }))); e.position.set(x, y - 0.05, 0.46); A.torso.add(e); });
    [-1, 1].forEach(sd => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 })); f.position.set(sd * 0.07, -0.18, 0.42); f.rotation.x = Math.PI; A.torso.add(f); });
    A.legs = [];
    for (let i = 0; i < 4; i++) [-1, 1].forEach(sd => {
      const g = new THREE.Group(); g.position.set(sd * 0.22, 0, 0.32 - i * 0.2); g.rotation.y = sd * (0.9 - i * 0.55) + (sd < 0 ? Math.PI : 0); A.torso.add(g);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.7, 6), mat); up.position.set(0.3, 0.22, 0); up.rotation.z = -1.0; g.add(up);
      const kn = new THREE.Group(); kn.position.set(0.58, 0.42, 0); g.add(kn);
      const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 1.0, 6), mat); lo.position.set(0.2, -0.47, 0); lo.rotation.z = 0.42; kn.add(lo); lo.castShadow = true;
      A.legs.push({ g, ry: g.rotation.y, i, sd });
    });
  } else if (kind === 'myco') {
    const capC = new THREE.Color().setHSL(hue, 0.7, 0.5);
    const stemM = new THREE.MeshStandardMaterial({ color: 0xeee0c4, roughness: 0.8 });
    A.stem = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 1.0, 16), stemM); A.stem.position.y = 0.55; A.stem.castShadow = true; body.add(A.stem);
    A.cap = new THREE.Group(); A.cap.position.y = 1.05; body.add(A.cap);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 12, 0, 6.283, 0, 1.7), new THREE.MeshStandardMaterial({ color: capC, roughness: 0.5, emissive: capC.clone().multiplyScalar(0.15) })); cap.scale.y = 0.62; cap.castShadow = true; A.cap.add(cap);
    for (let i = 0; i < 9; i++) { const a = i * 2.39, r = 0.3 + (i % 3) * 0.2, d = keep(new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i % 2) * 0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff6e0 }))); d.position.set(Math.cos(a) * r, 0.5 - r * 0.32, Math.sin(a) * r); d.scale.y = 0.5; A.cap.add(d); }
    eye(-0.15, 0.72, 0.36, 0.1, true); eye(0.15, 0.72, 0.36, 0.1, true);
    A.arms = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(sd * 0.38, 0.6, 0); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 7), stemM); a.position.set(sd * 0.1, -0.2, 0); a.rotation.z = sd * 0.4; g.add(a); body.add(g); return g; });
    [-1, 1].forEach(sd => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), stemM); f.scale.set(1, 0.6, 1.3); f.position.set(sd * 0.22, 0.06, 0.08); body.add(f); });
    A.spore = [capC.r, capC.g, capC.b];
  } else {
    A.orb = new THREE.Group(); A.orb.position.y = 1.5; body.add(A.orb);
    A.core = keep(new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.55) }))); A.orb.add(A.core);
    A.glow = keep(new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }))); A.orb.add(A.glow);
    A.halo = keep(new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 14), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }))); A.orb.add(A.halo);
    const e1 = keep(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1a0c08 }))); e1.position.set(-0.13, 0.05, 0.33); A.orb.add(e1);
    const e2 = e1.clone(); e2.position.x = 0.13; A.orb.add(e2);
    A.light = new THREE.PointLight(col, 14, 8, 1.6); A.orb.add(A.light);
  }
  body.scale.setScalar(S0);
  const MAP = { Spawn_Ground_Skeletons: ['spawn', 1.2], Idle_Combat: ['idle', 0], Hit_A: ['hit', 0.35], Hit_B: ['hit', 0.35], Death_C_Skeletons: ['death', 1.3], Taunt: ['taunt', 1] };
  A.play = (name, o = {}) => {
    const m = MAP[name] || ['attack', 0.95];
    A.st = m[0]; A.stT = 0; A.dur = m[1] / (o.speed || 1); A.then = o.then || null; A.spawning = A.st === 'spawn';
    return A.dur || 1;
  };
  const ease = k => k * k * (3 - 2 * k), bump = k => Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
  A.update = dt => {
    A.t += dt; A.stT += dt;
    const k = A.dur ? Math.min(1, A.stT / A.dur) : 0, st = A.st, w = Math.sin(A.t * 3.2);
    let sx = 1, sy = 1, px = 0, py = 0, pz = 0, op = 1;
    if (kind === 'gelee') {
      sx = 1 + 0.05 * w; sy = 1 - 0.06 * w;
      if (st === 'spawn') { const f = 1 - ease(Math.min(1, k * 1.4)); py = 6 * f * f; if (k > 0.7) { const b = bump((k - 0.7) / 0.3); sy -= 0.35 * b; sx += 0.25 * b; } }
      if (st === 'hit') { const b = bump(k); sy -= 0.3 * b; sx += 0.2 * b; pz -= 0.2 * b; }
      if (st === 'attack') { if (k < 0.35) { const b = k / 0.35; sy -= 0.3 * b; sx += 0.2 * b; } else if (k < 0.8) { const b = (k - 0.35) / 0.45; py = bump(b) * 1.2; pz = bump(b) * 1.3; sy += 0.2 * bump(b); } else { const b = bump((k - 0.8) / 0.2); sy -= 0.25 * b; sx += 0.2 * b; } }
      if (st === 'taunt') { py = Math.abs(Math.sin(k * Math.PI * 2)) * 0.6; }
      if (st === 'death') { sy = 1 - 0.92 * ease(k); sx = 1 + 0.8 * ease(k); op = 1 - Math.max(0, (k - 0.5) / 0.5); }
      A.blob.material.opacity = 0.84 * op;
      body.scale.set(A.S0 * sx, A.S0 * sy, A.S0 * sx); body.position.set(px, py, pz);
      body.children.forEach(m => { if (m !== A.blob && m.material) { m.material.transparent = true; if (m.material.opacity !== undefined && st === 'death') m.material.opacity = Math.min(m.material.opacity, op); } });
    } else if (kind === 'golem') {
      let ar = 0, tz = 0, ty = 0, lean = 0;
      ty = Math.sin(A.t * 1.6) * 0.04; lean = Math.sin(A.t * 0.8) * 0.04;
      if (st === 'spawn') { py = -2.4 * (1 - ease(k)); if (Math.random() < 0.6) emit(A.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.1, (Math.random() - 0.5) * 1.6)), { x: 0, y: 2, z: 0 }, [0.6, 0.55, 0.5], 0.4, 0.8); }
      if (st === 'hit') { lean = -0.25 * bump(k); }
      if (st === 'attack') { if (k < 0.5) { ar = -2.6 * ease(k / 0.5); lean = -0.15 * ease(k / 0.5); } else { const b = ease(Math.min(1, (k - 0.5) / 0.2)); ar = -2.6 + 2.9 * b; lean = 0.35 * b * (1 - Math.max(0, (k - 0.75) / 0.25)); tz = 0.4 * b; if (k > 0.68 && !A.slam) { A.slam = 1; shake(0.25); burst(A.root.position.clone().add(new THREE.Vector3(0, 0.2, 0.9)), 0xc8b8a8, 30, 4, 0.35, 0.5); ring(A.root.position, A.col.getHex(), 2.5, 0.5); } } } else A.slam = 0;
      if (st === 'taunt') { ar = -1.2 * bump(k * 2 % 1); }
      if (st === 'death') { if (!A.fall) { A.fall = A.parts.map(p => ({ p, v: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3), r: new THREE.Vector3(Math.random() * 4, Math.random() * 4, 0) })); }
        A.fall.forEach(f => { f.v.y -= 9 * dt; f.p.position.addScaledVector(f.v, dt * 0.6); f.p.rotation.x += f.r.x * dt; f.p.rotation.y += f.r.y * dt; const wp = new THREE.Vector3(); f.p.getWorldPosition(wp); if (wp.y < 0.2) { f.v.y = Math.abs(f.v.y) * 0.3; f.v.x *= 0.6; f.v.z *= 0.6; } });
        op = 1 - Math.max(0, (k - 0.6) / 0.4); A.light.intensity = 6 * (1 - k); }
      else { A.light.intensity = 5 + 1.5 * Math.sin(A.t * 3); }
      A.armL.rotation.x = ar + Math.sin(A.t * 1.6) * 0.08; A.armR.rotation.x = ar - Math.sin(A.t * 1.6) * 0.08;
      A.torso.rotation.x = lean; A.torso.position.set(0, 1.15 + ty, tz);
      body.position.y = py; body.scale.setScalar(A.S0);
      if (st === 'death') body.traverse(m => { if (m.material && m.material !== undefined) { m.material.transparent = true; m.material.opacity = op; } });
    } else if (kind === 'loup') {
      let lz = 0, ly = 0, hx = 0, run = 0;
      const br = Math.sin(A.t * 2.4);
      if (st === 'spawn') { op = ease(k); ly = -1.2 * (1 - ease(k)); }
      if (st === 'hit') { lz = -0.3 * bump(k); hx = 0.3 * bump(k); }
      if (st === 'attack') { const b = bump(k); lz = 1.4 * b; ly = 0.35 * b; run = b; hx = -0.4 * b; }
      if (st === 'taunt') { hx = -0.8 * bump(k); }
      if (st === 'death') { op = 1 - k; ly = -0.6 * ease(k); }
      A.torso.scale.set(1, 1 + 0.03 * br, 1);
      A.head.rotation.x = hx + Math.sin(A.t * 1.3) * 0.06;
      A.legs.forEach((g, i) => { g.rotation.x = run * (i % 2 ? 0.8 : -0.8) + Math.sin(A.t * 2 + i) * 0.04; });
      A.tail.rotation.x = -1.0 + Math.sin(A.t * 3) * 0.15; A.tail.rotation.z = Math.sin(A.t * 2.2) * 0.3;
      body.position.set(0, ly + 0.05 * br, lz); body.scale.setScalar(A.S0);
      A.mat.opacity = 0.72 * op; A.mat.emissiveIntensity = 1 + 0.3 * Math.sin(A.t * 4);
      if (op > 0.1 && Math.random() < (HQ() ? 0.6 : 0.25)) { const p = new THREE.Vector3(); A.torso.getWorldPosition(p); emit(p.add(new THREE.Vector3((Math.random() - 0.5) * 0.8 * A.S0, (Math.random() - 0.3) * 0.5 * A.S0, (Math.random() - 0.5) * 1.2 * A.S0)), { x: 0, y: 0.5, z: 0 }, [A.col.r, A.col.g, A.col.b], 0.3 * A.S0, 0.9, 0, 1); }
    } else if (kind === 'wyverne') {
      let fy = 1.7 + Math.sin(A.t * 2.2) * 0.15, fz = 0, pitch = 0, flap = Math.sin(A.t * 6.5), hx = 0;
      if (st === 'spawn') { fy += 5 * (1 - ease(k)); flap = Math.sin(A.t * 11); }
      if (st === 'hit') { fz = -0.35 * bump(k); pitch = -0.25 * bump(k); }
      if (st === 'attack') { const b = bump(k); fz = 1.2 * b; fy -= 0.6 * b; pitch = 0.35 * b; hx = 0.4 * b; flap = Math.sin(A.t * 12); if (k > 0.3 && k < 0.7) { const p = new THREE.Vector3(); A.head.getWorldPosition(p); for (let j = 0; j < 3; j++) emit(p, { x: (Math.random() - 0.5) * 1.5, y: -0.5 - Math.random(), z: 3 + Math.random() * 2 }, [A.mouthCol.r, A.mouthCol.g, A.mouthCol.b], 0.35 * A.S0, 0.5, 0, 1); } }
      if (st === 'taunt') { pitch = -0.5 * bump(k); hx = -0.6 * bump(k); }
      if (st === 'death') { fy = 1.7 * (1 - ease(k)) + 0.3; pitch = 0.9 * ease(k); flap = 0; op = 1 - Math.max(0, (k - 0.6) / 0.4); }
      A.fly.position.set(0, fy, fz); A.fly.rotation.x = pitch;
      A.wings[0].rotation.z = 0.25 + flap * 0.7; A.wings[1].rotation.z = -0.25 - flap * 0.7;
      A.head.rotation.x = hx + Math.sin(A.t * 1.7) * 0.08;
      A.tail.forEach((g, i) => { g.rotation.y = Math.sin(A.t * 2.5 - i * 0.7) * 0.25; g.rotation.x = 0.12; });
      body.scale.setScalar(A.S0);
      if (st === 'death') body.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = op; } });
    } else if (kind === 'araignee') {
      let tz = 0, ty = 0, roll = 0, lift = 0, gait = 0;
      if (st === 'spawn') { ty = 3.5 * (1 - ease(k)); }
      if (st === 'hit') { tz = -0.3 * bump(k); }
      if (st === 'attack') { const b = bump(k); tz = 1.1 * b; ty = 0.25 * b; lift = b; gait = 1; }
      if (st === 'taunt') { lift = bump(k); }
      if (st === 'death') { roll = Math.PI * ease(Math.min(1, k * 1.5)); ty = 0.3 * bump(k); op = 1 - Math.max(0, (k - 0.6) / 0.4); }
      A.torso.position.set(0, 0.62 + ty + Math.sin(A.t * 3) * 0.03, tz); A.torso.rotation.z = roll;
      A.legs.forEach(L => { const w = Math.sin(A.t * (gait ? 14 : 2.5) + L.i * 1.3 + (L.sd > 0 ? 1.6 : 0)); L.g.rotation.y = L.ry + w * (gait ? 0.25 : 0.05); L.g.rotation.z = (L.i === 0 ? lift * 0.9 : 0) + (st === 'death' ? 0.8 * k : 0); });
      body.scale.setScalar(A.S0);
      if (st === 'death') body.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = op; } });
    } else if (kind === 'myco') {
      let s = 1, hop = 0, tz = 0, spin = 0, ar = 0;
      const w = Math.sin(A.t * 2.6);
      if (st === 'spawn') s = ease(k);
      if (st === 'hit') { s = 1 - 0.15 * bump(k); tz = -0.2 * bump(k); }
      if (st === 'attack') { const b = bump(k); hop = 0.9 * b; tz = 1.0 * b; ar = 1.6 * b; if (k > 0.75 && !A.puff) { A.puff = 1; const p = A.root.position.clone().add(new THREE.Vector3(0, 1.2, 0.8)); for (let j = 0; j < 24; j++) emit(p, { x: (Math.random() - 0.5) * 3, y: Math.random() * 2, z: (Math.random() - 0.2) * 3 }, A.spore, 0.35, 1.1, -0.5, 1.5); } } else A.puff = 0;
      if (st === 'taunt') spin = k * Math.PI * 2;
      if (st === 'death') { s = 1 - 0.85 * ease(k); op = 1 - k; if (Math.random() < 0.5) emit(A.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5), 1, (Math.random() - 0.5))), { x: 0, y: 1, z: 0 }, A.spore, 0.3, 1, 0, 1); }
      A.cap.rotation.z = w * 0.06; A.cap.position.y = 1.05 + 0.04 * w;
      A.arms[0].rotation.z = -0.2 - ar + w * 0.1; A.arms[1].rotation.z = 0.2 + ar - w * 0.1;
      body.position.set(0, hop, tz); body.rotation.y = spin; body.scale.set(A.S0 * s * (1 + 0.03 * w), A.S0 * s * (1 - 0.03 * w), A.S0 * s * (1 + 0.03 * w));
      if (st === 'death') body.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = op; } });
    } else {
      py = Math.sin(A.t * 2) * 0.15; const pulse = 1 + 0.08 * Math.sin(A.t * 9);
      let gl = 1;
      if (st === 'spawn') { gl = ease(k); }
      if (st === 'hit') { pz = -0.35 * bump(k); }
      if (st === 'attack') { pz = bump(k) * 1.5; py -= bump(k) * 0.3; }
      if (st === 'taunt') { px = Math.sin(k * Math.PI * 2) * 0.5; pz = Math.cos(k * Math.PI * 2) * 0.3 - 0.3; }
      if (st === 'death') { gl = 1 + k * 1.8; op = 1 - k; }
      A.orb.position.set(px, 1.5 + py, pz); A.orb.scale.setScalar(gl);
      A.glow.scale.setScalar(pulse); A.glow.material.opacity = 0.42 * op; A.halo.material.opacity = 0.13 * op; A.core.material.transparent = true; A.core.material.opacity = op;
      A.light.intensity = (12 + 4 * Math.sin(A.t * 13)) * op;
      if (op > 0.05 && Math.random() < (HQ() ? 0.9 : 0.4)) { const p = new THREE.Vector3(); A.orb.getWorldPosition(p); emit(p.add(new THREE.Vector3((Math.random() - 0.5) * 0.4 * A.S0, 0.15 * A.S0, (Math.random() - 0.5) * 0.4 * A.S0)), { x: (Math.random() - 0.5) * 0.4, y: 1.4 + Math.random(), z: (Math.random() - 0.5) * 0.4 }, [A.col.r, A.col.g, A.col.b], 0.32 * A.S0, 0.55, 0.6, 1.2); }
    }
    if (A.dur && A.stT >= A.dur && st !== 'death') { const f = A.then; A.then = null; if (st === 'spawn') A.spawning = false; A.st = 'idle'; A.dur = 0; if (f) f(); }
  };
  A.dispose = () => root.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
  return A;
}
function tint(o, m, emis, ei = 1) {
  o.traverse(x => { if (!x.isMesh) return; x.material = x.material.clone(); x.material.color.multiply(new THREE.Color(m[0], m[1], m[2])); if (emis != null) { x.material.emissive = new THREE.Color(emis); x.material.emissiveIntensity = ei; } });
  return o;
}
function disc(r, col, y = 0.012, opts = {}) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 1 }, opts)));
  m.position.y = y; m.receiveShadow = true; world.add(m); return m;
}
function glowLight(x, y, z, col, I = 8, d = 7) { const L = new THREE.PointLight(col, I, d, 1.8); L.position.set(x, y, z); L.userData.prop = true; world.add(L); torches.push({ L, base: I, ph: Math.random() * 6, fl: null, slow: true }); return L; }
// champignon lumineux (Forêt enchantée)
function mushroom(x, z, s, col) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 })); stem.position.y = 0.25;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 10, 0, 6.283, 0, 1.6), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, roughness: 0.4 })); cap.position.y = 0.48; cap.scale.y = 0.7;
  for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); const a = i * 1.3; d.position.set(Math.cos(a) * 0.2, 0.6, Math.sin(a) * 0.2); g.add(d); }
  g.add(stem, cap); g.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.userData.prop = true; world.add(g); return g;
}
// grappe de cristaux (Forêt de cristal, Pics enneigés)
function crystals(x, z, s, col, n = 5) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88, flatShading: true });
  for (let i = 0; i < n; i++) {
    const h = 0.8 + Math.random() * 1.6, c = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.22 + Math.random() * 0.12, h, 6), mat); g.userData.prop = true;
    const a = Math.random() * 6.28, d = i ? 0.15 + Math.random() * 0.3 : 0;
    c.position.set(Math.cos(a) * d, h / 2 - 0.1, Math.sin(a) * d); c.rotation.set((Math.random() - 0.5) * 0.7, Math.random() * 6, (Math.random() - 0.5) * 0.7); c.castShadow = true; g.add(c);
  }
  world.add(g); return g;
}
// corail : branches de cylindres
function coral(x, z, s, col) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });
  const branch = (p, dir, len, r, depth) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, len, 7), mat); const end = p.clone().addScaledVector(dir, len);
    m.position.copy(p).addScaledVector(dir, len / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.castShadow = true; g.add(m);
    if (depth > 0) for (let i = 0; i < 2; i++) { const d2 = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3, (Math.random() - 0.5) * 1.2)).normalize(); branch(end, d2, len * 0.75, r * 0.7, depth - 1); }
    else { const b = new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 8, 6), mat); b.position.copy(end); g.add(b); }
  };
  branch(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.6, 0.12, 3); g.userData.prop = true; world.add(g); return g;
}
// île flottante (Royaume céleste)
function island(x, y, z, r, topCol, rockCol) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.5, 18), new THREE.MeshStandardMaterial({ color: topCol, roughness: 1, flatShading: true })); top.position.y = -0.25;
  const under = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, r * 1.6, 9), new THREE.MeshStandardMaterial({ color: rockCol, roughness: 1, flatShading: true })); under.rotation.x = Math.PI; under.position.y = -0.5 - r * 0.8;
  top.receiveShadow = true; under.castShadow = true; g.add(top, under); world.add(g); return g;
}
function lavaMat() { const m = new THREE.MeshStandardMaterial({ color: 0xff5a14, emissive: 0xff3a08, emissiveIntensity: 1.6, roughness: 0.6 }); placeFx.lava.push(m); return m; }

const BIOME_ASSETS = {
  foret: ['forest/Tree_2_A', 'forest/Tree_2_B', 'forest/Tree_2_C', 'forest/Tree_3_A', 'forest/Tree_3_B', 'forest/Tree_4_A', 'forest/Tree_4_B', 'forest/Bush_1_C', 'forest/Bush_2_C', 'forest/Bush_3_A', 'forest/Rock_1_J', 'forest/Rock_3_E', 'forest/Grass_1_A', 'forest/Grass_2_B', 'forest/Grass_1_C'],
  chateau: ['hex/building_castle_red', 'hex/building_tower_A_red', 'hex/building_tower_B_red', 'hex/wall_straight', 'hex/wall_straight_gate', 'hex/flag_red', 'hex/building_church_red', 'hex/building_home_A_red', 'hex/building_well_red', 'hex/trees_A_large', 'hex/mountain_A_grass', 'hex/cloud_big', 'forest/Bush_2_C', 'forest/Tree_1_A', 'forest/Grass_1_A'],
  cote: ['hex/hex_water', 'hex/waterplant_A', 'hex/waterplant_B', 'hex/waterlily_A', 'hex/tent', 'hex/cloud_big', 'hex/cloud_small', 'forest/Tree_4_A', 'forest/Tree_4_B', 'forest/Rock_2_A', 'forest/Rock_1_E', 'forest/Bush_4_A', 'forest/Grass_2_B'],
  neige: ['hex/mountain_A', 'hex/mountain_B', 'hex/mountain_C', 'forest/Tree_4_A', 'forest/Tree_4_B', 'forest/Tree_4_C', 'forest/Tree_Bare_1_B', 'forest/Rock_2_F', 'forest/Rock_3_K', 'forest/Rock_1_E', 'hex/cloud_big'],
  desert: ['forest/Rock_2_A', 'forest/Rock_2_F', 'forest/Rock_3_E', 'forest/Rock_1_J', 'forest/Tree_Bare_2_A', 'forest/Tree_Bare_1_C', 'hex/mountain_C', 'hex/tent'],
  volcan: ['hex/mountain_B', 'hex/mountain_C', 'forest/Rock_2_A', 'forest/Rock_2_F', 'forest/Rock_3_K', 'forest/Rock_1_J', 'forest/Tree_Bare_2_C', 'forest/Tree_Bare_1_B'],
  cristal: ['forest/Tree_Bare_1_A', 'forest/Tree_Bare_2_B', 'forest/Tree_Bare_2_A', 'forest/Tree_Bare_1_C', 'forest/Rock_3_E', 'forest/Rock_2_F', 'forest/Bush_1_E'],
  ciel: ['hex/cloud_big', 'hex/cloud_small', 'forest/Tree_1_A', 'forest/Tree_3_B', 'forest/Bush_2_C', 'forest/Grass_1_A', 'hex/building_church_red']
};
const DGX = ['column', 'pillar', 'wall_broken', 'wall_half', 'rubble_half', 'floor_tile_large', 'stairs_wide', 'barrier_column', 'banner_shield_red', 'banner_patternA_red'];
async function loadBiome(k) { const g = await loadAll(BIOME_ASSETS[k] || []); if (k === 'chateau' || k === 'desert' || k === 'ciel') await Promise.all(DGX.map(async n => { g['dg/' + n] = await load('assets/dg/' + n + '.glb'); })); return g; }

async function buildForet() {
  setLook({ bg: 0x223852, fog: [0x2a4658, 0.045], hemi: [0x9fd2ff, 0x274a24, 1.0], sun: [0xd8c8ff, 1.3, -6, 13, 6], dust: 0xc8ff8a, exp: 1.2 });
  const g = await loadBiome('foret'); ground(0x4a7436); disc(4.4, 0x5d7a3a);
  const R = rng(21), pick = a => g[a[Math.floor(R() * a.length)]];
  scatter(R, 60, 8, 26, (x, z) => prop(pick(['forest/Tree_2_A', 'forest/Tree_2_B', 'forest/Tree_2_C', 'forest/Tree_3_A', 'forest/Tree_3_B', 'forest/Tree_4_A', 'forest/Tree_4_B']), x, z, R() * 6.28, 1.2 + R() * 0.7));
  scatter(R, 30, 5, 18, (x, z) => prop(pick(['forest/Bush_1_C', 'forest/Bush_2_C', 'forest/Bush_3_A']), x, z, R() * 6.28, 1 + R()));
  scatter(R, HQ() ? 150 : 60, 3, 18, (x, z) => prop(pick(['forest/Grass_1_A', 'forest/Grass_2_B', 'forest/Grass_1_C']), x, z, R() * 6.28, 1.3 + R()), 3.3);
  scatter(R, 8, 5, 15, (x, z) => prop(pick(['forest/Rock_1_J', 'forest/Rock_3_E']), x, z, R() * 6.28, 1 + R()));
  const cols = [0x5af0ff, 0xff6ad8, 0x9aff6a];
  scatter(R, 28, 3.6, 14, (x, z) => mushroom(x, z, 0.7 + R() * 1.3, cols[Math.floor(R() * 3)]), 3.6);
  [[-5, -3, 0x5af0ff], [4.6, -4, 0xff6ad8], [-3, 4.5, 0x9aff6a]].forEach(([x, z, c]) => { mushroom(x, z, 2.2, c); glowLight(x, 1.2, z, c, 9, 7); });
  placeFx.fireflies = 0xd8ff6a;
}
async function buildChateau() {
  setLook({ bg: 0xa6cbec, fog: [0xc8dcef, 26, 90], hemi: [0xe4f0ff, 0x7a6a50, 1.25], sun: [0xfff0d6, 2.8, 9, 15, 6], dust: 0xfff2c8, exp: 1.0 });
  const g = await loadBiome('chateau'); ground(0x7aa64a);
  for (let x = -8; x <= 8; x += 4) for (let z = -8; z <= 8; z += 4) if (Math.hypot(x, z) < 10) prop(g['dg/floor_tile_large'], x, z, 0, 1).position.y = 0.05;
  const R = rng(31);
  // remparts en arc derrière le combat, tours aux angles, château au fond
  for (let i = 0; i < 11; i++) { const a = -2.75 + i * 0.235, d = 15; prop(g[i === 5 ? 'hex/wall_straight_gate' : 'hex/wall_straight'], Math.cos(a) * d, Math.sin(a) * d, -a - Math.PI / 2, 3.2); }
  [[-2.75, 'hex/building_tower_A_red'], [-1.57, 'hex/building_tower_B_red'], [-0.4, 'hex/building_tower_A_red']].forEach(([a, n]) => { const d = 15; prop(g[n], Math.cos(a) * d, Math.sin(a) * d, R() * 6, 3.4); prop(g['hex/flag_red'], Math.cos(a) * d, Math.sin(a) * d, 0, 4.5, 8.2); });
  prop(g['hex/building_castle_red'], 2, -30, 0, 4.2); prop(g['hex/building_church_red'], -14, -26, 0.4, 5); prop(g['hex/building_home_A_red'], 14, -24, -0.3, 5);
  prop(g['dg/column'], -6, -5.5, 0, 1.4); prop(g['dg/column'], 6.5, -5, 0, 1.4); prop(g['hex/building_well_red'], -6.5, 2.5, 0.6, 3);
  prop(g['dg/banner_shield_red'], -4, -8.5, 0, 1); prop(g['dg/banner_patternA_red'], 4, -8.5, 0, 1);
  scatter(R, 18, 8, 13, (x, z) => prop(g[R() < 0.5 ? 'forest/Bush_2_C' : 'forest/Tree_1_A'], x, z, R() * 6.28, 0.9 + R() * 0.4), 7);
  for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.75, d = 50; prop(g['hex/mountain_A_grass'], Math.cos(a) * d, Math.sin(a) * d, R() * 6, 14); }
  for (let i = 0; i < 7; i++) { const c = prop(g['hex/cloud_big'], -40 + R() * 80, -30 - R() * 25, R() * 6.28, 4 + R() * 3, 16 + R() * 6); placeFx.clouds.push(c); }
}
async function buildCote() {
  setLook({ bg: 0x8cd6f2, fog: [0xbfe8f6, 26, 90], hemi: [0xe8f8ff, 0xc8b080, 1.3], sun: [0xfff4dc, 3.0, 6, 16, 8], dust: 0xffffff, exp: 1.0 });
  const g = await loadBiome('cote');
  // mer animée (vagues calculées à chaque image), plage de sable autour du combat
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 48, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2aa2d4, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.92, flatShading: true }));
  sea.position.y = -0.15; world.add(sea); placeFx.sea = sea;
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 0.6, 48), new THREE.MeshStandardMaterial({ color: 0xead6a2, roughness: 1 })); sand.position.set(-4, -0.29, -2); sand.receiveShadow = true; world.add(sand);
  const shore = new THREE.Mesh(new THREE.RingGeometry(14.6, 17.6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })); shore.position.set(-4, -0.08, -2); world.add(shore); placeFx.foam = shore;
  const R = rng(41), pick = a => g[a[Math.floor(R() * a.length)]];
  const inSand = (x, z) => Math.hypot(x + 4, z + 2) < 13.5;
  scatter(R, 14, 7, 16, (x, z) => { if (inSand(x, z)) prop(pick(['forest/Tree_4_A', 'forest/Tree_4_B']), x, z, R() * 6.28, 1.1 + R() * 0.4); });
  scatter(R, 18, 4, 16, (x, z) => { if (inSand(x, z)) prop(pick(['forest/Rock_2_A', 'forest/Rock_1_E', 'forest/Bush_4_A', 'forest/Grass_2_B']), x, z, R() * 6.28, 1 + R()); });
  const cc = [0xff7a9a, 0xff9a4a, 0xc86aff, 0xffd04a];
  scatter(R, 22, 6, 18, (x, z) => { if (Math.hypot(x + 4, z + 2) > 11) coral(x, z, 1 + R() * 1.5, cc[Math.floor(R() * 4)]); }, 5);
  scatter(R, 16, 12, 24, (x, z) => prop(pick(['hex/waterplant_A', 'hex/waterplant_B', 'hex/waterlily_A']), x, z, R() * 6.28, 6 + R() * 4, -0.1));
  prop(g['hex/tent'], -11, -6, 0.6, 5);
  for (let i = 0; i < 7; i++) { const c = prop(g[R() < 0.5 ? 'hex/cloud_big' : 'hex/cloud_small'], -40 + R() * 80, -28 - R() * 25, R() * 6.28, 4 + R() * 3, 15 + R() * 8); placeFx.clouds.push(c); }
}
async function buildNeige() {
  setLook({ bg: 0xc8d8ea, fog: [0xdce8f4, 18, 70], hemi: [0xf4f8ff, 0x8c9cb0, 1.3], sun: [0xe8f0ff, 2.2, -8, 14, 6], dust: 0xffffff, exp: 1.05 });
  const g = await loadBiome('neige'); ground(0xeef3f9).material.roughness = 0.85; disc(4.3, 0xdde6f0);
  const R = rng(51), pick = a => g[a[Math.floor(R() * a.length)]];
  scatter(R, 46, 8, 26, (x, z) => tint(prop(pick(['forest/Tree_4_A', 'forest/Tree_4_B', 'forest/Tree_4_C']), x, z, R() * 6.28, 1.1 + R() * 0.6), [0.62, 0.8, 0.82]));
  scatter(R, 8, 7, 18, (x, z) => prop(g['forest/Tree_Bare_1_B'], x, z, R() * 6.28, 1.3).traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(0x7d8592); } }));
  scatter(R, 14, 5, 18, (x, z) => tint(prop(pick(['forest/Rock_2_F', 'forest/Rock_3_K', 'forest/Rock_1_E']), x, z, R() * 6.28, 1 + R()), [1.25, 1.35, 1.5]));
  scatter(R, 9, 4.5, 14, (x, z) => crystals(x, z, 0.6 + R() * 0.5, 0x9adfff, 4), 4.5);
  // monticules de neige
  scatter(R, 16, 6, 20, (x, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: 0xf6f9fc, roughness: 0.9 })); m.scale.set(1.5 + R() * 2, 0.4 + R() * 0.4, 1.5 + R() * 2); m.position.set(x, 0, z); m.receiveShadow = true; world.add(m); });
  for (let i = 0; i < 10; i++) { const a = -2.8 + i * 0.4, d = 44 + R() * 8; tint(prop(pick(['hex/mountain_A', 'hex/mountain_B', 'hex/mountain_C']), Math.cos(a) * d, Math.sin(a) * d, R() * 6.28, 15 + R() * 8), [1.6, 1.7, 1.85]); }
  placeFx.snow = { col: [1, 1, 1], rate: 40, fall: -1.2, size: 0.12 };
}
async function buildDesert() {
  setLook({ bg: 0xf0d6a2, fog: [0xf2dcb0, 22, 80], hemi: [0xfff2d6, 0xb4844a, 1.25], sun: [0xfff0c4, 3.2, 5, 18, 4], dust: 0xf8e0a8, exp: 1.0 });
  const g = await loadBiome('desert'); ground(0xe0be82); disc(4.4, 0xd2ac70);
  const R = rng(61), pick = a => g[a[Math.floor(R() * a.length)]], SAND = [1.15, 0.92, 0.66];
  // dunes
  for (let i = 0; i < 12; i++) { const a = R() * 6.28, d = 24 + R() * 22; const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: 0xe6c488, roughness: 1 })); m.scale.set(8 + R() * 8, 2 + R() * 3, 5 + R() * 6); m.position.set(Math.cos(a) * d, -0.5, Math.sin(a) * d); m.rotation.y = R() * 3; m.receiveShadow = true; world.add(m); }
  // ruines : colonnes debout ou couchées, pans de mur, gravats, escalier
  [[-6, -6, 'dg/column'], [-3, -8, 'dg/pillar'], [5.5, -7, 'dg/wall_broken'], [9, -6, 'dg/column'], [-8, -1, 'dg/wall_half'], [1, -10, 'dg/stairs_wide'], [-9, -9, 'dg/rubble_half'], [-5, 4.5, 'dg/barrier_column']].forEach(([x, z, n]) => tint(prop(g[n], x, z, R() * 1.2 - 0.6, n === 'dg/column' ? 1.6 : 1), SAND));
  const fallen = tint(prop(g['dg/column'], 4, -4.5, 0.6, 1.5), SAND); fallen.rotation.z = Math.PI / 2; fallen.position.y = 0.5;
  scatter(R, 16, 6, 22, (x, z) => tint(prop(pick(['forest/Rock_2_A', 'forest/Rock_2_F', 'forest/Rock_3_E', 'forest/Rock_1_J']), x, z, R() * 6.28, 1 + R() * 1.5), [1.3, 1.0, 0.7]));
  scatter(R, 6, 8, 20, (x, z) => tint(prop(pick(['forest/Tree_Bare_2_A', 'forest/Tree_Bare_1_C']), x, z, R() * 6.28, 1.2), [1.1, 0.9, 0.7]));
  prop(g['hex/tent'], 11, -9, -0.5, 6);
  placeFx.snow = { col: [0.95, 0.82, 0.55], rate: 18, fall: -0.2, size: 0.09, wind: 2.2 };
}
async function buildVolcan() {
  setLook({ bg: 0x3a140a, fog: [0x4a1c0c, 0.032], hemi: [0xffa070, 0x2a0c06, 1.15], sun: [0xffb07a, 1.9, -4, 10, 8], dust: 0xff8a3a, exp: 1.45 });
  const g = await loadBiome('volcan'); ground(0x3a2a26); disc(4.3, 0x4a3832);
  const R = rng(71), pick = a => g[a[Math.floor(R() * a.length)]], BASALT = [0.32, 0.26, 0.26];
  // rivières et mares de lave qui pulsent
  [[-7, -3, 0.5, 9], [6, -6, -0.7, 11], [-2, -11, 0.1, 14]].forEach(([x, z, ry, len]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, len).rotateX(-Math.PI / 2), lavaMat()); m.position.set(x, 0.02, z); m.rotation.y = ry; world.add(m); glowLight(x, 1, z, 0xff5a1a, 12, 9); });
  scatter(R, 7, 5, 15, (x, z) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.8 + R() * 1.4, 20).rotateX(-Math.PI / 2), lavaMat()); m.position.set(x, 0.025, z); world.add(m); }, 5);
  scatter(R, 26, 5, 22, (x, z) => tint(prop(pick(['forest/Rock_2_A', 'forest/Rock_2_F', 'forest/Rock_3_K', 'forest/Rock_1_J']), x, z, R() * 6.28, 1 + R() * 1.6), BASALT));
  scatter(R, 7, 7, 18, (x, z) => tint(prop(pick(['forest/Tree_Bare_2_C', 'forest/Tree_Bare_1_B']), x, z, R() * 6.28, 1.2), [0.2, 0.16, 0.15]));
  // volcans au loin, cratère qui rougeoie
  for (let i = 0; i < 7; i++) { const a = -2.7 + i * 0.5, d = 42 + R() * 8, sc = 16 + R() * 10, o = tint(prop(pick(['hex/mountain_B', 'hex/mountain_C']), Math.cos(a) * d, Math.sin(a) * d, R() * 6.28, sc), [0.35, 0.28, 0.28]); if (i === 3) { const c = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), lavaMat()); c.position.set(o.position.x, sc * 1.7, o.position.z); world.add(c); glowLight(c.position.x, c.position.y + 3, c.position.z, 0xff4a0a, 60, 40); } }
  placeFx.embers = true; placeFx.snow = { col: [0.35, 0.32, 0.3], rate: 14, fall: -0.6, size: 0.08 };
}
async function buildCristal() {
  setLook({ bg: 0x1c1640, fog: [0x2a2254, 0.038], hemi: [0xbca8ff, 0x22124a, 0.95], sun: [0xc8b8ff, 1.3, -6, 12, 6], dust: 0xd8c0ff, exp: 1.25 });
  const g = await loadBiome('cristal'); ground(0x2e2a4e); disc(4.3, 0x3a3462);
  const R = rng(81), pick = a => g[a[Math.floor(R() * a.length)]];
  scatter(R, 34, 8, 24, (x, z) => tint(prop(pick(['forest/Tree_Bare_1_A', 'forest/Tree_Bare_2_B', 'forest/Tree_Bare_2_A', 'forest/Tree_Bare_1_C']), x, z, R() * 6.28, 1.3 + R() * 0.6), [1.6, 1.4, 2.4], 0x5a3aff, 0.5));
  const cols = [0x6ae0ff, 0xc86aff, 0xff7ae0, 0x8a9aff];
  scatter(R, 30, 4, 20, (x, z) => crystals(x, z, 0.6 + R() * 1.4, cols[Math.floor(R() * 4)], 4 + Math.floor(R() * 4)), 4);
  [[-5, -4, 0x6ae0ff], [5, -3.5, 0xff7ae0], [-1, -9, 0xc86aff]].forEach(([x, z, c]) => { crystals(x, z, 2.4, c, 7); glowLight(x, 1.5, z, c, 14, 9); });
  scatter(R, 10, 6, 18, (x, z) => tint(prop(pick(['forest/Rock_3_E', 'forest/Rock_2_F']), x, z, R() * 6.28, 1 + R()), [0.7, 0.65, 1.1]));
  placeFx.fireflies = 0xe0c8ff;
}
async function buildCiel() {
  setLook({ bg: 0xb8d6ff, fog: [0xf2ecfa, 30, 110], hemi: [0xfff8ec, 0xc8b8e0, 1.4], sun: [0xffe8b4, 2.8, 7, 16, 5], dust: 0xffe8a0, exp: 1.0 });
  const g = await loadBiome('ciel');
  // le combat se tient sur une île suspendue ; d'autres îles flottent autour, au-dessus d'une mer de nuages
  island(0, 0, 0.3, 9.5, 0xb6dc84, 0xa89a88); scene.background = new THREE.Color(0xb8d6ff);
  const R = rng(91), pick = a => g[a[Math.floor(R() * a.length)]], GOLD = [1.3, 1.15, 0.7];
  [[-6, -5], [6, -4.5], [-7, 3], [-2, -8], [3, -8.5]].forEach(([x, z]) => tint(prop(g['dg/column'], x, z, 0, 1.5), [1.6, 1.55, 1.4]));
  tint(prop(g['dg/stairs_wide'], 0, -9.5, 0, 0.8), [1.6, 1.55, 1.4]);
  scatter(R, 12, 6.5, 8.6, (x, z) => { if (z < -2) prop(pick(['forest/Bush_2_C', 'forest/Grass_1_A']), x, z, R() * 6.28, 0.8 + R() * 0.6); }, 6);
  for (let i = 0; i < 9; i++) {
    const a = -2.9 + i * 0.68, d = 18 + R() * 16, y = -4 + R() * 12, r = 2 + R() * 3, is = island(Math.cos(a) * d, y, Math.sin(a) * d, r, 0xb6dc84, 0xa89a88);
    placeFx.float.push({ o: is, y, ph: R() * 6 });
    const t = pick(['forest/Tree_1_A', 'forest/Tree_3_B']).scene.clone(true); t.scale.setScalar(0.6 + R() * 0.4); is.add(t);
    if (i === 4) { const ch = g['hex/building_church_red'].scene.clone(true); ch.scale.setScalar(2.4); tint(ch, GOLD); is.add(ch); }
  }
  for (let i = 0; i < 26; i++) { const c = prop(pick(['hex/cloud_big', 'hex/cloud_small']), -60 + R() * 120, -60 + R() * 110, R() * 6.28, 6 + R() * 6, -14 - R() * 6); c.traverse(o => { if (o.isMesh) o.castShadow = false; }); placeFx.clouds.push(c); }
  for (let i = 0; i < 6; i++) { const c = prop(pick(['hex/cloud_big', 'hex/cloud_small']), -40 + R() * 80, -30 - R() * 25, R() * 6.28, 4 + R() * 3, 16 + R() * 8); placeFx.clouds.push(c); }
  placeFx.fireflies = 0xffe8a0;
}
const PN = 900;
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSize = new Float32Array(PN), pAlpha = new Float32Array(PN);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('pcolor', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('psize', new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute('palpha', new THREE.BufferAttribute(pAlpha, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: 'attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC=pcolor; vA=palpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=psize*uScale/max(.1,-mv.z); gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-.5); if(r>.5) discard; float a=smoothstep(.5,.0,r); gl_FragColor=vec4(vC*(.6+a), a*vA); }'
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
const parts = []; for (let i = 0; i < PN; i++) parts.push({ life: 0 });
let pNext = 0;
function emit(p, v, col, size, life, g = -6, drag = 1.5) {
  const q = parts[pNext]; pNext = (pNext + 1) % PN;
  q.x = p.x; q.y = p.y; q.z = p.z; q.vx = v.x; q.vy = v.y; q.vz = v.z; q.c = col; q.s = size; q.life = q.max = life; q.g = g; q.drag = drag;
}
const tmpC = new THREE.Color();
function burst(p, col, n, sp, size = 0.25, up = 1) {
  tmpC.set(col);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, b = Math.random() * 2 - 1, s = sp * (0.4 + Math.random() * 0.6);
    emit(p, { x: Math.cos(a) * s * Math.sqrt(1 - b * b), y: Math.abs(b) * s * up + 1, z: Math.sin(a) * s * Math.sqrt(1 - b * b) }, [tmpC.r, tmpC.g, tmpC.b], size * (0.6 + Math.random() * 0.8), 0.45 + Math.random() * 0.5);
  }
}
function updParts(dt) {
  for (let i = 0; i < PN; i++) {
    const q = parts[i];
    if (q.life > 0) {
      q.life -= dt; const k = Math.max(0, q.life / q.max);
      q.vy += q.g * dt; const d = Math.exp(-q.drag * dt); q.vx *= d; q.vz *= d; q.vy *= d;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.04 && q.g < 0) { q.y = 0.04; q.vy *= -0.3; }
      pPos[i * 3] = q.x; pPos[i * 3 + 1] = q.y; pPos[i * 3 + 2] = q.z;
      pCol[i * 3] = q.c[0]; pCol[i * 3 + 1] = q.c[1]; pCol[i * 3 + 2] = q.c[2];
      pSize[i] = q.s * (0.4 + 0.6 * k); pAlpha[i] = k;
    } else if (pAlpha[i] !== 0) { pAlpha[i] = 0; }
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.pcolor.needsUpdate = pGeo.attributes.psize.needsUpdate = pGeo.attributes.palpha.needsUpdate = true;
}
function flame(pos) { return { p: pos.clone(), acc: 0 }; }

// poussière qui flotte dans les rayons de lune
const dust = [];
function dustInit(n) { dust.length = 0; for (let i = 0; i < n; i++) dust.push({ x: (Math.random() - 0.5) * 22, y: Math.random() * 6, z: (Math.random() - 0.5) * 18, ph: Math.random() * 9 }); }
const dustGeo = new THREE.BufferGeometry();
let dustPos;
function dustBuild() { dustPos = new Float32Array(dust.length * 3); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3)); }
const dustMat = new THREE.PointsMaterial({ color: 0xbfc8ff, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
const dustPts = new THREE.Points(dustGeo, dustMat); dustPts.frustumCulled = false; scene.add(dustPts);
function actor(g, ga) {
  const root = SkeletonUtils.clone(g.scene);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(root), acts = {};
  // ne garder que les pistes dont l'os existe (le squelette 2.0 a moins d'os que le 1.0)
  const names = new Set(); root.traverse(o => names.add(o.name));
  for (const c of (ga || g).animations) { const cc = ga ? new THREE.AnimationClip(c.name, c.duration, c.tracks.filter(t => names.has(t.name.split('.')[0]))) : c; acts[c.name] = mixer.clipAction(cc); }
  const A = { root, mixer, acts, cur: null, base: null };
  mixer.addEventListener('finished', e => { if (e.action === A.cur && A.onDone) { const f = A.onDone; A.onDone = null; f(); } });
  return A;
}
function play(A, name, { once = false, fade = 0.15, speed = 1, then = null } = {}) {
  if (A.code) return A.play(name, { speed, then });
  if (A.map && A.map[name]) name = A.map[name];
  const a = A.acts[name]; if (!a) return 0;
  if (A.cur && A.cur !== a) A.cur.fadeOut(fade);
  a.reset(); a.setEffectiveTimeScale(speed); a.setEffectiveWeight(1); a.fadeIn(fade);
  a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
  a.play(); A.cur = a; A.onDone = then;
  return a.getClip().duration / speed;
}
const spawning = A => A.code ? A.spawning : A.cur === A.acts[(A.map && A.map.Spawn_Ground_Skeletons) || 'Spawn_Ground_Skeletons'];
function fitHeight(root, h) {
  const box = new THREE.Box3().setFromObject(root), cur = box.max.y - box.min.y;
  root.scale.multiplyScalar(h / cur);
}

/* ---------- planning en temps de jeu (suit le ralenti) ---------- */
const timers = [];
const later = (t, f) => timers.push({ t, f });
function updTimers(dt) { for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].f; timers.splice(i, 1); f(); } } }
function hornGeo(side) {
  const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.18, 0.16, -0.02), new THREE.Vector3(side * 0.26, 0.42, -0.12), new THREE.Vector3(side * 0.16, 0.62, -0.3)]);
  const g = new THREE.TubeGeometry(c, 20, 0.11, 10, false), p = g.attributes.position, uv = g.attributes.uv, pts = c.getSpacedPoints(20), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { const u = uv.getX(i), k = Math.round(u * 20), ctr = pts[k], f = 1 - u * 0.9; v.fromBufferAttribute(p, i).sub(ctr).multiplyScalar(f).add(ctr); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function addHorns(root) {
  const head = root.getObjectByName('head'); if (!head) return;
  const mat = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.55 });
  const tip = new THREE.MeshStandardMaterial({ color: 0x6aff5a, emissive: 0x3aff2a, emissiveIntensity: 2 });
  [-1, 1].forEach(sd => {
    const h = new THREE.Mesh(hornGeo(sd), mat); h.castShadow = true;
    h.position.set(sd * 0.3, 0.95, 0.05); head.add(h);
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), tip); t.position.set(sd * 0.16, 0.62, -0.3); h.add(t);
  });
}

/* ---------- lieux des modes de jeu : Tour (3 tours), Arène des Familiers, Donjon du jour ---------- */
const MD = n => load('assets/md/' + n + '.glb');
async function loadMD(names) { const g = {}; await Promise.all(names.map(async n => { g[n] = n.startsWith('md/') ? await MD(n.slice(3)) : await load('assets/dg/' + n + '.glb'); })); return g; }
// angle de pose d'un mur en anneau pour qu'il regarde le centre
const faceIn = a => Math.atan2(-Math.cos(a), -Math.sin(a));
// côté caméra : on n'y met rien (le combat doit rester visible)
const camSide = a => Math.cos(a) * CAMDIR.x + Math.sin(a) * CAMDIR.y > 0.25;
function ringOf(n, R, y, cb) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; if (camSide(a)) continue; cb(Math.cos(a) * R, Math.sin(a) * R, faceIn(a), i, a); } }
function stars(n, R, col = 0xffffff) {
  const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = 0.05 + Math.random() * 0.9; p[i * 3] = Math.cos(a) * Math.cos(e) * R; p[i * 3 + 1] = Math.sin(e) * R; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * R; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: 0.35, fog: false, transparent: true, opacity: 0.9 })); world.add(s); return s;
}
// plateau de pierre avec un cercle de runes : il reste sous le héros quand le décor défile (montée d'étage, couloir)
function runeLift(r, col, root) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.9 })); top.position.y = -0.14; top.receiveShadow = true; g.add(top);
  const rm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  const r1 = new THREE.Mesh(new THREE.RingGeometry(r * 0.86, r * 0.9, 64).rotateX(-Math.PI / 2), rm); r1.position.y = 0.025; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.RingGeometry(r * 0.6, r * 0.62, 6).rotateX(-Math.PI / 2), rm); r2.position.y = 0.025; g.add(r2);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32).rotateX(-Math.PI / 2), rm); m.position.set(Math.cos(a) * r * 0.75, 0.026, Math.sin(a) * r * 0.75); m.rotation.y = -a; g.add(m); }
  g.position.y = 0.1; root.add(g); placeFx.rune = rm; return g;
}
const TWC3 = [
  { tint: [0.92, 0.95, 1.05], bg: 0x1c2436, gl: 0xffa63a, fl: [1, 0.62, 0.2], ban: 'banner_patternA_red', hemi: 0x9aa8d8 },
  { tint: [0.78, 0.72, 1.08], bg: 0x120e26, gl: 0x4aa8ff, fl: [0.5, 0.8, 1], ban: 'md/banner_triple_blue', hemi: 0x8a88ff },
  { tint: [1.15, 0.58, 0.5], bg: 0x2a0806, gl: 0xff3a14, fl: [1, 0.35, 0.1], ban: 'md/banner_triple_red', hemi: 0xff9a7a }
];
async function buildTour(d) {
  const C = TWC3[d] || TWC3[0];
  setLook({ bg: C.bg, fog: [C.bg, 0.03], hemi: [C.hemi, 0x2a2018, 0.75], sun: [0xd8dcff, 1.1, -5, 14, 6], dust: C.gl, exp: 1.3 });
  const g = await loadMD(['floor_tile_large', 'floor_tile_large_rocks', 'wall', 'wall_pillar', 'md/wall_archedwindow_open', 'torch_mounted', 'stairs_wide', 'candle_triple', 'barrel_large', 'crates_stacked', 'sword_shield_gold', C.ban]);
  const root = world, sc = new THREE.Group(); root.add(sc); world = sc;
  const T = o => tint(o, C.tint);
  for (let x = -12; x <= 12; x += 4) for (let z = -12; z <= 12; z += 4) if (Math.hypot(x, z) < 9) T(prop(Math.abs(x * 7 + z * 3) % 5 === 1 ? g.floor_tile_large_rocks : g.floor_tile_large, x, z));
  // trois étages de murs en anneau, fenêtres en arc sur la nuit
  for (let lv = 0; lv < 3; lv++) ringOf(12, 7.9, lv * 4, (x, z, ry, i) => T(prop(lv === 1 && i % 4 === 2 ? g['md/wall_archedwindow_open'] : i % 4 === 0 ? g.wall_pillar : g.wall, x, z, ry, 1, lv * 4)));
  // escalier en colimaçon contre le mur
  for (let k = 0; k < 9; k++) { const a = 2.5 + k * 0.24; T(prop(g.stairs_wide, Math.cos(a) * 6.4, Math.sin(a) * 6.4, faceIn(a) + Math.PI / 2, 0.75, k * 1.1)); }
  ringOf(8, 7.6, 0, (x, z, ry, i, a) => { if (i % 2) return; const t = prop(g.torch_mounted, x, z, ry); t.position.y = 2.3; const L = new THREE.PointLight(C.gl, 16, 12, 1.8); L.position.set(Math.cos(a) * 7, 3.1, Math.sin(a) * 7); world.add(L); torches.push({ L, base: 16, ph: i * 1.3, fl: flame(L.position), fc: C.fl }); });
  ringOf(8, 7.65, 0, (x, z, ry, i) => { if (i % 2 === 0) return; const b = prop(g[C.ban], x, z, ry); b.position.y = 0.4; });
  T(prop(g.barrel_large, -4.6, -4.4)); T(prop(g.crates_stacked, -5.6, -1.6, 0.5)); prop(g.candle_triple, -3.4, -5.4); prop(g.candle_triple, 3.2, -5.6);
  const sw = prop(g.sword_shield_gold, -1.4, -7.4); sw.position.y = 3.2;
  world = root;
  stars(260, 60); runeLift(3.6, C.gl, root);
  placeFx.climb = sc; placeFx.axis = 'y';
}
async function buildArene() {
  setLook({ bg: 0x3a2848, fog: [0x4a3046, 34, 95], hemi: [0xffd8b8, 0x6a4a2a, 1.15], sun: [0xffc890, 2.4, -6, 15, 5], dust: 0xffd8a0, exp: 1.05 });
  const g = await loadMD(['md/wall_arched', 'wall_pillar', 'wall_half', 'torch_mounted', 'banner_patternA_red', 'md/banner_patternA_blue', 'md/banner_patternB_yellow', 'barrel_large', 'md/sword_shield_broken', 'md/trunk_large_A']);
  ground(0x8a6a44);
  const sand = disc(10, 0xd2a868); sand.material.roughness = 1;
  const line = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.8, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a5a2a, transparent: true, opacity: 0.6 })); line.position.y = 0.02; world.add(line);
  const SAND = [1.15, 1.0, 0.82];
  // gradins : trois rangées d'arches qui montent en s'éloignant
  for (let lv = 0; lv < 3; lv++) ringOf(16 + lv * 4, 9.6 + lv * 2.6, lv * 3.2, (x, z, ry, i) => tint(prop(i % 5 === 0 ? g.wall_pillar : g['md/wall_arched'], x, z, ry, 1, lv * 3.2), SAND));
  // la foule : têtes et bustes instanciés, chacun sa couleur, qui sautillent
  const N = HQ() ? 260 : 140, body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 0.35, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), N), head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8c0a0, roughness: 0.7 }), N);
  const fans = []; let k = 0, tries = 0;
  while (k < N && tries++ < N * 6) { const lv = Math.floor(Math.random() * 3), a = Math.random() * 6.283; if (camSide(a)) continue; const r = 10.7 + lv * 2.6 + Math.random() * 0.8; fans.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 4 + lv * 3.2, ph: Math.random() * 6, sp: 5 + Math.random() * 4 }); body.setColorAt(k, new THREE.Color().setHSL(Math.random(), 0.45, 0.42)); k++; }
  body.count = head.count = fans.length; world.add(body, head);
  placeFx.crowd = { body, head, fans, cheer: 0 };
  ringOf(9, 9.25, 0, (x, z, ry, i, a) => { const b = prop(g[['banner_patternA_red', 'md/banner_patternA_blue', 'md/banner_patternB_yellow'][i % 3]], x * 0.99, z * 0.99, ry); b.position.y = 3.2; });
  ringOf(6, 9.3, 0, (x, z, ry, i, a) => { const t = prop(g.torch_mounted, x, z, ry); t.position.y = 2.4; const L = new THREE.PointLight(0xffa040, 18, 13, 1.8); L.position.set(Math.cos(a) * 8.7, 3.2, Math.sin(a) * 8.7); world.add(L); torches.push({ L, base: 18, ph: i * 1.1, fl: flame(L.position) }); });
  prop(g.barrel_large, -6.4, -4.8); prop(g['md/sword_shield_broken'], -4.6, -6.6, 0.4); prop(g['md/trunk_large_A'], 4.6, -6.8, -0.6);
  stars(140, 70); runeLift(3.6, 0xffc04a, world).visible = false;
  placeFx.axis = null;
}
async function buildCouloir() {
  setLook({ bg: 0x0c120e, fog: [0x101a14, 0.05], hemi: [0x9ac8b0, 0x2a2418, 1.0], sun: [0xc8ffe0, 1.1, -5, 12, 6], dust: 0x9affd0, exp: 1.45 });
  const g = await loadMD(['floor_tile_large', 'md/floor_tile_big_grate', 'md/floor_tile_small_weeds_A', 'wall', 'wall_pillar', 'md/wall_gated', 'md/wall_window_open', 'torch_mounted', 'md/keyring_hanging', 'md/barrel_small_stack', 'md/table_long_broken', 'rubble_large', 'md/candle_lit', 'md/banner_thin_green', 'md/banner_patternC_green', 'md/trunk_large_A']);
  const root = world, sc = new THREE.Group(); root.add(sc); world = sc;
  const MOSS = [0.85, 1.0, 0.85];
  // couloir qui file vers le fond (axe z) : 4 m de large de chaque côté, répété pour défiler sans couture
  for (let z = -40; z <= 12; z += 4) for (let x = -4; x <= 8; x += 4) { const r = Math.abs(Math.sin(x * 3.1 + z * 1.7)); tint(prop(r < 0.15 ? g['md/floor_tile_big_grate'] : r < 0.3 ? g['md/floor_tile_small_weeds_A'] : g.floor_tile_large, x, z, 0, r < 0.3 && r >= 0.15 ? 2 : 1), MOSS); }
  for (let z = -40; z <= 12; z += 4) {
    const i = Math.round(z / 4);
    tint(prop(i % 3 === 0 ? g.wall_pillar : i % 3 === 1 ? g['md/wall_window_open'] : g.wall, -6.5, z, Math.PI / 2), MOSS);
    tint(prop(i % 3 === 0 ? g.wall_pillar : g.wall, -6.5, z, Math.PI / 2, 1, 4), MOSS);
    if (i % 2 === 0) { const t = prop(g.torch_mounted, -6.1, z, Math.PI / 2); t.position.y = 2.2; const L = new THREE.PointLight(0x5ae0a0, 12, 10, 1.8); L.position.set(-5.5, 3.0, z); world.add(L); torches.push({ L, base: 12, ph: i * 1.7, fl: flame(L.position), fc: [0.45, 1, 0.7] }); }
    else { const k = prop(g['md/keyring_hanging'], -6.2, z, Math.PI / 2); k.position.y = 2.6; const b = prop(g[i % 4 === 1 ? 'md/banner_thin_green' : 'md/banner_patternC_green'], -6.3, z + 1.6, Math.PI / 2); b.position.y = 0.6; }
  }
  // fond : herse fermée, encadrée de piliers, une lueur verte derrière
  [-4, 0, 4, 8].forEach(x => tint(prop(x === 0 ? g['md/wall_gated'] : g.wall, x, -42, 0), MOSS));
  const gl = new THREE.PointLight(0x5ae0a0, 30, 16, 1.6); gl.position.set(0, 2, -44); world.add(gl);
  const R = rng(17);
  for (let z = -36; z <= 4; z += 8) { prop(g['md/barrel_small_stack'], -5 + R(), z + R() * 2, R() * 6); prop(g.rubble_large, -4.6, z + 4 + R(), R() * 6, 0.7); prop(g['md/candle_lit'], -5.6, z + 2.4); }
  prop(g['md/table_long_broken'], -4.4, -7, 0.3); prop(g['md/trunk_large_A'], -5, -12, 1.2);
  world = root;
  runeLift(3.6, 0x5ae0a0, root);
  placeFx.climb = sc; placeFx.axis = 'z';
}
// défilement du décor : montée d'étage (Tour, axe y) ou avancée dans le couloir (Donjon, axe z)
let climbT = 0;
function climbTick(now) {
  const sc = placeFx.climb; if (!sc || !climbT) return;
  const k = (now - climbT) / 1000; if (k >= 1) { sc.position.set(0, 0, 0); climbT = 0; return; }
  const e = x => x * x * (3 - 2 * x), D = placeFx.axis === 'y' ? -8 : 8, v = k < 0.5 ? D * e(k * 2) : -D * (1 - e((k - 0.5) * 2));
  if (placeFx.axis === 'y') sc.position.y = v; else sc.position.z = v;
  if (placeFx.rune) placeFx.rune.opacity = 0.75 + 0.25 * Math.sin(k * Math.PI);
  if (Math.random() < 0.8) { tmpC.set(placeFx.rune ? placeFx.rune.color : 0xffffff); const a = Math.random() * 6.28, r = 3.4 + Math.random() * 0.4; emit(new THREE.Vector3(Math.cos(a) * r, 0.1, Math.sin(a) * r), { x: 0, y: placeFx.axis === 'y' ? 6 : 1, z: placeFx.axis === 'z' ? 4 : 0 }, [tmpC.r, tmpC.g, tmpC.b], 0.25, 0.6, 0, 0.5); }
}
function crowdTick(t, now) {
  const C = placeFx.crowd; if (!C) return;
  const ch = Math.max(0, 1 - (now - C.cheer) / 2500);
  C.fans.forEach((f, i) => {
    const j = Math.max(0, Math.sin(t * f.sp + f.ph)) * (0.06 + ch * 0.45);
    dummy.position.set(f.x, f.y + 0.45 + j, f.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); C.body.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 0.55; dummy.updateMatrix(); C.head.setMatrixAt(i, dummy.matrix);
  });
  C.body.instanceMatrix.needsUpdate = C.head.instanceMatrix.needsUpdate = true;
}


/* ---------- familiers en 3D : 9 espèces fabriquées en code, 3 formes (Jeune, Adulte, Ancestral), aura de rareté ---------- */
const PACC = [0xff8a3a, 0xc9a0ff, 0xff5a3a, 0x5ef0c0, 0x5ab0ff, 0x7af0ff, 0xffd84a, 0xff7a2a, 0xff9a1a];
const RARC = [0xb9c0cc, 0x5ab0ff, 0xc084ff, 0xffc84a, 0xff4d8d];
const PFLY = [false, false, false, true, false, false, false, true, true];
function petModel(sp, form, rar) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const P = { root, body, sp, form, rar, t: Math.random() * 9, act: null, actT: 0, fly: PFLY[sp] || (sp === 0 && form > 0), wings: [], tails: [], ears: [], glow: [] };
  const acc = new THREE.Color(PACC[sp]), rc = new THREE.Color(RARC[rar] || RARC[0]);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55 }, o));
  const E = (c, k = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.3 });
  const add = (geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, par = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; par.add(m); return m; };
  const S = r => new THREE.SphereGeometry(r, 18, 12), C = (r, h, n = 10) => new THREE.ConeGeometry(r, h, n);
  const grp = (x, y, z, par = body) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; };
  const eyes = (par, y, z, dx, r, iris = 0x1a1020) => [-1, 1].forEach(sd => { add(S(r), M(0xffffff, { roughness: 0.2 }), sd * dx, y, z, 1, 1, 0.7, par); add(S(r * 0.6), M(iris, { roughness: 0.15 }), sd * dx, y, z + r * 0.45, 1, 1, 0.6, par); add(S(r * 0.2), new THREE.MeshBasicMaterial({ color: 0xffffff }), sd * dx + r * 0.2, y + r * 0.25, z + r * 0.72, 1, 1, 1, par); });
  const wing = (par, sd, w, h, mat) => { const g = grp(sd * 0.22, 0, 0, par); const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, h * 0.6); s.lineTo(w * 0.85, -h * 0.1); s.lineTo(w * 0.5, -h * 0.25); s.lineTo(w * 0.2, -h * 0.3); s.lineTo(0, -h * 0.15); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat); m.scale.x = sd; m.rotation.y = sd * 0.3; m.castShadow = true; g.add(m); P.wings.push({ g, sd }); return g; };
  const cream = M(0xfff2dc), dark = M(0x2a1a14);
  if (sp === 0) { // Dragonnet → Dragon → Dragon sage
    const sk = M(new THREE.Color().setHSL(0.03, 0.75, 0.5)), bel = M(0xffd49a), memb = M(new THREE.Color().setHSL(0.05, 0.7, 0.4), { side: THREE.DoubleSide });
    add(S(0.36), sk, 0, 0.42, 0, 1, 0.95, 1.15); add(S(0.25), bel, 0, 0.4, 0.22, 1, 1.05, 0.6);
    P.head = grp(0, 0.82, 0.2); add(S(0.28), sk, 0, 0, 0, 1, 0.92, 1, P.head); add(S(0.16), sk, 0, -0.06, 0.24, 1.1, 0.8, 1.2, P.head);
    eyes(P.head, 0.06, 0.2, 0.12, 0.075, 0xffa020);
    [-1, 1].forEach(sd => { const h = add(C(0.06, 0.26), M(0xfff0d0), sd * 0.13, 0.24, -0.06, 1, 1, 1, P.head); h.rotation.x = -0.6; h.rotation.z = -sd * 0.3; if (form === 2) { const h2 = add(C(0.045, 0.2), M(0xfff0d0), sd * 0.2, 0.16, -0.12, 1, 1, 1, P.head); h2.rotation.x = -0.9; h2.rotation.z = -sd * 0.8; } });
    P.wingRoot = grp(0, 0.62, -0.08); [-1, 1].forEach(sd => wing(P.wingRoot, sd, 0.5 + form * 0.18, 0.5 + form * 0.12, memb));
    let par = body, z = -0.38; for (let i = 0; i < 4; i++) { const g = grp(0, i ? 0 : 0.36, z, par); add(C(0.13 - i * 0.025, 0.36), sk, 0, 0, -0.14, 1, 1, 1, g).rotation.x = -Math.PI / 2; P.tails.push(g); par = g; z = -0.26; }
    for (let i = 0; i < 3; i++) add(C(0.05, 0.14, 6), bel, 0, 0.76 - i * 0.1, -0.1 - i * 0.16).rotation.x = -0.4;
    if (form === 2) P.glow.push(add(S(0.07), E(0xffd040, 2.2), 0, 0.46, 0.36));
    P.atk = 0xff7a2a;
  } else if (sp === 1) { // Chaton lunaire → Chat lunaire → Panthère d'éclipse
    const fur = M(form === 2 ? 0x3a2a5a : new THREE.Color().setHSL(0.74, 0.35, 0.72)), inner = M(0xffc8e8);
    add(S(0.33), fur, 0, 0.36, -0.02, 1, 0.88, 1.35 + form * 0.12);
    P.head = grp(0, 0.74, 0.3); add(S(0.3), fur, 0, 0, 0, 1.08, 0.92, 1, P.head); add(S(0.1), M(0xfff6fa), 0, -0.08, 0.24, 1.3, 0.8, 0.8, P.head);
    eyes(P.head, 0.04, 0.22, 0.12, 0.08, form === 2 ? 0xffd040 : 0x5a3aa0);
    [-1, 1].forEach(sd => { const e = add(C(0.11, 0.24, 4), fur, sd * 0.17, 0.27, -0.02, 1, 1, 0.6, P.head); e.rotation.z = -sd * 0.25; add(C(0.06, 0.14, 4), inner, sd * 0.17, 0.25, 0.03, 1, 1, 0.4, P.head).rotation.z = -sd * 0.25; P.ears.push(e); });
    const moon = add(new THREE.TorusGeometry(0.07, 0.025, 8, 16, Math.PI * 1.3), E(0xfff0a0, 2), 0, 0.17, 0.27, 1, 1, 1, P.head); moon.rotation.z = 0.6;
    let par = grp(0, 0.4, -0.42), y = 0; P.tails.push(par); for (let i = 0; i < 6; i++) { const g = grp(0, i ? 0.1 : 0, i ? -0.04 : 0, par); add(S(0.07 - i * 0.004), fur, 0, 0, 0, 1, 1, 1, g); P.tails.push(g); par = g; }
    [[-0.15, 0.22], [0.15, 0.22], [-0.15, -0.28], [0.15, -0.28]].forEach(([x, z]) => add(S(0.08), fur, x, 0.07, z, 1, 0.8, 1.2));
    if (form === 2) for (let i = 0; i < 5; i++) P.glow.push(add(S(0.04), E(0xc9a0ff, 2), (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.1, (Math.random() - 0.5) * 0.6));
    P.atk = 0xc9a0ff;
  } else if (sp === 2) { // Renard de feu → Renard flamboyant → Kitsune solaire
    const fur = M(0xff7a2a), white = M(0xfff4e8), tip = E(0xffd040, 1.8);
    add(S(0.3), fur, 0, 0.36, -0.02, 1, 0.88, 1.35); add(S(0.2), white, 0, 0.38, 0.22, 1, 1, 0.6);
    P.head = grp(0, 0.74, 0.3); add(S(0.27), fur, 0, 0, 0, 1.05, 0.9, 1, P.head); add(C(0.13, 0.32), white, 0, -0.06, 0.28, 1, 1, 1, P.head).rotation.x = Math.PI / 2; add(S(0.04), dark, 0, -0.06, 0.44, 1, 1, 1, P.head);
    eyes(P.head, 0.05, 0.2, 0.11, 0.07, 0x5a2a0a);
    [-1, 1].forEach(sd => { const e = add(C(0.12, 0.32, 4), fur, sd * 0.15, 0.3, -0.02, 1, 1, 0.55, P.head); e.rotation.z = -sd * 0.2; P.ears.push(e); });
    const n = [1, 2, 3][form];
    for (let i = 0; i < n; i++) { const g = grp(0, 0.42, -0.36); g.rotation.y = (i - (n - 1) / 2) * 0.55; add(S(0.15), fur, 0, 0.12, -0.25, 1, 1, 2.2, g).rotation.x = 0.5; add(S(0.09), tip, 0, 0.36, -0.5, 1, 1, 1.4, g); P.tails.push(g); }
    [[-0.14, 0.22], [0.14, 0.22], [-0.14, -0.26], [0.14, -0.26]].forEach(([x, z]) => add(S(0.07), dark, x, 0.07, z, 1, 1.3, 1.1));
    if (form === 2) P.glow.push(add(new THREE.TorusGeometry(0.42, 0.02, 6, 32), E(0xffd040, 2), 0, 0.55, -0.15, 1, 1, 1));
    P.atk = 0xff6a1a;
  } else if (sp === 3) { // Hibou sage → Grand-duc des arcanes → Oracle ailé
    const fe = M(new THREE.Color().setHSL(0.45, 0.35, form === 2 ? 0.3 : 0.42)), face = M(0xf2e6c8), memb = M(new THREE.Color().setHSL(0.45, 0.35, 0.34), { side: THREE.DoubleSide });
    add(S(0.4), fe, 0, 0.45, 0, 1, 1.12, 0.95); add(S(0.3), face, 0, 0.62, 0.17, 1.1, 0.9, 0.55);
    P.head = grp(0, 0.62, 0.22); eyes(P.head, 0.02, 0.06, 0.13, 0.11, 0xff9a1a);
    add(C(0.05, 0.12, 6), M(0xe0a040), 0, -0.1, 0.16, 1, 1, 1, P.head).rotation.x = Math.PI;
    [-1, 1].forEach(sd => { const t = add(C(0.07, 0.22, 5), fe, sd * 0.2, 0.32, -0.08, 1, 1, 1, P.head); t.rotation.z = -sd * 0.4; P.ears.push(t); });
    P.wingRoot = grp(0, 0.5, -0.05); [-1, 1].forEach(sd => wing(P.wingRoot, sd, 0.42 + form * 0.12, 0.45, memb));
    [-1, 1].forEach(sd => add(C(0.04, 0.1, 5), M(0xe0a040), sd * 0.1, 0.06, 0.08, 1, 1, 1).rotation.x = Math.PI);
    if (form >= 1) { const ring = add(new THREE.TorusGeometry(0.62, 0.015, 6, 48), E(0x5ef0c0, 2.2), 0, 0.5, 0); ring.rotation.x = Math.PI / 2; P.glow.push(ring); P.orbit = ring; }
    P.atk = 0x5ef0c0;
  } else if (sp === 4) { // Slime apprivoisé → Slime royal → Slime empereur
    const col = new THREE.Color(0x5ab0ff), geo = S(0.42), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < -0.12) pos.setY(i, -0.12 + (y + 0.12) * 0.25); }
    geo.computeVertexNormals();
    P.blob = add(geo, M(col, { roughness: 0.12, transparent: true, opacity: 0.82, emissive: col.clone().multiplyScalar(0.2) }), 0, 0.16, 0);
    add(S(0.13), M(col.clone().multiplyScalar(0.5), { transparent: true, opacity: 0.85 }), 0.05, 0.16, -0.05);
    eyes(body, 0.3, 0.3, 0.12, 0.08); add(S(0.05), M(0x2a0a14), 0, 0.17, 0.39, 1.4, 0.5, 0.5);
    if (form >= 1) { const cr = grp(0, 0.52, 0); const gold = M(0xffc84a, { metalness: 0.7, roughness: 0.3 }); add(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 10, 1, true), gold, 0, 0, 0, 1, 1, 1, cr); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; add(C(0.035, 0.1, 4), gold, Math.cos(a) * 0.15, 0.09, Math.sin(a) * 0.15, 1, 1, 1, cr); } if (form === 2) { add(S(0.04), E(0xff4d8d, 2), 0, 0.02, 0.15, 1, 1, 1, cr); cr.scale.setScalar(1.3); } }
    P.atk = 0x5ab0ff;
  } else if (sp === 5) { // Golem caillou → Golem de pierre → Colosse de granit
    const st = M(0x8a8a90, { flatShading: true, roughness: 0.9 }), cry = E(0x7af0ff, 1.4);
    const blk = (r, x, y, z, sx = 1, sy = 1, sz = 1, par = body) => add(new THREE.IcosahedronGeometry(r, 0), st, x, y, z, sx, sy, sz, par);
    P.torso = grp(0, 0.45, 0); blk(0.32, 0, 0, 0, 1.15, 1, 0.9, P.torso);
    P.head = grp(0, 0.38, 0.05, P.torso); blk(0.18, 0, 0, 0, 1, 0.9, 1, P.head);
    [-1, 1].forEach(sd => add(S(0.04), E(0x7af0ff, 2.4), sd * 0.07, 0.02, 0.15, 1, 1, 1, P.head));
    P.arms = [-1, 1].map(sd => { const g = grp(sd * 0.38, 0.08, 0, P.torso); blk(0.13, 0, -0.12, 0, 1, 1.4, 1, g); blk(0.12, 0, -0.32, 0.03, 1, 1, 1, g); return g; });
    [-1, 1].forEach(sd => blk(0.13, sd * 0.16, 0.12, 0, 1, 1, 1));
    for (let i = 0; i < 2 + form * 2; i++) { const c = add(C(0.06, 0.24 + Math.random() * 0.14, 6), cry, (Math.random() - 0.5) * 0.4, 0.22, -0.2 - Math.random() * 0.06, 1, 1, 1, P.torso); c.rotation.set(-0.4 - Math.random() * 0.3, 0, (Math.random() - 0.5) * 0.8); P.glow.push(c); }
    P.atk = 0x9a9aa0;
  } else if (sp === 6) { // Lapin étoilé → Lièvre céleste → Lièvre des constellations
    const fur = M(form === 2 ? 0x2a3a6a : 0xfafaff), inner = M(0xffc8d8), star = E(0xffd84a, 2);
    add(S(0.32), fur, 0, 0.36, -0.04, 1, 1, 1.1); P.head = grp(0, 0.74, 0.12); add(S(0.26), fur, 0, 0, 0, 1, 0.95, 1, P.head);
    eyes(P.head, 0.04, 0.2, 0.11, 0.075, form === 2 ? 0xffd84a : 0x2a1a3a); add(S(0.035), inner, 0, -0.05, 0.25, 1, 1, 1, P.head);
    [-1, 1].forEach(sd => { const g = grp(sd * 0.1, 0.18, -0.02, P.head); add(S(0.08), fur, 0, 0.26, 0, 1, 3.4, 0.6, g); add(S(0.05), inner, 0, 0.26, 0.04, 1, 3, 0.3, g); g.rotation.z = -sd * 0.15; P.ears.push(g); });
    add(S(0.1), fur, 0, 0.32, -0.38); const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.05 : 0.12, a = i / 10 * 6.283 + Math.PI / 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    P.glow.push(add(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }), star, 0, 0.36, 0.3));
    if (form === 2) for (let i = 0; i < 6; i++) P.glow.push(add(S(0.03), star, (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5));
    [[-0.13, 0.18], [0.13, 0.18]].forEach(([x, z]) => add(S(0.07), fur, x, 0.06, z, 1, 0.8, 1.3));
    P.atk = 0xffd84a;
  } else if (sp === 7) { // Poussin de braise → Phénix → Phénix divin
    const fl = E(0xff7a2a, 1.4), gold = E(0xffd040, 1.6), memb = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff4a0a, emissiveIntensity: 1.3, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    if (form === 0) { add(S(0.3), M(0xffb030), 0, 0.3, 0); eyes(body, 0.4, 0.24, 0.1, 0.06); add(C(0.05, 0.1, 6), M(0xff7a1a), 0, 0.33, 0.3).rotation.x = Math.PI / 2; P.glow.push(add(C(0.08, 0.2, 6), fl, 0, 0.62, 0)); P.wingRoot = grp(0, 0.32, 0); [-1, 1].forEach(sd => wing(P.wingRoot, sd, 0.2, 0.2, memb)); P.fly = false; }
    else {
      add(S(0.26), fl, 0, 0.5, 0, 1, 1, 1.3); P.head = grp(0, 0.78, 0.22); add(S(0.17), fl, 0, 0, 0, 1, 1, 1, P.head); eyes(P.head, 0.03, 0.12, 0.08, 0.05, 0x3a0a00);
      add(C(0.05, 0.14, 6), gold, 0, -0.02, 0.2, 1, 1, 1, P.head).rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) add(C(0.03, 0.2, 5), gold, (i - 1) * 0.06, 0.18, -0.04, 1, 1, 1, P.head).rotation.x = -0.5;
      P.wingRoot = grp(0, 0.6, -0.05); [-1, 1].forEach(sd => wing(P.wingRoot, sd, 0.55 + form * 0.2, 0.6, memb));
      for (let i = 0; i < 3 + form; i++) { const g = grp(0, 0.45, -0.3); g.rotation.y = (i - (2 + form) / 2) * 0.25; add(C(0.05, 0.6, 5), memb, 0, 0, -0.3, 1, 1, 1, g).rotation.x = -Math.PI / 2 - 0.3; P.tails.push(g); }
    }
    P.light = new THREE.PointLight(0xff7a2a, 4, 3, 2); P.light.position.y = 0.5; body.add(P.light); P.ember = [1, 0.5, 0.12];
    P.atk = 0xff7a2a;
  } else { // Citrouille-follet → Lanterne-citrouille → Roi des citrouilles
    const pk = M(0xff8a1a, { roughness: 0.65 }), lit = E(0xffd040, 2.4);
    P.pump = grp(0, 0.38, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; add(S(0.24), pk, Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14, 0.7, 1, 0.7, P.pump); }
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 6), M(0x4a6a2a), 0, 0.27, 0, 1, 1, 1, P.pump).rotation.z = 0.3;
    add(S(0.08), M(0x5a9a3a), 0.1, 0.3, 0, 1.4, 0.3, 0.8, P.pump);
    [-1, 1].forEach(sd => add(C(0.06, 0.1, 3), lit, sd * 0.1, 0.06, 0.28, 1, 1, 0.4, P.pump));
    add(S(0.1), lit, 0, -0.08, 0.27, 1.6, 0.45, 0.35, P.pump);
    if (form === 2) { const cr = grp(0, 0.38, 0, P.pump), gold = M(0xffc84a, { metalness: 0.7, roughness: 0.3 }); add(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10, 1, true), gold, 0, 0, 0, 1, 1, 1, cr); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; add(C(0.03, 0.09, 4), gold, Math.cos(a) * 0.13, 0.07, Math.sin(a) * 0.13, 1, 1, 1, cr); } }
    P.light = new THREE.PointLight(0xffa030, 5, 3.5, 2); P.light.position.set(0, 0.4, 0.3); body.add(P.light); P.ember = [1, 0.6, 0.15];
    P.atk = 0xff9a1a;
  }
  // aura de rareté au sol, plus vive pour les raretés hautes
  const au = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.55, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: rc, transparent: true, opacity: 0.25 + rar * 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
  au.position.y = 0.02; root.add(au); P.aura = au; P.rc = [rc.r, rc.g, rc.b];
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  P.tails.forEach(g => { g.userData.ry0 = g.rotation.y; });
  const e = k => k * k * (3 - 2 * k), bump = k => Math.sin(Math.max(0, Math.min(1, k)) * Math.PI);
  P.play = (a, dur) => { P.act = a; P.actT = 0; P.actD = dur; };
  P.update = (dt, moving) => {
    P.t += dt; if (P.act) { P.actT += dt; if (P.actT > P.actD) P.act = null; }
    const k = P.act ? P.actT / P.actD : 0, t = P.t;
    let y = P.fly ? 0.75 + Math.sin(t * 2.2) * 0.12 : 0, z = 0, sx = 1, sy = 1, rx = 0;
    if (!P.fly) { const br = Math.sin(t * 3); sy = 1 + 0.03 * br; sx = 1 - 0.015 * br; }
    if (moving && !P.fly) y += Math.abs(Math.sin(t * 9)) * 0.22;
    if (P.act === 'atk') { const b = bump(k); z = 0.45 * b; rx = 0.25 * b; if (!P.fly) y += 0.15 * b; }
    if (P.act === 'pop') { const b = bump(k); sy *= 1 + 0.35 * b; sx *= 1 - 0.1 * b; y += 0.4 * b; }
    if (P.act === 'joy') y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.35;
    body.position.set(0, y, z); body.rotation.x = rx; body.scale.set(sx, sy, sx);
    const flap = Math.sin(t * (P.fly ? 9 : 4) + (moving ? t * 6 : 0));
    P.wings.forEach(w => { w.g.rotation.z = w.sd * (0.25 + flap * (P.fly ? 0.6 : 0.2)); });
    P.tails.forEach((g, i) => { g.rotation.y = g.userData.ry0 + Math.sin(t * 2.4 - i * 0.6) * 0.22; });
    P.ears.forEach((g, i) => { g.rotation.x = Math.max(0, Math.sin(t * 1.3 + i * 2) - 0.92) * 4; });
    if (P.head) P.head.rotation.x = Math.sin(t * 1.1) * 0.06;
    if (P.blob) { const w = Math.sin(t * 3.4); P.blob.scale.set(1 + 0.06 * w, 1 - 0.07 * w, 1 + 0.06 * w); }
    if (P.pump) P.pump.rotation.z = Math.sin(t * 1.5) * 0.08;
    if (P.arms) P.arms.forEach((a, i) => { a.rotation.x = (P.act === 'atk' ? -1.6 * bump(k) : 0) + Math.sin(t * 1.6 + i * 3) * 0.06; });
    if (P.orbit) { P.orbit.rotation.z += dt * 1.2; P.orbit.rotation.x = Math.PI / 2 + Math.sin(t) * 0.25; }
    P.glow.forEach((g, i) => { if (g.material && g.material.emissiveIntensity != null) g.material.emissiveIntensity = 1.6 + 0.6 * Math.sin(t * 3 + i); });
    if (P.light) P.light.intensity = (P.sp === 8 ? 4 : 3) + Math.sin(t * 9) * 0.8;
    P.aura.material.opacity = (0.22 + P.rar * 0.1) * (0.8 + 0.2 * Math.sin(t * 2.5));
    P.aura.position.y = 0.02; P.aura.scale.setScalar(P.fly ? 0.75 : 1);
    if (P.ember && Math.random() < (HQ() ? 0.5 : 0.2)) { const p = new THREE.Vector3(); body.getWorldPosition(p); p.y += 0.4 * root.scale.y; emit(p.add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)), { x: 0, y: 0.8, z: 0 }, P.ember, 0.18, 0.6, 0, 1); }
    if (P.rar >= 3 && Math.random() < 0.12) { const p = root.position.clone(); emit(p.add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.8)), { x: 0, y: 0.6, z: 0 }, P.rc, 0.16, 1, 0, 0.5); }
  };
  P.dispose = () => root.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
  return P;
}


/* ---------- vitrines 3D des menus : un seul moteur hors écran, recopié dans un petit canevas par vitrine ---------- */
let VR = null, vitRaf = 0, vitLast = 0;
const vits = new Map();
const vb = new THREE.Vector2(), vs = new THREE.Vector2();
function vitScene() {
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff4e8, 0x3a3048, 1.5));
  const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(3, 6, 5); sc.add(d);
  const rim = new THREE.DirectionalLight(0x9ab8ff, 1.8); rim.position.set(-4, 3, -5); sc.add(rim);
  return sc;
}
function pedestal(r, col) {
  const g = new THREE.Group();
  const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.24, 48), new THREE.MeshStandardMaterial({ color: 0x4a4458, roughness: 0.8 })); st.position.y = -0.12; g.add(st);
  const rm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r * 0.86, 64).rotateX(-Math.PI / 2), rm); ring.position.y = 0.005; g.add(ring);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(r * 1.04, 0.025, 6, 64), new THREE.MeshBasicMaterial({ color: col })); edge.rotation.x = Math.PI / 2; edge.position.y = -0.02; g.add(edge);
  g.userData.rm = rm; return g;
}
function vitSparks(V, col, n = 1) {
  if (Math.random() > 0.3 * n) return;
  const p = V.sp; const s = p.find(q => q.life <= 0) || (p.length < 40 ? (p.push({ life: 0, m: new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })) }), p[p.length - 1]) : null);
  if (!s) return; if (!s.m.parent) V.scene.add(s.m);
  const a = Math.random() * 6.28, r = 0.4 + Math.random() * (V.spR || 1);
  s.m.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r); s.vy = 0.5 + Math.random() * 0.8; s.life = 1.6; s.m.material.color.set(col);
}
function vitTick(V, dt) {
  V.sp.forEach(s => { if (s.life <= 0) { s.m.visible = false; return; } s.life -= dt; s.m.visible = true; s.m.position.y += s.vy * dt; s.m.material.opacity = Math.min(1, s.life); });
}
function vitMount(el, key, opts, build) {
  const old = vits.get(el);
  if (old && old.key === key) return old;
  if (old) vitDrop(el);
  el.querySelectorAll('canvas.v3c').forEach(c => c.remove());
  const cv = document.createElement('canvas'); cv.className = 'v3c'; el.appendChild(cv);
  const V = { el, cv, ctx: cv.getContext('2d'), key, scene: vitScene(), cam: new THREE.PerspectiveCamera(opts.fov || 32, 1, 0.05, 80), turn: new THREE.Group(), rot: opts.rot0 || 0, auto: opts.auto == null ? 0.35 : opts.auto, t: 0, upd: [], sp: [], opts, ready: false };
  V.scene.add(V.turn);
  // glisser pour tourner, toucher pour une réaction
  let down = null;
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, r: V.rot, t: performance.now(), moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) { } });
  cv.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 6) down.moved = true; if (down.moved) { V.rot = down.r + dx * 0.012; V.hold = performance.now(); } });
  cv.addEventListener('pointerup', () => { if (down && !down.moved && performance.now() - down.t < 450 && V.onTap) V.onTap(); down = null; });
  cv.addEventListener('pointercancel', () => { down = null; });
  vits.set(el, V);
  Promise.resolve(build(V)).then(() => { V.ready = true; vitKick(); }).catch(e => { console.error('vitrine', e); });
  vitKick();
  return V;
}
function vitDrop(el) {
  const V = vits.get(el); if (!V) return;
  vits.delete(el); V.cv.remove();
  V.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}
function vitVisible(V) {
  const el = V.el; if (!el.isConnected || el.hidden || !el.offsetParent) return false;
  const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 8 && r.height > 8;
}
function vitKick() { if (!vitRaf && !document.hidden) { vitLast = performance.now(); vitRaf = requestAnimationFrame(vitFrame); } }
document.addEventListener('visibilitychange', vitKick);
// boucle propre aux vitrines, seulement quand la boucle du combat ne tourne pas (onglets des menus)
function vitFrame() {
  vitRaf = 0; if (!vits.size || document.hidden) return;
  if (mainDrawing()) { setTimeout(vitKick, 500); return; }
  const any = vitPass(performance.now());
  if (vits.size) { if (any) vitRaf = requestAnimationFrame(vitFrame); else setTimeout(vitKick, 400); }
}
// dessine chaque vitrine visible dans un coin du canevas du combat, puis la recopie dans son petit canevas
function vitPass(now) {
  if (glLost) return false;
  const dt = Math.min(0.05, (now - vitLast) / 1000); vitLast = now;
  const R = renderer, pr = R.getPixelRatio();
  let any = false, buf = R.getDrawingBufferSize(vb);
  const ex = R.toneMappingExposure, cc = R.getClearAlpha();
  vits.forEach((V, el) => {
    if (!el.isConnected) { vitDrop(el); return; }
    if (!V.ready || !vitVisible(V)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = Math.round(el.clientWidth * dpr), h = Math.round(el.clientHeight * dpr);
    // combat caché : on peut agrandir le tampon de dessin ; sinon on dessine la vitrine à la taille qui tient
    if ((buf.x < w || buf.y < h) && !G.stage.clientWidth) { R.setSize(Math.max(buf.x, w) / pr, Math.max(buf.y, h) / pr, false); buf = R.getDrawingBufferSize(vb); }
    const k = Math.min(1, buf.x / w, buf.y / h); w = Math.max(1, Math.floor(w * k)); h = Math.max(1, Math.floor(h * k));
    if (V.cv.width !== w || V.cv.height !== h) { V.cv.width = w; V.cv.height = h; }
    any = true;
    V.t += dt; if (!V.hold || now - V.hold > 2500) V.rot += dt * V.auto;
    V.turn.rotation.y = V.rot;
    V.upd.forEach(f => f(dt, V.t)); vitTick(V, dt);
    const o = V.opts; V.cam.aspect = w / h; V.cam.fov = (o.fov || 32) * (w / h < 1.2 ? 1.25 : 1); V.cam.updateProjectionMatrix();
    V.cam.position.set(0, o.cy || 1.4, o.cz || 5); V.cam.lookAt(0, o.ty || 0.8, 0);
    R.toneMappingExposure = 0.95; R.setClearAlpha(0);
    R.setViewport(0, 0, w / pr, h / pr); R.setScissor(0, 0, w / pr, h / pr); R.setScissorTest(true); R.clear();
    R.render(V.scene, V.cam);
    V.ctx.clearRect(0, 0, w, h); V.ctx.drawImage(R.domElement, 0, buf.y - h, w, h, 0, 0, w, h);
  });
  R.setScissorTest(false); R.toneMappingExposure = ex; R.setClearAlpha(cc);
  R.getSize(vs); R.setViewport(0, 0, vs.x, vs.y);
  return any;
}
// le héros sur son socle (garde-robe) ou avec son équipement (arsenal)
function vitHero(el, s, gear) {
  const key = 'h:' + hKey(s) + (gear ? ':' + gear.join(',') : '');
  return vitMount(el, key, { cy: 1.5, cz: 4.6, ty: 1.0, rot0: 0.5 }, async V => {
    const V3 = VOIES[s.peasant ? 'paysan' : s.voie] || VOIES.guerrier;
    const ped = pedestal(1.0, V3.col); V.scene.add(ped);
    const H = await makeHero(s); H.root.scale.setScalar(H.unit * 2); V.turn.add(H.root); play(H, 'Idle');
    V.upd.push(dt => H.mixer.update(dt));
    if (gear) {
      const [ca, ar, an] = gear;
      if (ca >= 0) { const head = H.root.getObjectByName('head'); if (head) { const cr = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: RARC[ca], metalness: 0.7, roughness: 0.3, emissive: RARC[ca], emissiveIntensity: 0.35 }); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 16, 1, true), m); cr.add(band); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), m); c.position.set(Math.cos(a) * 0.5, 0.17, Math.sin(a) * 0.5); cr.add(c); } cr.position.y = 1.45; head.add(cr); } }
      if (ar >= 0) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshBasicMaterial({ color: RARC[ar], transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); sh.scale.set(1, 1.7, 1); sh.position.y = 1.0; V.turn.add(sh); V.upd.push((dt, t) => { sh.material.opacity = 0.08 + 0.06 * Math.sin(t * 2.4); }); }
      if (an >= 0) { const rg = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24), new THREE.MeshStandardMaterial({ color: RARC[an], emissive: RARC[an], emissiveIntensity: 1.4, metalness: 0.6 })); V.turn.add(rg); V.upd.push((dt, t) => { rg.position.set(Math.cos(t * 1.6) * 0.95, 1.1 + Math.sin(t * 2.2) * 0.15, Math.sin(t * 1.6) * 0.95); rg.rotation.set(t * 2, t * 1.3, 0); }); }
    }
    V.upd.push(() => { if (Math.random() < 0.15) vitSparks(V, V3.col); });
    let busy = 0;
    V.onTap = () => { if (busy) return; busy = 1; const a = V3.atk[Math.floor(Math.random() * V3.atk.length)]; play(H, Math.random() < 0.5 ? a : 'Cheer', { once: true, fade: 0.1, then: () => { busy = 0; play(H, 'Idle', { fade: 0.25 }); } }); for (let i = 0; i < 12; i++) vitSparks(V, V3.col, 4); };
  });
}
// les familiers équipés côte à côte
function vitPets(el, L) {
  const key = 'p:' + L.map(p => p ? p.sp + '.' + p.rar + '.' + p.form : '-').join('|');
  return vitMount(el, key, { cy: 1.7, cz: 5.4, ty: 0.6, auto: 0.25 }, V => {
    V.scene.add(pedestal(1.5, 0xffd84a));
    const live = L.filter(Boolean), n = live.length, ps = [];
    live.forEach((p, i) => {
      const P = petModel(p.sp, p.form, p.rar);
      P.root.position.set(n > 1 ? (i ? 0.6 : -0.6) : 0, 0, n > 1 ? (i ? -0.15 : 0.15) : 0); P.root.scale.setScalar([1.1, 1.3, 1.5][p.form] || 1.2);
      V.turn.add(P.root); ps.push(P);
      V.upd.push(dt => { P.update(dt, false); if (Math.random() < 0.1) vitSparks(V, RARC[p.rar]); });
    });
    V.onTap = () => { ps.forEach((P, i) => P.play(i % 2 ? 'atk' : 'joy', 0.9)); for (let i = 0; i < 10; i++) vitSparks(V, 0xffd84a, 4); };
  });
}
// l'œuf de la couveuse : il tremble de plus en plus près de l'éclosion
function vitEgg(el, e) {
  const prog = Math.min(1, e.prog || 0), key = 'e:' + e.rar + ':' + (e.hw ? 1 : 0) + ':' + Math.floor(prog * 10);
  return vitMount(el, key, { cy: 1.0, cz: 3.4, ty: 0.55, auto: 0.5 }, V => {
    const col = new THREE.Color(e.hw ? 0xff8a1a : RARC[e.rar] || RARC[0]);
    V.scene.add(pedestal(0.8, col.getHex()));
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20, a = t * Math.PI; pts.push(new THREE.Vector2(Math.sin(a) * 0.42 * (1 - 0.18 * t), -Math.cos(a) * 0.55 + 0.55)); }
    const base = e.hw ? new THREE.Color(0xff8a1a) : new THREE.Color(0xfff6e8).lerp(col, 0.25);
    const egg = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: base, roughness: 0.45, emissive: col, emissiveIntensity: 0.08 + prog * 0.25 }));
    const g = new THREE.Group(); g.add(egg); V.turn.add(g);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, y = 0.2 + (i % 4) * 0.2, r = 0.42 * Math.sin(Math.acos(Math.max(-1, Math.min(1, (y - 0.55) / 0.55)))) * 0.98; const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (i % 3) * 0.02, 10, 8), new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.8), roughness: 0.5 })); s.position.set(Math.cos(a) * r, y, Math.sin(a) * r); s.scale.set(1, 1, 0.35); s.lookAt(0, y, 0); g.add(s); }
    if (prog > 0.8) for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), new THREE.MeshBasicMaterial({ color: 0xfff2a0 })); const a = i * 0.5 + 0.3; c.position.set(Math.cos(a) * 0.4, 0.7 + (i % 2) * 0.08, Math.sin(a) * 0.4); c.rotation.z = (i % 2 ? 0.6 : -0.6); g.add(c); }
    const L = new THREE.PointLight(col, 2 + prog * 6, 3, 2); L.position.set(0, 0.6, 0.6); V.scene.add(L);
    let kick = 0;
    V.upd.push((dt, t) => { kick = Math.max(0, kick - dt); const w = (0.02 + prog * 0.08) * (Math.sin(t * (4 + prog * 8)) * (Math.sin(t * 0.9) > 0.3 ? 1 : 0.2)) + kick * Math.sin(t * 30) * 0.25; g.rotation.z = w; g.rotation.x = w * 0.5; L.intensity = 2 + prog * 6 + Math.sin(t * 3) * prog * 2; if (Math.random() < 0.05 + prog * 0.2) vitSparks(V, col.getHex()); });
    V.onTap = () => { kick = 0.5; for (let i = 0; i < 8; i++) vitSparks(V, col.getHex(), 4); };
  });
}
// le village : une petite île de tuiles hexagonales, un bâtiment par emplacement, qui grandit avec son palier
const VILM = { moulin: 'building_windmill_red', banque: 'building_market_yellow', forge: 'building_blacksmith_red', ecurie: 'building_grain', temple: 'building_church_yellow', taverne: 'building_tavern_green' };
const VLD = n => load('assets/vil/' + n + '.glb');
function vitVillage(el, B) {
  const key = 'v:' + B.map(b => b.k + b.tier + (b.lv ? 1 : 0)).join(',');
  return vitMount(el, key, { cy: 5.4, cz: 7.8, ty: -0.25, fov: 34, auto: 0.12, rot0: 0.4 }, async V => {
    const names = ['hex_grass', 'building_dirt', ...B.filter(b => b.lv).map(b => VILM[b.k]).filter(Boolean)];
    const g = {}; await Promise.all(names.map(async n => { g[n] = await VLD(n); }));
    const tile = g.hex_grass.scene, box = new THREE.Box3().setFromObject(tile), wx = box.max.x - box.min.x, wz = box.max.z - box.min.z;
    const flat = wx > wz, d = flat ? wz : wx, a0 = flat ? Math.PI / 6 : 0;
    const spots = [[0, 0]]; for (let i = 0; i < 6; i++) spots.push([Math.cos(a0 + i * Math.PI / 3) * d, Math.sin(a0 + i * Math.PI / 3) * d]);
    const put = (sc, x, z, s = 1, ry = 0) => { const o = sc.clone(true); o.position.set(x, 0, z); o.scale.setScalar(s); o.rotation.y = ry; V.turn.add(o); return o; };
    spots.forEach(([x, z]) => put(tile, x, z));
    const top = box.max.y;
    // centre : un cercle de runes qui brille
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); rune.position.y = top + 0.02; V.turn.add(rune);
    V.upd.push((dt, t) => { rune.rotation.y = t * 0.6; rune.material.opacity = 0.5 + 0.3 * Math.sin(t * 2); });
    B.forEach((b, i) => {
      const [x, z] = spots[i + 1];
      if (!b.lv) { put(g.building_dirt.scene, x, z).position.y = top; return; }
      const o = put(g[VILM[b.k]].scene, x, z, 0.85 + b.tier * 0.06, Math.atan2(-x, -z) + Math.PI); o.position.y = top;
      if (b.tier >= 2) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22 })); pole.position.set(x + 0.55, top + 0.45, z + 0.2); V.turn.add(pole); const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshStandardMaterial({ color: b.roof || 0xd8664a, side: THREE.DoubleSide })); fl.position.set(0.17, 0.32, 0); pole.add(fl); V.upd.push((dt, t) => { fl.rotation.y = Math.sin(t * 3 + i) * 0.4; }); }
      if (b.tier >= 5) V.upd.push(() => { if (Math.random() < 0.08) { vitSparks(V, 0xffd84a); } });
      if (VILM[b.k] === 'building_windmill_red') o.traverse(m => { if (/blade|wing|sail|propel|fan/i.test(m.name)) V.upd.push(dt => { m.rotation.z += dt * 1.2; }); });
    });
    V.spR = d * 1.5;
    V.onTap = () => { for (let i = 0; i < 14; i++) vitSparks(V, 0xffd84a, 4); };
  });
}
// coffre du retour hors ligne : il tremble, puis s'ouvre dans une gerbe d'or
function vitChest(el) {
  return vitMount(el, 'c', { cy: 1.3, cz: 3.2, ty: 0.45, auto: 0.3 }, async V => {
    V.scene.add(pedestal(0.9, 0xffd84a));
    const gl = await load('assets/dg/chest_gold.glb'); const o = gl.scene.clone(true); fitHeight(o, 0.9); const g = new THREE.Group(); g.add(o); V.turn.add(g);
    const L = new THREE.PointLight(0xffc04a, 3, 4, 2); L.position.set(0, 1, 0.6); V.scene.add(L);
    const coins = []; let opened = 0;
    const open = () => {
      if (opened) return; opened = 1;
      for (let i = 0; i < 30; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.85, roughness: 0.3, emissive: 0x4a2c00 })); c.position.set(0, 0.6, 0); const a = Math.random() * 6.28, s = 0.6 + Math.random() * 1.2; c.userData.v = new THREE.Vector3(Math.cos(a) * s, 3 + Math.random() * 2, Math.sin(a) * s); V.scene.add(c); coins.push(c); }
      for (let i = 0; i < 20; i++) vitSparks(V, 0xffd84a, 4);
    };
    new MutationObserver(() => { if (el.classList.contains('open')) open(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
    V.upd.push((dt, t) => {
      g.rotation.z = opened ? 0 : Math.sin(t * 22) * 0.04 * (Math.sin(t * 1.3) > 0 ? 1 : 0.2);
      L.intensity = opened ? 8 : 3 + Math.sin(t * 4);
      coins.forEach(c => { const v = c.userData.v; v.y -= 7 * dt; c.position.addScaledVector(v, dt); if (c.position.y < 0.03) { c.position.y = 0.03; v.y *= -0.4; v.x *= 0.7; v.z *= 0.7; } c.rotation.x += dt * 8; });
      if (Math.random() < (opened ? 0.4 : 0.1)) vitSparks(V, 0xffd84a);
    });
    V.onTap = open;
  });
}


/* ---------- Voies : modèle, équipement visible, manière de frapper ---------- */
const WEAPONS = ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', 'Mug', '1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe'];
const VOIES = {
  guerrier: { model: 'Knight', show: ['1H_Sword', 'Badge_Shield'], atk: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab'], kind: 'melee', col: 0xffc04a, hitAt: 0.42 },
  voleur: { model: 'Rogue', show: ['Knife', 'Knife_Offhand'], atk: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab'], kind: 'melee', col: 0xc08aff, hitAt: 0.38 },
  archer: { model: 'Ranger2', anims: 'Rogue_Hooded', show: [], attach: [{ a: 'env/w/bow_withString', bone: 'handslotl' }], atk: ['2H_Ranged_Shoot'], kind: 'arrow', col: 0x9aff8a, hitAt: 0.3 },
  sorcier: { model: 'Mage', show: ['2H_Staff'], atk: ['Spellcast_Shoot'], kind: 'orb', col: 0x6ab8ff, hitAt: 0.35 },
  demoniste: { model: 'Mage', dark: true, horns: true, hide: ['Mage_Hat'], show: [], attach: [{ a: 'env/w/Skeleton_Staff', bone: 'handslotr' }], atk: ['Spellcast_Shoot'], kind: 'curse', col: 0x6aff5a, hitAt: 0.35 },
  paysan: { model: 'Knight', show: [], hide: ['Knight_Helmet', 'Knight_Cape'], atk: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab'], kind: 'melee', col: 0xffe0a0, hitAt: 0.4, plain: true }
};

/* ---------- monstres du jeu (même ordre que MON) ---------- */
const KMAP = { Idle_Combat: 'Idle', Spawn_Ground_Skeletons: 'Cheer', Death_C_Skeletons: 'Death_A', Taunt: 'Cheer', Hit_B: 'Hit_A' };
const FOES = [
  { code: 'follet' },
  { code: 'loup' },
  { m: 'Knight', atk: '1H_Melee_Attack_Chop', show: ['1H_Sword', 'Spike_Shield'], tint: [0.4, 0.34, 0.46], map: KMAP },
  { code: 'golem' },
  { code: 'wyverne' },
  { m: 'Skeleton_Warrior', alt: 'Skeleton_Minion', atk: '1H_Melee_Attack_Chop' },
  { code: 'gelee' },
  { m: 'Skeleton_Rogue', ghost: true, atk: '1H_Melee_Attack_Chop' },
  { code: 'myco' },
  { code: 'araignee' },
  { code: 'golem', wood: true }
];
const GOD = { m: 'Mage', atk: 'Spellcast_Shoot', god: true, map: { Idle_Combat: 'Idle', Spawn_Ground_Skeletons: 'Cheer', Death_C_Skeletons: 'Death_A', Taunt: 'Cheer', Hit_B: 'Hit_A' } };
const BIOME_KEYS = ['prairie', 'foret', 'neige', 'chateau', 'desert', 'ciel', 'marais', 'volcan', 'cote', 'cristal'];

/* ---------- état ---------- */
let active = false, mode = 'field', ready = false, sceneKey = '', building = null, wantKey = '';
let hero = null, heroKey = '', heroVoie = 'guerrier', atkI = 0, atkLock = 0, heroGlow = 0;
let foe = null, foeKey = '', bossFlash = 0, chestT = 0, chestObj = null, trav = 0, raf = 0, last = 0;
let door = null, doorObj = null, doorKey = '';
let lookBase = null, darkOn = false;
const fxs = [], nums = [];
const HPOS = new THREE.Vector3(-1.6, 0, 1.4), FPOS = new THREE.Vector3(1.4, 0, 0.2);
let heroH = 2, foeH = 2.2;

/* ---------- caméra fixe, cadrée sur la scène du jeu ---------- */
const CAM = { th: 0.72, ph: 1.24, tgt: new THREE.Vector3(-0.15, 1.0, 0.55) };
let shakeK = 0;
function baseR() { const a = canvas.clientWidth / Math.max(1, canvas.clientHeight); return a < 0.8 ? 12.5 : a < 1.2 ? 8.6 : 7.4; }
function placeCam(c, rr) {
  const r = rr || baseR(), s = Math.sin(CAM.ph);
  c.position.set(CAM.tgt.x + r * s * Math.sin(CAM.th), CAM.tgt.y + r * Math.cos(CAM.ph), CAM.tgt.z + r * s * Math.cos(CAM.th));
  c.lookAt(CAM.tgt); c.updateMatrixWorld(); c.updateProjectionMatrix();
}
function shake(k) { shakeK = Math.max(shakeK, k); }

/* ---------- composition fixe (comme le prototype) ; les zones tactiles du jeu suivent les acteurs 3D ---------- */
/* ---------- familiers ---------- */
const pets = [null, null], petKeys = ['', ''];
// le premier à gauche du héros, le second en retrait derrière le combat (axes de la caméra : PR vers la droite de l'écran, PF vers le fond)
const PR = new THREE.Vector3(0.75, 0, -0.66), PF = new THREE.Vector3(-0.66, 0, -0.75);
const petSpot = (h, a, b) => h.clone().addScaledVector(PR, a).addScaledVector(PF, b);
const PETPOS = { field: [petSpot(new THREE.Vector3(-1, 0, 1.25), -1.25, -0.3), new THREE.Vector3(-1.1, 0, -1.6)], boss: [petSpot(new THREE.Vector3(-0.75, 0, 1.55), -1.25, -0.3), new THREE.Vector3(-1.0, 0, -1.7)] };
function syncPets() {
  const L = active ? G.pets() : [null, null];
  for (let i = 0; i < 2; i++) {
    const p = L[i], key = p ? p.sp + ':' + p.rar + ':' + p.form : '';
    if (key === petKeys[i] && (pets[i] || !key)) continue;
    if (pets[i]) { scene.remove(pets[i].root); pets[i].dispose(); pets[i] = null; }
    petKeys[i] = key; if (!p) continue;
    const P = petModel(p.sp, p.form, p.rar); P.slot = i; pets[i] = P; scene.add(P.root);
    if (ready) { P.play('pop', 0.5); ring(PETPOS[mode][i], RARC[p.rar] || 0xffffff, 1.2, 0.5); }
  }
  placePets();
}
function placePets() {
  for (let i = 0; i < 2; i++) {
    const P = pets[i]; if (!P) continue;
    const p = PETPOS[mode === 'boss' ? 'boss' : 'field'][i];
    P.root.position.copy(p); P.root.scale.setScalar([0.95, 1.15, 1.35][P.form] || 1);
    const t = foe && !foe.dead ? FPOS : p.clone().add(new THREE.Vector3(3, 0, -1.2));
    P.root.lookAt(t.x, 0, t.z);
  }
}
function petShoot(n) {
  const now = performance.now();
  let P = null; for (const q of pets) if (q && q.pend && now - q.pend < 600 && (!P || q.pend < P.pend)) P = q;
  if (!P) P = pets.find(q => q) || null;
  const to = target(), col = (n.style.color || '').replace(/\s/g, ''), fire = /^#ff7a2a$|rgb\(255,122,42\)/i.test(col);
  if (!P) { shoot('orb', 0xffd84a, HPOS.clone().add(new THREE.Vector3(-0.6, heroH * 0.9, 0.3)), to); return; }
  P.pend = 0;
  const from = new THREE.Vector3(); P.body.getWorldPosition(from); from.y += 0.45 * P.root.scale.y;
  if (fire) { for (let k = 0; k < 4; k++) fxs.push(delay(k * 0.06, () => shoot('orb', 0xff7a2a, from, to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0)))));  shake(0.15); }
  else shoot(P.sp === 5 ? 'orb' : 'orb', P.atk, from, to);
}

function layout() {
  const fld = mode === 'field';
  if (fld) { HPOS.set(-1.0, 0, 1.25); FPOS.set(1.05, 0, -0.15); heroH = 2.0; foeH = foe && foe.info && foe.info.big ? 2.0 : 1.55; }
  else { HPOS.set(-0.75, 0, 1.55); FPOS.set(0.7, 0, -0.7); heroH = 2.0; foeH = (foe && foe.info && foe.info.big ? 3.0 : 2.35) * (G.titan() ? 1.15 : 1); }
  if (hero) placeHero();
  if (foe && !foe.dead) placeFoe();
  placePets();
  domSync(true);
}
const pv = new THREE.Vector3();
function scr(p) { pv.copy(p).project(baseCam); return { x: (pv.x * 0.5 + 0.5) * G.stage.clientWidth, y: (1 - (pv.y * 0.5 + 0.5)) * G.stage.clientHeight }; }
function boxOf(n) { let x = 0, y = 0, p = n; while (p && p !== G.stage) { x += p.offsetLeft; y += p.offsetTop; p = p.offsetParent; } return p === G.stage ? { x, y, w: n.offsetWidth, h: n.offsetHeight } : null; }
let syncT = 0;
function domSync(force) {
  const now = performance.now(); if (!force && now - syncT < 250) return; syncT = now;
  if (mode === 'boss') {
    const bb = G.el.bossBox; if (bb.hidden) return;
    const b = boxOf(bb); if (!b || !b.h) return;
    const lift = foe && foe.A.ghost ? foeH * 0.18 : 0;
    const bot = scr(FPOS.clone().setY(lift)), top = scr(FPOS.clone().setY(foeH + lift));
    const h = Math.max(40, bot.y - top.y) * 1.08, k = h / b.h;
    const tx = bot.x - (b.x + b.w / 2), ty = (top.y + bot.y) / 2 - (b.y + b.h / 2);
    const css = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + k.toFixed(3) + ')';
    if (bb.style.transform !== css) { bb.style.transform = css; bb.dataset.r3 = 1; }
  } else {
    const mb = G.$('mob'); if (mb.hidden || !foe) return;
    const bot = scr(FPOS), top = scr(FPOS.clone().setY(foeH));
    const w = Math.max(48, Math.min(120, (bot.y - top.y) * 0.75)), hpH = 14;
    const css = 'left:' + (bot.x - w / 2).toFixed(0) + 'px;top:' + (top.y - 4).toFixed(0) + 'px;bottom:auto;right:auto;width:' + w.toFixed(0) + 'px';
    if (mb.dataset.r3 !== css) { mb.style.cssText = css; mb.dataset.r3 = css; G.$('msvg').style.height = Math.max(20, bot.y - top.y - hpH).toFixed(0) + 'px'; }
  }
}
function domReset() {
  const bb = G.el.bossBox; if (bb.dataset.r3) { bb.style.transform = ''; delete bb.dataset.r3; }
  const mb = G.$('mob'); if (mb.dataset.r3) { mb.style.cssText = ''; delete mb.dataset.r3; G.$('msvg').style.height = ''; }
}

/* ---------- héros ---------- */
const hKey = s => (s.peasant ? 'paysan' : s.voie) + (s.fem ? 'F' : 'M') + (s.hue == null ? '' : ':' + s.hue);
function voieKey() { return hKey(G.hero()); }
// modèle du héros : Voie, couleur du rang sur l'armure et la cape, équipement visible
async function makeHero(s) {
  const v = s.peasant ? 'paysan' : (VOIES[s.voie] ? s.voie : 'guerrier'), V = VOIES[v];
  const g = await load('assets/' + V.model + '.glb');
  const ga = V.anims ? await load('assets/' + V.anims + '.glb') : null;
  const atts = V.attach ? await Promise.all(V.attach.map(x => load(x.a))) : [];
  const H = actor(g, ga); H.voie = v;
  const rk = s.hue == null ? null : new THREE.Color().setHSL(s.hue / 360, 0.55, 0.5);
  H.root.traverse(o => {
    if (!o.isMesh) return;
    if (WEAPONS.includes(o.name)) o.visible = V.show.includes(o.name);
    if (V.hide && V.hide.includes(o.name)) o.visible = false;
    if (V.dark && !/Head/.test(o.name)) { o.material = o.material.clone(); o.material.color.setRGB(0.36, 0.26, 0.46); }
    if (rk && /Body|Cape|Arm|Leg|Helmet|Hat/.test(o.name)) { o.material = o.material.clone(); o.material.color.lerp(rk, V.dark ? 0.18 : 0.3); }
  });
  (V.attach || []).forEach((x, i) => { const b = H.root.getObjectByName(x.bone); if (!b) return; const w = atts[i].scene.clone(true); w.traverse(m => { if (m.isMesh) m.castShadow = true; }); b.add(w); });
  if (V.horns) addHorns(H.root);
  fitHeight(H.root, 1); H.unit = H.root.scale.x;
  return H;
}
let heroSeq = 0;
async function setHero() {
  const s = G.hero(), key = hKey(s);
  if (key === heroKey && hero) return;
  const seq = ++heroSeq, H = await makeHero(s);
  if (seq !== heroSeq) return;
  if (hero) scene.remove(hero.root);
  hero = H; heroVoie = H.voie; heroKey = key;
  scene.add(hero.root);
  placeHero();
  play(hero, 'Idle');
  const V = VOIES[heroVoie];
  if (ready) { ring(HPOS, V.col, 2.2, 0.7); burst(HPOS.clone().setY(0.3), V.col, 40, 3, 0.3, 1.6); }
}
function placeHero() {
  if (!hero) return;
  hero.root.scale.setScalar(hero.unit * heroH);
  hero.root.position.copy(HPOS);
  const t = foe && !foe.dead ? FPOS : HPOS.clone().add(new THREE.Vector3(3, 0, -1.2));
  hero.root.lookAt(t.x, HPOS.y, t.z);
}
function heroHand() { const p = new THREE.Vector3(); let h = null; hero.root.traverse(o => { if (o.name === 'handslotr') h = o; }); (h || hero.root).getWorldPosition(p); if (!h) p.y += heroH * 0.6; return p; }

/* ---------- monstres et boss ---------- */
function foeSpec(info) {
  if (info.six) return GOD;
  const F = FOES[info.type] || FOES[5];
  return F;
}
let foeSeq = 0;
async function spawnFoe(info) {
  const seq = ++foeSeq, F = foeSpec(info), big = !!info.big, hue = ((info.hue || 0) % 360) / 360;
  const model = F.m ? (F.alt && (info.hue | 0) % 2 ? F.alt : F.m) : null;
  const g = model ? await load('assets/' + model + '.glb') : null;
  if (seq !== foeSeq || !active) return;
  removeFoe(true);
  const A = F.code ? codeMonster(F.code, F.code === 'golem' && F.wood ? 0.3 : hue, false, { wood: F.wood }) : actor(g);
  if (!F.code) A.root.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    if (F.ghost) { if (/Leg/.test(o.name)) { o.visible = false; return; } o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; o.material.color.multiply(new THREE.Color(0.55, 0.95, 1)); o.material.emissive = new THREE.Color(0x2a8a9a); }
    if (/Eyes/.test(o.name)) { o.material.emissive = new THREE.Color().setHSL(hue, 1, 0.5); o.material.emissiveIntensity = 3; }
    else if (big) o.material.color.multiply(new THREE.Color(1, 0.86, 0.8));
    if (F.god) { o.material.color.multiply(new THREE.Color(1.25, 1.1, 0.7)); o.material.emissive = new THREE.Color().setHSL(hue, 0.8, 0.25); }
  });
  A.map = F.map || null;
  if (F.show) A.root.traverse(o => { if (o.isMesh && WEAPONS.includes(o.name)) o.visible = F.show.includes(o.name); });
  if (F.god) A.root.traverse(o => { if (o.isMesh && WEAPONS.includes(o.name)) o.visible = o.name === '2H_Staff'; });
  if (F.tint) A.root.traverse(o => { if (o.isMesh && !/Eyes/.test(o.name)) o.material.color.multiply(new THREE.Color(F.tint[0], F.tint[1], F.tint[2])); });
  A.ghost = !!F.ghost;
  fitHeight(A.root, 1); A.unit = A.root.scale.x; A.F = F; A.big = big;
  foe = { A, F, dead: false, big, hue, info, boss: mode === 'boss' };
  scene.add(A.root); layout();
  play(A, 'Spawn_Ground_Skeletons', { once: true, then: () => foe && foe.A === A && !foe.dead && play(A, 'Idle_Combat') });
  tmpC.set(0x9a8a7a); burst(FPOS.clone().setY(0.2), 0x9a8a7a, foe.boss ? 40 : 20, 3, 0.3, 0.6);
  if (foe.boss) { ring(FPOS, big ? 0xff5a3a : 0xbfa0ff, 3, 0.9); shake(big ? 0.3 : 0.12); }
  placeHero();
}
function placeFoe() {
  const A = foe.A;
  A.root.scale.setScalar(A.unit * foeH);
  A.root.position.copy(FPOS); if (A.ghost) A.root.position.y += foeH * 0.18;
  A.root.lookAt(HPOS.x, FPOS.y, HPOS.z); A.root.rotation.y += 0.45;
}
function removeFoe(now) {
  if (!foe) return;
  const old = foe; foe = null;
  if (now) { scene.remove(old.A.root); old.A.dispose && old.A.dispose(); return; }
  let t = 0; fxs.push({ upd: dt => { t += dt; if (!old.A.code) old.A.root.position.y -= dt * 1.2; if (t > 1.1) { scene.remove(old.A.root); old.A.dispose && old.A.dispose(); return false; } return true; } });
}
function foeChest() {
  if (!foe) return FPOS.clone().setY(1.2);
  const F = foe.F, c = F.code === 'gelee' ? 0.4 : F.code === 'araignee' ? 0.35 : F.code === 'follet' ? 0.62 : F.code === 'wyverne' ? 0.6 : 0.55;
  return FPOS.clone().setY(foeH * c + (foe.A.ghost ? foeH * 0.18 : 0));
}
function target() { return foe && !foe.dead ? foeChest() : FPOS.clone().setY(1.1); }
function foeHit(strong) {
  if (!foe || foe.dead) return;
  const A = foe.A;
  if (!spawning(A)) play(A, Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', { once: true, fade: 0.06, speed: 1.4, then: () => foe && foe.A === A && !foe.dead && play(A, 'Idle_Combat', { fade: 0.2 }) });
  bossFlash = Math.max(bossFlash, strong ? 1 : 0.6);
}
function foeDie() {
  if (!foe || foe.dead) return;
  foe.dead = true; const A = foe.A, p = foeChest();
  if (!play(A, 'Death_C_Skeletons', { once: true, fade: 0.08 })) { const r0 = A.root.rotation.x; let t = 0; fxs.push({ upd: dt => { t += dt; A.root.rotation.x = r0 - Math.min(1, t / 0.5) * 1.4; return t < 0.6; } }); }
  shake(foe.boss ? 0.45 : 0.15);
  burst(p, 0xffe2a0, foe.boss ? 70 : 30, foe.boss ? 7 : 5, 0.34); ring(FPOS, 0xffd27a, foe.boss ? 4 : 2.4, 0.8);
  spawnCoins(FPOS, foe.boss ? 22 : 9);
  const old = foe; fxs.push(delay(foe.boss ? 1.6 : 1.0, () => { if (foe === old) removeFoe(false); }));
  if (!foe.boss) openChest(FPOS.clone());
  if (placeFx.crowd) placeFx.crowd.cheer = performance.now();
  pets.forEach(P => P && P.play('joy', 1.2));
  if (hero) play(hero, 'Cheer', { once: true, fade: 0.2, then: () => play(hero, 'Idle', { fade: 0.3 }) });
}
function foeAttack() {
  if (!foe || foe.dead || !hero) return;
  const A = foe.A;
  const d = play(A, foe.F.atk || 'attack', { once: true, fade: 0.12, then: () => foe && foe.A === A && !foe.dead && play(A, 'Idle_Combat', { fade: 0.2 }) });
  fxs.push(delay(d * 0.45, () => {
    if (!hero) return;
    play(hero, 'Hit_A', { once: true, fade: 0.08, speed: 1.3, then: () => play(hero, 'Idle', { fade: 0.2 }) });
    burst(HPOS.clone().setY(heroH * 0.6), 0xff5a4a, 16, 3, 0.25); shake(0.2);
  }));
}
function delay(t, f) { return { upd: dt => { t -= dt; if (t <= 0) { f(); return false; } return true; } }; }

/* ---------- coffre après un monstre des vagues ---------- */
async function openChest(at) {
  chestT = performance.now();
  const g = await load('assets/dg/chest_gold.glb').catch(() => null); if (!g || !active || mode !== 'field') return;
  if (chestObj) scene.remove(chestObj);
  const o = g.scene.clone(true); o.traverse(m => { if (m.isMesh) m.castShadow = true; });
  fitHeight(o, Math.max(0.5, foeH * 0.42)); const s0 = o.scale.x;
  o.position.copy(at); o.lookAt(HPOS.x, at.y, HPOS.z); scene.add(o); chestObj = o;
  let t = 0;
  fxs.push({ upd: dt => {
    t += dt;
    const k = Math.min(1, t / 0.35); o.scale.setScalar(s0 * (k < 1 ? 1.25 * k * k * (3 - 2 * k) : 1 + 0.25 * Math.max(0, 1 - (t - 0.35) * 3)));
    if (t > 0.6 && !o.userData.pop) { o.userData.pop = 1; burst(at.clone().setY(0.6), 0xffd27a, 26, 4, 0.3, 1.5); spawnCoins(at, 8); }
    if (t > 2.0) { o.scale.setScalar(s0 * Math.max(0.01, 1 - (t - 2) / 0.4)); }
    if (t > 2.4) { scene.remove(o); if (chestObj === o) chestObj = null; return false; }
    return true;
  } });
}

/* ---------- attaques du héros ---------- */
function heroAttack() {
  if (!hero) return;
  const V = VOIES[heroVoie];
  const name = V.atk[atkI++ % V.atk.length], speed = atkLock > 0 ? 1.9 : 1.35;
  const d = play(hero, name, { once: true, fade: 0.08, speed, then: () => play(hero, 'Idle', { fade: 0.25 }) });
  atkLock = d * 0.6;
  fxs.push(delay(d * V.hitAt, () => {
    if (!foe || foe.dead) return;
    if (V.kind === 'melee') slash(V.col, false);
    else shoot(V.kind, V.col, heroHand(), target());
  }));
}
function shoot(kind, col, from, to, onHit) {
  const arrow = kind === 'arrow';
  const geo = arrow ? new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).rotateX(Math.PI / 2) : new THREE.SphereGeometry(kind === 'curse' ? 0.22 : 0.18, 14, 10);
  const mat = new THREE.MeshBasicMaterial({ color: col });
  const m = new THREE.Mesh(geo, mat); m.position.copy(from); scene.add(m);
  const dur = arrow ? 0.18 : 0.34; let t = 0;
  projLight.color.set(col); projLight.intensity = arrow ? 2 : 8;
  m.lookAt(to); tmpC.set(col); const c3 = [tmpC.r, tmpC.g, tmpC.b];
  fxs.push({ upd: dt => {
    t += dt; const k = Math.min(1, t / dur);
    m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * (arrow ? 0.35 : 0.6);
    projLight.position.copy(m.position);
    emit(m.position, { x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.6 + 0.4, z: (Math.random() - 0.5) * 0.6 }, c3, arrow ? 0.12 : 0.28, 0.35, 0, 3);
    if (k >= 1) { scene.remove(m); geo.dispose(); mat.dispose(); projLight.intensity = 0; burst(to, col, 8, 3, 0.22); if (onHit) onHit(); return false; }
    return true;
  } });
}
function slash(col, crit) {
  const g = new THREE.TorusGeometry(Math.max(0.6, foeH * 0.38), crit ? 0.07 : 0.045, 6, 32, Math.PI * 0.9);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(target()).add(new THREE.Vector3(-0.4, 0, 0.3));
  m.rotation.set(Math.random() * 0.6 - 0.3, -0.9, Math.random() * Math.PI);
  scene.add(m); let t = 0;
  fxs.push({ upd: dt => { t += dt; const k = t / 0.22; m.scale.setScalar(0.8 + k * 0.5); m.rotation.z += dt * 9; m.material.opacity = 1 - k; if (k >= 1) { scene.remove(m); g.dispose(); m.material.dispose(); return false; } return true; } });
}
function ring(at, col, size, dur) {
  const g = new THREE.RingGeometry(0.75, 1, 48); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(at).setY(0.06); scene.add(m); let t = 0;
  fxs.push({ upd: dt => { t += dt; const k = t / dur; m.scale.setScalar(0.2 + k * size); m.material.opacity = 1 - k; if (k >= 1) { scene.remove(m); g.dispose(); m.material.dispose(); return false; } return true; } });
}
// colonne de lumière (sorts, évolution)
function beam(at, col, dur, w) {
  const g = new THREE.CylinderGeometry(w, w * 1.3, 14, 20, 1, true);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(at).setY(7); scene.add(m); let t = 0;
  fxs.push({ upd: dt => { t += dt; const k = t / dur; m.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.8; m.scale.set(1 + k * 0.4, 1, 1 + k * 0.4); if (k >= 1) { scene.remove(m); g.dispose(); m.material.dispose(); return false; } return true; } });
}
function spiral(at, col, n, h) {
  tmpC.set(col); const c = [tmpC.r, tmpC.g, tmpC.b];
  for (let i = 0; i < n; i++) { const a = i / n * 12.56; emit(at.clone().add(new THREE.Vector3(Math.cos(a) * 0.8, i * h / n, Math.sin(a) * 0.8)), { x: -Math.sin(a) * 1.2, y: 2.4, z: Math.cos(a) * 1.2 }, c, 0.26, 0.9, 0, 1); }
}

/* ---------- sorts et compétences ---------- */
function skill(v, k) {
  if (!active) return;
  const tg = target();
  if (v === 'sorcier' && k === 'ecl') {
    [0, 0.11, 0.23].forEach((d, i) => fxs.push(delay(d, () => {
      const x = tg.clone().add(new THREE.Vector3((i - 1) * 0.45, 0, 0));
      beam(x, 0xcfe4ff, 0.25, 0.12); burst(x, 0xbad8ff, 18, 5, 0.3); shake(0.3); heroLight.color.set(0xcfe4ff);
    })));
  } else if (v === 'sorcier' && k === 'gel') {
    ring(FPOS, 0x9adfff, 4, 0.9); ring(FPOS, 0xeaf8ff, 2.4, 0.65); burst(tg, 0xd8f4ff, 26, 4, 0.3);
    for (let i = 0; i < 34; i++) emit(FPOS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.8, Math.random() * 3.2, (Math.random() - 0.5) * 1.4)), { x: 0, y: 0.3 + Math.random() * 0.5, z: 0 }, [0.75, 0.95, 1], 0.26, 1.3 + Math.random() * 0.9, 0.15, 1);
  } else if (v === 'sorcier') {
    shoot('orb', 0xff8a26, tg.clone().add(new THREE.Vector3(-5, 8, -3)), tg, () => { burst(tg, 0xff9a33, 46, 7, 0.5); ring(FPOS, 0xff7a1a, 5, 0.6); shake(0.3); for (let e = 0; e < 26; e++) emit(FPOS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.2, (Math.random() - 0.5) * 1.2)), { x: 0, y: 2 + Math.random() * 3, z: 0 }, [1, 0.5, 0.1], 0.35, 0.9, 0.5, 1); });
  } else if (v === 'archer') {
    for (let i = 0; i < 14; i++) fxs.push(delay(i * 0.06, () => { const to = FPOS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.6, 0.2 + Math.random() * 2, (Math.random() - 0.5) * 1.6)); shoot('arrow', 0xffe08a, to.clone().add(new THREE.Vector3(-1.5, 8, -1)), to); }));
  } else if (v === 'voleur') {
    for (let j = 0; j < 7; j++) fxs.push(delay(j * 0.07, () => { const a = j / 7 * Math.PI * 2; shoot('orb', 0xb060ff, tg.clone().add(new THREE.Vector3(Math.cos(a) * 2.4, Math.sin(a) * 1.4, 0.8)), tg, () => shake(0.1)); }));
  } else if (v === 'demoniste') {
    beam(FPOS, 0x5aff4a, 1.0, 0.9);
    for (let i = 0; i < 40; i++) emit(FPOS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 1.4)), { x: 0, y: 2 + Math.random() * 3, z: 0 }, [0.35, 1, 0.3], 0.35, 0.8 + Math.random() * 0.6, 0.5, 1);
  } else {
    beam(FPOS, 0xffd860, 0.9, 0.8); burst(tg, 0xffd860, 30, 6, 0.45); ring(FPOS, 0xffcc4a, 4.5, 0.55);
  }
  heroGlow = 1;
}
function evo() {
  if (!active || !hero) return;
  const V = VOIES[heroVoie];
  beam(HPOS, V.col, 1.6, 0.7); ring(HPOS, V.col, 3, 1); spiral(HPOS, V.col, 60, 3); heroGlow = 1.6; shake(0.2);
  fxs.push(delay(0.5, () => { heroKey = ''; setHero(); }));
}

/* ---------- textes flottants (DOM, au-dessus de la 3D) ---------- */
function num(txt, x, y, crit, col, big) {
  if (!active || !txt) return;
  if (G.q() >= 1 && nums.length > 8) return;
  const d = document.createElement('div'); d.className = 'r3n' + (crit ? ' crit' : '') + (big ? ' big' : ''); d.textContent = txt;
  d.style.left = x + 'px'; d.style.top = y + 'px'; if (col) d.style.color = col;
  G.stage.appendChild(d); nums.push(d);
  d.addEventListener('animationend', () => { d.remove(); const i = nums.indexOf(d); if (i >= 0) nums.splice(i, 1); });
  if (nums.length > 24) { nums[0].remove(); nums.shift(); }
}
const TIERC = [0xffffff, 0xffd85a, 0xff8c33, 0xff5ad0, 0x80e6ff];
function tap(x, y, crit, n) {
  if (!active) return;
  const p = target().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, 0.3));
  const tier = Math.min(4, Math.floor((n || 0) / 10));
  burst(p, crit ? 0xffe28a : TIERC[tier], crit ? 26 : 8, crit ? 6 : 3.5, crit ? 0.34 : 0.22);
  if (crit) { shake(0.22); bossFlash = 1; }
}

/* ---------- porte vers le boss (exploration) ---------- */
const DOORC = [0, 0xffb84a, 0xff4a1a, 0xb46aff];
async function showDoor() {
  const D = door; if (!D || !D.k || mode !== 'field') { hideDoor(); return; }
  const key = 'k' + D.k; if (doorObj && doorKey === key) { doorObj.visible = true; return; }
  const g = await load('assets/dg/wall_doorway.glb').catch(() => null); if (!g || door !== D || mode !== 'field') return;
  hideDoor();
  const grp = new THREE.Group(), o = g.scene.clone(true);
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.material = m.material.clone(); if (D.k === 3) m.material.color.multiply(new THREE.Color(0.7, 0.55, 0.9)); if (D.k === 2) m.material.color.multiply(new THREE.Color(0.75, 0.55, 0.5)); } });
  grp.add(o); fitHeight(o, [0, 2.6, 3.2, 3.8][D.k]);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), new THREE.MeshBasicMaterial({ color: DOORC[D.k], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  pane.position.set(0, 1.1 * [0, 2.6, 3.2, 3.8][D.k] / 3.2, 0.05); grp.add(pane);
  const L = new THREE.PointLight(DOORC[D.k], 10, 7, 1.8); L.position.set(0, 1.4, 1); grp.add(L);
  grp.position.set(3.2, 0, -4.6); grp.rotation.y = -0.45; grp.userData = { pane, L, t0: performance.now(), D };
  scene.add(grp); doorObj = grp; doorKey = key;
}
function hideDoor() { if (doorObj) { scene.remove(doorObj); doorObj = null; doorKey = ''; } const hb = G.$('bdoor'); if (hb && hb.dataset.r3) { hb.style.cssText = ''; delete hb.dataset.r3; } }
function doorFrame(t) {
  if (!doorObj) return;
  const U = doorObj.userData, D = U.D, e = Math.min(1, (performance.now() - U.t0) / 700);
  doorObj.scale.setScalar(1 - Math.pow(1 - e, 3));
  const op = D.openT ? Math.min(1, (performance.now() - D.openT) / 550) : 0;
  U.pane.material.opacity = 0.4 + 0.2 * Math.sin(t * 3) + op;
  U.L.intensity = 8 + 3 * Math.sin(t * 3) + op * 20;
  if (HQ() && Math.random() < 0.3) { tmpC.set(DOORC[D.k]); emit(doorObj.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 2.4, 0.4)), { x: 0, y: 0.6, z: 0.2 }, [tmpC.r, tmpC.g, tmpC.b], 0.2, 1, 0, 1); }
  // zone tactile du jeu posée exactement sur la porte dessinée
  const hb = G.$('bdoor'); if (!hb || hb.hidden) return;
  const top = doorObj.position.clone().setY([0, 2.6, 3.2, 3.8][D.k]).project(baseCam), bot = doorObj.position.clone().project(baseCam);
  const W = G.stage.clientWidth, H = G.stage.clientHeight;
  const x = (bot.x * 0.5 + 0.5) * W, y1 = (1 - (top.y * 0.5 + 0.5)) * H, y2 = (1 - (bot.y * 0.5 + 0.5)) * H, hh = Math.max(24, y2 - y1), ww = hh * 0.75;
  const css = 'left:' + (x - ww / 2).toFixed(0) + 'px;top:' + y1.toFixed(0) + 'px;width:' + ww.toFixed(0) + 'px;height:' + hh.toFixed(0) + 'px;right:auto;bottom:auto';
  if (hb.dataset.r3 !== css) { hb.style.cssText = css; hb.dataset.r3 = css; }
}

/* ---------- pièces d'or (tombent puis s'effacent) ---------- */
const CN = 50;
const coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16); coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.85, roughness: 0.28, emissive: 0x4a2c00 });
const coins = new THREE.InstancedMesh(coinGeo, coinMat, CN); coins.frustumCulled = false; coins.castShadow = true;
coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(coins);
const coinSt = []; for (let i = 0; i < CN; i++) coinSt.push({ on: false });
const dummy = new THREE.Object3D(); let coinNext = 0;
function spawnCoins(at, n) {
  for (let i = 0; i < n; i++) {
    const c = coinSt[coinNext]; coinNext = (coinNext + 1) % CN;
    const a = Math.random() * 6.283, s = 1.5 + Math.random() * 2;
    Object.assign(c, { on: true, p: at.clone().add(new THREE.Vector3(0, 0.8, 0)), v: new THREE.Vector3(Math.cos(a) * s, 4.5 + Math.random() * 3, Math.sin(a) * s * 0.6 + 0.8), r: Math.random() * 6, rv: 8 + Math.random() * 8, t: 0 });
  }
}
function updCoins(dt) {
  for (let i = 0; i < CN; i++) {
    const c = coinSt[i];
    if (!c.on) { dummy.scale.setScalar(0); dummy.updateMatrix(); coins.setMatrixAt(i, dummy.matrix); continue; }
    c.t += dt; c.r += c.rv * dt; c.v.y -= 16 * dt; c.p.addScaledVector(c.v, dt);
    if (c.p.y < 0.08) { c.p.y = 0.08; c.v.y *= -0.45; c.v.x *= 0.7; c.v.z *= 0.7; }
    const k = c.t > 1.3 ? Math.max(0, 1 - (c.t - 1.3) / 0.4) : 1; if (k <= 0) c.on = false;
    dummy.position.copy(c.p); dummy.rotation.set(0, c.r, 0); dummy.scale.setScalar(k); dummy.updateMatrix(); coins.setMatrixAt(i, dummy.matrix);
  }
  coins.instanceMatrix.needsUpdate = true;
}

/* ---------- lieux : biome du rang, arènes des modes ---------- */
function wantedScene() {
  const pl = G.place();
  if (pl === 'ar') return 'arene';
  if (pl === 'dg') return 'couloir';
  if (pl && pl.startsWith('tw')) return 'tour' + pl.slice(2);
  const ar = mode === 'boss' ? G.arena() : null;
  if (ar === 'dg' || /^tw/.test(ar || '')) return 'donjon:' + ar;
  if (ar === 'abyss') return 'volcan:abyss';
  if (ar === 'raid') return 'chateau:raid';
  if (ar === 'titan') return 'ciel:titan';
  return BIOME_KEYS[G.biome()] || 'prairie';
}
const ARENA_LOOK = {};
async function ensureScene() {
  const key = wantedScene();
  if (key === sceneKey || key === wantKey) return building;
  wantKey = key;
  const prev = building || Promise.resolve();
  building = prev.catch(() => {}).then(async () => {
    if (wantKey !== key) return;
    const k = key.split(':')[0];
    await buildPlace(k === 'donjon' ? 'donjon' : k);
    if (wantKey !== key) return;
    lookBase = { exp: renderer.toneMappingExposure, hemi: hemi.intensity, sun: moon.intensity, bg: scene.background.clone(), fog: scene.fog.color.clone() };
    const tl = ARENA_LOOK[key]; if (tl) { hemi.color.multiply(new THREE.Color(...tl)); scene.fog.color.multiply(new THREE.Color(...tl)); scene.background.multiply(new THREE.Color(...tl)); }
    sceneKey = key; darkOn = null; applyDark();
    dustInit(HQ() ? 200 : 60); dustBuild();
  });
  try { await building; } catch (e) { wantKey = ''; throw e; }
  return building;
}
// combats sombres (boss de fin, raid, abysses) : la même scène, assombrie et teintée par l'élément du boss
function applyDark() {
  const d = G.dark(); if (!lookBase || d === darkOn) return; darkOn = d;
  if (d) {
    const c = new THREE.Color().setHSL(G.darkHue() / 360, 0.6, 0.12);
    renderer.toneMappingExposure = lookBase.exp * 0.9; hemi.intensity = lookBase.hemi * 0.45; moon.intensity = lookBase.sun * 0.4;
    scene.background = c.clone(); scene.fog.color.copy(c);
  } else {
    renderer.toneMappingExposure = lookBase.exp; hemi.intensity = lookBase.hemi; moon.intensity = lookBase.sun;
    scene.background = lookBase.bg.clone(); scene.fog.color.copy(lookBase.fog);
  }
}

// carte de palier du jeu : « climb » = on monte / on avance, « gate » = le gardien arrive
let palCls = '';
function palTick(now) {
  const n = $('twPal'), c = n && !n.hidden ? n.className : '';
  if (c === palCls) return;
  const was = palCls; palCls = c;
  if (/\bclimb\b/.test(c) && !/\bclimb\b/.test(was)) { if (placeFx.climb) climbT = now; else if (placeFx.crowd) placeFx.crowd.cheer = now; if (hero) play(hero, 'Running_A', { fade: 0.15 }); fxs.push(delay(0.95, () => hero && play(hero, 'Idle', { fade: 0.25 }))); }
  if (/\bgate\b/.test(c) && !/\bgate\b/.test(was)) { shake(0.35); ring(new THREE.Vector3(0.7, 0, -0.7), 0xff4a2a, 6, 0.9); burst(new THREE.Vector3(0.7, 1.2, -0.7), 0xff6a3a, 40, 6, 0.35); heroLight.color.set(0xff4a2a); heroGlow = 1.2; if (placeFx.crowd) placeFx.crowd.cheer = now; }
}

/* ---------- réglages de qualité ---------- */
function quality() {
  const q = G.q();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 0 ? 1.75 : 1));
  renderer.shadowMap.enabled = q === 0; moon.castShadow = q === 0;
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  resize();
}
function resize() {
  const w = G.stage.clientWidth, h = G.stage.clientHeight; if (!w || !h) return false;
  renderer.setSize(w, h, false); camera.aspect = baseCam.aspect = w / h;
  camera.fov = baseCam.fov = w / h < 0.8 ? 50 : 42;
  placeCam(baseCam); camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = h * renderer.getPixelRatio() * 0.5;
  return true;
}

/* ---------- défilement horizontal du décor pendant les voyages ---------- */
let trv = 0;
const TW = 27, tv = new THREE.Vector3();
function treadmill(dt) {
  const v = 3.4 * dt;
  for (const o of world.children) {
    const u = o.userData; if (!u.prop) continue;
    if (u.s0 == null) { u.s0 = o.scale.x; u.far = Math.hypot(o.position.x, o.position.z) > 34; if (!u.far) { const bx = new THREE.Box3().setFromObject(o); u.r = o.isLight ? 0 : Math.min(3, Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z) / 2); } }
    if (u.far) continue;
    o.position.x -= PR.x * v; o.position.z -= PR.z * v;
    if (o.position.x * PR.x + o.position.z * PR.z < -TW) { o.position.x += PR.x * TW * 2; o.position.z += PR.z * TW * 2; }
    // un objet qui passe sur la zone du combat ou devant la caméra rapetisse puis réapparaît
    const x = o.position.x, z = o.position.z, d = Math.hypot(x, z);
    tv.set(x, o.position.y + 0.5, z).applyMatrix4(baseCam.matrixWorldInverse);
    const depth = -tv.z, sx = Math.abs(tv.x) / Math.max(0.1, depth);
    let k = 1; const lim = 3.2 + (u.r || 0); if (d < lim + 1) k = Math.min(k, Math.max(0, d - lim));
    if (depth < 7.6 && sx < 0.75) k = Math.min(k, Math.max(0, (depth - 6.2) / 1.4));
    o.scale.setScalar(u.s0 * k); o.visible = k > 0.01;
  }
}

/* ---------- boucle ---------- */
let lastW = 0, lastH = 0, layoutT = 0;
function frame() {
  raf = 0; if (!active) return;
  if (document.hidden) return;
  const now = performance.now(), rdt = Math.min(0.05, (now - last) / 1000); last = now;
  raf = requestAnimationFrame(frame);
  const w = G.stage.clientWidth, h = G.stage.clientHeight; if (!w || !h) return;
  if (w !== lastW || h !== lastH || canvas.width !== Math.round(w * renderer.getPixelRatio())) { lastW = w; lastH = h; resize(); layout(); }
  if (glLost) return;
  layoutT += rdt; if (layoutT > 1) { layoutT = 0; layout(); }
  const dt = rdt;
  atkLock -= dt;
  // voyage : le héros court, le décor tourne autour du combat
  // voyage : le héros court vers la droite, le décor défile à l'horizontale (et revient de l'autre côté)
  if (trav > now && mode === 'field') { treadmill(dt); if (hero) { if (hero.cur !== hero.acts.Running_A) play(hero, 'Running_A', { fade: 0.2 }); hero.root.lookAt(HPOS.x + PR.x, HPOS.y, HPOS.z + PR.z); } trv = 1; }
  else if (trv) { trv = 0; if (hero && hero.cur === hero.acts.Running_A) play(hero, 'Idle', { fade: 0.25 }); placeHero(); }
  if (hero) hero.mixer.update(dt);
  if (foe) { const A = foe.A; if (A.code) A.update(dt); else A.mixer.update(dt); if (A.ghost && !foe.dead) { A.root.position.y = FPOS.y + foeH * 0.18 + Math.sin(now / 600) * 0.12; if (Math.random() < 0.5) emit(A.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6)), { x: 0, y: 0.4, z: 0 }, [0.5, 0.95, 1], 0.3, 0.9, 0, 1); } }
  const mov = trav > now && mode === 'field';
  pets.forEach(P => P && P.update(dt, mov));
  updParts(dt); updCoins(dt);
  for (let i = fxs.length - 1; i >= 0; i--) if (!fxs[i].upd(dt)) fxs.splice(i, 1);
  const t = now / 1000;
  placeTick(t, rdt); climbTick(now); crowdTick(t, now); palTick(now);
  torches.forEach(T => {
    T.L.intensity = T.slow ? T.base * (0.8 + 0.2 * Math.sin(t * 1.6 + T.ph)) : T.base * (0.82 + 0.12 * Math.sin(t * 11 + T.ph) + 0.08 * Math.sin(t * 23 + T.ph * 2));
    if (!T.fl) return;
    T.fl.acc += rdt * (HQ() ? 14 : 5);
    while (T.fl.acc > 1) { T.fl.acc -= 1; emit(T.fl.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, -0.2, (Math.random() - 0.5) * 0.15)), { x: (Math.random() - 0.5) * 0.3, y: 1.2 + Math.random(), z: (Math.random() - 0.5) * 0.3 }, T.fc || [1, 0.45 + Math.random() * 0.3, 0.12], 0.22, 0.6 + Math.random() * 0.4, 0.4, 0.5); }
  });
  for (let i = 0; i < dust.length; i++) { const d = dust[i]; dustPos[i * 3] = d.x + Math.sin(t * 0.2 + d.ph) * 0.4; dustPos[i * 3 + 1] = (d.y + t * 0.08) % 6; dustPos[i * 3 + 2] = d.z + Math.cos(t * 0.17 + d.ph) * 0.4; }
  if (dustGeo.attributes.position) dustGeo.attributes.position.needsUpdate = true;
  if (foe) { bossFlash *= Math.exp(-rdt * 10); if (!foe.A.ghost) foe.A.root.traverse(o => { if (o.isMesh && !/Eyes/.test(o.name) && !o.userData.keep && o.material.emissive && !foe.F.god) o.material.emissive.setRGB(bossFlash * 0.45, bossFlash * 0.3, bossFlash * 0.25); }); }
  heroGlow *= Math.exp(-rdt * 2.2); heroLight.position.copy(HPOS).setY(heroH * 0.8); heroLight.color.set(VOIES[heroVoie].col); heroLight.intensity = heroGlow * 9;
  doorFrame(t); domSync(false);
  // caméra : légère respiration et tremblement des impacts
  camera.position.copy(baseCam.position); camera.quaternion.copy(baseCam.quaternion);
  camera.position.x += Math.sin(t * 0.31) * 0.05; camera.position.y += Math.sin(t * 0.47) * 0.03;
  if (shakeK > 0.001) { camera.position.x += (Math.random() - 0.5) * shakeK; camera.position.y += (Math.random() - 0.5) * shakeK; shakeK *= Math.exp(-rdt * 9); }
  if (vits.size) vitPass(now);
  renderer.setClearAlpha(1);
  renderer.render(scene, camera);
}
function mainDrawing() { return active && !!raf && !glLost && G.stage.clientWidth > 0 && !document.hidden; }
function kick() { if (active && !raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
document.addEventListener('visibilitychange', kick);

/* ---------- synchronisation avec le jeu (observateurs du DOM, comme l'ancien moteur) ---------- */
const $ = G.$, el = G.el;
const added = (m, c) => { const cl = m.target.classList, was = ' ' + (m.oldValue || '') + ' '; return cl.contains(c) && was.indexOf(' ' + c + ' ') < 0; };
const removed = (m, c) => { const was = ' ' + (m.oldValue || '') + ' '; return !m.target.classList.contains(c) && was.indexOf(' ' + c + ' ') >= 0; };
new MutationObserver(ms => {
  ms.forEach(m => {
    if (m.attributeName === 'hidden') { setTimeout(() => { if (G.allowed()) api.start(el.bossBox.hidden ? 'field' : 'boss'); }, 0); return; }
    if (!active || mode !== 'boss') return;
    if (added(m, 'hit')) { foeHit(false); burst(target(), G.elemCol(), 6, 4, 0.2); }
    if (added(m, 'die')) foeDie();
    if (added(m, 'phase')) { ring(FPOS, 0xff3a1a, 9, 0.7); burst(target(), 0xff5a1a, 50, 7, 0.45); shake(0.35); }
    if (removed(m, 'charge')) foeAttack();
    if (m.target.classList.contains('titan') !== ((' ' + (m.oldValue || '') + ' ').indexOf(' titan ') >= 0)) layout();
  });
}).observe(el.bossBox, { attributes: true, attributeFilter: ['class', 'hidden'], attributeOldValue: true });
new MutationObserver(() => { if (active && mode === 'boss') bossSync(); }).observe($('bsvg'), { childList: true });
function bossSync() {
  const b = G.boss(); if (!b) return;
  const key = [b.type, b.hue, b.big, b.six ? b.six : ''].join(':');
  if (key === foeKey && foe && !foe.dead) return;
  foeKey = key; layout(); spawnFoe(b);
}
function mobSync() {
  const mb = $('mob'), m = G.mob();
  if (!m || mb.hidden) return;
  const key = 'm' + m.born; if (key === foeKey && foe) return;
  foeKey = key; layout(); spawnFoe({ type: m.type, hue: m.hue, big: m.boss });
}
new MutationObserver(ms => {
  if (!active || mode !== 'field') return;
  ms.forEach(m => {
    if (m.type === 'childList') { setHero(); return; }
    if (added(m, 'atk')) heroAttack();
    if (added(m, 'lvlup')) { const V = VOIES[heroVoie]; ring(HPOS, V.col, 1.6, 0.6); spiral(HPOS, V.col, 30, 2); heroGlow = 1; }
    if (added(m, 'win') && hero) play(hero, 'Cheer', { once: true, fade: 0.2, then: () => play(hero, 'Idle', { fade: 0.3 }) });
    if (added(m, 'pop') && hero) { ring(HPOS, 0xffffff, 1.4, 0.5); if (voieKey() !== heroKey) setHero(); }
  });
}).observe(el.hero, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, childList: true });
new MutationObserver(ms => {
  if (!active) return;
  ms.forEach(m => { if (m.type === 'childList') { if (voieKey() !== heroKey) setHero(); } else if (added(m, 'atk')) heroAttack(); });
}).observe(el.bhero, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, childList: true });
new MutationObserver(ms => {
  if (!active || mode !== 'field') return;
  ms.forEach(m => {
    const mb = $('mob');
    if (m.attributeName === 'hidden') { if (mb.hidden && foe && !foe.dead && !foe.boss) removeFoe(false); else if (!mb.hidden) mobSync(); return; }
    if (added(m, 'hit')) foeHit(true);
    if (added(m, 'die')) foeDie();
  });
}).observe($('mob'), { attributes: true, attributeFilter: ['class', 'hidden'], attributeOldValue: true });
new MutationObserver(() => { if (active && mode === 'field') mobSync(); }).observe($('msvg'), { childList: true });
new MutationObserver(() => { if (!active) return; if (wantedScene() !== sceneKey && wantedScene() !== wantKey) api.refresh(); else applyDark(); }).observe($('bg'), { childList: true });
new MutationObserver(() => { if (!active) return; if (wantedScene() !== sceneKey && wantedScene() !== wantKey) api.refresh(); else applyDark(); }).observe(G.stage, { attributes: true, attributeFilter: ['class'] });
new MutationObserver(ms => {
  if (!active) return;
  ms.forEach(m => Array.prototype.forEach.call(m.addedNodes, n => {
    if (!n.classList) return;
    if (n.classList.contains('arrow') && hero) shoot('arrow', 0xffe08a, heroHand(), target());
    else if (n.classList.contains('proj')) petShoot(n);
  }));
}).observe(G.stage, { childList: true });
[0, 1].forEach(i => new MutationObserver(ms => {
  if (!active) return;
  let sync = false;
  ms.forEach(m => { if (m.type === 'childList' || m.attributeName === 'hidden') sync = true; else if (added(m, 'patk') && pets[i]) { pets[i].play('atk', 0.35); pets[i].pend = performance.now(); } });
  if (sync) syncPets();
}).observe($('pet' + i), { childList: true, attributes: true, attributeFilter: ['class', 'hidden'], attributeOldValue: true }));
window.addEventListener('resize', () => { if (active) { resize(); layout(); } });

/* ---------- API identique à l'ancien moteur ---------- */
async function init() {
  if (!renderer.getContext()) throw new Error('WebGL2');
  quality(); placeCam(baseCam);
  await ensureScene();
  await setHero();
  ready = true;
}
const api = {
  init,
  ready: () => ready,
  start(m) {
    m = m || (el.bossBox.hidden ? 'field' : 'boss');
    const was = active && mode;
    mode = m;
    if (!active) { active = true; G.stage.classList.add('a3d', 'r3d'); quality(); }
    if (was !== m) { foeKey = ''; removeFoe(true); domReset(); if (chestObj) { scene.remove(chestObj); chestObj = null; } hideDoor(); }
    layout();
    ensureScene().then(() => { if (!active) return; if (mode === 'boss') bossSync(); else { mobSync(); if (door) showDoor(); } setHero(); placeHero(); syncPets(); }).catch(e => { console.warn('3D', e); G.fail(e); });
    kick();
  },
  stop() {
    if (!active) return;
    active = false; cancelAnimationFrame(raf); raf = 0;
    G.stage.classList.remove('a3d', 'r3d'); hideDoor(); removeFoe(true); domReset(); syncPets();
    nums.forEach(n => n.remove()); nums.length = 0;
  },
  refresh() { const m = active ? mode : null; api.stop(); quality(); if (m || G.allowed()) api.start(); },
  on: () => active,
  chestLeft: () => active && chestT ? Math.max(0, chestT + 2400 - performance.now()) : 0,
  travel(sec) { if (!active || mode !== 'field') return; trav = Math.max(trav, performance.now() + sec * 1000); },
  atk() { if (active) heroAttack(); },
  hit() { if (active && mode === 'boss') foeHit(false); },
  num, tap, evo, skill,
  door(k, svg, svgOpen) { door = k ? { k } : null; if (!active) return; if (!k) hideDoor(); else if (mode === 'field') showDoor(); },
  doorOpen() { if (door) { door.openT = performance.now(); if (doorObj) { tmpC.set(DOORC[door.k]); burst(doorObj.position.clone().setY(1.2), DOORC[door.k], 40, 5, 0.35); } } },
  vitrine(el, spec) {
    if (!el) return;
    if (spec.type === 'hero') vitHero(el, spec.s, spec.gear);
    else if (spec.type === 'pets') vitPets(el, spec.pets);
    else if (spec.type === 'egg') vitEgg(el, spec.egg);
    else if (spec.type === 'village') vitVillage(el, spec.b);
    else if (spec.type === 'chest') vitChest(el);
  },
  vitDrop(el) { vitDrop(el); },
  debugPets(L) { G.pets = () => L; syncPets(); },
  debug: () => ({ pets: pets.map(P => P && [scr(P.root.position), P.root.position.toArray()]), heroScr: scr(HPOS), stage: [G.stage.clientWidth, G.stage.clientHeight], scene: sceneKey, mode, hero: heroKey, foe: foe && { key: foeKey, dead: foe.dead, pos: FPOS.toArray(), h: foeH }, heroPos: HPOS.toArray(), heroH, cam: baseCam.position.toArray() })
};
return api;
}
