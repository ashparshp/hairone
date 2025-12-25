from playwright.sync_api import sync_playwright, expect
import time

def verify_admin_tabs():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate a mobile device to verify the layout properly
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()

        # Enable logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("request", lambda request: print(f"Request: {request.method} {request.url}"))
        page.on("requestfailed", lambda request: print(f"Request failed: {request.url} {request.failure}"))

        try:
            # 1. Login
            print("Navigating to login...")
            page.goto("http://localhost:8081/(auth)/login")

            # Wait for content
            print("Waiting for content...")
            page.wait_for_selector('text=Mobile Number', timeout=30000)

            # MOCK API RESPONSES - INTERCEPT ACTUAL URL
            api_url = "https://oyster-app-dly8k.ondigitalocean.app/api"

            print("Setting up API mocks...")
            page.route(f"{api_url}/auth/otp", lambda route: route.fulfill(status=200, body='{"message": "OTP Sent"}'))
            page.route(f"{api_url}/auth/verify", lambda route: route.fulfill(
                status=200,
                body='{"token": "fake-token", "user": {"role": "admin", "name": "Admin User", "phone": "9999999999"}}'
            ))

            # Mock Admin Stats
            page.route(f"{api_url}/admin/stats", lambda route: route.fulfill(
                status=200,
                body='{"totalBookings": 150, "totalRevenue": 50000, "shops": 12, "owners": 10, "users": 500, "completedBookings": 140}'
            ))

            # Mock Applications
            page.route(f"{api_url}/admin/applications", lambda route: route.fulfill(status=200, body='[]'))
             # Mock Shops
            page.route(f"{api_url}/admin/shops", lambda route: route.fulfill(status=200, body='[]'))
             # Mock Support
            page.route(f"{api_url}/support/all", lambda route: route.fulfill(status=200, body='[]'))

            # Perform Login
            print("Entering phone...")
            # Use specific locator if placeholder fails
            page.get_by_placeholder("9876543210").fill("9999999999")

            print("Clicking Continue...")
            # Try text locator instead of role
            page.get_by_text("Continue").click()

            print("Entering OTP...")
            # Wait for OTP step (Edit button appears)
            page.wait_for_selector("text=Edit", timeout=10000)

            # Fill the last input found (should be the OTP one)
            page.locator("input").last.fill("1234")

            # 2. Verify Redirect to Admin Tabs
            print("Waiting for Admin Dashboard...")
            page.wait_for_selector("text=Hello, Admin User", timeout=15000)

            print("Taking screenshot of Home Tab...")
            page.screenshot(path="/home/jules/verification/admin_home.png")

            # 3. Verify Other Tabs
            # Click Approvals - Use get_by_role('link') because Expo Router tabs are links usually, or text.
            # But the previous error said get_by_role("tab", name="Shops").
            print("Navigating to Approvals...")
            page.get_by_text("Approvals").click()
            page.wait_for_selector("text=Pending Applications")
            page.screenshot(path="/home/jules/verification/admin_approvals.png")

            # Click Shops
            print("Navigating to Shops...")
            # Use tab role to avoid ambiguity
            # Note: Lucide icons + text might make the accessible name just "Shops" or "Shops Shops" depending on implementation.
            # "Shops" resolved to role="tab" in the error message, so let's use that.
            page.get_by_role("tab", name="Shops").click()
            page.wait_for_selector("text=Managed Shops")
            page.screenshot(path="/home/jules/verification/admin_shops.png")

             # Click Menu
            print("Navigating to Menu...")
            page.get_by_text("Menu").click()
            page.wait_for_selector("text=Finance & Settlements")
            page.screenshot(path="/home/jules/verification/admin_menu.png")

            print("Verification successful!")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_tabs()
