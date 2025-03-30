const mongoose = require("mongoose");

const fcmTokenSchema = new mongoose.Schema(
  {
    token: String,
  },
  { timestamps: true }
);

const fcmTokenModel = mongoose.model("Fcm", fcmTokenSchema);
module.exports = fcmTokenModel;
