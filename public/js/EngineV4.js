/* EngineV4.js - The "Uber Shader" Renderer */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- THE MAGNUM OPUS SHADER ---
const UBER_SHADER = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uViscosity; // Controls detail/scale
    uniform float uMode;      // 0:Fluid, 1:Plasma, 2:Void, 3:Glitch
    varying vec2 vUv;

    // --- MATH LIBRARY ---
    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
    vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
    
    // Simplex Noise
    float snoise(vec2 v){
        const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
        vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
        vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
        vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);
        vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
        vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
        m=m*m;m=m*m;
        vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-0.5;
        vec3 ox=floor(x+0.5);vec3 a0=x-ox;
        m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
        vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
        return 130.*dot(m,g);
    }

    // Voronoi (For Plasma)
    vec2 random2( vec2 p ) { return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
    float voronoi(vec2 uv) {
        vec2 i = floor(uv); vec2 f = fract(uv); float m_dist = 1.0;
        for(int y=-1; y<=1; y++) {
            for(int x=-1; x<=1; x++) {
                vec2 neighbor = vec2(float(x),float(y));
                vec2 point = random2(i + neighbor);
                point = 0.5 + 0.5*sin(uTime + 6.2831*point);
                vec2 diff = neighbor + point - f;
                float dist = length(diff);
                m_dist = min(m_dist, dist);
            }
        }
        return m_dist;
    }

    // Gyroid (For Void/Eldritch)
    float gyroid(vec3 p) { return dot(sin(p), cos(p.yzx)); }

    void main() {
        vec2 st = vUv * 3.0; // Base Zoom
        vec3 finalColor = uColor;
        float alpha = 1.0;

        // --- MODE 0: FLUIDS (Curl Noise Logic) ---
        if(uMode < 0.5) {
            float flow = uTime * (0.5 / uViscosity);
            float n1 = snoise(st + vec2(0, flow));
            float n2 = snoise(st * 2.0 + vec2(flow, 0));
            float mask = smoothstep(0.2, 0.8, n1 * n2);
            finalColor *= (0.5 + 0.5 * mask);
            alpha = smoothstep(0.1, 0.6, n1 + n2);
        }
        
        // --- MODE 1: PLASMA (Voronoi + Electric) ---
        else if (uMode < 1.5) {
            vec2 vSt = st * (5.0 - uViscosity);
            float v = voronoi(vSt + uTime);
            // Invert voronoi for "Cell walls" (electricity look)
            float electric = 1.0 - smoothstep(0.0, 0.1, v); 
            finalColor += vec3(1.0) * electric * 5.0; // Bloom boost
            alpha = electric + 0.1;
        }

        // --- MODE 2: VOID / GYROID (Eldritch) ---
        else if (uMode < 2.5) {
            vec3 p = vec3(st * 4.0, uTime * 0.5);
            float g = gyroid(p);
            float edge = smoothstep(-0.1, 0.1, g);
            // Weird banding lines
            float bands = sin(g * 20.0 + uTime * 5.0);
            finalColor = mix(uColor, vec3(1.0 - uColor.r), bands * 0.5); 
            alpha = edge;
        }

        // --- MODE 3: GLITCH / RADIATION ---
        else {
            vec2 grid = floor(st * 20.0);
            float noise = snoise(grid + floor(uTime * 10.0));
            float pixel = step(0.5, noise);
            
            // Chromatic Abberation logic in pixel shader
            finalColor *= pixel;
            finalColor.r += snoise(st + uTime*20.0) * 0.5;
            alpha = pixel;
        }

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

export default class AlchemyCore {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        this.renderer = new THREE.WebGLRenderer({ alpha: true, powerPreference: 'high-performance' });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // --- MAIN QUAD ---
        this.material = new THREE.ShaderMaterial({
            vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }",
            fragmentShader: UBER_SHADER,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color('#000') },
                uViscosity: { value: 1.0 },
                uMode: { value: 0.0 }
            },
            transparent: true
        });
        
        this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.material));
        
        // --- POST PROCESSING ---
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(1024, 1024), 1.5, 0.4, 0.85);
        this.composer.addPass(this.bloom);
        
        this.resize();
        this.loop();
        window.addEventListener('resize', ()=>this.resize());
    }

    // Called via API to change visuals
    react(visualData) {
        const u = this.material.uniforms;
        
        // GSAP-like Transition (simplified)
        const startColor = u.uColor.value.clone();
        const endColor = new THREE.Color(visualData.color);
        const startTime = performance.now();
        
        // Transition Loop
        const transition = () => {
            const now = performance.now();
            const p = Math.min((now - startTime) / 1000, 1.0); // 1 sec transition
            
            u.uColor.value.lerpColors(startColor, endColor, p);
            u.uViscosity.value = visualData.viscosity;
            u.uMode.value = visualData.mode; // Discrete switch
            
            // Post Processing Updates
            this.bloom.strength = visualData.bloom;
            
            if(p < 1.0) requestAnimationFrame(transition);
        }
        transition();
    }

    loop() {
        requestAnimationFrame(()=>this.loop());
        this.material.uniforms.uTime.value += 0.005; // Time constant
        this.composer.render();
    }
    
    resize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
    }
}
