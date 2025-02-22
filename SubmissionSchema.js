const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema({
    studentName: String,
    answers: [
        {
            question: String,
            answer: String,
            correct: String,
        },
    ],
    correctCount: Number,
    totalQuestions: Number,
});


module.exports = mongoose.model("Submission", SubmissionSchema);