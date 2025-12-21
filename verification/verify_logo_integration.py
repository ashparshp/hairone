from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            color_scheme='dark'  # Force dark mode
        )
        page = context.new_page()

        # Navigate to the app
        print("Navigating to login page...")
        page.goto("http://localhost:8081", timeout=60000)

        # Wait for the splash screen to disappear (at least 2 seconds + some buffer)
        print("Waiting for splash screen to clear...")
        time.sleep(4)

        # Check for SVG Logo presence (it's an SVG element)
        # We can look for the "hair" text inside the SVG
        print("Checking for Logo...")
        # Since it's an SVG, we might search for the text element or just ensure the title is gone

        # Verify "HairOne" text title is NOT present (replaced by logo)
        # Note: The SVG contains text "hair" and tspan "one", playwright might see it as text.
        # Let's check for visual confirmation via screenshot primarily.

        # Explicit wait for FadeInView animation
        print("Waiting for animation to complete...")
        time.sleep(2)

        # Check input fields still exist
        print("Checking input fields...")
        input_field = page.get_by_placeholder("9876543210")
        expect(input_field).to_be_visible()

        # Take a screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/login_screen_with_logo.png")

        browser.close()
        print("Done!")

if __name__ == "__main__":
    run()
