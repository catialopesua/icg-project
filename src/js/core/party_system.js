import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './engine.js';
import { partyMusic } from './audio.js';
import { 
  PARTY_CENTER_X, 
  PARTY_CENTER_Z, 
  PARTY_BALLOON_IDS, 
  loadPartyLayout, 
  getPartyPlacement 
} from '../party.js';
import { FRIEND_DEFS } from '../friends.js';
import { rebuildWorldCollisionBoxes } from './collision.js';

const PARTY_CENTER = new THREE.Vector3(PARTY_CENTER_X, 0, PARTY_CENTER_Z);
const partyOffsetVector = new THREE.Vector3();

let partySceneGroup = null;
let partyCake = null;
let partyCakeLoadStarted = false;
let partyFallbackCake = null;

function getPlacementScale(placement) {
  return Math.max(0.2, Number(placement && placement.scale) || 1);
}

function getModelBaseScale(model) {
  return Number(model && model.userData && model.userData.baseScale) || Number(model && model.scale && model.scale.x) || 1;
}

function createPartyFallbackCake() {
  const cake = new THREE.Group(); cake.name = 'fallback-birthday-cake';
  const cakeMat = new THREE.MeshStandardMaterial({ color: 0xffb8d8, roughness: 0.7, metalness: 0.02 });
  const icingMat = new THREE.MeshStandardMaterial({ color: 0xfff4fb, roughness: 0.62, metalness: 0.01 });
  const candleMat = new THREE.MeshStandardMaterial({ color: 0x5bc7ff, roughness: 0.5, metalness: 0.02 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc94f });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.22, 40), cakeMat); base.position.y = 0.11;
  const icing = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.055, 40), icingMat); icing.position.y = 0.245;
  cake.add(base, icing);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.19, 10), candleMat);
    candle.position.set(Math.sin(angle) * 0.2, 0.36, Math.cos(angle) * 0.2);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), flameMat);
    flame.position.set(candle.position.x, 0.49, candle.position.z); flame.scale.y = 1.45;
    cake.add(candle, flame);
  }
  cake.traverse((node) => {
    node.userData.noAutoCollision = true;
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  cake.userData.baseScale = 1;
  return cake;
}

function attachPartyCake(layout) {
  if (!partySceneGroup) return;
  const cake = partyCake || partyFallbackCake;
  if (!cake) return;
  const tablePlacement = getPartyPlacement(layout, 'table');
  if (!tablePlacement) return;
  const tableScale = getPlacementScale(tablePlacement);
  const baseScale = getModelBaseScale(cake);
  if (cake.parent !== partySceneGroup) partySceneGroup.add(cake);
  cake.position.set(tablePlacement.x, tablePlacement.y, tablePlacement.z);
  cake.rotation.y = (Number(tablePlacement.rotationY) || 0) + Math.PI * 0.12;
  cake.scale.setScalar(baseScale * tableScale);
  cake.visible = true;
}

export function loadPartyCakeAsset(layout) {
  if (partyCakeLoadStarted) return;
  partyCakeLoadStarted = true;
  const cakeLoader = new GLTFLoader();
  cakeLoader.load('./models/blender/cake.glb', (gltf) => {
    partyCake = gltf.scene; partyCake.name = 'party-cake';
    partyCake.traverse(n => { if(n.isMesh){ n.castShadow=true; n.receiveShadow=true; } n.userData.noAutoCollision=true; });
    const box = new THREE.Box3().setFromObject(partyCake);
    const size = new THREE.Vector3(); box.getSize(size);
    const scale = 0.72 / (size.y || 1); partyCake.scale.setScalar(scale);
    box.setFromObject(partyCake); partyCake.position.y -= box.min.y;
    partyCake.userData.baseScale = partyCake.scale.x;
    attachPartyCake(layout);
  }, undefined, (err) => {
    console.warn('Failed to load cake.glb, using fallback cake', err);
    partyFallbackCake = createPartyFallbackCake();
    attachPartyCake(layout);
  });
}

export function createPartyScene(layout) {
  if (partySceneGroup) return partySceneGroup;
  const tablePlacement = getPartyPlacement(layout, 'table') || { x: PARTY_CENTER.x, y: 0, z: PARTY_CENTER.z, rotationY: 0, scale: 1 };
  const tableScale = getPlacementScale(tablePlacement);

  partySceneGroup = new THREE.Group();
  partySceneGroup.name = 'birthday-party-scene';
  partySceneGroup.userData.noCollision = true;
  scene.add(partySceneGroup);

  const audioAnchor = new THREE.Group();
  audioAnchor.position.copy(PARTY_CENTER);
  partySceneGroup.add(audioAnchor);
  audioAnchor.add(partyMusic);

  const colors = [0xff4f9d, 0xffcf42, 0x63d7ff, 0x7fe06f, 0xb26cff, 0xff7b54];
  const balloonMatCache = colors.map((color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.38, metalness: 0.02, emissive: new THREE.Color(color).multiplyScalar(0.04)
  }));
  const stringMat = new THREE.MeshStandardMaterial({ color: 0xf7e8c7, roughness: 0.9, metalness: 0.01 });

  partySceneGroup.userData.balloons = [];
  PARTY_BALLOON_IDS.forEach((id, cluster) => {
    const clusterPlacement = getPartyPlacement(layout, id);
    if (!clusterPlacement) return;
    const clusterScale = getPlacementScale(clusterPlacement);
    for (let j = 0; j < 3; j++) {
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 16), balloonMatCache[(cluster + j) % balloonMatCache.length]);
      balloon.position.set(clusterPlacement.x + (j - 1) * 0.18 * clusterScale, clusterPlacement.y + (2.25 + j * 0.18) * clusterScale, clusterPlacement.z + Math.sin(j * 1.7) * 0.16 * clusterScale);
      balloon.scale.set(clusterScale, 1.18 * clusterScale, clusterScale);
      balloon.rotation.y = Number(clusterPlacement.rotationY) || 0;
      balloon.castShadow = true;
      balloon.userData = { baseY: balloon.position.y, phase: cluster * 1.4 + j * 0.9 };
      partySceneGroup.add(balloon);
      partySceneGroup.userData.balloons.push(balloon);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 6), stringMat);
      string.position.set(balloon.position.x, balloon.position.y - 0.74, balloon.position.z);
      string.scale.setScalar(clusterScale);
      partySceneGroup.add(string);
    }
  });

  const confettiGeo = new THREE.BoxGeometry(0.055, 0.014, 0.022);
  partySceneGroup.userData.confetti = [];
  for (let i = 0; i < 90; i++) {
    const confettiMat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
    const confetti = new THREE.Mesh(confettiGeo, confettiMat);
    confetti.position.set(tablePlacement.x + THREE.MathUtils.randFloatSpread(5.4 * tableScale), tablePlacement.y + THREE.MathUtils.randFloat(1.6, 4.4) * tableScale, tablePlacement.z + THREE.MathUtils.randFloatSpread(5.4 * tableScale));
    confetti.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    confetti.userData = { fallSpeed: THREE.MathUtils.randFloat(0.18, 0.55), spinSpeed: THREE.MathUtils.randFloat(1.2, 3.8), phase: Math.random() * Math.PI * 2, noAutoCollision: true, noAutoShadow: true };
    partySceneGroup.add(confetti);
    partySceneGroup.userData.confetti.push(confetti);
  }

  const partyLight = new THREE.PointLight(0xffd69a, 1.2, 12, 1.7);
  partyLight.position.set(tablePlacement.x, tablePlacement.y + 3.3 * tableScale, tablePlacement.z + 0.8 * tableScale);
  partySceneGroup.add(partyLight);

  attachPartyCake(layout);
  return partySceneGroup;
}

