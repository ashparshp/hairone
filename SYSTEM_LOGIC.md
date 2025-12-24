# System Logic & Architecture Documentation

This document explains the core logic, financial flows, and architecture of the application. It is designed to help developers understand "how it works" under the hood.

---

## 1. Financial Architecture (Payments & Settlements)

The application uses a **Split-Revenue Model**. Every booking generates revenue, which is split between the **Shop (Barber)** and the **Platform (Admin)** based on a commission rate.

### A. The Core Concepts

| Concept | Description |
| :--- | :--- |
| **Total Price** | The final price the customer sees (Original Price - Discount). |
| **Commission** | The % the Admin takes from the service (e.g., 10%). |
| **Discount** | Subsidized by the *Admin* in this logic (it reduces the Total Price, but Admin Commission is calculated on the Original Price, meaning the Admin absorbs the discount hit). |
| **Admin Net Revenue** | `Commission - Discount`. This is the Admin's profit. |
| **Barber Net Revenue** | `Original Price - Commission`. This is the Shop's profit. |

### B. Who Holds the Money? (Collection Logic)

Since users can pay via **Cash** (at the shop) or **Online** (UPI/Card), the money sits in different pockets.

1.  **CASH Payment:**
    *   **Collector:** The Shop/Barber collects the full amount.
    *   **Debt:** The Shop now owes the Admin the **Commission**.
    *   **Status:** `amountCollectedBy: 'BARBER'`

2.  **ONLINE Payment:**
    *   **Collector:** The Admin (Platform) collects the full amount via Payment Gateway.
    *   **Debt:** The Admin now owes the Shop the **Barber Net Revenue**.
    *   **Status:** `amountCollectedBy: 'ADMIN'`

### C. The Settlement Process (Reconciliation)

Because of the two flows above, we need to balance the books. This is done via **Settlements**.

*   **Net Balance:** For a given period, we calculate: `(What Admin Owes Shop) - (What Shop Owes Admin)`.
*   **Result:**
    *   **Positive (+):** Admin must pay the Shop (**PAYOUT**).
    *   **Negative (-):** Shop must pay the Admin (**COLLECTION**).

---

## 2. Automated Settlement Job (Cron)

**File:** `server/src/jobs/settlementJob.js`

To avoid manual calculations, a background job runs automatically every night.

### How it works:
1.  **Schedule:** Runs daily at Midnight (00:00).
2.  **Cutoff:** It looks for bookings that were "Completed" *before* the start of the current week (Monday). This ensures we don't settle bookings that might still be disputed.
3.  **Aggregation:** It uses MongoDB Aggregation to efficiently group thousands of bookings by `shopId`.
4.  **Creation:**
    *   It sums up the debits and credits.
    *   It creates a single `Settlement` record for the shop.
    *   It marks all included bookings as `settlementStatus: 'SETTLED'`.

---

## 3. Booking Logic (The Engine)

**File:** `server/src/controllers/bookingController.js`

The `createBooking` function is the most complex part of the system. It handles:

1.  **Availability Checks:**
    *   Checks if the Barber is working that day (`weeklySchedule`).
    *   Checks for special holidays (`specialHours`).
    *   Checks for conflicts with existing bookings.
    *   **Crucial:** Checks for "Overnight Spillovers" (e.g., a shift from 10 PM to 2 AM). It checks if a slot at 1 AM belongs to the *previous* day's shift.

2.  **Financial Snapshot:**
    *   The system calculates `adminCommission`, `adminNetRevenue`, and `barberNetRevenue` **at the moment of creation**.
    *   These values are saved to the database. This is critical: if you change the commission rate tomorrow, old bookings remain unchanged.

3.  **Check-In Flow:**
    *   Every booking has a unique 4-digit `bookingKey` (PIN).
    *   When a customer arrives, the Shop Owner enters this PIN.
    *   This transitions the status to `checked-in`, preventing future disputes about "No-Shows".

---

## 4. Admin Panel Architecture

**File:** `server/src/controllers/adminController.js`

The Admin Dashboard is the central control unit. It is protected by `role: 'admin'`.

### Key Features:
1.  **Shop Approval Workflow:**
    *   New users apply as "Partners". Their status starts as `pending`.
    *   Admin reviews the application.
    *   **Approval:** User role becomes `owner`, Shop is enabled (`isDisabled: false`).
    *   **Rejection:** Status becomes `rejected`.

2.  **Suspension System:**
    *   If a shop violates rules, the Admin can **Suspend** it.
    *   This action:
        *   Disables the Shop visibility.
        *   Sets the Owner status to `suspended`.
        *   **Automatically Cancels** all upcoming bookings to prevent user frustration.

3.  **Global Configuration:**
    *   Admins control the `SystemConfig` singleton.
    *   This sets the global `adminCommissionRate` and `userDiscountRate`. Changes here affect *future* bookings only.

---

## 5. Shop Ecosystem & Management

**File:** `server/src/controllers/shopController.js`

This controller manages the physical entities (Shops) and their services.

### Key Logic:
1.  **Geospatial Search:**
    *   The `getAllShops` endpoint uses the Haversine formula to calculate the distance between the User's coordinates and every Shop.
    *   It sorts the results by nearest distance.

2.  **Slot Generation (`getShopSlots`):**
    *   This is a read-heavy operation. It takes a Date and calculates every available 15-minute slot.
    *   It accounts for:
        *   **Buffer Time:** (e.g., 5 mins cleanup between cuts).
        *   **Notice Period:** (e.g., cannot book within 30 mins).
        *   **Overnight Shifts:** Handles 24-hour shops or late-night barbers correctly.

3.  **Image Management:**
    *   Shop images are uploaded via `multer-s3` directly to DigitalOcean Spaces.
    *   The database stores the public URL string.

---

## 6. Key Controllers Reference

| Controller | File | Purpose |
| :--- | :--- | :--- |
| **Booking** | `bookingController.js` | Creating bookings, availability, financials, status updates (PIN check). |
| **Finance** | `financeController.js` | Earnings reports, settlement history, manual settlement creation. |
| **Settlement Job** | `settlementJob.js` | The nightly background worker. |
| **Shop** | `shopController.js` | Shop creation, geo-search, slot generation, service management. |
| **Admin** | `adminController.js` | Approvals, suspensions, system stats, global config. |

---

## 7. Payment Gateway Integration

Currently, the payment logic works as follows:
*   **Frontend:** The React Native app handles the UI for payments (PhonePe/UPI).
*   **Backend:** The backend simply records the `paymentMethod` ('UPI', 'CASH').
    *   It uses this tag to decide `amountCollectedBy` ('ADMIN' or 'BARBER').
    *   There is currently no direct server-side checksum generation or webhook handling active in the main controllers; the logic trusts the `createBooking` payload regarding the method used.

---
