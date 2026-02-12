import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';

// --- THE REALITY SHADER (Simulating Fluid Dynamics without Solver) ---
const FLUID_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform float uHeat; 
uniform float uVisc;
uniform float uChaos; 
varying vec2 vUv;

// Ashima Simplex Noise
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}

float fbm(vec2 st) {
    float v = 0.0;
    float a = 0.5;
    for(int i=0; i<6; i++){
        v += a * snoise(st);
        st *= 2.0; a *= 0.5;
    }
    return v;
}

void main() {
    // 1. Dynamic Zoom based on Density/Viscosity
    vec2 st = vUv * (3.0 + uVisc);
    
    // 2. Convection Flow (Heat makes it move up)
    float speed = uTime * (0.2 + (uHeat * 0.1));
    vec2 flow = vec2(0.0, -speed);
    
    // 3. Domain Warping (Fluid curl effect)
    vec2 q = vec2(0.);
    q.x = fbm( st + flow );
    q.y = fbm( st + vec2(1.0) );

    vec2 r = vec2(0.);
    r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ (0.15*uTime) );
    r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ (0.126*uTime) );

    float f = fbm(st + r);

    // 4. Color Processing
    // High heat adds white/blue core
    vec3 col = uColor;
    float coreHeat = smoothstep(0.5, 0.9, f);
    if (uHeat > 5.0) col = mix(col, vec3(1.0), coreHeat); 
    if (uHeat > 15.0) col = mix(col, vec3(0.5, 0.8, 1.0), coreHeat);

    // 5. Alpha/Smoke mask
    float alpha = smoothstep(0.1, 0.7, f + 0.1*uVisc);
    
    // CHAOS MODE (Screen Tear)
    if(uChaos > 20.0) {
        float tear = step(0.9, snoise(vec2(vUv.y*100.0, uTime*30.0)));
        col += vec3(tear);
    }

    gl_FragColor = vec4(col * (f*1.5 + 0.2), alpha);
}
`;

// --- GLITCH POST PROCESS ---
const GLITCH_FRAG = `
uniform sampler2D tDiffuse;
uniform float uAmount; 
uniform float uTime;
varying vec2 vUv;
float rand(vec2 co){return fract(sin(dot(co.xy,vec2(12.9898,78.233)))*43758.5453);}
void main() {
    vec2 uv = vUv;
    if(uAmount > 0.1) {
        // RGB Split
        float split = uAmount * 0.02 * sin(uTime * 20.0);
        float r = texture2D(tDiffuse, uv + vec2(split,0)).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - vec2(split,0)).b;
        
        // Scanlines
        if(mod(uv.y * 200.0, 2.0) > 1.0) { r*=0.9; g*=0.9; b*=0.9; }
        
        gl_FragColor = vec4(r,g,b,1.0);
    } else {
        gl_FragColor = texture2D(tDiffuse, uv);
    }
}
`;

export default class HyperEngine {
    constructor(id) {
        this.dom = document.getElementById(id);
        this.renderer = new THREE.WebGLRenderer({alpha: true, powerPreference:'high-performance', antialias: false});
        this.renderer.setSize(this.dom.clientWidth, this.dom.clientHeight);
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        this.dom.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

        // FLUID PLANE
        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0x000000) },
                uHeat: { value: 0 },
                uVisc: { value: 1.0 },
                uChaos: { value: 0 }
            },
            vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
            fragmentShader: FLUID_FRAG,
            transparent: true,
        });
        this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.mat));

        // COMPOSER STACK
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.cam));
        
        this.bloom = new UnrealBloomPass(new THREE.Vector2(100,100), 1.5, 0.4, 0.85);
        this.composer.addPass(this.bloom);

        this.glitch = new ShaderPass({
            uniforms: { tDiffuse:{value:null}, uAmount:{value:0}, uTime:{value:0} },
            vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
            fragmentShader: GLITCH_FRAG
        });
        this.composer.addPass(this.glitch);

        this.targetShake = 0;
        this.animate();
        window.addEventListener('resize', ()=>this.resize());
    }

    // MAIN UPDATE LOOP FROM API
    process(data) {
        const p = data.physics;
        const u = this.mat.uniforms;

        // Smooth Colors
        const nextColor = new THREE.Color(p.color);
        const loop = () => {
             u.uColor.value.lerp(nextColor, 0.05);
             if(Math.abs(u.uColor.value.r - nextColor.r) > 0.01) requestAnimationFrame(loop);
        };
        loop();

        // Immediate Setters
        u.uHeat.value = p.heat;
        u.uVisc.value = p.viscosity;
        u.uChaos.value = p.chaos;

        // Effects Control
        this.bloom.strength = p.heat > 5 ? 3.0 : 1.2;
        this.glitch.uniforms.uAmount.value = p.radiation * 0.1; // Rads cause glitch

        // Screen Shake
        this.targetShake = p.chaos;

        // SITE INVERT LOGIC (Full CSS Reverse)
        const body = document.body;
        if(p.invert) {
             body.classList.add('reality-break');
        } else {
             body.classList.remove('reality-break');
        }
    }

    animate() {
        requestAnimationFrame(()=>this.animate());
        const t = performance.now() * 0.001;
        
        this.mat.uniforms.uTime.value = t;
        this.glitch.uniforms.uTime.value = t;

        // SCREEN SHAKE PHYSICS
        if(this.targetShake > 0) {
            const rx = (Math.random()-0.5) * this.targetShake;
            const ry = (Math.random()-0.5) * this.targetShake;
            this.dom.style.transform = `translate(${rx}px, ${ry}px)`;
            this.targetShake *= 0.9; // Decay friction
        }

        this.composer.render();
    }

    resize(){
        this.renderer.setSize(this.dom.clientWidth, this.dom.clientHeight);
        this.composer.setSize(this.dom.clientWidth, this.dom.clientHeight);
    }
}
