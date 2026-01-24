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

        calculateScore(handStats, verbose = false) {
            // HandStats: { type, baseChips, baseMult, scoringCards, playedCards }

            let chips = handStats.baseChips;
            let mult = handStats.baseMult;
            let breakdown = []; // Event log for animation

            // 1. Card Scoring (Chips)
            for (const c of handStats.scoringCards) {
                const cardChips = c.value + (c.chipBonus || 0);
                chips += cardChips;

                if (verbose) {
                    breakdown.push({
                        source: 'card',
                        card: c,
                        chips: cardChips,
                        mult: 0,
                        totalChips: chips,
                        totalMult: mult
                    });
                }

                // Joker Card Triggers (e.g., +Mult per Heart played)
                this.jokers.forEach(joker => {
                    if (joker.trigger === 'card_score') {
                         if (joker.effect({ chips, mult }, c)) {
                             // Effect applied internally to stats object passed in?
                             // Wait, we need to handle stats updates.
                             // Redefine effect to return delta or modify object.
                             // Let's pass a proxy object or just current values.
                             // Actually, let's just re-implement logic here or trust data.js

                             // Re-evaluating approach: data.js defines effect(stats, card)
                             // where stats = { chips, mult }
                             const statsObj = { chips, mult };
                             if (joker.effect(statsObj, c)) {
                                 chips = statsObj.chips;
                                 mult = statsObj.mult;
                                 if (verbose) {
                                     breakdown.push({
                                         source: 'joker',
                                         joker: joker,
                                         chips: chips,
                                         mult: mult
                                     });
                                 }
                             }
                         }
                    }
                });
            }

            // 2. Hand Evaluation Triggers (e.g. "If Pair")
            this.jokers.forEach(joker => {
                if (joker.trigger === 'hand_eval') {
                    const statsObj = { chips, mult, type: handStats.type };
                    if (joker.effect(statsObj)) {
                        chips = statsObj.chips;
                        mult = statsObj.mult;
                        if (verbose) {
                            breakdown.push({
                                source: 'joker',
                                joker: joker,
                                chips: chips,
                                mult: mult
                            });
                        }
                    }
                }
            });

            // 3. Passive / End Calculation Triggers (+Mult, X Mult)
            this.jokers.forEach(joker => {
                if (joker.trigger === 'passive') {
                    const statsObj = { chips, mult };
                    if (joker.effect(statsObj)) {
                        chips = statsObj.chips;
                        mult = statsObj.mult;
                        if (verbose) {
                            breakdown.push({
                                source: 'joker',
                                joker: joker,
                                chips: chips,
                                mult: mult
                            });
                        }
                    }
                }
            });

            return {
                chips: Math.floor(chips),
                mult: Math.floor(mult),
                total: Math.floor(chips * mult),
                breakdown: breakdown
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
            // Pass verbose=false to just get numbers
            const scoreResult = this.jokerManager.calculateScore(stats, false);

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

            // Calculate Score with breakdown for animation
            const scoreResult = this.jokerManager.calculateScore(stats, true);

            // We update score AFTER animation in view, but core state needs to be consistent.
            // But wait, if we update score here, view will jump.
            // Actually, we should probably update score immediately in state,
            // but view will animate from old score to new score?
            // Balatro adds points incrementally.
            // Let's store Pending Score or handle it.
            // For now, update total but view handles incremental display.
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
