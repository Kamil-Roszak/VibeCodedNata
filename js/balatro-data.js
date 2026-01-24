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

    const CONSUMABLE_DEFINITIONS = [
        // Planets (Level Up)
        { id: 'planet_pluto', name: 'Pluto', type: 'planet', desc: 'Level up High Card', target: 'High Card', cost: 3 },
        { id: 'planet_mercury', name: 'Mercury', type: 'planet', desc: 'Level up Pair', target: 'Pair', cost: 3 },
        { id: 'planet_uranus', name: 'Uranus', type: 'planet', desc: 'Level up Two Pair', target: 'Two Pair', cost: 3 },
        { id: 'planet_venus', name: 'Venus', type: 'planet', desc: 'Level up Three of a Kind', target: 'Three of a Kind', cost: 3 },
        { id: 'planet_saturn', name: 'Saturn', type: 'planet', desc: 'Level up Straight', target: 'Straight', cost: 3 },
        { id: 'planet_jupiter', name: 'Jupiter', type: 'planet', desc: 'Level up Flush', target: 'Flush', cost: 3 },
        { id: 'planet_earth', name: 'Earth', type: 'planet', desc: 'Level up Full House', target: 'Full House', cost: 3 },
        { id: 'planet_mars', name: 'Mars', type: 'planet', desc: 'Level up Four of a Kind', target: 'Four of a Kind', cost: 3 },
        { id: 'planet_neptune', name: 'Neptune', type: 'planet', desc: 'Level up Straight Flush', target: 'Straight Flush', cost: 3 },
        // Tarots (Effect)
        { id: 'tarot_fool', name: 'The Fool', type: 'tarot', desc: 'Spawns last used Planet/Tarot', cost: 3 },
        { id: 'tarot_magician', name: 'The Magician', type: 'tarot', desc: 'Enhance 2 cards to Lucky Cards', cost: 3 },
        { id: 'tarot_empress', name: 'The Empress', type: 'tarot', desc: 'Enhance 2 cards to Mult Cards', cost: 3 },
        { id: 'tarot_strength', name: 'Strength', type: 'tarot', desc: 'Increase rank of up to 2 cards by 1', cost: 3 },
        { id: 'tarot_death', name: 'Death', type: 'tarot', desc: 'Select 2 cards, turn the left into the right', cost: 3 }
    ];

    const BLIND_DEFINITIONS = {
        'Small': { name: 'Small Blind', scoreMult: 1.0, reward: 3 },
        'Big': { name: 'Big Blind', scoreMult: 1.5, reward: 4 },
        'Boss': [
            { id: 'boss_hook', name: 'The Hook', desc: 'Discard 2 random cards per hand played', scoreMult: 2.0, reward: 5 },
            { id: 'boss_wall', name: 'The Wall', desc: 'Extra large blind', scoreMult: 4.0, reward: 5 },
            { id: 'boss_goad', name: 'The Goad', desc: 'All Spades are debuffed', scoreMult: 2.0, reward: 5 },
            { id: 'boss_club', name: 'The Club', desc: 'All Clubs are debuffed', scoreMult: 2.0, reward: 5 },
            { id: 'boss_window', name: 'The Window', desc: 'All Diamonds are debuffed', scoreMult: 2.0, reward: 5 },
            { id: 'boss_head', name: 'The Head', desc: 'All Hearts are debuffed', scoreMult: 2.0, reward: 5 },
            { id: 'boss_manacle', name: 'The Manacle', desc: '-1 Hand Size', scoreMult: 2.0, reward: 5 }
        ]
    };

    const VOUCHER_DEFINITIONS = [
        { id: 'v_paint', name: 'Paint Brush', desc: '+1 Hand Size', cost: 10 },
        { id: 'v_grabber', name: 'Grabber', desc: '+1 Hand per round', cost: 10 },
        { id: 'v_waste', name: 'Wasteful', desc: '+1 Discard per round', cost: 10 },
        { id: 'v_seed', name: 'Seed Money', desc: 'Raise interest cap to $10', cost: 10 },
        { id: 'v_blank', name: 'Blank', desc: 'Does nothing?', cost: 10 }
    ];

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { POKER_HANDS, JOKER_DEFINITIONS, CONSUMABLE_DEFINITIONS, BLIND_DEFINITIONS, VOUCHER_DEFINITIONS };
    } else {
        window.POKER_HANDS = POKER_HANDS;
        window.JOKER_DEFINITIONS = JOKER_DEFINITIONS;
        window.CONSUMABLE_DEFINITIONS = CONSUMABLE_DEFINITIONS;
        window.BLIND_DEFINITIONS = BLIND_DEFINITIONS;
        window.VOUCHER_DEFINITIONS = VOUCHER_DEFINITIONS;
    }
})();
