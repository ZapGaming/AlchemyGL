/* server.js - THE MOLECULAR DATABASE */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// REAL WORLD CHEMISTRY DATABASE
const REACTIONS = {
    // 1. ELEPHANT'S TOOTHPASTE (Exothermic Foam)
    'H2O2_KI': {
        name: "Elephant's Toothpaste",
        equation: "2H₂O₂ → 2H₂O + O₂",
        enthalpy: "-98.2 kJ/mol (Exothermic)",
        visuals: {
            type: "FOAM",
            baseColor: [1.0, 1.0, 0.9], // White/Cream
            secondaryColor: [0.8, 0.6, 0.2], // Brown iodine byproduct
            expansion: 8.0, // High volumetric expansion
            viscosity: 8.0, // Thick foam
            speed: 5.0, // Fast reaction
            glow: 0.0
        }
    },
    // 2. LUMINOL (Chemiluminescence)
    'C8H7N3O2_H2O2': {
        name: "Luminol Oxidation",
        equation: "C₈H₇N₃O₂ + H₂O₂ → Blue Light + N₂",
        enthalpy: "- Energy released as Photons",
        visuals: {
            type: "LIQUID",
            baseColor: [0.0, 0.1, 1.0], // Deep Blue
            secondaryColor: [0.2, 0.8, 1.0], // Cyan Glow
            expansion: 1.0, 
            viscosity: 1.0, 
            speed: 2.0,
            glow: 5.0 // HIGH EMISSION
        }
    },
    // 3. GOLDEN RAIN (Precipitation)
    'PB_I': {
        name: "Golden Rain (Lead Iodide)",
        equation: "Pb(NO₃)₂ + 2KI → PbI₂ + 2KNO₃",
        enthalpy: "Precipitation Reaction",
        visuals: {
            type: "PARTICLE",
            baseColor: [1.0, 1.0, 0.0], // Gold
            secondaryColor: [1.0, 0.8, 0.0],
            expansion: 1.0,
            viscosity: 1.5,
            speed: 0.5,
            particles: true // Enable solid physics
        }
    },
    // 4. BRIGGS-RAUSCHER (Oscillating)
    'OSC': {
        name: "Briggs-Rauscher",
        equation: "Oscillatory Cycle (IO₃⁻ / I₂ / I⁻)",
        enthalpy: "Complex Kinetics",
        visuals: {
            type: "CYCLE",
            colors: [[0.9, 0.6, 0.2], [0.1, 0.1, 0.1], [0.0, 0.0, 0.5]], // Amber -> Black -> Blue
            speed: 1.0
        }
    },
    'NULL': {
        name: "No Reaction",
        equation: "N/A",
        enthalpy: "0 kJ/mol",
        visuals: { type: "LIQUID", baseColor:[0.5,0.7,0.8], speed:0.1 }
    }
};

app.post('/api/analyze', (req, res) => {
    const { reactantA, reactantB } = req.body;
    let key = `${reactantA}_${reactantB}`;
    
    // Check reverse combination
    if(!REACTIONS[key]) key = `${reactantB}_${reactantA}`;
    
    const result = REACTIONS[key] || REACTIONS['NULL'];
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ISOTOPE ENGINE PORT ${PORT}`));
