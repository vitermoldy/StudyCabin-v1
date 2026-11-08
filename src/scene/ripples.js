import * as THREE from 'three';
import { SHORE_Z } from './terrain.js';

// A height-field ripple simulation on the GPU, after Evan Wallace's WebGL Water
// (madebyevan.com/webgl-water): every texel keeps a height and a velocity, each
// step pulls it toward the average of its neighbours, and drops push it down.
// It covers the water in front of the cabin; the ocean shader reads it for
// normals, so pointer drags and raindrops leave rings on the surface.

export const RIPPLE_AREA = { x0: -36, z0: SHORE_Z - 1, size: 72 };
const RES = 256;

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DROP_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex; uniform vec2 uCenter; uniform float uRadius; uniform float uStrength;
  varying vec2 vUv;
  void main(){
    vec4 info = texture2D(uTex, vUv);
    float d = max(0.0, 1.0 - length(uCenter - vUv) / uRadius);
    d = 0.5 - cos(d * 3.14159265) * 0.5;
    info.r -= d * uStrength;
    gl_FragColor = info;
  }
`;

const UPDATE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex; uniform vec2 uDelta; uniform float uZ0; uniform float uSize; uniform float uShore;
  varying vec2 vUv;
  void main(){
    vec4 info = texture2D(uTex, vUv);
    vec2 dx = vec2(uDelta.x, 0.0);
    vec2 dy = vec2(0.0, uDelta.y);
    float average = (texture2D(uTex, vUv - dx).r + texture2D(uTex, vUv - dy).r + texture2D(uTex, vUv + dx).r + texture2D(uTex, vUv + dy).r) * 0.25;
    info.g += (average - info.r) * 2.0;
    info.g *= 0.992;
    info.r += info.g;
    // Rings die out on the sand and at the edges of the simulated patch.
    float z = uZ0 + vUv.y * uSize;
    float wet = smoothstep(uShore + 0.2, uShore + 1.4, z);
    float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x) * smoothstep(1.0, 0.94, vUv.y);
    info.rg *= mix(0.0, 1.0, wet) * mix(0.96, 1.0, edge);
    gl_FragColor = info;
  }
`;
