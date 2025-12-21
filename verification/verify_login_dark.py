from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            color_scheme='dark'  # Force dark mode to verify the dark theme
        )
        page = context.new_page()

        # Navigate to the app (Expo web usually serves on 8081)
        # We need to wait a bit for the metro bundler to be ready
        print("Navigating to login page...")
        page.goto("http://localhost:8081", timeout=60000)

        # Wait for the title "HairOne" to appear
        print("Waiting for HairOne title...")
        title = page.get_by_text("HairOne")
        title.wait_for(state="visible", timeout=60000)

        # Verify title color (should be gold/tint)
        # We can't easily verify computed styles in python playwright without eval,
        # but taking a screenshot will be the proof.

        # Check input fields
        print("Checking input fields...")
        input_field = page.get_by_placeholder("9876543210")
        expect(input_field).to_be_visible()

        # Take a screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/login_screen_dark.png")

        browser.close()
        print("Done!")

if __name__ == "__main__":
    run()
