import * as THREE from 'three';
import { vertexShader, reactionFragmentShader } from './shaders.js';

export default class AlchemyEngine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        
        this.init();
        this.animate();
    }

    init() {
        // 1. Setup GPU Renderer
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: true,
            powerPreference: "high-performance" // Force GPU use
        });
        this.renderer.setSize(this.width, this.height);
        this.container.appendChild(this.renderer.domElement);

        // 2. State Logic (The "Chemistry")
        this.state = {
            chemicalA: new THREE.Color('#0022ff'), // Base: Cool Blue Liquid
            chemicalB: new THREE.Color('#ff0000'), // Add: Red Reactant
            amount: 0.0,
            turbulence: 0.1
        };

        // 3. Create The Reactor Plane (2D surface simulating 3D fluid)
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader: reactionFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(this.width, this.height) },
                uColorA: { value: this.state.chemicalA },
                uColorB: { value: this.state.chemicalB },
                uReactantAmount: { value: this.state.amount },
                uTurbulence: { value: this.state.turbulence }
            }
        });

        const mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(mesh);

        // Resize Listener
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    // --- API for integration ---
    
    // Call this to "pour" a chemical
    injectChemical(colorHex, amount, turbulence) {
        // Animate the mix smoothly (Simulated Physics interpolation)
        this.state.chemicalB.set(colorHex);
        
        const startTime = Date.now();
        const duration = 2000; // 2 seconds mix time
        
        const animateMix = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            
            // Easing function for realistic flow
            const ease = 1 - Math.pow(1 - progress, 3);
            
            this.material.uniforms.uReactantAmount.value = amount * ease;
            this.material.uniforms.uTurbulence.value = turbulence * ease + 0.1;
            
            if (progress < 1) requestAnimationFrame(animateMix);
        };
        animateMix();
    }

    onWindowResize() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.material.uniforms.uResolution.value.set(
            this.container.clientWidth, this.container.clientHeight
        );
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.material.uniforms.uTime.value += 0.01;
        this.renderer.render(this.scene, this.camera);
    }
}
