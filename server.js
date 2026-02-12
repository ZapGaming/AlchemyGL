const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- SOPHISTICATED REACTION DATABASE ---
const CHEMICALS = {
    'H2O': { density: 1.0, volatility: 0.1, color: [0.1, 0.4, 0.8] }, // Water
    'NA':  { density: 0.9, volatility: 5.0, color: [0.8, 0.8, 0.8] }, // Sodium
    'CH4': { density: 0.2, volatility: 4.0, color: [0.0, 0.2, 1.0] }, // Methane
    'U235':{ density: 4.0, volatility: 0.5, color: [0.2, 1.0, 0.1], radioactive: 1.0 }, // Uranium
    'KNO3':{ density: 1.2, volatility: 1.5, color: [0.9, 0.8, 0.7] }  // Saltpeter
};

// --- LOGIC ENGINE ---
app.post('/api/react', (req, res) => {
    const { chemA, amountA, chemB, amountB } = req.body;
    
    const matA = CHEMICALS[chemA] || CHEMICALS['H2O'];
    const matB = CHEMICALS[chemB] || CHEMICALS['H2O'];

    // 1. Calculate Mass/Mix
    const totalMass = amountA + amountB;
    const ratioA = amountA / totalMass;
    const ratioB = amountB / totalMass;

    // 2. Logic: Resulting Color Vector
    const resultColor = matA.color.map((c, i) => c * ratioA + matB.color[i] * ratioB);

    // 3. Logic: Thermodynamic Reaction Calculation
    let volatility = (matA.volatility * ratioA) + (matB.volatility * ratioB);
    let heat = volatility * 0.5;
    let radioactivity = (matA.radioactive || 0) * ratioA + (matB.radioactive || 0) * ratioB;

    // HAZARD DETECTION LOGIC
    // E.g. Water + Sodium = Explosion
    let explosionTrigger = false;
    if ((chemA === 'H2O' && chemB === 'NA') || (chemA === 'NA' && chemB === 'H2O')) {
        heat = 10.0; // OFF THE CHARTS
        volatility = 20.0; // CHAOS
        resultColor[0] = 1.0; // Flash White
        explosionTrigger = true;
    }

    // "Blue Fire" Logic: Methane Combustion
    if (chemA === 'CH4' || chemB === 'CH4') {
        heat = Math.max(heat, 3.0);
        resultColor[2] = 2.0; // Super Blue
    }

    // 4. Return Physical Parameters for GPU
    res.json({
        success: true,
        physics: {
            heat: heat,                  // Determines Glow/Bloom strength
            flowSpeed: 0.1 + (volatility * 0.2), // Fluid speed
            turbulence: volatility,       // Noise scale
            viscosity: Math.max(0.1, 5.0 - heat), 
            radiation: radioactivity,     // Controls Chromatic Aberration
            baseColor: resultColor,
            shockwave: explosionTrigger ? 1.0 : 0.0
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Prometheus Logic Core active on port ${PORT}`));
