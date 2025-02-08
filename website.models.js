const mongoose = require("mongoose");
const websiteVisitSchema = new mongoose.Schema({
  websiteId: {
    type: Number,
    required: true,
    unique: true,
  },
  websiteName: {
    type: String,
    required: false,
    unique: true,
  },
  visited: {
    type: Number,
    default: 0,
  },
  userIpAddress: {
    type: Array,
    default: [],
  },
});

const websiteVisit = mongoose.model("websiteVisit", websiteVisitSchema);

module.exports = websiteVisit;
