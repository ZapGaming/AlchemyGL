/* AlchemyGL.js - V3 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';

const FRAGMENT_SHADER = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uHeat; 
    uniform float uVol; // Volatility
    uniform float uShock;
    varying vec2 vUv;

    // --- NOISE ---
    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
    vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
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

    // --- DOMAIN WARPING FBM ---
    float fbm(vec2 st) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        for (int i = 0; i < 5; i++) {
            v += a * snoise(st);
            st = st * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    void main() {
        vec2 st = vUv * 3.0; // Base Zoom

        // High heat increases rising speed significantly
        float speedY = uTime * (0.1 + (uHeat * 0.005));
        
        vec2 q = vec2(0.);
        q.x = fbm( st + vec2(0.0, -speedY) );
        q.y = fbm( st + vec2(5.2, 1.3 - speedY) );

        // Chaos factor from volatility
        float chaos = uVol * 0.3;
        vec2 r = vec2(0.);
        r.x = fbm( st + 4.0*q + vec2(uTime*chaos) );
        r.y = fbm( st + 4.0*q + vec2(uTime*0.1) );

        float f = fbm( st + 4.0*r );

        // SHOCKWAVE CALC
        float shock = 0.0;
        if(uShock > 0.01) {
            float dist = distance(vUv, vec2(0.5));
            shock = smoothstep(uShock - 0.05, uShock, dist) * (1.0 - smoothstep(uShock, uShock + 0.1, dist));
        }

        // BASE COLOR
        // Make noise sharp for intensity
        float intensity = f*f*f*3.5 + 0.2; 
        vec3 col = uColor * intensity;
        
        // THERMAL BLOOM (White hot center)
        if(uHeat > 800.0) {
            col += vec3(0.8, 0.8, 1.0) * smoothstep(0.5, 0.9, f);
        }
        
        // Add Shockwave (Inverts color)
        col = mix(col, vec3(1.0) - col, shock * 2.0);

        float alpha = smoothstep(0.1, 0.6, f + (shock*5.0));
        gl_FragColor = vec4(col, alpha);
    }
`;

export default class AlchemyGL {
    constructor(domId) {
        this.domId = domId;
        this.container = document.getElementById(domId);
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, powerPreference: 'high-performance', antialias: false });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.container.appendChild(this.renderer.domElement);

        // Core Plane
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0x000000) },
                uHeat: { value: 0 },
                uVol: { value: 0.2 },
                uShock: { value: 0.0 }
            },
            vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }",
            fragmentShader: FRAGMENT_SHADER,
            transparent: true
        });
        this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.material));

        // POST PROCESSING
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        // INTENSE BLOOM
        this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        this.composer.addPass(this.bloom);

        this.shockTimer = 0;
        this.shocking = false;
        this.shakeAmount = 0;

        this.animate();
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * UPDATE ENGINE STATE
     * @param {Object} data - physics data from server
     */
    visualize(data) {
        // Tweening via basic interpolation
        const u = this.material.uniforms;
        
        // Direct assignment targets
        this.targetColor = new THREE.Color(data.color);
        this.targetHeat = data.temp;
        this.targetVol = data.volatility;
        this.targetShake = data.shake || 0;
        
        // Trigger Shockwave
        if(data.shockwave > 0) {
            this.shocking = true;
            this.shockTimer = 0;
        }

        // Bloom adjustment
        const bloomStr = (data.temp / 1000) + (data.radiation * 0.2);
        this.bloom.strength = Math.min(bloomStr, 3.5);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const time = performance.now() * 0.001;
        const u = this.material.uniforms;
        
        u.uTime.value = time;
        
        // Smooth Interpolation
        if(this.targetColor) {
             u.uColor.value.lerp(this.targetColor, 0.05);
             u.uHeat.value += (this.targetHeat - u.uHeat.value) * 0.05;
             u.uVol.value += (this.targetVol - u.uVol.value) * 0.05;
        }

        // Shockwave Logic
        if(this.shocking) {
            this.shockTimer += 0.03;
            u.uShock.value = this.shockTimer;
            if(this.shockTimer > 2.0) {
                this.shocking = false; 
                u.uShock.value = 0;
            }
        }

        // Shake Logic (CSS)
        if(this.targetShake > 0) {
            this.shakeAmount += (this.targetShake - this.shakeAmount) * 0.1;
            const x = (Math.random() - 0.5) * this.shakeAmount * 10;
            const y = (Math.random() - 0.5) * this.shakeAmount * 10;
            this.container.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
            this.targetShake *= 0.95; // Decay
        } else {
             this.container.style.transform = `none`;
        }
        
        this.composer.render();
    }
    
    resize() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
}
