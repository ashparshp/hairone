import json
from playwright.sync_api import Page, expect, sync_playwright

def test_home_ui_flow(page: Page):
    # Enable console logs
    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

    # Mock Login Response
    mock_user = {
        "id": "u1",
        "name": "Alex Smith",
        "email": "alex@test.com",
        "role": "user",
        "token": "fake-jwt-token"
    }

    # Mock Shops Response
    mock_shops = [
        {
            "_id": "s1",
            "name": "Luxe Barber & Co.",
            "rating": 4.8,
            "address": "12 Downtown Ave",
            "image": "https://via.placeholder.com/400",
            "type": "male",
            "nextAvailableSlot": "14:30",
            "coordinates": {"lat": 0, "lng": 0},
            "services": [{"name": "Haircut Premium"}, {"name": "Beard Trim"}]
        },
        {
            "_id": "s2",
            "name": "Serenity Spa",
            "rating": 4.9,
            "address": "45 Green Park Rd",
            "image": "https://via.placeholder.com/400",
            "type": "unisex",
            "nextAvailableSlot": "10:00", # String for display
            "coordinates": {"lat": 0, "lng": 0},
            "services": [{"name": "Massage"}, {"name": "Facial"}]
        }
    ]

    # Intercept /auth/otp
    page.route("**/auth/otp", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({"message": "OTP Sent"})
    ))

    # Intercept /auth/verify
    page.route("**/auth/verify", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({"token": "fake-jwt-token", "user": mock_user})
    ))

    # Intercept Shops
    page.route("**/shops*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps(mock_shops)
    ))

    # Go to app
    page.goto("http://localhost:8081", timeout=120000)

    try:
        # Step 1: Phone
        print("Checking for Login Screen...")
        phone_input = page.get_by_placeholder("9876543210")

        # Explicitly wait
        try:
            phone_input.wait_for(timeout=15000)
            print("Login screen found. Logging in...")
            phone_input.fill("9876543210")
            page.get_by_text("Send OTP").click()

            # Step 2: OTP
            print("Waiting for OTP input...")
            otp_input = page.get_by_placeholder("XXXX")
            otp_input.wait_for(timeout=10000)
            otp_input.fill("1234")
            page.get_by_text("Login").click()
        except Exception as inner_e:
             print(f"Login elements not found: {inner_e}")
             # Check if we are already home?
             if page.get_by_text("Hello, Alex").is_visible():
                 print("Already at Home!")
             else:
                 pass # Will fail in assertions

    except Exception as e:
        print(f"Login flow skipped or failed: {e}. Assuming already logged in or stuck.")

    # Wait for Home Screen elements
    print("Waiting for Home Screen...")

    # Check Greeting "Hello, Alex"
    expect(page.get_by_text("Hello, Alex")).to_be_visible(timeout=30000)

    # Check Categories (horizontal list)
    expect(page.get_by_text("Haircut").first).to_be_visible()

    # Check "Luxe Barber & Co."
    expect(page.get_by_text("Luxe Barber & Co.")).to_be_visible()

    # Check Tags
    expect(page.get_by_text("Barber", exact=True)).to_be_visible()
    expect(page.get_by_text("Beard").first).to_be_visible()

    # Check Bottom Nav (Grounded)
    # expect(page.get_by_text("Bookings")).to_be_visible()

    # Screenshot
    page.screenshot(path="/home/jules/verification/home_new_design.png")
    print("Screenshot captured!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_home_ui_flow(page)
        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="/home/jules/verification/error_state.png")
        finally:
            browser.close()
