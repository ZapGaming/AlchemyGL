/**
 * THE ELEMENT TABLE
 * Define materials by their physical reaction to the engine.
 * 
 * heat: How hot it burns (0.0 = cold fluid, 2.0 = plasma)
 * density: 0 = smoke, 1 = water, 5 = sludge
 * volatility: How erratic the movement is
 * radiation: Adds noise/glitch effects to the render (camera interference)
 */

export const PERIODIC_TABLE = {
    DEFAULT: {
        baseColor: '#ffffff',
        accentColor: '#888888',
        heat: 0.1,
        density: 1.0,
        volatility: 0.2,
        radiation: 0.0
    },
    // The "Blue Fire"
    METHANE_PLASMA: {
        baseColor: '#0055ff',  // Deep Blue
        accentColor: '#aaffff', // Cyan-White hot core
        heat: 2.5,             // Extreme Heat
        density: 0.1,          // Light gas
        volatility: 2.0,       // Fast moving
        radiation: 0.1
    },
    // The Radioactive Sludge
    PLUTONIUM_239: {
        baseColor: '#1a1a1a',  // Black oil
        accentColor: '#39ff14', // Neon Green Glow
        heat: 1.2,             // Warm decaying heat
        density: 3.0,          // Heavy
        volatility: 0.4,       // Slow boiling
        radiation: 2.5         // HIGH Radiation (causes glitches)
    },
    // Volatile Chemical
    RED_MERCURY: {
        baseColor: '#550000',
        accentColor: '#ff0000',
        heat: 0.8,
        density: 1.2,
        volatility: 0.9,
        radiation: 0.0
    },
    NITROGEN_ICE: {
        baseColor: '#ffffff',
        accentColor: '#aaddff',
        heat: -1.0,            // Freezing
        density: 1.5,
        volatility: 0.1,
        radiation: 0.0
    }
};
