import * as THREE from 'three';
import { scene, renderer, camera } from './engine.js';
import {
  dir,
  hemi,
  sun,
  moon,
  DAY_LIGHT_POS,
  NIGHT_LIGHT_POS,
  SHADOW_TARGET_POS,
  DAY_SHADOW_BOUNDS,
  NIGHT_SHADOW_BOUNDS,
  updateNightStreetlightShadowCasters,
  syncSceneMeshShadows
} from './lighting.js';

const textureLoader = new THREE.TextureLoader();

function loadSkyTexture(path) {
  const tex = textureLoader.load(path);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const daySkyTexture = loadSkyTexture('./models/environment/DaySkyHDRI001B_4K/DaySkyHDRI001B_4K_TONEMAPPED.jpg');
const sunsetSkyTexture = loadSkyTexture('./models/environment/EveningSkyHDRI022B_4K/EveningSkyHDRI022B_4K_TONEMAPPED.jpg');
const nightSkyTexture = loadSkyTexture('./models/environment/NightSkyHDRI003_4K/NightSkyHDRI003_4K_TONEMAPPED.jpg');
const northernLightsSkyTexture = loadSkyTexture('./models/environment/NightSkyHDRI007_4K/NightSkyHDRI007_4K_TONEMAPPED.jpg');

let currentWeather = 'sunny';
let particlesEnabled = true;
const weatherRoot = new THREE.Group();
weatherRoot.name = 'weather-effects-root';
weatherRoot.userData.noCollision = true;
weatherRoot.userData.noAutoShadow = true;

let grassGroundTex, snowGroundTex, groundMat;
let gradientSky, daySkyDome, sunsetSkyDome, nightStars, rainSystem, snowSystem, auroraGroup, rainbowGroup;
const rainDummy = new THREE.Object3D();

let _controls = null;
let _forestZone = null;
let _closePanelsFn = null;

const groundDefaults = {
  bumpScale: 0.02,
  normalScale: new THREE.Vector2(0.8, 0.8),
  aoMapIntensity: 0.65,
  roughness: 0.95,
  metalness: 0.01
};

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function createGradientSky() {
  const uniforms = {
    topColor: { value: new THREE.Color(0x7ec8ff) },
    middleColor: { value: new THREE.Color(0x9fdaff) },
    bottomColor: { value: new THREE.Color(0xe5f6ff) }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 middleColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = clamp(normalize(vWorldPosition).y * 0.5 + 0.5, 0.0, 1.0);
        vec3 lower = mix(bottomColor, middleColor, smoothstep(0.0, 0.55, h));
        vec3 upper = mix(middleColor, topColor, smoothstep(0.42, 1.0, h));
        vec3 skyColor = mix(lower, upper, smoothstep(0.28, 0.78, h));
        gl_FragColor = vec4(skyColor, 1.0);
      }
    `,
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material);
  mesh.userData.noAutoShadow = true; mesh.userData.noCollision = true; mesh.frustumCulled = false; mesh.visible = false;
  return mesh;
}

function createTexturedSky(texture) {
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material);
  mesh.userData.noAutoShadow = true; mesh.userData.noCollision = true; mesh.frustumCulled = false; mesh.visible = false;
  return mesh;
}

function setGradientSky(top, middle, bottom) {
  const sky = ensureGradientSky();
  sky.material.uniforms.topColor.value.set(top);
  sky.material.uniforms.middleColor.value.set(middle);
  sky.material.uniforms.bottomColor.value.set(bottom);
}

function setAmbientIntensity(intensity) {
  scene.traverse((o) => { if (o.isAmbientLight) o.intensity = intensity; });
}

function applyGroundTextureSet(textureSet, useSnowProfile = false) {
  if (!groundMat) return;
  groundMat.map = textureSet.map; groundMat.normalMap = textureSet.normal; groundMat.roughnessMap = textureSet.roughness;
  groundMat.bumpMap = textureSet.bump; groundMat.aoMap = textureSet.ao;
  if (useSnowProfile) {
    groundMat.bumpScale = 0.01; groundMat.normalScale.set(0.55, 0.55); groundMat.aoMapIntensity = 0.5; groundMat.roughness = 0.92; groundMat.metalness = 0.0;
  } else {
    groundMat.bumpScale = groundDefaults.bumpScale; groundMat.normalScale.copy(groundDefaults.normalScale);
    groundMat.aoMapIntensity = groundDefaults.aoMapIntensity; groundMat.roughness = groundDefaults.roughness; groundMat.metalness = groundDefaults.metalness;
  }
  groundMat.needsUpdate = true;
}

function makeStarLayer(count, size, opacity) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.52;
    const radius = 260 + Math.random() * 380;
    positions[idx] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[idx + 1] = 70 + Math.cos(phi) * radius * 0.7;
    positions[idx + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xf5f7ff, size, sizeAttenuation: false, transparent: true, opacity, depthWrite: false, fog: false });
  const points = new THREE.Points(geometry, material); points.userData.noAutoShadow = true; points.userData.noCollision = true; points.frustumCulled = false;
  return { points, material, baseOpacity: opacity, pulseOffset: Math.random() * Math.PI * 2, pulseSpeed: 0.35 + Math.random() * 0.6 };
}

function ensureGradientSky() {
  if (!gradientSky) { gradientSky = createGradientSky(); weatherRoot.add(gradientSky); }
  return gradientSky;
}

function ensureNightStars() {
  if (!nightStars) {
    nightStars = new THREE.Group(); nightStars.name = 'night-star-field'; nightStars.userData.noAutoShadow = true; nightStars.userData.noCollision = true;
    const layerA = makeStarLayer(1300, 1.25, 0.72); const layerB = makeStarLayer(700, 1.8, 0.45);
    nightStars.add(layerA.points, layerB.points); nightStars.userData.layers = [layerA, layerB];
    weatherRoot.add(nightStars);
  }
  nightStars.visible = true;
  return nightStars;
}

function ensureRainSystem() {
  if (!rainSystem) {
    const count = 1750;
    const dropGeometry = new THREE.BoxGeometry(0.03, 1.42, 0.03);
    const dropMaterial = new THREE.MeshBasicMaterial({ color: 0xbfd8f5, transparent: true, opacity: 0.52, depthWrite: false, fog: true });
    rainSystem = new THREE.InstancedMesh(dropGeometry, dropMaterial, count);
    rainSystem.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rainSystem.frustumCulled = false;
    
    const data = { width: 135, depth: 135, height: 44, windX: 2.6, windZ: 0.95, baseSpeed: 30, speedVariance: 20 };
    const offsets = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phase = new Float32Array(count);
    const tilts = new Float32Array(count * 2);
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      offsets[idx] = (Math.random() - 0.5) * data.width;
      offsets[idx + 1] = Math.random() * data.height;
      offsets[idx + 2] = (Math.random() - 0.5) * data.depth;
      speeds[i] = data.baseSpeed + Math.random() * data.speedVariance;
      phase[i] = Math.random() * Math.PI * 2;
      tilts[i * 2] = THREE.MathUtils.degToRad(8 + Math.random() * 9);
      tilts[i * 2 + 1] = THREE.MathUtils.degToRad(-7 + Math.random() * 14);
      scales[i] = 0.85 + Math.random() * 0.75;
    }
    rainSystem.userData = { ...data, offsets, speeds, phase, tilts, scales };
    weatherRoot.add(rainSystem);
  }
  rainSystem.visible = true;
  return rainSystem;
}

function ensureSnowSystem() {
  if (!snowSystem) {
    const data = { count: 2600, width: 135, depth: 135, height: 34, color: 0xf6fbff, size: 0.19, baseSpeed: 1.4, speedVariance: 2.4, windX: 0.4, windZ: 0.18 };
    const positions = new Float32Array(data.count * 3);
    const speeds = new Float32Array(data.count);
    const sway = new Float32Array(data.count);
    const phase = new Float32Array(data.count);
    for (let i = 0; i < data.count; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * data.width;
      positions[idx + 1] = Math.random() * data.height;
      positions[idx + 2] = (Math.random() - 0.5) * data.depth;
      speeds[i] = data.baseSpeed + Math.random() * data.speedVariance;
      sway[i] = 0.25 + Math.random() * 0.85;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttr);
    const material = new THREE.PointsMaterial({ color: data.color, size: data.size, transparent: true, opacity: 0.82, depthWrite: false, fog: true, sizeAttenuation: true });
    snowSystem = new THREE.Points(geometry, material);
    snowSystem.userData = { ...data, speeds, sway, phase };
    weatherRoot.add(snowSystem);
  }
  snowSystem.visible = true;
  return snowSystem;
}

function createAuroraRibbonMaterial(phase, opacityBase) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      phase: { value: phase },
      opacity: { value: opacityBase },
      colorA: { value: new THREE.Color(0x8ef8db) },
      colorB: { value: new THREE.Color(0x83dfff) },
      colorC: { value: new THREE.Color(0xaa9cff) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float time;
      uniform float phase;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float waveA = sin((position.x * 0.045) + time * 0.85 + phase) * 1.6;
        float waveB = sin((position.x * 0.09) - time * 0.50 + phase * 1.8) * 0.9;
        float wave = waveA + waveB;
        pos.z += wave;
        pos.y += sin((position.x * 0.03) + time * 0.32 + phase) * 0.55;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float opacity;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform vec3 colorC;
      float softEdge(float v) { return smoothstep(0.04, 0.2, v) * smoothstep(0.04, 0.2, 1.0 - v); }
      void main() {
        float edgeX = softEdge(vUv.x);
        float edgeY = smoothstep(0.0, 0.12, vUv.y) * smoothstep(0.0, 0.92, 1.0 - vUv.y);
        float band = 0.58 + 0.42 * sin(vUv.x * 18.0 + vUv.y * 7.0 + vWave * 0.55);
        float veil = 0.5 + 0.5 * sin(vUv.x * 5.0 + vWave * 0.35);
        float alpha = edgeX * edgeY * band * veil * opacity;
        if (alpha < 0.01) discard;
        vec3 col = mix(colorA, colorB, clamp(vUv.y + vWave * 0.035, 0.0, 1.0));
        col = mix(col, colorC, smoothstep(0.45, 1.0, vUv.y));
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
}

function ensureAuroraGroup() {
  if (!auroraGroup) {
    auroraGroup = new THREE.Group(); auroraGroup.name = 'northern-lights-ribbons'; auroraGroup.userData.ribbons = [];
    for (let i = 0; i < 6; i++) {
      const geometry = new THREE.PlaneGeometry(220, 38, 120, 1);
      const phase = Math.random() * Math.PI * 2;
      const opacityBase = 0.16 + i * 0.025;
      const material = createAuroraRibbonMaterial(phase, opacityBase);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((i - 2.5) * 34, 57 + i * 2.0, -182 + i * 18);
      mesh.rotation.x = -0.18; mesh.rotation.y = (i - 2.5) * 0.08;
      mesh.userData = { phase, opacityBase, baseX: mesh.position.x, baseY: mesh.position.y, baseZ: mesh.position.z };
      auroraGroup.userData.ribbons.push(mesh);
      auroraGroup.add(mesh);
    }
    weatherRoot.add(auroraGroup);
  }
  auroraGroup.visible = true;
  return auroraGroup;
}

function createRainbowBand(radius, tubeRadius, color) {
  const points = [];
  for (let i = 0; i <= 72; i++) {
    const t = i / 72; const angle = Math.PI - t * Math.PI;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.66, 0));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.16, roughness: 0.28, metalness: 0.0, transparent: true, opacity: 0.95 });
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 120, tubeRadius, 12, false), material);
}

function createRainbowGlow(radius, tubeRadius, color) {
  const points = [];
  for (let i = 0; i <= 72; i++) {
    const t = i / 72; const angle = Math.PI - t * Math.PI;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.66, 0));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 90, tubeRadius * 1.9, 10, false), material);
}

function ensureRainbowGroup() {
  if (!rainbowGroup) {
    rainbowGroup = new THREE.Group(); rainbowGroup.name = 'rainbow-arc'; rainbowGroup.userData.bands = []; rainbowGroup.userData.glows = [];
    const colors = [0xff3a2f, 0xff8c2f, 0xffd440, 0x59d85f, 0x4fc8ff, 0x3c6dff, 0x8a56ff];
    colors.forEach((c, i) => {
      const radius = 112 - i * 2.2;
      const band = createRainbowBand(radius, 1.12, c);
      const glow = createRainbowGlow(radius, 1.05, c);
      band.position.set(0, 37, -255); band.rotation.y = -0.02;
      glow.position.copy(band.position); glow.rotation.copy(band.rotation);
      band.userData = { baseY: band.position.y, baseX: band.position.x, phase: Math.random() * Math.PI * 2 };
      glow.userData = { baseY: glow.position.y, baseX: glow.position.x, phase: band.userData.phase, baseOpacity: glow.material.opacity };
      rainbowGroup.add(band, glow); rainbowGroup.userData.bands.push(band); rainbowGroup.userData.glows.push(glow);
    });
    weatherRoot.add(rainbowGroup);
  }
  rainbowGroup.visible = true;
  return rainbowGroup;
}

function ensureDaySkyDome() {
  if (!daySkyDome) { daySkyDome = createTexturedSky(daySkyTexture); daySkyDome.rotation.y = -Math.PI * 0.35; weatherRoot.add(daySkyDome); }
  return daySkyDome;
}

function ensureSunsetSkyDome() {
  if (!sunsetSkyDome) { sunsetSkyDome = createTexturedSky(sunsetSkyTexture); sunsetSkyDome.rotation.y = Math.PI * 0.92; weatherRoot.add(sunsetSkyDome); }
  return sunsetSkyDome;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initWeather(opts) {
  _controls = opts.controls; _forestZone = opts.forestZone; grassGroundTex = opts.grassGroundTex; snowGroundTex = opts.snowGroundTex; groundMat = opts.groundMat;
  _closePanelsFn = opts.closePanelsFn;
  scene.add(weatherRoot);
  
  const weatherOptions = Array.from(document.querySelectorAll('.weather-option[data-weather]'));
  weatherOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled || btn.classList.contains('locked')) return;
      applyWeather(btn.dataset.weather);
      _closePanelsFn?.();
    });
  });

  if (opts.settingParticles) {
    particlesEnabled = opts.settingParticles.checked;
    opts.settingParticles.addEventListener('change', () => {
      particlesEnabled = opts.settingParticles.checked;
      syncParticleDrivenEffects();
    });
  }

  applyWeather(currentWeather);
}

export function applyDayNight(day) {
  scene.userData.isDay = day;
  if (scene.fog) {
    scene.fog.color.set(day ? 0xcde6ff : 0x02030a);
    scene.fog.density = day ? 0.00075 : 0.004;
  }
  renderer.setClearColor(day ? 0xa6d8ff : 0x02030a);
  scene.background = day ? daySkyTexture : nightSkyTexture;
  scene.environment = day ? daySkyTexture : nightSkyTexture;

  if (day) {
    dir.color.set(0xfff1d6); dir.intensity = 0.78; dir.position.copy(DAY_LIGHT_POS);
    dir.shadow.mapSize.set(4096, 4096); dir.shadow.bias = -0.00022; dir.shadow.normalBias = 0.014;
    dir.shadow.radius = 12; dir.shadow.blurSamples = 16; dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 110;
    dir.shadow.camera.left = -DAY_SHADOW_BOUNDS; dir.shadow.camera.right = DAY_SHADOW_BOUNDS;
    dir.shadow.camera.top = DAY_SHADOW_BOUNDS; dir.shadow.camera.bottom = -DAY_SHADOW_BOUNDS;
    sun.visible = true; moon.visible = false; sun.position.copy(dir.position);
    hemi.color.set(0xffffff); hemi.groundColor.set(0xcfd6e6); hemi.intensity = 0.26;
    setAmbientIntensity(0.24);
  } else {
    dir.color.set(0x90a9e6); dir.intensity = 0.26; dir.position.copy(NIGHT_LIGHT_POS);
    dir.shadow.mapSize.set(4096, 4096); dir.shadow.bias = -0.001; dir.shadow.normalBias = 0.03;
    dir.shadow.radius = 4; dir.shadow.blurSamples = 8; dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 140;
    dir.shadow.camera.left = -NIGHT_SHADOW_BOUNDS; dir.shadow.camera.right = NIGHT_SHADOW_BOUNDS;
    dir.shadow.camera.top = NIGHT_SHADOW_BOUNDS; dir.shadow.camera.bottom = -NIGHT_SHADOW_BOUNDS;
    sun.visible = false; moon.visible = true;
    hemi.color.set(0x0a1b2e); hemi.groundColor.set(0x02040a); hemi.intensity = 0.05;
    setAmbientIntensity(0.035);
  }
  dir.target.position.copy(SHADOW_TARGET_POS); dir.target.updateMatrixWorld(true);
  dir.shadow.camera.updateProjectionMatrix(); dir.shadow.needsUpdate = true;
  updateNightStreetlightShadowCasters(true);

  scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      if (!mat || mat.emissive === undefined) continue;
      const isStreetlightBulb = o.userData && o.userData._origEmissiveIntensity !== undefined;
      if (day) mat.emissiveIntensity = 0;
      else mat.emissiveIntensity = isStreetlightBulb ? (o.userData._origEmissiveIntensity || 1.2) : 0.8;
    }
  });

  const sLights = (scene.userData && scene.userData.streetLights) ? scene.userData.streetLights : [];
  for (const sl of sLights) {
    if (day) sl.intensity = 0;
    else if (sl.userData && typeof sl.userData._origIntensity === 'number') sl.intensity = sl.userData._origIntensity;
    else sl.intensity = 2.0;
    sl.visible = true;
  }
  const sMeshes = (scene.userData && scene.userData.streetLightMeshes) ? scene.userData.streetLightMeshes : [];
  for (const mesh of sMeshes) {
    mesh.visible = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat && mat.emissive !== undefined) {
        if (day) mat.emissiveIntensity = 0;
        else mat.emissiveIntensity = (mesh.userData && typeof mesh.userData._origEmissiveIntensity === 'number') ? mesh.userData._origEmissiveIntensity : 1;
      }
    }
  }
  const cones = (scene.userData && scene.userData.streetLightCones) ? scene.userData.streetLightCones : [];
  for (const cone of cones) {
    cone.visible = !day;
    const mats = Array.isArray(cone.material) ? cone.material : [cone.material];
    for (const mat of mats) {
      if (!mat || typeof mat.opacity !== 'number') continue;
      mat.opacity = day ? 0 : ((cone.userData && typeof cone.userData._origOpacity === 'number') ? cone.userData._origOpacity : 0.04);
      mat.transparent = mat.opacity < 1;
    }
  }
}

export function applyWeather(name) {
  const allowedWeather = new Set(['sunny', 'night', 'sunset', 'rainy', 'northern-lights', 'rainbow', 'snowy']);
  currentWeather = allowedWeather.has(name) ? name : 'sunny';
  hideSpecialEffects(); applyGroundTextureSet(grassGroundTex, false);
  
  switch (currentWeather) {
    case 'night':
      applyDayNight(false); scene.background = null; scene.environment = null; renderer.setClearColor(0x01030c);
      if (scene.fog) { scene.fog.color.set(0x030512); scene.fog.density = 0.0038; }
      setGradientSky(0x0d1a34, 0x070b18, 0x010106); ensureGradientSky().visible = true;
      ensureNightStars();
      break;
    case 'sunset':
      applyDayNight(true); scene.background = null; scene.environment = sunsetSkyTexture; renderer.setClearColor(0xe78852);
      if (scene.fog) { scene.fog.color.set(0xdd8a62); scene.fog.density = 0.0212; }
      dir.color.set(0xff9d5c); dir.intensity = 0.7; dir.position.set(-34, 24, 0);
      dir.shadow.bias = -0.00028; dir.shadow.normalBias = 0.02; dir.shadow.radius = 1.8; dir.shadow.blurSamples = 6;
      dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 120;
      dir.shadow.camera.left = -DAY_SHADOW_BOUNDS; dir.shadow.camera.right = DAY_SHADOW_BOUNDS;
      dir.shadow.camera.top = DAY_SHADOW_BOUNDS; dir.shadow.camera.bottom = -DAY_SHADOW_BOUNDS;
      dir.target.position.copy(SHADOW_TARGET_POS); dir.target.updateMatrixWorld(true);
      dir.shadow.camera.updateProjectionMatrix(); dir.shadow.needsUpdate = true;
      sun.visible = false; sun.position.copy(dir.position); moon.visible = false;
      hemi.color.set(0xffb98e); hemi.groundColor.set(0x5a3728); hemi.intensity = 0.7;
      setAmbientIntensity(0.17); ensureSunsetSkyDome().visible = true;
      break;
    case 'rainy':
      applyDayNight(true); scene.background = null; scene.environment = daySkyTexture; renderer.setClearColor(0x8599aa);
      if (scene.fog) { scene.fog.color.set(0x8ca0af); scene.fog.density = 0.0026; }
      setGradientSky(0x465d73, 0x72889a, 0xb8c7d2); ensureGradientSky().visible = true;
      dir.color.set(0xdde6ef); dir.intensity = 0.54; sun.visible = false; moon.visible = false;
      hemi.color.set(0xdce6ee); hemi.groundColor.set(0x5f6a74); hemi.intensity = 0.19;
      setAmbientIntensity(0.18); ensureRainSystem();
      break;
    case 'northern-lights':
      applyDayNight(false); scene.background = northernLightsSkyTexture; scene.environment = northernLightsSkyTexture;
      renderer.setClearColor(0x051020); if (scene.fog) { scene.fog.color.set(0x061625); scene.fog.density = 0.0032; }
      dir.color.set(0x95b1f2); dir.intensity = 0.24;
      hemi.color.set(0x9ed7e5); hemi.groundColor.set(0x07131d); hemi.intensity = 0.08;
      setAmbientIntensity(0.05); ensureAuroraGroup();
      break;
    case 'rainbow':
      applyDayNight(true); scene.background = null; scene.environment = daySkyTexture; renderer.setClearColor(0x8fdcff);
      if (scene.fog) { scene.fog.color.set(0xe7f5ff); scene.fog.density = 0.00055; }
      setGradientSky(0x79caff, 0xc1efff, 0xfff7fb); ensureGradientSky().visible = true;
      dir.color.set(0xfff6d8); dir.intensity = 0.7; dir.position.set(40, 42, -28);
      dir.target.position.copy(SHADOW_TARGET_POS); dir.target.updateMatrixWorld(true);
      dir.shadow.camera.updateProjectionMatrix(); dir.shadow.needsUpdate = true;
      sun.visible = true; sun.position.copy(dir.position); moon.visible = false;
      hemi.color.set(0xf8fbff); hemi.groundColor.set(0xe0d2ef); hemi.intensity = 0.34;
      setAmbientIntensity(0.3); ensureRainbowGroup().visible = true;
      break;
    case 'snowy':
      applyDayNight(true); scene.background = null; scene.environment = null; renderer.setClearColor(0xd8e4ef);
      if (scene.fog) { scene.fog.color.set(0xc8d7e6); scene.fog.density = 0.0042; }
      setGradientSky(0xb0bfd0, 0xd4e0ea, 0xf5f9ff); ensureGradientSky().visible = true;
      dir.color.set(0xf4f8ff); dir.intensity = 0.56; sun.visible = false; moon.visible = false;
      hemi.color.set(0xe8f3ff); hemi.groundColor.set(0xbfccd8); hemi.intensity = 0.24;
      setAmbientIntensity(0.2); applyGroundTextureSet(snowGroundTex, true);
      ensureSnowSystem();
      break;
    case 'sunny':
    default:
      applyDayNight(true); scene.background = null; scene.environment = daySkyTexture; renderer.setClearColor(0xa6d8ff);
      if (scene.fog) { scene.fog.color.set(0xcde6ff); scene.fog.density = 0.00075; }
      ensureDaySkyDome().visible = true; applyGroundTextureSet(grassGroundTex, false);
      break;
  }
  syncParticleDrivenEffects();
  if (_forestZone) _forestZone.setVariant(currentWeather === 'snowy' ? 'snowy' : 'default');
  scene.userData.currentWeather = currentWeather;
  markActiveWeather(currentWeather);
}

function hideSpecialEffects() {
  [gradientSky, daySkyDome, sunsetSkyDome, nightStars, rainSystem, snowSystem, auroraGroup, rainbowGroup].forEach(s => { if(s) s.visible = false; });
}

function syncParticleDrivenEffects() {
  if (nightStars) nightStars.visible = (currentWeather === 'night' && particlesEnabled);
  if (rainSystem) rainSystem.visible = (currentWeather === 'rainy' && particlesEnabled);
  if (snowSystem) snowSystem.visible = (currentWeather === 'snowy' && particlesEnabled);
  if (auroraGroup) auroraGroup.visible = (currentWeather === 'northern-lights' && particlesEnabled);
  if (rainbowGroup) rainbowGroup.visible = (currentWeather === 'rainbow' && particlesEnabled);
}

function markActiveWeather(name) {
  const weatherOptions = Array.from(document.querySelectorAll('.weather-option[data-weather]'));
  weatherOptions.forEach((btn) => {
    const active = btn.dataset.weather === name;
    btn.classList.toggle('active', active); btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateRainStreaks(system, elapsed, dt, followPos) {
  if (!system || !system.visible) return;
  system.position.set(followPos.x, Math.max(0, followPos.y - 1.25), followPos.z);
  const data = system.userData;
  const halfW = data.width * 0.5; const halfD = data.depth * 0.5;
  for (let i = 0; i < data.speeds.length; i++) {
    const idx = i * 3; const drift = Math.sin(elapsed * 3.1 + data.phase[i]) * 0.28;
    data.offsets[idx] += (data.windX + drift) * dt;
    data.offsets[idx + 2] += data.windZ * dt;
    data.offsets[idx + 1] -= data.speeds[i] * dt;
    if (data.offsets[idx] > halfW) data.offsets[idx] -= data.width;
    if (data.offsets[idx] < -halfW) data.offsets[idx] += data.width;
    if (data.offsets[idx + 2] > halfD) data.offsets[idx + 2] -= data.depth;
    if (data.offsets[idx + 2] < -halfD) data.offsets[idx + 2] += data.depth;
    if (data.offsets[idx + 1] < 0) {
      data.offsets[idx + 1] = data.height;
      data.offsets[idx] = (Math.random() - 0.5) * data.width;
      data.offsets[idx + 2] = (Math.random() - 0.5) * data.depth;
      data.phase[i] = Math.random() * Math.PI * 2;
    }
    rainDummy.position.set(data.offsets[idx], data.offsets[idx + 1], data.offsets[idx + 2]);
    rainDummy.rotation.set(data.tilts[i * 2], 0, data.tilts[i * 2 + 1] + Math.sin(elapsed * 2.1 + data.phase[i]) * 0.045);
    rainDummy.scale.set(1, data.scales[i], 1);
    rainDummy.updateMatrix();
    system.setMatrixAt(i, rainDummy.matrix);
  }
  system.instanceMatrix.needsUpdate = true;
}

function updateSnowParticles(system, elapsed, dt, followPos) {
  if (!system || !system.visible) return;
  system.position.set(followPos.x, Math.max(0, followPos.y - 1.2), followPos.z);
  const data = system.userData; const positions = system.geometry.attributes.position.array;
  const halfW = data.width * 0.5; const halfD = data.depth * 0.5;
  for (let i = 0; i < data.speeds.length; i++) {
    const idx = i * 3; const drift = Math.sin(elapsed * 0.9 + data.phase[i]) * data.sway[i];
    const driftZ = Math.cos(elapsed * 0.65 + data.phase[i]) * data.sway[i] * 0.4;
    positions[idx] += (data.windX + drift) * dt;
    positions[idx + 2] += (data.windZ + driftZ) * dt;
    positions[idx + 1] -= data.speeds[i] * dt;
    if (positions[idx] > halfW) positions[idx] -= data.width;
    if (positions[idx] < -halfW) positions[idx] += data.width;
    if (positions[idx + 2] > halfD) positions[idx + 2] -= data.depth;
    if (positions[idx + 2] < -halfD) positions[idx + 2] += data.depth;
    if (positions[idx + 1] < 0) {
      positions[idx + 1] = data.height;
      positions[idx] = (Math.random() - 0.5) * data.width;
      positions[idx + 2] = (Math.random() - 0.5) * data.depth;
      data.phase[i] = Math.random() * Math.PI * 2;
    }
  }
  system.geometry.attributes.position.needsUpdate = true;
}

function updateAurora(elapsed, followPos) {
  if (!auroraGroup || !auroraGroup.visible) return;
  auroraGroup.position.set(followPos.x, 0, followPos.z + 16);
  for (let i = 0; i < auroraGroup.userData.ribbons.length; i++) {
    const ribbon = auroraGroup.userData.ribbons[i];
    ribbon.position.x = ribbon.userData.baseX + Math.sin(elapsed * 0.16 + ribbon.userData.phase) * 3.6;
    ribbon.position.y = ribbon.userData.baseY + Math.sin(elapsed * 0.22 + ribbon.userData.phase) * 0.68;
    ribbon.rotation.z = Math.sin(elapsed * 0.12 + ribbon.userData.phase) * 0.04;
    ribbon.material.uniforms.time.value = elapsed * (0.92 + i * 0.03);
    ribbon.material.uniforms.opacity.value = ribbon.userData.opacityBase + Math.sin(elapsed * 0.45 + ribbon.userData.phase) * 0.05;
  }
}

function updateRainbow(elapsed, followPos) {
  if (!rainbowGroup || !rainbowGroup.visible) return;
  rainbowGroup.position.set(followPos.x, 0, followPos.z);
  for (let i = 0; i < rainbowGroup.userData.bands.length; i++) {
    const band = rainbowGroup.userData.bands[i];
    band.position.x = band.userData.baseX + Math.sin(elapsed * 0.12 + band.userData.phase) * 1.4;
    band.position.y = band.userData.baseY + Math.sin(elapsed * 0.34 + band.userData.phase) * 0.22;
    band.material.emissiveIntensity = 0.24 + Math.sin(elapsed * 0.45 + band.userData.phase) * 0.05;
    const glow = rainbowGroup.userData.glows[i];
    if (glow) {
      glow.position.x = glow.userData.baseX + Math.sin(elapsed * 0.12 + glow.userData.phase) * 1.4;
      glow.position.y = glow.userData.baseY + Math.sin(elapsed * 0.34 + glow.userData.phase) * 0.22;
      glow.material.opacity = glow.userData.baseOpacity + Math.sin(elapsed * 0.45 + glow.userData.phase) * 0.035;
    }
  }
}

export function updateWeather(elapsed, dt) {
  const followPos = _controls?.getObject()?.position || camera.position;
  if (gradientSky?.visible) gradientSky.position.copy(followPos);
  if (daySkyDome?.visible) daySkyDome.position.copy(followPos);
  if (sunsetSkyDome?.visible) sunsetSkyDome.position.copy(followPos);
  if (nightStars?.visible) {
    nightStars.position.set(followPos.x, 0, followPos.z);
    nightStars.userData.layers.forEach(layer => {
      layer.material.opacity = layer.baseOpacity + Math.sin(elapsed * layer.pulseSpeed + layer.pulseOffset) * 0.16;
    });
  }
  if (rainSystem?.visible && particlesEnabled) updateRainStreaks(rainSystem, elapsed, dt, followPos);
  if (snowSystem?.visible && particlesEnabled) updateSnowParticles(snowSystem, elapsed, dt, followPos);
  if (auroraGroup?.visible && particlesEnabled) updateAurora(elapsed, followPos);
  if (rainbowGroup?.visible) updateRainbow(elapsed, followPos);
}
