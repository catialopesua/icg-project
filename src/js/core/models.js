import * as THREE from 'three';

/**
 * Enables cast and receive shadows on every mesh in a model.
 * @param {THREE.Object3D} model
 */
export function enableShadows(model) {
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

/**
 * Scales a model uniformly so its bounding-box height matches `desiredHeight`.
 * Returns the pre-scale bounding box (useful for ground placement).
 * @param {THREE.Object3D} model
 * @param {number} desiredHeight
 * @returns {THREE.Box3}
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
