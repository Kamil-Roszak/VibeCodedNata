(function() {
    // Imports
    let PokerLogic = null;
    let BalatroData = null;

    if (typeof module !== 'undefined' && module.exports) {
        PokerLogic = require('./game-balatro-poker.js');
        BalatroData = require('./balatro-data.js');
    } else {
        PokerLogic = window; // Assumes game-balatro-poker.js loaded
        BalatroData = window; // Assumes balatro-data.js loaded
    }

    // Ensure dependencies exist
    const Deck = PokerLogic.Deck || window.Deck;
    const HandEvaluator = PokerLogic.HandEvaluator || window.HandEvaluator;
    const JOKER_DEFINITIONS = BalatroData.JOKER_DEFINITIONS || window.JOKER_DEFINITIONS;

    if (!Deck || !HandEvaluator || !JOKER_DEFINITIONS) {
        console.error("Balatro Core: Dependencies missing", {Deck, HandEvaluator, JOKER_DEFINITIONS});
        return;
    }

    class JokerManager {
        constructor() {
            this.jokers = [];
            this.maxJokers = 5;
        }

        addJoker(id) {
            if (this.jokers.length >= this.maxJokers) return false;
            const def = JOKER_DEFINITIONS.find(j => j.id === id);
            if (def) {
                this.jokers.push({ ...def }); // Clone
                return true;
            }
            return false;
        }

        calculateScore(handStats) {
            // HandStats: { type, baseChips, baseMult, scoringCards, playedCards }

            let chips = handStats.baseChips;
            let mult = handStats.baseMult;

            // 1. Add Card Chips
            for (const c of handStats.scoringCards) {
                chips += c.value + (c.chipBonus || 0);
            }

            // 2. Joker Logic
            for (const joker of this.jokers) {
                // Check Conditions
                let active = true;
                if (joker.condition) {
                    if (joker.condition === 'suit_heart') {
                        // Count hearts in played cards (or scoring? Balatro says "played")
                        // Usually trigger per card. But here we might just simplify.
                        // Let's implement specific logic per joker type.
                    } else if (joker.condition === 'hand_Pair') {
                        if (handStats.type !== 'Pair') active = false;
                    }
                }

                if (!active) continue;

                // Apply Effects
                if (joker.type === 'mult_add') {
                    mult += joker.value;
                } else if (joker.type === 'chips_add') {
                    chips += joker.value;
                } else if (joker.type === 'mult_mult') {
                    mult *= joker.value;
                } else if (joker.type === 'conditional_mult') {
                    if (joker.condition === 'suit_heart') {
                        const hearts = handStats.playedCards.filter(c => c.suit === 'Hearts').length;
                        mult += hearts * joker.value;
                    }
                } else if (joker.type === 'conditional_chips') {
                     // Condition checked above
                     chips += joker.value;
                }
            }

            return {
                chips: Math.floor(chips),
                mult: Math.floor(mult),
                total: Math.floor(chips * mult)
            };
        }
    }

    class BalatroGame {
        constructor(config) {
            this.deck = new Deck();
            this.hand = [];
            this.jokerManager = new JokerManager();
            this.consumables = [null, null]; // Max 2 slots
            this.handLevels = {}; // Key: Hand Type, Value: Level (Int)

            this.round = 1;
            this.money = 0;

            // Round State
            this.targetScore = 300;
            this.currentScore = 0;
            this.handsLeft = 4;
            this.discardsLeft = 4;
            this.maxHandSize = 8;

            this.state = 'PLAYING'; // PLAYING, SHOP, GAME_OVER
            this.callbacks = config?.callbacks || {};

            this.initHandLevels();
        }

        initHandLevels() {
            const types = [
                'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
                'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'
            ];
            types.forEach(t => this.handLevels[t] = 1);
        }

        startRound() {
            this.currentScore = 0;
            this.handsLeft = 4;
            this.discardsLeft = 4;
            this.deck.reset();
            this.drawHand();
            this.state = 'PLAYING';
            this.emitUpdate();
        }

        drawHand() {
            const needed = this.maxHandSize - this.hand.length;
            if (needed > 0) {
                const newCards = this.deck.draw(needed);
                this.hand.push(...newCards);
                // Sort hand by rank for UX
                // Or keep draw order? Balatro sorts.
                // Let's sort by rank value
                this.hand.sort((a,b) => a.value - b.value);
            }
        }

        selectCard(cardId) {
            const card = this.hand.find(c => c.id === cardId);
            if (card) {
                card.selected = !card.selected;
                this.emitUpdate();
            }
        }

        getSelectedCards() {
            return this.hand.filter(c => c.selected);
        }

        sortHand(by) {
            if (by === 'rank') {
                this.hand.sort((a,b) => b.value - a.value);
            } else if (by === 'suit') {
                this.hand.sort((a,b) => a.suit.localeCompare(b.suit) || b.value - a.value);
            }
            this.emitUpdate();
        }

        getHandLevelStats(type) {
            const level = this.handLevels[type] || 1;
            // Simple scaling: +10 Chips, +1 Mult per level above 1
            const bonusChips = (level - 1) * 10;
            const bonusMult = (level - 1) * 1;
            return { level, bonusChips, bonusMult };
        }

        evaluateSelectedHand() {
            const selected = this.getSelectedCards();
            if (selected.length === 0) return null;

            const stats = HandEvaluator.evaluate(selected);

            // Apply Levels
            const levelInfo = this.getHandLevelStats(stats.type);
            stats.baseChips += levelInfo.bonusChips;
            stats.baseMult += levelInfo.bonusMult;
            stats.level = levelInfo.level;

            // Calculate Score (Jokers etc)
            const scoreResult = this.jokerManager.calculateScore(stats);

            return {
                handType: stats.type,
                level: stats.level,
                chips: scoreResult.chips,
                mult: scoreResult.mult,
                total: scoreResult.total,
                scoringCards: stats.scoringCards
            };
        }

        playHand() {
            if (this.handsLeft <= 0 || this.state !== 'PLAYING') return;

            const selected = this.getSelectedCards();
            if (selected.length === 0 || selected.length > 5) return; // Invalid

            // Evaluate first to capture stats
            const stats = HandEvaluator.evaluate(selected);

            // Apply Levels
            const levelInfo = this.getHandLevelStats(stats.type);
            stats.baseChips += levelInfo.bonusChips;
            stats.baseMult += levelInfo.bonusMult;
            stats.level = levelInfo.level;

            // Remove from hand
            this.hand = this.hand.filter(c => !c.selected);

            const scoreResult = this.jokerManager.calculateScore(stats);

            this.currentScore += scoreResult.total;
            this.handsLeft--;

            // Callback for animation
            if (this.callbacks.onHandPlayed) {
                this.callbacks.onHandPlayed({
                    cards: selected,
                    stats: stats,
                    score: scoreResult
                });
            }

            // Check Win/Loss
            if (this.currentScore >= this.targetScore) {
                this.endRound(true);
            } else if (this.handsLeft === 0) {
                this.endRound(false); // Game Over
            } else {
                this.drawHand();
                this.emitUpdate();
            }
        }

        discard() {
            if (this.discardsLeft <= 0 || this.state !== 'PLAYING') return;

            const selected = this.getSelectedCards();
            if (selected.length === 0 || selected.length > 5) return;

            // Discard
            this.hand = this.hand.filter(c => !c.selected);
            this.discardsLeft--;
            this.drawHand();
            this.emitUpdate();
        }

        endRound(win) {
            if (win) {
                this.money += 5 + this.handsLeft; // Simple money logic
                this.round++;
                this.targetScore = Math.floor(this.targetScore * 1.5); // Scale up
                this.state = 'SHOP';
                if (this.callbacks.onRoundEnd) this.callbacks.onRoundEnd(true);
            } else {
                this.state = 'GAME_OVER';
                if (this.callbacks.onRoundEnd) this.callbacks.onRoundEnd(false);
            }
            this.emitUpdate();
        }

        buyJoker(id) {
            if (this.state !== 'SHOP') return;
            const jokerDef = JOKER_DEFINITIONS.find(j => j.id === id);
            if (jokerDef && this.money >= jokerDef.cost) {
                if (this.jokerManager.addJoker(id)) {
                    this.money -= jokerDef.cost;
                    this.emitUpdate();
                    return true;
                }
            }
            return false;
        }

        nextRound() {
            if (this.state === 'SHOP') {
                this.startRound();
            }
        }

        emitUpdate() {
            if (this.callbacks.onUpdate) {
                this.callbacks.onUpdate({
                    hand: this.hand,
                    round: this.round,
                    money: this.money,
                    target: this.targetScore,
                    current: this.currentScore,
                    handsLeft: this.handsLeft,
                    discardsLeft: this.discardsLeft,
                    jokers: this.jokerManager.jokers,
                    consumables: this.consumables,
                    state: this.state
                });
            }
        }
    }

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { BalatroGame, JokerManager };
    } else {
        window.BalatroGame = BalatroGame;
        window.JokerManager = JokerManager;
    }
})();
