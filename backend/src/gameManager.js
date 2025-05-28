// src/gameManager.js
// db bağlantısı (pool) ve jwt objelerini dışarıdan alacağız
function initializeGameManager(io, pool, jwt) { // Normal fonksiyon gösterimi, pool ve jwt eklendi
    console.log('Game Manager başlatılıyor...');

    const activeGames = {}; // Aktif oyun oturumlarını saklayacağımız obje

    // Yardımcı fonksiyon: Benzersiz 6 haneli bir oyun kodu oluşturur
    async function generateUniqueGameCode() { // Normal fonksiyon gösterimi, async yapıldı
        let code = '';
        let isUnique = false;
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const charactersLength = characters.length;

        while (!isUnique) {
            code = ''; // Her döngüde kodu sıfırla
            for (let i = 0; i < 6; i++) {
                code += characters.charAt(Math.floor(Math.random() * charactersLength));
            }

            // 1. activeGames objesinde var mı kontrol et
            if (activeGames[code]) {
                console.log(`DEBUG: generateUniqueGameCode - Kod ${code} bellekte mevcut, tekrar deniyor.`);
                continue; // Varsa yeniden dene
            }

            // 2. Veritabanında game_sessions tablosunda var mı kontrol et
            try {
                const [rows] = await pool.query('SELECT id FROM game_sessions WHERE session_code = ?', [code]);
                if (rows.length === 0) {
                    isUnique = true; // Hem bellekte hem DB'de yoksa benzersizdir
                    console.log(`DEBUG: generateUniqueGameCode - Kod ${code} benzersiz bulundu.`);
                } else {
                    console.log(`DEBUG: generateUniqueGameCode - Kod ${code} DB'de mevcut, tekrar deniyor.`);
                }
            } catch (error) {
                console.error('ERROR: generateUniqueGameCode - Benzersiz kod kontrolü DB hatası:', error);
                throw new Error('Benzersiz oyun kodu oluşturulurken hata oluştu.'); // DB hatasında fırlat
            }
        }
        return code;
    }


    const QUESTION_TIME_LIMIT = 20; // Soru başına saniye cinsinden süre sınırı (20 saniye örnek)
    const MAX_QUESTION_POINTS = 1000; // Her soru için maksimum alınabilecek puan


    // Oyunun zamanlayıcısını yönetecek bir fonksiyon (içinde timerId tutulacak)
    function startQuestionTimer(gameCode) { // Normal fonksiyon gösterimi
        const game = activeGames[gameCode];
        if (!game) {
            console.error(`ERROR: startQuestionTimer - Oyun ${gameCode} bulunamadı.`);
            return;
        }

        // Önceki zamanlayıcı varsa temizle
        if (game.questionTimerId) {
            clearTimeout(game.questionTimerId);
            console.log(`DEBUG: startQuestionTimer - Önceki zamanlayıcı temizlendi: ${gameCode}`);
        }

        // --- Yeni Ekleme: Soru başlangıç zamanını kaydet ---
        game.currentQuestionStartTime = Date.now(); // Sorunun başladığı anki zaman damgası
        // --- Yeni Ekleme Son ---

        console.log(`Game Manager: ${gameCode} için ${QUESTION_TIME_LIMIT} saniyelik zamanlayıcı başladı. (Soru İndeksi: ${game.currentQuestionIndex})`);

        // Süre dolduğunda nextQuestion olayını tetikle
        game.questionTimerId = setTimeout(async () => {
            console.log(`DEBUG: startQuestionTimer - Süre doldu. ${gameCode} için otomatik geçiş tetikleniyor.`);
            try {
                await processNextQuestion(gameCode, game.hostId, true); // hostId'yi geçiyoruz, true: otomatik geçiş
                io.to(gameCode).emit('timerEnded', { message: 'Süre doldu, sonraki soruya geçildi!' }); // Clientlara bildir
                console.log(`DEBUG: startQuestionTimer - Otomatik geçiş başarılı ve 'timerEnded' yayınlandı.`);
            } catch (error) {
                console.error(`ERROR: startQuestionTimer - ${gameCode} otomatik geçiş sırasında hata:`, error.message);
                io.to(gameCode).emit('gameError', { message: 'Otomatik geçiş sırasında hata oluştu.' });
            } finally {
                game.questionTimerId = null; // Zamanlayıcıyı sıfırla
            }
        }, QUESTION_TIME_LIMIT * 1000); // Milisaniyeye çevir
    }

    function stopQuestionTimer(gameCode) { // Normal fonksiyon gösterimi
        const game = activeGames[gameCode];
        if (game && game.questionTimerId) {
            clearTimeout(game.questionTimerId);
            game.questionTimerId = null;
            console.log(`Game Manager: ${gameCode} için zamanlayıcı durduruldu.`);
        } else {
            console.log(`DEBUG: stopQuestionTimer - ${gameCode} için durdurulacak aktif zamanlayıcı yok.`);
        }
    }

    // nextQuestion ve startGame içinde ortak kullanılacak mantık (soru ilerleme)
    async function processNextQuestion(gameCode, userId, isAuto = false) { // Normal fonksiyon gösterimi
        console.log(`DEBUG: processNextQuestion çağrıldı. Kod: ${gameCode}, UserID: ${userId}, Otomatik: ${isAuto}`);
        const game = activeGames[gameCode];
        if (!game) {
            console.error(`ERROR: processNextQuestion - Oyun ${gameCode} bulunamadı.`);
            throw new Error('Oyun bulunamadı.');
        }

        // Host'un kimliğini ve yetkisini doğrula (startGame ve nextQuestion olaylarından çağrıldığında)
        if (!isAuto) { // Eğer otomatik geçiş değilse (manuel tetikleme)
            console.log(`DEBUG: processNextQuestion - Manuel geçiş, yetki kontrolü yapılıyor.`);
            if (userId !== game.hostId && (game.players.find(p => p.userId === userId && p.role === 'admin') === undefined)) {
                 console.error(`ERROR: processNextQuestion - Yetki yok. UserID: ${userId}, GameHostID: ${game.hostId}`);
                 throw new Error('Bu işlemi yapmak için yetkiniz yok.');
            }
        } else {
            console.log(`DEBUG: processNextQuestion - Otomatik geçiş.`);
        }


        stopQuestionTimer(gameCode); // Önceki zamanlayıcıyı durdur (emin olmak için)
        game.currentQuestionIndex++; // Soru indeksini artır


        if (game.currentQuestionIndex < game.quizQuestions.length) {
            console.log(`DEBUG: processNextQuestion - Sonraki soru mevcut. Index: ${game.currentQuestionIndex}`);
            const nextQuestion = game.quizQuestions[game.currentQuestionIndex];
            const questionToSend = {
                questionId: nextQuestion.questionId,
                questionText: nextQuestion.questionText,
                questionType: nextQuestion.questionType,
                options: nextQuestion.options.map(option => ({
                    optionId: option.optionId,
                    option_letter: option.option_letter,
                    option_text: option.option_text
                })),
                startTime: Date.now() // YENİ EKLENEN: Sorunun başlangıç zamanı
            };
            // --- Yeni Ekleme: Soru başlangıç zamanını game objesine kaydet ---
            game.currentQuestionStartTime = questionToSend.startTime;
            // --- Yeni Ekleme Son ---

            io.to(gameCode).emit('question', questionToSend);
            console.log(`Game Manager: Oyun ${gameCode} - Sonraki soru (${game.currentQuestionIndex + 1}/${game.quizQuestions.length}) gönderildi.`);
            startQuestionTimer(gameCode); // Yeni soru için zamanlayıcıyı başlat
            console.log(`DEBUG: processNextQuestion - Yeni soru için zamanlayıcı başlatıldı.`);

            return { message: 'Sonraki soru başarıyla gönderildi!', currentQuestionIndex: game.currentQuestionIndex };

        } else {
            console.log(`DEBUG: processNextQuestion - Tüm sorular bitti. Oyunu sonlandırıyor.`);
            game.status = 'completed';
            game.completed_at = new Date();

            const finalScores = game.players.map(player => ({
                userId: player.userId,
                username: player.username,
                score: player.score
            })).sort((a, b) => b.score - a.score);

            io.to(gameCode).emit('gameEnded', {
                message: 'Oyun tamamlandı!',
                finalScores: finalScores,
                gameStatus: game.status
            });

            console.log(`Game Manager: Oyun ${gameCode} tamamlandı. Final skorları gönderildi.`);
            try {
                await pool.query('UPDATE game_sessions SET status = ?, completed_at = ? WHERE id = ?',
                    [game.status, game.completed_at, game.sessionId]
                );
                console.log(`DEBUG: processNextQuestion - DB'de oyun durumu güncellendi.`);
            } catch (dbError) {
                console.error('ERROR: Game Manager - Oyun durumu güncellenirken DB hatası:', dbError);
            }

            return { message: 'Oyun başarıyla tamamlandı!', gameStatus: game.status, finalScores: finalScores };
        }
    }


    io.on('connection', (socket) => {
        console.log(`--- Yeni bir Socket.io istemcisi bağlandı: ${socket.id}`);

        // DEBUG LOG: Gelen tüm olayları loglamak için (geçici)
        socket.onAny((event, ...args) => {
            console.log(`DEBUG: Socket ${socket.id} - Olay Alındı: ${event}`, args);
        });

        // Oyuncunun bir oyun odasına katılma isteği
        socket.on('joinGame', async (gameCode, token, guestIdentifier, callback) => {
            console.log(`Socket ${socket.id} - 'joinGame' isteği: Kod ${gameCode}`);
            const game = activeGames[gameCode];

            if (!game) {
                if (callback) callback({ status: 'error', message: 'Oyun bulunamadı.' });
                return;
            }

            let userId = null;
            let username = 'Misafir';
            let userRole = 'player';

            console.log('DEBUG: joinGame - Token:', token ? 'Var' : 'Yok', 'Guest ID:', guestIdentifier ? 'Var' : 'Yok');

            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    userId = decoded.userId;
                    userRole = decoded.role;

                    console.log('DEBUG: joinGame - Token doğrulandı. User ID:', userId, 'Role:', userRole);

                    const [users] = await pool.query('SELECT username, email FROM users WHERE id = ?', [userId]);
                    if (users.length > 0) {
                        username = users[0].username || users[0].email.split('@')[0];
                    }
                    console.log('DEBUG: joinGame - DB\'den kullanıcı bilgisi çekildi:', username);
                } catch (error) {
                    console.error(`ERROR: Socket ${socket.id} - Token doğrulama hatası (joinGame):`, error.message);
                    if (callback) callback({ status: 'error', message: 'Token geçersiz veya süresi dolmuş.' });
                    return;
                }
            } else if (guestIdentifier) {
                username = guestIdentifier;
                console.log('DEBUG: joinGame - Misafir olarak katılıyor:', username);
            } else {
                console.log('DEBUG: joinGame - Token veya misafir kimliği sağlanmadı.');
                if (callback) callback( { status: 'error', message: 'Token veya misafir kimliği bulunamadı.' });
                return;
            }

            const existingPlayer = game.players.find(p => p.socketId === socket.id || (userId && p.userId === userId));
            if (existingPlayer) {
                console.log('DEBUG: joinGame - Oyuncu zaten oyunda.');
                if (callback) callback({ status: 'error', message: 'Zaten oyundasınız.' });
                return;
            }

            const player = {
                socketId: socket.id,
                userId: userId,
                username: username,
                role: userRole,
                score: 0
            };
            game.players.push(player);
            console.log('DEBUG: joinGame - Oyuncu game.players listesine eklendi.');

            socket.join(gameCode);
            console.log('DEBUG: joinGame - Socket.io odasına katıldı.');


            console.log(`Game Manager: ${username} (Socket ID: ${socket.id}) ${gameCode} odasına katıldı.`);

            io.to(gameCode).emit('playerJoined', {
                socketId: player.socketId,
                username: player.username,
                role: player.role,
                score: player.score,
                playersCount: game.players.length,
                players: game.players
            });
            console.log('DEBUG: joinGame - \'playerJoined\' olayı yayınlandı.');


            if (callback) callback({ status: 'success', message: 'Oyun odasına başarıyla katıldınız!', game: game });
            console.log('DEBUG: joinGame - Callback çağrıldı.');
        });

        // Host'un oyunu başlatma isteği
        socket.on('startGame', async function(gameCode, token, callback) { // Normal fonksiyon gösterimi
            console.log(`Socket ${socket.id} - 'startGame' isteği: Kod ${gameCode}`);
            const game = activeGames[gameCode];

            console.log(`DEBUG_SG: Oyun objesi (${gameCode}):`, game ? 'Bulundu' : 'Bulunamadı');

            if (!game) {
                if (callback) callback({ status: 'error', message: 'Oyun bulunamadı.' });
                return;
            }

            let hostUserId = null;
            console.log('DEBUG_SG: Token değeri:', token ? 'Var' : 'Yok');

            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    hostUserId = decoded.userId;
                    console.log('DEBUG_SG: Token doğrulandı. HostUser ID:', hostUserId, 'Rol:', decoded.role);
                    console.log('DEBUG_SG: Game Host ID:', game.hostId);

                    if (hostUserId !== game.hostId && decoded.role !== 'admin') {
                        console.log('DEBUG_SG: Yetkilendirme hatası - Role veya ID eşleşmiyor.');
                        if (callback) callback({ status: 'error', message: 'Oyunu başlatmak için yetkiniz yok.' });
                        return;
                    }
                } catch (error) {
                    console.error(`ERROR: Socket ${socket.id} - Token doğrulama hatası (startGame):`, error.message);
                    if (callback) callback({ status: 'error', message: 'Token geçersiz veya süresi dolmuş.' });
                    return;
                }
            } else {
                console.log('DEBUG_SG: Token sağlanmadı.');
                if (callback) callback({ status: 'error', message: 'Oyunu başlatmak için token gerekli.' });
                return;
            }

            console.log('DEBUG_SG: Oyun durumu:', game.status);
            console.log('DEBUG_SG: Soru sayısı:', game.quizQuestions ? game.quizQuestions.length : 'Yok');

            if (game.status !== 'waiting') {
                if (callback) callback({ status: 'error', message: 'Oyun zaten başladı veya bitti.' });
                return;
            }

            if (!game.quizQuestions || game.quizQuestions.length === 0) {
                if (callback) callback({ status: 'error', message: 'Bu quiz için soru bulunamadı.' });
                return;
            }

            console.log('DEBUG_SG: Tüm başlangıç kontrolleri geçti. processNextQuestion çağrılıyor...');


            game.status = 'in_progress';
            game.currentQuestionIndex = -1;
            game.started_at = new Date();

            io.to(gameCode).emit('gameStarted', {
                message: 'Oyun başladı!',
                gameStatus: game.status,
                currentQuestionIndex: game.currentQuestionIndex,
                totalPlayers: game.players.length
            });
            console.log('DEBUG_SG: \'gameStarted\' olayı yayınlandı.');


            try {
                const response = await processNextQuestion(gameCode, hostUserId);
                console.log('DEBUG_SG: processNextQuestion çağrıldı, yanıt:', response);
                if (callback) callback({ status: 'success', message: 'Oyun başarıyla başlatıldı!', gameStatus: game.status, currentQuestionIndex: response.currentQuestionIndex });
            } catch (error) {
                console.error(`ERROR: Game Manager: ${gameCode} ilk soru gönderme sırasında hata:`, error.message);
                if (callback) callback({ status: 'error', message: error.message || 'Oyun başlatılamadı.' });
            }
        });

        // Oyuncunun cevap gönderme isteği (submitAnswer)
        socket.on('submitAnswer', async function(data, callback) { // Normal fonksiyon gösterimi
            console.log(`Socket ${socket.id} - 'submitAnswer' isteği:`, data);
            const { gameCode, questionId, submittedOptionId, submittedTime } = data; // submittedTime eklendi
            const game = activeGames[gameCode];

            if (!game) {
                if (callback) callback({ status: 'error', message: 'Oyun bulunamadı.' });
                return;
            }

            const player = game.players.find(p => p.socketId === socket.id);
            if (!player) {
                if (callback) callback({ status: 'error', message: 'Oyunda değilsiniz.' });
                return;
            }

            // Cevabın şu anki soruya mı ait olduğunu kontrol et
            if (game.currentQuestionIndex === -1 || questionId !== game.quizQuestions[game.currentQuestionIndex].questionId) {
                if (callback) callback({ status: 'error', message: 'Şu an bu soruya cevap veremezsiniz.' });
                return;
            }

            const currentQuestion = game.quizQuestions[game.currentQuestionIndex];
            let isCorrect = false;
            let pointsEarned = 0; // Kazanılan puan

            // Cevabı doğru mu diye kontrol et
            if (currentQuestion.correct_answer_option_id === submittedOptionId) {
                isCorrect = true;
                // --- Puan Hesaplama (Hıza Göre) ---
                const timeTakenMs = submittedTime - game.currentQuestionStartTime;
                const timeRemaining = (QUESTION_TIME_LIMIT * 1000) - timeTakenMs;

                if (timeRemaining > 0) { // Süre dolmadan cevaplandıysa
                    pointsEarned = Math.round(MAX_QUESTION_POINTS * (timeRemaining / (QUESTION_TIME_LIMIT * 1000)));
                    // Minimum puan 100 veya 1 olabilir, 0'dan büyük olsun
                    if (pointsEarned < 50) pointsEarned = 50; // Minimum 50 puan
                } else {
                    pointsEarned = 0; // Süre dolduysa puan yok
                }
                player.score += pointsEarned;
                // --- Puan Hesaplama Son ---

            } else {
                // Yanlış cevapta puan yok (veya negatif puan eklenebilir)
                pointsEarned = 0;
            }


            let connection;

            try {
                connection = await pool.getConnection();
                await connection.beginTransaction();

                const [participantRows] = await connection.query(
                    'SELECT id, score FROM session_participants WHERE session_id = ? AND (user_id = ? OR guest_identifier = ?)',
                    [game.sessionId, player.userId, player.userId ? null : player.username]
                );

                let participantId = null;
                if (participantRows.length > 0) {
                    participantId = participantRows[0].id;
                } else {
                    const [newParticipantResult] = await connection.query(
                        'INSERT INTO session_participants (session_id, user_id, guest_identifier, score) VALUES (?, ?, ?, ?)',
                        [game.sessionId, player.userId, player.userId ? null : player.username, player.score]
                    );
                    participantId = newParticipantResult.insertId;
                }

                const [existingAnswer] = await connection.query(
                    'SELECT id FROM player_answers WHERE participant_id = ? AND question_id = ?',
                    [participantId, questionId]
                );
                if (existingAnswer.length > 0) {
                    console.log(`DEBUG: Game Manager: Oyuncu ${player.username} zaten ${questionId} sorusuna cevap vermiş.`);
                    await connection.rollback();
                    if (callback) callback({ status: 'error', message: 'Bu soruya zaten cevap verdiniz.' });
                    return;
                }

                await connection.query(
                    'INSERT INTO player_answers (participant_id, question_id, submitted_option_id, is_correct, points_earned) VALUES (?, ?, ?, ?, ?)', // points_earned eklendi
                    [participantId, questionId, submittedOptionId, isCorrect, pointsEarned]
                );
                console.log(`DEBUG: Game Manager: Player answer kaydedildi.`);

                await connection.query(
                    'UPDATE session_participants SET score = ? WHERE id = ?',
                    [player.score, participantId]
                );
                console.log(`DEBUG: Game Manager: Participant score DB'de güncellendi.`);


                await connection.commit();

                console.log(`Game Manager: ${player.username} - Soru ${questionId} için cevap gönderdi. Doğru: ${isCorrect}. Kazanılan Puan: ${pointsEarned}. Yeni Skor: ${player.score}`);

                io.to(gameCode).emit('answerSubmitted', {
                    socketId: player.socketId,
                    questionId: questionId,
                    isCorrect: isCorrect,
                    score: player.score,
                    pointsEarned: pointsEarned, // Yeni eklenen
                    username: player.username
                });
                console.log(`DEBUG: Game Manager: 'answerSubmitted' olayı yayınlandı.`);


                if (callback) callback({ status: 'success', message: 'Cevap başarıyla gönderildi!', isCorrect: isCorrect, score: player.score, pointsEarned: pointsEarned });
                console.log('DEBUG: submitAnswer - Callback çağrıldı.');


            } catch (error) {
                if (connection) await connection.rollback();
                console.error('ERROR: Game Manager - Cevap gönderme sırasında hata:', error);
                if (callback) callback({ status: 'error', message: 'Cevap kaydedilirken sunucu hatası.' });
            } finally {
                if (connection) connection.release();
                console.log('DEBUG: submitAnswer - Veritabanı bağlantısı havuza geri verildi.');
            }
        });

        // Host'un bir sonraki soruya geçme isteği (nextQuestion)
        socket.on('nextQuestion', async function(gameCode, token, callback) { // Normal fonksiyon gösterimi
            console.log(`Socket ${socket.id} - 'nextQuestion' isteği: Kod ${gameCode}`);
            const game = activeGames[gameCode];

            if (!game) {
                if (callback) callback({ status: 'error', message: 'Oyun bulunamadı.' });
                return;
            }

            // Host'un kimliğini doğrula (startGame'deki gibi)
            let hostUserId = null;
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    hostUserId = decoded.userId;
                    if (hostUserId !== game.hostId && decoded.role !== 'admin') {
                        if (callback) callback({ status: 'error', message: 'Bu işlemi yapmak için yetkiniz yok.' });
                        return;
                    }
                } catch (error) {
                    console.error(`ERROR: Socket ${socket.id} - Token doğrulama hatası (nextQuestion):`, error.message);
                    if (callback) callback({ status: 'error', message: 'Token geçersiz veya süresi dolmuş.' });
                    return;
                }
            } else {
                if (callback) callback({ status: 'error', message: 'Bu işlemi yapmak için token gerekli.' });
                return;
            }

            // Oyunun durumunu kontrol et
            if (game.status !== 'in_progress') {
                if (callback) callback({ status: 'error', message: 'Oyun şu anda devam etmiyor.' });
                return;
            }
            console.log('DEBUG: nextQuestion - Tüm başlangıç kontrolleri geçti. processNextQuestion çağrılıyor...');

            // Bir sonraki soru indeksini artır
            try {
                const response = await processNextQuestion(gameCode, hostUserId);
                console.log('DEBUG: nextQuestion - processNextQuestion çağrıldı, yanıt:', response);
                if (callback) callback({ status: 'success', message: response.message, currentQuestionIndex: response.currentQuestionIndex, gameStatus: response.gameStatus });
            } catch (error) {
                console.error(`ERROR: Game Manager: ${gameCode} sonraki soruya geçme sırasında hata:`, error.message);
                if (callback) callback({ status: 'error', message: error.message || 'Sonraki soruya geçilemedi.' });
            }
        });

        // Disconnect (bağlantı kesilmesi) olayı
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
            const gameCode = await generateUniqueGameCode(); // generateUniqueGameCode çağrıldı

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
                            option_text: row.option_text // Burası düzeltildi
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
                console.error('ERROR: Game Manager - Oyun oluşturma sırasında hata:', error); // ERROR eklendi
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