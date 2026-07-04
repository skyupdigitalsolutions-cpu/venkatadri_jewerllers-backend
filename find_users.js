const mongoose = require("mongoose");
require("dotenv").config();

async function findUsers() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/microfinance");
  console.log("DB connected");

  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  const users = await User.find();
  console.log("TOTAL USERS IN DB:", users.length);
  users.forEach(u => {
    console.log(`User - ID: ${u._id}, Name: ${u.name}, Phone: ${u.phone}`);
  });

  const Payment = mongoose.model("Payment", new mongoose.Schema({}, { strict: false }));
  const payments = await Payment.find().populate("user");
  console.log("TOTAL PAYMENTS IN DB:", payments.length);
  payments.forEach(p => {
    console.log(`Payment - ID: ${p._id}, User: ${p.user ? p.user.name : "N/A"}, Phone in Payment: ${p.phone || "N/A"}`);
  });

  process.exit(0);
}
findUsers();
