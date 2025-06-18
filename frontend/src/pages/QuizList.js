// frontend/src/pages/QuizList.js
import React, { useEffect, useState } from 'react';
// ... diğer importlar

function QuizList() {
  // ... state tanımları

  // handleUpdate ve diğer fonksiyonlardan sonra ekleyin:
  // Quiz düzenleme modalı içindeki soru metni güncelleme
  const handleEditQuestionTextChange = (qIndex, value) => {
    const updated = [...editQuestions];
    updated[qIndex].question_text = value;
    setEditQuestions(updated);
  };
  
  // Quiz düzenleme modalı içindeki seçenek metni güncelleme
  const handleEditOptionTextChange = (qIndex, optIndex, value) => {
    const updated = [...editQuestions];
    updated[qIndex].options[optIndex].option_text = value;
    setEditQuestions(updated);
  };

  // Quiz düzenleme modalı içindeki doğru cevap seçeneği güncelleme
  const handleEditCorrectChange = (qIndex, optionTempId) => {
    const updated = [...editQuestions];
    updated[qIndex].correct_answer_option_temp_id = optionTempId;
    setEditQuestions(updated);
  };

  // ... diğer fonksiyonlar ve return JSX
}

export default QuizList;
