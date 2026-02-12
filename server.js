const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const Color = require('color');
const path = require('path');

const app = express();
app.use(cors());
app.use(compression());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 50+ ELEMENT DATABASE ---
// Types: 0=Fluid, 1=Plasma/Energy, 2=Solid/Sludge, 3=Eldritch/Glitch
const DB = {
    // --- TIER 1: BASIC FLUIDS (Mode 0) ---
    'H2O': { name: 'Distilled Water', color: '#00BFFF', visc: 1.0, type: 0 },
    'SEA': { name: 'Saltwater', color: '#006994', visc: 1.2, type: 0 },
    'OIL': { name: 'Heavy Crude', color: '#1a1a1a', visc: 4.0, type: 0 },
    'BLOOD': { name: 'Biological Matter', color: '#8a0303', visc: 2.0, type: 0 },
    'MERC': { name: 'Mercury', color: '#C0C0C0', visc: 3.0, type: 0 },

    // --- TIER 2: VOLATILE ENERGY (Mode 1) ---
    'CH4': { name: 'Methane Ignited', color: '#00E5FF', visc: 0.1, type: 1 },
    'NAPALM': { name: 'Napalm B', color: '#FF4500', visc: 2.5, type: 1, heat: 2000 },
    'LAVA': { name: 'Magma', color: '#FF1744', visc: 8.0, type: 0, heat: 1500 },
    'ACID': { name: 'Fluoroantimonic Acid', color: '#ccff00', visc: 1.5, type: 0 },
    'ELEC': { name: 'Arc Lightning', color: '#E040FB', visc: 0.0, type: 1 },

    // --- TIER 3: RADIOACTIVE / TOXIC (Mode 3 Glitch) ---
    'U235': { name: 'Uranium 235', color: '#39FF14', visc: 5.0, type: 3, rads: 5 },
    'CS137': { name: 'Cesium Dust', color: '#00bcd4', visc: 0.2, type: 3, rads: 8 },
    'PLUT': { name: 'Plutonium Plasma', color: '#F50057', visc: 0.1, type: 3, rads: 10 },
    
    // --- TIER 4: COSMIC / MYTHIC (Mode 2 Gyroid) ---
    'VOID': { name: 'Vacuum Decay', color: '#000000', visc: 0.0, type: 2 },
    'AETHER': { name: 'Celestial Aether', color: '#7C4DFF', visc: 0.5, type: 2 },
    'N_STAR': { name: 'Neutron Star Core', color: '#FFFFFF', visc: 10.0, type: 1 },
    'DARK': { name: 'Dark Matter', color: '#120024', visc: 1.0, type: 2 }
};

// --- PHYSICS ENGINE ---
app.post('/api/simulate', (req, res) => {
    try {
        const { A, B } = req.body;
        const matA = DB[A] || DB['H2O'];
        const matB = DB[B] || DB['H2O'];

        // Physics Mixing
        let mixColor = Color(matA.color).mix(Color(matB.color), 0.5).hex();
        let mixVisc = (matA.visc + matB.visc) / 2;
        let mixType = Math.max(matA.type, matB.type); // Complex types override simple ones
        let rads = (matA.rads || 0) + (matB.rads || 0);
        let heat = (matA.heat || 20) + (matB.heat || 20);

        // --- REACTION OVERRIDES (Chemistry Logic) ---
        let alert = null;
        
        // Matter + AntiMatter (Void)
        if (A === 'VOID' || B === 'VOID') {
            mixColor = '#000000';
            mixType = 2; // Gyroid Mode
            alert = "REALITY_COLLAPSE";
        }

        // Alkali Explosion
        if (['H2O', 'SEA', 'BLOOD'].includes(A) && ['NA', 'K'].includes(B)) {
             mixType = 1; // Plasma mode
             mixColor = '#FFEB3B';
             mixVisc = 0.1;
             alert = "THERMAL_DETONATION";
        }

        // Radiation Critical Mass
        if (rads > 8) {
            mixType = 3; // Glitch Mode
            alert = "CRITICAL_IRRADIATION";
        }

        res.json({
            visual: {
                color: mixColor,
                viscosity: mixVisc,
                mode: mixType,  // 0=Fluid, 1=Plasma, 2=Void, 3=Glitch
                speed: 1.0 + (heat/1000),
                bloom: heat > 1000 ? 3.0 : 1.5
            },
            meta: { name: `${matA.name} + ${matB.name}`, alert }
        });
    } catch(e) { res.status(500).json({error:e}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Alchemy Engine v4 Online on port ${PORT}`));
