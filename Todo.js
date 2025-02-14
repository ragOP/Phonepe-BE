const mongoose = require('mongoose');

// Define the schema for the Todo item
const todoSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the Todo model from the schema
const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;
