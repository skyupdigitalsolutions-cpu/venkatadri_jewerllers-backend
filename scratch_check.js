const mongoose = require("mongoose");
const User = require("./models/User");
const Payment = require("./models/Payment");
const Admin = require("./models/Admin");

async function check() {
  await mongoose.connect("mongodb://localhost:27017/microfinance");
  console.log("DB connected");

  const admins = await Admin.find();
  console.log("Admins count:", admins.length);
  admins.forEach(a => console.log(`Admin ID: ${a._id}, Name: ${a.name}, phone: ${a.phone}, email: ${a.email}`));

  const users = await User.find();
  console.log("Users count:", users.length);
  users.forEach(u => console.log(`User ID: ${u._id}, Name: ${u.name}, phone: ${u.phone}, adminId: ${u.adminId}`));

  const payments = await Payment.find();
  console.log("Payments count:", payments.length);
  payments.forEach(p => console.log(`Payment ID: ${p._id}, user ID: ${p.user}, status: ${p.status}, amount: ${p.amount}`));
  
  process.exit(0);
}
check();
