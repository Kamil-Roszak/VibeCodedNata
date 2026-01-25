// Imports from global if standalone
// BalatroGame, BalatroData, PokerLogic assumed loaded

/**
 * Queue system for handling sequential animations smoothly.
 */
class AnimationQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    add(callback, duration = 0) {
        this.queue.push({ callback, duration });
        this.process();
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const task = this.queue.shift();

        // Execute task
        try {
            await task.callback();
        } catch (e) {
            console.error("Animation error:", e);
        }

        // Wait for duration
        if (task.duration > 0) {
            await new Promise(resolve => setTimeout(resolve, task.duration));
        }

        this.processing = false;
        // Next
        this.process();
    }

    clear() {
        this.queue = [];
        this.processing = false;
    }
}

class BalatroView {
    constructor() {
        this.game = null;
        this.animQueue = new AnimationQueue();

        // --- Core Elements ---
        this.handArea = document.getElementById('b-hand-area');
        this.playArea = document.getElementById('b-play-slots');
        this.jokersArea = document.getElementById('b-jokers-area');
        this.consumablesArea = document.getElementById('b-consumables-area');
        this.deckArea = document.getElementById('b-deck-area');

        // --- View Layers ---
        this.viewGameplay = document.getElementById('b-view-gameplay');
        this.viewShop = document.getElementById('b-view-shop');
        this.viewBlind = document.getElementById('b-view-blind');

        // --- HUD Elements ---
        this.elChips = document.getElementById('b-chips');
        this.elMult = document.getElementById('b-mult');
        this.elScore = document.getElementById('b-current-score');
        this.elTarget = document.getElementById('b-target-score');
        this.elHands = document.getElementById('b-hands-left');
        this.elDiscards = document.getElementById('b-discards-left');
        this.elRound = document.getElementById('b-round');
        this.elMoney = document.getElementById('b-money');

        // --- Hand Preview ---
        this.elPreviewBox = document.getElementById('b-hand-preview');
        this.elPreviewName = document.getElementById('b-preview-name');
        this.elPreviewLevel = document.getElementById('b-preview-level');
        this.elPreviewChips = document.getElementById('b-preview-chips');
        this.elPreviewMult = document.getElementById('b-preview-mult');

        // --- Controls ---
        this.btnPlay = document.getElementById('b-play-btn');
        this.btnDiscard = document.getElementById('b-discard-btn');
        this.btnSortRank = document.getElementById('b-sort-rank');
        this.btnSortSuit = document.getElementById('b-sort-suit');

        // --- Shop Elements ---
        this.shopMoney = document.getElementById('b-shop-money');
        this.shopContent = document.getElementById('b-shop-content');
        this.btnNextRound = document.getElementById('b-next-round-btn');

        // --- Blind Elements ---
        this.blindContent = document.getElementById('b-blind-content');

        // --- Overlays ---
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
            // Transition handled by render()
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
        // 1. Update Persistent HUD
        this.renderHUD(state);

        // 2. Manage View Visibility
        this.viewGameplay.classList.add('hidden');
        this.viewGameplay.classList.remove('active');
        this.viewShop.classList.add('hidden');
        this.viewShop.classList.remove('active');
        this.viewBlind.classList.add('hidden');
        this.viewBlind.classList.remove('active');

        if (state.state === 'SHOP') {
            this.viewShop.classList.remove('hidden');
            this.viewShop.classList.add('active');
            this.showShop(state);
        } else if (state.state === 'BLIND_SELECT') {
            this.viewBlind.classList.remove('hidden');
            this.viewBlind.classList.add('active');
            this.updateBlindSelectUI(state);
        } else {
            // PLAYING or GAME_OVER
            this.viewGameplay.classList.remove('hidden');
            this.viewGameplay.classList.add('active');
            this.renderGameplay(state);
        }
    }

    renderHUD(state) {
        // Ante / Blind Info
        if (state.blind) {
            this.elRound.innerHTML = `<span style="font-size: 0.8em; color: #aaa;">Ante ${state.ante}</span><br>${state.blind.name}`;
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

        // Jokers
        this.jokersArea.innerHTML = '';
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
                el.dataset.jokerId = joker.id; // For animation lookup
            } else {
                el.classList.add('empty');
                el.innerText = 'Joker';
            }
            this.jokersArea.appendChild(el);
        }

