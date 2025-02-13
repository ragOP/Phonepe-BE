const mongoose = require("mongoose");

const testVisitSchema = new mongoose.Schema({
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
  ipAddresses: [
    {
      type: String,
      unique: true, // Ensures no duplicate IPs in this array
    },
  ],
  visits: [
    {
      visitedAt: {
        type: Date,
        default: Date.now, // Automatically stores visit timestamp
      },
    },
  ],
});

const TestVisitSchema = mongoose.model("WebsiteVisit", testVisitSchema);

module.exports = TestVisitSchema;
