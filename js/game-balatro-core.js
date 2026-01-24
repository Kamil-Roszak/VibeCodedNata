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
    const CONSUMABLE_DEFINITIONS = BalatroData.CONSUMABLE_DEFINITIONS || window.CONSUMABLE_DEFINITIONS;
    const BLIND_DEFINITIONS = BalatroData.BLIND_DEFINITIONS || window.BLIND_DEFINITIONS;

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
                if (c.debuffed) {
                    if (verbose) {
                        breakdown.push({
                            source: 'card',
                            card: c,
                            chips: 0,
                            mult: 0,
                            totalChips: chips,
                            totalMult: mult,
                            note: 'Debuffed'
                        });
                    }
                    continue; // Skip scoring for debuffed card
                }

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

            this.money = 0;

            // Ante / Blind System
            this.ante = 1;
            this.blindIndex = 0; // 0=Small, 1=Big, 2=Boss
            this.currentBlind = null; // Object info

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

        getBlindInfo() {
            // Base score for Ante 1: 300
            // Scaling is exponential-ish. Let's approximate Balatro:
            // Ante 1: 300, 450, 600
            // Ante 2: 800, 1200, 1600
            // Logic: Base * (Scaling ^ Ante) * BlindMult

            const base = 300 * Math.pow(2.5, this.ante - 1); // approximate

            let blindType = 'Small';
            let blindDef = BLIND_DEFINITIONS['Small'];

            if (this.blindIndex === 1) {
                blindType = 'Big';
                blindDef = BLIND_DEFINITIONS['Big'];
            } else if (this.blindIndex === 2) {
                blindType = 'Boss';
                // Select a boss deterministically or randomly (for now random from list)
                // In real game, boss is known at start of Ante.
                // Simplification: Pick random boss every time we hit index 2 or persist it?
                // Let's persist if we had persistent Ante state, but for now just pick one.
                const bosses = BLIND_DEFINITIONS['Boss'];
                blindDef = bosses[this.ante % bosses.length]; // Deterministic-ish loop
            }

            return {
                type: blindType,
                name: blindDef.name,
                desc: blindDef.desc || '',
                target: Math.floor(base * blindDef.scoreMult),
                reward: blindDef.reward,
                id: blindDef.id
            };
        }

        startRound() {
            this.currentScore = 0;
            this.handsLeft = 4;
            this.discardsLeft = 4;

            this.currentBlind = this.getBlindInfo();
            this.targetScore = this.currentBlind.target;

            // Apply Blind Debuffs (Boss)
            if (this.currentBlind.id === 'boss_manacle') {
                this.maxHandSize = 7;
            } else {
                this.maxHandSize = 8;
            }

            this.deck.reset();
            this.drawHand();
            this.state = 'PLAYING';
            this.emitUpdate();
        }

        drawHand() {
            const needed = this.maxHandSize - this.hand.length;
            if (needed > 0) {
                const newCards = this.deck.draw(needed);

                // Check Debuffs (Boss Blind)
                if (this.currentBlind && this.currentBlind.type === 'Boss') {
                    newCards.forEach(c => {
                        if (this.isCardDebuffed(c)) {
                            c.debuffed = true;
                        }
                    });
                }

                this.hand.push(...newCards);
                // Sort by rank value
                this.hand.sort((a,b) => a.value - b.value);
            }
        }

        isCardDebuffed(card) {
            if (!this.currentBlind) return false;
            const id = this.currentBlind.id;

            if (id === 'boss_goad' && card.suit === 'Spades') return true;
            if (id === 'boss_club' && card.suit === 'Clubs') return true;
            if (id === 'boss_window' && card.suit === 'Diamonds') return true;
            if (id === 'boss_head' && card.suit === 'Hearts') return true;

            return false;
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
                // Money Logic
                const interest = Math.min(5, Math.floor(this.money / 5));
                const handsBonus = this.handsLeft;
                const blindReward = this.currentBlind.reward;
                this.money += blindReward + handsBonus + interest;

                // Progress Ante/Blind
                this.blindIndex++;
                if (this.blindIndex > 2) {
                    this.blindIndex = 0;
                    this.ante++;
                }

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

        buyConsumable(id) {
            if (this.state !== 'SHOP') return;
            const item = CONSUMABLE_DEFINITIONS.find(c => c.id === id);
            if (item && this.money >= item.cost) {
                // Find empty slot
                const slotIndex = this.consumables.findIndex(s => s === null);
                if (slotIndex !== -1) {
                    this.consumables[slotIndex] = { ...item };
                    this.money -= item.cost;
                    this.emitUpdate();
                    return true;
                }
            }
            return false;
        }

        useConsumable(index) {
            const item = this.consumables[index];
            if (!item) return;

            // Effect Logic
            if (item.type === 'planet') {
                if (this.handLevels[item.target]) {
                    this.handLevels[item.target]++;
                    this.consumables[index] = null;
                    this.emitUpdate();
                }
            } else if (item.type === 'tarot') {
                const selected = this.getSelectedCards();
                let used = false;

                if (item.id === 'tarot_strength') {
                    // Increase rank of up to 2 cards
                    if (selected.length > 0 && selected.length <= 2) {
                        selected.forEach(c => {
                            // Simple rank up logic (2->3... K->A)
                            // Ideally needs a rank map lookup to next rank
                            c.value += 1; // Simplified: just buff value for now or logic needed
                            // Proper logic would be changing c.rank string
                        });
                        used = true;
                    }
                } else if (item.id === 'tarot_empress') {
                     // Enhance 2 cards to Mult Cards
                     if (selected.length > 0 && selected.length <= 2) {
                         selected.forEach(c => c.multBonus = (c.multBonus || 0) + 4);
                         used = true;
                     }
                } else if (item.id === 'tarot_magician') {
                    // Lucky Card: Chance for $20 or +20 Mult
                    if (selected.length > 0 && selected.length <= 2) {
                        selected.forEach(c => c.chipBonus = (c.chipBonus || 0) + 20); // Simplified to Bonus Chips
                        used = true;
                    }
                }

                if (used) {
                    this.consumables[index] = null;
                    // Deselect
                    this.hand.forEach(c => c.selected = false);
                    this.emitUpdate();
                }
            }
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
                    ante: this.ante,
                    blind: this.currentBlind,
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
