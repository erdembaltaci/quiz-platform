import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuizCard from '../components/QuizCard'; 
import '../styles/dashboardStyles.css';
import { useAuth } from '../context/AuthContext';
import {
  getQuizzes as apiGetQuizzes,
  deleteQuiz as apiDeleteQuiz,
  updateQuiz as apiUpdateQuiz,
  startQuizLive as apiStartQuizLive,
  startAdminQuizLive,
  endAdminQuizLive,
  deleteAdminQuiz,
  updateAdminQuiz
} from '../services/api';

// MUI Icons - Kullanılmayanları kaldırabiliriz
import QuizIcon from '@mui/icons-material/Quiz';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

let nextEditOptionTempId = 1;
let nextEditQuestionTempId = 1;

function QuizList() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [editQuiz, setEditQuiz] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuestions, setEditQuestions] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [liveRoomCodes, setLiveRoomCodes] = useState({});
  
  const navigate = useNavigate(); // Bu kullanılıyor, uyarı kalkar

  const isTeacherOrAdmin = user && (user.role === 'teacher' || user.role === 'admin');
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const quizRes = await apiGetQuizzes(); 
        
        setQuizzes(quizRes.data.map(q => ({ 
            ...q, 
            id: q.id,
            is_active: q.is_active,
            session_code: q.session_code,
            questions: JSON.parse(q.questions || '[]')
        })));

      } catch (error) {
        console.error('QuizList: Quiz verileri çekme hatası:', error.response?.data?.message || error.message);
        setQuizzes([]);
      }
    };
    fetchQuizzes();
  }, [user]);


  const handleDelete = async (id) => {
    if (window.confirm('Bu quiz silinsin mi?')) {
      try {
        await apiDeleteQuiz(id);
        setQuizzes(quizzes.filter(q => q.id !== id));
        alert('Quiz başarıyla silindi!');
      } catch (error) {
        console.error('Quiz silme hatası:', error.response?.data?.message || error.message);
        alert('Quiz silinemedi: ' + (error.response?.data?.message || 'Sadece kendi oluşturduğunuz quizleri silebilirsiniz.'));
      }
    }
  };

  const handleEdit = (quiz) => {
    setEditQuiz(quiz);
    setEditTitle(quiz.title);
    setEditDescription(quiz.description);
    nextEditQuestionTempId = 1;
    nextEditOptionTempId = 1;
    const questionsWithTempIds = (quiz.questions || []).map(q => ({
      ...q,
      tempId: nextEditQuestionTempId++,
      options: (q.options || []).map(opt => ({
        ...opt,
        tempId: nextEditOptionTempId++
      })),
      correct_answer_option_temp_id: q.correct_answer_option_id
    }));
    setEditQuestions(JSON.parse(JSON.stringify(questionsWithTempIds)));
    setShowEdit(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editQuiz) return;
    
    if (!editTitle.trim() || !editDescription.trim()) {
      alert('Başlık ve açıklama boş bırakılamaz.');
      return;
    }
    for (const q of editQuestions) {
      if (!q.question_text.trim() || q.options.some(opt => !opt.option_text.trim()) || !q.correct_answer_option_temp_id) {
        alert('Tüm soruların metinleri, seçenekleri ve doğru cevapları doldurulmalıdır.');
        return;
      }
    }

    try {
      const updatedQuizData = {
        title: editTitle,
        description: editDescription,
        questions: JSON.stringify(editQuestions.map(q => {
          const correctAnswerOption = q.options.find(opt => opt.tempId === q.correct_answer_option_temp_id);
          return {
            question_text: q.question_text,
            question_type: q.question_type,
            correct_answer_option_text: correctAnswerOption ? correctAnswerOption.option_text : null,
            options: q.options.map(opt => ({
              option_letter: opt.option_letter,
              option_text: opt.option_text
            }))
          };
        }))
      };

      const res = await apiUpdateQuiz(editQuiz.id, updatedQuizData);
      
      setQuizzes(quizzes.map(q => (q.id === editQuiz.id ? { ...res.data, questions: JSON.parse(res.data.questions || '[]') } : q)));
      setShowEdit(false);
      setEditQuiz(null);
      alert('Quiz başarıyla güncellendi!');
    } catch (error) {
      console.error('Quiz güncelleme hatası:', error.response?.data?.message || error.message);
      alert('Quiz güncellenemedi: ' + (error.response?.data?.message || 'Sadece kendi oluşturduğunuz quizleri güncelleyebilirsiniz.');
    }
  };

  const handleEditQuestionTextChange = (qIndex, value) => {
    const updated = [...editQuestions];
    updated[qIndex].question_text = value;
    setEditQuestions(updated);
  };
  const handleEditOptionTextChange = (qIndex, optIndex, value) => {
    const updated = [...editQuestions];
    updated[qIndex].options[optIndex].option_text = value;
    setEditQuestions(updated);
  };
  const handleEditCorrectChange = (qIndex, optionTempId) => {
    const updated = [...editQuestions];
    updated[qIndex].correct_answer_option_temp_id = optionTempId;
    setEditQuestions(updated);
  };

  const addEditQuestion = () => {
    const newOptions = [
      { tempId: nextEditOptionTempId++, option_letter: 'A', option_text: '' },
      { tempId: nextEditOptionTempId++, option_letter: 'B', option_text: '' },
      { tempId: nextEditOptionTempId++, option_letter: 'C', option_text: '' },
      { tempId: nextEditOptionTempId++, option_letter: 'D', option_text: '' }
    ];
    setEditQuestions([...editQuestions, { 
      tempId: nextEditQuestionTempId++, 
      question_text: '', 
      question_type: 'multiple_choice', 
      options: newOptions, 
      correct_answer_option_temp_id: null 
    }]);
  };
  const removeEditQuestion = (index) => {
    const updated = editQuestions.filter((_, i) => i !== index);
    setEditQuestions(updated);
  };


  const handleStart = async (quizId) => {
    try {
      const res = await apiStartQuizLive(quizId);
      const roomCode = res.data.roomCode;
      alert(`Canlı Quiz Başlatıldı! Oda Kodu: ${roomCode}`);
      navigate('/lobby', { state: { roomCode: roomCode, isHost: true } });
    } catch (error) {
      console.error('Quiz başlatılamadı:', error.response?.data?.message || error.message);
      alert('Quiz başlatılamadı: ' + (error.response?.data?.message || 'Bir hata oluştu.'));
    }
  };

  const handleAdminStartLive = async (quizId) => {
    try {
      const res = await startAdminQuizLive(quizId);
      const roomCode = res.data.roomCode;
      setLiveRoomCodes(prev => ({ ...prev, [quizId]: roomCode }));
      setQuizzes(quizzes => quizzes.map(q => q.id === quizId ? { ...q, is_active: true, session_code: roomCode } : q));
      alert(`Admin: Quiz canlı yayına başladı! Oda Kodu: ${roomCode}`);
    } catch (error) {
      console.error('Admin Quiz başlatılamadı:', error.response?.data?.message || error.message);
      alert('Admin: Quiz başlatılamadı: ' + (error.response?.data?.message || 'Bir hata oluştu.'));
    }
  };

  const handleAdminEndLiveQuiz = async (quizId) => {
    try {
      await endAdminQuizLive(quizId);
      setLiveRoomCodes(prev => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });
      setQuizzes(quizzes => quizzes.map(q => q.id === quizId ? { ...q, is_active: false, session_code: undefined } : q));
      alert('Admin: Oturum başarıyla sonlandırıldı.');
    } catch (error) {
      console.error('Admin Oturumu sonlandırılamadı:', error.response?.data?.message || error.message);
      alert('Admin: Oturum sonlandırılamadı: ' + (error.response?.data?.message || 'Bir hata oluştu.'));
    }
  };


  return (
    <div style={{
      background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)',
      minHeight: '100vh',
      padding: '32px 0',
    }}>
      <div style={{ maxWidth: 700, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #0001', padding: 32 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', color: '#3b3b5c', fontWeight: 700, fontSize: 28, marginBottom: 24 }}>
          <QuizIcon style={{ marginRight: 10, color: '#6a11cb' }} /> Quizler
        </h2>
        
        {quizzes.length === 0 && <p style={{ textAlign: 'center', color: '#666' }}>Henüz gösterilecek bir quiz yok. Yeni bir quiz oluşturmak için "Quiz Oluştur" bağlantısını kullanın.</p>}
        {quizzes.map(quiz => (
          <div className="quiz-card" key={quiz.id} style={{ background: '#f7f8fa', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: 20, marginBottom: 18 }}>
            <h3 style={{ marginBottom: 8, color: '#2575fc' }}>{quiz.title}</h3>
            <div style={{ color: '#888', marginBottom: 8 }}>{quiz.description}</div>
            <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>Oluşturan: {quiz.created_by_username || quiz.created_by_email || 'Bilinmiyor'}</div>
            
            <button onClick={() => navigate(`/play-quiz/${quiz.id}`)} style={{ background: '#2575fc', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', marginRight: 8 }}>
              Quiz Oyna
            </button>
            
            {isTeacherOrAdmin && quiz.host_user_id === user?.id && (
              <>
                <button style={{ background: '#6a11cb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, marginLeft: 8, cursor: 'pointer' }} onClick={() => handleEdit(quiz)}>Düzenle</button>
                <button style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, marginLeft: 8, cursor: 'pointer' }} onClick={() => handleDelete(quiz.id)}>Sil</button>
                {!quiz.is_active && (
                  <button style={{ background: '#1abc9c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, marginLeft: 8, cursor: 'pointer' }} onClick={() => handleStart(quiz.id)}>Başlat (Canlı)</button>
                )}
              </>
            )}

            {isAdmin && (
              <div style={{ marginTop: 10 }}>
                {!quiz.is_active && (
                  <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', marginRight: 8 }} onClick={() => handleAdminStartLive(quiz.id)}>Start Live (Admin)</button>
                )}
                {quiz.is_active && (
                  <button className="btn btn-danger" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', marginRight: 8 }} onClick={() => handleAdminEndLiveQuiz(quiz.id)}>End Live (Admin)</button>
                )}
                {quiz.is_active && (quiz.session_code || liveRoomCodes[quiz.id]) && (
                  <div style={{ marginTop: 8, background: '#e3f2fd', borderRadius: 8, padding: 8, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, color: '#1976d2' }}>Oda Kodu: {quiz.session_code || liveRoomCodes[quiz.id]}</span>
                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => {navigator.clipboard.writeText(quiz.session_code || liveRoomCodes[quiz.id]);}}><ContentCopyIcon style={{ fontSize: '0.8rem', marginRight: 4 }} />Kopyala</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {showEdit && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ maxWidth: 500, width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16, boxShadow: '0 4px 24px #0002', background: '#fff', padding: 24 }}>
              <button style={{ position: 'absolute', top: 8, right: 12, background: '#eee', color: '#333', fontWeight: 700, border: 'none', borderRadius: 8, padding: '2px 10px', cursor: 'pointer' }} onClick={() => setShowEdit(false)}>X</button>
              <h2 style={{ color: '#2575fc', fontWeight: 700 }}>Quiz Düzenle</h2>
              <form onSubmit={handleUpdate}>
                <div>
                  <label>Başlık:</label><br />
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} required style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd', padding: 8, marginBottom: 10 }} />
                </div>
                <div>
                  <label>Açıklama:</label><br />
                  <input value={editDescription} onChange={e => setEditDescription(e.target.value)} required style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd', padding: 8, marginBottom: 10 }} />
                </div>
                <h4 style={{ color: '#3b3b5c', marginTop: 18 }}>Sorular</h4>
                {editQuestions.map((q, idx) => (
                  <div key={q.tempId || idx} style={{ marginBottom: 16, background: '#f7f8fa', borderRadius: 8, padding: 12 }}>
                    <b>Soru {idx + 1}:</b><br />
                    <input value={q.question_text || ''} onChange={e => handleEditQuestionTextChange(idx, e.target.value)} placeholder="Soru metni" required style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd', padding: 8, marginBottom: 8 }} />
                    <div style={{ marginTop: 6 }}>
                      {q.options.map((opt, i) => (
                        <span key={opt.tempId || i} style={{ display: 'inline-block', marginRight: 8 }}>
                          <input value={opt.option_text || ''} onChange={e => handleEditOptionChange(idx, i, e.target.value)} placeholder={`Seçenek ${opt.option_letter}`} required style={{ width: 120, borderRadius: 8, border: '1px solid #ddd', padding: 6 }} />
                          <input type="radio" name={`edit-correct-${idx}`} checked={q.correct_answer_option_temp_id === opt.tempId} onChange={() => handleEditCorrectChange(idx, opt.tempId)} />
                          <span style={{ fontSize: 13, color: '#888' }}>Doğru</span>
                        </span>
                      ))}
                      {q.options.length < 4 && (
                        <button type="button" onClick={() => {
                          const updated = [...editQuestions];
                          updated[idx].options.push({ tempId: nextEditOptionTempId++, option_letter: String.fromCharCode(65 + updated[idx].options.length), option_text: '' });
                          setEditQuestions(updated);
                        }} style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px', marginTop: 5, fontSize: 12, cursor: 'pointer' }}>+ Seçenek</button>
                      )}
                    </div>
                    {editQuestions.length > 1 && (
                      <button type="button" onClick={() => removeEditQuestion(idx)} style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', marginTop: 10, cursor: 'pointer', fontSize: 14 }}>
                        Soru Kaldır
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addEditQuestion} style={{ background: '#2575fc', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, marginRight: 8 }}>
                  + Soru Ekle
                </button>
                <button type="submit" style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, marginTop: 10 }}>Kaydet</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizList;
