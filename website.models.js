const mongoose = require('mongoose');
const websiteVisitSchema = new mongoose.Schema({
    websiteId: {
        type: Number,
        required: true,
    },
    visited: {
        type: Number,
        default: 0,
    }
})

const websiteVisit = mongoose.model('websiteVisit', websiteVisitSchema);

module.exports = websiteVisit;