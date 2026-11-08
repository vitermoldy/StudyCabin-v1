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

export class Ripples {
  constructor(renderer) {
    this.renderer = renderer;
    this.ok = false;
    const gl = renderer.getContext();
    // three.js is WebGL 2 only now; float targets still need this extension.
    const canFloat = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    if (!canFloat) return;
    const opts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.a = new THREE.WebGLRenderTarget(RES, RES, opts);
    this.b = new THREE.WebGLRenderTarget(RES, RES, opts);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.dropMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uCenter: { value: new THREE.Vector2() }, uRadius: { value: 0.02 }, uStrength: { value: 0.5 } },
      vertexShader: QUAD_VERT,
      fragmentShader: DROP_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.updateMat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: null },
        uDelta: { value: new THREE.Vector2(1 / RES, 1 / RES) },
        uZ0: { value: RIPPLE_AREA.z0 },
        uSize: { value: RIPPLE_AREA.size },
        uShore: { value: SHORE_Z },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: UPDATE_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.queue = [];
    this.ok = true;
    // Start flat.
    const prev = renderer.getRenderTarget();
    for (const t of [this.a, this.b]) {
      renderer.setRenderTarget(t);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
    }
    renderer.setRenderTarget(prev);
  }
}
