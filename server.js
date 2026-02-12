/* server.js - ALCHEMY HIVEMIND V3 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Color = require('color');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

// --- THE MASTER ELEMENTS DATABASE (25+ ITEMS) ---
const DB = {
    // --- TIER 1: FLUIDS ---
    'H2O': { name: 'Water', temp: 20, viscosity: 1.0, color: '#29B6F6', rads: 0, volatility: 0.1 },
    'OIL': { name: 'Crude Oil', temp: 35, viscosity: 3.0, color: '#0D0D0D', rads: 0, volatility: 0.6 },
    'LN2': { name: 'Liquid Nitrogen', temp: -210, viscosity: 0.5, color: '#E1F5FE', rads: 0, volatility: 0.0 },
    'BLD': { name: 'Bio-Organic Sludge', temp: 37, viscosity: 1.5, color: '#B71C1C', rads: 0, volatility: 0.1 },

    // --- TIER 2: VOLATILES & FUELS ---
    'CH4': { name: 'Methane Gas', temp: 40, viscosity: 0.1, color: '#2979FF', rads: 0, volatility: 5.0, type: 'fuel' },
    'NPLM': { name: 'Napalm-B', temp: 60, viscosity: 4.0, color: '#FF6D00', rads: 0, volatility: 3.0, type: 'fuel' },
    'H2':  { name: 'Liquid Hydrogen', temp: -250, viscosity: 0.05, color: '#FFFFFF', rads: 0, volatility: 8.0, type: 'fuel' },
    'BLK': { name: 'Black Powder', temp: 25, viscosity: 5.0, color: '#37474F', rads: 0, volatility: 6.0, type: 'explosive' },

    // --- TIER 3: ACIDS & BASES ---
    'H2SO4': { name: 'Sulfuric Acid', temp: 50, viscosity: 1.8, color: '#76FF03', rads: 0, volatility: 1.5, type: 'acid' },
    'HCL':   { name: 'Hydrochloric Acid', temp: 45, viscosity: 1.1, color: '#C6FF00', rads: 0, volatility: 1.2, type: 'acid' },
    'NAOH':  { name: 'Sodium Hydroxide', temp: 30, viscosity: 2.0, color: '#F0F4C3', rads: 0, volatility: 1.0, type: 'base' },
    
    // --- TIER 4: REACTIVE METALS ---
    'NA': { name: 'Sodium', temp: 25, viscosity: 5.0, color: '#BDBDBD', rads: 0, volatility: 2.0, type: 'alkali' },
    'K':  { name: 'Potassium', temp: 25, viscosity: 4.0, color: '#9E9E9E', rads: 0, volatility: 3.0, type: 'alkali' },
    'MG': { name: 'Magnesium', temp: 25, viscosity: 5.0, color: '#ECEFF1', rads: 0, volatility: 1.0, type: 'metal' },

    // --- TIER 5: RADIOACTIVE / NUCLEAR ---
    'U235': { name: 'Uranium-235', temp: 150, viscosity: 5.0, color: '#00E676', rads: 4.0, volatility: 0.2 },
    'PU239':{ name: 'Plutonium-239', temp: 200, viscosity: 4.5, color: '#D500F9', rads: 7.0, volatility: 1.0 },
    'COR':  { name: 'Corium Lava', temp: 2800, viscosity: 6.0, color: '#FF3D00', rads: 10.0, volatility: 2.0 },
    
    // --- TIER 6: COSMIC / MYSTICAL ---
    'VOID': { name: 'Dark Matter', temp: -273, viscosity: 0.0, color: '#000000', rads: 50.0, volatility: 0.0, type: 'cosmic' },
    'STR':  { name: 'Stardust', temp: 1000, viscosity: 0.1, color: '#E040FB', rads: 1.0, volatility: 0.5, type: 'cosmic' },
    'SOL':  { name: 'Solar Plasma', temp: 6000, viscosity: 0.5, color: '#FFEB3B', rads: 5.0, volatility: 5.0, type: 'cosmic' }
};

// --- SIMULATION LOGIC ---
app.post('/api/react', (req, res) => {
    try {
        const { idA, amountA, idB, amountB } = req.body;
        const A = DB[idA] || DB['H2O'];
        const B = DB[idB] || DB['H2O'];

        // Weighted Properties
        const total = amountA + amountB;
        const rA = amountA / total;
        const rB = amountB / total;

        let physics = {
            temp: (A.temp * rA) + (B.temp * rB),
            viscosity: (A.viscosity * rA) + (B.viscosity * rB),
            radiation: Math.max(A.rads, B.rads), 
            volatility: (A.volatility * rA) + (B.volatility * rB),
            color: Color(A.color).mix(Color(B.color), rB).hex(),
            shockwave: 0.0,
            shake: 0.0,
            event: 'STABLE MIX'
        };

        // --- REACTION TREE ---

        // 1. NEUTRALIZATION (Acid + Base)
        if ((A.type === 'acid' && B.type === 'base') || (B.type === 'acid' && A.type === 'base')) {
            physics.event = "VIOLENT NEUTRALIZATION";
            physics.temp += 500;
            physics.viscosity = 5.0; // Foam
            physics.volatility = 4.0;
            physics.color = '#FFFFFF'; // White Foam
            physics.shake = 0.5;
        }

        // 2. EXPLOSION (Water + Alkali)
        if ((A.type === 'alkali' && B.name === 'Water') || (B.type === 'alkali' && A.name === 'Water')) {
            physics.event = "HYDRO-ALKALI EXPLOSION";
            physics.temp = 3000;
            physics.volatility = 20.0;
            physics.shockwave = 2.0;
            physics.shake = 3.0;
            physics.color = '#FFF9C4'; // Flash
        }

        // 3. NUCLEAR MELTDOWN
        if (physics.radiation > 8.0) {
            physics.event = "CRITICAL MASS";
            physics.color = '#00FF00'; // Glitch Green
            physics.temp += 1000;
            physics.shake = physics.radiation / 5.0; // High Shake
            // Trigger chromatic aberration limit in frontend logic
        }

        // 4. ANTIMATTER ANNIHILATION
        if ((A.type === 'cosmic' && B.type !== 'cosmic') || (B.type === 'cosmic' && A.type !== 'cosmic')) {
             if (A.name === 'Dark Matter' || B.name === 'Dark Matter') {
                physics.event = "REALITY FAILURE";
                physics.temp = -273; // Absolute Zero visual but violent move
                physics.viscosity = 0;
                physics.volatility = 50.0; // Total chaos
                physics.color = '#000000'; // Void
                physics.shockwave = 5.0; // Huge shockwave
                physics.shake = 10.0; // Max Shake
             }
        }

        // 5. HYPER COMBUSTION
        if (A.type === 'fuel' && B.type === 'fuel') {
             physics.event = "HYPER-COMBUSTION";
             physics.temp = 4000;
             physics.volatility = 10.0;
             physics.shockwave = 0.5;
             physics.color = '#2962FF'; // Plasma Blue
        }

        res.json({ success: true, reaction: physics });

    } catch (e) {
        res.status(500).json({ error: "Reaction Logic Failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AlchemyGL ONLINE port:${PORT}`));
