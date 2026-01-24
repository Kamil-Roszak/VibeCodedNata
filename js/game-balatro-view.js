// Imports from global if standalone
// BalatroGame, BalatroData, PokerLogic assumed loaded

class BalatroView {
    constructor() {
        this.game = null;

        // Elements
        this.handArea = document.getElementById('b-hand-area');
        this.playArea = document.getElementById('b-play-slots');
        this.jokersArea = document.getElementById('b-jokers-area');
        this.consumablesArea = document.getElementById('b-consumables-area');
        this.deckArea = document.getElementById('b-deck-area');

        // Preview Elements
        this.elPreviewBox = document.getElementById('b-hand-preview');
        this.elPreviewName = document.getElementById('b-preview-name');
        this.elPreviewLevel = document.getElementById('b-preview-level');
        this.elPreviewChips = document.getElementById('b-preview-chips');
        this.elPreviewMult = document.getElementById('b-preview-mult');

        this.elChips = document.getElementById('b-chips');
        this.elMult = document.getElementById('b-mult');
        this.elScore = document.getElementById('b-current-score');
        this.elTarget = document.getElementById('b-target-score');

        this.elHands = document.getElementById('b-hands-left');
        this.elDiscards = document.getElementById('b-discards-left');

        this.elRound = document.getElementById('b-round');
        this.elMoney = document.getElementById('b-money');

        // Buttons
        this.btnPlay = document.getElementById('b-play-btn');
        this.btnDiscard = document.getElementById('b-discard-btn');
        this.btnSortRank = document.getElementById('b-sort-rank');
        this.btnSortSuit = document.getElementById('b-sort-suit');

        // Shop
        this.shopOverlay = document.getElementById('b-shop-overlay');
        this.shopMoney = document.getElementById('b-shop-money');
        this.shopItems = document.getElementById('b-shop-items');
        this.btnNextRound = document.getElementById('b-next-round-btn');

        // Blind Select
        this.blindSelectOverlay = document.getElementById('b-blind-select');
        this.elBlindName = document.getElementById('b-blind-name');
        this.elBlindDesc = document.getElementById('b-blind-desc');
        this.elBlindReward = document.getElementById('b-blind-reward');
        this.elTagName = document.getElementById('b-tag-name');

        this.btnSelectPlay = document.getElementById('b-select-play');
        this.btnSelectSkip = document.getElementById('b-select-skip');

        // Overlays
        this.gameOverOverlay = document.getElementById('b-game-over');
        this.finalRound = document.getElementById('b-final-round');

        this.bindEvents();
    }

    bindEvents() {
        this.btnPlay.addEventListener('click', () => this.game?.playHand());
        this.btnDiscard.addEventListener('click', () => this.game?.discard());

        if (this.btnSortRank) this.btnSortRank.addEventListener('click', () => this.game?.sortHand('rank'));
        if (this.btnSortSuit) this.btnSortSuit.addEventListener('click', () => this.game?.sortHand('suit'));

        this.btnNextRound.addEventListener('click', () => {
            this.game?.nextRound();
            this.shopOverlay.classList.remove('visible');
        });

        this.btnSelectPlay.addEventListener('click', () => {
            this.game?.startRound();
            this.blindSelectOverlay.classList.remove('visible');
        });

        this.btnSelectSkip.addEventListener('click', () => {
            this.game?.skipBlind();
            this.blindSelectOverlay.classList.remove('visible');
        });
    }

    init() {
        if (!window.BalatroGame) {
            console.warn("Balatro Logic not ready, retrying in 500ms...");
            setTimeout(() => this.init(), 500);
            return;
        }

        // Only init if not already running or force reset
        this.game = new window.BalatroGame({
            callbacks: {
                onUpdate: (state) => this.render(state),
                onHandPlayed: (result) => this.animateScoring(result),
                onRoundEnd: (win) => this.handleRoundEnd(win)
            }
        });

        // Start with Blind Select
        this.game.prepareBlindSelect();
        console.log("BalatroView initialized");
    }

