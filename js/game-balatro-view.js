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

        this.game.startRound();
        console.log("BalatroView initialized");
    }

    render(state) {
        // Stats
        this.elRound.innerText = state.round;
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
            consumables.forEach(item => {
                const el = document.createElement('div');
                el.className = 'joker-card consumable-card'; // Reuse joker style for now
                if (item) {
                     el.innerHTML = `<div>${item.name}</div>`;
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
        }
    }

    createCardEl(card) {
        const el = document.createElement('div');
        el.className = `poker-card suit-${card.suit.toLowerCase()} ${card.selected ? 'selected' : ''}`;

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

        // Populate random jokers (from all definitions for now)
        // In real game, random subset. Here just show all not owned.
        const ownedIds = state.jokers.map(j => j.id);
        const available = window.JOKER_DEFINITIONS.filter(j => !ownedIds.includes(j.id));

        available.forEach(item => {
            const el = document.createElement('div');
            el.className = 'shop-item';
            el.innerHTML = `
                <img src="${item.asset}">
                <h4>${item.name}</h4>
                <p>${item.desc}</p>
                <div class="price">$${item.cost}</div>
            `;
            el.addEventListener('click', () => {
                if (this.game.buyJoker(item.id)) {
                    // Update UI immediately handled by callback
                    // Remove item from view manually or re-render?
                    // Re-render handled by onUpdate
                }
            });
            this.shopItems.appendChild(el);
        });
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
