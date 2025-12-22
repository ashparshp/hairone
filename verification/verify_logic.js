// Verification Script for Finance Logic

const runTest = (price, discountRate, commissionRate) => {
    console.log(`--- TEST: Price ${price}, Disc ${discountRate}%, Comm ${commissionRate}% ---`);

    const originalPrice = price;
    const discountAmount = originalPrice * (discountRate / 100);
    const finalPrice = originalPrice - discountAmount;

    const adminCommission = originalPrice * (commissionRate / 100);

    // Logic as implemented
    const adminNetRevenue = adminCommission - discountAmount;
    const barberNetRevenue = originalPrice - adminCommission;

    console.log(`Original: ${originalPrice}`);
    console.log(`Discount: ${discountAmount}`);
    console.log(`Final (User Pays): ${finalPrice}`);
    console.log(`Comm (Gross): ${adminCommission}`);
    console.log(`Admin Net (Comm - Disc): ${adminNetRevenue}`);
    console.log(`Barber Net (Orig - Comm): ${barberNetRevenue}`);

    // Scenario 1: Offline (Shop Collects)
    console.log(`\n[SCENARIO: OFFLINE / CASH]`);
    console.log(`Shop collected: ${finalPrice}`);
    console.log(`Shop owes Admin (Admin Net): ${adminNetRevenue}`);
    console.log(`Shop keeps: ${finalPrice} - ${adminNetRevenue} = ${finalPrice - adminNetRevenue}`);
    console.log(`Check: Does Shop keep match Barber Net? ${Math.abs((finalPrice - adminNetRevenue) - barberNetRevenue) < 0.01 ? 'YES' : 'NO'}`);

    // Scenario 2: Online (Admin Collects)
    console.log(`\n[SCENARIO: ONLINE]`);
    console.log(`Admin collected: ${finalPrice}`);
    console.log(`Admin owes Shop (Barber Net): ${barberNetRevenue}`);
    console.log(`Admin keeps: ${finalPrice} - ${barberNetRevenue} = ${finalPrice - barberNetRevenue}`);
    console.log(`Check: Does Admin keep match Admin Net? ${Math.abs((finalPrice - barberNetRevenue) - adminNetRevenue) < 0.01 ? 'YES' : 'NO'}`);
}

// User's Case
runTest(100, 5, 10);

// Edge Case: High Discount (Loss for Admin)
runTest(100, 15, 10);
