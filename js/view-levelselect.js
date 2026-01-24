class LevelSelectView {
    constructor() {
        this.container = document.getElementById('level-map');
        this.levelGen = new LevelGenerator();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const maxLevel = userManager.getMatch3Level();
        // Render 50 levels ahead of max
        const limit = Math.max(20, maxLevel + 10);

        for (let i = 1; i <= limit; i++) {
            const isLocked = i > maxLevel;
            const stars = userManager.getMatch3Stars(i);

            const node = document.createElement('div');
            node.className = `level-node ${isLocked ? 'locked' : 'unlocked'}`;

            // Stagger position for "Path" feel
            // Sin wave pattern
            const offset = Math.sin(i) * 50;
            node.style.marginLeft = `${offset}px`;

            if (isLocked) {
                node.innerHTML = `<div class="level-num">🔒 ${i}</div>`;
            } else {
                let starStr = '';
                for(let s=0; s<3; s++) starStr += s < stars ? '⭐' : '☆';

                node.innerHTML = `
                    <div class="level-num">${i}</div>
                    <div class="level-stars">${starStr}</div>
                `;

                node.addEventListener('click', () => {
                   this.launchLevel(i);
                });
            }

            this.container.appendChild(node);
        }

        // Scroll to current level
        setTimeout(() => {
            const current = this.container.children[maxLevel-1];
            if (current) current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    launchLevel(level) {
        if (window.startMatch3) {
            window.startMatch3(level);
        }
    }
}

// Global instance
window.levelSelectView = new LevelSelectView();
