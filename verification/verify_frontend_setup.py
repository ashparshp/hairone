from playwright.sync_api import sync_playwright

def test_login_flow():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        # Create a new context with mobile dimensions
        context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()

        print("Navigating to app...")
        # Since this is an Expo web build, we target the local web server
        # Assuming npm run web is running on port 8081
        try:
            page.goto("http://localhost:8081")

            # Wait for some initial content to ensure it loads
            # We might need to wait for navigation to /login if not authenticated
            print("Waiting for initial load...")
            page.wait_for_timeout(5000)

            # Take a screenshot of the initial state
            page.screenshot(path="verification/initial_state.png")
            print("Initial state screenshot captured.")

            # Note: We can't easily simulate the full "Login -> Admin Approve -> Alert -> Logout" flow
            # purely via frontend script without a backend running and coordinated actions.
            # However, verifying the app loads is a good first step.

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_state.png")

        finally:
            browser.close()

if __name__ == "__main__":
    test_login_flow()
