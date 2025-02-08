const mongoose = require("mongoose");

const buttonClickSchema = new mongoose.Schema(
  {
    websiteId: {
      type: String,
      required: true,
      unique: true,
    },
    buttons: [
      {
        buttonId: {
          type: Number,
          required: true,
          enum: [1, 2, 3, 4, 5],
        },
        clicked: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

const ButtonClick = mongoose.model("ButtonClick", buttonClickSchema);

module.exports = ButtonClick;
