import React, { useState, useEffect, useRef, useCallback } from 'react'; // useRef ve useCallback eklendi
import { useParams, useNavigate } from 'react-router-dom';
import { getQuizById, saveQuizHistory } from '../services/api';
import QuestionComponent from '../components/QuestionComponent';
import Leaderboard from '../components/Leaderboard';
import { useAuth } from '../context/AuthContext';

function PlayQuiz() {
  const { id: quizId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userScore, setUserScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [quizHistorySaved, setQuizHistorySaved] = useState(false);
  const [error, setError] = useState('');
  const [playerAnswered, setPlayerAnswered] = useState(false); // PlayerAnswered state'i eklendi

  // audioRef için useRef kullanılıyor
  const audioRef = useRef(null); // Eğer bir ses çalma özelliği varsa

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const res = await getQuizById(quizId);
        setQuiz({ ...res.data, questions: JSON.parse(res.data.questions || '[]') });
      } catch (err) {
        console.error('Quiz çekilemedi:', err);
        setError('Quiz yüklenemedi veya bulunamadı.');
      }
    }
    fetchQuiz();
  }, [quizId]);

  // handleSubmitAnswer'ı useCallback ile sarmalıyoruz ve bağımlılıklarını ekliyoruz
  const handleSubmitAnswer = useCallback((questionId, selectedOptionId, submissionTime) => {
    if (!quiz || answeredQuestions[questionId]) return;

    const currentQuestion = quiz.questions[currentQuestionIndex];
    let isCorrect = false;
    let pointsEarned = 0;
    const MAX_POINTS = 1000;
    const TIME_LIMIT_SECONDS = 20;

    const correctOption = currentQuestion.options.find(opt => opt.option_text === currentQuestion.correct_answer_option_text);
    
    if (selectedOptionId && correctOption && selectedOptionId === correctOption.id) {
      isCorrect = true;
      const timeTakenMs = submissionTime - (questionStartTime || Date.now()); // questionStartTime null olabilir
      const timeRemainingMs = (TIME_LIMIT_SECONDS * 1000) - timeTakenMs;

      if (timeRemainingMs > 0) {
        pointsEarned = Math.round(MAX_POINTS * (timeRemainingMs / (TIME_LIMIT_SECONDS * 1000)));
        if (pointsEarned < 50) pointsEarned = 50;
      }
    }

    setUserScore(prevScore => prevScore + pointsEarned);
    setAnsweredQuestions(prev => ({ ...prev, [questionId]: selectedOptionId }));
    setFeedback({ isCorrect, pointsEarned, selectedOptionId }); // selectedOptionId de eklendi
    setPlayerAnswered(true); // Cevaplandığını işaretle
    setTimerRemaining(0);
  }, [quiz, currentQuestionIndex, answeredQuestions, questionStartTime, setUserScore, setAnsweredQuestions, setFeedback, setPlayerAnswered, setTimerRemaining]); // Bağımlılıklar eklendi

  useEffect(() => {
    if (quiz && currentQuestionIndex < quiz.questions.length && questionStartTime !== null && !answeredQuestions[quiz.questions[currentQuestionIndex].id]) {
      const timerInterval = setInterval(() => {
        const elapsed = (Date.now() - questionStartTime) / 1000;
        const remaining = 20 - Math.floor(elapsed);
        setTimerRemaining(Math.max(0, remaining));

        if (remaining <= 0) {
          clearInterval(timerInterval);
          handleSubmitAnswer(
            quiz.questions[currentQuestionIndex].id,
            null,
            Date.now()
          );
        }
      }, 1000);

      return () => clearInterval(timerInterval);
    }
  }, [quiz, currentQuestionIndex, questionStartTime, answeredQuestions, handleSubmitAnswer]); // handleSubmitAnswer bağımlılığa eklendi

  useEffect(() => {
    if (quiz && quiz.questions[currentQuestionIndex]) {
      setQuestionStartTime(Date.now());
      setTimerRemaining(20);
      setPlayerAnswered(false);
      setFeedback(null);
    }
  }, [quiz, currentQuestionIndex]);

  // Audio ref cleanup
  useEffect(() => {
    const currentAudioRef = audioRef.current; // Ref değerini değişkene atama
    if (currentAudioRef) {
      // Audio çalma/durdurma mantığı buraya gelebilir
    }
    return () => {
      // Cleanup fonksiyonu, currentAudioRef'i kullanır
      if (currentAudioRef) {
        // currentAudioRef.pause();
        // currentAudioRef.currentTime = 0;
      }
    };
  }, [audioRef]); // audioRef bağımlılıklarda

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setPlayerAnswered(false); // Yeni soruya geçerken sıfırla
    } else {
      setShowResults(true);
      if (user && !quizHistorySaved) {
        const historyData = {
          quizId: quiz.id,
          score: userScore,
          date: new Date().toISOString()
        };
        saveQuizHistory(quiz.id, historyData); // quizId parametresini ekledik
        setQuizHistorySaved(true);
      }
    }
  };

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
        <p>Hata: {error}</p>
        <button onClick={() => navigate('/quiz-list')}>Quiz Listesine Dön</button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#fff' }}>
        <p>Quiz yükleniyor...</p>
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
      justifyContent: 'center'
    }}>
      {!showResults ? (
        <div style={{ textAlign: 'center', background: '#fff', color: '#333', borderRadius: 12, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: 700 }}>
          <h3 style={{ marginBottom: 20, color: '#2575fc' }}>
            Soru {currentQuestionIndex + 1} / {quiz.questions.length}
          </h3>
          <QuestionComponent 
            question={quiz.questions[currentQuestionIndex]}
            onAnswer={handleSubmitAnswer}
            playerAnswered={playerAnswered}
            feedback={feedback}
            timerRemaining={timerRemaining}
          />
          <button 
            onClick={handleNextQuestion} 
            disabled={!playerAnswered}
            style={{ background: '#6a11cb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 16, fontWeight: 'bold', marginTop: 20, cursor: 'pointer' }}
          >
            Sonraki Soru
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', background: '#fff', color: '#333', borderRadius: 12, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: 500 }}>
          <h2 style={{ color: '#6a11cb', marginBottom: 20 }}>Quiz Bitti!</h2>
          <p style={{ fontSize: 24, fontWeight: 'bold' }}>Toplam Skorunuz: {userScore}</p>
          <Leaderboard roomId={quizId} scores={[{ username: user?.username || user?.email, score: userScore }]} /> {/* Leaderboard bileşeni kullanıldı */}
          <button 
            onClick={() => navigate('/quiz-list')} 
            style={{ background: '#1abc9c', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 25px', fontSize: 18, fontWeight: 'bold', cursor: 'pointer', marginTop: 20 }}
          >
            Quiz Listesine Dön
          </button>
        </div>
      )}
    </div>
  );
}

export default PlayQuiz;
