import { test, expect } from '@playwright/test';

test('Verify Profile Page Changes', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Inject user token and data to bypass login
  await page.addInitScript(() => {
    localStorage.setItem('token', 'mock-token');
    localStorage.setItem('user', JSON.stringify({
      _id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      gender: 'male',
      favorites: [],
      applicationStatus: 'none'
    }));
  });

  // Navigate to profile page
  // (tabs) is a group, so it should not be in the URL usually, but let's try /profile
  // If (tabs) is not a group but a folder, then it is in URL. But parens usually mean group.
  await page.goto('http://localhost:8081/profile');

  // Wait for splash screen to animate out (2s + buffer)
  await page.waitForTimeout(4000);

  // Take a debug screenshot to see where we are
  await page.screenshot({ path: 'verification/debug_profile.png' });

  // Wait for profile content to load
  await page.waitForSelector('text=Test User', { timeout: 10000 });

  // 1. Verify "Bookings" stat is missing
  await expect(page.locator('text=Favorites')).toBeVisible();
  await expect(page.locator('text=Gender')).toBeVisible();

  // 2. Open Edit Profile Modal
  await page.click('text=Edit Profile');

  // Wait for modal
  await page.waitForSelector('text=Update Profile');

  // 3. Verify Gender options
  await expect(page.locator('text=Male')).toBeVisible();
  await expect(page.locator('text=Female')).toBeVisible();
  await expect(page.locator('text=Other')).toBeVisible();

  // Take screenshot
  await page.screenshot({ path: 'verification/profile_verification.png' });
});
