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
            highScores: {},
            match3: {
                maxLevel: 1,
                stars: {} // { 1: 3, 2: 1 }
            }
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

    getMatch3Level() {
        return this.data.match3?.maxLevel || 1;
    }

    getMatch3Stars(level) {
        return this.data.match3?.stars?.[level] || 0;
    }

    completeMatch3Level(level, stars, score) {
        if (!this.data.match3) this.data.match3 = { maxLevel: 1, stars: {} };

        // Update stars if better
        const currentStars = this.data.match3.stars[level] || 0;
        if (stars > currentStars) {
            this.data.match3.stars[level] = stars;
        }

        // Unlock next level
        if (level === this.data.match3.maxLevel) {
            this.data.match3.maxLevel++;
        }

        this.addPoints(score); // Add score to global points
        this.save();
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

    // Match 3 Integration
    let match3Instance = null;
    window.match3Instance = null; // Expose
    const levelGen = new LevelGenerator();

    window.startMatch3 = (level) => {
        const config = levelGen.getConfig(level);

        // Update Start Overlay
        document.getElementById('m3-level-num').innerText = level;
        document.getElementById('m3-start-target').innerText = config.targetScore;

        document.getElementById('match3-start').classList.remove('hidden');
        document.getElementById('match3-end').classList.add('hidden');
        document.getElementById('match3-hud').classList.add('hidden'); // Hide until start

        navigateTo('match3-view');

        // Clean up old
        if (match3Instance) {
            if (match3Instance.dispose) match3Instance.dispose();
            else match3Instance.stop();
            match3Instance = null;
        }

        const startBtn = document.getElementById('m3-play-btn');
        // Remove old listeners to avoid duplicates (naive approach: clone)
        const newBtn = startBtn.cloneNode(true);
        startBtn.parentNode.replaceChild(newBtn, startBtn);

        newBtn.addEventListener('click', () => {
            document.getElementById('match3-start').classList.add('hidden');
            document.getElementById('match3-hud').classList.remove('hidden');

            match3Instance = new Match3Game({
                canvasId: 'match3Canvas',
                levelConfig: config,
                callbacks: {
                    onUpdate: (data) => {
                        document.getElementById('m3-moves').innerText = data.moves;
                        document.getElementById('m3-score').innerText = data.score;
                        document.getElementById('m3-target').innerText = data.target;
                    },
                    onGameOver: (result) => {
                        document.getElementById('match3-hud').classList.add('hidden');
                        document.getElementById('match3-end').classList.remove('hidden');

                        const title = document.getElementById('m3-end-title');
                        const starsEl = document.getElementById('m3-stars');

                        if (result.win) {
                            title.innerText = "Level Complete!";
                            let s = "";
                            for(let i=0; i<result.stars; i++) s += "⭐";
                            starsEl.innerText = s;

                            userManager.completeMatch3Level(level, result.stars, result.score);

                            // Setup Next Button
                            const nextBtn = document.getElementById('m3-next-btn');
                            nextBtn.innerText = "CONTINUE";
                            nextBtn.onclick = () => {
                                navigateTo('level-select-view');
                            };
                        } else {
                            title.innerText = "Out of Moves!";
                            starsEl.innerText = "";
                            const nextBtn = document.getElementById('m3-next-btn');
                            nextBtn.innerText = "TRY AGAIN";
                            nextBtn.onclick = () => {
                                window.startMatch3(level);
                            };
                        }
                        document.getElementById('m3-end-score').innerText = result.score;
                    }
                }
            });
            window.match3Instance = match3Instance;
        });
    };

    // Exit Match 3
    document.getElementById('exitMatch3Btn').addEventListener('click', () => {
        if (match3Instance) {
            if (match3Instance.dispose) match3Instance.dispose();
            else match3Instance.stop();
        }
        navigateTo('level-select-view');
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

    // Special handlers
    if (viewId === 'level-select-view' && window.levelSelectView) {
        window.levelSelectView.render();
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
        el.className = `nata-item-card ${isOwned ? 'owned' : ''}`;
        el.innerHTML = `
            <div class="nata-item-icon">${badge.icon}</div>
            <div class="nata-item-title">${badge.name}</div>
            <div class="nata-item-desc">${badge.description}</div>
            <div class="nata-item-cost">${badge.cost} pts</div>
            <button class="nata-btn ${isOwned ? 'nata-btn-secondary' : 'nata-btn-blue'}" ${isOwned ? 'disabled' : ''}>
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
        el.className = 'nata-item-card owned';
        el.style.width = '120px';
        el.innerHTML = `
            <div class="nata-item-icon" style="font-size: 32px;">${badge.icon}</div>
            <div class="nata-item-title" style="font-size: 14px;">${badge.name}</div>
        `;
        container.appendChild(el);
    });

    document.getElementById('profile-total-points').innerText = userManager.getPoints();
}
