from playwright.sync_api import sync_playwright, expect

def verify_access_control():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()

        try:
            print("1. Login as Regular User...")
            page.goto("http://localhost:8081/(auth)/login")
            page.wait_for_selector('text=Mobile Number', timeout=30000)

            # Mock Regular User Login
            api_url = "https://oyster-app-dly8k.ondigitalocean.app/api"
            page.route(f"{api_url}/auth/otp", lambda route: route.fulfill(status=200, body='{"message": "OTP Sent"}'))
            page.route(f"{api_url}/auth/verify", lambda route: route.fulfill(
                status=200,
                body='{"token": "user-token", "user": {"role": "user", "name": "Regular User", "phone": "1111111111"}}'
            ))

            # Perform Login
            page.get_by_placeholder("9876543210").fill("1111111111")
            page.get_by_text("Continue").click()
            page.wait_for_selector("text=Edit", timeout=10000)
            page.locator("input").last.fill("1234")

            # Should redirect to /(tabs)/home
            print("Waiting for User Home...")
            # We need to know what's on the user home. Usually "Categories" or "Barbers".
            # Let's wait for URL to change or some user element.
            # Assuming /(tabs)/home is the target.
            page.wait_for_url("**/home", timeout=10000)
            # Or just wait a bit if URL matching is tricky with Expo Router web
            time.sleep(2)

            print("2. Attempting to force-navigate to Admin Panel...")
            page.goto("http://localhost:8081/admin/(tabs)/shops")

            # Check if we are blocked or if we see "Managed Shops"
            try:
                # If we see "Managed Shops", SECURITY FAIL
                page.wait_for_selector("text=Managed Shops", timeout=5000)
                print("SECURITY FAIL: User accessed Admin Shops!")
            except:
                print("SECURITY PASS: Admin content not immediately visible (or timed out waiting for it).")
                # Check where we are
                print(f"Current URL: {page.url}")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    import time
    verify_access_control()
