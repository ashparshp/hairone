from playwright.sync_api import Page, expect, sync_playwright
import time
import json

def verify_shop_gallery(page: Page):
    print("Navigating to home...")
    page.goto("http://localhost:8081")

    page.wait_for_timeout(5000)

    print("Injecting Mock Data...")
    page.evaluate("""() => {
        const user = {
            _id: 'owner123',
            name: 'Test Owner',
            role: 'owner',
            myShopId: 'shop123',
            token: 'mock-token'
        };
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', 'mock-token');
        localStorage.setItem('TEST_MODE', 'true');
    }""")

    print("Reloading...")
    page.reload()
    page.wait_for_timeout(3000)

    print("Setting up interceptors...")

    page.route("**/api/shops/config", lambda route: route.fulfill(
        status=200,
        body='{"userDiscountRate": 0, "isPaymentTestMode": false}',
        headers={"content-type": "application/json"}
    ))

    shop_response = {
        "shop": {
            "_id": "shop123",
            "name": "Gallery Test Shop",
            "address": "123 Creative St",
            "type": "unisex",
            "rating": 4.8,
            "reviewCount": 10,
            "gallery": [
                "https://via.placeholder.com/300/09f/fff.png",
                "https://via.placeholder.com/300/e91e63/fff.png"
            ],
            "services": [],
            "combos": [],
            "coordinates": {"lat": 0, "lng": 0}
        },
        "barbers": []
    }

    # Python dict to JSON string safely
    shop_json = json.dumps(shop_response)

    page.route("**/api/shops/shop123", lambda route: route.fulfill(
        status=200,
        body=shop_json,
        headers={"content-type": "application/json"}
    ))

    page.route("**/api/shops/shop123/finance/summary*", lambda route: route.fulfill(
        status=200,
        body='{"weekly": 0, "monthly": 0, "yearly": 0, "pendingSettlement": 0}',
        headers={"content-type": "application/json"}
    ))

    # --- TEST 1: DASHBOARD ---
    print("Navigating to Dashboard...")
    page.goto("http://localhost:8081/dashboard")
    page.wait_for_timeout(5000)

    print("Capturing Dashboard...")
    page.screenshot(path="/home/jules/verification/dashboard_gallery_link.png")

    # Check for Portfolio text
    if page.get_by_text("Portfolio").count() > 0:
        print("SUCCESS: Portfolio card found on Dashboard.")
    else:
        print("FAILURE: Portfolio card NOT found on Dashboard.")

    # --- TEST 2: CUSTOMER SHOP VIEW ---
    print("Navigating to Shop Details (Customer View)...")
    # Note: Using /salon/[id] route pattern
    page.goto("http://localhost:8081/salon/shop123")
    page.wait_for_timeout(5000)

    print("Switching to Portfolio Tab...")
    portfolio_tab = page.get_by_text("Portfolio")
    if portfolio_tab.count() > 0:
         portfolio_tab.click()
         page.wait_for_timeout(2000)

         # Check images
         # We expect at least 2 images (the gallery ones) plus maybe others
         # Note: Placeholder images might not load if no internet, but the img tags should exist
         imgs = page.locator("img[src*='via.placeholder.com']")
         count = imgs.count()
         print(f"Found {count} gallery images.")

         print("Capturing Gallery...")
         page.screenshot(path="/home/jules/verification/shop_gallery_view.png")
    else:
         print("FAILURE: Portfolio tab NOT found.")
         page.screenshot(path="/home/jules/verification/shop_details_fail.png")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      verify_shop_gallery(page)
    except Exception as e:
        print(f"Error: {e}")
    finally:
      browser.close()
