const { test, expect } = require('@playwright/test');
const path = require('path');

test('Balatro Game Runtime', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // 1. Load Game
  const filePath = `file://${path.join(process.cwd(), 'index.html')}`;
  console.log("Navigating to:", filePath);
  await page.goto(filePath);

  // 2. Start Balatro
  const playBtn = page.locator('[data-nav="balatro-view"]');
  await expect(playBtn).toBeVisible();
  await playBtn.click();

  // 3. Verify View Loaded
  const canvas = page.locator('#balatro-canvas');
  await expect(canvas).toBeAttached();

  // 4. Select Blind
  const blindSelect = page.locator('#b-blind-select');
  await expect(blindSelect).toBeVisible();

  const selectBtn = page.locator('#b-select-play');
  await selectBtn.click();
  await expect(blindSelect).not.toBeVisible();

  // 5. Select Cards (Interact with Canvas)
  // Cards are faned at bottom. Click slightly left of center bottom.
  const viewport = await page.viewportSize();
  if (!viewport) throw new Error("No viewport");

  const centerX = viewport.width / 2;
  const bottomY = viewport.height * 0.85;

  console.log(`Clicking at ${centerX}, ${bottomY}`);
  await page.mouse.click(centerX, bottomY); // Center card
  await page.waitForTimeout(200);
  await page.mouse.click(centerX - 50, bottomY); // Left card

  // 6. Play Hand
  const playHandBtn = page.locator('#b-play-btn');
  await playHandBtn.click();

  // 7. Verify Score
  // Wait for score animation (it takes a few seconds)
  // The chips element should change from 0
  const chipsEl = page.locator('#b-chips');
  await expect(chipsEl).not.toHaveText('0', { timeout: 10000 });

  const scoreEl = page.locator('#b-current-score');
  // Eventually score updates
  await expect(scoreEl).not.toHaveText('0', { timeout: 10000 });

  console.log("Score Updated. Test Passed.");

  await page.screenshot({ path: 'balatro_runtime.png' });
});
