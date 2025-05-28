// src/server.js
const express = require('express');
const http = require('http'); // HTTP sunucusu için gerekli
const { Server } = require('socket.io'); // Socket.io Server sınıfını dahil ediyoruz
const dotenv = require('dotenv');
const db = require('./db'); // Veritabanı bağlantı havuzumuz (pool)
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
const gameRoutes = require('./routes/gameRoutes'); // Yeni gameRoutes dosyasını dahil et
const initializeGameManager = require('./gameManager'); // GameManager modülünü dahil et
const jwt = require('jsonwebtoken'); // JWT'yi gameManager'a da göndereceğiz (kullanılmayacak ama parametre olarak geçelim)

dotenv.config(); // .env dosyasındaki çevre değişkenlerini yükle

const app = express(); // Express uygulamasını oluştur
const server = http.createServer(app); // Express uygulamasından bir HTTP sunucusu oluştur

// Socket.io sunucusunu oluştur ve HTTP sunucumuza bağla
// CORS ayarları, React uygulamasının backend'e bağlanabilmesi için gereklidir
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // React uygulamanın çalışacağı adres (şimdilik bu, ileride frontendi kurarken portu ayarlayabiliriz)
        methods: ["GET", "POST"] // İzin verilen HTTP metotları
    }
});

// GameManager'ı başlat ve io, db (pool) ve jwt objelerini ona ilet
// gameManager objesi, aktif oyun oturumlarını ve oyun mantığı fonksiyonlarını yönetecek
const gameManager = initializeGameManager(io, db, jwt);

// gameRoutes'a gameManager örneğini enjekte et
// Bu sayede gameRoutes içinden gameManagerInstance'a erişilebilir ve oyun oluşturma gibi işlemler yapılabilir
gameRoutes.setGameManager(gameManager);


app.use(express.json()); // Gelen isteklerin body kısmını JSON olarak okuyabilmek için middleware


// --- Rota Tanımlamaları ---
console.log('Server Mount Yolu:', '/api/auth'); // Debug logu: Auth rotalarının bağlandığı yolu gösterir

// Auth (Kimlik Doğrulama) rotalarını /api/auth yolu altına ekle
app.use('/api/auth', authRoutes);

// Quiz rotalarını /api/quizzes yolu altına ekle
app.use('/api/quizzes', quizRoutes);

// Oyun rotalarını /api/games yolu altına ekle (Yeni eklenen rota)
app.use('/api/games', gameRoutes);

// Temel endpoint (Sunucunun çalışıp çalışmadığını kontrol etmek için)
app.get('/', function(req, res) {
    res.send('Quiz Platform Backend Çalışıyor!');
});

// --- Socket.io Bağlantılarını Dinleme ---
// Bir istemci (frontend uygulamamız) Socket.io sunucusuna bağlandığında
io.on('connection', (socket) => { // 'socket' o an bağlanan istemciyi temsil eder
    console.log('--- Yeni bir Socket.io istemcisi bağlandı:', socket.id);

    // İstemci bağlantısı kesildiğinde
    socket.on('disconnect', () => {
        console.log('--- Bir Socket.io istemcisi bağlantısı kesildi:', socket.id);
    });

    // Burada gameManager'daki oyun içi olay dinleyicileri aktif olacak
    // (gameManager.js içinde zaten io.on('connection') var)
});
// --- Socket.io Bağlantılarını Dinleme Son ---


const PORT = process.env.PORT || 5000; // Sunucunun çalışacağı port (varsayılan 5000)

// Express uygulamasını başlatmak için app.listen yerine server.listen kullanıyoruz
server.listen(PORT, function() { // Normal fonksiyon gösterimi
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
    // Veritabanı bağlantı testi (db.js içinde) sunucu başlamadan önce veya başlarken görünebilir.
});