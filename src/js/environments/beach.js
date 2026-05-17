import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function makeStripedTowelTexture(baseColor = '#ff8a80') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const stripeWidth = 16;
  for (let x = 0; x < canvas.width; x += stripeWidth * 2) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, 0, stripeWidth, canvas.height);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 1);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function makeSandTexture() {
  const loader = new THREE.TextureLoader();
  const textureBasePath = './textures/Ground093A_2K-JPG/Ground093A_2K-JPG';
  const repeatX = 8;
  const repeatY = 4;

  function setup(tex, isColor = false) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const map = setup(loader.load(`${textureBasePath}_Color.jpg`), true);
  const normal = setup(loader.load(`${textureBasePath}_NormalGL.jpg`));
  const roughness = setup(loader.load(`${textureBasePath}_Roughness.jpg`));
  const bump = setup(loader.load(`${textureBasePath}_Displacement.jpg`));
  const ao = setup(loader.load(`${textureBasePath}_AmbientOcclusion.jpg`));

  return { map, normal, roughness, bump, ao };
}

function createSimpleUmbrella(x, z, y = 0.03, rot) {
  const g = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.55, 10),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 })
  );
  pole.position.set(0, 0.8, 0);
  pole.castShadow = true;
  g.add(pole);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 0.65, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff7fbf, roughness: 0.65, side: THREE.DoubleSide })
  );
  canopy.position.set(0, 1.5, 0);
  canopy.rotation.x = Math.PI;
  canopy.castShadow = true;
  g.add(canopy);

  g.position.set(x, y, z);
  g.rotation.y = (typeof rot === 'number') ? rot : Math.random() * Math.PI * 2;
  return g;
}

function createFallbackBoat() {
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.55, 1.15),
    new THREE.MeshStandardMaterial({ color: 0x6b4f36, roughness: 0.72 })
  );
  hull.position.y = 0.32;
  hull.castShadow = true;
  hull.receiveShadow = true;
  boat.add(hull);

  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x5c422d, roughness: 0.74 })
  );
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(1.9, 0.33, 0);
  bow.castShadow = true;
  boat.add(bow);

  return boat;
}

function createWakePool(count = 36) {
  const wake = [];
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xe8f7ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      roughness: 0.35,
      metalness: 0
    });
    const ripple = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), material);
    ripple.rotation.x = -Math.PI / 2;
    ripple.visible = false;
    ripple.userData = {
      age: 0,
      life: 10,
      vx: 0,
      vz: 0,
      active: false
    };
    wake.push(ripple);
  }
  return wake;
}

