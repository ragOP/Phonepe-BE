const mongoose = require('mongoose');
const buttonClickSchema = new mongoose.Schema({
    buttonId: {
        type: Number,
        required: true,
        unique: true
    },
    clicked: {
        type: Number,
        default: 0,
    },
})

const buttonClick = mongoose.model('buttonClick', buttonClickSchema);

module.exports = buttonClick;