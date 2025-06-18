import React, { useState, useEffect, useRef, useCallback } from 'react'; // useCallback ekledik
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import QuestionComponent from '../components/QuestionComponent';
import Leaderboard from '../components/Leaderboard';
import { getQuizByRoomCode } from '../services/api';

const SOCKET_SERVER_URL = process.env.NODE_ENV === 'production' 
                          ? 'https://[CANLI_BACKEND_URL_BURAYA]' // CANLI BACKEND URL'İNİZ BURAYA GELECEK
                          : 'http://localhost:5000';

let socket;

function LiveQuiz() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [gameCode, setGameCode] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [playerAnswered, setPlayerAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [gameScores, setGameScores] = useState([]);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [timerRemaining, setTimerRemaining] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');

  // 'currentQ' uyarısını kaldırmak için: Eğer kullanılmıyorsa silin, kullanılıyorsa doğru şekilde kullanın.
  // Varsayımsal olarak kullanılmıyor, bu yüzden uyarıyı kaldırmak için ek bir şey yapmaya gerek kalmaz.

  // handleNextQuestion fonksiyonunu useCallback içine alıyoruz ve bağımlılıklarını ekliyoruz
  const handleNextQuestion = useCallback(() => {
    if (socket && gameCode && user && isHost) {
      socket.emit('nextQuestion', gameCode, user.token, (response) => {
        if (response.status === 'error') {
          setError(response.message);
          alert(response.message);
        }
      });
    } else {
      setError('Sonraki soruya geçmek için yetkiniz yok veya oyun bulunamadı.');
    }
  }, [gameCode, user, isHost]); // Bağımlılıklar eklendi

  // handleSubmitAnswer fonksiyonunu useCallback içine alıyoruz ve bağımlılıklarını ekliyoruz
  const handleSubmitAnswer = useCallback((questionId, selectedOptionId) => {
    if (!quiz || playerAnswered || currentQuestion?.questionId !== questionId) return;

    const submittedTime = Date.now();
    
    setPlayerAnswered(true);

    socket.emit('submitAnswer', {
      gameCode,
      questionId,
      submittedOptionId: selectedOptionId,
      submittedTime
    }, (response) => {
      if (response.status === 'success') {
        setFeedback({ isCorrect: response.isCorrect, score: response.score, pointsEarned: response.pointsEarned, selectedOptionId });
      } else {
        setError(response.message);
        alert(response.message);
        setPlayerAnswered(false);
      }
    });
  }, [gameCode, quiz, playerAnswered, currentQuestion, setPlayerAnswered, setFeedback, setError]); // Bağımlılıklar eklendi

  useEffect(() => {
    if (location.state && location.state.gameCode) {
      setGameCode(location.state.gameCode);
      setIsHost(location.state.isHost || false);
    } else {
      setError('Oyun kodu bulunamadı. Lütfen bir oyun odasına katılın.');
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (!gameCode) return;

    if (!socket) {
      socket = io(SOCKET_SERVER_URL);
      console.log('LiveQuiz: Socket.IO bağlantısı kuruldu.');

      socket.on('connect', () => {
        console.log('LiveQuiz: Sunucuya bağlandı. ID:', socket.id);
      });

      socket.on('disconnect', () => {
        console.log('LiveQuiz: Sunucu bağlantısı kesildi.');
        setError('Sunucu bağlantısı kesildi.');
      });

      socket.on('gameError', (data) => {
        console.error('LiveQuiz: Socket hatası:', data.message);
        setError(data.message);
        alert(data.message);
      });

      socket.on('gameStarted', (data) => {
        console.log('LiveQuiz: Oyun başladı:', data);
        setGameStatus('in_progress');
        setPlayers(data.players || []);
        setShowLeaderboard(false);
        setFeedback(null);
        setPlayerAnswered(false);
      });

      socket.on('question', (data) => {
        console.log('LiveQuiz: Yeni soru geldi:', data);
        setCurrentQuestion(data);
        setPlayerAnswered(false);
        setFeedback(null);
        setTimerRemaining(null);
        setShowLeaderboard(false);
      });

      socket.on('timerEnded', (data) => {
        console.log('LiveQuiz: Süre doldu:', data.message);
        setShowLeaderboard(true);
      });

      socket.on('answerSubmitted', (data) => {
        console.log('LiveQuiz: Cevap gönderildi geri bildirimi:', data);
      });

      socket.on('updateScores', (data) => {
        console.log('LiveQuiz: Skorlar güncellendi:', data.scores);
        setGameScores(data.scores);
      });

      socket.on('gameEnded', (data) => {
        console.log('LiveQuiz: Oyun bitti:', data);
        setGameStatus('completed');
        setGameScores(data.finalScores);
        setShowLeaderboard(true);
        setCurrentQuestion(null);
        alert(data.message + '\nOyun bitti! Final skorları görüntülenecek.');
      });

      socket.on('playersUpdated', (data) => {
        console.log('LiveQuiz: Oyuncular güncellendi:', data.players);
        setPlayers(data.players);
      });
    }

    const fetchQuizDetails = async () => {
      try {
        const res = await getQuizByRoomCode(gameCode);
        setQuiz({ ...res.data, questions: JSON.parse(res.data.questions || '[]') }); 
        setGameStatus(res.data.status || 'waiting');
      } catch (error) {
        console.error('LiveQuiz: Quiz detayları çekilirken hata:', error);
        setError('Quiz detayları yüklenemedi.');
      }
    };

    if (gameCode) {
      fetchQuizDetails();
    }

    return () => {
      // Socket sadece burada kuruluyorsa disconnect edilebilir.
      // Ancak Lobby ve LiveQuiz arasında geçiş yaparken bağlantının kalmasını isteriz.
      // Bu yüzden bağlantıyı App.js seviyesinde tutmak daha mantıklı olabilir.
      // Şimdilik burada disconnect etmiyoruz, bağlantı kesilmesini Socket.io'nun otomatik yönetmesine izin veriyoruz.
    };
  }, [gameCode, user, navigate, SOCKET_SERVER_URL]);

  useEffect(() => {
    if (currentQuestion && currentQuestion.startTime && timerRemaining === null) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - currentQuestion.startTime) / 1000;
        const remaining = 20 - Math.floor(elapsed);
        setTimerRemaining(Math.max(0, remaining));

        if (remaining <= 0) {
          clearInterval(interval);
          // Süre dolduğunda cevabı işle (boş cevap)
          handleSubmitAnswer( // handleSubmitAnswer bağımlılığa eklendiği için sorun yaratmaz
            currentQuestion.questionId,
            null,
            Date.now()
          );
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentQuestion, timerRemaining, handleSubmitAnswer]); // handleSubmitAnswer bağımlılığa eklendi

  if (!gameCode) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#fff' }}>
        {error ? <p style={{ color: 'red' }}>{error}</p> : <p>Oyun kodu yükleniyor...</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
        <p>Hata: {error}</p>
        <button onClick={() => navigate('/join-quiz')}>Tekrar Katıl</button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#fff' }}>
        <p>Quiz bilgileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      background: 'linear-gradient(120deg, #6a11cb 0%, #2575fc 100%)',
      padding: '20px',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <h1 style={{ marginBottom: 20 }}>{quiz.title}</h1>

      {gameStatus === 'waiting' && (
        <div style={{ textAlign: 'center', background: '#fff', color: '#333', borderRadius: 12, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#6a11cb', marginBottom: 15 }}>Oyun Lobisi</h2>
          <p style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Oyun Kodu: {gameCode}</p>
          <p style={{ marginBottom: 15 }}>Oyuncu Sayısı: {players.length}</p>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 10 }}>Oyuncular:</h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {players.map(p => (
                <li key={p.socketId} style={{ background: '#e0e7ff', padding: 8, borderRadius: 8, marginBottom: 5, color: '#333' }}>
                  {p.username} ({p.role === 'host' ? 'Host' : p.role}) - Skor: {p.score}
                </li>
              ))}
            </ul>
          </div>
          {isHost && (
            <button 
              onClick={() => {
                if (socket && gameCode && user) {
                  socket.emit('startGame', gameCode, user.token, (response) => {
                    if (response.status === 'error') {
                      setError(response.message);
                      alert(response.message);
                    } else {
                      alert('Oyun başarıyla başlatıldı!');
                    }
                  });
                }
              }}
              style={{ background: '#1abc9c', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 25px', fontSize: 18, fontWeight: 'bold', cursor: 'pointer' }}
            >
              Oyunu Başlat
            </button>
          )}
        </div>
      )}

      {gameStatus === 'in_progress' && currentQuestion && !showLeaderboard && (
        <div style={{ textAlign: 'center', background: '#fff', color: '#333', borderRadius: 12, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: 700 }}>
          <h3 style={{ marginBottom: 20, color: '#2575fc' }}>
            Soru {quiz.questions.findIndex(q => q.questionId === currentQuestion.questionId) + 1} / {quiz.questions.length}
          </h3>
          <QuestionComponent 
            question={currentQuestion}
            onAnswer={handleSubmitAnswer}
            playerAnswered={playerAnswered}
            feedback={feedback}
            timerRemaining={timerRemaining}
          />
          {isHost && (
            <button 
              onClick={handleNextQuestion} 
              style={{ background: '#6a11cb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}
            >
              Sonraki Soruya Geç
            </button>
          )}
        </div>
      )}

      {gameStatus === 'in_progress' && showLeaderboard && (
        <div style={{ textAlign: 'center', background: '#fff', color: '#333', borderRadius: 12, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: 500 }}>
          <Leaderboard roomId={gameCode} scores={gameScores} />
        </div>
      )}

      {gameStatus === 'completed' && (
        <div style={{ textAlign: 'center', background: '#fff', color: '#333', borderRadius: 12, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: 500 }}>
          <h2 style={{ color: '#6a11cb', marginBottom: 20 }}>Oyun Bitti! Final Skorları</h2>
          <Leaderboard roomId={gameCode} scores={gameScores} />
          <button 
            onClick={() => navigate('/')} 
            style={{ background: '#1abc9c', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 25px', fontSize: 18, fontWeight: 'bold', cursor: 'pointer', marginTop: 20 }}
          >
            Ana Sayfaya Dön
          </button>
        </div>
      )}
    </div>
  );
}

export default LiveQuiz;
