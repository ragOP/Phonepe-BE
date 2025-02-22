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