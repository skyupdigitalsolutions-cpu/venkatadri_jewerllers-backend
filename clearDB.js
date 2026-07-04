require("dotenv").config();
const mongoose = require("mongoose");

const clear = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    const cols = ["admins","users","schemes","payments","reminders","goldrates"];
    for (const col of cols) {
      try {
        const r = await mongoose.connection.collection(col).deleteMany({});
        console.log(`✓ ${col}: ${r.deletedCount} deleted`);
      } catch { console.log(`- ${col}: skipped`); }
    }
    console.log("\n🎉 Done! Now run: node seed.js");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};
clear();