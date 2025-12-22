from playwright.sync_api import sync_playwright, expect
import time

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Mock Data Injection
        token = "mock-token"
        user = {
            "_id": "user123",
            "name": "Shop Owner",
            "role": "owner",
            "myShopId": "shop123"
        }

        # Inject localStorage before navigation
        page.add_init_script(f"""
            localStorage.setItem('token', '{token}');
            localStorage.setItem('user', JSON.stringify({user}));
        """)

        try:
            # 1. Shop Finance Dashboard
            print("Navigating to Shop Finance...")
            page.goto("http://localhost:8081/salon/revenue-stats", wait_until="networkidle")

            # Wait for content to load properly
            time.sleep(5)

            # Take screenshot of Overview
            page.screenshot(path="verification/shop_finance_overview.png")
            print("Captured Shop Finance Overview")

            # Try to click tabs if visible
            try:
                page.get_by_text("Online (Payouts)").click()
                time.sleep(1)
                page.screenshot(path="verification/shop_finance_online.png")
                print("Captured Shop Finance Online Tab")
            except Exception as e:
                print(f"Could not click Online tab: {e}")

            try:
                page.get_by_text("Offline (Dues)").click()
                time.sleep(1)
                page.screenshot(path="verification/shop_finance_offline.png")
                print("Captured Shop Finance Offline Tab")
            except Exception as e:
                print(f"Could not click Offline tab: {e}")

            # 2. Admin Finance Dashboard
            print("Navigating to Admin Finance...")

            # Update user to admin
            admin_user = {
                "_id": "admin123",
                "name": "Admin User",
                "role": "admin"
            }
            page.add_init_script(f"""
                localStorage.setItem('user', JSON.stringify({admin_user}));
            """)
            page.goto("http://localhost:8081/admin/finance", wait_until="networkidle")

            time.sleep(5)
            page.screenshot(path="verification/admin_finance.png")
            print("Captured Admin Finance")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_frontend()