    render(state) {
        // Stats
        // Ante / Blind Info
        if (state.blind) {
            this.elRound.innerHTML = `<span style="font-size: 0.8em; color: #aaa;">Ante ${state.ante}</span><br>${state.blind.name}`;

            // Show Boss Desc if applicable
            if (state.blind.type === 'Boss') {
                 // Might want to add a tooltip or separate element for blind desc
            }
        } else {
            this.elRound.innerText = `Ante ${state.ante}`;
        }

        this.elMoney.innerText = `$${state.money}`;
        this.elTarget.innerText = state.target;
        this.elScore.innerText = state.current;
        this.elHands.innerText = state.handsLeft;
        this.elDiscards.innerText = state.discardsLeft;

        // Deck visual
        if (this.deckArea) {
            this.deckArea.innerHTML = `
                <div class="deck-pile" title="Cards remaining in deck">
                    DECK<br>${this.game.deck.cards.length}
                </div>
            `;
        }

        // Reset score display if new hand
        if (state.state === 'PLAYING') {
            this.elChips.innerText = '0';
            this.elMult.innerText = '0';
        }

        // Render Hand
        this.handArea.innerHTML = '';
        state.hand.forEach(card => {
            const cardEl = this.createCardEl(card);
            cardEl.addEventListener('click', () => {
                this.game.selectCard(card.id);
            });
            this.handArea.appendChild(cardEl);
        });

        // Render Jokers
        this.jokersArea.innerHTML = '';
        // Always show 5 slots
        for(let i=0; i<5; i++) {
            const joker = state.jokers[i];
            const el = document.createElement('div');
            el.className = 'joker-card';
            if (joker) {
                el.innerHTML = `
                    <img src="${joker.asset}">
                    <div>${joker.name}</div>
                `;
                el.title = joker.desc;
            } else {
                el.classList.add('empty');
                el.innerText = 'Joker';
            }
            this.jokersArea.appendChild(el);
        }

        // Render Consumables
        if (this.consumablesArea) {
            this.consumablesArea.innerHTML = '';
            // Always show 2 slots
            const consumables = state.consumables || [null, null];
            consumables.forEach((item, index) => {
                const el = document.createElement('div');
                el.className = 'joker-card consumable-card'; // Reuse joker style for now
                if (item) {
                     el.innerHTML = `
                        <div style="font-size: 10px;">${item.name}</div>
                        <div class="use-btn">USE</div>
                     `;
                     el.title = item.desc;
                     el.querySelector('.use-btn').addEventListener('click', (e) => {
                         e.stopPropagation();
                         this.game.useConsumable(index);
                     });
                } else {
                    el.classList.add('empty');
                    el.innerText = 'Consumable';
                }
                this.consumablesArea.appendChild(el);
            });
        }

        // Hand Preview
        if (state.state === 'PLAYING') {
            const preview = this.game.evaluateSelectedHand();
            if (preview) {
                this.elPreviewBox.classList.remove('hidden');
                this.elPreviewName.innerText = preview.handType;
                this.elPreviewLevel.innerText = `lvl.${preview.level}`;
                this.elPreviewChips.innerText = preview.chips;
                this.elPreviewMult.innerText = preview.mult;
            } else {
                this.elPreviewBox.classList.add('hidden');
            }
        } else {
            this.elPreviewBox.classList.add('hidden');
        }

        // Check Shop
        if (state.state === 'SHOP') {
            this.showShop(state);
        } else {
            this.shopOverlay.classList.remove('visible');
        }

        // Check Blind Select
        if (state.state === 'BLIND_SELECT' && state.blind) {
             this.blindSelectOverlay.classList.add('visible');
             this.elBlindName.innerText = state.blind.name;
             this.elBlindDesc.innerText = `Target: ${state.blind.target} | ${state.blind.desc}`;
             this.elBlindReward.innerText = state.blind.reward;
             this.elTagName.innerText = state.nextTag ? state.nextTag.name : 'Unknown';
        } else {
             this.blindSelectOverlay.classList.remove('visible');
        }
    }

    createCardEl(card) {
        const el = document.createElement('div');
        el.className = `poker-card suit-${card.suit.toLowerCase()} ${card.selected ? 'selected' : ''}`;

        if (card.debuffed) {
            el.classList.add('debuffed');
            el.title = "Debuffed: Chips/Mult disabled";
        }

        if (card.multBonus && card.multBonus > 0) {
            el.classList.add('enhanced-mult');
        }
        if (card.chipBonus && card.chipBonus > 0) {
            el.classList.add('enhanced-bonus');
        }

        const suitSymbol = {
            'Hearts': '♥', 'Diamonds': '♦', 'Spades': '♠', 'Clubs': '♣'
        }[card.suit];

        el.innerHTML = `
            <div style="text-align: left">${card.rank}</div>
            <div class="card-center">${suitSymbol}</div>
            <div style="text-align: right">${card.rank}</div>
        `;
        return el;
    }

    async animateScoring(result) {
        // 1. Move cards to play area
        this.playArea.innerHTML = '';
        const playedCardsEls = [];

        result.cards.forEach(card => {
            const el = this.createCardEl(card);
            // Assign ID for lookup
            el.dataset.cardId = card.id;
            // Initially just visible
            this.playArea.appendChild(el);
            playedCardsEls.push(el);
        });

        // Use breakdown for sequential animation
        // breakdown is array of { source: 'card'|'joker', card?, joker?, chips, mult }
        // We want to animate step by step

        const delay = ms => new Promise(res => setTimeout(res, ms));

        // Reset display
        let displayedChips = 0;
        let displayedMult = 0;
        this.elChips.innerText = '0';
        this.elMult.innerText = '0';
        this.elScore.innerText = this.game.currentScore - result.score.total; // Start from previous total?

        const breakdown = result.score.breakdown || [];

        for (const step of breakdown) {
            await delay(400); // Pace of animation

            if (step.source === 'card') {
                // Find card element
                const cardEl = playedCardsEls.find(el => parseInt(el.dataset.cardId) === step.card.id);
                if (cardEl) {
                    cardEl.classList.add('trigger-flash');
                    setTimeout(() => cardEl.classList.remove('trigger-flash'), 300);

                    // Show floating text
                    this.showFloatingText(cardEl, `+${step.chips}`);
                }
            } else if (step.source === 'joker') {
                // Find Joker Element
                const jokers = this.jokersArea.children;
                const jokerIndex = this.game.jokerManager.jokers.findIndex(j => j.id === step.joker.id);
                if (jokerIndex >= 0 && jokers[jokerIndex]) {
                     const el = jokers[jokerIndex];
                     el.classList.add('trigger-shake');
                     setTimeout(() => el.classList.remove('trigger-shake'), 400);
                }
            }

            // Update Stats
            this.elChips.innerText = step.chips; // Should we tween this?
            this.elMult.innerText = step.mult;
            displayedChips = step.chips;
            displayedMult = step.mult;
        }

        await delay(500);

        // Final Total Animation
        const finalScore = result.score.total;
        this.elScore.innerText = this.game.currentScore; // Update to actual final

        // Flame effect or something?
        this.elScore.classList.add('score-pop');
        setTimeout(() => this.elScore.classList.remove('score-pop'), 500);

        await delay(1000);

        // Clear play area
        this.playArea.innerHTML = '';

        // Check Game Over logic handled by core calling endRound or not.
        // Core updates state immediately, we just visualized it.
    }