        // Consumables
        if (this.consumablesArea) {
            this.consumablesArea.innerHTML = '';
            const consumables = state.consumables || [null, null];
            consumables.forEach((item, index) => {
                const el = document.createElement('div');
                el.className = 'joker-card consumable-card';
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
    }

    renderGameplay(state) {
        // Render Hand
        // Note: During animation we might want to lock this?
        this.handArea.innerHTML = '';
        state.hand.forEach(card => {
            const cardEl = this.createCardEl(card);
            cardEl.addEventListener('click', () => {
                if (this.animQueue.processing) return; // Lock input during animation
                this.game.selectCard(card.id);
            });
            this.handArea.appendChild(cardEl);
        });

        // Hand Preview
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
    }

    createCardEl(card) {
        const el = document.createElement('div');
        el.className = `poker-card suit-${card.suit.toLowerCase()} ${card.selected ? 'selected' : ''}`;
        el.dataset.cardId = card.id;

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

    // --- SHOP LOGIC ---
    showShop(state) {
        this.shopMoney.innerText = `$${state.money}`;
        this.shopContent.innerHTML = '';

        const topRow = document.createElement('div');
        topRow.className = 'shop-row-top';

        // Vouchers Section
        const voucherSection = document.createElement('div');
        voucherSection.className = 'shop-sub-section';
        voucherSection.innerHTML = `<div class="shop-sub-title">Voucher</div>`;
        const voucherContainer = document.createElement('div');
        voucherContainer.style.display = 'flex'; voucherContainer.style.gap = '10px';

        if (this.game.shop.vouchers.length > 0) {
            const v = this.game.shop.vouchers[0];
            const el = this.createShopItemEl(v, 'voucher', () => this.game.buyVoucher(v.id));
            voucherContainer.appendChild(el);
        } else {
            voucherContainer.innerHTML = "<div style='color:#666'>Sold Out</div>";
        }
        voucherSection.appendChild(voucherContainer);
        topRow.appendChild(voucherSection);

        // Reroll Section
        const isFree = this.game.tags.some(t => t.id === 'tag_d6');
        const rerollSection = document.createElement('div');
        rerollSection.className = 'shop-reroll-container';
        rerollSection.innerHTML = `
            <button class="btn-reroll-large" id="shop-reroll-btn">
                Reroll
                <span>$${isFree ? 0 : 5}</span>
            </button>
        `;
        topRow.appendChild(rerollSection);

        this.shopContent.appendChild(topRow);

        // Bottom Row
        const bottomRow = document.createElement('div');
        bottomRow.className = 'shop-row-bottom';

        this.game.shop.jokers.forEach(item => {
            bottomRow.appendChild(this.createShopItemEl(item, 'joker', () => this.game.buyJoker(item.id)));
        });

        this.game.shop.consumables.forEach(item => {
            bottomRow.appendChild(this.createShopItemEl(item, 'consumable', () => this.game.buyConsumable(item.id)));
        });

        this.shopContent.appendChild(bottomRow);

        document.getElementById('shop-reroll-btn').addEventListener('click', () => this.game.rerollShop());
    }

    createShopItemEl(item, type, buyAction) {
        const el = document.createElement('div');
        el.className = `b-shop-card ${type}`;

        let icon = '';
        if (item.asset) {
            icon = `<img src="${item.asset}" style="height:60px; object-fit:contain;">`;
        } else {
             icon = `<div style="font-size:40px;">🃏</div>`;
        }

        el.innerHTML = `
            ${icon}
            <div style="font-size:12px; font-weight:bold; margin-top:5px; line-height:1.1;">${item.name}</div>
            <div style="font-size:10px; color:#666; margin-top:5px; flex-grow:1;">${item.desc}</div>
            <div class="price-tag">$${item.cost}</div>
        `;

        el.addEventListener('click', buyAction);
        return el;
    }

    // --- BLIND SELECT LOGIC ---
    updateBlindSelectUI(state) {
        this.blindContent.innerHTML = '';
        const blinds = ['Small', 'Big', 'Boss'];

        blinds.forEach(type => {
            const panel = document.createElement('div');
            panel.className = `blind-panel ${type.toLowerCase()}`;

            // Heuristics for visual status
            let status = 'upcoming';
            if (state.blind.name.includes(type)) status = 'current';
            if (state.blind.name.includes('Big') && type === 'Small') status = 'passed';
            if (state.blind.type === 'Boss' && (type === 'Small' || type === 'Big')) status = 'passed';

            if (status === 'passed') panel.classList.add('passed');
            if (status === 'current') panel.classList.add('active');

            let name = `${type} Blind`;
            let score = '?';
            let reward = '?';
            let desc = '';

            if (status === 'current') {
                name = state.blind.name;
                score = state.target;
                reward = `$${state.blind.reward}`;
                desc = state.blind.desc || '';
            }
            if (status === 'passed') {
                 score = '---';
                 reward = '-';
            }

            panel.innerHTML = `
                <div class="blind-panel-header">${name}</div>
                <div class="blind-panel-body">
                    <div style="font-size:12px; text-transform:uppercase; color:#aaa;">Score at least</div>
                    <div class="blind-score">${score}</div>
                    ${desc ? `<div style="font-size:10px; color:#f88; margin-top:5px;">${desc}</div>` : ''}
                    <div class="blind-reward-text">Reward: ${reward}</div>
                </div>
                <div class="blind-panel-footer"></div>
            `;

            if (status === 'current') {
                const footer = panel.querySelector('.blind-panel-footer');

                const btnSelect = document.createElement('button');
                btnSelect.className = 'btn-select-blind';
                btnSelect.innerText = 'SELECT';
                btnSelect.onclick = () => this.game.startRound();
                footer.appendChild(btnSelect);

                const btnSkip = document.createElement('button');
                btnSkip.className = 'btn-skip-blind';
                const tagName = state.nextTag ? state.nextTag.name : 'Tag';
                btnSkip.innerHTML = `<span>Skip</span><span>${tagName}</span>`;
                btnSkip.onclick = () => this.game.skipBlind();
                footer.appendChild(btnSkip);
            }

            this.blindContent.appendChild(panel);
        });
    }

    // --- ANIMATION QUEUE ---
    animateScoring(result) {
        // Reset chips/mult display for the run up
        this.elChips.innerText = '0';
        this.elMult.innerText = '0';

        this.animQueue.clear();

        // 1. Move cards to play area
        this.animQueue.add(() => {
            this.playArea.innerHTML = '';
            result.cards.forEach(card => {
                const el = this.createCardEl(card);
                this.playArea.appendChild(el);
            });
        }, 500);

        // 2. Process Breakdown
        const breakdown = result.score.breakdown || [];

        breakdown.forEach(step => {
            this.animQueue.add(() => {
                // Update Chips/Mult
                this.elChips.innerText = step.chips;
                this.elMult.innerText = step.mult;

                // Pop Effect
                this.elChips.classList.remove('score-pop');
                this.elMult.classList.remove('score-pop');
                void this.elChips.offsetWidth;
                this.elChips.classList.add('score-pop');
                this.elMult.classList.add('score-pop');

                // Light Shake on score update
                this.shakeBoard();

                // Visual Feedback
                if (step.source === 'card') {
                    const cardEl = this.playArea.querySelector(`[data-card-id="${step.card.id}"]`);
                    if (cardEl) {
                        cardEl.classList.add('trigger-flash');
                        setTimeout(() => cardEl.classList.remove('trigger-flash'), 300);
                        if (step.chips > 0) this.spawnFloatingText(cardEl, `+${step.chips}`);
                    }
                } else if (step.source === 'joker') {
                    // Find joker by checking source
                    // Assuming step.joker.id matches
                    const jokers = Array.from(this.jokersArea.children);
                    // Match by data-joker-id if we added it (we did in renderHUD)
                    // But jokers might have shifted? renderHUD redraws them.
                    // Let's rely on data-joker-id
                    const jokerEl = jokers.find(el => el.dataset.jokerId === step.joker.id);
                    if (jokerEl) {
                        jokerEl.classList.add('trigger-shake');
                        setTimeout(() => jokerEl.classList.remove('trigger-shake'), 400);
                        this.spawnFloatingText(jokerEl, `+${step.mult} Mult`);
                    }
                }
            }, 600); // Wait 600ms per step
        });

        // 3. Final Score
        this.animQueue.add(() => {
            this.elScore.innerText = result.score.total;
            this.elScore.classList.add('score-pop');
            setTimeout(() => this.elScore.classList.remove('score-pop'), 500);
        }, 1000);

        // 4. Update Game State visually (Score is now committed)
        // (Handled by ViewState updates mostly, but ensure sync)

        // 5. Cleanup
        this.animQueue.add(() => {
            this.playArea.innerHTML = '';
            // If game logic has moved on (e.g. game over), this will be fine.
        }, 100);
    }

    spawnFloatingText(targetEl, text) {
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const floatEl = document.createElement('div');
        floatEl.innerText = text;
        floatEl.className = 'floating-score';
        floatEl.style.left = (rect.left + rect.width/2) + 'px';
        floatEl.style.top = rect.top + 'px';
        document.body.appendChild(floatEl);
        setTimeout(() => floatEl.remove(), 1000);
    }

    shakeBoard() {
        const container = document.querySelector('.balatro-board-column');
        if (container) {
            container.classList.remove('shake-board');
            void container.offsetWidth;
            container.classList.add('shake-board');
        }
    }

    handleRoundEnd(win) {
        if (!win) {
            this.finalRound.innerText = this.game.round;
            this.gameOverOverlay.classList.add('visible');
        }
    }
}

// Global Launcher
window.startBalatro = function() {
    if (!document.getElementById('balatro-view').classList.contains('active-view')) {
        navigateTo('balatro-view');
    }
    document.getElementById('b-game-over').classList.remove('visible');
    if (!window.balatroView) {
        window.balatroView = new BalatroView();
    }
    window.balatroView.init();
};
