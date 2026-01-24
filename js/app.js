// Data Definitions
const BADGES = [
    { id: 'first_sip', name: 'First Sip', cost: 10, icon: '🥤', description: 'A small token for starting out.' },
    { id: 'collector', name: 'Bottle Collector', cost: 100, icon: '🎒', description: 'You love collecting bottles.' },
    { id: 'master', name: 'Nata Master', cost: 500, icon: '👑', description: 'Only for the true fans.' },
    { id: 'diamond', name: 'Diamond Fizz', cost: 1000, icon: '💎', description: 'Sparkling luxury.' }
];

class UserManager {
    constructor() {
        this.data = this.load();
    }

    load() {
        const stored = localStorage.getItem('nata_user');
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            points: 0,
            badges: [],
            highScores: {}
        };
    }

    save() {
        localStorage.setItem('nata_user', JSON.stringify(this.data));
        this.updateHeaderUI();
    }

    addPoints(amount) {
        this.data.points += amount;
        this.save();
    }

    hasBadge(id) {
        return this.data.badges.includes(id);
    }

    buyBadge(id) {
        const badge = BADGES.find(b => b.id === id);
        if (!badge) return false;
        if (this.hasBadge(id)) return false;
        if (this.data.points < badge.cost) return false;

        this.data.points -= badge.cost;
        this.data.badges.push(id);
        this.save();
        return true;
    }

    getPoints() {
        return this.data.points;
    }

    updateHeaderUI() {
        const el = document.getElementById('user-points-display');
        if (el) el.innerText = `${this.data.points} pts`;
    }
}

const userManager = new UserManager();

// Navigation & App Logic
document.addEventListener('DOMContentLoaded', () => {
    // Init Background
    if (typeof ThreeBackground !== 'undefined') {
        new ThreeBackground('bg-container');
    }

    // Init UI
    userManager.updateHeaderUI();
    renderShop();
    renderProfile();

    // Navigation Listeners
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('[data-nav]').dataset.nav;
            navigateTo(target);
        });
    });

    // Game Integration
    let gameInstance = null;
    window.gameInstance = null; // Expose for debugging
    const gameConfig = {
        canvasId: 'gameCanvas',
        ui: {
            score: 'score',
            lives: 'lives'
        },
        callbacks: {
            onGameOver: (score) => {
                userManager.addPoints(score);

                document.getElementById('hud').classList.add('hidden');
                document.getElementById('gameOverScreen').classList.remove('hidden');
                document.getElementById('finalScore').innerText = score;

                console.log(`Game Over! Added ${score} points.`);
            }
        }
    };

    // We need to hook into the game's internal "Start" button if we want to reset things
    // But the Game Class handles its own internal state.
    // However, when we navigate TO the game, we show the wrapper.

    // Check if NataCatchGame is loaded
    if (typeof NataCatchGame !== 'undefined') {
        gameInstance = new NataCatchGame(gameConfig);
        window.gameInstance = gameInstance;
    }

    // Hook up Start Game Button
    const startBtn = document.getElementById('startBtn');
    if (startBtn && gameInstance) {
        startBtn.addEventListener('click', () => {
            document.getElementById('startScreen').classList.add('hidden');
            document.getElementById('gameOverScreen').classList.add('hidden');
            document.getElementById('hud').classList.remove('hidden');
            gameInstance.start();
        });
    }

    // Hook up Restart Button
    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn && gameInstance) {
        restartBtn.addEventListener('click', () => {
             document.getElementById('startScreen').classList.add('hidden');
             document.getElementById('gameOverScreen').classList.add('hidden');
             document.getElementById('hud').classList.remove('hidden');
             gameInstance.start();
        });
    }

    // Hook up "Back to Menu" from Game Over screen
    // This button needs to exist in the HTML structure we will build
    const backBtn = document.getElementById('backToMenuBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (gameInstance) gameInstance.stop(); // Stop loop

            // Hide game over screen manually because game class might leave it open
            document.getElementById('gameOverScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden'); // Reset for next time

            navigateTo('menu-view');
            renderProfile(); // Update points
        });
    }

    // Also the game has a "Restart" button, which works internally.
});

function navigateTo(viewId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.add('hidden-view');
        el.classList.remove('active-view');
    });

    // Show target
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden-view');
        target.classList.add('active-view');
    }
}

function renderShop() {
    const container = document.getElementById('shop-list');
    if (!container) return;
    container.innerHTML = '';

    BADGES.forEach(badge => {
        const isOwned = userManager.hasBadge(badge.id);
        const canAfford = userManager.getPoints() >= badge.cost;

        const el = document.createElement('div');
        el.className = `badge-item ${isOwned ? 'owned' : ''}`;
        el.innerHTML = `
            <div class="badge-icon">${badge.icon}</div>
            <div class="badge-info">
                <h3>${badge.name}</h3>
                <p>${badge.description}</p>
                <div class="badge-cost">${badge.cost} pts</div>
            </div>
            <button class="shop-btn" ${isOwned ? 'disabled' : ''}>
                ${isOwned ? 'Owned' : 'Buy'}
            </button>
        `;

        if (!isOwned) {
            const btn = el.querySelector('button');
            if (!canAfford) btn.disabled = true;

            btn.addEventListener('click', () => {
                if (userManager.buyBadge(badge.id)) {
                    renderShop(); // Re-render to show owned
                    renderProfile();
                } else {
                    alert("Not enough points!");
                }
            });
        }

        container.appendChild(el);
    });
}

function renderProfile() {
    const container = document.getElementById('profile-badges');
    if (!container) return;
    container.innerHTML = '';

    const owned = BADGES.filter(b => userManager.hasBadge(b.id));

    if (owned.length === 0) {
        container.innerHTML = '<p>No badges yet. Play games to earn points!</p>';
        return;
    }

    owned.forEach(badge => {
        const el = document.createElement('div');
        el.className = 'badge-item owned mini';
        el.innerHTML = `
            <div class="badge-icon">${badge.icon}</div>
            <div class="badge-name">${badge.name}</div>
        `;
        container.appendChild(el);
    });

    document.getElementById('profile-total-points').innerText = userManager.getPoints();
}
