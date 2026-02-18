import { test, expect } from '@playwright/test';

test.describe('Image Generation - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the application and show empty state', async ({ page }) => {
    await expect(page).toHaveTitle(/Data Portrait/);
    await expect(page.locator('text=Create Your Data Portrait')).toBeVisible();
    await expect(page.locator('text=Try Sample Data')).toBeVisible();
  });

  test('should load sample data and show purchase data', async ({ page }) => {
    await page.click('button:has-text("Try Sample Data")');

    await expect(page.locator('text=Live Data Analysis')).toBeVisible();

    await expect(
      page.locator('text=/\\d+ products extracted from \\d+ data sources/')
    ).toBeVisible();
    await expect(page.locator('button', { hasText: 'Amazon' })).toBeVisible();
    await expect(
      page.locator('button', { hasText: 'Goodreads' })
    ).toBeVisible();

    await expect(
      page.locator('button:has-text("Clear Demo Data")')
    ).toBeVisible();
  });

  test('should generate portrait and display generated image', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.click('button:has-text("Try Sample Data")');

    // Wait for data to be loaded
    await expect(page.locator('text=Live Data Analysis')).toBeVisible();

    // Find and click the generate button in the sidebar
    const generateButton = page.locator(
      'aside button:has-text("Generate Data Portrait")'
    );
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // Should show generating state - use first() to avoid multiple element error
    await expect(page.locator('text=Generating...').first()).toBeVisible();

    // Wait for generation to complete (longer timeout for real API)
    await expect(page.locator('text=Generating...').first()).toBeHidden({
      timeout: 90000,
    });

    // Should show the generated image in the grid
    await expect(
      page
        .locator(
          'img[alt*="Generated"], img[src*=".png"], img[src*=".jpg"], img[src*=".webp"]'
        )
        .first()
    ).toBeVisible({ timeout: 15000 });
  });
});
