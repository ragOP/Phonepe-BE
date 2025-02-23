const QuestionSchema = new mongoose.Schema({
    question: String,
    options: [String],
    correct: String,
});

const Question = mongoose.model("Question", QuestionSchema);