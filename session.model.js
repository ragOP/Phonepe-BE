const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  websiteId: String,
  sessionId: String,
  clientIp: String,
  startTime: Date,
  endTime: Date,
  sessionDuration: Number, // in seconds
  interactions: { type: Number, default: 0 }
});

const sessionModel = mongoose.model("Session", sessionSchema);
module.exports = sessionModel;
