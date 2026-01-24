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
            type: 'mult_add',
            value: 4
        },
        {
            id: 'orange',
            name: 'Nata Orange',
            desc: '+15 Chips',
            cost: 4,
            asset: 'assets/products/orange.png',
            type: 'chips_add',
            value: 15
        },
        {
            id: 'lime',
            name: 'Nata Lime',
            desc: 'x1.5 Mult',
            cost: 6,
            asset: 'assets/products/lime.png',
            type: 'mult_mult',
            value: 1.5
        },
        {
            id: 'berry',
            name: 'Nata Berry',
            desc: '+3 Mult for each Heart played',
            cost: 5,
            asset: 'assets/products/berry.png',
            type: 'conditional_mult',
            condition: 'suit_heart',
            value: 3
        },
        {
            id: 'lemon',
            name: 'Nata Lemon',
            desc: '+30 Chips if hand contains a Pair',
            cost: 5,
            asset: 'assets/products/lemon.png',
            type: 'conditional_chips',
            condition: 'hand_Pair',
            value: 30
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
