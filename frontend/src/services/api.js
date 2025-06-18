// API istekleri için servis fonksiyonları
import axios from 'axios';

// Backend API ana adresi
// Lokal geliştirme için: '/api' (package.json'daki proxy ile)
// Canlı dağıtım için: Backend'in canlı URL'i
// LÜTFEN [CANLI_BACKEND_URL_BURAYA] KISMINI KENDİ CANLI BACKEND URL'İNİZLE DEĞİŞTİRİN (Render'dan alacaksınız)
const API_URL = process.env.NODE_ENV === 'production' 
                ? 'https://[CANLI_BACKEND_URL_BURAYA]/api' 
                : 'http://localhost:5000/api'; // Lokal geliştirme için tam URL veya proxy'ye bırakmak isterseniz sadece '/api'


// Axios instance'ı oluştur (tüm API istekleri bu instance üzerinden geçecek)
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // İstek zaman aşımı artırıldı (15 saniye)
});

// Axios Request Interceptor: AuthContext.js'de ayarlandığı için burada tekrar tanımlamaya gerek yok.
// AuthContext'teki interceptor, her isteğe Authorization başlığını otomatik ekler.

// Kullanıcı kaydı (register)
export const register = (username, email, password) =>
  api.post('/auth/register', { username, email, password });

// Kullanıcı girişi (login)
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

// Kullanıcının kendi profil bilgilerini getirir (GET /api/auth/me)
export const getUserProfile = () =>
  api.get('/auth/me');

// --- Quizler ile ilgili genel fonksiyonlar ---

// Tüm quizleri getirir
export const getQuizzes = () =>
  api.get('/quizzes');

// Yeni quiz oluşturur
export const createQuiz = (quizData) =>
  api.post('/quizzes', quizData);

// Belirli bir quizin detayını getirir
export const getQuizById = (id) =>
  api.get(`/quizzes/${id}`); // Tek 'const' kelimesiyle

// Oda kodu ile aktif quiz getirir (canlı quiz için)
export const getQuizByRoomCode = (roomCode) =>
  api.get(`/quizzes/room/${roomCode}`);

// Quiz güncelle (PUT)
export const updateQuiz = (id, quiz) =>
  api.put(`/quizzes/${id}`, quiz);

// Quiz sil (DELETE)
export const deleteQuiz = (id) =>
  api.delete(`/quizzes/${id}`);

// Quiz geçmişi kaydet (bireysel veya canlı, mode parametresi ile)
export const saveQuizHistory = (quizId, data) =>
  api.post(`/quizzes/${quizId}/history`, data);


// --- Canlı Quiz Oturumu Yönetimi (Teacher/Admin için) ---

// Bir quizi canlı oturum olarak başlatır
export const startQuizLive = (quizId) =>
  api.post(`/quizzes/${quizId}/start`);

// Canlı quiz oturumunu sonlandırır
export const endQuizLive = (quizId) =>
  api.post(`/quizzes/${quizId}/end`);


// --- Admin Panel Fonksiyonları ---

// Tüm kullanıcıları getirir (Admin için)
export const getAdminUsers = () =>
  api.get('/admin/users');

// Tüm quizleri getirir (Admin için, genel liste veya detaylı)
export const getAdminQuizzes = () =>
  api.get('/admin/quizzes');

// Genel analiz verilerini getirir (Admin için)
export const getAdminAnalytics = () =>
  api.get('/admin/analytics');

// Admin tarafından bir quizi güncelle (PUT)
export const updateAdminQuiz = (id, quiz) =>
  api.put(`/admin/quiz/${id}`, quiz);

// Admin tarafından bir quizi canlı oturum olarak başlatır
export const startAdminQuizLive = (quizId) => // Tek 'const' kelimesiyle
  api.post(`/admin/quiz/${quizId}/start`);

// Admin tarafından canlı quiz oturumunu sonlandırır
export const endAdminQuizLive = (quizId) =>
  api.post(`/admin/quiz/${quizId}/end`);

// Admin tarafından bir quizi sil (DELETE)
export const deleteAdminQuiz = (id) =>
  api.delete(`/admin/quiz/${id}`);
