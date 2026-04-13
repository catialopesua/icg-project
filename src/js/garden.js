import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function makeCanvasTextTexture(text, opts = {}){
  const w = opts.width || 512; const h = opts.height || 128;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = opts.bg || '#6b4a2c';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = opts.color || '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${opts.fontSize||48}px sans-serif`;
  ctx.fillText(text, w/2, h/2);
  const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; return tex;
}

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
  benchLoader.load('./models/Garden/bench.glb', (gltf) => {
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
  lightLoader.load('./models/streetlight.glb', (gltf) => {
    const lightModel = gltf.scene;
    lightModel.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    for (let i = 0; i < lightCount; i++){
      const t = (i + 0.5) / benchCountAlong;
      const zPos = cz - 1 - t * pathLength;
      // left lamp (near left side of path)
      const lampL = lightModel.clone(true);
      lampL.position.set(cx - 3, -0.05, zPos);
      lampL.scale.setScalar(0.4);
      lampL.rotation.y = Math.PI/2;
      scene.add(lampL);
      // right lamp (mirrored)
      const lampR = lightModel.clone(true);
      lampR.position.set(cx + 3, -0.05, zPos);
      lampR.scale.setScalar(0.4);
      lampR.rotation.y = -Math.PI/2;
      scene.add(lampR);
      // ensure world matrices are updated before computing bounding boxes
      lampL.updateMatrixWorld(true);
      lampR.updateMatrixWorld(true);
      // left spotlight
      const spotL = new THREE.SpotLight(0xfff3d6, 3.0, 7, Math.PI / 3, 0.22, 2);
      const lampBoxL = new THREE.Box3().setFromObject(lampL);
      const lampTopL = (lampBoxL && lampBoxL.max && isFinite(lampBoxL.max.y)) ? lampBoxL.max.y : (lampL.position.y + 2.0 * lampL.scale.y);
      spotL.position.set(lampL.position.x, lampTopL - 0.85, lampL.position.z + 0.17);
      spotL.target.position.set(lampL.position.x, 0.05, lampL.position.z);
      spotL.castShadow = true;
      spotL.shadow.mapSize.width = 1024; spotL.shadow.mapSize.height = 1024;
      scene.add(spotL.target);
      scene.add(spotL);
      // right spotlight
      const spotR = new THREE.SpotLight(0xfff3d6, 3.0, 7, Math.PI / 3, 0.22, 2);
      const lampBoxR = new THREE.Box3().setFromObject(lampR);
      const lampTopR = (lampBoxR && lampBoxR.max && isFinite(lampBoxR.max.y)) ? lampBoxR.max.y : (lampR.position.y + 2.0 * lampR.scale.y);
      spotR.position.set(lampR.position.x, lampTopR - 0.85, lampR.position.z - 0.17);
      spotR.target.position.set(lampR.position.x, 0.05, lampR.position.z);
      spotR.castShadow = true;
      spotR.shadow.mapSize.width = 1024; spotR.shadow.mapSize.height = 1024;
      scene.add(spotR.target);
      scene.add(spotR);
      // visible cones for both spots
      const dirL = new THREE.Vector3().subVectors(spotL.target.position, spotL.position).normalize();
      const coneHeightL = Math.max(0.8, spotL.position.y - 0.15);
      const baseRadiusL = Math.max(0.14, coneHeightL * Math.tan(spotL.angle) * 1.05);
      const coneGeoL = new THREE.ConeGeometry(baseRadiusL + 2, coneHeightL + 1.6, 20, 1, true);
      const coneMatL = new THREE.MeshStandardMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide });
      const coneL = new THREE.Mesh(coneGeoL, coneMatL);
      coneL.position.copy(spotL.position).add(dirL.clone().multiplyScalar(coneHeightL / 2));
      const qL = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirL);
      coneL.quaternion.copy(qL);
      coneL.rotateX(Math.PI);
      coneL.renderOrder = 1;
      scene.add(coneL);
      const dirR = new THREE.Vector3().subVectors(spotR.target.position, spotR.position).normalize();
      const coneHeightR = Math.max(0.8, spotR.position.y - 0.15);
      const baseRadiusR = Math.max(0.14, coneHeightR * Math.tan(spotR.angle) * 1.05);
      const coneGeoR = new THREE.ConeGeometry(baseRadiusR + 2, coneHeightR + 1.6, 20, 1, true);
      const coneR = new THREE.Mesh(coneGeoR, coneMatL.clone());
      coneR.position.copy(spotR.position).add(dirR.clone().multiplyScalar(coneHeightR / 2));
      const qR = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirR);
      coneR.quaternion.copy(qR);
      coneR.rotateX(Math.PI);
      coneR.renderOrder = 1;
      scene.add(coneR);
    }
  }, undefined, (err) => {
    console.warn('Failed to load streetlight.glb, falling back to simple poles', err);
    for (let i = 0; i < lightCount; i++){
      const t = (i + 0.5) / benchCountAlong;
      const zPos = cz - 1 - t * pathLength;
      // left fallback pole
      const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.2), new THREE.MeshStandardMaterial({color:0x333333}));
      poleL.position.set(cx - 3, 1.1, zPos); poleL.castShadow = true; scene.add(poleL);
      const bulbL = new THREE.Mesh(new THREE.SphereGeometry(0.08,8,6), new THREE.MeshStandardMaterial({emissive:0xfff0c8, emissiveIntensity:1.0, color:0xffffee}));
      bulbL.position.set(cx - 3, 2.2, zPos); scene.add(bulbL);
      // right fallback pole
      const poleR = poleL.clone(); poleR.position.set(cx + 3, 1.1, zPos); scene.add(poleR);
      const bulbR = bulbL.clone(); bulbR.position.set(cx + 3, 2.2, zPos); scene.add(bulbR);
      // spot lights for both bulbs
      const spotL = new THREE.SpotLight(0xfff2d0, 2.4, 6, Math.PI / 24, 0.32, 1.5);
      spotL.position.copy(bulbL.position).add(new THREE.Vector3(0, -0.08, 0));
      spotL.target.position.set(bulbL.position.x, 0.05, bulbL.position.z);
      spotL.castShadow = true;
      spotL.shadow.mapSize.width = 1024; spotL.shadow.mapSize.height = 1024;
      scene.add(spotL.target);
      scene.add(spotL);
      const spotR = new THREE.SpotLight(0xfff2d0, 2.4, 6, Math.PI / 24, 0.32, 1.5);
      spotR.position.copy(bulbR.position).add(new THREE.Vector3(0, -0.08, 0));
      spotR.target.position.set(bulbR.position.x, 0.05, bulbR.position.z);
      spotR.castShadow = true;
      spotR.shadow.mapSize.width = 1024; spotR.shadow.mapSize.height = 1024;
      scene.add(spotR.target);
      scene.add(spotR);
      // subtle cones for both spots
      const dirL = new THREE.Vector3().subVectors(spotL.target.position, spotL.position).normalize();
      const coneHeightL = Math.max(0.75, spotL.position.y - 0.05);
      const baseRadiusL = Math.max(0.16, coneHeightL * Math.tan(spotL.angle) * 1.4);
      const coneGeoL = new THREE.ConeGeometry(baseRadiusL, coneHeightL, 32, 1, true);
      const coneMatL = new THREE.MeshStandardMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide });
      const coneL = new THREE.Mesh(coneGeoL, coneMatL);
      coneL.position.copy(spotL.position).add(dirL.clone().multiplyScalar(coneHeightL / 2));
      const qfL = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dirL);
      coneL.quaternion.copy(qfL);
      coneL.rotateX(Math.PI);
      coneL.renderOrder = 1; scene.add(coneL);
      const dirR = new THREE.Vector3().subVectors(spotR.target.position, spotR.position).normalize();
      const coneHeightR = Math.max(0.75, spotR.position.y - 0.05);
      const baseRadiusR = Math.max(0.16, coneHeightR * Math.tan(spotR.angle) * 1.4);
      const coneGeoR = new THREE.ConeGeometry(baseRadiusR, coneHeightR, 32, 1, true);
      const coneR = new THREE.Mesh(coneGeoR, coneMatL.clone());
      coneR.position.copy(spotR.position).add(dirR.clone().multiplyScalar(coneHeightR / 2));
      const qfR = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dirR);
      coneR.quaternion.copy(qfR);
      coneR.rotateX(Math.PI);
      coneR.renderOrder = 1; scene.add(coneR);
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

    // 'Park' text on the front face of the top beam
    const textTex = makeCanvasTextTexture('Park', { width: 1024, height: 256, bg: '#8b5a2b', color: '#fff9e6', fontSize: 110 });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(archWidth * 0.6, 0.5), new THREE.MeshBasicMaterial({ map: textTex, transparent: true }));
    textPlane.position.set(cx, archHeight - 0.25, cz + 1.0 + beamDepth/2 + 0.01);
    archGroup.add(textPlane);

    // small ambient spot to highlight the torii at night
    const rimLight = new THREE.SpotLight(0xffecd1, 0.6, 8, Math.PI/8, 0.5, 1.5);
    rimLight.position.set(cx, archHeight + 0.6, cz + 1.2);
    rimLight.target.position.set(cx, archHeight - 0.25, cz + 1.0);
    rimLight.castShadow = true;
    scene.add(rimLight.target);
    scene.add(rimLight);

    scene.add(archGroup);
  })();

    // Beach branch moved to `beach.js`.
}
