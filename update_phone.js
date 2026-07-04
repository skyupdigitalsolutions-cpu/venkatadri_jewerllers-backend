const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/User");

async function updatePhone() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/microfinance");
  console.log("DB connected");

  // Find user named 'ABD'
  const abd = await User.findOne({ name: "ABD" });
  if (abd) {
    console.log("Found user ABD:", abd.toObject());
    abd.phone = "9591327778";
    await abd.save();
    console.log("Successfully updated ABD's phone to:", abd.phone);
    
    // Double check from database directly
    const verifyUser = await User.findOne({ name: "ABD" });
    console.log("VERIFICATION - ABD's phone in DB is now:", verifyUser.phone);
  } else {
    console.log("User ABD not found.");
  }

  process.exit(0);
}
updatePhone();
