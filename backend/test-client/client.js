// client.js - Socket.io Test İstemcisi
const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:5000'; // Backend sunucumuzun adresi

// Önemli: Geçerli bir oyun kodu ve kullanıcı tokenı/misafir kimliği kullanmalısın!
let GAME_CODE = '97F50O'; // Burayı Postman'den aldığın gameCode ile dolduracaksın!
let USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInJvbGUiOiJ0ZWFjaGVyIiwiaWF0IjoxNzQ4NDUwMjMxLCJleHAiOjE3NDg0NTM4MzF9.0mnjspfunJxcYkOV4F55L-jzxz6aDMrujBke28AvQNM'; // Burayı Host (öğretmen) kullanıcının JWT tokenı ile dolduracaksın!
// Veya misafir olarak katılacaksan, USER_TOKEN'ı boş bırakıp GUEST_IDENTIFIER'ı kullan.
// let GUEST_IDENTIFIER = 'MisafirOyunucu1'; 

// Sunucuya Socket.io ile bağlan
const socket = io(SERVER_URL);

socket.on('connect', () => {
    console.log('İstemci Socket.io sunucusuna bağlandı:', socket.id);

    // --- Oyuna Katılma İsteği ---
    socket.emit('joinGame', GAME_CODE, USER_TOKEN, '', (response) => { // Guest identifier boş bırakıldı
        if (response.status === 'success') {
            console.log('Oyuna Katılım Başarılı:', response.message);
            console.log('Oyun Durumu:', response.game);

            // Eğer host tokenı ile katıldıysan, oyunu başlatma isteği gönder
            setTimeout(() => {
                console.log('3 saniye bekledim, oyunu başlatma isteği gönderiliyor (Sadece host tokenı ile!)...');
                socket.emit('startGame', GAME_CODE, USER_TOKEN, (startResponse) => {
                    if (startResponse.status === 'success') {
                        console.log('Oyunu Başlatma Başarılı:', startResponse.message);
                    } else {
                        console.error('Oyunu Başlatma Hatası:', startResponse.message);
                    }
                });
            }, 3000); // 3 saniye bekle

        } else {
            console.error('Oyuna Katılım Hatası:', response.message);
        }
    });
});

// Yeni olay dinleyicileri (sunucudan gelecek)
socket.on('gameStarted', (data) => {
    console.log('--> gameStarted olayı alındı: Oyun başladı!');
    console.log('Oyun Durumu:', data.gameStatus, 'Toplam oyuncu:', data.totalPlayers);
});