    showFloatingText(targetEl, text) {
        const rect = targetEl.getBoundingClientRect();
        const floatEl = document.createElement('div');
        floatEl.innerText = text;
        floatEl.className = 'floating-score';
        floatEl.style.left = (rect.left + rect.width/2) + 'px';
        floatEl.style.top = rect.top + 'px';
        document.body.appendChild(floatEl);

        setTimeout(() => floatEl.remove(), 1000);
    }

    handleRoundEnd(win) {
        if (!win) {
            this.finalRound.innerText = this.game.round;
            this.gameOverOverlay.classList.add('visible');
        }
    }

    showShop(state) {
        this.shopOverlay.classList.add('visible');
        this.shopMoney.innerText = `$${state.money}`;
        this.shopItems.innerHTML = '';

        // Jokers Section
        const jokerHeader = document.createElement('h3');
        jokerHeader.innerText = "Jokers";
        this.shopItems.appendChild(jokerHeader);

        const ownedIds = state.jokers.map(j => j.id);
        const availableJokers = window.JOKER_DEFINITIONS.filter(j => !ownedIds.includes(j.id));

        const jokerGrid = document.createElement('div');
        jokerGrid.className = 'shop-items-grid';

        availableJokers.forEach(item => {
            const el = this.createShopItemEl(item, () => this.game.buyJoker(item.id));
            jokerGrid.appendChild(el);
        });
        this.shopItems.appendChild(jokerGrid);

        // Consumables Section
        const consHeader = document.createElement('h3');
        consHeader.innerText = "Consumables";
        this.shopItems.appendChild(consHeader);

        const consGrid = document.createElement('div');
        consGrid.className = 'shop-items-grid';

        // Show random subset of Planets/Tarots? For now show all Planets
        const availableCons = window.CONSUMABLE_DEFINITIONS.slice(0, 5); // Just first 5 for demo
        availableCons.forEach(item => {
             const el = this.createShopItemEl(item, () => this.game.buyConsumable(item.id));
             consGrid.appendChild(el);
        });
        this.shopItems.appendChild(consGrid);

        // Vouchers Section
        const voucherHeader = document.createElement('h3');
        voucherHeader.innerText = "Vouchers";
        this.shopItems.appendChild(voucherHeader);

        const voucherGrid = document.createElement('div');
        voucherGrid.className = 'shop-items-grid';

        // Pick one random voucher not owned
        const availableVouchers = window.VOUCHER_DEFINITIONS.filter(v => !state.vouchers.includes(v.id));
        if (availableVouchers.length > 0) {
            // Just show first one for now or random
            const item = availableVouchers[0];
            const el = this.createShopItemEl(item, () => this.game.buyVoucher(item.id));
            el.classList.add('voucher-item');
            voucherGrid.appendChild(el);
        } else {
             voucherGrid.innerHTML = "<div>Sold Out</div>";
        }
        this.shopItems.appendChild(voucherGrid);
    }

    createShopItemEl(item, buyAction) {
        const el = document.createElement('div');
        el.className = 'shop-item';
        // Handle image if exists
        const imgHTML = item.asset ? `<img src="${item.asset}">` : `<div style="font-size: 30px; margin-bottom: 5px;">🪐</div>`;

        el.innerHTML = `
            ${imgHTML}
            <h4>${item.name}</h4>
            <p>${item.desc}</p>
            <div class="price">$${item.cost}</div>
        `;
        el.addEventListener('click', () => {
            buyAction();
        });
        return el;
    }
}

// Global Launcher
window.startBalatro = function() {
    // Only navigate if not already handled by general navigateTo
    if (!document.getElementById('balatro-view').classList.contains('active-view')) {
        navigateTo('balatro-view');
    }

    // Hide others
    document.getElementById('b-game-over').classList.remove('visible');

    if (!window.balatroView) {
        window.balatroView = new BalatroView();
    }
    window.balatroView.init();
};
