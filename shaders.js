export const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const reactionFragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uReactantAmount; // 0.0 to 1.0
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uTurbulence;
    
    varying vec2 vUv;

    // Simplex Noise Function (Simplified for brevity)
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
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
        // Create fluid-like movement
        vec2 st = vUv * 3.0;
        float noiseVal = snoise(st + uTime * uTurbulence);
        
        // Define reaction boundary
        float mixFactor = smoothstep(0.2, 0.8, uReactantAmount + noiseVal * 0.2);
        
        // Chemical Mixing Logic
        vec3 finalColor = mix(uColorA, uColorB, mixFactor);
        
        // REACTION IGNITION (The "Crazy" Part)
        // If chemicals mix (mixFactor is near 0.5), generate heat/light (bloom)
        float reactionHeat = 1.0 - abs(mixFactor - 0.5) * 2.0; 
        reactionHeat = pow(reactionHeat, 3.0) * uTurbulence; 
        
        vec3 reactionGlow = vec3(1.0, 0.9, 0.3) * reactionHeat * 2.0;
        
        gl_FragColor = vec4(finalColor + reactionGlow, 1.0);
    }
`;
