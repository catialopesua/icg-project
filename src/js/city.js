import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createCityZone(scene, cx, cz){
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.95, metalness: 0.02 });
  const laneLineMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.9 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x7d7d7d, roughness: 0.95 });
  const roads = []; // track road rectangles for placement checks
  const placedBuildingBoxes = []; // track building bounding boxes for collision checks with lights/bins
  // registry so other modules (main.js) can find and toggle streetlights
  scene.userData.streetLights = scene.userData.streetLights || [];
  scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];

  function addRoad(width, length, x, z, horizontal = true) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? length : width, horizontal ? width : length), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.012, z);
    road.receiveShadow = true;
    road.userData = road.userData || {};
    road.userData.noCollision = true;
    scene.add(road);

    const line = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? length : 0.14, horizontal ? 0.14 : length), laneLineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.013, z);
    line.userData = line.userData || {};
    line.userData.noCollision = true;
    scene.add(line);

    const sideOffset = width / 2 + 0.55;
    const sidewalkA = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? length : 1.1, horizontal ? 1.1 : length), sidewalkMat);
    sidewalkA.rotation.x = -Math.PI / 2;
    sidewalkA.position.set(horizontal ? x : x - sideOffset, 0.011, horizontal ? z - sideOffset : z);
    sidewalkA.userData = sidewalkA.userData || {};
    sidewalkA.userData.noCollision = true;
    scene.add(sidewalkA);

    const sidewalkB = sidewalkA.clone();
    sidewalkB.position.set(horizontal ? x : x + sideOffset, 0.011, horizontal ? z + sideOffset : z);
    sidewalkB.userData = sidewalkB.userData || {};
    sidewalkB.userData.noCollision = true;
    scene.add(sidewalkB);

    // record road area for later placement checks
    roads.push({ x, z, width, length, horizontal, sideOffset, sidewalkWidth: 1.1 });
  }

  const beachPathX = -18;
  const beachPathBranchZ = 20;

  const eastWestRoadLength = Math.abs(cx - beachPathX) + 10;
  const eastWestRoadCenterX = (cx + beachPathX) / 2 + 5;
  addRoad(3.6, eastWestRoadLength, eastWestRoadCenterX, beachPathBranchZ - 2, true);

  const northSouthRoadLength = Math.abs(beachPathBranchZ - cz) + 12;
  const northSouthRoadCenterZ = (beachPathBranchZ + cz) / 2;
  addRoad(3.6, northSouthRoadLength, cx, northSouthRoadCenterZ, false);

  addRoad(4.2, 34, cx, cz, true);
  addRoad(4.2, 28 + 15, cx, cz, false);
  addRoad(3.2, 26 + 15, cx, cz + 13, true);
  addRoad(3.2, 22 + 15, cx, cz - 18, true);

  const loader = new GLTFLoader();
  // Global multiplier and per-model scale overrides.
  // Set `BUILDING_SCALE_MULTIPLIER` to 1.0 for no global change; adjust per-model scales below.
  const BUILDING_SCALE_MULTIPLIER = 1.0;
  const BUILDING_MODEL_SCALES = { 1: 1.8, 2: 1.8, 3: 1.8};

  function dirToRot(dir) {
    if (!dir || typeof dir !== 'string') return 0;
    switch (dir.toUpperCase()) {
      case 'N': return -Math.PI / 2;
      case 'E': return 0;
      case 'S': return Math.PI / 2;
      case 'W': return Math.PI;
      default: return 0;
    }
  }

  // Simplified placement: place exactly at provided x,y,z with cardinal `dir` rotation.
  // If `y` is omitted, the model will be placed on the ground (using its bounding-box min Y).
  function placeBuilding(base, x, y, z, dir, modelScale) {
    const b = base.clone(true);
    b.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });

    // apply per-model scale then global multiplier
    const useScale = (typeof modelScale === 'number') ? (modelScale * BUILDING_SCALE_MULTIPLIER) : BUILDING_SCALE_MULTIPLIER;
    if (typeof useScale === 'number' && Math.abs(useScale - 1) > 1e-6) {
      b.scale.multiplyScalar(useScale);
    }

    if (typeof y === 'number') {
      b.position.set(x, y, z);
    } else {
      b.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(b);
      const minY = box.min.y || 0;
      b.position.set(x, -minY + 0, z);
    }

    if (typeof dir === 'number') b.rotation.y = dir;
    else if (typeof dir === 'string') b.rotation.y = dirToRot(dir);
    else b.rotation.y = 0;
    b.updateMatrixWorld(true);
    scene.add(b);
    // record building bounding box for later collision checks with lights/bins
    try {
      const bBox = new THREE.Box3().setFromObject(b);
      placedBuildingBoxes.push(bBox.clone());
    } catch (e) {
      console.warn('Failed to compute building bbox for placement', e);
    }
  }

  const placements = [
    // Along main horizontal road (z = cz)
    { model: 1, x: cx - 14.8, z: cz - 6.1, dir: 'W' },
    { model: 2, x: cx - 7.5,   z: cz - 6.1,  dir: 'W' },
    { model: 1, x: cx + 7.5,  z: cz - 6.1,  dir: 'W' },
    { model: 2, x: cx + 14.8, z: cz - 6.1,  dir: 'W' },

    { model: 2, x: cx - 14.8, z: cz + 6.1,  dir: 'E' },
    { model: 1, x: cx - 7.5,  z: cz + 6.1,  dir: 'E' },
    { model: 2, x: cx + 7.5,  z: cz + 6.1,  dir: 'E' },
    { model: 1, x: cx + 14.8, z: cz + 6.1,  dir: 'E' },

    // Along main vertical road (x = cx)
    { model: 1, x: cx - 7.5,  z: cz - 12.5, dir: 'E' },
    { model: 2, x: cx + 7.5,  z: cz - 12.5, dir: 'E' },
    { model: 2, x: cx - 14.8,  z: cz - 12.5, dir: 'E' },
    { model: 2, x: cx + 14.8,  z: cz - 12.5, dir: 'E' },

    { model: 1, x: cx - 7.5,  z: cz - 25, dir: 'W' },
    { model: 1, x: cx - 14.8,  z: cz - 25, dir: 'W' },
    { model: 2, x: cx + 7.5,  z: cz - 25, dir: 'W' },
    { model: 2, x: cx + 14.8,  z: cz - 25, dir: 'W' },
    { model: 3, x: cx ,  z: cz - 25, dir: 'W' }

  ];

  // Use placements directly; placement objects control exact x,y,z and dir.
  const validPlacements = placements;

  // Explicit streetlight placements for the city (not the beach connector lights).

  const lightPlacements = [

    { model: 'streetlight', x: cx - 3.2, z: cz - 10.0, dir: 'S' },
    { model: 'streetlight', x: cx - 3.2, z: cz + 6.0,  dir: 'S' },
    { model: 'streetlight', x: cx - 3.2, z: cz + 16.0,  dir: 'S' },
    { model: 'streetlight', x: cx - 3.2, z: cz - 21.0,  dir: 'E' },
    { model: 'streetlight', x: cx - 14, z: cz - 21.0,  dir: 'E' },

    { model: 'streetlight', x: cx + 3.2, z: cz - 10.0, dir: 'N' },
    { model: 'streetlight', x: cx + 3.2, z: cz + 6.0,  dir: 'N' },
    { model: 'streetlight', x: cx + 3.2, z: cz + 16.0,  dir: 'N' },
    { model: 'streetlight', x: cx + 3.2, z: cz - 21.0,  dir: 'E' },
    { model: 'streetlight', x: cx + 14, z: cz - 21.0,  dir: 'E' },

    { model: 'streetlight', x: cx + 11, z: cz - 2,  dir: 'E' },
    { model: 'streetlight', x: cx - 11, z: cz - 2,  dir: 'E' }

  ];

  function addStreetlightWithTarget(baseModel, x, z, rotationY = 0, spotZOffset = 0.17, scale = 0.42) {
    const lamp = baseModel.clone(true);
    lamp.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });

    lamp.position.set(x, -0.05, z);
    lamp.scale.setScalar(scale);
    lamp.rotation.y = rotationY;
    scene.add(lamp);

    lamp.updateMatrixWorld(true);
    const lampBox = new THREE.Box3().setFromObject(lamp);
    const topY = (lampBox && lampBox.max && isFinite(lampBox.max.y)) ? lampBox.max.y : (lamp.position.y + 2.1 * lamp.scale.y);

    // Create realistic streetlight with proper spotlight properties
    // Warmish-yellow color: 0xffd699 (soft amber/yellow)
    // Intensity: 2.5 for realistic street illumination (not too bright to be unrealistic)
    // Range: 15 for wider coverage
    // Angle: Math.PI / 4 for 45-degree cone (narrower for focused light)
    // Penumbra: 0.3 for soft edges instead of 0.22
    // Decay: 2 for realistic inverse-square falloff
    const spot = new THREE.SpotLight(0xffd699, 2.5, 20, Math.PI / 2.5, 0.9, 2);
    
    // Position light slightly below lamp head for realistic downward lighting
    spot.position.set(x, topY - 0.5, z + spotZOffset);
    spot.target.position.set(x, 0.05, z);
    
    // Disable shadow casting to save texture units (directional light handles scene shadows)
    spot.castShadow = false;
    
    scene.add(spot.target);
    scene.add(spot);

    // register this spot so external code (main.js) can toggle day/night
    try {
      spot.userData = spot.userData || {};
      spot.userData._origIntensity = spot.intensity;
      spot.userData.isStreetLight = true;
      scene.userData.streetLights = scene.userData.streetLights || [];
      scene.userData.streetLights.push(spot);
      // if the scene currently thinks it's day, ensure the light starts turned off
      if (scene.userData.isDay) spot.intensity = 0;
    } catch (e) {
      console.warn('Failed to register streetlight spot', e);
    }

    // Create more refined cone geometry for visual light representation
    const dir = new THREE.Vector3().subVectors(spot.target.position, spot.position).normalize();
    const coneHeight = Math.max(1.2, spot.position.y - 0.05);
    const baseRadius = Math.max(0.2, coneHeight * Math.tan(spot.angle) * 0.95);
    
    // Enhanced cone with better geometry
    const coneGeo = new THREE.ConeGeometry(baseRadius * 1.3, coneHeight * 1.2, 24, 1, true);
    const coneMat = new THREE.MeshStandardMaterial({ 
      color: 0xffd699, 
      transparent: true, 
      opacity: 0.005
      , 
      depthWrite: false, 
      side: THREE.DoubleSide,
      emissive: 0xffd699,
      emissiveIntensity: 0.1
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.copy(spot.position).add(dir.clone().multiplyScalar(coneHeight / 2));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cone.quaternion.copy(q);
    cone.rotateX(Math.PI);
    cone.renderOrder = 1;
    scene.add(cone);

    // register cone and remember original opacity so we can dim its visual cone during daytime
    try {
      scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];
      // store original opacity on the cone mesh for later toggling
      try {
        const mats = Array.isArray(cone.material) ? cone.material : [cone.material];
        cone.userData = cone.userData || {};
        cone.userData._origOpacity = (mats[0] && typeof mats[0].opacity === 'number') ? mats[0].opacity : 1;
        // if currently day, make the cone fully transparent (visual light off) but keep the lamp visible
        if (scene.userData.isDay) {
          for (const mat of mats) if (mat && typeof mat.opacity === 'number') mat.opacity = 0;
        }
      } catch (e) {}
      scene.userData.streetLightMeshes.push(cone);
      // also track cones separately so we can toggle their visibility explicitly
      scene.userData.streetLightCones = scene.userData.streetLightCones || [];
      scene.userData.streetLightCones.push(cone);
      if (scene.userData.isDay) cone.visible = false;
    } catch (e) {}

    // record bulb/emissive meshes on the lamp for later toggling (only register true bulb materials)
    try {
      scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];
      lamp.traverse((n) => {
        if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          for (let mat of mats) {
            if (!mat) continue;
            const emissiveSum = (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b)) || 0;
            const emissiveIntensity = (typeof mat.emissiveIntensity === 'number') ? mat.emissiveIntensity : 0;
            const isCubeEmitter = /cube\.?003/i.test(n.name || '') || /cube\.?003/i.test(mat.name || '');
            const looksLikeBulb = isCubeEmitter || emissiveIntensity > 1e-3 || emissiveSum > 1e-6 || /bulb|light|lamp/i.test(n.name || '');
            if (looksLikeBulb) {
              if (isCubeEmitter && mat.emissive === undefined) {
                const forced = new THREE.MeshStandardMaterial({
                  color: (mat.color && mat.color.isColor) ? mat.color.clone() : new THREE.Color(0xffffff),
                  map: mat.map || null,
                  transparent: Boolean(mat.transparent),
                  opacity: (typeof mat.opacity === 'number') ? mat.opacity : 1,
                  roughness: (typeof mat.roughness === 'number') ? mat.roughness : 0.8,
                  metalness: (typeof mat.metalness === 'number') ? mat.metalness : 0.05,
                  emissive: new THREE.Color(0xffd699),
                  emissiveIntensity: 1.2
                });
                if (mat.side !== undefined) forced.side = mat.side;
                if (mat.alphaTest !== undefined) forced.alphaTest = mat.alphaTest;
                if (Array.isArray(n.material)) n.material = n.material.map((m) => (m === mat ? forced : m));
                else n.material = forced;
                mat = forced;
              }
              if (isCubeEmitter && mat.emissive !== undefined) {
                if (emissiveSum <= 1e-6 && typeof mat.emissive.setHex === 'function') mat.emissive.setHex(0xffd699);
                if (emissiveIntensity <= 1e-3) mat.emissiveIntensity = 1.2;
              }
              n.userData = n.userData || {};
              const resolvedIntensity = isCubeEmitter
                ? Math.max((typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 0), 1.2)
                : (emissiveIntensity || 1);
              n.userData._origEmissiveIntensity = resolvedIntensity;
              scene.userData.streetLightMeshes.push(n);
              // if currently day, dim the emissive immediately (do not change mesh visibility)
              try {
                if (mat.emissive !== undefined) mat.emissiveIntensity = scene.userData.isDay ? 0 : resolvedIntensity;
              } catch (e) {}
              break;
            }
          }
        }
      });
    } catch (e) {
      // ignore registration failures
    }
  }

  function addFallbackStreetlight(x, z, roadTargetX, roadTargetZ) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.35, 12),
      new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.85 })
    );
    pole.position.set(x, 1.15, z);
    pole.castShadow = true;
    scene.add(pole);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff8dd, emissive: 0xffd699, emissiveIntensity: 1.2 })
    );
    bulb.position.set(x, 2.26, z);
    scene.add(bulb);

    // Realistic streetlight with warm color and proper decay
    // 0xffd699: soft amber/warm yellow
    // Intensity: 1.8 for fallback lights (smaller sources)
    // Range: 10 for moderate coverage
    // Angle: Math.PI / 5 for 36-degree cone
    // Penumbra: 0.4 for soft edges
    // Decay: 2 for realistic inverse-square falloff
    const spot = new THREE.SpotLight(0xffd699, 1.8, 10, Math.PI / 5, 0.4, 2);
    spot.position.set(x, 2.15, z);
    spot.target.position.set(roadTargetX, 0.05, roadTargetZ);
    
    // Disable shadow casting to save texture units (directional light handles scene shadows)
    spot.castShadow = false;
    
    scene.add(spot.target);
    scene.add(spot);

    // register fallback spot and bulb for day/night toggling
    try {
      spot.userData = spot.userData || {};
      spot.userData._origIntensity = spot.intensity;
      spot.userData.isStreetLight = true;
      scene.userData.streetLights = scene.userData.streetLights || [];
      scene.userData.streetLights.push(spot);
      // register bulb mesh for visual toggling
      scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];
      bulb.userData = bulb.userData || {};
      bulb.userData._origEmissiveIntensity = (bulb.material && bulb.material.emissiveIntensity !== undefined) ? bulb.material.emissiveIntensity : 1;
      bulb.userData._origOpacity = (bulb.material && typeof bulb.material.opacity === 'number') ? bulb.material.opacity : 1;
      scene.userData.streetLightMeshes.push(bulb);
      if (scene.userData.isDay) {
        spot.intensity = 0;
        try { if (bulb.material && bulb.material.emissive !== undefined) bulb.material.emissiveIntensity = 0; } catch(e){}
      }
    } catch (e) {
      console.warn('Failed to register fallback streetlight', e);
    }

    const dir = new THREE.Vector3().subVectors(spot.target.position, spot.position).normalize();
    const coneHeight = Math.max(1.0, spot.position.y - 0.05);
    const baseRadius = Math.max(0.18, coneHeight * Math.tan(spot.angle) * 0.9);
    const coneGeo = new THREE.ConeGeometry(baseRadius * 1.2, coneHeight * 1.1, 28, 1, true);
    const coneMat = new THREE.MeshStandardMaterial({ 
      color: 0xffd699, 
      transparent: true, 
      opacity: 0.035, 
      depthWrite: false, 
      side: THREE.DoubleSide,
      emissive: 0xffd699,
      emissiveIntensity: 0.08
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.copy(spot.position).add(dir.clone().multiplyScalar(coneHeight / 2));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cone.quaternion.copy(q);
    cone.rotateX(Math.PI);
    cone.renderOrder = 1;
    scene.add(cone);

    // register cone for fallback light as well (store original opacity)
    try {
      scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];
      try {
        const mats = Array.isArray(cone.material) ? cone.material : [cone.material];
        cone.userData = cone.userData || {};
        cone.userData._origOpacity = (mats[0] && typeof mats[0].opacity === 'number') ? mats[0].opacity : 1;
        if (scene.userData.isDay) for (const mat of mats) if (mat && typeof mat.opacity === 'number') mat.opacity = 0;
      } catch (e) {}
      scene.userData.streetLightMeshes.push(cone);
      scene.userData.streetLightCones = scene.userData.streetLightCones || [];
      scene.userData.streetLightCones.push(cone);
      if (scene.userData.isDay) cone.visible = false;
    } catch (e) {}
  }

  const beachLightSpots = [];

  // Perpendicular connector lights
  for (let m = -8; m <= 8; m += 16) {
    beachLightSpots.push({ x: eastWestRoadCenterX + m, z: beachPathBranchZ - 4.8, rot: 0, zOffset: 0.17 });
    beachLightSpots.push({ x: eastWestRoadCenterX + m, z: beachPathBranchZ + 0.8, rot: Math.PI, zOffset: -0.17 });
  }

  // Snap light spots to nearest sidewalk so lights and bins aren't in the middle of the road
  function snapToSidewalk(spot) {
    for (const r of roads) {
      if (r.horizontal) {
        const halfLen = r.length / 2;
        if (Math.abs(spot.x - r.x) <= halfLen + 0.1) {
          const halfWidth = r.width / 2;
          if (Math.abs(spot.z - r.z) < halfWidth + r.sideOffset + 0.8) {
            const dir = (spot.z >= r.z) ? 1 : -1;
            const sidewalkInset = Math.min(0.24, (r.sidewalkWidth || 1.1) * 0.45);
            spot.z = r.z + dir * (halfWidth + sidewalkInset);
          }
        }
      } else {
        const halfLen = r.length / 2;
        if (Math.abs(spot.z - r.z) <= halfLen + 0.1) {
          const halfWidth = r.width / 2;
          if (Math.abs(spot.x - r.x) < halfWidth + r.sideOffset + 0.8) {
            const dir = (spot.x >= r.x) ? 1 : -1;
            const sidewalkInset = Math.min(0.24, (r.sidewalkWidth || 1.1) * 0.45);
            spot.x = r.x + dir * (halfWidth + sidewalkInset);
          }
        }
      }
    }
  }

  for (const s of beachLightSpots) snapToSidewalk(s);
  const lightLoader = new GLTFLoader();
  let baseLightModel = null;
  const placedCityLights = [];
  let pendingCityLightAttempts = 0;

  function boxesOverlapXZ(boxA, boxB, gap = 0.02) {
    const aCenter = new THREE.Vector3();
    const aSize = new THREE.Vector3();
    boxA.getCenter(aCenter);
    boxA.getSize(aSize);
    const bCenter = new THREE.Vector3();
    const bSize = new THREE.Vector3();
    boxB.getCenter(bCenter);
    boxB.getSize(bSize);
    const overlapX = Math.abs(aCenter.x - bCenter.x) < (aSize.x / 2 + bSize.x / 2 + gap);
    const overlapZ = Math.abs(aCenter.z - bCenter.z) < (aSize.z / 2 + bSize.z / 2 + gap);
    return overlapX && overlapZ;
  }

  function pointIsOnRoad(x, z) {
    for (const r of roads) {
      if (r.horizontal) {
        const withinX = Math.abs(x - r.x) <= (r.length / 2 + 1e-6);
        const withinZ = Math.abs(z - r.z) <= (r.width / 2 + 1e-6);
        if (withinX && withinZ) return true;
      } else {
        const withinZ = Math.abs(z - r.z) <= (r.length / 2 + 1e-6);
        const withinX = Math.abs(x - r.x) <= (r.width / 2 + 1e-6);
        if (withinZ && withinX) return true;
      }
    }
    return false;
  }
  // Place city lights directly from `lightPlacements` without extra heuristics.
  function placeCityLightsDirect(baseLight) {
    for (const p of lightPlacements) {
      const rotVal = (typeof p.dir === 'string') ? dirToRot(p.dir) : (typeof p.dir === 'number' ? p.dir : 0);
      addStreetlightWithTarget(baseLight, p.x, p.z, rotVal, p.zOffset || 0.17);
      placedCityLights.push({ x: p.x, z: p.z, dir: p.dir || rotVal });
    }
    if (typeof binModelGlobal !== 'undefined' && binModelGlobal) {
      placeBinsForCityLights(binModelGlobal);
    }
  }

  lightLoader.load('./models/streetlight.glb', (lightGltf) => {
    baseLightModel = lightGltf.scene;
    // place beach lights immediately
    for (const s of beachLightSpots) {
      const rotVal = s.dir ? dirToRot(s.dir) : (s.rot || 0);
      addStreetlightWithTarget(baseLightModel, s.x, s.z, rotVal, s.zOffset);
    }
    // place city lights exactly as specified in `lightPlacements`
    placeCityLightsDirect(baseLightModel);
  }, undefined, (err) => {
    console.warn('Failed to load streetlight.glb in city zone, using fallback lights', err);
    for (const s of beachLightSpots) {
      addFallbackStreetlight(s.x, s.z, s.x, s.z);
    }
    // fallback: place city lights exactly as specified using fallback lights
    for (const p of lightPlacements) {
      const rotVal = (typeof p.dir === 'string') ? dirToRot(p.dir) : (typeof p.dir === 'number' ? p.dir : 0);
      addFallbackStreetlight(p.x, p.z, p.x, p.z);
      placedCityLights.push({ x: p.x, z: p.z, dir: p.dir || rotVal });
    }
    if (typeof binModelGlobal !== 'undefined' && binModelGlobal) {
      placeBinsForCityLights(binModelGlobal);
    }
  });

  // Small trash bins placed near streetlights on sidewalks
  let binModelGlobal = null;
  let pendingBinAttempts = 0;

  function placeBinsForCityLights(binModel) {
    for (const s of placedCityLights) {
      try {
        const bin = binModel.clone(true);
        bin.userData = bin.userData || {};
        bin.userData.noCollision = true;
        // scale bin to target height
        const box = new THREE.Box3().setFromObject(bin);
        const size = new THREE.Vector3();
        box.getSize(size);
        const height = Math.max(size.y, 0.0001);
        const targetHeight = 0.45;
        const scale = targetHeight / height;
        bin.scale.setScalar(scale);
        box.setFromObject(bin);
        const minY = box.min.y;

        const rotNum = (typeof s.dir === 'string') ? dirToRot(s.dir) : (typeof s.dir === 'number' ? s.dir : 0);
        // compute the world-space "right" vector for the light's rotation
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotNum, 0));
        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
        const distance = 0.9;
        let candX = s.x + rightVec.x * distance;
        let candZ = s.z + rightVec.z * distance;

        // if the right-side point falls on the road, snap it to the sidewalk instead
        if (pointIsOnRoad(candX, candZ)) {
          const snapSpot = { x: candX, z: candZ };
          snapToSidewalk(snapSpot);
          candX = snapSpot.x;
          candZ = snapSpot.z;
        }

        bin.position.set(candX, -minY, candZ);
        bin.rotation.y = rotNum + (Math.random() * 0.8 - 0.4);
        scene.add(bin);
      } catch (e) {
        console.warn('Failed to place city bin', e);
      }
    }
  }

  function tryPlaceBinsForCityLightsWhenReady() {
    if (!binModelGlobal) return;
    if (placedCityLights.length === 0 && pendingBinAttempts < 12) {
      pendingBinAttempts++;
      setTimeout(tryPlaceBinsForCityLightsWhenReady, 200);
      return;
    }
    placeBinsForCityLights(binModelGlobal);
  }

  loader.load('./models/City/trashbin.glb', (gltf) => {
    const binModel = gltf.scene;
    binModel.userData = binModel.userData || {};
    binModel.userData.noCollision = true;
    binModel.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.userData = n.userData || {};
        n.userData.noCollision = true;
      }
    });

    binModelGlobal = binModel;

    for (const s of beachLightSpots) {
      const bin = binModel.clone(true);
      bin.userData = bin.userData || {};
      bin.userData.noCollision = true;
      const box = new THREE.Box3().setFromObject(bin);
      const size = new THREE.Vector3();
      box.getSize(size);
      const height = Math.max(size.y, 0.0001);
      const targetHeight = 0.45;
      const scale = targetHeight / height;
      bin.scale.setScalar(scale);
      box.setFromObject(bin);
      const minY = box.min.y;

      const rotVal = s.dir ? dirToRot(s.dir) : (s.rot || 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotVal, 0));
      const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
      let candX = s.x + rightVec.x * 0.9;
      let candZ = s.z + rightVec.z * 0.9;
      if (pointIsOnRoad(candX, candZ)) {
        const snap = { x: candX, z: candZ };
        snapToSidewalk(snap);
        candX = snap.x; candZ = snap.z;
      }
      bin.position.set(candX, -minY, candZ);
      bin.rotation.y = rotVal + (Math.random() * 0.8 - 0.4);
      scene.add(bin);
    }

    // try placing bins for city lights once those are in place
    tryPlaceBinsForCityLightsWhenReady();
  }, undefined, (err) => {
    console.warn('Failed to load trashbin.glb, using simple fallback bins', err);
    for (const s of beachLightSpots) {
      const rotVal = s.dir ? dirToRot(s.dir) : (s.rot || 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotVal, 0));
      const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
      let candX = s.x + rightVec.x * 0.9;
      let candZ = s.z + rightVec.z * 0.9;
      if (pointIsOnRoad(candX, candZ)) {
        const snap = { x: candX, z: candZ };
        snapToSidewalk(snap);
        candX = snap.x; candZ = snap.z;
      }
      const bmesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.46, 12),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 })
      );
      bmesh.position.set(candX, 0.23, candZ);
      bmesh.castShadow = true;
      bmesh.userData = bmesh.userData || {};
      bmesh.userData.noCollision = true;
      scene.add(bmesh);
    }
    // also attempt to place fallback bins for city lights later
    tryPlaceBinsForCityLightsWhenReady();
  });

  loader.load('./models/City/building1.glb', (gltf1) => {
    const model1 = gltf1.scene;
    for (const p of validPlacements) {
      if (p.model === 1) {
        const y = (typeof p.y === 'number') ? p.y : undefined;
        const rot = (typeof p.dir === 'string') ? p.dir : (typeof p.rotY === 'number' ? p.rotY : undefined);
        placeBuilding(model1, p.x, y, p.z, rot, BUILDING_MODEL_SCALES[1]);
      }
    }
  }, undefined, (err) => {
    console.warn('Failed to load building1.glb', err);
  });

  loader.load('./models/City/building2.glb', (gltf2) => {
    const model2 = gltf2.scene;
    for (const p of validPlacements) {
      if (p.model === 2) {
        const y = (typeof p.y === 'number') ? p.y : undefined;
        const rot = (typeof p.dir === 'string') ? p.dir : (typeof p.rotY === 'number' ? p.rotY : undefined);
        placeBuilding(model2, p.x, y, p.z, rot, BUILDING_MODEL_SCALES[2]);
      }
    }
  }, undefined, (err) => {
    console.warn('Failed to load building2.glb', err);
  });

  loader.load('./models/City/building3.glb', (gltf3) => {
    const model3 = gltf3.scene;
    for (const p of validPlacements) {
      if (p.model === 3) {
        const y = (typeof p.y === 'number') ? p.y : undefined;
        const rot = (typeof p.dir === 'string') ? p.dir : (typeof p.rotY === 'number' ? p.rotY : undefined);
        placeBuilding(model3, p.x, y, p.z, rot, BUILDING_MODEL_SCALES[3]);
      }
    }
  }, undefined, (err) => {
    console.warn('Failed to load building3.glb', err);
  });
}
