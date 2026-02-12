/* server.js - The Brain & Host */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Color = require('color');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. HOST THE DOCUMENTATION SITE (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// 2. THE CHEMICAL DATABASE
// Define atomic properties used for calculation
const DB = {
    // BASES
    'H2O': { name: 'Water', temp: 20, viscosity: 1.0, color: '#4FC3F7', radiation: 0, volatility: 0.1 },
    'OIL': { name: 'Crude Oil', temp: 35, viscosity: 2.5, color: '#1A1A1A', radiation: 0, volatility: 0.8 },
    'ACID': { name: 'Sulfuric Acid', temp: 40, viscosity: 1.2, color: '#76FF03', radiation: 0, volatility: 1.2 },
    
    // FUELS & FIRE
    'CH4': { name: 'Methane', temp: 40, viscosity: 0.1, color: '#2979FF', radiation: 0, volatility: 5.0, type: 'fuel' },
    'NAPALM': { name: 'Napalm', temp: 50, viscosity: 3.0, color: '#FF6D00', radiation: 0, volatility: 4.0, type: 'fuel' },
    
    // EXOTIC / RADIOACTIVE
    'U235': { name: 'Uranium 235', temp: 80, viscosity: 5.0, color: '#00E676', radiation: 5.0, volatility: 0.2 },
    'Pu':   { name: 'Plutonium', temp: 120, viscosity: 4.0, color: '#D500F9', radiation: 9.0, volatility: 1.0 },
    'XEN':  { name: 'Xenon Gas', temp: -100, viscosity: 0.0, color: '#E040FB', radiation: 0.5, volatility: 0.1 },

    // CATALYSTS
    'NA':   { name: 'Sodium', temp: 25, viscosity: 2.0, color: '#BDBDBD', volatility: 2.0, type: 'reactive' }
};

// 3. PHYSICS SIMULATION ENGINE
app.post('/api/react', (req, res) => {
    try {
        const { idA, amountA, idB, amountB } = req.body;
        
        const matA = DB[idA] || DB['H2O'];
        const matB = DB[idB] || DB['H2O'];

        // Mass Ratios
        const total = amountA + amountB;
        const rA = amountA / total;
        const rB = amountB / total;

        // Base Physics Interpolation
        let temp = (matA.temp * rA) + (matB.temp * rB);
        let visc = (matA.viscosity * rA) + (matB.viscosity * rB);
        let rads = Math.max(matA.radiation, matB.radiation); // Radiation doesn't dilute easily
        let vol = (matA.volatility * rA) + (matB.volatility * rB);
        
        // Color mixing
        const cA = Color(matA.color);
        const cB = Color(matB.color);
        let hex = cA.mix(cB, rB).hex();
        
        // EVENT LOGIC TREE
        let event = "STABLE";
        let shockwave = 0;

        // Reaction: Explosion (Water + Alkali Metal)
        if ((matA.name === 'Water' && matB.type === 'reactive') || (matB.name === 'Water' && matA.type === 'reactive')) {
            event = "EXPLOSION";
            temp = 4000;
            vol = 10.0;
            shockwave = 1.0;
            hex = '#FFFDE7'; // Flash white
        }

        // Reaction: Combustion (Fuel + High Temp or Spark)
        if ((matA.type === 'fuel' || matB.type === 'fuel') && temp > 30) {
            event = "IGNITION";
            temp = Math.max(temp, 1200);
            vol = Math.max(vol, 4.0);
            hex = matA.name === 'Methane' ? '#00B0FF' : '#FF3D00'; // Blue vs Orange fire
        }

        // Reaction: Meltdown (Critical Radiation)
        if (rads > 4.0) {
            event = "CRITICAL RADIANT FLUX";
            visc = 0.5; // Breakdown of matter
            hex = '#76FF03'; // Nuclear green tint
            // Increase noise volatility due to particle decay
            vol += 2.0;
        }

        res.json({
            status: "success",
            reaction: {
                temp: temp,
                viscosity: visc,
                radiation: rads,
                volatility: vol,
                color: hex,
                event: event,
                shockwave: shockwave
            }
        });

    } catch (e) {
        res.status(500).json({ error: "Reaction Calculation Failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AETHER ENGINE ONLINE at port ${PORT}`));
