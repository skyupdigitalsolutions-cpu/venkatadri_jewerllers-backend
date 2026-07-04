require("dotenv").config();
const mongoose = require("mongoose");
const Admin    = require("./models/Admin");
const GoldRate = require("./models/GoldRate");

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Create admin
    const existing = await Admin.findOne({ email: "admin@skyupdigital.com" });
    if (!existing) {
      const admin = await Admin.create({
        name:     "Bhojraj",
        email:    "admin@skyupdigital.com",
        password: "admin123",
        phone:    "9999999999",
        shopName: "SkyUp Gold Jewellers",
        role:     "admin",
      });
      console.log("✅ Admin created");
      console.log("   Email:     admin@skyupdigital.com");
      console.log("   Password:  admin123");
      console.log(`   Shop Code: ${admin.shopCode}`);
      console.log(`   Shop Name: ${admin.shopName}`);
    } else {
      console.log(`ℹ️  Admin already exists — Shop Code: ${existing.shopCode}`);
    }

    // Set today's gold rate
    const today = new Date().toISOString().split("T")[0];
    await GoldRate.findOneAndUpdate(
      { date: today },
      { ratePerGram: 6850 },
      { upsert: true, new: true }
    );
    console.log(`✅ Gold rate set: ₹6850/g for ${today}`);
    console.log("\n🎉 Seed complete! Run: npm run dev");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
};

seed();