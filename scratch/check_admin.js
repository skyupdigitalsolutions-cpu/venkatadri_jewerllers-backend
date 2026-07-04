const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/microfinance";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    const Admin = mongoose.model("Admin", new mongoose.Schema({}, { strict: false }));
    const admins = await Admin.find({});
    console.log("Admins count:", admins.length);
    admins.forEach((admin) => {
      console.log({
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        passwordExists: !!admin.password,
        role: admin.role,
        shopName: admin.shopName,
        shopCode: admin.shopCode
      });
    });
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("Error:", err);
  });
