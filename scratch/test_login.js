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
      console.log("Admin email:", admin.email);
      console.log("Admin password hash:", admin.password);
      const isMatch = await admin.matchPassword("123456");
      console.log("Does '123456' match?", isMatch);
    }
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("Error:", err);
  });
