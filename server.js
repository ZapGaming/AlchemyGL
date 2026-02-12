/* server.js - ENTROPY ENGINE LOGIC CORE */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Color = require('color');
const path = require('path');
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- THE GRAND ARCHIVE (70+ Elements) ---
const DB = {
    // TIER 1: EARTHLY
    'H2O': { name: 'Water', h: 0.1, v: 0.5, r: 0.0, color: '#2196F3', type: 'LIQ' },
    'DIRT': { name: 'Earth/Soil', h: 0.0, v: 5.0, r: 0.0, color: '#5D4037', type: 'SOL' },
    'SAND': { name: 'Silica Sand', h: 0.1, v: 4.5, r: 0.0, color: '#FFECB3', type: 'SOL' },
    'OIL': { name: 'Crude Oil', h: 0.4, v: 2.0, r: 0.0, color: '#0D0D0D', type: 'LIQ' },
    'GOLD': { name: 'Molten Gold', h: 0.6, v: 3.0, r: 0.0, color: '#FFD700', type: 'MET' },
    'MERC': { name: 'Mercury', h: 0.2, v: 1.5, r: 0.1, color: '#CFD8DC', type: 'MET' },
    
    // TIER 2: VOLATILE
    'FIRE': { name: 'Liquid Fire', h: 3.0, v: 0.1, r: 0.0, color: '#FF3D00', type: 'PLASMA' },
    'LAVA': { name: 'Magma', h: 5.0, v: 8.0, r: 0.2, color: '#BF360C', type: 'LIQ' },
    'NITRO':{ name: 'Nitroglycerin', h: 4.0, v: 0.8, r: 0.0, color: '#FFF9C4', type: 'EXP' },
    'CH4':  { name: 'Methane', h: 2.5, v: 0.05, r: 0.0, color: '#00E5FF', type: 'GAS' },
    'ACID': { name: 'Fluoroantimonic Acid', h: 2.0, v: 1.2, r: 0.5, color: '#76FF03', type: 'ACID' },

    // TIER 3: COSMIC / SCI-FI
    'U235': { name: 'Uranium 235', h: 6.0, v: 5.0, r: 8.0, color: '#69F0AE', type: 'RAD' },
    'COR':  { name: 'Demon Core', h: 8.0, v: 9.0, r: 20.0, color: '#00C853', type: 'RAD' },
    'VOID': { name: 'Void Essence', h: -10.0, v: 0.0, r: 50.0, color: '#000000', type: 'EXO' },
    'ANTI': { name: 'Antimatter', h: 99.0, v: 0.0, r: 99.0, color: '#FFFFFF', type: 'EXO' },
    'STR':  { name: 'Stardust', h: 10.0, v: 0.2, r: 5.0, color: '#E040FB', type: 'PLASMA' }
};

// --- PHYSICS ENGINE ---
app.post('/api/mix', (req, res) => {
    try {
        const { idA, massA, idB, massB } = req.body;
        
        const mA = parseFloat(massA);
        const mB = parseFloat(massB);
        const totalMass = mA + mB;

        // Ratio Weights
        const rA = mA / totalMass;
        const rB = mB / totalMass;

        const elA = DB[idA] || DB['H2O'];
        const elB = DB[idB] || DB['H2O'];

        // 1. CALCULATE WEIGHTED PROPERTIES
        let heat = (elA.h * rA) + (elB.h * rB);
        let visc = (elA.v * rA) + (elB.v * rB);
        let rads = (elA.r * rA) + (elB.r * rB); // Radiation averages out usually
        let colA = Color(elA.color);
        let colB = Color(elB.color);
        let finalColor = colA.mix(colB, rB).hex();

        // 2. CHEMICAL EVENTS SYSTEM
        let event = "STABLE";
        let chaosLevel = 0; // 0-100 scales graphics
        let siteInvert = false;

        // EVENT: Water Extinguishes Fire/Lava
        if ((idA === 'H2O' && ['LAVA', 'FIRE'].includes(idB)) || (idB === 'H2O' && ['LAVA', 'FIRE'].includes(idA))) {
             if (rA > 0.6 || rB > 0.6) {
                event = "OBSIDIAN COOLING";
                heat = 1.0; visc = 10.0; finalColor = '#212121';
             } else {
                event = "STEAM EXPLOSION";
                heat = 15.0; visc = 0.0; chaosLevel = 20; finalColor = '#ECEFF1';
             }
        }

        // EVENT: Matter-Antimatter Annihilation
        if (idA === 'ANTI' || idB === 'ANTI') {
             event = "VACUUM COLLAPSE";
             heat = 1000.0; 
             chaosLevel = 100;
             rads = 100;
             siteInvert = true; // TRIGGERS HTML COLOR SWAP
             finalColor = '#FFFFFF';
        }

        // EVENT: Nuclear Meltdown
        if (rads > 8.0 && heat > 5.0) {
            event = "CRITICAL EXCURSION";
            chaosLevel = rads * 2;
            finalColor = '#00FF00'; // Matrix Green
            if (rads > 15) siteInvert = Math.random() > 0.5; // Flicker
        }

        res.json({
            meta: { event },
            physics: {
                color: finalColor,
                heat: heat,              // Controls Bloom + Turbulence Speed
                viscosity: visc,         // Controls Fluid noise scale
                radiation: rads,         // Controls Chromatic Aberration / Glitch
                chaos: chaosLevel,       // Controls Screen Shake amount
                invert: siteInvert       // Controls CSS Inversion
            }
        });

    } catch(e) { console.log(e); res.status(500).json({}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ENTROPY V5 LISTENING ${PORT}`));
