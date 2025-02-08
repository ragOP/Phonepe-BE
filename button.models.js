const mongoose = require("mongoose");

const buttonClickSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "websiteVisit",
      required: true,
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

buttonClickSchema.index({ websiteId: 1 }, { unique: true });

const ButtonClick = mongoose.model("ButtonClick", buttonClickSchema);

module.exports = ButtonClick;
