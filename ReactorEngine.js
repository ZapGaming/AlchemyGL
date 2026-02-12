import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// --- THE CORE SHADER (Simulating Fluid, Fire, and Radiation) ---
const CoreSimulationShader = {
    uniforms: {
        tDiffuse: { value: null }, // Previous frame (optional for fluid ping-pong)
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        
        // Dynamic Chemical Properties
        uBaseColor: { value: new THREE.Color(0.0, 0.0, 0.0) },
        uAccentColor: { value: new THREE.Color(0.0, 0.0, 0.0) },
        uHeat: { value: 0.0 },
        uDensity: { value: 0.0 },
        uVolatility: { value: 0.0 },
        uRadiation: { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec3 uBaseColor;
        uniform vec3 uAccentColor;
        uniform float uHeat;
        uniform float uDensity;
        uniform float uVolatility;
        uniform float uRadiation;

        varying vec2 vUv;

        // --- GLSL NOISE FUNCTIONS (The Physics Engine) ---
        // Efficient simplex noise for flow simulation
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) { 
            const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i); 
            vec4 p = permute( permute( permute( 
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                          dot(p2,x2), dot(p3,x3) ) );
        }

        // Domain warping: Allows fluid to "swirl" into itself
        float fbm(vec3 x) {
            float v = 0.0;
            float a = 0.5;
            vec3 shift = vec3(100.0);
            for (int i = 0; i < 5; ++i) {
                v += a * snoise(x);
                x = x * 2.0 + shift;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec2 st = vUv;
            
            // PHYSICS 1: Density & Scale
            float scale = 3.0 + (uDensity * 2.0); 
            vec2 p = st * scale;

            // PHYSICS 2: Heat (Upward flow speed)
            float flowSpeed = uTime * (0.2 + uHeat * 0.5);
            
            // PHYSICS 3: Volatility (Chaotic X/Y movement)
            float chaos = uTime * uVolatility;

            // WARPING: Create the fluid smoke shape
            vec2 q = vec2(0.);
            q.x = fbm( vec3(p + chaos, flowSpeed) );
            q.y = fbm( vec3(p + vec2(5.2,1.3), flowSpeed) );

            vec2 r = vec2(0.);
            r.x = fbm( vec3(p + 4.0*q + vec2(1.7,9.2), flowSpeed) );
            r.y = fbm( vec3(p + 4.0*q + vec2(8.3,2.8), flowSpeed) );

            // This calculates the final "Shape" of the reaction
            float f = fbm( vec3(p + 4.0*r, flowSpeed) );

            // COLOR & LIGHT
            // Mixing the colors based on density 'f'
            vec3 col = mix(uBaseColor, uAccentColor, clamp(f*f*4.0, 0.0, 1.0));
            
            // FLAME CORE Logic: High heat makes center white
            col = mix(col, vec3(1.0), smoothstep(0.9, 1.0, f*uHeat)); 

            // PHYSICS 4: RADIATION (Glitch Effect)
            // If uRadiation is high, scramble pixel lines randomly
            if(uRadiation > 0.5) {
                float glitch = step(0.98, snoise(vec3(vUv.y * 100.0, uTime * 20.0, 0.0)));
                col += vec3(glitch) * vec3(0.0, 1.0, 0.0); // Green glitch lines
                // Chromatic abberation shift
                float noiseRad = snoise(vec3(st * 10.0, uTime));
                col.r += noiseRad * uRadiation * 0.05;
            }

            // Alpha handling for embedding
            float alpha = smoothstep(0.1, 0.9, f + 0.1 * uDensity);
            
            gl_FragColor = vec4(col * (uHeat * 0.8 + 0.5), alpha);
        }
    `
};

export default class ChemicalRenderServer {
    constructor(domId) {
        this.container = document.getElementById(domId);
        
        // 1. Core Scene Setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // 2. High-Performance GPU Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            powerPreference: 'high-performance' 
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Retain quality
        this.container.appendChild(this.renderer.domElement);

        // 3. The Chemistry Mesh (The "Screen" for our reaction)
        const geometry = new THREE.PlaneGeometry(2, 2);
        
        this.reactionMaterial = new THREE.ShaderMaterial({
            vertexShader: CoreSimulationShader.vertexShader,
            fragmentShader: CoreSimulationShader.fragmentShader,
            uniforms: THREE.UniformsUtils.clone(CoreSimulationShader.uniforms),
            transparent: true,
            blending: THREE.AdditiveBlending // Makes fire look light-based
        });
        
        const mesh = new THREE.Mesh(geometry, this.reactionMaterial);
        this.scene.add(mesh);

        // 4. POST-PROCESSING (The "Movie" Graphics)
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Bloom: Adds the glow to hot/radioactive parts
        // threshold, strength, radius
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight), 
            1.5, 0.4, 0.85
        );
        this.composer.addPass(this.bloomPass);

        // Bind Resize
        window.addEventListener('resize', this.onResize.bind(this));

        // Current Physics State
        this.currentState = { ...CoreSimulationShader.uniforms }; // Helper copy
    }

    /**
     * MIX A CHEMICAL
     * Smoothly interpolates (physics blend) between current state and target chemical
     */
    mix(chemicalData, speed = 1.0) {
        const mat = this.reactionMaterial.uniforms;
        const target = chemicalData;

        // Uses a Tween engine ideally, but using direct interpolation loop for simplicity
        const animateProp = (uniformName, targetVal, color=false) => {
            const startVal = mat[uniformName].value;
            let progress = 0;
            
            const step = () => {
                progress += 0.01 * speed;
                if(progress > 1) progress = 1;
                
                const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                if (color) {
                    mat[uniformName].value.lerp(new THREE.Color(targetVal), 0.05 * speed);
                } else {
                    // Simple Lerp
                    mat[uniformName].value = startVal + (targetVal - startVal) * ease;
                }

                if(progress < 1) requestAnimationFrame(step);
            }
            step();
        }

        // Trigger updates
        animateProp('uHeat', target.heat);
        animateProp('uDensity', target.density);
        animateProp('uVolatility', target.volatility);
        animateProp('uRadiation', target.radiation);
        animateProp('uBaseColor', target.baseColor, true);
        animateProp('uAccentColor', target.accentColor, true);

        // Adjust Camera Bloom based on Radiation/Heat
        const bloomTarget = (target.heat + target.radiation) * 0.8;
        this.bloomPass.strength = bloomTarget; // Immediate or tweened
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.reactionMaterial.uniforms.uResolution.value.set(width, height);
    }

    render() {
        this.reactionMaterial.uniforms.uTime.value += 0.01;
        // Post-processing render chain
        this.composer.render();
        requestAnimationFrame(this.render.bind(this));
    }

    start() {
        this.render();
    }
}
