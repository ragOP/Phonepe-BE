const mongoose = require('mongoose');
const paymentSchmea = new mongoose.Schema({
    transcationId: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    }, 
    phoneNumber: {
        type: String,
        required: true
    }
})

const payment = mongoose.model('Payment', paymentSchmea);

module.exports = payment;