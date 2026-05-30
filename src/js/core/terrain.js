/**
 * TERRAIN & TEXTURE SYSTEM
 * 
 * Manages terrain textures and materials:
 * - Loads physically-based material texture sets (PBR)
 * - Applies proper texture wrapping and repetition
 * - Configures texture anisotropy for visual quality
 * - Handles color space conversion for accuracy
 * - Supports multiple terrain types (grass, snow, etc.)
 */

import * as THREE from 'three';
import { renderer } from './engine.js';

// ---------------------------------------------------------------------------
// TERRAIN TEXTURE LOADING
// ---------------------------------------------------------------------------
/**
 * Creates a complete physically-based material texture set for terrain.
 * Loads all required textures (color, normal, roughness, bump, ambient occlusion)
 * and configures them for proper tiling and quality.
 * 
 * @param {string} textureBasePath - Base path to texture files (without suffix)
 * @param {number} repeat - How many times to repeat texture (default 30)
 * @returns {Object} Object containing all configured textures: {map, normal, roughness, bump, ao}
 */
export function makeTerrainTextureSet(textureBasePath, repeat = 30) {
  const loader = new THREE.TextureLoader();

  /**
   * Configures individual texture with proper wrapping and color space.
   * @param {THREE.Texture} tex - Texture to configure
   * @param {boolean} isColor - Whether this is a color texture (needs sRGB)
   * @returns {THREE.Texture} Configured texture
   */
  function setup(tex, isColor = false) {
    // Enable texture tiling/wrapping
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat); // Set repetition count
    // Use maximum anisotropy for sharp texture display
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // Apply proper color space for color textures
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Load all texture maps for physically-based rendering
  const map = setup(loader.load(`${textureBasePath}_Color.jpg`), true); // Albedo/color
  const normal = setup(loader.load(`${textureBasePath}_NormalGL.jpg`)); // Normal map for surface detail
  const roughness = setup(loader.load(`${textureBasePath}_Roughness.jpg`)); // Roughness map
  const bump = setup(loader.load(`${textureBasePath}_Displacement.jpg`)); // Displacement/height map
  const ao = setup(loader.load(`${textureBasePath}_AmbientOcclusion.jpg`)); // Ambient occlusion

  return { map, normal, roughness, bump, ao };
}
