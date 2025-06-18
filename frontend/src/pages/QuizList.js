import React, { useEffect, useState, useCallback } from 'react';
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

// MUI Icons
import QuizIcon from '@mui/icons-material/Quiz';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// Geçici ID sayaçları
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

  const navigate = useNavigate();

  const isTeacherOrAdmin = user && (user.role === 'teacher' || user.role === 'admin');
  const isAdmin = user?.role === 'admin';

  const handleEditQuestionTextChange = useCallback((qIndex, value) => {
    setEditQuestions(prev => {
      const updated = [...prev];
      if (updated[qIndex]) { 
        updated[qIndex].question_text = value;
      }
      return updated;
    });
  }, []);

  const handleEditOptionTextChange = useCallback((qIndex, optIndex, value) => {
    setEditQuestions(prev => {
      const updated = [...prev];
      if (updated[qIndex] && updated[qIndex].options && updated[qIndex].options[optIndex]) { 
        updated[qIndex].options[optIndex].option_text = value;
      }
      return updated;
    });
  }, []);

  const handleEditCorrectChange = useCallback((qIndex, optionTempId) => {
    setEditQuestions(prev => {
      const updated = [...prev];
      if (updated[qIndex]) {
        updated[qIndex].correct_answer_option_temp_id = optionTempId;
      }
      return updated;
    });
  }, []);

  const addEditQuestion = useCallback(() => {
    setEditQuestions(prev => {
      const newOptions = [
        { tempId: nextEditOptionTempId++, option_letter: 'A', option_text: '' },
        { tempId: nextEditOptionTempId++, option_letter: 'B', option_text: '' },
        { tempId: nextEditOptionTempId++, option_letter: 'C', option_text: '' },
        { tempId: nextEditOptionTempId++, option_letter: 'D', option_text: '' }
      ];
      return [...prev, { 
        tempId: nextEditQuestionTempId++, 
        question_text: '', 
        question_type: 'multiple_choice', 
        options: newOptions, 
        correct_answer_option_temp_id: null 
      }];
    });
  }, []);

  const removeEditQuestion = useCallback((index) => {
    setEditQuestions(prev => prev.filter((_, i) => i !== index));
  }, []);


  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const quizRes = await apiGetQuizzes(); 

        setQuizzes(quizRes.data.map(quizItem => ({ // map değişkeni `quizItem` olarak değiştirildi, içerdeki `q` ile çakışmayı önlemek için
            ...quizItem, 
            id: quizItem.id,
            is_active: quizItem.is_active,
            session_code: quizItem.session_code,
            questions: JSON.parse(quizItem.questions || '[]')
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
        setQuizzes(quizzes.filter(quizItem => quizItem.id !== id)); // quizItem kullanıldı
        alert('Quiz başarıyla silindi!');
      } catch (error) {
        console.error('Quiz silme hatası:', error.response?.data?.message || error.message);
        alert('Quiz silinemedi: ' + (error.response?.data?.message || 'Sadece kendi oluşturduğunuz quizleri silebilirsiniz.')); 
      }
    }
  };

  const handleEdit = useCallback((quiz) => { 
    setEditQuiz(quiz);
    setEditTitle(quiz.title);
    setEditDescription(quiz.description);
    const questionsWithTempIds = (quiz.questions || []).map(qItem => ({ // qItem kullanıldı
      ...qItem,
      tempId: nextEditQuestionTempId++,
      options: (qItem.options || []).map(optItem => ({ // optItem kullanıldı
        ...optItem,
        tempId: nextEditOptionTempId++
      })),
      correct_answer_option_temp_id: qItem.correct_answer_option_id
    }));
    setEditQuestions(JSON.parse(JSON.stringify(questionsWithTempIds)));
    setShowEdit(true);
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editQuiz) return;

    if (!editTitle.trim() || !editDescription.trim()) {
      alert('Başlık ve açıklama boş bırakılamaz.');
      return;
    }
    for (const qItem of editQuestions) { // qItem kullanıldı
      if (!qItem.question_text.trim() || qItem.options.some(optItem => !optItem.option_text.trim()) || !qItem.correct_answer_option_temp_id) { // optItem kullanıldı
        alert('Tüm soruların metinleri, seçenekleri ve doğru cevapları doldurulmalıdır.');
        return;
      }
    }

    try {
      const updatedQuizData = {
        title: editTitle,
        description: editDescription,
        questions: JSON.stringify(editQuestions.map(qItem => ({ // qItem kullanıldı
          question_text: qItem.question_text,
          question_type: qItem.question_type,
          correct_answer_option_text: qItem.options.find(optItem => optItem.tempId === qItem.correct_answer_option_temp_id)?.option_text || null, // optItem kullanıldı
          options: qItem.options.map(optItem => ({ // optItem kullanıldı
            option_letter: optItem.option_letter,
            option_text: optItem.option_text
          }))
        })))
      };

      const res = await apiUpdateQuiz(editQuiz.id, updatedQuizData);

      setQuizzes(quizzes.map(quizItem => (quizItem.id === editQuiz.id ? { ...res.data, questions: JSON.parse(res.data.questions || '[]') } : quizItem))); // quizItem kullanıldı
      setShowEdit(false);
      setEditQuiz(null);
      alert('Quiz başarıyla güncellendi!');
    } catch (error) {
      console.error('Quiz güncelleme hatası:', error.response?.data?.message || error.message);
      alert('Quiz güncellenemedi: ' + (error.response?.data?.message || 'Sadece kendi oluşturduğunuz quizleri güncelleyebilirsiniz.'));
    }
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
      setQuizzes(quizzes => quizzes.map(quizItem => quizItem.id === quizId ? { ...quizItem, is_active: true, session_code: roomCode } : quizItem)); // quizItem kullanıldı
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
      setQuizzes(quizzes => quizzes.map(quizItem => quizItem.id === quizId ? { ...quizItem, is_active: false, session_code: undefined } : quizItem)); // quizItem kullanıldı
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
        {quizzes.map(quizItem => ( // map değişkeni quizItem olarak düzeltildi
          <div className="quiz-card" key={quizItem.id} style={{ background: '#f7f8fa', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: 20, marginBottom: 18 }}>
            <h3 style={{ marginBottom: 8, color: '#2575fc' }}>{quizItem.title}</h3>
            <div style={{ color: '#888', marginBottom: 8 }}>{quizItem.description}</div>
            <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>Oluşturan: {quizItem.created_by_username || quizItem.created_by_email || 'Bilinmiyor'}</div>

            <button onClick={() => navigate(`/play-quiz/${quizItem.id}`)} style={{ background: '#2575fc', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', marginRight: 8 }}>
              Quiz Oyna
            </button>

            {isTeacherOrAdmin && quizItem.host_user_id === user?.id && (
              <>
                <button style={{ background: '#6a11cb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, marginLeft: 8, cursor: 'pointer' }} onClick={() => handleEdit(quizItem)}>Düzenle</button>
                <button style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, marginLeft: 8, cursor: 'pointer' }} onClick={() => handleDelete(quizItem.id)}>Sil</button>
                {!quizItem.is_active && (
                  <button style={{ background: '#1abc9c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, marginLeft: 8, cursor: 'pointer' }} onClick={() => handleStart(quizItem.id)}>Başlat (Canlı)</button>
                )}
              </>
            )}

            {isAdmin && (
              <div style={{ marginTop: 10 }}>
                {!quizItem.is_active && (
                  <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', marginRight: 8 }} onClick={() => handleAdminStartLive(quizItem.id)}>Start Live (Admin)</button>
                )}
                {quizItem.is_active && (
                  <button className="btn btn-danger" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', marginRight: 8 }} onClick={() => handleAdminEndLiveQuiz(quizItem.id)}>End Live (Admin)</button>
                )}
                {quizItem.is_active && (quizItem.session_code || liveRoomCodes[quizItem.id]) && ( // quizItem kullanıldı
                  <div style={{ marginTop: 8, background: '#e3f2fd', borderRadius: 8, padding: 8, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, color: '#1976d2' }}>Oda Kodu: {quizItem.session_code || liveRoomCodes[quizItem.id]}</span>
                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => {navigator.clipboard.writeText(quizItem.session_code || liveRoomCodes[quizItem.id]);}}><ContentCopyIcon style={{ fontSize: '0.8rem', marginRight: 4 }} />Kopyala</button>
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
                {editQuestions.map((qItem, idx) => ( // qItem kullanıldı
                  <div key={qItem.tempId || idx} style={{ marginBottom: 16, background: '#f7f8fa', borderRadius: 8, padding: 12 }}>
                    <b>Soru {idx + 1}:</b><br />
                    <input value={qItem.question_text || ''} onChange={e => handleEditQuestionTextChange(idx, e.target.value)} placeholder="Soru metni" required style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd', padding: 8, marginBottom: 8 }} />
                    <div style={{ marginTop: 6 }}>
                      {qItem.options.map((optItem, i) => ( // optItem kullanıldı
                        <span key={optItem.tempId || i} style={{ display: 'inline-block', marginRight: 8 }}>
                          <input value={optItem.option_text || ''} onChange={e => handleEditOptionTextChange(idx, i, e.target.value)} placeholder={`Seçenek ${optItem.option_letter}`} required style={{ width: 120, borderRadius: 8, border: '1px solid #ddd', padding: 6 }} />
                          <input type="radio" name={`edit-correct-${idx}`} checked={qItem.correct_answer_option_id === optItem.id} onChange={() => handleEditCorrectChange(idx, optItem.id)} />
                          <span style={{ fontSize: 13, color: '#888' }}>Doğru</span>
                        </span>
                      ))}
                      {qItem.options.length < 4 && (
                        <button type="button" onClick={() => {
                          const updated = [...editQuestions];
                          updated[idx].options.push({ tempId: Date.now() + Math.random(), option_letter: String.fromCharCode(65 + updated[idx].options.length), option_text: '' });
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
    ))}
  </div>
</div>
