const mongoose = require("mongoose");

const formSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    state: { type: String, required: true },
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt fields
);

module.exports = mongoose.model("FormData", formSchema);
