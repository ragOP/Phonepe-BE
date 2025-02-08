const mongoose = require('mongoose');
const websiteVisitSchema = new mongoose.Schema({
    websiteId: {
        type: Number,
        required: true,
        unique: true
    },
    websiteName: {
        type: String,
        required: true,
        unique: true
    },
    visited: {
        type: Number,
        default: 0,
    }
})

const websiteVisit = mongoose.model('websiteVisit', websiteVisitSchema);

module.exports = websiteVisit;