// Imports if Node environment
let PokerData = null;
if (typeof module !== 'undefined' && module.exports) {
    PokerData = require('./balatro-data.js');
} else {
    PokerData = window; // Assumes balatro-data.js loaded first
}

const SUITS = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 10, 'Q': 10, 'K': 10, 'A': 11
};

class Card {
    constructor(suit, rank, id) {
        this.suit = suit;
        this.rank = rank;
        this.id = id;
        this.value = RANK_VALUES[rank];
        this.selected = false;
        // Modifiers
        this.chipBonus = 0;
        this.multBonus = 0;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        let id = 0;
        for (const s of SUITS) {
            for (const r of RANKS) {
                this.cards.push(new Card(s, r, id++));
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw(count) {
        return this.cards.splice(0, count);
    }
}

class HandEvaluator {
    // Evaluates up to 5 cards
    static evaluate(cards) {
        if (!cards || cards.length === 0) {
             return { type: 'High Card', cards: [], chipValue: 0 };
        }

        // Sort by rank index (2=0, A=12)
        const sorted = [...cards].sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank));

        // Helper to check flush
        const isFlush = cards.every(c => c.suit === cards[0].suit) && cards.length === 5;

        // Helper to check straight
        let isStraight = false;
        if (cards.length === 5) {
            const indices = sorted.map(c => RANKS.indexOf(c.rank));
            // Check consecutive
            let consecutive = true;
            for(let i=0; i<4; i++) {
                if (indices[i+1] !== indices[i] + 1) consecutive = false;
            }
            // Check A-5 straight (A,2,3,4,5 -> indices 12,0,1,2,3)
            // Sorted: 2,3,4,5,A
            if (!consecutive && indices[4] === 12 && indices[0] === 0 && indices[1] === 1 && indices[2] === 2 && indices[3] === 3) {
                consecutive = true;
            }
            isStraight = consecutive;
        }

        // Count ranks
        const counts = {};
        for (const c of cards) {
            counts[c.rank] = (counts[c.rank] || 0) + 1;
        }
        const countValues = Object.values(counts).sort((a, b) => b - a); // [4, 1] etc

        let type = 'High Card';

        if (isFlush && isStraight) {
            // Check Royal
            const indices = sorted.map(c => RANKS.indexOf(c.rank));
            if (indices[4] === 12 && indices[0] === 8) { // 10,J,Q,K,A
                type = 'Royal Flush';
            } else {
                type = 'Straight Flush';
            }
        } else if (countValues[0] === 4) {
            type = 'Four of a Kind';
        } else if (countValues[0] === 3 && countValues[1] === 2) {
            type = 'Full House';
        } else if (isFlush) {
            type = 'Flush';
        } else if (isStraight) {
            type = 'Straight';
        } else if (countValues[0] === 3) {
            type = 'Three of a Kind';
        } else if (countValues[0] === 2 && countValues[1] === 2) {
            type = 'Two Pair';
        } else if (countValues[0] === 2) {
            type = 'Pair';
        }

        // Base Score Lookup
        const base = PokerData.POKER_HANDS[type];

        // Calculate Chip Value of SCORING cards
        // In Balatro, only scoring cards (e.g. the pair) count towards chips usually,
        // but for simplicity in this clone, let's say ALL played cards count towards chips
        // EXCEPT if logic dictates otherwise.
        // Balatro: Pair = Pair ranks count + other cards do not.
        // Let's implement Balatro style: Only relevant cards score.

        let scoringCards = [];
        if (['Royal Flush', 'Straight Flush', 'Flush', 'Straight', 'Full House'].includes(type)) {
            scoringCards = sorted; // All 5
        } else if (type === 'Four of a Kind') {
            const rank = Object.keys(counts).find(r => counts[r] === 4);
            scoringCards = sorted.filter(c => c.rank === rank);
        } else if (type === 'Three of a Kind') {
            const rank = Object.keys(counts).find(r => counts[r] === 3);
            scoringCards = sorted.filter(c => c.rank === rank);
        } else if (type === 'Two Pair') {
            const ranks = Object.keys(counts).filter(r => counts[r] === 2);
            scoringCards = sorted.filter(c => ranks.includes(c.rank));
        } else if (type === 'Pair') {
            const rank = Object.keys(counts).find(r => counts[r] === 2);
            scoringCards = sorted.filter(c => c.rank === rank);
        } else {
            // High Card: Only the highest card scores? No, usually just the highest card.
            // But wait, standard Poker evaluates 5 cards. Balatro lets you play up to 5.
            // If you play 5 random cards, it's High Card, but do all 5 add chips?
            // In Balatro, ONLY the specific card that triggers "High Card" (the highest one) counts?
            // Actually Balatro: "Scoring cards: The card with highest rank".
            // Let's stick to that.
            scoringCards = [sorted[sorted.length - 1]];
        }

        // Handle "Splash" joker or similar logic later, but for now strict rules.

        return {
            type: type,
            baseChips: base.chips,
            baseMult: base.mult,
            scoringCards: scoringCards,
            playedCards: cards
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Card, Deck, HandEvaluator };
} else {
    window.Card = Card;
    window.Deck = Deck;
    window.HandEvaluator = HandEvaluator;
}
