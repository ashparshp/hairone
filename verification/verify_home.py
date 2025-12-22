from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(permissions=[])
        page = context.new_page()

        # Mock API calls
        def handle_otp(route):
            print("Intercepted /auth/otp")
            route.fulfill(status=200, body='{"message": "OTP Sent"}')

        def handle_verify(route):
            print("Intercepted /auth/verify")
            route.fulfill(
                status=200,
                body='{"token": "mock_token", "user": {"_id": "1", "name": "Test User", "role": "user"}}'
            )

        def handle_shops(route):
            print("Intercepted /shops")
            # Return empty list to force empty state
            route.fulfill(status=200, body='[]')

        # The frontend calls http://192.168.1.20:8000/api/...
        # We need to route requests to that domain, OR any domain ending in /api/...
        page.route("**/auth/otp", handle_otp)
        page.route("**/auth/verify", handle_verify)
        page.route("**/shops*", handle_shops)

        try:
            print("Navigating to app...")
            page.goto("http://localhost:8081")

            # Wait for splash
            print("Waiting for splash...")
            time.sleep(3)

            # Login Flow
            if page.get_by_placeholder("9876543210").is_visible():
                print("On Login Screen. Logging in...")
                page.fill("input[placeholder='9876543210']", "9999999999")
                page.get_by_text("Send OTP").click()

                print("Waiting for OTP Input...")
                page.wait_for_selector("input[placeholder='XXXX']", timeout=5000)
                page.fill("input[placeholder='XXXX']", "1234")

                print("Clicking Login...")
                page.get_by_text("Login", exact=True).click()

            print("Waiting for Home content...")

            # Expect "No salons found nearby."
            page.wait_for_selector("text=No salons found nearby.", timeout=15000)
            print("Found empty state message.")

            # Check for "Increase Range"
            page.wait_for_selector("text=Increase Range")
            print("Found slider label.")

            print("taking screenshot...")
            page.screenshot(path="verification/home_empty_state.png")
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
