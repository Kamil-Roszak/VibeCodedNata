const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let isPlaying = false;
let score = 0;
let lives = 3;
let highScore = 0;
let lastTime = 0;
let difficultyMultiplier = 1;
let shakeTime = 0;

let bottles = [];
let particles = [];
let spawnTimer = 0;
let spawnInterval = 1000; // ms

// Assets
const bottleImg = new Image();
bottleImg.src = 'assets/nata_cola.png';

const catchSound = new Audio('assets/catch.ogg');
const missSound = new Audio('assets/miss.ogg');
const gameOverSound = new Audio('assets/gameover.ogg');

let isMuted = false;

function playSound(sound) {
    if (isMuted) return;
    sound.currentTime = 0;
    sound.play().catch(e => console.log("Audio play failed", e));
}

// Player
const player = {
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    speed: 600,
    color: '#E30613'
};

// Input State
const keys = {};
let touchX = null;

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

window.addEventListener('touchstart', e => {
    touchX = e.touches[0].clientX;
}, {passive: false});

window.addEventListener('touchmove', e => {
    e.preventDefault(); // Prevent scrolling
    touchX = e.touches[0].clientX;
}, {passive: false});

window.addEventListener('touchend', e => {
    touchX = null;
});

// Resize handling
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Position player at bottom center initially
    player.y = canvas.height - player.height - 20;
    if (!isPlaying) {
        player.x = (canvas.width - player.width) / 2;
    } else {
        // Keep player in bounds on resize
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    }
}

window.addEventListener('resize', resize);
resize();

// Game Loop
function gameLoop(timestamp) {
    if (!isPlaying) return;

    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    // Player Movement
    let dx = 0;

    // Keyboard
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;

    if (dx !== 0) {
        player.x += dx * player.speed * deltaTime;
    }

    // Touch - Move player towards touch position
    if (touchX !== null) {
        // Center player on touch
        const targetX = touchX - player.width / 2;
        // Smooth movement or direct? Direct feels more responsive for this game type
        // Let's use a lerp for a little smoothness, or just set it.
        // Setting it directly feels better for "catch" games usually.
        // But let's limit speed just in case.

        const diff = targetX - player.x;
        if (Math.abs(diff) > 5) {
             // If far, move at speed. If close, snap?
             // Actually, direct tracking is best for mobile usually.
             player.x = targetX;
        }
    }

    // Boundaries
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;

    // Screen Shake
    if (shakeTime > 0) {
        shakeTime -= deltaTime;
    }

    // Particles Logic
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.life -= deltaTime;
        p.vy += 500 * deltaTime; // Gravity

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Bottles Logic
    spawnTimer += deltaTime * 1000;
    if (spawnTimer > spawnInterval) {
        spawnBottle();
        spawnTimer = 0;
        // Decrease interval slightly as game progresses, down to a minimum
        spawnInterval = Math.max(400, 1000 - score * 10);
    }

    for (let i = bottles.length - 1; i >= 0; i--) {
        let b = bottles[i];
        b.y += b.speed * deltaTime * difficultyMultiplier;
        b.rotation += b.rotationSpeed * deltaTime;

        // Collision Detection
        if (
            b.x < player.x + player.width &&
            b.x + b.width > player.x &&
            b.y < player.y + player.height &&
            b.y + b.height > player.y
        ) {
            // Caught!
            score++;
            playSound(catchSound);
            createParticles(b.x + b.width/2, b.y + b.height/2);
            document.getElementById('score').innerText = score;
            bottles.splice(i, 1);
            continue;
        }

        // Missed (Off screen)
        if (b.y > canvas.height) {
            lives--;
            playSound(missSound);
            shakeTime = 0.2; // Shake for 200ms

            // Update Lives Display (Hearts)
            let hearts = "";
            for(let j=0; j<lives; j++) hearts += "❤";
            document.getElementById('lives').innerText = hearts;

            bottles.splice(i, 1);

            if (lives <= 0) {
                gameOver();
            }
            continue;
        }

        // Increase speed slightly over time or based on score
        difficultyMultiplier = 1 + (score / 50);
    }
}

function spawnBottle() {
    const size = 80; // Bottle size
    const x = Math.random() * (canvas.width - 40); // 40 is width
    bottles.push({
        x: x,
        y: -size,
        width: 40, // Hitbox width
        height: 80, // Hitbox height
        speed: 200 + Math.random() * 100, // Random speed
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 2 // Random rotation direction
    });
}

function createParticles(x, y) {
    for (let i = 0; i < 15; i++) {
        particles.push({
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

function draw() {
    ctx.save();

    // Screen Shake Apply
    if (shakeTime > 0) {
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        ctx.translate(dx, dy);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Particles
    for (let p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Draw Bottles
    for (let b of bottles) {
        if (bottleImg.complete) {
            ctx.save();
            ctx.translate(b.x + b.width/2, b.y + b.height/2);
            ctx.rotate(b.rotation);
            ctx.drawImage(bottleImg, -b.width/2, -b.height/2, b.width, b.height);
            ctx.restore();
        } else {
             // Fallback
             ctx.fillStyle = 'brown';
             ctx.fillRect(b.x, b.y, b.width, b.height);
        }
    }

    // Draw Player (Detailed Crate)
    // Main Body
    ctx.fillStyle = player.color; // #E30613
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Slats (Shading)
    ctx.fillStyle = '#b0040e';
    ctx.fillRect(player.x, player.y + 10, player.width, 5);
    ctx.fillRect(player.x, player.y + 25, player.width, 5);
    ctx.fillRect(player.x, player.y + 40, player.width, 5);

    // Handles/Rim
    ctx.fillStyle = '#d10511';
    ctx.fillRect(player.x - 5, player.y - 5, player.width + 10, 10);

    // Label Background
    ctx.fillStyle = 'white';
    ctx.fillRect(player.x + player.width/2 - 25, player.y + 15, 50, 20);

    // Label Text
    ctx.fillStyle = '#E30613';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("NATA", player.x + player.width/2, player.y + 31);

    ctx.restore();
}

// Initial High Score Load
highScore = parseInt(localStorage.getItem('nata_high_score')) || 0;
document.getElementById('highScoreStart').innerText = highScore;

// Audio Toggle
document.getElementById('audioBtn').addEventListener('click', () => {
    isMuted = !isMuted;
    document.getElementById('audioBtn').innerText = isMuted ? '🔇' : '🔊';
});

// Start Game Hook
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

function gameOver() {
    isPlaying = false;
    playSound(gameOverSound);
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('finalScore').innerText = score;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('nata_high_score', highScore);
    }
    document.getElementById('highScoreEnd').innerText = highScore;
    document.getElementById('highScoreStart').innerText = highScore;
}

function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    isPlaying = true;
    score = 0;
    lives = 3;
    difficultyMultiplier = 1;
    bottles = [];
    particles = [];
    spawnTimer = 0;
    spawnInterval = 1000;

    document.getElementById('score').innerText = score;
    document.getElementById('lives').innerText = "❤❤❤";

    // Reset player position
    player.x = (canvas.width - player.width) / 2;

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}
