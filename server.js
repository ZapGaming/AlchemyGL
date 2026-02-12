/**
 * THE HIVEMIND
 * A physics logic server that calculates reaction outcomes.
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Color = require('color');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- THE ELEMENT TABLE (Complex Data) ---
const ELEMENTS = {
    // Basic Fluids
    'H2O': { name: 'Water', temp: 20, density: 1.0, color: '#29b6f6', volatility: 0.1, radiation: 0 },
    'LN2': { name: 'Liquid Nitrogen', temp: -200, density: 0.8, color: '#e1f5fe', volatility: 0.0, radiation: 0 },
    'OIL': { name: 'Crude Oil', temp: 30, density: 2.0, color: '#0d0d0d', volatility: 0.5, radiation: 0 },
    
    // Reactants
    'NA':  { name: 'Sodium', temp: 25, density: 1.0, color: '#bdbdbd', volatility: 2.0, type: 'alkali' },
    'K':   { name: 'Potassium', temp: 25, density: 0.9, color: '#9e9e9e', volatility: 3.0, type: 'alkali' },
    
    // Exotic/High-Energy
    'CH4': { name: 'Methane', temp: 40, density: 0.2, color: '#03a9f4', volatility: 3.5, radiation: 0 },
    'Pu':  { name: 'Plutonium-239', temp: 80, density: 5.0, color: '#1b5e20', volatility: 0.5, radiation: 5.0 }, // EXTREME RADIATION
    'Xen': { name: 'Xenon Plasma', temp: 1500, density: 0.05, color: '#9c27b0', volatility: 5.0, radiation: 1.0 }
};

// --- SIMULATION ENDPOINT ---
app.post('/api/simulate', (req, res) => {
    try {
        const { chemicalA, massA, chemicalB, massB } = req.body;
        const A = ELEMENTS[chemicalA] || ELEMENTS['H2O'];
        const B = ELEMENTS[chemicalB] || ELEMENTS['H2O'];

        const totalMass = massA + massB;
        const rA = massA / totalMass;
        const rB = massB / totalMass;

        // 1. THERMODYNAMICS MIXING
        let outputTemp = (A.temp * rA) + (B.temp * rB);
        let outputRad = (A.radiation || 0) + (B.radiation || 0);
        let outputVolatility = (A.volatility * rA) + (B.volatility * rB);

        // Color Mixing using proper Lab space blending
        const colA = Color(A.color);
        const colB = Color(B.color);
        let outputColor = colA.mix(colB, rB).hex();
        
        // 2. CHEMICAL REACTION RULES (Logic Trees)
        
        let reactionEvent = "MIX";
        let bloomIntensity = 0.5; // Glow amount

        // RULE: Alkali Metals + Water = EXPLOSION
        if ( (A.type === 'alkali' && chemicalB === 'H2O') || (B.type === 'alkali' && chemicalA === 'H2O') ) {
            reactionEvent = "EXPLOSION";
            outputTemp = 3000; // Flash Heat
            outputVolatility = 10.0;
            bloomIntensity = 4.0;
            outputColor = '#fffecf'; // White hot
        }

        // RULE: Fire Triangle (Fuel + Heat/Spark)
        if ( (chemicalA === 'CH4' || chemicalB === 'CH4') && outputTemp > 50 ) {
            reactionEvent = "COMBUSTION";
            outputTemp = 2000;
            bloomIntensity = 2.5;
            outputColor = '#0066ff'; // Blue Fire (Complete Combustion)
            outputVolatility = 5.0;
        }

        // RULE: Radioactive Critical Mass
        if ( outputRad > 3.0 ) {
            reactionEvent = "CRITICAL_MASS";
            outputColor = '#39ff14'; // Chernobyl Green
            bloomIntensity = 1.0 + outputRad; // Blind user based on radiation
        }

        res.json({
            success: true,
            physics: {
                temp: outputTemp,           // Controls: Convection Speed
                viscosity: Math.max(0.1, 5.0 - (outputTemp/100)), // Controls: Liquid flow
                radiation: outputRad,       // Controls: Glitch/Chromatic Aberration
                color: outputColor,         // Controls: RGB
                turbulence: outputVolatility, // Controls: Noise Speed
                bloom: bloomIntensity,       // Controls: Post-Process Glow
                event: reactionEvent
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`HIVEMIND ONLINE: PORT ${PORT}`));
