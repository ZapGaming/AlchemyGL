/* SingularityEngine.js - Multi-Layer Physics */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';

// --- ENGINE 1: FLUID SIMULATION SHADER ---
const FLUID_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform float uHeat;
uniform float uChaos;
uniform vec2 uMouse; /* NEW: Mouse Interactivity */
varying vec2 vUv;

// Fast Simplex Noise
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}

float fbm(vec2 st) {
    float v=0.0, a=0.5;
    for(int i=0; i<5; i++){ v+=a*snoise(st); st*=2.0; a*=0.5; }
    return v;
}

void main() {
    vec2 st = vUv * 3.0;

    // INTERACTIVITY: Mouse Influence
    float dMouse = distance(vUv, uMouse);
    float interact = 1.0 - smoothstep(0.0, 0.5, dMouse);
    st -= (uMouse - 0.5) * interact * 0.5; // Warps space around mouse

    // PHYSICS: Convection
    float speed = uTime * (0.2 + uHeat * 0.1);
    
    // PHYSICS: Turbulence (Domain Warping)
    vec2 q = vec2(fbm(st + vec2(0, -speed)), fbm(st + vec2(1.0)));
    vec2 r = vec2(fbm(st + q + uTime*0.1), fbm(st + q + uTime*0.2));
    float f = fbm(st + r);

    // COLOR
    vec3 col = uColor * (f*f*2.5);
    
    // Core Heat (White Hot)
    if(uHeat > 10.0) col += vec3(1.0) * smoothstep(0.6, 0.9, f);

    // Chaos Mode (Glitch Lines)
    if(uChaos > 5.0) {
        float noiseVal = snoise(vec2(vUv.y * 50.0, uTime * 20.0));
        col += vec3(noiseVal) * 0.1 * uChaos;
    }

    gl_FragColor = vec4(col, 1.0);
}
`;

export default class SingularityEngine {
    constructor(containerId) {
        this.dom = document.getElementById(containerId);
        
        // SETUP RENDERER
        this.renderer = new THREE.WebGLRenderer({
            alpha: true, powerPreference:'high-performance', antialias: false 
        });
        this.renderer.setSize(this.dom.clientWidth, this.dom.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Optimised for speed
        this.dom.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // 1. FLUID ENGINE LAYER
        this.fluidMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0,0,0) },
                uHeat: { value: 0 },
                uChaos: { value: 0 },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) }
            },
            vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
            fragmentShader: FLUID_FRAG,
            transparent: true
        });
        this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.fluidMat));

        // 2. PARTICLE ENGINE LAYER (Explosion Debris)
        this.initParticleSystem();

        // 3. POST-PROCESSING (Bloom/Glitch)
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(100,100), 1.5, 0.4, 0.85);
        this.composer.addPass(this.bloom);

        // MOUSE TRACKER
        this.dom.addEventListener('mousemove', (e) => {
            const x = e.clientX / window.innerWidth;
            const y = 1.0 - (e.clientY / window.innerHeight);
            this.fluidMat.uniforms.uMouse.value.set(x, y);
            
            // Mouse Interaction Particles
            if(Math.random() > 0.8) this.spawnParticle(e.clientX, e.clientY, 1, 1); 
        });

        this.animate();
        window.addEventListener('resize', () => this.resize());
    }

    // --- ENGINE 2: PHYSICAL PARTICLE SYSTEM ---
    initParticleSystem() {
        // Pool of particles for explosions
        const count = 5000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3); // Store physics vel
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Simple Points
        this.particleMat = new THREE.PointsMaterial({
            color: 0xffffff, size: 2.0, transparent: true, opacity: 0
        });

        this.particleSystem = new THREE.Points(geometry, this.particleMat);
        // Trick: Attach to Ortho Camera scene but project positions in 3D logic
        this.particleSystem.position.z = 0; 
        this.scene.add(this.particleSystem);

        this.particleData = { positions, velocities, count };
    }

    triggerExplosion(force, count, colorHex) {
        const p = this.particleData;
        const color = new THREE.Color(colorHex);
        this.particleMat.color = color;
        this.particleMat.opacity = 1.0;
        
        // Burst logic
        for(let i=0; i<count && i < p.count; i++) {
            // Center Screen spawn (for this demo)
            p.positions[i*3] = 0; // x
            p.positions[i*3+1] = 0; // y
            p.positions[i*3+2] = 0; // z

            // Random Explosion Velocity
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * force * 0.01) + 0.005;
            
            p.velocities[i*3] = Math.cos(angle) * speed;   // vx
            p.velocities[i*3+1] = Math.sin(angle) * speed; // vy
            p.velocities[i*3+2] = (Math.random()-0.5) * speed; // vz
        }
        
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    updateParticles() {
        const p = this.particleData;
        
        // Fade out
        if (this.particleMat.opacity > 0) this.particleMat.opacity -= 0.01;

        // Physics Step
        for(let i=0; i<p.count; i++) {
            p.positions[i*3] += p.velocities[i*3];     // X
            p.positions[i*3+1] += p.velocities[i*3+1]; // Y
            // Simple Drag
            p.velocities[i*3] *= 0.95;
            p.velocities[i*3+1] *= 0.95;
        }
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }
    
    // --- MAIN API ---
    process(data) {
        const p = data.reaction;
        const u = this.fluidMat.uniforms;

        // Transition Fluid
        const startCol = u.uColor.value.clone();
        const endCol = new THREE.Color(p.color);
        const steps = 60; let i=0;
        
        const lerpLoop = () => {
            u.uColor.value.lerp(endCol, 0.1);
            if(i++ < steps) requestAnimationFrame(lerpLoop);
        }; lerpLoop();

        // Update Shader Params
        u.uHeat.value = p.heat;
        u.uChaos.value = p.radiation; // Glitch linked to radiation

        // Trigger Explosion Particle Engine
        if(Math.abs(p.force) > 5.0) {
            this.triggerExplosion(p.force, p.particles || 1000, p.color);
            // Flash Effect
            document.getElementById('hyper-canvas').style.filter = "brightness(5.0)";
            setTimeout(()=> document.getElementById('hyper-canvas').style.filter = "brightness(1.0)", 100);
        }

        // Trigger HTML Shake (Engine C)
        this.triggerHTMLShake(p.shake);

        // Bloom intensity
        this.bloom.strength = p.heat > 50 ? 3.0 : 1.5;

        // Reality Break
        if(p.invert) document.body.classList.add('reality-invert');
        else document.body.classList.remove('reality-invert');
    }

    triggerHTMLShake(amount) {
        this.shakeAmp = amount;
    }

    animate() {
        requestAnimationFrame(()=>this.animate());
        
        // 1. Shader Time
        this.fluidMat.uniforms.uTime.value += 0.01;
        
        // 2. Physics Particle Step
        this.updateParticles();
        
        // 3. HTML Screen Shake (CSS Engine)
        if(this.shakeAmp > 0) {
            const rx = (Math.random()-0.5) * this.shakeAmp;
            const ry = (Math.random()-0.5) * this.shakeAmp;
            const rot = (Math.random()-0.5) * (this.shakeAmp * 0.1);
            document.body.style.transform = `translate(${rx}px, ${ry}px) rotate(${rot}deg)`;
            this.shakeAmp *= 0.9; // Friction
        } else {
            document.body.style.transform = "none";
        }

        this.composer.render();
    }
    
    resize() {
        this.renderer.setSize(this.dom.clientWidth, this.dom.clientHeight);
        this.composer.setSize(this.dom.clientWidth, this.dom.clientHeight);
    }
}
