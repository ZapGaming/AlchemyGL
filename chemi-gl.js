/* chemi-gl.js - v1.0.0 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';

// --- BUILT-IN SHADERS (The GPU Logic) ---
const FLUID_SHADER = {
    vertex: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragment: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uMixRatio;
        uniform float uHeat; 
        uniform float uViscosity;
        uniform float uRadioactivity; // 0.0 to 1.0
        
        varying vec2 vUv;

        // Fast Simplex Noise (Ashima Arts)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v){
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ; m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        void main() {
            vec2 st = vUv;
            // Physical displacement based on viscosity (slower = more viscous)
            float flow = uTime * (0.5 + uHeat);
            float noise = snoise((st * (3.0 + uHeat)) - vec2(0, flow));
            
            // FBM for detailed smoke/fluid
            float n2 = snoise((st * 10.0) + vec2(uTime, 0));
            noise += n2 * 0.2;

            // Chemical Core Mixing
            float mixMap = smoothstep(0.3, 0.7, uMixRatio + noise * 0.2);
            vec3 fluidColor = mix(uColorA, uColorB, mixMap);
            
            // Thermal Intensity (Blue Fire Logic)
            if (uHeat > 1.5) {
                // If SUPER HOT, shift center to white/blue plasma
                float core = smoothstep(0.4, 0.8, noise);
                fluidColor += vec3(0.2, 0.5, 1.0) * core * uHeat; 
            } else if (uHeat > 0.5) {
                // Standard combustion
                float core = smoothstep(0.5, 0.8, noise);
                fluidColor += vec3(1.0, 0.4, 0.1) * core * uHeat;
            }

            // Radioactivity (The "Digital Rot" effect)
            if (uRadioactivity > 0.1) {
                float radNoise = snoise(vec2(st.y * 50.0, uTime * 20.0));
                if(radNoise > 0.8 / uRadioactivity) {
                     fluidColor = vec3(0.1, 1.0, 0.1); // Green pixel glitch
                }
            }

            // Calculate Alpha
            float alpha = smoothstep(0.2, 0.6, noise + uMixRatio);
            
            gl_FragColor = vec4(fluidColor, alpha);
        }
    `
};

export default class ChemiGL {
    constructor(config = {}) {
        this.containerId = config.container || 'chemical-canvas';
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) throw new Error("ChemiGL: Container ID not found");

        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        
        // DEFAULT STATE
        this.activeA = { r:0, g:0, b:0 }; // Empty
        this.activeB = { r:0, g:0, b:0 }; // Empty
        this.currentPhysics = {
            mix: 0,
            heat: 0,
            viscosity: 1,
            radiation: 0
        };

        this.init();
    }

    init() {
        // Three.js Setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        this.renderer = new THREE.WebGLRenderer({ alpha: true, powerPreference: "high-performance" });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Fluid Mesh
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.material = new THREE.ShaderMaterial({
            vertexShader: FLUID_SHADER.vertex,
            fragmentShader: FLUID_SHADER.fragment,
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(this.width, this.height) },
                uColorA: { value: new THREE.Color(0x000000) },
                uColorB: { value: new THREE.Color(0x000000) },
                uMixRatio: { value: 0.0 },
                uHeat: { value: 0.0 },
                uViscosity: { value: 1.0 },
                uRadioactivity: { value: 0.0 }
            },
            transparent: true,
            blending: THREE.NormalBlending
        });

        this.scene.add(new THREE.Mesh(geometry, this.material));

        // Post Processing Pipeline
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Glow Pass (Unreal Bloom)
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 1.5, 0.4, 0.85);
        this.bloomPass.strength = 0; // Default off
        this.composer.addPass(this.bloomPass);

        this.startLoop();
        
        window.addEventListener('resize', () => {
             this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        });
    }

    /**
     * Define the chemical physics properties
     */
    static Chemical(colorHex, props = {}) {
        return {
            color: new THREE.Color(colorHex),
            heat: props.heat || 0.1,         // 0.0 (ice) to 5.0 (plasma)
            viscosity: props.viscosity || 1.0, // 0.1 (gas) to 5.0 (tar)
            radioactivity: props.radiation || 0.0
        };
    }

    /**
     * Inject Chemicals into the engine
     * @param {Object} chem1 - Primary Chemical (The "Pool")
     * @param {Object} chem2 - Secondary Chemical (The "Reactor")
     * @param {Float} mixLevel - 0.0 to 1.0 how mixed they are
     */
    mix(chem1, chem2, mixLevel = 0.5) {
        // Color transition
        this.material.uniforms.uColorA.value.lerp(chem1.color, 0.05);
        this.material.uniforms.uColorB.value.lerp(chem2.color, 0.05);
        
        // Physics Calculation
        // Exothermic/Endothermic logic: 
        // If High Heat meets High Radiation => Runaway reaction
        const combinedHeat = (chem1.heat + chem2.heat) / 2 + (chem1.radioactivity * chem2.heat); 
        const combinedRad = Math.max(chem1.radioactivity, chem2.radioactivity);
        
        this.targetPhysics = {
            mix: mixLevel,
            heat: combinedHeat,
            viscosity: (chem1.viscosity + chem2.viscosity) / 2,
            radiation: combinedRad
        };
    }

    // Call this to simulate a reaction occurring over time (e.g. 2 seconds)
    react(duration = 2000) {
        const start = Date.now();
        const initial = { ...this.currentPhysics };

        const loop = () => {
            const now = Date.now();
            const p = Math.min((now - start) / duration, 1.0);
            
            // Cubic Easing
            const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

            this.currentPhysics.mix = initial.mix + (this.targetPhysics.mix - initial.mix) * ease;
            this.currentPhysics.heat = initial.heat + (this.targetPhysics.heat - initial.heat) * ease;
            this.currentPhysics.radiation = initial.radiation + (this.targetPhysics.radiation - initial.radiation) * ease;
            
            // Apply to Shaders
            this.material.uniforms.uMixRatio.value = this.currentPhysics.mix;
            this.material.uniforms.uHeat.value = this.currentPhysics.heat;
            this.material.uniforms.uRadioactivity.value = this.currentPhysics.radiation;
            
            // Adjust Bloom based on Heat
            this.bloomPass.strength = this.currentPhysics.heat * 0.8 + (this.currentPhysics.radiation * 1.5);

            if (p < 1) requestAnimationFrame(loop);
        };
        loop();
    }

    startLoop() {
        this.material.uniforms.uTime.value += 0.01;
        this.composer.render();
        requestAnimationFrame(() => this.startLoop());
    }
}
