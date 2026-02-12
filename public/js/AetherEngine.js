import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';

// COMPLEX FBM FLUID SHADER
const FLUID_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform float uHeat; 
uniform float uVolatility;
uniform float uShockwave;
varying vec2 vUv;

// Simplex Noise (Ashima)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){ const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v -   i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }

float fbm(vec2 st) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < 5; i++) {
        v += a * snoise(st);
        st = rot * st * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 st = vUv * 3.0;
    
    // Convection / Rising Heat
    float rise = uTime * (0.2 + (uHeat * 0.001));
    vec2 q = vec2(0.);
    q.x = fbm( st + vec2(0.0, -rise) );
    q.y = fbm( st + vec2(5.2, 1.3 - rise) );

    // Warping based on Volatility
    vec2 r = vec2(0.);
    float chaos = uVolatility * 0.1;
    r.x = fbm( st + 4.0*q + vec2(uTime * chaos) );
    r.y = fbm( st + 4.0*q + vec2(uTime * 0.2) );

    float f = fbm( st + 4.0*r );
    
    // Shockwave expansion
    float shock = 0.0;
    if (uShockwave > 0.01) {
        float d = length(vUv - 0.5);
        shock = smoothstep(uShockwave - 0.1, uShockwave, d) * (1.0 - smoothstep(uShockwave, uShockwave + 0.05, d));
    }

    // Color logic
    vec3 col = uColor * (f * f * 3.0 + 0.2); // Base Contrast
    
    // High heat turns center white
    if (uHeat > 500.0) col += vec3(0.5) * smoothstep(0.4, 0.9, f); 
    
    col += vec3(1.0) * shock * 5.0; // White shockwave ring

    float alpha = smoothstep(0.2, 0.8, f + (shock*2.0));
    gl_FragColor = vec4(col, alpha);
}
`;

const RAD_FRAG = `
uniform sampler2D tDiffuse;
uniform float uRad;
uniform float uTime;
varying vec2 vUv;
float rand(vec2 co){return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);}
void main() {
    vec2 uv = vUv;
    if (uRad > 0.1) {
        // Geiger glitch
        float block = floor(uv.y * 30.0);
        float shift = (rand(vec2(block, floor(uTime * 20.0))) - 0.5) * 0.02 * uRad;
        
        // Chromatic Aberration
        float r = texture2D(tDiffuse, uv + vec2(shift + 0.005 * uRad, 0.0)).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - vec2(shift + 0.005 * uRad, 0.0)).b;
        gl_FragColor = vec4(r,g,b,1.0);
    } else {
        gl_FragColor = texture2D(tDiffuse, uv);
    }
}
`;

export default class AetherEngine {
    constructor(domId) {
        this.container = document.getElementById(domId);
        this.w = this.container.clientWidth;
        this.h = this.container.clientHeight;
        
        // Scene Setup
        this.scene = new THREE.Scene();
        this.cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
        this.ren = new THREE.WebGLRenderer({alpha:true, powerPreference:"high-performance"});
        this.ren.setSize(this.w, this.h);
        this.ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.ren.domElement);
        
        // Shader Material
        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0x000000) },
                uHeat: { value: 20 },
                uVolatility: { value: 0.1 },
                uShockwave: { value: 0.0 }
            },
            vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}",
            fragmentShader: FLUID_FRAG,
            transparent: true
        });
        
        this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.mat));
        
        // Post Processing
        this.composer = new EffectComposer(this.ren);
        this.composer.addPass(new RenderPass(this.scene, this.cam));
        
        this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 1.5, 0.4, 0.85);
        this.composer.addPass(this.bloom);
        
        this.radPass = new ShaderPass({
            uniforms: { tDiffuse: {value: null}, uRad: {value: 0}, uTime: {value:0}},
            vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}",
            fragmentShader: RAD_FRAG
        });
        this.composer.addPass(this.radPass);
        
        this.animate();
        window.addEventListener('resize', ()=>this.resize());
    }

    update(phys) {
        const u = this.mat.uniforms;
        
        // Use Animation Frames for Lerp outside in main app, or direct set here
        // We will directly set targets and simple ease in render loop
        this.targets = phys;

        // Shockwave trigger
        if(phys.shockwave > 0) {
            this.swTimer = 0;
            this.swActive = true;
        }
    }

    animate() {
        requestAnimationFrame(()=>this.animate());
        const t = performance.now() * 0.001;
        
        // Uniform Updaters
        this.mat.uniforms.uTime.value = t;
        this.radPass.uniforms.uTime.value = t;

        // Smooth Interpolation towards targets
        if(this.targets) {
            const ease = 0.05;
            this.mat.uniforms.uHeat.value += (this.targets.temp - this.mat.uniforms.uHeat.value) * ease;
            this.mat.uniforms.uVolatility.value += (this.targets.volatility - this.mat.uniforms.uVolatility.value) * ease;
            this.mat.uniforms.uColor.value.lerp(new THREE.Color(this.targets.color), ease);
            this.radPass.uniforms.uRad.value += (this.targets.radiation - this.radPass.uniforms.uRad.value) * ease;
            
            // Adjust Bloom based on Heat
            this.bloom.strength = (this.mat.uniforms.uHeat.value / 200.0) + (this.targets.radiation * 0.5);
        }

        // Handle Shockwave Animation
        if(this.swActive) {
            this.swTimer += 0.02;
            this.mat.uniforms.uShockwave.value = this.swTimer;
            if(this.swTimer > 2.0) {
                this.swActive = false; 
                this.mat.uniforms.uShockwave.value = 0;
            }
        }
        
        this.composer.render();
    }
    
    resize() {
        this.w = this.container.clientWidth;
        this.h = this.container.clientHeight;
        this.ren.setSize(this.w, this.h);
        this.composer.setSize(this.w, this.h);
    }
}
