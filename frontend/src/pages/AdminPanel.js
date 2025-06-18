// frontend/src/pages/AdminPanel.js
import React, { useEffect, useState } from 'react';
// ... diğer importlar

function AdminPanel() {
  // ... state tanımları

  // handleAdminUpdate ve diğer fonksiyonlardan sonra ekleyin:
  // Admin quiz düzenleme modalı içindeki soru metni güncelleme
  const handleEditQuestionTextChange = (idx, value) => {
    const updated = [...editQuestions];
    updated[idx].question_text = value;
    setEditQuestions(updated);
  };

  // Admin quiz düzenleme modalı içindeki seçenek metni güncelleme (eğer gerekiyorsa)
  const handleEditOptionTextChange = (qIndex, optIndex, value) => {
    const updated = [...editQuestions];
    updated[qIndex].options[optIndex].option_text = value;
    setEditQuestions(updated);
  };

  // Admin quiz düzenleme modalı içindeki doğru cevap seçeneği güncelleme (eğer gerekiyorsa)
  const handleEditCorrectChange = (qIndex, optionId) => {
    const updated = [...editQuestions];
    updated[qIndex].correct_answer_option_id = optionId;
    setEditQuestions(updated);
  };

  // ... diğer fonksiyonlar ve return JSX
}

export default AdminPanel;
