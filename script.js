const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let isPlaying = false;
let score = 0;
let lives = 3;
let highScore = 0;
let lastTime = 0;
let difficultyMultiplier = 1;

let bottles = [];
let spawnTimer = 0;
let spawnInterval = 1000; // ms

// Assets
const bottleImg = new Image();
bottleImg.src = 'assets/nata_cola.png';

// Player
const player = {
    x: 0,
    y: 0,
    width: 80, // Adjustable based on screen size?
    height: 60,
    speed: 600, // pixels per second
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

        // Collision Detection
        if (
            b.x < player.x + player.width &&
            b.x + b.width > player.x &&
            b.y < player.y + player.height &&
            b.y + b.height > player.y
        ) {
            // Caught!
            score++;
            document.getElementById('score').innerText = score;
            bottles.splice(i, 1);
            continue;
        }

        // Missed (Off screen)
        if (b.y > canvas.height) {
            lives--;
            document.getElementById('lives').innerText = lives;
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
        speed: 200 + Math.random() * 100 // Random speed
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Bottles
    for (let b of bottles) {
        if (bottleImg.complete) {
            ctx.drawImage(bottleImg, b.x, b.y, b.width, b.height);
        } else {
             // Fallback
             ctx.fillStyle = 'brown';
             ctx.fillRect(b.x, b.y, b.width, b.height);
        }
    }

    // Draw Player (Basket/Crate)
    ctx.fillStyle = player.color;
    // Simple crate look
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Add some detail to the crate
    ctx.fillStyle = '#c20510';
    ctx.fillRect(player.x, player.y + 10, player.width, 10);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("NATA", player.x + player.width/2, player.y + 40);
}

// Initial High Score Load
highScore = parseInt(localStorage.getItem('nata_high_score')) || 0;
document.getElementById('highScoreStart').innerText = highScore;

// Start Game Hook
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

function gameOver() {
    isPlaying = false;
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
    spawnTimer = 0;
    spawnInterval = 1000;

    document.getElementById('score').innerText = score;
    document.getElementById('lives').innerText = lives;

    // Reset player position
    player.x = (canvas.width - player.width) / 2;

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}
