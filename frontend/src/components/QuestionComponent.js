// src/components/QuestionComponent.js
import React, { useState, useEffect } from 'react';

const QuestionComponent = ({ question, onAnswerSubmit, timeLimit = 20 }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = () => {
    if (selectedOption !== null) {
      onAnswerSubmit(selectedOption);
    }
  };

  return (
    <div className="question-card">
      <div className="timer-bar" style={{ width: `${(timeLeft/timeLimit)*100}%` }}></div>
      <h3>{question.text}</h3>
      <div className="options-grid">
        {question.options.map((option, idx) => (
          <button 
            key={idx} 
            className={`option-btn ${selectedOption === idx ? 'selected' : ''}`}
            onClick={() => setSelectedOption(idx)}
          >
            {option}
          </button>
        ))}
      </div>
      <button 
        onClick={handleSubmit} 
        disabled={selectedOption === null || timeLeft === 0}
        className="submit-btn"
      >
        {timeLeft > 0 ? 'Cevapla' : 'Süre Bitti!'}
      </button>
    </div>
  );
};
export default QuestionComponent; 
