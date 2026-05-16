import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './engine.js';
import { enableShadows, scaleModelToHeight, placeModelOnGround, smoothModelShading } from './models.js';

const loader = new GLTFLoader();

/**
 * Loads a friend model and places it in the scene.
 * @param {Object} def 
 * @param {Object} placement 
 * @param {Function} onLoaded 
 */
export function loadFriendModel(def, placement, onLoaded) {
  loader.load(`./models/Friends/${def.fileName}`, (gltf) => {
    const friend = gltf.scene;
    friend.name = def.id;
    friend.userData.friendId = def.id;

    enableShadows(friend);
    const box = scaleModelToHeight(friend, def.desiredHeight);
    friend.userData.baseScale = friend.scale.x;
    placeModelOnGround(friend, box);
    friend.userData.groundY = friend.position.y;
    smoothModelShading(friend);

    const x = Number(placement?.x) || 0;
    const y = Number(placement?.y) || 0;
    const z = Number(placement?.z) || 0;
    const rotationY = Number(placement?.rotationY) || 0;
    friend.position.set(x, friend.userData.groundY + y, z);
    friend.rotation.y = rotationY;

    scene.add(friend);
    onLoaded?.(friend);
  }, undefined, (err) => console.warn(`Failed to load ${def.fileName}`, err));
}

/**
 * Loads the main actor (Tim).
 * @param {Object} placement 
 * @param {Function} onLoaded 
 */
export function loadTimModel(placement, onLoaded) {
  loader.load('./models/Friends/birthday_boy.glb', (gltf) => {
    const actor = gltf.scene;
    enableShadows(actor);
    const desiredHeight = 1.2;
    const box = scaleModelToHeight(actor, desiredHeight);
    actor.userData.baseScale = actor.scale.x;
    placeModelOnGround(actor, box);
    actor.userData.groundY = actor.position.y;
    
    const x = Number(placement?.x) || 0;
    const y = Number(placement?.y) || 0;
    const z = Number(placement?.z) || 0;
    const rotationY = Number(placement?.rotationY) || 0;
    actor.position.set(x, actor.userData.groundY + y, z);
    actor.rotation.y = rotationY;
    smoothModelShading(actor);

    scene.add(actor);
    onLoaded?.(actor, desiredHeight);
  }, undefined, (err) => console.error('Failed to load Tim:', err));
}

/**
 * Loads the birthday cake.
 */
export function loadCakeModel(onLoaded) {
  loader.load('./models/cake.glb', (gltf) => {
    const cake = gltf.scene;
    cake.name = 'party-cake';
    enableShadows(cake);
    const box = scaleModelToHeight(cake, 0.72);
    cake.userData.baseScale = cake.scale.x;
    placeModelOnGround(cake, box);
    smoothModelShading(cake);
    cake.userData.noCollision = true;
    cake.traverse(n => { n.userData.noAutoCollision = true; });
    onLoaded?.(cake);
  }, undefined, (err) => {
    console.warn('Failed to load cake.glb', err);
    onLoaded?.(null); // Fallback handled in party logic
  });
}
