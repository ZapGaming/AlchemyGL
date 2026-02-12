import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/* --- THE PHYSICALLY BASED VOLUMETRIC SHADER --- */
const VOLUME_FRAG = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uDensity;
uniform float uExpansion;
uniform float uGlow;
uniform float uLiquidType; // 0=Liq, 1=Foam, 2=Cycle
uniform vec2 uMouse;

varying vec2 vUv;

// --- MATH LIB ---
mat2 rot(float a) { float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }

// 3D Noise (The "Chemical Soup")
float hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7, 74.7)))*43758.5453123); }
float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

// Fractal Brownian Motion (Detail)
float fbm(vec3 p) {
    float v=0.0; float a=0.5;
    mat2 r = rot(0.5);
    for(int i=0; i<4; i++) {
        p.xy *= r; // Domain Rotation for swirl
        v += a * noise(p); p*=2.0; a*=0.5;
    }
    return v;
}

// SIGNED DISTANCE FIELD: The Glass Container
float sdCylinder(vec3 p, vec3 c) {
  return length(p.xz-c.xy)-c.z;
}

// VOLUMETRIC DENSITY FUNCTION
float map(vec3 p) {
    // 1. Boundary (Invisible Test Tube Cylinder)
    float container = sdCylinder(p, vec3(0.0, 0.0, 1.2)); 
    
    // 2. The Liquid/Foam Internal Movement
    vec3 q = p;
    q.y -= uTime * 0.5 * uExpansion; // Rising bubbles/foam
    
    // Flow simulation via FBM
    float flow = fbm(q * (1.0 + uDensity) + vec3(0.0, uTime, 0.0));
    
    // Create the "Surface"
    float d = max(container, abs(p.y) - 1.5); // Cap height
    
    // Modify density based on reaction
    float dense = flow;
    if(uLiquidType > 0.5) { // Foam Mode
        dense = (dense - 0.2) * 5.0; // Sharp thresholds for bubbles
    } else { // Liquid Mode
        dense = smoothstep(0.3, 0.8, dense); // Smooth mixing
    }
    
    return dense * (step(d, 0.0)); // Clip to container
}

// RAYMARCHING ALGORITHM
vec4 raymarch(vec3 ro, vec3 rd) {
    float totalD = 0.0;
    vec3 accumCol = vec3(0.0);
    float transmissivity = 1.0; // Light passing through
    
    float t = 0.5; // Start near clip
    for(int i=0; i<64; i++) { // Quality Iterations
        vec3 p = ro + rd * t;
        
        // Is ray inside container box? (Optimization)
        if(abs(p.y) > 2.0 || length(p.xz) > 1.3) {
            t += 0.1; continue; 
        }

        // Get Chemical Density
        float dens = map(p);
        
        if(dens > 0.01) {
            // BEER'S LAW: Light Absorbtion based on density
            float absorption = dens * 0.2 * uDensity;
            transmissivity *= (1.0 - absorption);
            
            // LIGHTING SCATTERING (Inside the fluid)
            // Color Interpolation (Chemical Mixing)
            vec3 fluidColor = mix(uColorA, uColorB, dens + sin(uTime + p.y));
            
            // Add Glow (Chemiluminescence)
            fluidColor += uColorB * uGlow * 0.2 * dens;
            
            accumCol += fluidColor * absorption * transmissivity * 2.0;
        }
        
        t += 0.05; // Step size
        if(transmissivity < 0.01) break; // Opaque
    }
    
    return vec4(accumCol, 1.0 - transmissivity);
}

