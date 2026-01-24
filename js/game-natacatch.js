class NataCatchGame {
    constructor(config) {
        this.canvas = document.getElementById(config.canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.callbacks = config.callbacks || {};
        this.ui = config.ui || {}; // IDs for score, lives, etc.

        // Game State
        this.isPlaying = false;
        this.score = 0;
        this.lives = 3;
        this.lastTime = 0;
        this.difficultyMultiplier = 1;
        this.shakeTime = 0;

        this.bottles = [];
        this.particles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1000;

        // Assets
        this.bottleImg = new Image();
        this.bottleImg.src = 'assets/nata_cola.png';

        this.catchSound = new Audio('assets/catch.ogg');
        this.missSound = new Audio('assets/miss.ogg');
        this.gameOverSound = new Audio('assets/gameover.ogg');

        this.isMuted = false;

        // Player
        this.player = {
            x: 0,
            y: 0,
            width: 100,
            height: 60,
            speed: 600,
            color: '#E30613'
        };

        // Input
        this.keys = {};
        this.touchX = null;

        this.bindEvents();
        this.resize();

        // Bind loop
        this.loop = this.loop.bind(this);
    }

    playSound(sound) {
        if (this.isMuted) return;
        // Clone to allow overlapping sounds
        const s = sound.cloneNode();
        s.volume = 0.5;
        s.play().catch(e => {});
    }

    bindEvents() {
        this.handleKeyDown = (e) => this.keys[e.code] = true;
        this.handleKeyUp = (e) => this.keys[e.code] = false;

        this.handleTouchStart = (e) => { this.touchX = e.touches[0].clientX; };
        this.handleTouchMove = (e) => {
            e.preventDefault();
            this.touchX = e.touches[0].clientX;
        };
        this.handleTouchEnd = (e) => { this.touchX = null; };
        this.handleResize = () => this.resize();

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('touchstart', this.handleTouchStart, {passive: false});
        window.addEventListener('touchmove', this.handleTouchMove, {passive: false});
        window.addEventListener('touchend', this.handleTouchEnd);
        window.addEventListener('resize', this.handleResize);
    }

    unbindEvents() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('touchstart', this.handleTouchStart);
        window.removeEventListener('touchmove', this.handleTouchMove);
        window.removeEventListener('touchend', this.handleTouchEnd);
        window.removeEventListener('resize', this.handleResize);
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.player.y = this.canvas.height - this.player.height - 20;

        // If resizing while not playing, center player
        if (!this.isPlaying) {
             this.player.x = (this.canvas.width - this.player.width) / 2;
        } else {
             this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
        }
    }

    start() {
        this.isPlaying = true;
        this.score = 0;
        this.lives = 3;
        this.difficultyMultiplier = 1;
        this.bottles = [];
        this.particles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1000;
        this.shakeTime = 0;

        this.updateUI();

        this.player.x = (this.canvas.width - this.player.width) / 2;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
    }

    stop() {
        this.isPlaying = false;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    updateUI() {
        if (this.ui.score) document.getElementById(this.ui.score).innerText = this.score;
        if (this.ui.lives) {
            let hearts = "";
            for(let j=0; j<this.lives; j++) hearts += "❤";
            document.getElementById(this.ui.lives).innerText = hearts;
        }
    }

    loop(timestamp) {
        if (!this.isPlaying) return;

        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame(this.loop);
    }

    update(deltaTime) {
        // Player Movement
        let dx = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;

        if (dx !== 0) {
            this.player.x += dx * this.player.speed * deltaTime;
        }

        if (this.touchX !== null) {
            const targetX = this.touchX - this.player.width / 2;
            // Direct tracking
            this.player.x = targetX;
        }

        // Boundaries
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x > this.canvas.width - this.player.width) this.player.x = this.canvas.width - this.player.width;

        // Screen Shake
        if (this.shakeTime > 0) {
            this.shakeTime -= deltaTime;
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.life -= deltaTime;
            p.vy += 500 * deltaTime;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Bottles
        this.spawnTimer += deltaTime * 1000;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnBottle();
            this.spawnTimer = 0;
            this.spawnInterval = Math.max(400, 1000 - this.score * 10);
        }

        for (let i = this.bottles.length - 1; i >= 0; i--) {
            let b = this.bottles[i];
            b.y += b.speed * deltaTime * this.difficultyMultiplier;
            b.rotation += b.rotationSpeed * deltaTime;

            // Collision
            if (
                b.x < this.player.x + this.player.width &&
                b.x + b.width > this.player.x &&
                b.y < this.player.y + this.player.height &&
                b.y + b.height > this.player.y
            ) {
                this.score++;
                this.playSound(this.catchSound);
                this.createParticles(b.x + b.width/2, b.y + b.height/2);
                this.updateUI();
                this.bottles.splice(i, 1);
                continue;
            }

            // Missed
            if (b.y > this.canvas.height) {
                this.lives--;
                this.playSound(this.missSound);
                this.shakeTime = 0.2;
                this.updateUI();
                this.bottles.splice(i, 1);

                if (this.lives <= 0) {
                    this.gameOver();
                }
                continue;
            }

            this.difficultyMultiplier = 1 + (this.score / 50);
        }
    }

    spawnBottle() {
        const size = 80;
        const x = Math.random() * (this.canvas.width - 40);
        this.bottles.push({
            x: x,
            y: -size,
            width: 40,
            height: 80,
            speed: 200 + Math.random() * 100,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 2
        });
    }

    createParticles(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400,
                life: 0.5 + Math.random() * 0.5,
                color: Math.random() > 0.5 ? '#E30613' : 'white',
                size: Math.random() * 5 + 2
            });
        }
    }

    draw() {
        this.ctx.save();

        if (this.shakeTime > 0) {
            const dx = (Math.random() - 0.5) * 10;
            const dy = (Math.random() - 0.5) * 10;
            this.ctx.translate(dx, dy);
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Particles
        for (let p of this.particles) {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        }

        // Bottles
        for (let b of this.bottles) {
            if (this.bottleImg.complete) {
                this.ctx.save();
                this.ctx.translate(b.x + b.width/2, b.y + b.height/2);
                this.ctx.rotate(b.rotation);
                this.ctx.drawImage(this.bottleImg, -b.width/2, -b.height/2, b.width, b.height);
                this.ctx.restore();
            } else {
                this.ctx.fillStyle = 'brown';
                this.ctx.fillRect(b.x, b.y, b.width, b.height);
            }
        }

        // Player
        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);

        this.ctx.fillStyle = '#b0040e';
        this.ctx.fillRect(this.player.x, this.player.y + 10, this.player.width, 5);
        this.ctx.fillRect(this.player.x, this.player.y + 25, this.player.width, 5);
        this.ctx.fillRect(this.player.x, this.player.y + 40, this.player.width, 5);

        this.ctx.fillStyle = '#d10511';
        this.ctx.fillRect(this.player.x - 5, this.player.y - 5, this.player.width + 10, 10);

        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(this.player.x + this.player.width/2 - 25, this.player.y + 15, 50, 20);

        this.ctx.fillStyle = '#E30613';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("NATA", this.player.x + this.player.width/2, this.player.y + 31);

        this.ctx.restore();
    }

    gameOver() {
        this.isPlaying = false;
        this.playSound(this.gameOverSound);
        if (this.callbacks.onGameOver) {
            this.callbacks.onGameOver(this.score);
        }
    }
}
