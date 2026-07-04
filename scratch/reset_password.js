const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const Admin = require("../models/Admin");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/microfinance";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    const admin = await Admin.findOne({ email: "virat@gmail.com" });
    if (!admin) {
      console.log("Admin virat@gmail.com not found!");
    } else {
      admin.password = "123456";
      await admin.save();
      console.log("Password reset successfully for virat@gmail.com to 123456!");
    }
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("Error:", err);
  });
