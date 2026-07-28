// Script to create an admin user with a specific phone number
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hairone";

async function createAdmin(phone) {
  await mongoose.connect(MONGO_URI);
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({ phone, role: "admin" });
    console.log("Admin user created:", user);
  } else {
    user.role = "admin";
    await user.save();
    console.log("User updated to admin:", user);
  }
  await mongoose.disconnect();
}

createAdmin("8887666687").catch((err) => {
  console.error("Error creating admin:", err);
  process.exit(1);
});
