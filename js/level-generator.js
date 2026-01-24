class LevelGenerator {
    constructor() {
        this.baseSeed = 12345;
    }

    // Simple pseudo-random number generator
    random(seed) {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    getConfig(level) {
        // Deterministic generation based on level
        const seed = this.baseSeed + level * 100;

        // Difficulty scaling
        const size = Math.min(8, 6 + Math.floor(level / 5)); // Start 6x6, max 8x8
        const types = Math.min(5, 3 + Math.floor(level / 3)); // Start 3 colors, max 5
        const moves = 20 - Math.floor(level / 10); // Decrease moves slightly
        const targetScore = 1000 + (level - 1) * 500;

        return {
            level: level,
            rows: size,
            cols: size,
            types: types, // Number of distinct bottle types
            moves: Math.max(10, moves),
            targetScore: targetScore
        };
    }
}

// Export for Node (testing) and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LevelGenerator;
} else {
    window.LevelGenerator = LevelGenerator;
}