void main() {
    // CAMERA SETUP
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= uResolution.x / uResolution.y;
    
    // Virtual Camera Position (Rotates with mouse or time)
    vec3 ro = vec3(3.0 * sin(uTime*0.1), 0.5 + uMouse.y, 3.0 * cos(uTime*0.1));
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 fwd = normalize(ta - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    vec3 rd = normalize(fwd + uv.x * right + uv.y * up);

    // Render Volume
    vec4 col = raymarch(ro, rd);
    
    // Tone mapping
    col.rgb = pow(col.rgb, vec3(1.0/2.2));
    
    // Add Glass Edge Reflection (Fake)
    float edge = 1.0 - abs(uv.x);
    col.rgb += vec3(0.8, 0.9, 1.0) * pow(edge, 10.0) * 0.1;

    gl_FragColor = col;
}
`;

export default class IsotopeEngine {
    constructor(id) {
        this.dom = document.getElementById(id);
        
        // High Performance Render Config
        this.renderer = new THREE.WebGLRenderer({ powerPreference:'high-performance', alpha: false });
        this.renderer.setSize(this.dom.clientWidth, this.dom.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.dom.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

        // THE REACTOR PLANE
        const geometry = new THREE.PlaneGeometry(2,2);
        this.uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(this.dom.clientWidth, this.dom.clientHeight) },
            uColorA: { value: new THREE.Color(0.8, 0.9, 1.0) }, // Clear
            uColorB: { value: new THREE.Color(0.8, 0.9, 1.0) },
            uDensity: { value: 2.0 },
            uExpansion: { value: 0.1 },
            uGlow: { value: 0.0 },
            uLiquidType: { value: 0.0 },
            uMouse: { value: new THREE.Vector2(0,0) }
        };

        this.material = new THREE.ShaderMaterial({
            vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
            fragmentShader: VOLUME_FRAG,
            uniforms: this.uniforms
        });

        this.scene.add(new THREE.Mesh(geometry, this.material));

        // State Machine
        this.isCycling = false;
        this.cycleTime = 0;
        this.cycleColors = [];

        this.animate();
        window.addEventListener('resize', ()=>this.resize());
        window.addEventListener('mousemove', (e) => {
            this.uniforms.uMouse.value.y = (e.clientY / window.innerHeight) - 0.5;
        });
    }

    // UPDATE PHYSICS
    processReaction(data) {
        const visuals = data.visuals;

        // Reset
        this.isCycling = false;

        if (visuals.type === 'CYCLE') {
            this.isCycling = true;
            this.cycleColors = visuals.colors;
        } 
        else {
            // GSAP-style transition for Colors
            const targetA = new THREE.Color(...(visuals.baseColor || [0,0,0]));
            const targetB = new THREE.Color(...(visuals.secondaryColor || targetA));
            
            this.transition(targetA, targetB, 2.0); // 2 second mix time
            
            // Physics Params
            this.uniforms.uDensity.value = visuals.viscosity || 2.0;
            this.uniforms.uExpansion.value = visuals.expansion || 0.1;
            this.uniforms.uGlow.value = visuals.glow || 0.0;
            this.uniforms.uLiquidType.value = visuals.type === 'FOAM' ? 1.0 : 0.0;
        }
    }

    transition(colA, colB, duration) {
        const startA = this.uniforms.uColorA.value.clone();
        const startB = this.uniforms.uColorB.value.clone();
        const startT = performance.now();

        const tick = () => {
            const now = performance.now();
            const pct = Math.min((now - startT) / (duration*1000), 1.0);
            
            this.uniforms.uColorA.value.lerpColors(startA, colA, pct);
            this.uniforms.uColorB.value.lerpColors(startB, colB, pct);
            
            if (pct < 1.0) requestAnimationFrame(tick);
        };
        tick();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = 0.01;
        this.uniforms.uTime.value += dt;

        // Handle Oscillating Reactions (Briggs-Rauscher)
        if (this.isCycling && this.cycleColors.length > 0) {
            this.cycleTime += dt;
            const idx = Math.floor(this.cycleTime % this.cycleColors.length);
            const nextIdx = (idx + 1) % this.cycleColors.length;
            const blend = (this.cycleTime % 1); // 0 to 1
            
            const c1 = new THREE.Color(...this.cycleColors[idx]);
            const c2 = new THREE.Color(...this.cycleColors[nextIdx]);
            
            this.uniforms.uColorA.value.lerpColors(c1, c2, blend);
            this.uniforms.uColorB.value.lerpColors(c1, c2, blend);
            
            this.uniforms.uGlow.value = (idx === 0) ? 0.0 : 0.5; // Flash on changes
        }

        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = this.dom.clientWidth;
        const h = this.dom.clientHeight;
        this.renderer.setSize(w, h);
        this.uniforms.uResolution.value.set(w, h);
    }
}
