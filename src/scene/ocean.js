import * as THREE from 'three';
import { SHORE_Z } from './terrain.js';

const VERT = /* glsl */ `
  uniform float uTime; uniform float uWaves;
  varying vec3 vWorld; varying vec3 vNormalW; varying float vDepth; varying float vCrest;
  #include <fog_pars_vertex>

  // Waves roll toward the shore (-z). Each: direction, wavelength, amplitude, speed.
  vec3 wave(vec2 p, vec2 dir, float len, float amp, float spd, inout vec3 n){
    float k = 6.2831 / len;
    float f = k * dot(dir, p) + uTime * spd;
    float a = amp;
    n.x -= dir.x * k * a * cos(f);
    n.z -= dir.y * k * a * cos(f);
    return vec3(0.0, a * sin(f), 0.0);
  }

  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float ground = -max(wp.z - ${SHORE_Z.toFixed(2)}, 0.0) * 0.085;
    float shoal = smoothstep(0.0, 1.6, -ground);
    float amp = mix(0.035, 0.3, uWaves * uWaves) * mix(0.35, 1.0, shoal);
    vec3 n = vec3(0.0, 1.0, 0.0);
    vec2 p = wp.xz;
    vec3 d = vec3(0.0);
    d += wave(p, normalize(vec2(0.12, -1.0)), 16.0, amp * 0.6, 0.95, n);
    d += wave(p, normalize(vec2(-0.3, -1.0)), 10.0, amp * 0.32, 1.25, n);
    d += wave(p, normalize(vec2(0.55, -0.8)), 6.5, amp * 0.14 * uWaves, 1.6, n);
    // The run-up: water climbs the sand and slides back.
    float surge = (0.05 + 0.11 * uWaves) * (sin(uTime * 0.62 + wp.x * 0.045) * 0.5 + 0.5) * (1.0 - smoothstep(0.0, 1.3, -ground));
    wp.y += d.y + surge;
    vCrest = d.y / max(amp, 0.001);
    vDepth = wp.y - ground;
    vWorld = wp.xyz;
    vNormalW = normalize(n);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
