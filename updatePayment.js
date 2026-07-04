// ─────────────────────────────────────────────────────────────────────────
// Quick script to set your shop's payment details in MongoDB.
// Usage:   node updatePayment.js
// Location: put this file in your `backend/` folder (same level as server.js)
// ─────────────────────────────────────────────────────────────────────────
require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/Admin");

// ⚠ EDIT THESE VALUES — then run:  node updatePayment.js
const SHOP_DATA = {
  // Which admin to update — match by email (most reliable)
  matchEmail: "virat@gmail.com",   // ← REPLACE with the email you registered

  // Payment details to set
  name: "Virat",       // Owner's personal name
  phone: "8722992405",                    // Phone shown in copy pill
  bankName: "Axis Bank - 7317",              // Text on top of QR card
  upiPayeeName: "VIRAT",        // "Paying To" pill
  qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=test@okaxis&pn=VIRAT",
  upiId: "virat@okaxis",               // Optional UPI ID
};

async function run() {
  try {
    // Connect using the same MONGO_URI your server uses
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Show all admins so you can find yours if the email is wrong
    const all = await Admin.find({}, { email: 1, name: 1, shopName: 1 });
    console.log("\n📋 All admins in database:");
    all.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.email}  |  ${a.name}  |  ${a.shopName || "(no shop name)"}`);
    });
    console.log("");

    // Do the update
    const result = await Admin.updateOne(
      { email: SHOP_DATA.matchEmail.toLowerCase() },
      {
        $set: {
          name: SHOP_DATA.name,
          phone: SHOP_DATA.phone,
          bankName: SHOP_DATA.bankName,
          upiPayeeName: SHOP_DATA.upiPayeeName,
          qrCodeUrl: SHOP_DATA.qrCodeUrl,
          upiId: SHOP_DATA.upiId,
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log(`❌ No admin found with email: ${SHOP_DATA.matchEmail}`);
      console.log("   Pick the correct email from the list above, edit matchEmail in this file, and run again.");
    } else {
      console.log(`✅ Updated ${result.modifiedCount} admin:`);
      console.log(`   Email:        ${SHOP_DATA.matchEmail}`);
      console.log(`   Owner:        ${SHOP_DATA.name}`);
      console.log(`   Phone:        ${SHOP_DATA.phone}`);
      console.log(`   Bank:         ${SHOP_DATA.bankName}`);
      console.log(`   UPI Payee:    ${SHOP_DATA.upiPayeeName}`);
      console.log(`   QR:           ${SHOP_DATA.qrCodeUrl}`);
      console.log("\n🎉 Refresh your browser and click Pay Now!");
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();