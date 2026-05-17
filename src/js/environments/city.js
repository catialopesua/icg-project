import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Creates the procedural and model-based elements for the city zone,
 * including roads, sidewalks, streetlights, trash bins, and buildings.
 * Configures lighting, materials, and registers entities for collision and diurnal logic.
 *
 * @param {THREE.Scene} scene - The main Three.js scene where elements will be added.
 * @param {number} cx - The center X coordinate for the city zone placement.
 * @param {number} cz - The center Z coordinate for the city zone placement.
 */
export function createCityZone(scene, cx, cz) {
  const textureLoader = new THREE.TextureLoader();

  // Plain solid color road material (reverted to original simple aesthetic)
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.95, metalness: 0.02 });

  // Load Bricks034_1K-JPG textures with 90 degrees horizontal rotation (Math.PI / 2)
  const brickColorTex = textureLoader.load('./textures/Bricks034_1K-JPG/Bricks034_1K-JPG_Color.jpg');
  brickColorTex.wrapS = brickColorTex.wrapT = THREE.RepeatWrapping;
  brickColorTex.colorSpace = THREE.SRGBColorSpace;
  brickColorTex.repeat.set(6, 6);
  brickColorTex.rotation = Math.PI / 2;
  brickColorTex.center.set(0.5, 0.5);

  const brickNormalTex = textureLoader.load('./textures/Bricks034_1K-JPG/Bricks034_1K-JPG_NormalGL.jpg');
  brickNormalTex.wrapS = brickNormalTex.wrapT = THREE.RepeatWrapping;
  brickNormalTex.repeat.set(6, 6);
  brickNormalTex.rotation = Math.PI / 2;
  brickNormalTex.center.set(0.5, 0.5);

  const brickRoughnessTex = textureLoader.load('./textures/Bricks034_1K-JPG/Bricks034_1K-JPG_Roughness.jpg');
  brickRoughnessTex.wrapS = brickRoughnessTex.wrapT = THREE.RepeatWrapping;
  brickRoughnessTex.repeat.set(6, 6);
  brickRoughnessTex.rotation = Math.PI / 2;
  brickRoughnessTex.center.set(0.5, 0.5);

  const brickAoTex = textureLoader.load('./textures/Bricks034_1K-JPG/Bricks034_1K-JPG_AmbientOcclusion.jpg');
  brickAoTex.wrapS = brickAoTex.wrapT = THREE.RepeatWrapping;
  brickAoTex.repeat.set(6, 6);
  brickAoTex.rotation = Math.PI / 2;
  brickAoTex.center.set(0.5, 0.5);

  const brickMat = new THREE.MeshStandardMaterial({
    map: brickColorTex,
    normalMap: brickNormalTex,
    roughnessMap: brickRoughnessTex,
    aoMap: brickAoTex,
    roughness: 0.8,
    metalness: 0.05
  });

  const laneLineMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.9 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x7d7d7d, roughness: 0.95 });
  const roads = []; // track road rectangles for placement checks
  const placedBuildingBoxes = []; // track building bounding boxes for collision checks with lights/bins
  // registry so other modules (main.js) can find and toggle streetlights
  scene.userData.streetLights = scene.userData.streetLights || [];
  scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];

  // Procedural sidewalk textures (keeps size/location unchanged)
  function makeSidewalkTextureSet(size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // base concrete color
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, size, size);

    // fine speckle for aggregate
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.3 + Math.random() * 1.1;
      const g = 150 + Math.floor(Math.random() * 70);
      ctx.fillStyle = `rgba(${g},${g},${g},${0.03 + Math.random() * 0.09})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // slab joints (subtle grid)
    const slabs = 6;
    const step = Math.floor(size / slabs);
    ctx.strokeStyle = 'rgba(80,80,80,0.38)';
    ctx.lineWidth = Math.max(1, Math.floor(size * 0.004));
    for (let i = 1; i < slabs; i++) {
      const pos = i * step + (Math.random() - 0.5) * step * 0.06;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, size); ctx.stroke();
      const pos2 = i * step + (Math.random() - 0.5) * step * 0.06;
      ctx.beginPath(); ctx.moveTo(0, pos2); ctx.lineTo(size, pos2); ctx.stroke();
    }

    // subtle hairline cracks
    ctx.strokeStyle = 'rgba(50,50,50,0.16)';
    ctx.lineWidth = 1;
    for (let c = 0; c < 28; c++) {
      let x = Math.random() * size;
      let y = Math.random() * size;
      const segs = 3 + Math.floor(Math.random() * 4);
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < segs; s++) {
        x += (Math.random() - 0.5) * step * 0.45;
        y += (Math.random() - 0.5) * step * 0.45;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;

    // bump map (grayscale noise)
    const bump = document.createElement('canvas');
    bump.width = bump.height = Math.max(256, size / 2);
    const bctx = bump.getContext('2d');
    bctx.fillStyle = '#b8b8b8'; bctx.fillRect(0, 0, bump.width, bump.height);
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * bump.width;
      const y = Math.random() * bump.height;
      const r = 0.4 + Math.random() * 1.2;
      const v = 120 + Math.floor(Math.random() * 80);
      bctx.fillStyle = `rgba(${v},${v},${v},${0.06 + Math.random() * 0.14})`;
      bctx.beginPath(); bctx.arc(x, y, r, 0, Math.PI * 2); bctx.fill();
    }
    const bumpTex = new THREE.CanvasTexture(bump);
    bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;

    return { map, bump: bumpTex };
  }

  function cloneTextureWithRepeat(tex, rx, ry) {
    if (!tex) return null;
    const c = tex.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    return c;
  }

  function applySidewalkTexture(material, textureSet, repeatX, repeatY) {
    if (!material || !textureSet) return;
    material.map = cloneTextureWithRepeat(textureSet.map, repeatX, repeatY);
    if (textureSet.bump) material.bumpMap = cloneTextureWithRepeat(textureSet.bump, repeatX, repeatY);
    material.roughness = 0.92;
    material.bumpScale = 0.06;
    material.needsUpdate = true;
  }

  const sidewalkTexturesCity = makeSidewalkTextureSet(1024);

  const CENTER_DASH_LENGTH = 2;
  const CENTER_DASH_GAP = 3.4;
  const CENTER_LINE_WIDTH = 0.18;
  const CENTER_LINE_END_MARGIN = 1.9;

  function mergeIntervals(intervals, joinGap = 0.01) {
    if (!intervals.length) return [];
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const merged = [sorted[0].slice()];

    for (let i = 1; i < sorted.length; i++) {
      const [start, end] = sorted[i];
      const last = merged[merged.length - 1];
      if (start <= last[1] + joinGap) {
        last[1] = Math.max(last[1], end);
      } else {
        merged.push([start, end]);
      }
    }

    return merged;
  }

  function addDashedInterval(start, end, horizontal, fixedCoord) {
    const span = end - start;
    if (span < CENTER_DASH_LENGTH) return;

    const step = CENTER_DASH_LENGTH + CENTER_DASH_GAP;
    const dashCount = Math.max(1, Math.floor((span + CENTER_DASH_GAP) / step));
    const occupiedLength = dashCount * CENTER_DASH_LENGTH + (dashCount - 1) * CENTER_DASH_GAP;
    const leading = start + (span - occupiedLength) / 2;

    for (let i = 0; i < dashCount; i++) {
      const centerAlong = leading + i * step + CENTER_DASH_LENGTH / 2;
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(horizontal ? CENTER_DASH_LENGTH : CENTER_LINE_WIDTH, horizontal ? CENTER_LINE_WIDTH : CENTER_DASH_LENGTH),
        laneLineMat
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(horizontal ? centerAlong : fixedCoord, 0.013, horizontal ? fixedCoord : centerAlong);
      dash.userData = dash.userData || {};
      dash.userData.noCollision = true;
      scene.add(dash);
    }
  }

  function buildDashedCenterLines() {
    const groups = new Map();

    for (const road of roads) {
      const key = road.horizontal ? `h:${road.z.toFixed(4)}` : `v:${road.x.toFixed(4)}`;
      const alongCenter = road.horizontal ? road.x : road.z;
      const start = alongCenter - road.length / 2 + CENTER_LINE_END_MARGIN;
      const end = alongCenter + road.length / 2 - CENTER_LINE_END_MARGIN;
      if (end <= start) continue;

      if (!groups.has(key)) {
        groups.set(key, {
          horizontal: road.horizontal,
          fixedCoord: road.horizontal ? road.z : road.x,
          intervals: []
        });
      }

      groups.get(key).intervals.push([start, end]);
    }

    for (const group of groups.values()) {
      const merged = mergeIntervals(group.intervals);
      for (const [start, end] of merged) {
        addDashedInterval(start, end, group.horizontal, group.fixedCoord);
      }
    }
  }

  function addRoad(width, length, x, z, horizontal = true) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? length : width, horizontal ? width : length), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.012, z);
    road.receiveShadow = true;
    road.userData = road.userData || {};
    road.userData.noCollision = true;
    scene.add(road);

    const sideOffset = width / 2 + 0.55;
    const sidewalkSpanX = horizontal ? length : 1.1;
    const sidewalkSpanZ = horizontal ? 1.1 : length;
    const sidewalkA = new THREE.Mesh(new THREE.PlaneGeometry(sidewalkSpanX, sidewalkSpanZ), sidewalkMat.clone());
    applySidewalkTexture(sidewalkA.material, sidewalkTexturesCity, Math.max(1, sidewalkSpanX / 1.5), Math.max(1, sidewalkSpanZ / 1.5));
    sidewalkA.rotation.x = -Math.PI / 2;
    sidewalkA.position.set(horizontal ? x : x - sideOffset, 0.011, horizontal ? z - sideOffset : z);
    sidewalkA.userData = sidewalkA.userData || {};
    sidewalkA.userData.noCollision = true;
    scene.add(sidewalkA);

    const sidewalkB = new THREE.Mesh(new THREE.PlaneGeometry(sidewalkSpanX, sidewalkSpanZ), sidewalkMat.clone());
    applySidewalkTexture(sidewalkB.material, sidewalkTexturesCity, Math.max(1, sidewalkSpanX / 1.5), Math.max(1, sidewalkSpanZ / 1.5));
    sidewalkB.rotation.x = -Math.PI / 2;
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
  addRoad(3.6, eastWestRoadLength - 9.1, eastWestRoadCenterX - 3.5, beachPathBranchZ - 2, true);

  const northSouthRoadLength = Math.abs(beachPathBranchZ - cz) + 15;
  const northSouthRoadCenterZ = (beachPathBranchZ + cz) / 2;

  addRoad(4.2, 34, cx, cz, true);
  addRoad(4.2, 28 + 19.6, cx, cz, false); // este
  addRoad(3.2, 26 + 10, cx, cz + 11.8, true);
  addRoad(3.2, 22 + 15, cx, cz - 18, true);
  buildDashedCenterLines();

  const loader = new GLTFLoader();
  // Global multiplier and per-model scale overrides.
  // Set `BUILDING_SCALE_MULTIPLIER` to 1.0 for no global change; adjust per-model scales below.
  const BUILDING_SCALE_MULTIPLIER = 1.0;
  const BUILDING_MODEL_SCALES = { 1: 1.8, 2: 1.8, 3: 1.8 };

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
  function placeBuilding(base, x, y, z, dir, modelScale, applyBrick = false) {
    const b = base.clone(true);
    b.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        if (applyBrick && n.name === 'Cube') {
          n.material = brickMat;
        }
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
    { model: 2, x: cx - 7.5, z: cz - 6.1, dir: 'W' },
    { model: 1, x: cx + 7.5, z: cz - 6.1, dir: 'W' },
    { model: 2, x: cx + 14.8, z: cz - 6.1, dir: 'W' },

    { model: 2, x: cx - 14.8, z: cz + 6.1, dir: 'E' },
    { model: 1, x: cx - 7.5, z: cz + 6.1, dir: 'E' },
    { model: 2, x: cx + 7.5, z: cz + 6.1, dir: 'E' },
    { model: 1, x: cx + 14.8, z: cz + 6.1, dir: 'E' },

    // Along main vertical road (x = cx)
    { model: 1, x: cx - 7.5, z: cz - 12.5, dir: 'E' },
    { model: 2, x: cx + 7.5, z: cz - 12.5, dir: 'E' },
    { model: 2, x: cx - 14.8, z: cz - 12.5, dir: 'E' },
    { model: 2, x: cx + 14.8, z: cz - 12.5, dir: 'E' },

    { model: 1, x: cx - 7.5, z: cz - 25, dir: 'W' },
    { model: 1, x: cx - 14.8, z: cz - 25, dir: 'W' },
    { model: 2, x: cx + 7.5, z: cz - 25, dir: 'W' },
    { model: 2, x: cx + 14.8, z: cz - 25, dir: 'W' },
    { model: 3, x: cx, z: cz - 25, dir: 'W' }

  ];

  // Use placements directly; placement objects control exact x,y,z and dir.
  const validPlacements = placements;

  // Explicit streetlight placements for the city (not the beach connector lights).

  const lightPlacements = [

    { model: 'streetlight', x: cx - 3.2, z: cz - 10.0, dir: 'S' },
    { model: 'streetlight', x: cx - 3.2, z: cz + 6.0, dir: 'S' },
    { model: 'streetlight', x: cx - 3.2, z: cz + 16.0, dir: 'S' },
    { model: 'streetlight', x: cx - 3.2, z: cz - 21.0, dir: 'E' },
    { model: 'streetlight', x: cx - 14, z: cz - 21.0, dir: 'E' },

    { model: 'streetlight', x: cx + 3.2, z: cz - 10.0, dir: 'N' },
    { model: 'streetlight', x: cx + 3.2, z: cz + 6.0, dir: 'N' },
    { model: 'streetlight', x: cx + 3.2, z: cz + 16.0, dir: 'N' },
    { model: 'streetlight', x: cx + 3.2, z: cz - 21.0, dir: 'E' },
    { model: 'streetlight', x: cx + 14, z: cz - 21.0, dir: 'E' },

    { model: 'streetlight', x: cx + 11, z: cz - 2, dir: 'E' },
    { model: 'streetlight', x: cx - 11, z: cz - 2, dir: 'E' }

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
    lamp.userData = lamp.userData || {};
    // mark streetlight model as non-collidable so players can walk through it
    lamp.userData.noCollision = true;
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

    // mark visual cone as non-collidable
    cone.userData = cone.userData || {};
    cone.userData.noCollision = true;

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
      } catch (e) { }
      scene.userData.streetLightMeshes.push(cone);
      // also track cones separately so we can toggle their visibility explicitly
      scene.userData.streetLightCones = scene.userData.streetLightCones || [];
      scene.userData.streetLightCones.push(cone);
      if (scene.userData.isDay) cone.visible = false;
    } catch (e) { }

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
              } catch (e) { }
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
    pole.userData = pole.userData || {};
    pole.userData.noCollision = true;
    pole.castShadow = true;
    scene.add(pole);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff8dd, emissive: 0xffd699, emissiveIntensity: 1.2 })
    );
    bulb.position.set(x, 2.26, z);
    bulb.userData = bulb.userData || {};
    bulb.userData.noCollision = true;
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
        try { if (bulb.material && bulb.material.emissive !== undefined) bulb.material.emissiveIntensity = 0; } catch (e) { }
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

    // mark visual cone as non-collidable for fallback lights
    cone.userData = cone.userData || {};
    cone.userData.noCollision = true;

    // register cone for fallback light as well (store original opacity)
    try {
      scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];
      try {
        const mats = Array.isArray(cone.material) ? cone.material : [cone.material];
        cone.userData = cone.userData || {};
        cone.userData._origOpacity = (mats[0] && typeof mats[0].opacity === 'number') ? mats[0].opacity : 1;
        if (scene.userData.isDay) for (const mat of mats) if (mat && typeof mat.opacity === 'number') mat.opacity = 0;
      } catch (e) { }
      scene.userData.streetLightMeshes.push(cone);
      scene.userData.streetLightCones = scene.userData.streetLightCones || [];
      scene.userData.streetLightCones.push(cone);
      if (scene.userData.isDay) cone.visible = false;
    } catch (e) { }
  }

  const beachLightSpots = [];

  // Perpendicular connector lights — use three positions (-8, 0, 8) instead of two
  for (let m = -15; m <= 20; m += 12) {
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

  lightLoader.load('./models/blender/streetlight.glb', (lightGltf) => {
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

  loader.load('./models/blender/City/trashbin.glb', (gltf) => {
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

  loader.load('./models/blender/City/building1.glb', (gltf1) => {
    const model1 = gltf1.scene;
    for (const p of validPlacements) {
      if (p.model === 1) {
        const y = (typeof p.y === 'number') ? p.y : undefined;
        const rot = (typeof p.dir === 'string') ? p.dir : (typeof p.rotY === 'number' ? p.rotY : undefined);
        placeBuilding(model1, p.x, y, p.z, rot, BUILDING_MODEL_SCALES[1], true);
      }
    }
  }, undefined, (err) => {
    console.warn('Failed to load building1.glb', err);
  });

  loader.load('./models/blender/City/building2.glb', (gltf2) => {
    const model2 = gltf2.scene;
    for (const p of validPlacements) {
      if (p.model === 2) {
        const y = (typeof p.y === 'number') ? p.y : undefined;
        const rot = (typeof p.dir === 'string') ? p.dir : (typeof p.rotY === 'number' ? p.rotY : undefined);
        placeBuilding(model2, p.x, y, p.z, rot, BUILDING_MODEL_SCALES[2], true);
      }
    }
  }, undefined, (err) => {
    console.warn('Failed to load building2.glb', err);
  });

  loader.load('./models/blender/City/building3.glb', (gltf3) => {
    const model3 = gltf3.scene;
    // quick debug: search the loaded model for nodes that look like ladders
    try {
      model3.traverse((n) => {
        if (n && n.name && /ladder|lad/i.test(n.name)) {
          console.log('Found ladder-like node in building3:', n.name, n);
        }
      });
    } catch (e) { }

    for (const p of validPlacements) {
      if (p.model === 3) {
        const y = (typeof p.y === 'number') ? p.y : undefined;
        const rot = (typeof p.dir === 'string') ? p.dir : (typeof p.rotY === 'number') ? p.rotY : 0;

        // place building normally
        placeBuilding(model3, p.x, y, p.z, rot, BUILDING_MODEL_SCALES[3], true);

        // create stair/ladder trigger and a debug marker so we can visually inspect location
        const triggerPos = new THREE.Vector3(p.x + 3, 0, p.z + 1.9);
        const triggerRadius = 2;
        const targetPos = new THREE.Vector3(p.x + 3, 16, p.z + 1.9);

        scene.userData.stairTrigger = { position: triggerPos, radius: triggerRadius, target: targetPos };
        console.log('stairTrigger set at', triggerPos, 'radius', triggerRadius, 'target', targetPos);

        // remove previous debug markers if present
        try {
          if (scene.userData && scene.userData._stairDebug) {
            scene.remove(scene.userData._stairDebug);
            scene.userData._stairDebug = null;
          }
        } catch (e) { }

        const debugGroup = new THREE.Group();
        debugGroup.name = 'stair-debug-group';
        debugGroup.userData = debugGroup.userData || {};
        debugGroup.userData.noCollision = true;

        // red ring on ground showing trigger radius
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(Math.max(0.06, triggerRadius * 0.6), Math.max(0.08, triggerRadius), 48),
          new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(triggerPos.x, 0.02, triggerPos.z);
        ring.userData = ring.userData || {};
        ring.userData.noCollision = true;
        debugGroup.add(ring);

        // small red sphere at the target/top location
        const topSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0xff3333 })
        );
        topSphere.position.set(targetPos.x, targetPos.y + 0.22, targetPos.z);
        topSphere.userData = topSphere.userData || {};
        topSphere.userData.noCollision = true;
        debugGroup.add(topSphere);

        scene.add(debugGroup);
        scene.userData._stairDebug = debugGroup;
      }
    }
  });
}
