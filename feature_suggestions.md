# Feature Suggestions for HairOne

Based on an analysis of the codebase, the following features would add significant value to the HairOne platform.

## 1. Product Inventory & Retail Sales
**Goal:** Allow shops to sell physical products (shampoo, gel, beard oil, etc.) alongside their service bookings.
**Current State:** Shops only have `services` and `combos`.
**Implementation Details:**
*   **Database Schema:**
    *   Create a new `Product` model containing:
        *   `shopId`: Reference to Shop.
        *   `name`: String (e.g., "L'Oreal Shampoo").
        *   `brand`: String.
        *   `price`: Number.
        *   `stock`: Number (Inventory tracking).
        *   `image`: String (URL).
        *   `isAvailable`: Boolean.
*   **Backend:**
    *   `POST /shops/:shopId/products` (Create)
    *   `GET /shops/:shopId/products` (List)
    *   `PUT /shops/:shopId/products/:productId` (Update Stock/Price)
*   **Frontend (Owner):**
    *   New screen `app/salon/manage-inventory.tsx` linked from Dashboard.
    *   Simple form to add products and a list to toggle availability.
*   **Frontend (User):**
    *   In the Booking Wizard (`app/salon/[id].tsx`), add a step "Add Products" after selecting services.
    *   Update `Booking` model to include an `products` array (`[{ productId, quantity, price }]`).

## 2. Shop Gallery / Portfolio
**Goal:** Allow shop owners to showcase their best work to attract customers.
**Current State:** The `Shop` model only has a single `image` field.
**Implementation Details:**
*   **Database Schema:**
    *   Update `Shop` model to include `gallery: [String]`.
*   **Backend:**
    *   Endpoint to upload multiple images via `multer`.
*   **Frontend (Owner):**
    *   New screen `app/salon/manage-gallery.tsx` allowing grid view of images and upload button.
*   **Frontend (User):**
    *   On `ShopDetailsScreen`, add a "Portfolio" tab next to "Services" and "Combos".
    *   Use a masonry or grid layout to display images.

## 3. Loyalty & Rewards Program
**Goal:** Incentivize repeat customers and increase retention.
**Implementation Details:**
*   **Database Schema:**
    *   Update `User` model: `loyaltyPoints: { shopId: Number }` (Map of shop ID to points).
    *   Update `Shop` model: `loyaltySettings: { pointsPerVisit: Number, redemptionRate: Number }`.
*   **Logic:**
    *   When a booking is marked `completed`, automatically increment user's points for that shop.
*   **Frontend:**
    *   **User:** Display "My Points: 150" on the Shop Details header.
    *   **Checkout:** Add a toggle "Redeem 100 points for ₹50 off" (if balance suffices).

## 4. Waitlist System
**Goal:** Capture demand for fully booked days and fill cancellations automatically.
**Implementation Details:**
*   **Database Schema:**
    *   New `Waitlist` model:
        *   `shopId`: Reference.
        *   `date`: Date.
        *   `userId`: Reference.
        *   `status`: 'pending' | 'notified' | 'expired'.
*   **Logic:**
    *   When a user cancels a booking, find `Waitlist` entries for that date/shop.
    *   Send a notification (Email/SMS/Push) to the first user in the queue.
*   **Frontend:**
    *   If `getShopSlots` returns no slots, show a "Join Waitlist" button.

## 5. Enhanced Staff Management
**Goal:** Allow larger salons to manage permissions for multiple staff members.
**Current State:** `Barber` model exists but is tied to the main shop account.
**Implementation Details:**
*   **Permissions:** Allow the Shop Owner to invite other users (via email) to become "Barbers".
*   **Role:** New `User.role` type `'staff'`.
*   **Access:** Staff users can only see *their* schedule and bookings, not the full financial stats of the shop.
