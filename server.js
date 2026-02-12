/* server.js - ENTROPY V6 LOGIC */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Color = require('color');
const path = require('path');
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- GRAND ARCHIVE EXPANDED ---
const DB = {
    // TIER 0: BASES
    'H2O': { name: 'Water', h: 0.1, v: 1.0, type: 0 },
    'DIRT': { name: 'Soil', h: 0.0, v: 5.0, type: 0 },
    'O2':   { name: 'Liquid Oxygen', h: -2.0, v: 0.1, type: 1 },

    // TIER 1: FUELS
    'CH4':  { name: 'Methane', h: 3.0, v: 0.1, type: 1, color: '#00E5FF' },
    'FIRE': { name: 'Plasma', h: 8.0, v: 0.0, type: 1, color: '#FF3D00' },
    'NITRO':{ name: 'C4 Explosive', h: 5.0, v: 5.0, type: 2, color: '#FFF9C4' },

    // TIER 2: EXOTIC
    'U235': { name: 'Uranium', h: 20.0, v: 5.0, type: 3, color: '#00FF00', rads: 10 },
    'ANTI': { name: 'Antimatter', h: 100.0, v: 0.0, type: 4, color: '#FFFFFF', rads: 100 },
    'VOID': { name: 'Dark Energy', h: -50.0, v: 0.0, type: 5, color: '#0a000a', rads: 50 },
    'GRAV': { name: 'Singularity', h: 1000.0, v: 100.0, type: 5, color: '#000000', rads: 500 }
};

app.post('/api/mix', (req, res) => {
    try {
        const { idA, massA, idB, massB } = req.body;
        const A = DB[idA] || DB['H2O'];
        const B = DB[idB] || DB['H2O'];

        // Physics mixing
        const rB = massB / (parseFloat(massA) + parseFloat(massB));
        
        let physics = {
            heat: (A.h * (1-rB)) + (B.h * rB),
            viscosity: (A.v * (1-rB)) + (B.v * rB),
            radiation: (A.rads || 0) + (B.rads || 0),
            color: Color(A.color || '#fff').mix(Color(B.color || '#fff'), rB).hex(),
            force: 0,      // Explosion force (for Particles)
            particles: 0,  // Number of particles
            shake: 0,      // Screen Shake
            invert: false,
            event: "STABLE"
        };

        // --- COMPLEX INTERACTIONS ---

        // 1. ANTIMATTER ANNIHILATION
        if (idA === 'ANTI' || idB === 'ANTI') {
            physics.event = "MATTER DELETION";
            physics.force = 50.0; 
            physics.particles = 2000;
            physics.heat = 500;
            physics.invert = true;
            physics.shake = 50;
        }

        // 2. BLACK HOLE CREATION (Void + Heavy Mass)
        if ((idA === 'VOID' && B.h > 10) || (idB === 'VOID' && A.h > 10)) {
            physics.event = "GRAVITATIONAL COLLAPSE";
            physics.force = -20.0; // Implosion (negative force)
            physics.particles = 500;
            physics.color = '#000000';
            physics.shake = 20;
        }

        // 3. EXPLOSION (Fire + Oxygen/Nitro)
        if ((idA === 'NITRO' && B.type === 1) || (idB === 'NITRO' && A.type === 1)) {
            physics.event = "DETONATION";
            physics.force = 15.0;
            physics.particles = 300;
            physics.heat = 50;
            physics.color = '#FFDD00';
            physics.shake = 5;
        }

        // 4. NUCLEAR CRITICALITY
        if (physics.radiation > 15) {
            physics.event = "CRITICAL RADIANT FLUX";
            physics.particles = 50 * physics.radiation; // Radioactive dust
            physics.force = 2.0;
            physics.shake = 2 + (physics.radiation * 0.1);
        }

        res.json({ success: true, reaction: physics });

    } catch(e) { console.error(e); res.status(500).json({error: "Reaction Failed"}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ENTROPY V6 SINGULARITY: PORT ${PORT}`));