export function placePartyParticipant(object, placement) {
  if (!object || !placement) return;
  const groundY = Number(object.userData && object.userData.groundY) || 0;
  const baseScale = getModelBaseScale(object);
  const placementScale = getPlacementScale(placement);
  object.position.set(Number(placement.x) || 0, groundY + (Number(placement.y) || 0), Number(placement.z) || 0);
  object.rotation.y = Number(placement.rotationY) || 0;
  object.scale.setScalar(baseScale * placementScale);
  object.visible = true;
  object.userData.noCollision = false;
}

export function preparePartyScene(actor, friendActorsById) {
  const layout = loadPartyLayout();
  createPartyScene(layout);
  loadPartyCakeAsset(layout);
  
  if (actor) placePartyParticipant(actor, getPartyPlacement(layout, 'tim'));
  FRIEND_DEFS.forEach((def) => {
    const friend = friendActorsById.get(def.id);
    if (friend) placePartyParticipant(friend, getPartyPlacement(layout, def.id));
  });

  if (partySceneGroup) partySceneGroup.visible = true;
  rebuildWorldCollisionBoxes();
}

export function updatePartyProps(elapsed, dt) {
  if (!partySceneGroup || !partySceneGroup.visible) return;
  const layout = loadPartyLayout();
  const tablePlacement = getPartyPlacement(layout, 'table') || { x: PARTY_CENTER.x, y: 0, z: PARTY_CENTER.z, scale: 1 };
  const tableScale = getPlacementScale(tablePlacement);

  (partySceneGroup.userData.balloons || []).forEach((b) => {
    b.position.y = b.userData.baseY + Math.sin(elapsed * 1.4 + b.userData.phase) * 0.08;
    b.rotation.z = Math.sin(elapsed * 1.1 + b.userData.phase) * 0.05;
  });

  (partySceneGroup.userData.confetti || []).forEach((p) => {
    p.position.y -= p.userData.fallSpeed * dt;
    p.position.x += Math.sin(elapsed * 1.6 + p.userData.phase) * dt * 0.12;
    p.rotation.x += p.userData.spinSpeed * dt; p.rotation.y += p.userData.spinSpeed * 0.72 * dt;
    if (p.position.y < tablePlacement.y + 0.95 * tableScale) {
      p.position.y = tablePlacement.y + THREE.MathUtils.randFloat(3.1, 4.6) * tableScale;
      p.position.x = tablePlacement.x + THREE.MathUtils.randFloatSpread(5.4 * tableScale);
      p.position.z = tablePlacement.z + THREE.MathUtils.randFloatSpread(5.4 * tableScale);
    }
  });
}
