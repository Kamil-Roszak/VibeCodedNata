(function() {
    const POKER_HANDS = {
        'High Card': { chips: 5, mult: 1 },
        'Pair': { chips: 10, mult: 2 },
        'Two Pair': { chips: 20, mult: 2 },
        'Three of a Kind': { chips: 30, mult: 3 },
        'Straight': { chips: 30, mult: 4 },
        'Flush': { chips: 35, mult: 4 },
        'Full House': { chips: 40, mult: 4 },
        'Four of a Kind': { chips: 60, mult: 7 },
        'Straight Flush': { chips: 100, mult: 8 },
        'Royal Flush': { chips: 100, mult: 8 }
    };

    const JOKER_DEFINITIONS = [
        {
            id: 'cola',
            name: 'Nata Cola',
            desc: '+4 Mult',
            cost: 4,
            asset: 'assets/products/cola.png',
            trigger: 'passive', // Applied at end calculation
            effect: (stats) => { stats.mult += 4; return true; }
        },
        {
            id: 'orange',
            name: 'Nata Orange',
            desc: '+15 Chips',
            cost: 4,
            asset: 'assets/products/orange.png',
            trigger: 'passive',
            effect: (stats) => { stats.chips += 15; return true; }
        },
        {
            id: 'lime',
            name: 'Nata Lime',
            desc: 'x1.5 Mult',
            cost: 6,
            asset: 'assets/products/lime.png',
            trigger: 'passive',
            effect: (stats) => { stats.mult = Math.floor(stats.mult * 1.5); return true; }
        },
        {
            id: 'berry',
            name: 'Nata Berry',
            desc: '+3 Mult for each Heart scored',
            cost: 5,
            asset: 'assets/products/berry.png',
            trigger: 'card_score', // Called per card
            effect: (stats, card) => {
                if (card.suit === 'Hearts') {
                    stats.mult += 3;
                    return true;
                }
                return false;
            }
        },
        {
            id: 'lemon',
            name: 'Nata Lemon',
            desc: '+30 Chips if hand contains a Pair',
            cost: 5,
            asset: 'assets/products/lemon.png',
            trigger: 'hand_eval', // Called once based on context
            effect: (stats) => {
                if (stats.type.includes('Pair')) { // Pair, Two Pair
                    stats.chips += 30;
                    return true;
                }
                return false;
            }
        }
    ];

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { POKER_HANDS, JOKER_DEFINITIONS };
    } else {
        window.POKER_HANDS = POKER_HANDS;
        window.JOKER_DEFINITIONS = JOKER_DEFINITIONS;
    }
})();
