import * as THREE from 'three';

/** Uniforms every outdoor material shares; the scene writes them each frame. */
export const WORLD = {
  uSnow: { value: 0 }, // 0..1 snow cover
  uWet: { value: 0 }, // 0..1 rain on surfaces
  uTime: { value: 0 },
  uWind: { value: 0.3 },
};

/**
 * Outdoor surfaces: snow settles on faces that look up, rain darkens and
 * shines them. `snow` scales how much snow this surface holds.
 */
export function weathered(material, { snow = 1, wet = 1 } = {}) {
  const local = { uSnowScale: { value: snow }, uWetScale: { value: wet } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = WORLD.uSnow;
    shader.uniforms.uWet = WORLD.uWet;
    shader.uniforms.uSnowScale = local.uSnowScale;
    shader.uniforms.uWetScale = local.uWetScale;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vUpness;')
      .replace(
        '#include <defaultnormal_vertex>',
        '#include <defaultnormal_vertex>\n vUpness = inverseTransformDirection(transformedNormal, viewMatrix).y;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vUpness;\nuniform float uSnow; uniform float uWet; uniform float uSnowScale; uniform float uWetScale;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float snowAmt = clamp(uSnow * uSnowScale * smoothstep(0.3, 0.75, vUpness), 0.0, 1.0);
        diffuseColor.rgb *= 1.0 - uWet * uWetScale * 0.24;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.9, 0.92), snowAmt);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, uWet * uWetScale);
        roughnessFactor = mix(roughnessFactor, 0.85, snowAmt);`,
      );
  };
  material.userData.weathered = local;
  return material;
}

export function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
}
