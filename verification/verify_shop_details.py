from playwright.sync_api import sync_playwright
import time
import json

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Log requests
    page.on("request", lambda request: print(f">> {request.method} {request.url}"))

    # 1. Inject LocalStorage
    user_data = {
        "_id": "u1",
        "name": "Test User",
        "phone": "9876543210",
        "role": "user"
    }
    init_script = f"""
        window.localStorage.setItem('token', 'dummy-token');
        window.localStorage.setItem('user', JSON.stringify({json.dumps(user_data)}));
    """
    page.add_init_script(init_script)

    try:
        print("Navigating to Shop Page...")
        page.goto("http://localhost:8081/salon/test-shop-id", timeout=60000)

        print("Waiting for service name...")
        # Look for the Hardcoded name
        page.wait_for_selector("text=Standard Haircut", timeout=30000)

        # Wait for layout to settle
        time.sleep(1)

        print("Taking screenshot...")
        page.screenshot(path="verification/shop_details_layout.png", full_page=True)
        print("Screenshot saved.")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error_final.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
