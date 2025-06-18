import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getAdminQuizzes,
  getAdminUsers,
  getAdminAnalytics,
  updateAdminQuiz,
  startAdminQuizLive,
  endAdminQuizLive,
  deleteAdminQuiz
} from '../services/api';

// MUI Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ListIcon from '@mui/icons-material/List';
import BarChartIcon from '@mui/icons-material/BarChart';
import FlagIcon from '@mui/icons-material/Flag';
import InsightsIcon from '@mui/icons-material/Insights';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';


const sections = [
  { key: 'overview', label: 'Dashboard', icon: <DashboardIcon /> },
  { key: 'users', label: 'Users', icon: <PeopleIcon /> },
  { key: 'quizzes', label: 'Quizzes', icon: <ListIcon /> },
  { key: 'analytics', label: 'Analytics', icon: <BarChartIcon /> },
  { key: 'reports', label: 'Reports', icon: <FlagIcon /> },
];

function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [quizzes, setQuizzes] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [showEdit, setShowEdit] = useState(false);
  const [editQuiz, setEditQuiz] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuestions, setEditQuestions] = useState([]); 
  const [liveRoomCodes, setLiveRoomCodes] = useState({});

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      console.warn("AdminPanel: Kullanıcı admin rolünde değil, veya oturum yüklenmedi. API çağrıları yapılmıyor.");
      return; 
    }

    const fetchData = async () => {
      try {
        if (tab === 'quizzes') {
          const res = await getAdminQuizzes();
          setQuizzes(res.data.map(q => ({
              ...q,
              id: q.id,
              questions: JSON.parse(q.questions || '[]'), 
              isActive: q.is_active || false,
              roomCode: q.session_code || undefined
          })));
        } else if (tab === 'users') {
          const res = await getAdminUsers();
          setUsers(res.data.map(u => ({ 
              ...u, 
              id: u.id, 
              created_at: u.created_at || undefined 
          }))); 
        } else if (tab === 'analytics' || tab === 'overview') {
          const res = await getAdminAnalytics();
          setAnalytics(res.data);
        }
      } catch (error) {
        console.error(`Admin Panel: ${tab} verileri çekilirken hata:`, error.response?.data?.message || error.message);
        alert(`Veri çekilirken hata oluştu: ${error.response?.data?.message || error.message}`);
      }
    };
    fetchData();
  }, [tab, user]);

  const handleAdminEdit = (quiz) => {
    setEditQuiz(quiz);
    setEditTitle(quiz.title);
    setEditDescription(quiz.description);
    setEditQuestions(JSON.parse(JSON.stringify(quiz.questions || [])));
    setShowEdit(true);
  };

  const handleAdminUpdate = async (e) => {
    e.preventDefault();
    if (!editQuiz) return;
    try {
      const updated = {
        title: editTitle,
        description: editDescription,
        questions: JSON.stringify(editQuestions)
      };
      const res = await updateAdminQuiz(editQuiz.id, updated);
      setQuizzes(quizzes.map(q => (q.id === editQuiz.id ? { ...res.data, questions: JSON.parse(res.data.questions || '[]') } : q))); 
      setShowEdit(false);
      setEditQuiz(null);
      alert('Quiz başarıyla güncellendi!');
    } catch (error) {
      console.error('Admin Quiz güncellenemedi:', error.response?.data?.message || error.message);
      alert('Quiz güncellenemedi: ' + (error.response?.data?.message || 'Bir hata oluştu.'));
    }
  };

  const handleAdminStart = async (quizId) => {
    try {
      const res = await startAdminQuizLive(quizId);
      const roomCode = res.data.roomCode;
      setLiveRoomCodes(prev => ({ ...prev, [quizId]: roomCode }));
      setQuizzes(quizzes => quizzes.map(q => q.id === quizId ? { ...q, isActive: true, roomCode } : q));
      alert(`Quiz canlı yayına başladı! Oda Kodu: ${roomCode}`);
    } catch (error) {
      console.error('Admin Quiz başlatılamadı:', error.response?.data?.message || error.message);
      alert('Quiz başlatılamadı: ' + (error.response?.data?.message || 'Bir hata oluştu.'));
    }
  };

  const handleAdminEndLive = async (quizId) => {
    try {
      await endAdminQuizLive(quizId);
      setLiveRoomCodes(prev => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });
      setQuizzes(quizzes => quizzes.map(q => q.id === quizId ? { ...q, isActive: false, roomCode: undefined } : q));
      alert('Oturum başarıyla sonlandırıldı.');
    } catch (error) {
      console.error('Admin Oturumu sonlandırılamadı:', error.response?.data?.message || error.message);
      alert('Oturum sonlandırılamadı: ' + (error.response?.data?.message || 'Bir hata oluştu.'));
    }
  };

  const handleAdminDelete = async (quizId) => {
    if (window.confirm('Bu quiz silinsin mi?')) {
      try {
        await deleteAdminQuiz(quizId);
        setQuizzes(quizzes.filter(q => q.id !== quizId));
        alert('Quiz başarıyla silindi!');
      } catch (error) {
        console.error('Admin Quiz silinemedi:', error.response?.data?.message || error.message);
        alert('Quiz silinemedi: ' + (error.response?.data?.message || 'Bir hata oluştu.'));
      }
    }
  };

  return (
    <div id="admin" className="page" style={{ minHeight: 'calc(100vh - 80px)', background: 'linear-gradient(120deg, #6a11cb 0%, #2575fc 100%)', padding: 0, margin: 0 }}>
      <div className="dashboard">
        <div className="sidebar">
          <h3 style={{ color: 'white', marginBottom: '2rem' }}>Admin Panel</h3>
          <ul className="sidebar-menu">
            {sections.map(sec => (
              <li key={sec.key}>
                <button className={tab === sec.key ? 'active' : ''} onClick={e => { e.preventDefault(); setTab(sec.key); }} style={{ background: 'none', border: 'none', color: 'white', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '1rem', width: '100%' }}>
                  {sec.icon} {sec.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="dashboard-content">
          {/* Overview */}
          {tab === 'overview' && (
            <div className="admin-section">
              <h2 style={{ color: 'white', marginBottom: '2rem' }}>Gösterge Paneli Genel Bakış</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{analytics.userCount || '—'}</div>
                  <div>Toplam Kullanıcı</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{analytics.quizCount || '—'}</div>
                  <div>Aktif Quizler</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{analytics.sessionCount || '—'}</div>
                  <div>Quiz Oturumları</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{analytics.uptime || '—'}%</div>
                  <div>Çalışma Süresi</div>
                </div>
              </div>
            </div>
          )}
          {/* Users */}
          {tab === 'users' && (
            <div className="admin-section">
              <h2 style={{ color: 'white', marginBottom: '2rem' }}>Kullanıcı Yönetimi</h2>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  <div>Kullanıcı</div>
                  <div>Katılma Tarihi</div>
                  <div>Quizler</div>
                  <div>İşlemler</div>
                </div>
                {users.map((u, i) => (
                  <div key={u.id || i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'white', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.username || u.email}</div>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{u.email}</div>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
                    <div>{u.created_quizzes_count !== undefined ? u.created_quizzes_count : (u.createdQuizzes ? u.createdQuizzes.length : 0)}</div>
                    <div>
                      <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                        <EditIcon style={{ fontSize: '0.8rem' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Quizzes */}
          {tab === 'quizzes' && (
            <div className="admin-section">
              <h2 style={{ color: 'white', marginBottom: '2rem' }}>Tüm Quizler</h2>
              <div className="quiz-grid">
                {quizzes.map(q => (
                  <div className="quiz-card" key={q.id}>
                    <div className="quiz-header">
                      <h3>{q.title}</h3>
                      <span className={`quiz-status ${q.is_active ? 'status-live' : 'status-passive'}`}>{q.is_active ? 'LIVE' : 'PASSIVE'}</span>
                    </div>
                    <p>{q.description}</p>
                    <div style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
                      <span style={{ marginRight: 16 }}><PeopleIcon style={{ fontSize: '0.9rem', marginRight: 4 }} /> {q.participants || 0} participants</span>
                      <span><InsightsIcon style={{ fontSize: '0.9rem', marginLeft: 8, marginRight: 4 }} /> {q.views || 0} views</span>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }} onClick={() => handleAdminEdit(q)}>Edit</button>
                      <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }} onClick={() => handleAdminDelete(q.id)}>Delete</button>
                      {!q.is_active && (
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }} onClick={() => handleAdminStart(q.id)}><PlayArrowIcon style={{ fontSize: '0.8rem', marginRight: 4 }} /> Start Live</button>
                      )}
                      {q.is_active && (
                        <button className="btn btn-danger" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }} onClick={() => handleAdminEndLive(q.id)}><StopIcon style={{ fontSize: '0.8rem', marginRight: 4 }} /> End Live</button>
                      )}
                    </div>
                    {q.is_active && (q.session_code || liveRoomCodes[q.id]) && (
                      <div style={{ marginTop: 12, background: '#e3f2fd', borderRadius: 8, padding: 8, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 600, color: '#1976d2' }}>Oda Kodu: {q.session_code || liveRoomCodes[q.id]}</span>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => {navigator.clipboard.writeText(q.session_code || liveRoomCodes[q.id]);}}><ContentCopyIcon style={{ fontSize: '0.8rem', marginRight: 4 }} />Kopyala</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {showEdit && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="card" style={{ maxWidth: 500, width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16, boxShadow: '0 4px 24px #0002', background: '#fff', padding: 24 }}>
                    <button style={{ position: 'absolute', top: 8, right: 12, background: '#eee', color: '#333', fontWeight: 700, border: 'none', borderRadius: 8, padding: '2px 10px', cursor: 'pointer' }} onClick={() => setShowEdit(false)}>X</button>
                    <h2 style={{ color: '#2575fc', fontWeight: 700 }}>Quiz Düzenle (Admin)</h2>
                    <form onSubmit={handleAdminUpdate}>
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
                                <input value={opt.option_text || ''} onChange={e => {
                                  const updated = [...editQuestions];
                                  updated[idx].options[i].option_text = e.target.value;
                                  setEditQuestions(updated);
                                }} placeholder={`Seçenek ${i + 1}`} required style={{ width: 120, borderRadius: 8, border: '1px solid #ddd', padding: 6 }} />
                                <input type="radio" name={`edit-correct-${idx}`} checked={q.correct_answer_option_id === opt.id} onChange={() => {
                                  const updated = [...editQuestions];
                                  updated[idx].correct_answer_option_id = opt.id;
                                  setEditQuestions(updated);
                                }} />
                                <span style={{ fontSize: 13, color: '#888' }}>Doğru</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button type="submit" style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, marginTop: 10 }}>Kaydet</button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Analytics */}
          {tab === 'analytics' && (
            <div className="admin-section">
              <h2 style={{ color: 'white', marginBottom: '2rem' }}>Analiz</h2>
              <div>Toplam Quiz: {analytics.quizCount}</div>
              <div>Toplam Kullanıcı: {analytics.userCount}</div>
              <div>En Çok Oynanan Quizler:</div>
              <ul>
                {(analytics.mostPlayed || []).map((q, i) => (
                  <li key={i}>{q.quiz_title || 'Bilinmiyor'} ({q.play_count} kez)</li>
                ))}
              </ul>
            </div>
          )}
          {/* Reports */}
          {tab === 'reports' && (
            <div className="admin-section">
              <h2 style={{ color: 'white', marginBottom: '2rem' }}>Reports</h2>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                Raporlama ve moderasyon özellikleri buraya eklenecek.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
