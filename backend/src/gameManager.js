// src/gameManager.js
// db bağlantısı (pool) ve jwt objelerini dışarıdan alacağız
function initializeGameManager(io, pool, jwt) { // Normal fonksiyon gösterimi, pool ve jwt eklendi
    console.log('Game Manager başlatılıyor...');

    const activeGames = {}; // Aktif oyun oturumlarını saklayacağımız obje

    // Yardımcı fonksiyon: Benzersiz 6 haneli bir oyun kodu oluşturur
    function generateGameCode() { // Normal fonksiyon gösterimi
        let code = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const charactersLength = characters.length;
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        // TODO: Kodu veritabanında veya activeGames içinde zaten var mı diye kontrol et (çakışma ihtimali çok düşük ama mümkün)
        return code;
    }

    // --- Socket.io Olay Dinleyicileri ---
    io.on('connection', (socket) => { // 'socket' o an bağlanan istemciyi temsil eder
        console.log(`--- Yeni bir Socket.io istemcisi bağlandı: ${socket.id}`);

        // Oyuncunun bir oyun odasına katılma isteği
        socket.on('joinGame', async (gameCode, token, guestIdentifier, callback) => { // token ve guestIdentifier eklendi
            console.log(`Socket ${socket.id} - 'joinGame' isteği: Kod ${gameCode}`);
            const game = activeGames[gameCode];

            if (!game) {
                if (callback) callback({ status: 'error', message: 'Oyun bulunamadı.' });
                return;
            }

            let userId = null;
            let username = 'Misafir'; // Varsayılan misafir kullanıcı adı
            let userRole = 'player'; // Varsayılan misafir rolü

            // Eğer token varsa, kullanıcıyı doğrula
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    userId = decoded.userId;
                    userRole = decoded.role;

                    // Kullanıcı bilgilerini DB'den çekelim (username/email için)
                    const [users] = await pool.query('SELECT username, email FROM users WHERE id = ?', [userId]);
                    if (users.length > 0) {
                        username = users[0].username || users[0].email.split('@')[0]; // Kullanıcı adı yoksa e-postadan al
                    }
                } catch (error) {
                    console.error(`Socket ${socket.id} - Token doğrulama hatası (joinGame):`, error.message);
                    if (callback) callback({ status: 'error', message: 'Token geçersiz veya süresi dolmuş.' });
                    return;
                }
            } else if (guestIdentifier) {
                username = guestIdentifier; // Misafir kimliğini kullanıcı adı olarak kullan
            } else {
                if (callback) callback( { status: 'error', message: 'Token veya misafir kimliği bulunamadı.' });
                return;
            }

            // Oyuncunun zaten katılmış olup olmadığını kontrol et
            const existingPlayer = game.players.find(p => p.socketId === socket.id || (userId && p.userId === userId));
            if (existingPlayer) {
                if (callback) callback({ status: 'error', message: 'Zaten oyundasınız.' });
                return;
            }

            // Oyuncuyu oyun odasına ekle
            const player = {
                socketId: socket.id,
                userId: userId, // Giriş yapmışsa user ID, yoksa null
                username: username,
                role: userRole,
                score: 0
            };
            game.players.push(player);

            // Oyuncuyu Socket.io odasına dahil et (bu odaya mesaj gönderebiliriz)
            socket.join(gameCode);

            console.log(`Game Manager: ${username} (Socket ID: ${socket.id}) ${gameCode} odasına katıldı.`);

            // Diğer oyunculara yeni oyuncunun katıldığını bildir
            io.to(gameCode).emit('playerJoined', {
                socketId: player.socketId,
                username: player.username,
                role: player.role,
                score: player.score,
                playersCount: game.players.length,
                players: game.players // Tüm oyuncu listesini de gönderebiliriz
            });

            // Katılan oyuncuya oyun durumu hakkında bilgi gönder
            // host'a ve yeni katılan oyuncuya oyunun mevcut durumunu gönder
            if (callback) callback({ status: 'success', message: 'Oyun odasına başarıyla katıldınız!', game: game });
        });

        // Host'un oyunu başlatma isteği
        // 'startGame' olayı, oyun kodu ve (isteğe bağlı) host'un token'ı ile tetiklenir
        socket.on('startGame', async function(gameCode, token, callback) { // Normal fonksiyon gösterimi
            console.log(`Socket ${socket.id} - 'startGame' isteği: Kod ${gameCode}`);
            const game = activeGames[gameCode];

            if (!game) {
                if (callback) callback({ status: 'error', message: 'Oyun bulunamadı.' });
                return;
            }

            // Host'un kimliğini doğrula ve oyunun sahibi olup olmadığını kontrol et
            let hostUserId = null;
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    hostUserId = decoded.userId;
                    // Eğer host'un ID'si, oyunun host ID'si ile eşleşmiyorsa ve host admin değilse yetkisizdir
                    if (hostUserId !== game.hostId && decoded.role !== 'admin') {
                        if (callback) callback({ status: 'error', message: 'Oyunu başlatmak için yetkiniz yok.' });
                        return;
                    }
                } catch (error) {
                    console.error(`Socket ${socket.id} - Token doğrulama hatası (startGame):`, error.message);
                    if (callback) callback({ status: 'error', message: 'Token geçersiz veya süresi dolmuş.' });
                    return;
                }
            } else {
                if (callback) callback({ status: 'error', message: 'Oyunu başlatmak için token gerekli.' });
                return;
            }


            // Oyun zaten başlamışsa veya bitmişse tekrar başlatma
            if (game.status !== 'waiting') {
                if (callback) callback({ status: 'error', message: 'Oyun zaten başladı veya bitti.' });
                return;
            }

            // Quiz soruları yoksa oyunu başlatma
            if (!game.quizQuestions || game.quizQuestions.length === 0) {
                if (callback) callback({ status: 'error', message: 'Bu quiz için soru bulunamadı.' });
                return;
            }

            // Oyunun durumunu 'in_progress' olarak güncelle
            game.status = 'in_progress';
            game.currentQuestionIndex = 0; // İlk sorudan başla
            game.started_at = new Date(); // Oyunun başlama zamanı

            // Tüm oyunculara oyunun başladığını bildir
            io.to(gameCode).emit('gameStarted', {
                message: 'Oyun başladı!',
                gameStatus: game.status,
                currentQuestionIndex: game.currentQuestionIndex,
                totalPlayers: game.players.length
            });

            // İlk soruyu tüm oyunculara gönder
            const firstQuestion = game.quizQuestions[0];
            // Doğru cevabı göndermeden soruları oyunculara yay yayınlayalım (Güvenlik için)
            const questionToSend = {
                questionId: firstQuestion.questionId,
                questionText: firstQuestion.questionText,
                questionType: firstQuestion.questionType,
                options: firstQuestion.options.map(opt => ({
                    optionId: opt.optionId,
                    option_letter: opt.option_letter,
                    option_text: opt.option_text
                }))
            };
            io.to(gameCode).emit('question', questionToSend);

            console.log(`Game Manager: Oyun ${gameCode} başlatıldı. İlk soru gönderildi.`);

            if (callback) callback({ status: 'success', message: 'Oyun başarıyla başlatıldı!', gameStatus: game.status });
        });

        // Oyuncunun cevap gönderme isteği (submitAnswer) aynı kalacak şimdilik.
        socket.on('submitAnswer', (data, callback) => {
            console.log(`Socket ${socket.id} - 'submitAnswer' isteği:`, data);
            // TODO: Cevabı doğrula, puanı hesapla, kaydet
            if (callback) callback({ status: 'success', message: 'Cevap gönderim isteği alındı (henüz tam implemente edilmedi).' });
        });


        // Host'un bir sonraki soruya geçme isteği (nextQuestion) aynı kalacak şimdilik.
        socket.on('nextQuestion', (gameCode, callback) => {
            console.log(`Socket ${socket.id} - 'nextQuestion' isteği: Kod ${gameCode}`);
            // TODO: Bir sonraki soruyu gönder
            if (callback) callback({ status: 'success', message: 'Sonraki soruya geçme isteği alındı (henüz tam implemente edilmedi).' });
        });

        // Disconnect (bağlantı kesilmesi) olayı aynı kalacak şimdilik.
        socket.on('disconnect', () => {
            console.log(`--- Bir Socket.io istemcisi bağlantısı kesildi: ${socket.id}`);
            // Disconnect olan oyuncuyu aktif oyunlardan çıkar
            for (const gameCode in activeGames) {
                const game = activeGames[gameCode];
                const disconnectedPlayerIndex = game.players.findIndex(p => p.socketId === socket.id);
                if (disconnectedPlayerIndex !== -1) {
                    const disconnectedPlayer = game.players.splice(disconnectedPlayerIndex, 1)[0];
                    console.log(`Game Manager: ${disconnectedPlayer.username} (${disconnectedPlayer.socketId}) ${gameCode} odasından ayrıldı.`);
                    io.to(gameCode).emit('playerLeft', {
                        socketId: disconnectedPlayer.socketId,
                        username: disconnectedPlayer.username,
                        playersCount: game.players.length,
                        players: game.players
                    });
                    break;
                }
            }
        });
    });
    // --- Socket.io Olay Dinleyicileri Son ---

    // Oyun odalarını ve durumlarını yönetmek için yardımcı fonksiyonlar
    return {
        createGame: async function(quizId, hostId) { // Normal fonksiyon gösterimi
            console.log(`Game Manager: Yeni oyun oluşturuluyor - Quiz ID: ${quizId}, Host ID: ${hostId}`);
            const gameCode = generateGameCode(); // Benzersiz kodu oluştur

            try {
                // Veritabanından quiz sorularını çek (oyun başladığında göndermek için)
                const [quizQuestionsData] = await pool.query(`
                    SELECT
                        q.id AS questionId,
                        q.text AS questionText,
                        q.type AS questionType,
                        q.correct_answer_option_id,
                        ao.id AS optionId,
                        ao.option_letter,
                        ao.option_text
                    FROM questions q
                    LEFT JOIN answer_options ao ON q.id = ao.question_id
                    WHERE q.quiz_id = ?
                    ORDER BY q.id, ao.option_letter
                `, [quizId]);

                // Çekilen veriyi yapılandır (her sorunun altında şıkları dizi olarak)
                const quizQuestions = [];
                let currentQuestion = null;
                quizQuestionsData.forEach(row => {
                    if (!currentQuestion || currentQuestion.questionId !== row.questionId) {
                        if (currentQuestion) { quizQuestions.push(currentQuestion); }
                        currentQuestion = {
                            questionId: row.questionId,
                            questionText: row.questionText,
                            questionType: row.questionType,
                            correct_answer_option_id: row.correct_answer_option_id,
                            options: []
                        };
                    }
                    if (row.optionId) {
                        currentQuestion.options.push({
                            optionId: row.optionId,
                            option_letter: row.option_letter,
                            option_text: row.option_text
                        });
                    }
                });
                if (currentQuestion) { quizQuestions.push(currentQuestion); }


                // Veritabanına yeni bir oyun oturumu kaydet
                const [result] = await pool.query(
                    'INSERT INTO game_sessions (quiz_id, host_user_id, session_code, status) VALUES (?, ?, ?, ?)',
                    [quizId, hostId, gameCode, 'waiting']
                );

                const newSessionId = result.insertId;

                // activeGames objesine yeni oyun oturumunu ekle (gerçek zamanlı takip için)
                activeGames[gameCode] = {
                    sessionId: newSessionId,
                    quizId: quizId,
                    hostId: hostId,
                    gameCode: gameCode,
                    players: [],
                    currentQuestionIndex: -1,
                    scores: {},
                    status: 'waiting',
                    quizQuestions: quizQuestions // Quiz soruları yüklendi
                };

                return { status: 'success', gameCode: gameCode, game: activeGames[gameCode] };

            } catch (error) {
                console.error('Game Manager - Oyun oluşturma hatası:', error);
                throw new Error('Oyun oluşturulamadı.');
            }
        },
        getGame: function(gameCode) { // Normal fonksiyon gösterimi
            return activeGames[gameCode];
        },
        // Diğer yönetim fonksiyonları (örneğin oyunu bitir, oyuncu çıkar vb.)
    };
}

module.exports = initializeGameManager; // Modülü dışa aktarıyoruz