socket.on('question', (questionData) => {
    console.log('--> question olayı alındı: Yeni soru geldi!');
    console.log('Soru ID:', questionData.questionId);
    console.log('Soru Metni:', questionData.questionText);
    console.log('Şıklar:', questionData.options);

    // Otomatik olarak doğru cevabı gönder (Test amaçlı, normalde kullanıcı seçer)
    let correctOptionIdForTest = null;
    // Soru ID'si 2 (HTML sorusu) ise cevabı 'A' şıkkı (optionId: 5) olsun.
    // Başka sorular eklediysen veya doğru cevabı bilemeyebiliriz, bu yüzden ilk şıkkı seçelim.
    if (questionData.options.length > 0) {
        // Doğru şıkkı otomatik olarak bulmak için, gameManager'dan doğru cevap ID'sini almalıyız
        // Ancak client'a gönderilen questionData'da correct_answer_option_id yok (güvenlik nedeniyle)
        // Bu yüzden, sadece ilk şıkkı seçelim veya belirli bir soru için önceden bildiğimiz şıkkı seçelim
        // Şimdilik 'A' şıkkını doğru kabul edelim veya rastgele bir şık seçelim.
        // Eğer quizId: 2 için Soru ID: 2 (HTML sorusu) ise A şıkkı (optionId 5)
        if (questionData.questionId === 2) {
             const optionA = questionData.options.find(opt => opt.option_letter === 'A');
             if(optionA) correctOptionIdForTest = optionA.optionId;
        } else if (questionData.questionId === 3) { // JS paradigması sorusu için (Doğru Cevap 'D')
            const optionD = questionData.options.find(opt => opt.option_letter === 'D');
            if(optionD) correctOptionIdForTest = optionD.optionId;
        } else if (questionData.questionId === 4) { // HTTP metodu sorusu için (Doğru Cevap 'C')
            const optionC = questionData.options.find(opt => opt.option_letter === 'C');
            if(optionC) correctOptionIdForTest = optionC.optionId;
        } else if (questionData.questionId === 5) { // SQL komutu sorusu için (Doğru Cevap 'D')
            const optionD = questionData.options.find(opt => opt.option_letter === 'D');
            if(optionD) correctOptionIdForTest = optionD.optionId;
        }
        else if (questionData.options.length > 0) {
            // Eğer diğer sorulardan gelirse ve doğru cevap ID'sini bilmiyorsak ilk şıkkı seçelim
            correctOptionIdForTest = questionData.options[0].optionId;
        }
    }

    if (correctOptionIdForTest) {
        setTimeout(() => { // Soruyu aldıktan 2 saniye sonra cevap gönder
            console.log(`2 saniye bekledim, Cevap gönderiliyor (Soru ID: ${questionData.questionId}, Seçilen Şık ID: ${correctOptionIdForTest})...`);
            socket.emit('submitAnswer', {
                gameCode: GAME_CODE,
                questionId: questionData.questionId,
                submittedOptionId: correctOptionIdForTest,
                submittedTime: Date.now() // YENİ EKLENEN: Cevap gönderim zamanı
            }, (response) => {
                if (response.status === 'success') {
                    console.log('Cevap Gönderme Başarılı:', response.message, 'Doğru:', response.isCorrect, 'Skor:', response.score, 'Kazanılan Puan:', response.pointsEarned); // pointsEarned eklendi
                } else {
                    console.error('Cevap Gönderme Hatası:', response.message);
                }
            });
        }, 2000);
    } else {
        console.log('Cevap göndermek için uygun şık bulunamadı.');
    }
});

// Yeni olay dinleyicileri (sunucudan gelecek)
socket.on('answerSubmitted', (data) => {
    console.log('--> answerSubmitted olayı alındı:', data.username, 'cevap verdi.');
    console.log('Soru ID:', data.questionId, 'Doğru mu:', data.isCorrect, 'Güncel Skor:', data.score, 'Kazanılan Puan:', data.pointsEarned); // pointsEarned eklendi

    // Cevap gönderildikten sonra artık otomatik olarak sonraki soruya geçme isteğini göndermiyoruz.
    // Çünkü sunucu zamanlayıcı (timer) ile otomatik olarak geçecek.
});

// Yeni olay dinleyicisi: Sunucudan timer'ın bittiğini bildiren olay
socket.on('timerEnded', (data) => {
    console.log('--> timerEnded olayı alındı:', data.message);
});


socket.on('gameEnded', (data) => {
    console.log('--> gameEnded olayı alındı: Oyun BİTTİ!');
    console.log('Mesaj:', data.message);
    console.log('Final Skorları:', data.finalScores);
    socket.disconnect();
});

// Diğer olay dinleyicileri
socket.on('playerJoined', (data) => {
    console.log('--> playerJoined olayı alındı:', data.username, 'katıldı. Toplam oyuncu:', data.playersCount);
    console.log('Güncel oyuncular:', data.players);
});

socket.on('playerLeft', (data) => {
    console.log('--> playerLeft olayı alındı:', data.username, 'ayrıldı. Toplam oyuncu:', data.playersCount);
    console.log('Güncel oyuncular:', data.players);
});

socket.on('disconnect', () => {
    console.log('İstemci sunucudan ayrıldı.');
});

socket.on('error', (error) => {
    console.error('Socket.io istemci hatası:', error);
});