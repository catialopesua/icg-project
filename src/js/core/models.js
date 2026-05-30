/**
 * 3D MODEL UTILITIES
 * 
 * Helper functions for working with 3D models:
 * - Shadow configuration on model meshes
 * - Automatic scaling to desired heights
 * - Ground plane positioning
 * - Smooth shading for visual quality
 * - Animation setup and management
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// SHADOW CONFIGURATION
// ---------------------------------------------------------------------------
/**
 * Recursively enables shadow casting and receiving on all meshes in a model.
 * This ensures the model interacts properly with the shadow system.
 * @param {THREE.Object3D} model - The model to configure
 */
export function enableShadows(model) {
  // Traverse all nodes in the model hierarchy
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true; // This mesh casts shadows onto others
      node.receiveShadow = true; // This mesh can have shadows cast onto it
    }
  });
}

// ---------------------------------------------------------------------------
// MODEL SCALING
// ---------------------------------------------------------------------------
/**
 * Scales a model uniformly so its bounding box height matches the desired height.
 * Useful for ensuring characters are the right size in the world.
 * @param {THREE.Object3D} model - The model to scale
 * @param {number} desiredHeight - Target height in world units
 * @returns {THREE.Box3} The original (pre-scale) bounding box
 */
export function scaleModelToHeight(model, desiredHeight) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const height = size.y || 1;
  model.scale.setScalar(desiredHeight / height);
  return box;
}

/**
 * Translates a model so its lowest bounding-box point sits at y = 0.
 * @param {THREE.Object3D} model
 * @param {THREE.Box3} box - existing Box3; will be recomputed from the (possibly scaled) model.
 */
export function placeModelOnGround(model, box) {
  box.setFromObject(model);
  model.position.y -= box.min.y;
}

/**
 * Forces smooth shading on every mesh by recomputing vertex normals and
 * setting `flatShading = false` on all materials.
 * @param {THREE.Object3D} model
 */
export function smoothModelShading(model) {
  model.traverse((node) => {
    if (!node.isMesh) return;
    try {
      if (node.geometry && node.geometry.isBufferGeometry) {
        node.geometry.computeVertexNormals();
      }
      if (!node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((mat) => {
        mat.flatShading = false;
        mat.needsUpdate = true;
      });
    } catch (e) {
      console.warn('Smoothing attempt failed on mesh', node, e);
    }
  });
}

/**
 * Tunes leaf materials on tree models: forces green colour, double-side, alpha-test.
 * @param {THREE.Object3D} model
 */
export function tuneTreeMaterials(model) {
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((mat) => {
      if (!mat) return;
      if (!String(mat.name || '').toLowerCase().includes('leaf')) return;
      mat.color.set(0x5f9d45);
      if (mat.emissive) mat.emissive.set(0x000000);
      mat.vertexColors = false;
      mat.side = THREE.DoubleSide;
      mat.alphaTest = Math.max(mat.alphaTest || 0, 0.35);
      mat.transparent = false;
      mat.needsUpdate = true;
    });
  });
}
