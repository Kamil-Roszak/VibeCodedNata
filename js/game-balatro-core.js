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
    const RANKS = PokerLogic.RANKS || window.RANKS;
    const RANK_VALUES = PokerLogic.RANK_VALUES || window.RANK_VALUES;
    const JOKER_DEFINITIONS = BalatroData.JOKER_DEFINITIONS || window.JOKER_DEFINITIONS;
    const CONSUMABLE_DEFINITIONS = BalatroData.CONSUMABLE_DEFINITIONS || window.CONSUMABLE_DEFINITIONS;
    const BLIND_DEFINITIONS = BalatroData.BLIND_DEFINITIONS || window.BLIND_DEFINITIONS;
    const VOUCHER_DEFINITIONS = BalatroData.VOUCHER_DEFINITIONS || window.VOUCHER_DEFINITIONS;

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
            this.vouchers = []; // Passive upgrades

            this.money = 0;

            // Ante / Blind System
            this.ante = 1;
            this.blindIndex = 0; // 0=Small, 1=Big, 2=Boss
            this.currentBlind = null; // Object info

            // Tags
            this.nextTag = null; // Generated when entering Blind Select
            this.tags = []; // Accumulated Tags
            this.lastUsedConsumable = null;

            // Round State
            this.targetScore = 300;
            this.currentScore = 0;
            this.handsLeft = 4;
            this.discardsLeft = 4;
            this.maxHandSize = 8;

            this.state = 'PLAYING'; // PLAYING, SHOP, GAME_OVER
            this.callbacks = config?.callbacks || {};

            // Shop State
            this.shop = {
                jokers: [],
                consumables: [],
                vouchers: []
            };

            this.initHandLevels();
        }

        generateShop() {
            // Check for Charm Tag (Free Shop)
            const charmTagIndex = this.tags.findIndex(t => t.id === 'tag_charm');
            const isFree = charmTagIndex !== -1;

            // 1. Generate 2 Random Jokers
            this.shop.jokers = [];
            const ownedIds = this.jokerManager.jokers.map(j => j.id);
            const availableJokers = JOKER_DEFINITIONS.filter(j => !ownedIds.includes(j.id));

            // Shuffle available
            for (let i = availableJokers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableJokers[i], availableJokers[j]] = [availableJokers[j], availableJokers[i]];
            }

            const selectedJokers = availableJokers.slice(0, 2);
            this.shop.jokers = selectedJokers.map(j => ({ ...j, cost: isFree ? 0 : j.cost }));

            // 2. Generate 2 Random Consumables
            this.shop.consumables = [];
            const availableCons = [...CONSUMABLE_DEFINITIONS];
             for (let i = availableCons.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableCons[i], availableCons[j]] = [availableCons[j], availableCons[i]];
            }
            const selectedCons = availableCons.slice(0, 2);
            this.shop.consumables = selectedCons.map(c => ({ ...c, cost: isFree ? 0 : c.cost }));

            // 3. Generate 1 Voucher (if available and not already generated)
            // Note: Balatro vouchers are usually one per shop/ante, persist unless bought.
            // For now, generate new one each reroll/shop visit if not empty.
            this.shop.vouchers = [];
            const availableVouchers = VOUCHER_DEFINITIONS.filter(v => !this.vouchers.includes(v.id));
            if (availableVouchers.length > 0) {
                 const v = availableVouchers[Math.floor(Math.random() * availableVouchers.length)];
                 this.shop.vouchers.push({ ...v, cost: isFree ? 0 : v.cost });
            }

            // Consume Charm Tag if used? usually applied to the shop generation
            if (isFree) {
                this.tags.splice(charmTagIndex, 1);
            }

            this.emitUpdate();
        }

        rerollShop() {
            if (this.state !== 'SHOP') return;

            let cost = 5;
            // Check D6 Tag
            const d6Index = this.tags.findIndex(t => t.id === 'tag_d6');
            if (d6Index !== -1) {
                cost = 0;
                this.tags.splice(d6Index, 1);
            }

            if (this.money >= cost) {
                this.money -= cost;
                this.generateShop();
            }
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

        prepareBlindSelect() {
            this.state = 'BLIND_SELECT';
            this.currentBlind = this.getBlindInfo();

            // Generate Random Tag for Skip
            const TAGS = [
                { id: 'tag_handy', name: 'Handy Tag', desc: 'Level up played hand next round' },
                { id: 'tag_economy', name: 'Economy Tag', desc: 'Give $15' },
                { id: 'tag_charm', name: 'Charm Tag', desc: 'Free Shop' },
                { id: 'tag_d6', name: 'D6 Tag', desc: 'Reroll next Shop for $0' }
            ];
            this.nextTag = TAGS[Math.floor(Math.random() * TAGS.length)];

            this.emitUpdate();
        }

        skipBlind() {
            if (this.state !== 'BLIND_SELECT') return;

            // Apply Tag Effect
            if (this.nextTag.id === 'tag_economy') {
                this.money += 15;
            } else {
                this.tags.push(this.nextTag);
            }

            // Skip directly to Shop
            this.state = 'SHOP';
            this.generateShop();
        }

        startRound() {
            if (this.state !== 'BLIND_SELECT') return;

            this.currentScore = 0;
            this.handsLeft = 4;
            this.discardsLeft = 4;

            // Apply Vouchers (Base Stats)
            if (this.hasVoucher('v_grabber')) this.handsLeft++;
            if (this.hasVoucher('v_waste')) this.discardsLeft++;

            this.targetScore = this.currentBlind.target;

            // Apply Blind Debuffs (Boss) vs Vouchers
            let baseHandSize = 8;
            if (this.hasVoucher('v_paint')) baseHandSize++;

            if (this.currentBlind.id === 'boss_manacle') {
                this.maxHandSize = baseHandSize - 1;
            } else {
                this.maxHandSize = baseHandSize;
            }

            // Apply Tags (Start of Round)
            // e.g. "Handy Tag" - handled in playHand or endRound usually?
            // For simplicity, let's say "Handy Tag" gives a free Level Up consumable immediately
            const handyIndex = this.tags.findIndex(t => t.id === 'tag_handy');
            if (handyIndex !== -1) {
                // Add a random planet consumable if space?
                // Or just level up High Card for now.
                this.handLevels['High Card']++;
                this.tags.splice(handyIndex, 1);
            }

            this.deck.reset();
            this.hand = []; // Clear previous hand
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

            // The Hook: Discard 2 random cards
            if (this.currentBlind && this.currentBlind.id === 'boss_hook') {
                 for(let i=0; i<2; i++) {
                     if (this.hand.length > 0) {
                         const idx = Math.floor(Math.random() * this.hand.length);
                         this.hand.splice(idx, 1);
                     }
                 }
            }

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
                let interestCap = 5;
                if (this.hasVoucher('v_seed')) interestCap = 10;

                const interest = Math.min(interestCap, Math.floor(this.money / 5));
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
                this.generateShop();
                if (this.callbacks.onRoundEnd) this.callbacks.onRoundEnd(true);
            } else {
                this.state = 'GAME_OVER';
                if (this.callbacks.onRoundEnd) this.callbacks.onRoundEnd(false);
            }
            this.emitUpdate();
        }

        buyJoker(id) {
            if (this.state !== 'SHOP') return;
            // Find in shop
            const shopIndex = this.shop.jokers.findIndex(j => j.id === id);
            if (shopIndex === -1) return false;

            const jokerDef = this.shop.jokers[shopIndex];

            if (this.money >= jokerDef.cost) {
                if (this.jokerManager.addJoker(id)) {
                    this.money -= jokerDef.cost;
                    // Remove from shop
                    this.shop.jokers.splice(shopIndex, 1);
                    this.emitUpdate();
                    return true;
                }
            }
            return false;
        }

        buyConsumable(id) {
            if (this.state !== 'SHOP') return;
            const shopIndex = this.shop.consumables.findIndex(c => c.id === id);
            if (shopIndex === -1) return false;

            const item = this.shop.consumables[shopIndex];

            if (this.money >= item.cost) {
                // Find empty slot
                const slotIndex = this.consumables.findIndex(s => s === null);
                if (slotIndex !== -1) {
                    this.consumables[slotIndex] = { ...item };
                    this.money -= item.cost;
                    // Remove from shop
                    this.shop.consumables.splice(shopIndex, 1);
                    this.emitUpdate();
                    return true;
                }
            }
            return false;
        }

        buyVoucher(id) {
            if (this.state !== 'SHOP') return;
            if (this.vouchers.includes(id)) return false;

            const shopIndex = this.shop.vouchers.findIndex(v => v.id === id);
            if (shopIndex === -1) return false;

            const item = this.shop.vouchers[shopIndex];

            if (this.money >= item.cost) {
                this.vouchers.push(id);
                this.money -= item.cost;
                // Remove from shop
                this.shop.vouchers.splice(shopIndex, 1);
                this.emitUpdate();
                return true;
            }
            return false;
        }

        hasVoucher(id) {
            return this.vouchers.includes(id);
        }

        useConsumable(index) {
            const item = this.consumables[index];
            if (!item) return;

            // Effect Logic
            let used = false;
            if (item.type === 'planet') {
                if (this.handLevels[item.target]) {
                    this.handLevels[item.target]++;
                    used = true;
                }
            } else if (item.type === 'tarot') {
                const selected = this.getSelectedCards();

                if (item.id === 'tarot_strength') {
                    // Increase rank of up to 2 cards
                    if (selected.length > 0 && selected.length <= 2) {
                        selected.forEach(c => {
                            const idx = RANKS.indexOf(c.rank);
                            if (idx !== -1 && idx < RANKS.length - 1) {
                                const nextRank = RANKS[idx + 1];
                                c.rank = nextRank;
                                c.value = RANK_VALUES[nextRank];
                            }
                        });
                        used = true;
                    }
                } else if (item.id === 'tarot_death') {
                    if (selected.length === 2) {
                        const left = selected[0];
                        const right = selected[1];

                        left.suit = right.suit;
                        left.rank = right.rank;
                        left.value = right.value;
                        left.chipBonus = right.chipBonus;
                        left.multBonus = right.multBonus;
                        used = true;
                    }
                } else if (item.id === 'tarot_fool') {
                    if (this.lastUsedConsumable) {
                         // Find empty slot
                        const slotIndex = this.consumables.findIndex(s => s === null && s !== item); // Avoid self slot? actually index is cleared later
                        // The current slot (index) will be cleared. We need another empty slot.
                        // Or can we spawn it into the current slot?
                        // "Spawns last used". Usually you need space.
                        // If no space, it might fail or replace?
                        // Balatro: "Create...". If full, says "No Space".
                        // So check for another null slot.
                        // Wait, if I use Fool (at index 0), index 0 becomes null. Can I spawn it there?
                        // Logic: 1. Mark used = true. 2. Clear slot. 3. Add new item.
                        // But I clear slot at end of function.
                        // So I need to find a slot that is NOT 'index'.
                        const emptySlot = this.consumables.findIndex((s, i) => s === null && i !== index);
                        if (emptySlot !== -1) {
                            this.consumables[emptySlot] = { ...this.lastUsedConsumable };
                            used = true;
                        } else {
                            // If index is the only slot, we will clear it.
                            // Can we spawn it in 'index' AFTER clearing?
                            // Yes, if we special case it.
                            // But simpler: Just set used=true, and in cleanup:
                            // if (item.id === 'fool') replace current slot with last used?
                            // No, standard flow is safer.
                            // Let's assume we need an empty slot elsewhere for now, or refine logic.
                            // Actually, if we allow replacing the fool card itself:
                            // this.consumables[index] = this.lastUsedConsumable;
                            // return; // Early exit to avoid clearing it?
                            // Let's try to stick to standard flow.
                            // If I have [Fool, Null], use Fool -> [Null, LastUsed].
                            // If I have [Fool, Planet], use Fool -> No space?
                            // In Balatro, if you have 2 slots and both full, you use one, now you have 1 empty.
                            // So yes, it spawns into the slot you just freed.
                            // But here code clears it AFTER.
                            // So I will just overwrite `this.consumables[index]` with the new item and set used=false so it doesn't get cleared?
                            // Or handle it here.
                            this.consumables[index] = { ...this.lastUsedConsumable };
                            // Don't mark 'used' in the sense of clearing the slot.
                            // But we need to record 'Fool' as used? No, Fool is excluded from Last Used.
                            // So we just swapped Fool for Last Used.
                            // And we don't update lastUsedConsumable.
                            // Return early.
                            this.emitUpdate();
                            return;
                        }
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
                    // Update Last Used (exclude Fool)
                    if (item.id !== 'tarot_fool') {
                        this.lastUsedConsumable = item;
                    }

                    this.consumables[index] = null;
                    // Deselect
                    this.hand.forEach(c => c.selected = false);
                    this.emitUpdate();
                }
            }
            // Planet used logic was separate, merge it
            if (item.type === 'planet' && used) {
                if (item.id !== 'tarot_fool') {
                    this.lastUsedConsumable = item;
                }
                this.consumables[index] = null;
                this.emitUpdate();
            }
        }

        nextRound() {
            if (this.state === 'SHOP') {
                // Apply end of shop logic (e.g. reset tags like Charm/D6 if they were one-use?)
                // Actually Charm is "Free Shop", used during shop generation/purchase.
                // Clear shop tags
                this.tags = this.tags.filter(t => t.id !== 'tag_charm' && t.id !== 'tag_d6');

                // Advance Blind Index here?
                // Wait, endRound advances blind index.
                // So now we are ready for the NEXT blind.
                this.prepareBlindSelect();
            } else if (this.state === 'GAME_OVER') {
                // Restart?
            } else {
                // Initial start
                this.prepareBlindSelect();
            }
        }

        emitUpdate() {
            if (this.callbacks.onUpdate) {
                this.callbacks.onUpdate({
                    hand: this.hand,
                    ante: this.ante,
                    blind: this.currentBlind,
                    nextTag: this.nextTag,
                    money: this.money,
                    target: this.targetScore,
                    current: this.currentScore,
                    handsLeft: this.handsLeft,
                    discardsLeft: this.discardsLeft,
                    jokers: this.jokerManager.jokers,
                    consumables: this.consumables,
                    vouchers: this.vouchers,
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
