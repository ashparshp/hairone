import { test, expect } from '@playwright/test';

test('Verify Admin Finance UI', async ({ page }) => {
  // Inject Token
  await page.addInitScript(() => {
    window.localStorage.setItem('userToken', 'mock-token');
    window.localStorage.setItem('user', JSON.stringify({ _id: 'admin-id', role: 'admin', name: 'Admin User' }));
  });

  // 1. Mock API Responses
  // Auth
  await page.route('**/api/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { _id: 'admin-id', role: 'admin', name: 'Admin User' }, token: 'mock-token' })
    });
  });

  // Pending Settlements
  await page.route('**/api/admin/finance', async route => {
    await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
            {
                shopId: 'shop1',
                shopName: 'Barber King',
                totalPending: 80, // Admin owes shop (Online > Cash)
                details: { bookingCount: 5 }
            },
            {
                shopId: 'shop2',
                shopName: 'Cash Only Cuts',
                totalPending: -50, // Shop owes admin (Cash > Online)
                details: { bookingCount: 3 }
            }
        ])
    });
  });

  // History Settlements
  await page.route('**/api/admin/finance/settlements', async route => {
      await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
              {
                  _id: 'settlement1',
                  shopId: { name: 'Barber King' },
                  type: 'PAYOUT',
                  amount: 120,
                  createdAt: new Date().toISOString()
              }
          ])
      });
  });

  // 2. Navigate
  await page.goto('http://localhost:8081/admin/finance');

  // 3. Wait for content
  // Check Tabs
  await expect(page.getByText('Pending Settlements')).toBeVisible();
  await expect(page.getByText('Settlement History')).toBeVisible();

  // Check List Items
  await expect(page.getByText('Barber King')).toBeVisible();
  await expect(page.getByText('Admin owes Barber')).toBeVisible();
  await expect(page.getByText('₹80.00')).toBeVisible();

  await expect(page.getByText('Cash Only Cuts')).toBeVisible();
  await expect(page.getByText('Barber owes Admin')).toBeVisible();
  await expect(page.getByText('₹50.00')).toBeVisible();

  // 4. Take Screenshot of Pending
  await page.screenshot({ path: 'verification/admin_finance_pending.png' });

  // 5. Switch to History
  await page.getByText('Settlement History').click();
  await expect(page.getByText('PAYOUT')).toBeVisible();
  await expect(page.getByText('₹120.00')).toBeVisible();

  // 6. Screenshot History
  await page.screenshot({ path: 'verification/admin_finance_history.png' });
});

test('Verify Shop Owner Finance UI', async ({ page }) => {
    // Inject Token
    await page.addInitScript(() => {
        window.localStorage.setItem('userToken', 'mock-token');
        window.localStorage.setItem('user', JSON.stringify({ _id: 'owner-id', role: 'owner', name: 'Owner User', myShopId: 'shop1' }));
    });

    // 1. Mock API Responses
    // Auth (Owner)
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { _id: 'owner-id', role: 'owner', name: 'Owner User', myShopId: 'shop1' }, token: 'mock-token' })
      });
    });

    // Finance Summary
    await page.route('**/api/shops/shop1/finance/summary', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                totalEarnings: 5000,
                currentBalance: 150, // Payout Incoming
                details: {
                    pendingPayout: 200,
                    pendingDues: 50
                }
            })
        });
    });

    // Settlements
    await page.route('**/api/shops/shop1/finance/settlements', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
        });
    });

    // 2. Navigate
    await page.goto('http://localhost:8081/salon/revenue-stats');

    // 3. Wait for content
    await expect(page.getByText('Finance Dashboard')).toBeVisible();
    await expect(page.getByText('Total Earnings')).toBeVisible();
    await expect(page.getByText('₹5,000')).toBeVisible();

    await expect(page.getByText('Payout Incoming')).toBeVisible();
    await expect(page.getByText('Admin owes you ₹150.00')).toBeVisible();

    // 4. Screenshot
    await page.screenshot({ path: 'verification/shop_finance.png' });
  });
