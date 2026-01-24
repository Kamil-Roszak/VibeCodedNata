class Match3Game {
    constructor(config) {
        this.canvas = document.getElementById(config.canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.callbacks = config.callbacks || {};
        this.levelConfig = config.levelConfig || {};

        // Game Logic Instance
        this.logic = new Match3Logic(
            this.levelConfig.rows,
            this.levelConfig.cols,
            this.levelConfig.types
        );

        // State
        this.isPlaying = false;
        this.movesLeft = this.levelConfig.moves;
        this.targetScore = this.levelConfig.targetScore;
        this.score = 0;
        this.state = 'IDLE'; // IDLE, ANIMATING, GAME_OVER

        // Visual Config
        this.tileSize = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.selectedTile = null; // {r, c}

        this.animations = []; // [{type: 'swap', ...}, {type: 'fall', ...}]
        this.assets = new AssetLoader();
        this.assetMap = ['cola', 'orange', 'lemon', 'lime', 'berry'];

        this.bindEvents();
        this.resize();

        // Load assets then start
        this.assets.loadAll(() => {
            this.start();
        });
    }

    start() {
        this.isPlaying = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    }

    stop() {
        this.isPlaying = false;
    }

    bindEvents() {
        this.handleTouch = this.handleInput.bind(this);
        this.canvas.addEventListener('click', this.handleTouch);
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Calculate tile size to fit grid in screen (leaving space for UI)
        const maxW = this.canvas.width - 40;
        const maxH = this.canvas.height - 200; // Header/Footer space

        this.tileSize = Math.min(maxW / this.logic.cols, maxH / this.logic.rows);
        this.offsetX = (this.canvas.width - this.logic.cols * this.tileSize) / 2;
        this.offsetY = 100 + (maxH - this.logic.rows * this.tileSize) / 2;
    }

    handleInput(e) {
        if (this.state !== 'IDLE') return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - this.offsetX;
        const y = e.clientY - rect.top - this.offsetY;

        const c = Math.floor(x / this.tileSize);
        const r = Math.floor(y / this.tileSize);

        if (c >= 0 && c < this.logic.cols && r >= 0 && r < this.logic.rows) {
            this.onTileClick(r, c);
        } else {
            this.selectedTile = null; // Deselect if clicked outside
        }
    }

    onTileClick(r, c) {
        if (!this.selectedTile) {
            this.selectedTile = { r, c };
            return;
        }

        // Second click
        const r1 = this.selectedTile.r;
        const c1 = this.selectedTile.c;
        this.selectedTile = null;

        // Same tile clicked?
        if (r1 === r && c1 === c) return;

        // Attempt swap
        if (this.logic.swap(r1, c1, r, c)) {
            // Valid swap!
            this.movesLeft--;
            this.state = 'ANIMATING';

            // Add Swap Animation
            this.animations.push({
                type: 'swap',
                t: 0,
                duration: 0.3,
                r1, c1, r2: r, c2: c,
                onComplete: () => {
                    this.processMatches();
                }
            });
        } else {
            // Invalid swap animation (wiggle?)
            this.animations.push({
                type: 'bad_swap',
                t: 0,
                duration: 0.3,
                r1, c1, r2: r, c2: c
            });
            this.state = 'ANIMATING';
        }

        this.updateUI();
    }

    processMatches() {
        const matches = this.logic.findMatches();
        if (matches.length > 0) {
            this.logic.removeMatches(matches);
            this.score = this.logic.score;

            // Pop Animation
            this.animations.push({
                type: 'pop',
                t: 0,
                duration: 0.2,
                tiles: matches,
                onComplete: () => {
                    // Gravity
                    const moves = this.logic.applyGravity();
                    const newTiles = this.logic.refill();

                    // Fall Animation
                    this.animations.push({
                        type: 'fall',
                        t: 0,
                        duration: 0.4,
                        moves: moves,
                        newTiles: newTiles,
                        onComplete: () => {
                            // Recursively check for new matches
                            this.processMatches();
                        }
                    });
                }
            });
        } else {
            this.state = 'IDLE';
            this.checkWinCondition();
        }
        this.updateUI();
    }

    checkWinCondition() {
        if (this.score >= this.targetScore) {
            this.endGame(true);
        } else if (this.movesLeft <= 0) {
            this.endGame(false);
        }
    }

    endGame(win) {
        this.isPlaying = false;
        if (this.callbacks.onGameOver) {
            this.callbacks.onGameOver({
                win: win,
                score: this.score,
                stars: this.calculateStars()
            });
        }
    }

    calculateStars() {
        if (this.score >= this.targetScore * 1.5) return 3;
        if (this.score >= this.targetScore * 1.2) return 2;
        return 1;
    }

    updateUI() {
        if (this.callbacks.onUpdate) {
            this.callbacks.onUpdate({
                moves: this.movesLeft,
                score: this.score,
                target: this.targetScore
            });
        }
    }

    loop(timestamp) {
        if (!this.isPlaying) return;
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();
        requestAnimationFrame(this.loop.bind(this));
    }

    update(dt) {
        // Process animations
        if (this.animations.length > 0) {
            const anim = this.animations[0];
            anim.t += dt;
            if (anim.t >= anim.duration) {
                this.animations.shift();
                if (anim.onComplete) anim.onComplete();
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Board Background
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fillRect(
            this.offsetX - 10,
            this.offsetY - 10,
            this.logic.cols * this.tileSize + 20,
            this.logic.rows * this.tileSize + 20
        );
        this.ctx.strokeStyle = '#E30613';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(
            this.offsetX - 10,
            this.offsetY - 10,
            this.logic.cols * this.tileSize + 20,
            this.logic.rows * this.tileSize + 20
        );

        // Handle Active Animation offsets
        let offsets = {}; // Key "r,c" -> {x, y, scale}

        const currentAnim = this.animations[0];
        if (currentAnim) {
            const progress = Math.min(1, currentAnim.t / currentAnim.duration);

            if (currentAnim.type === 'swap' || currentAnim.type === 'bad_swap') {
                const { r1, c1, r2, c2 } = currentAnim;
                // Simple Linear Interpolation
                // Or easeInOut
                const ease = t => t<.5 ? 2*t*t : -1+(4-2*t)*t;
                const p = currentAnim.type === 'bad_swap'
                    ? Math.sin(progress * Math.PI) * 0.5 // Go halfway then back
                    : ease(progress);

                offsets[`${r1},${c1}`] = {
                    x: (c2 - c1) * this.tileSize * p,
                    y: (r2 - r1) * this.tileSize * p
                };
                offsets[`${r2},${c2}`] = {
                    x: (c1 - c2) * this.tileSize * p,
                    y: (r1 - r2) * this.tileSize * p
                };
            }

            if (currentAnim.type === 'pop') {
                currentAnim.tiles.forEach(t => {
                    offsets[`${t.r},${t.c}`] = {
                        scale: 1 - progress,
                        alpha: 1 - progress
                    };
                });
            }

            if (currentAnim.type === 'fall') {
                const easeBounce = t => {
                     // Simple fall
                     return t * t;
                };
                const p = easeBounce(progress);

                // Existing tiles falling
                currentAnim.moves.forEach(m => {
                    // Logic grid already updated to TO, so we render at FROM -> TO
                    // Actually logic grid has the item at TO.
                    // So we want to render it starting at (From - To) relative pos?
                    // Yes. Start at (fromR - toR) * size. End at 0.
                    const startY = (m.fromR - m.toR) * this.tileSize;
                    offsets[`${m.toR},${m.c}`] = {
                        y: startY * (1 - p) // Lerp from startY to 0
                    };
                });

                // New tiles falling from above
                currentAnim.newTiles.forEach(t => {
                    // Start from above screen? Say -5 rows up to 0 relative to their pos
                    const startY = -(t.r + 2) * this.tileSize;
                    // Actually let's just say they start at -tileSize*something relative to their final spot
                    // Simpler: Start at -TargetRow * Size.
                    offsets[`${t.r},${t.c}`] = {
                        y: -(t.r + 1) * this.tileSize * (1 - p)
                    };
                });
            }
        }

        // Draw Tiles
        for (let r = 0; r < this.logic.rows; r++) {
            for (let c = 0; c < this.logic.cols; c++) {
                const tile = this.logic.grid[r][c];
                if (tile.type === -1 && !offsets[`${r},${c}`]) continue; // Skip empty unless animating

                let x = this.offsetX + c * this.tileSize;
                let y = this.offsetY + r * this.tileSize;
                let scale = 1;
                let alpha = 1;

                // Apply offsets
                const off = offsets[`${r},${c}`];
                if (off) {
                    if (off.x) x += off.x;
                    if (off.y) y += off.y;
                    if (off.scale !== undefined) scale = off.scale;
                    if (off.alpha !== undefined) alpha = off.alpha;
                }

                // Apply Selection highlight
                if (this.selectedTile && this.selectedTile.r === r && this.selectedTile.c === c) {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                }

                // Draw Asset
                const assetKey = this.assetMap[tile.type];
                const img = this.assets.get(assetKey);

                if (img && alpha > 0) {
                    this.ctx.globalAlpha = alpha;
                    const pad = 5;
                    const w = this.tileSize - pad*2;
                    const h = this.tileSize - pad*2;

                    // Center with scale
                    const cx = x + pad + w/2;
                    const cy = y + pad + h/2;

                    this.ctx.translate(cx, cy);
                    this.ctx.scale(scale, scale);
                    this.ctx.drawImage(img, -w/2, -h/2, w, h);
                    this.ctx.setTransform(1,0,0,1,0,0);
                    this.ctx.globalAlpha = 1;
                }
            }
        }
    }
}
