// Imports from global if standalone
// BalatroGame, BalatroData, PokerLogic assumed loaded

class BalatroView {
    constructor() {
        this.game = null;

        // Elements
        this.handArea = document.getElementById('b-hand-area');
        this.playArea = document.getElementById('b-play-slots');
        this.jokersArea = document.getElementById('b-jokers-area');
        this.deckArea = document.getElementById('b-deck-area');

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
        state.jokers.forEach(joker => {
            const el = document.createElement('div');
            el.className = 'joker-card';
            el.innerHTML = `
                <img src="${joker.asset}">
                <div>${joker.name}</div>
            `;
            // Simple tooltip?
            el.title = joker.desc;
            this.jokersArea.appendChild(el);
        });

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

    animateScoring(result) {
        // Move cards to play area
        const selectedEls = this.handArea.querySelectorAll('.selected');
        selectedEls.forEach(el => {
            // Cloning isn't great for logic but visually ok
            // Actually, game state updated and re-rendered hand without them.
            // So we just visualize result.
        });

        // Logic removed cards from hand immediately.
        // We can show "ghosts" in play area?
        this.playArea.innerHTML = '';
        result.cards.forEach(card => {
            const el = this.createCardEl(card);
            el.classList.add('played'); // Animation class
            this.playArea.appendChild(el);
        });

        // Animate numbers
        let currentChips = 0;
        let currentMult = 0;
        const targetChips = result.score.chips;
        const targetMult = result.score.mult;

        // Simple interval for now
        this.elChips.innerText = targetChips;
        this.elMult.innerText = targetMult;
        this.elScore.innerText = this.game.currentScore; // Final total updated

        // Clear play area after delay
        setTimeout(() => {
            this.playArea.innerHTML = '';
        }, 1500);
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
