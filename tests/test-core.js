const { BalatroGame, JokerManager } = require('../js/game-balatro-core.js');

// Mock window for dependencies if needed (though core checks module.exports first)
// But wait, core.js does:
// if (typeof module !== 'undefined' && module.exports) { ... } else { ... }
// So it should handle it.

console.log("Starting Core Tests...");

try {
    const game = new BalatroGame();
    console.log("Game initialized.");

    // Check Initial State
    if (game.state !== 'PLAYING' && game.state !== 'BLIND_SELECT') {
         // It inits hand levels but doesn't set state explicitly in constructor until prepareBlindSelect is called?
         // Constructor sets state = 'PLAYING' by default.
    }

    // Prepare Blind
    console.log("Preparing Blind Select...");
    game.prepareBlindSelect();
    if (game.state !== 'BLIND_SELECT') throw new Error(`State should be BLIND_SELECT, got ${game.state}`);
    console.log("Blind Select OK. Blind:", game.currentBlind.name);

    // Start Round
    console.log("Starting Round...");
    game.startRound();
    if (game.state !== 'PLAYING') throw new Error(`State should be PLAYING, got ${game.state}`);
    console.log("Round Started. Hand size:", game.hand.length);

    if (game.hand.length !== 8) throw new Error("Hand size should be 8");

    // Select Cards
    // Select first 2 cards
    const c1 = game.hand[0];
    const c2 = game.hand[1];
    console.log(`Selecting cards: ${c1.rank}${c1.suit} and ${c2.rank}${c2.suit}`);

    game.selectCard(c1.id);
    game.selectCard(c2.id);

    const selected = game.getSelectedCards();
    if (selected.length !== 2) throw new Error("Selected count incorrect");

    // Evaluate Hand Preview
    const preview = game.evaluateSelectedHand();
    console.log("Hand Preview:", preview.handType, preview.chips * preview.mult);

    // Play Hand
    const initialHands = game.handsLeft;
    console.log("Playing Hand...");
    game.playHand();

    if (game.handsLeft !== initialHands - 1) throw new Error("Hands left did not decrease");
    console.log("Hand Played. Score:", game.currentScore);

    if (game.currentScore === 0) throw new Error("Score should be > 0");

    console.log("Test Passed!");

} catch (e) {
    console.error("Test Failed:", e);
    process.exit(1);
}
