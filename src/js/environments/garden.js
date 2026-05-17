import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createGardenZone(scene, cx, cz){
  // Add a straight path and a circular plaza at the far end per user request.
  const pathLength = 30;
  const pathWidth = 2.6;
  const pathMat = new THREE.MeshStandardMaterial({color:0xcfc4b5});

  const path = new THREE.Mesh(new THREE.PlaneGeometry(pathWidth, pathLength), pathMat);
  path.rotation.x = -Math.PI/2;
  path.position.set(cx, 0.02, cz - pathLength/2 + 4);
  path.receiveShadow = true;
  scene.add(path);

  // circular plaza at the far end of the path (use same material so it's visually consistent)
  const plazaRadius = 4.0;
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(plazaRadius, 48), pathMat);
  plaza.rotation.x = -Math.PI/2;
  plaza.position.set(cx, 0.02, cz - pathLength + 1);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // Optionally add a thin rim (ring) to emphasize the circular path edge
  const ring = new THREE.Mesh(new THREE.RingGeometry(plazaRadius - 0.15, plazaRadius + 0.02, 48), new THREE.MeshStandardMaterial({color:0xbfb4a3}));
  ring.rotation.x = -Math.PI/2;
  ring.position.set(cx, 0.021, cz - pathLength + 1);
  scene.add(ring);

  (function addBushes(){
    const bushes = new THREE.Group();
    bushes.name = 'garden-bushes';

    const rectHalfW = Math.max(plazaRadius + 1.8, pathWidth/2 + 3.0);
    const rectHalfD = pathLength/2 + 3;
    const zCenter = cz - pathLength/2 -2;
    const pathCenterZ = cz - pathLength/2 + 4;

    const archWidth = pathWidth + 1.6;
    const archZ = cz + 1.0;
    const benchCountAlong = 3;
    const benchOffset = pathWidth/2 + 0.7;
    const lampOffset = 3;

    const fenceInset = 1.1;
    const maxBushes = 26;
    const maxAttempts = maxBushes * 30;
    const placed = [];
    const flowerPalette = [0xff82b2, 0xfff2a6, 0xb7e7ff, 0xdfb8ff, 0xffb77f];

    function makeBushTextureSet(size = 256){
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#2f5f31';
      ctx.fillRect(0, 0, size, size);

      // Broad leaf variation.
      for (let i = 0; i < 2100; i++){
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 0.7 + Math.random() * 2.2;
        const hue = 100 + Math.floor(Math.random() * 26);
        const sat = 35 + Math.floor(Math.random() * 25);
        const lit = 24 + Math.floor(Math.random() * 20);
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dark clumps for depth.
      for (let i = 0; i < 420; i++){
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 1.8 + Math.random() * 3.2;
        ctx.fillStyle = 'rgba(20, 48, 21, 0.30)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tiny bright highlights.
      for (let i = 0; i < 260; i++){
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 0.55 + Math.random() * 1.2;
        ctx.fillStyle = 'rgba(190, 255, 165, 0.20)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle blossoms in the texture itself.
      for (let i = 0; i < 90; i++){
        const x = Math.random() * size;
        const y = Math.random() * size;
        const flowerColor = flowerPalette[Math.floor(Math.random() * flowerPalette.length)];
        const flowerHex = `#${flowerColor.toString(16).padStart(6, '0')}`;
        ctx.fillStyle = flowerHex;
        ctx.beginPath();
        ctx.arc(x, y, 0.9 + Math.random() * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 250, 228, 0.95)';
        ctx.beginPath();
        ctx.arc(x, y, 0.35 + Math.random() * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      const foliageMap = new THREE.CanvasTexture(canvas);
      foliageMap.colorSpace = THREE.SRGBColorSpace;
      foliageMap.wrapS = foliageMap.wrapT = THREE.RepeatWrapping;
      foliageMap.repeat.set(2.2, 2.2);

      const foliageBump = new THREE.CanvasTexture(canvas);
      foliageBump.wrapS = foliageBump.wrapT = THREE.RepeatWrapping;
      foliageBump.repeat.copy(foliageMap.repeat);

      return { foliageMap, foliageBump };
    }

    const { foliageMap, foliageBump } = makeBushTextureSet(256);
    const flowerPetalGeo = new THREE.SphereGeometry(0.028, 8, 7);
    const flowerCenterGeo = new THREE.SphereGeometry(0.018, 8, 7);
    const flowerCenterMat = new THREE.MeshStandardMaterial({ color: 0xfff6d6, roughness: 0.75, metalness: 0.01 });
    const flowerPetalMats = flowerPalette.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.01 }));

    function reserve(x, z, r){
      placed.push({ x, z, r });
    }

    function overlapsReserved(x, z, r, pad = 0.16){
      for (const p of placed){
        const dx = x - p.x;
        const dz = z - p.z;
        const minDist = r + p.r + pad;
        if ((dx*dx + dz*dz) < minDist * minDist) return true;
      }
      return false;
    }

    function intersectsPath(x, z, r){
      const keepoutX = pathWidth/2 + 0.55 + r;
      const keepoutZ = pathLength/2 + 0.45 + r;
      return Math.abs(x - cx) <= keepoutX && Math.abs(z - pathCenterZ) <= keepoutZ;
    }

    function intersectsPlaza(x, z, r){
      const dx = x - cx;
      const dz = z - (cz - pathLength + 1);
      const keepout = plazaRadius + 0.95 + r;
      return (dx*dx + dz*dz) <= keepout * keepout;
    }

    function intersectsEntry(x, z, r){
      const dx = x - cx;
      const dz = z - archZ;
      const keepout = archWidth * 0.55 + r;
      return (dx*dx + dz*dz) <= keepout * keepout;
    }

    function addFlowerCluster(target, anchors, bushRadius){
      const flowerCount = THREE.MathUtils.randInt(2, 6);
      for (let i = 0; i < flowerCount; i++){
        const anchor = anchors[Math.floor(Math.random() * anchors.length)];
        const dir = new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(1),
          THREE.MathUtils.randFloat(0.25, 1),
          THREE.MathUtils.randFloatSpread(1)
        ).normalize();

        const base = new THREE.Vector3(anchor.x, anchor.y, anchor.z)
          .addScaledVector(dir, anchor.r * THREE.MathUtils.randFloat(0.75, 0.92));

        const up = dir.clone().normalize();
        const ref = Math.abs(up.y) > 0.86 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(up, ref).normalize();
        const fwd = new THREE.Vector3().crossVectors(side, up).normalize();

        const petalMat = flowerPetalMats[Math.floor(Math.random() * flowerPetalMats.length)];
        const petalScale = THREE.MathUtils.randFloat(0.75, 1.2) * (0.75 + bushRadius * 0.45);
        const petalOffset = THREE.MathUtils.randFloat(0.025, 0.043) * (0.9 + bushRadius);

        for (let p = 0; p < 5; p++){
          const a = (p / 5) * Math.PI * 2;
          const petalPos = base.clone()
            .addScaledVector(side, Math.cos(a) * petalOffset)
            .addScaledVector(fwd, Math.sin(a) * petalOffset);
          const petal = new THREE.Mesh(flowerPetalGeo, petalMat);
          petal.position.copy(petalPos);
          petal.scale.setScalar(petalScale);
          petal.castShadow = true;
          petal.receiveShadow = true;
          target.add(petal);
        }

        const center = new THREE.Mesh(flowerCenterGeo, flowerCenterMat);
        center.position.copy(base).addScaledVector(up, 0.005 * petalScale);
        center.scale.setScalar(Math.max(0.9, petalScale * 0.9));
        center.castShadow = true;
        center.receiveShadow = true;
        target.add(center);
      }
    }

    function makeBush(radius){
      const hue = THREE.MathUtils.randFloat(0.28, 0.34);
      const sat = THREE.MathUtils.randFloat(0.40, 0.55);
      const lit = THREE.MathUtils.randFloat(0.22, 0.33);
      const color = new THREE.Color().setHSL(hue, sat, lit);
      const mat = new THREE.MeshStandardMaterial({
        color,
        map: foliageMap,
        bumpMap: foliageBump,
        bumpScale: 0.08,
        roughness: 0.94,
        metalness: 0.02
      });

      const g = new THREE.Group();
      const r1 = radius;
      const r2 = radius * THREE.MathUtils.randFloat(0.70, 0.88);
      const r3 = radius * THREE.MathUtils.randFloat(0.62, 0.82);

      const s1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 12, 10), mat);
      const s2 = new THREE.Mesh(new THREE.SphereGeometry(r2, 12, 10), mat);
      const s3 = new THREE.Mesh(new THREE.SphereGeometry(r3, 12, 10), mat);

      s1.position.set(0, r1 * 0.88, 0);
      s2.position.set(r1 * 0.52, r2 * 0.88, r1 * 0.18);
      s3.position.set(-r1 * 0.44, r3 * 0.84, -r1 * 0.24);

      g.add(s1, s2, s3);

      if (Math.random() < 0.92){
        const anchors = [
          { x: 0, y: r1 * 0.88, z: 0, r: r1 },
          { x: r1 * 0.52, y: r2 * 0.88, z: r1 * 0.18, r: r2 },
          { x: -r1 * 0.44, y: r3 * 0.84, z: -r1 * 0.24, r: r3 }
        ];
        addFlowerCluster(g, anchors, r1);
      }

      g.traverse((n) => {
        if (!n.isMesh) return;
        n.castShadow = true;
        n.receiveShadow = true;
      });
      return g;
    }

    // Reserve benches (model and fallback locations) and lamp positions.
    for (let i = 0; i < benchCountAlong; i++){
      const t = (i + 0.5) / benchCountAlong;
      const zModelBench = cz - t * pathLength + 2;
      const zFallbackBench = cz - 1 - t * pathLength;
      const zLamp = cz - 1 - t * pathLength;

      reserve(cx - benchOffset, zModelBench, 0.82);
      reserve(cx + benchOffset, zModelBench, 0.82);
      reserve(cx - benchOffset, zFallbackBench, 0.82);
      reserve(cx + benchOffset, zFallbackBench, 0.82);

      reserve(cx - lampOffset, zLamp, 0.90);
      reserve(cx + lampOffset, zLamp, 0.90);
    }

    // Reserve torii pillar vicinity.
    const pillarOffsetX = archWidth/2 - 0.16;
    reserve(cx - pillarOffsetX, archZ, 0.56);
    reserve(cx + pillarOffsetX, archZ, 0.56);

    let created = 0;
    let attempts = 0;
    while (created < maxBushes && attempts < maxAttempts){
      attempts++;
      const radius = THREE.MathUtils.randFloat(0.34, 0.56);
      const minX = cx - rectHalfW + fenceInset + radius;
      const maxX = cx + rectHalfW - fenceInset - radius;
      const minZ = zCenter - rectHalfD + fenceInset + radius;
      const maxZ = zCenter + rectHalfD - fenceInset - radius;
      if (minX >= maxX || minZ >= maxZ) break;

      const x = THREE.MathUtils.randFloat(minX, maxX);
      const z = THREE.MathUtils.randFloat(minZ, maxZ);

      if (intersectsPath(x, z, radius)) continue;
      if (intersectsPlaza(x, z, radius)) continue;
      if (intersectsEntry(x, z, radius)) continue;
      if (overlapsReserved(x, z, radius, 0.20)) continue;

      const bush = makeBush(radius);
      bush.position.set(x, 0, z);
      bush.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);

      bushes.add(bush);
      reserve(x, z, radius);
      created++;
    }

    scene.add(bushes);
  })();

  // Perimeter rectangular fence around the park, connected to the arch (gap at torii)
  (function addPerimeterFence(){
    const fenceGroup = new THREE.Group();
    const postHeight = 0.95;
    const postRadius = 0.06;
    const postSegments = 12;
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85, metalness: 0.05 });
    const railMat = postMat;

    // compute rectangle size to enclose path + plaza with margin
    const rectHalfW = Math.max(plazaRadius + 1.8, pathWidth/2 + 3.0);
    const rectHalfD = pathLength/2 + 3;
    const zCenter = cz - pathLength/2 -2;

    // arch gap coordinates (do not place fence where torii stands)
    const archWidth = pathWidth + 1.6;
    const archLeftX = cx - archWidth/2 - 0.12;
    const archRightX = cx + archWidth/2 + 0.12;
    const archZ = cz + 1.0;

    // helper to add a post
    function makePost(x,z){
      const p = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, postHeight, postSegments), postMat);
      p.position.set(x, postHeight/2, z);
      p.castShadow = true; p.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(postRadius*1.08, 8, 6), postMat);
      cap.position.set(x, postHeight + postRadius*0.5, z);
      fenceGroup.add(p); fenceGroup.add(cap);
      return p;
    }

    // place posts along a segment with spacing, optionally skipping a gap (for arch)
    function placePostsAlong(x1,z1,x2,z2, gap){
      const dx = x2 - x1; const dz = z2 - z1;
      const len = Math.sqrt(dx*dx + dz*dz);
      const spacing = 0.8;
      const count = Math.max(2, Math.floor(len / spacing));
      const posts = [];
      for (let i=0;i<=count;i++){
        const t = i / count;
        const x = x1 + dx * t; const z = z1 + dz * t;
        // if gap provided and point lies within gap area (near arch), skip
          if (gap){
            const gapRadius = archWidth * 0.5;
            if ((x - cx) * (x - cx) + (z - archZ) * (z - archZ) <= gapRadius * gapRadius) continue;
          }
        posts.push(makePost(x,z));
      }
      return posts;
    }

    // rectangle corners
    const corners = [
      [cx - rectHalfW, zCenter - rectHalfD], // back-left
      [cx + rectHalfW, zCenter - rectHalfD], // back-right
      [cx + rectHalfW, zCenter + rectHalfD], // front-right
      [cx - rectHalfW, zCenter + rectHalfD], // front-left
    ];

    // define arch gap box on the front side (small depth around archZ)
    const gapDepth = 0.9;
    const gap = { x1: archLeftX, x2: archRightX, z1: archZ - gapDepth/2, z2: archZ + gapDepth/2};

    // determine which rectangle side faces the arch so we can leave a gap there
    let frontSide = 0; let minDist = Infinity;
    for (let side=0; side<4; side++){
      const a = corners[side]; const b = corners[(side+1)%4];
      const midZ = (a[1] + b[1]) / 2;
      const d = Math.abs(midZ - archZ);
      if (d < minDist){ minDist = d; frontSide = side; }
    }

    // collect all posts per side and add rails between adjacent posts
    for (let side=0; side<4; side++){
      const a = corners[side]; const b = corners[(side+1)%4];
      const posts = placePostsAlong(a[0], a[1], b[0], b[1], side === frontSide ? gap : null);

      // create rails between consecutive posts
      for (let i=0;i<posts.length-1;i++){
        const p1 = posts[i].position; const p2 = posts[i+1].position;
        const dx = p2.x - p1.x; const dz = p2.z - p1.z;
        const segLen = Math.sqrt(dx*dx + dz*dz);
        const midX = (p1.x + p2.x)/2; const midZ = (p1.z + p2.z)/2;

        // skip rails if their midpoint lies within circular gap around the arch
        const gapRadius = archWidth * 0.5;
        if ((midX - cx) * (midX - cx) + (midZ - archZ) * (midZ - archZ) <= gapRadius * gapRadius) continue;

        const angle = Math.atan2(dz, dx);
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.08, 0.06), railMat);
        topRail.position.set(midX, postHeight * 0.75, midX ? midZ : midZ);
        topRail.rotation.y = angle; topRail.castShadow = true;
        fenceGroup.add(topRail);
        const botRail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.08, 0.06), railMat);
        botRail.position.set(midX, postHeight * 0.38, midZ);
        botRail.rotation.y = angle; fenceGroup.add(botRail);

        // small decorative picket between the two posts (skip if inside gap)
        const pick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.02), postMat);
        pick.position.set(midX, 0.5/2, midZ);
        pick.rotation.y = angle; pick.castShadow = true; fenceGroup.add(pick);
      }
    }

    scene.add(fenceGroup);
  })();

  // place benches along the path sides using the bench GLB if available
  const benchCountAlong = 3;
  const offset = pathWidth/2 + 0.7;
  const benchScale = 0.35; // make benches noticeably smaller
  const benchLoader = new GLTFLoader();
  benchLoader.load('./models/blender/Garden/bench.glb', (gltf) => {
    const benchModel = gltf.scene;
    benchModel.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    for (let i = 0; i < benchCountAlong; i++){
      const t = (i + 0.5) / benchCountAlong;
      const zPos = cz  - t * pathLength;
      // left bench (faces +X)
      const left = benchModel.clone(true);
      left.position.set(cx - offset, -0.1, zPos + 2);
      left.rotation.y = 0; // 90 degrees
      left.scale.setScalar(benchScale);
      scene.add(left);
      // right bench (faces -X)
      const right = benchModel.clone(true);
      right.position.set(cx + offset, -0.1, zPos + 2);
      right.rotation.y = Math.PI; // -90 degrees
      right.scale.setScalar(benchScale);
      scene.add(right);
    }
  }, undefined, (err) => {
    console.warn('Failed to load bench.glb, falling back to simple benches', err);
    // fallback: simple procedural benches
    function makeBench(){
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.36), new THREE.MeshStandardMaterial({color:0x5a3a24}));
      seat.position.set(0, 0.25, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.08), new THREE.MeshStandardMaterial({color:0x4a2f1a}));
      back.position.set(0, 0.55, -0.14);
      const legGeo = new THREE.BoxGeometry(0.08, 0.34, 0.08);
      const leg1 = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({color:0x3b2a20})); leg1.position.set(-0.5, 0.12, 0.12);
      const leg2 = leg1.clone(); leg2.position.set(0.5, 0.12, 0.12);
      const leg3 = leg1.clone(); leg3.position.set(-0.5, 0.12, -0.12);
      const leg4 = leg1.clone(); leg4.position.set(0.5, 0.12, -0.12);
      g.add(seat, back, leg1, leg2, leg3, leg4);
      return g;
    }
    for (let i = 0; i < benchCountAlong; i++){
      const t = (i + 0.5) / benchCountAlong;
      const zPos = cz - 1 - t * pathLength;
      const benchL = makeBench(); benchL.position.set(cx - offset, 0, zPos); benchL.rotation.y = Math.PI/2; benchL.scale.setScalar(benchScale); scene.add(benchL);
      const benchR = makeBench(); benchR.position.set(cx + offset, 0, zPos); benchR.rotation.y = -Math.PI/2; benchR.scale.setScalar(benchScale); scene.add(benchR);
    }
  });

  // place streetlights between benches on the path center
  const lightCount = benchCountAlong;
  const lightLoader = new GLTFLoader();

  function registerStreetLight(spot) {
    try {
      spot.userData = spot.userData || {};
      spot.userData._origIntensity = spot.intensity;
      spot.userData.isStreetLight = true;
      scene.userData.streetLights = scene.userData.streetLights || [];
      scene.userData.streetLights.push(spot);
      if (scene.userData.isDay) spot.intensity = 0;
    } catch (e) {
      console.warn('Failed to register garden streetlight spot', e);
    }
  }

  function registerStreetLightCone(cone) {
    try {
      scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];
      const mats = Array.isArray(cone.material) ? cone.material : [cone.material];
      cone.userData = cone.userData || {};
      cone.userData._origOpacity = (mats[0] && typeof mats[0].opacity === 'number') ? mats[0].opacity : 1;
      if (scene.userData.isDay) {
        for (const mat of mats) if (mat && typeof mat.opacity === 'number') mat.opacity = 0;
      }
      scene.userData.streetLightMeshes.push(cone);
      scene.userData.streetLightCones = scene.userData.streetLightCones || [];
      scene.userData.streetLightCones.push(cone);
      if (scene.userData.isDay) cone.visible = false;
    } catch (e) {
      console.warn('Failed to register garden streetlight cone', e);
    }
  }

  function registerLampEmissiveMeshes(lamp) {
    try {
      scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];
      lamp.traverse((n) => {
        if (!n.isMesh || !n.material) return;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        for (let mat of mats) {
          if (!mat) continue;
          const emissiveSum = (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b)) || 0;
          const emissiveIntensity = (typeof mat.emissiveIntensity === 'number') ? mat.emissiveIntensity : 0;
          const isCubeEmitter = /cube\.?003/i.test(n.name || '') || /cube\.?003/i.test(mat.name || '');
          const looksLikeBulb = isCubeEmitter || emissiveIntensity > 1e-3 || emissiveSum > 1e-6 || /bulb|light|lamp/i.test(n.name || '');
          if (!looksLikeBulb) continue;
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
          if (mat.emissive !== undefined) mat.emissiveIntensity = scene.userData.isDay ? 0 : resolvedIntensity;
          break;
        }
      });
    } catch (e) {
      console.warn('Failed to register garden lamp emissive meshes', e);
    }
  }

  function addMainConeFromSpot(spot) {
    const dir = new THREE.Vector3().subVectors(spot.target.position, spot.position).normalize();
    const coneHeight = Math.max(1.2, spot.position.y - 0.05);
    const baseRadius = Math.max(0.2, coneHeight * Math.tan(spot.angle) * 0.95);
    const coneGeo = new THREE.ConeGeometry(baseRadius * 1.3, coneHeight * 1.2, 24, 1, true);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xffd699,
      transparent: true,
      opacity: 0.005,
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
    registerStreetLightCone(cone);
  }

  function addFallbackConeFromSpot(spot) {
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
    registerStreetLightCone(cone);
  }

  lightLoader.load('./models/blender/streetlight.glb', (gltf) => {
    const lightModel = gltf.scene;
    lightModel.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    for (let i = 0; i < lightCount; i++) {
      const t = (i + 0.5) / benchCountAlong;
      const zPos = cz - 1 - t * pathLength;

      const lampL = lightModel.clone(true);
      lampL.position.set(cx - 3, -0.05, zPos);
      lampL.scale.setScalar(0.4);
      lampL.rotation.y = Math.PI / 2;
      scene.add(lampL);

      const lampR = lightModel.clone(true);
      lampR.position.set(cx + 3, -0.05, zPos);
      lampR.scale.setScalar(0.4);
      lampR.rotation.y = -Math.PI / 2;
      scene.add(lampR);

      lampL.updateMatrixWorld(true);
      lampR.updateMatrixWorld(true);

      const lampBoxL = new THREE.Box3().setFromObject(lampL);
      const lampTopL = (lampBoxL && lampBoxL.max && isFinite(lampBoxL.max.y)) ? lampBoxL.max.y : (lampL.position.y + 2.0 * lampL.scale.y);
      const spotL = new THREE.SpotLight(0xffd699, 2.5, 20, Math.PI / 2.5, 0.9, 2);
      spotL.position.set(lampL.position.x, lampTopL - 0.5, lampL.position.z + 0.17);
      spotL.target.position.set(lampL.position.x, 0.05, lampL.position.z);
      spotL.castShadow = false;
      scene.add(spotL.target);
      scene.add(spotL);
      registerStreetLight(spotL);
      addMainConeFromSpot(spotL);
      registerLampEmissiveMeshes(lampL);

      const lampBoxR = new THREE.Box3().setFromObject(lampR);
      const lampTopR = (lampBoxR && lampBoxR.max && isFinite(lampBoxR.max.y)) ? lampBoxR.max.y : (lampR.position.y + 2.0 * lampR.scale.y);
      const spotR = new THREE.SpotLight(0xffd699, 2.5, 20, Math.PI / 2.5, 0.9, 2);
      spotR.position.set(lampR.position.x, lampTopR - 0.5, lampR.position.z - 0.17);
      spotR.target.position.set(lampR.position.x, 0.05, lampR.position.z);
      spotR.castShadow = false;
      scene.add(spotR.target);
      scene.add(spotR);
      registerStreetLight(spotR);
      addMainConeFromSpot(spotR);
      registerLampEmissiveMeshes(lampR);
    }
  }, undefined, (err) => {
    console.warn('Failed to load streetlight.glb, falling back to simple poles', err);
    for (let i = 0; i < lightCount; i++) {
      const t = (i + 0.5) / benchCountAlong;
      const zPos = cz - 1 - t * pathLength;

      const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      poleL.position.set(cx - 3, 1.1, zPos);
      poleL.castShadow = true;
      scene.add(poleL);

      const bulbL = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        new THREE.MeshStandardMaterial({ emissive: 0xffd699, emissiveIntensity: 1.2, color: 0xffffee })
      );
      bulbL.position.set(cx - 3, 2.2, zPos);
      scene.add(bulbL);

      const poleR = poleL.clone();
      poleR.position.set(cx + 3, 1.1, zPos);
      scene.add(poleR);

      const bulbR = bulbL.clone();
      bulbR.position.set(cx + 3, 2.2, zPos);
      scene.add(bulbR);

      const spotL = new THREE.SpotLight(0xffd699, 1.8, 10, Math.PI / 5, 0.4, 2);
      spotL.position.copy(bulbL.position).add(new THREE.Vector3(0, -0.05, 0));
      spotL.target.position.set(bulbL.position.x, 0.05, bulbL.position.z);
      spotL.castShadow = false;
      scene.add(spotL.target);
      scene.add(spotL);
      registerStreetLight(spotL);
      addFallbackConeFromSpot(spotL);

      const spotR = new THREE.SpotLight(0xffd699, 1.8, 10, Math.PI / 5, 0.4, 2);
      spotR.position.copy(bulbR.position).add(new THREE.Vector3(0, -0.05, 0));
      spotR.target.position.set(bulbR.position.x, 0.05, bulbR.position.z);
      spotR.castShadow = false;
      scene.add(spotR.target);
      scene.add(spotR);
      registerStreetLight(spotR);
      addFallbackConeFromSpot(spotR);

      try {
        scene.userData.streetLightMeshes = scene.userData.streetLightMeshes || [];
        bulbL.userData = bulbL.userData || {};
        bulbL.userData._origEmissiveIntensity = (bulbL.material && bulbL.material.emissiveIntensity !== undefined) ? bulbL.material.emissiveIntensity : 1;
        scene.userData.streetLightMeshes.push(bulbL);
        bulbR.userData = bulbR.userData || {};
        bulbR.userData._origEmissiveIntensity = (bulbR.material && bulbR.material.emissiveIntensity !== undefined) ? bulbR.material.emissiveIntensity : 1;
        scene.userData.streetLightMeshes.push(bulbR);
        if (scene.userData.isDay) {
          if (bulbL.material && bulbL.material.emissive !== undefined) bulbL.material.emissiveIntensity = 0;
          if (bulbR.material && bulbR.material.emissive !== undefined) bulbR.material.emissiveIntensity = 0;
        }
      } catch (e) {
        console.warn('Failed to register fallback garden bulbs', e);
      }
    }
  });
  // Replace previous arch with a simpler, torii-style entry and put the text on the top beam
  (function addTorii(){
    const archGroup = new THREE.Group();
    const archWidth = pathWidth + 1.6;
    const archHeight = 3.0;
    const pillarThickness = 0.32;
    const pillarDepth = 0.45;
    const toriiMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });

    // vertical pillars
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(pillarThickness, archHeight, pillarDepth), toriiMat);
    leftPillar.position.set(cx - archWidth/2 + pillarThickness/2, archHeight/2, cz + 1.0);
    leftPillar.castShadow = true; leftPillar.receiveShadow = true;
    archGroup.add(leftPillar);

    const rightPillar = leftPillar.clone();
    rightPillar.position.set(cx + archWidth/2 - pillarThickness/2, archHeight/2, cz + 1.0);
    archGroup.add(rightPillar);

    // top beam (kasagi) - slightly overhanging
    const beamHeight = 0.24;
    const beamDepth = 0.5;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(archWidth + 0.4, beamHeight, beamDepth), toriiMat);
    beam.position.set(cx, archHeight - 0.25, cz + 1.0);
    beam.castShadow = true;
    archGroup.add(beam);

    // lower lintel (nuki) for torii look
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(archWidth * 0.86, 0.18, 0.18), toriiMat);
    nuki.position.set(cx, archHeight - 0.65, cz + 1.0);
    archGroup.add(nuki);

    // 3D block letters that form PARK on the front face of the top beam.
    const letterMat = new THREE.MeshStandardMaterial({ color: 0xfff4dc, roughness: 0.64, metalness: 0.04 });

    function makeStroke(w, h){
      const stroke = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), letterMat);
      stroke.castShadow = true;
      stroke.receiveShadow = true;
      return stroke;
    }

    function makeLetterP(){
      const g = new THREE.Group();
      const h = 0.42;
      const t = 0.065;
      const rightHeight = h * 0.5;

      const stem = makeStroke(t, h); stem.position.set(-0.12, 0, 0);
      const top = makeStroke(0.28, t); top.position.set(0.02, h/2 - t/2, 0);
      const mid = makeStroke(0.28, t); mid.position.set(0.02, 0.02, 0);
      const right = makeStroke(t, rightHeight); right.position.set(0.16, h/2 - rightHeight/2, 0);

      g.add(stem, top, mid, right);
      return g;
    }

    function makeLetterA(){
      const g = new THREE.Group();
      const h = 0.42;
      const t = 0.065;

      const left = makeStroke(t, h); left.position.set(-0.12, 0, 0);
      const right = makeStroke(t, h); right.position.set(0.12, 0, 0);
      const top = makeStroke(0.30, t); top.position.set(0, h/2 - t/2, 0);
      const cross = makeStroke(0.22, t); cross.position.set(0, -0.01, 0);

      g.add(left, right, top, cross);
      return g;
    }

    function makeLetterR(){
      const g = new THREE.Group();
      const h = 0.42;
      const t = 0.065;
      const rightHeight = h * 0.5;

      const stem = makeStroke(t, h); stem.position.set(-0.12, 0, 0);
      const top = makeStroke(0.29, t); top.position.set(0.02, h/2 - t/2, 0);
      const mid = makeStroke(0.29, t); mid.position.set(0.02, 0.02, 0);
      const right = makeStroke(t, rightHeight); right.position.set(0.165, h/2 - rightHeight/2, 0);
      const legJoint = makeStroke(0.08, t); legJoint.position.set(0.00, -0.015, 0);
      const leg = makeStroke(t, 0.31); leg.position.set(0.06, -0.11, 0); leg.rotation.z = 0.71;

      g.add(stem, top, mid, right, legJoint, leg);
      return g;
    }

    function makeLetterK(){
      const g = new THREE.Group();
      const h = 0.42;
      const t = 0.065;

      const stem = makeStroke(t, h); stem.position.set(-0.12, 0, 0);
      const joint = makeStroke(0.09, t); joint.position.set(-0.045, 0, 0);
      const upper = makeStroke(t, 0.31); upper.position.set(0.03, 0.11, 0); upper.rotation.z = -0.73;
      const lower = makeStroke(t, 0.31); lower.position.set(0.03, -0.11, 0); lower.rotation.z = 0.73;

      g.add(stem, joint, upper, lower);
      return g;
    }

    const wordGroup = new THREE.Group();
    const letters = [makeLetterP(), makeLetterA(), makeLetterR(), makeLetterK()];
    const spacing = 0.44;
    const startX = -((letters.length - 1) * spacing) / 2;

    letters.forEach((letter, idx) => {
      letter.position.set(startX + idx * spacing, 0, 0);
      wordGroup.add(letter);
    });

    wordGroup.position.set(cx, archHeight - 0.25, cz + 1.0 + beamDepth/2 + 0.08);
    archGroup.add(wordGroup);

    scene.add(archGroup);
  })();

    // Beach branch moved to `beach.js`.
}