export function createBeachZone(scene, parkCx, parkCz) {
  const group = new THREE.Group();

  // Beach in front of the park (toward +Z from park center)
  const beachCenterX = parkCx;
  const beachCenterZ = parkCz + 18;
  const beachWidth = 80;
  const beachDepth = 18;

  // Small connecting path from park front to beach edge
  const pathStartZ = parkCz + 3;
  const beachNearEdgeZ = beachCenterZ - beachDepth / 2;
  const connectorLength = Math.max(4, beachNearEdgeZ - pathStartZ);
  const connector = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, connectorLength),
    new THREE.MeshStandardMaterial({ color: 0xcfc4b5, roughness: 0.95 })
  );
  connector.rotation.x = -Math.PI / 2;
  connector.position.set(parkCx - 18, 0.02, pathStartZ + connectorLength / 2);
  connector.receiveShadow = true;
  group.add(connector);

  // Rectangular beach (not circular)
  const sandTex = makeSandTexture();
  const beachGeometry = new THREE.PlaneGeometry(beachWidth, beachDepth);
  if (beachGeometry.attributes.uv && !beachGeometry.attributes.uv2) {
    beachGeometry.setAttribute('uv2', new THREE.BufferAttribute(new Float32Array(beachGeometry.attributes.uv.array), 2));
  }
  const beachMaterial = new THREE.MeshStandardMaterial({
    map: sandTex.map,
    normalMap: sandTex.normal,
    roughnessMap: sandTex.roughness,
    bumpMap: sandTex.bump,
    aoMap: sandTex.ao,
    roughness: 0.88,
    metalness: 0.02
  });
  beachMaterial.bumpScale = 0.1;
  beachMaterial.normalScale.set(0.85, 0.85);
  beachMaterial.aoMapIntensity = 0.55;

  const beach = new THREE.Mesh(beachGeometry, beachMaterial);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(beachCenterX, 0.025, beachCenterZ);
  beach.receiveShadow = true;
  group.add(beach);

  // Palm positions array declared early so placement checks can reference it
  const palmPositions = [];

  // Water/ocean on the side far from the park (+Z side)
  const farBeachEdgeZ = beachCenterZ + beachDepth / 2;
  const waterDepth = 90;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(beachWidth, waterDepth),
    new THREE.MeshStandardMaterial({
      color: 0x4faee8,
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.9
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(beachCenterX, 0.021, farBeachEdgeZ + waterDepth / 2 + 0.4);
  water.receiveShadow = true;
  group.add(water);

  const shoreline = new THREE.Mesh(
    new THREE.PlaneGeometry(beachWidth, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xf6f6f0, roughness: 0.85, transparent: true, opacity: 0.45 })
  );
  shoreline.rotation.x = -Math.PI / 2;
  shoreline.position.set(beachCenterX, 0.026, farBeachEdgeZ + 0.65);
  group.add(shoreline);

  // Towels scattered across many rows, few per row, using a seeded random so layout stays consistent
  const towelColors = ['#ff6b6b', '#6bc5ff', '#ffd66b', '#8bffb3', '#d48cff', '#ff9e64'];
  const towelCount = 32;
  const umbrellaSpots = [];

  // available area for towels (leave margins)
  const marginX = 3.0;
  const marginZ = 1.5;
  const areaXMin = beachCenterX - beachWidth / 2 + marginX;
  const areaXMax = beachCenterX + beachWidth / 2 - marginX;
  const areaZMinBase = beachCenterZ - beachDepth / 2 + marginZ;
  const areaZMaxBase = beachCenterZ + beachDepth / 2 - marginZ;

  // place towels on the water side of the palm row
  const palmRowZ = beachNearEdgeZ + Math.min(3, beachDepth * 0.35);
  const palmBuffer = 1.2;
  const areaZMin = Math.max(areaZMinBase, palmRowZ + palmBuffer);
  let areaZMax = areaZMaxBase;
  if (areaZMax <= areaZMin) areaZMax = areaZMin + 0.5;

  // seeded RNG for consistent but natural placement
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(1762341);
  // probability to place an umbrella near a towel (seeded RNG)
  const umbrellaProb = 0.62;

  const maxCols = 2; // fewer towels per row
  const cols = maxCols;
  const rows = Math.max(4, Math.ceil(towelCount / cols));

  const minTowelDist = 2.6; // increase spacing between towels
  const umbrellaMinDist = 1.8;

  // helper to check distances to existing towels/umbrellas
  const placedTowels = [];
  function tooClose(xp, zp) {
    for (const t of placedTowels) {
      const dx = t.x - xp;
      const dz = t.z - zp;
      if (Math.sqrt(dx * dx + dz * dz) < minTowelDist) return true;
    }
    for (const s of umbrellaSpots) {
      const dx = s.x - xp;
      const dz = s.z - zp;
      if (Math.sqrt(dx * dx + dz * dz) < umbrellaMinDist) return true;
    }
    return false;
  }

  let remaining = towelCount;
  for (let r = 0; r < rows && remaining > 0; r++) {
    // spread rows evenly but add stronger jitter so layout looks natural
    const tRow = rows === 1 ? 0.5 : r / (rows - 1);
    let rowZ = areaZMin + tRow * (areaZMax - areaZMin) + (rnd() - 0.5) * 1.2;
    rowZ = Math.max(areaZMin, Math.min(rowZ, areaZMax));

    // choose how many towels this row will have (1..cols), biased towards fewer
    let numInRow = 1 + Math.floor(Math.pow(rnd(), 1.3) * cols);
    numInRow = Math.min(numInRow, remaining);

    // segment the X range and place towels in each segment with jitter
    const segmentW = (areaXMax - areaXMin) / numInRow;
    for (let j = 0; j < numInRow && remaining > 0; j++) {
      let placedHere = false;
      for (let attempt = 0; attempt < 10 && !placedHere; attempt++) {
        const baseX = areaXMin + (j + 0.5) * segmentW;
        const jitter = (rnd() - 0.5) * segmentW * 0.85;
        const x = Math.max(areaXMin, Math.min(baseX + jitter, areaXMax));
        const z = rowZ + (rnd() - 0.5) * 0.7;

        if (tooClose(x, z)) continue;

        const towelTexture = makeStripedTowelTexture(towelColors[(towelCount - remaining) % towelColors.length]);
        const towel = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 0.025, 1.0),
          new THREE.MeshStandardMaterial({ map: towelTexture, roughness: 0.72 })
        );
        towel.position.set(x, 0.04, z);
        // rotate towels 90 degrees as requested
        towel.rotation.y = Math.PI / 2;
        towel.castShadow = true;
        towel.receiveShadow = true;
        towel.userData = towel.userData || {};
        towel.userData.noCollision = true;
        group.add(towel);

        // umbrella near many towels according to umbrellaProb
        if (rnd() < umbrellaProb) {
          let ux = x + (rnd() < 0.5 ? -0.9 : 0.9);
          let uz = z + (rnd() - 0.5) * 0.4;
          // try flipping if too close
          if (tooClose(ux, uz)) ux = x + (ux > x ? -0.9 : 0.9);
          const uxClamped = Math.max(areaXMin, Math.min(ux, areaXMax));
          const uzClamped = Math.max(areaZMin, Math.min(uz, areaZMax));
          const finalUz = uzClamped;
          const umbrellaRot = (Math.floor(rnd() * 8) - 4) * 0.2;
          umbrellaSpots.push({ x: uxClamped, z: finalUz, rot: umbrellaRot });
        }

        placedTowels.push({ x, z });
        remaining--;
        placedHere = true;
      }
    }
  }

  const umbrellaLoader = new GLTFLoader();
  umbrellaLoader.load('./models/blender/Beach/beachumbrella.glb', (gltf) => {
    const umbrellaModel = gltf.scene;
    umbrellaModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    for (const spot of umbrellaSpots) {
      const umbrella = umbrellaModel.clone(true);
      umbrella.position.set(spot.x, 0.03, spot.z);
      umbrella.rotation.y = spot.rot;
      umbrella.scale.setScalar(0.8);
      group.add(umbrella);
    }
  }, undefined, () => {
    for (const spot of umbrellaSpots) {
      const umbrella = createSimpleUmbrella(spot.x, spot.z, 0.03, spot.rot);
      umbrella.scale.setScalar(0.8);
      group.add(umbrella);
    }
  });

  const boatState = {
    boat: null,
    angle: Math.random() * Math.PI * 2,
    speed: 0.16,
    radius: Math.min(9, beachWidth * 0.15),
    centerX: beachCenterX,
    centerZ: farBeachEdgeZ + 14,
    lastElapsed: 0,
    wake: createWakePool(42),
    wakeCursor: 0,
    wakeTimer: 0,
    wakeInterval: 0.06
  };

  for (const ripple of boatState.wake) {
    ripple.position.y = 0.028;
    group.add(ripple);
  }

  function setupBoat(boatObject) {
    boatObject.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(boatObject);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxSize = Math.max(size.x || 1, size.z || 1);
    const targetLength = 3.2;
    const scale = targetLength / maxSize;
    boatObject.scale.setScalar(scale);

    box.setFromObject(boatObject);
    const minY = box.min.y;
    boatObject.position.y -= minY;

    group.add(boatObject);
    boatState.boat = boatObject;
  }

  const boatLoader = new GLTFLoader();
  boatLoader.load('./models/blender/Beach/boat.glb', (gltf) => {
    setupBoat(gltf.scene);
  }, undefined, () => {
    setupBoat(createFallbackBoat());
  });

  // Palms: deterministic spacing — evenly spread along X with fixed row Z
  const palmCount = 10;
  const palmXMin = beachCenterX - beachWidth / 2 + 3;
  const palmXMax = beachCenterX + beachWidth / 2 - 6;
  const palmZMin = beachNearEdgeZ;
  const palmZMax = beachNearEdgeZ + Math.min(1, beachDepth * 0.2);

  // rowZ is the main Z coordinate (toward the park side of the beach but away from water)
  const rowZ = beachNearEdgeZ + Math.min(3, beachDepth * 0.35);

  for (let i = 0; i < palmCount; i++) {
    const t = palmCount === 1 ? 0.5 : i / (palmCount - 1);
    const px = palmXMin + t * (palmXMax - palmXMin);
    // small alternating offsets so palms don't sit on a perfectly straight line
    const alternatingOffset = (i % 2 === 0) ? -0.45 : 0.45;
    let pz = rowZ + alternatingOffset;
    // clamp into earlier bounds just in case
    pz = Math.max(palmZMin, Math.min(pz, palmZMax));
    const rot = Math.random() * Math.PI * 2;
    const scale = 1.0 + ((i % 3) - 1) * 0.06;
    palmPositions.push({ x: px, z: pz, rot: rot, scale: scale });
  }

  function createSimplePalm(x, z, scale = 1, rot = 0) {
    const pg = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06 * scale, 0.12 * scale, 3.2 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.92 })
    );
    trunk.position.y = 1.6 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    pg.add(trunk);

    const leaves = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 * scale, 0.9 * scale, 0.18 * scale),
        new THREE.MeshStandardMaterial({ color: 0x2d7b2d, roughness: 0.7 })
      );
      leaf.position.y = 3.1 * scale;
      leaf.position.x = Math.cos((i / 6) * Math.PI * 2) * 0.12 * scale;
      leaf.position.z = Math.sin((i / 6) * Math.PI * 2) * 0.12 * scale;
      leaf.rotation.z = -Math.PI / 4;
      leaf.rotation.y = (i / 6) * Math.PI * 2;
      leaf.castShadow = true;
      leaves.add(leaf);
    }
    pg.add(leaves);
    pg.position.set(x, 0, z);
    pg.rotation.y = (typeof rot === 'number') ? rot : Math.random() * Math.PI * 2;
    return pg;
  }

  const palmLoader = new GLTFLoader();
  palmLoader.load('./models/blender/Beach/palmtree.glb', (gltf) => {
    const palmModel = gltf.scene;
    palmModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    for (const p of palmPositions) {
      const palm = palmModel.clone(true);
      const box = new THREE.Box3().setFromObject(palm);
      const size = new THREE.Vector3();
      box.getSize(size);
      const height = Math.max(size.y, 0.0001);
      const targetHeight = 4.2;
      const baseScale = targetHeight / height;
      const finalScale = baseScale * (p.scale || 1);
      palm.scale.setScalar(finalScale);

      box.setFromObject(palm);
      const minY = box.min.y;
      palm.position.y -= minY;
      palm.position.set(p.x, 0, p.z);
      palm.rotation.y = p.rot;
      group.add(palm);
    }
  }, undefined, () => {
    for (const p of palmPositions) {
      group.add(createSimplePalm(p.x, p.z, p.scale || 1, p.rot));
    }
  });

  function update(elapsedTime, dt = 0) {
    if (!boatState.boat) return;

    const delta = dt > 0 ? dt : Math.max(0.001, elapsedTime - boatState.lastElapsed);
    boatState.lastElapsed = elapsedTime;

    boatState.angle += boatState.speed * delta;

    const cosA = Math.cos(boatState.angle);
    const sinA = Math.sin(boatState.angle);

    const x = boatState.centerX + cosA * boatState.radius;
    const z = boatState.centerZ + sinA * boatState.radius;
    const bob = Math.sin(elapsedTime * 1.7 + boatState.angle * 0.8) * 0.06;

    boatState.boat.position.set(x, 0.04 + bob, z);

    const tangentX = -sinA;
    const tangentZ = cosA;
    boatState.boat.rotation.y = Math.atan2(tangentX, tangentZ) - Math.PI / 2;
    boatState.boat.rotation.z = Math.sin(elapsedTime * 2.1 + boatState.angle) * 0.055;
    boatState.boat.rotation.x = Math.cos(elapsedTime * 1.9 + boatState.angle * 0.6) * 0.04;

    // wake trail (surface ripples) emitted from stern
    boatState.wakeTimer += delta;
    if (boatState.wakeTimer >= boatState.wakeInterval) {
      boatState.wakeTimer = 0;

      const boatDir = new THREE.Vector3(tangentX, 0, tangentZ).normalize();
      const sternX = x - boatDir.x * 1.25;
      const sternZ = z - boatDir.z * 1.25;
      const sideX = -boatDir.z;
      const sideZ = boatDir.x;

      for (let i = 0; i < 2; i++) {
        const ripple = boatState.wake[boatState.wakeCursor];
        boatState.wakeCursor = (boatState.wakeCursor + 1) % boatState.wake.length;

        const sideOffset = (i === 0 ? -0.28 : 0.28) + (Math.random() - 0.5) * 0.08;
        ripple.position.set(
          sternX + sideX * sideOffset,
          0.028,
          sternZ + sideZ * sideOffset
        );
        ripple.scale.set(0.55, 0.55, 0.55);
        ripple.material.opacity = 0.34;
        ripple.visible = true;
        ripple.userData.active = true;
        ripple.userData.age = 0;
        ripple.userData.life = 0.95 + Math.random() * 0.55;
        ripple.userData.vx = -boatDir.x * (0.28 + Math.random() * 0.2) + (Math.random() - 0.5) * 0.06;
        ripple.userData.vz = -boatDir.z * (0.28 + Math.random() * 0.2) + (Math.random() - 0.5) * 0.06;
      }
    }

    for (const ripple of boatState.wake) {
      if (!ripple.userData.active) continue;
      ripple.userData.age += delta;
      const progress = ripple.userData.age / ripple.userData.life;
      if (progress >= 1) {
        ripple.userData.active = false;
        ripple.visible = false;
        ripple.material.opacity = 0;
        continue;
      }

      ripple.position.x += ripple.userData.vx * delta;
      ripple.position.z += ripple.userData.vz * delta;
      const s = 0.55 + progress * 1.7;
      ripple.scale.set(s, s, s);
      ripple.material.opacity = (1 - progress) * 0.34;
    }

    shoreline.material.opacity = 0.35 + Math.sin(elapsedTime * 1.6) * 0.07;
  }

  scene.add(group);
  return { group, update };
}
