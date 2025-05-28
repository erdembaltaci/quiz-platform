// client.js - Socket.io Test İstemcisi
const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:5000'; // Backend sunucumuzun adresi

// Önemli: Geçerli bir oyun kodu ve kullanıcı tokenı/misafir kimliği kullanmalısın!
// Bu bilgileri, oyun oturumu oluşturduktan ve giriş yaptıktan sonra almalısın.
let GAME_CODE = '8H4OFW'; // Burayı Postman'den aldığın gameCode ile dolduracaksın!
let USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInJvbGUiOiJ0ZWFjaGVyIiwiaWF0IjoxNzQ4NDI3MjY3LCJleHAiOjE3NDg0MzA4Njd9.7Vy-N28IzOPwyVtLmCKmJsL0gj4Fc7krzY9ZoBYbigg'; // Burayı Host (öğretmen) kullanıcının JWT tokenı ile dolduracaksın!
// Veya misafir olarak katılacaksan, USER_TOKEN'ı boş bırakıp GUEST_IDENTIFIER'ı kullan.
// let GUEST_IDENTIFIER = 'MisafirOyunucu1'; 

// Sunucuya Socket.io ile bağlan
const socket = io(SERVER_URL);

socket.on('connect', () => {
    console.log('İstemci Socket.io sunucusuna bağlandı:', socket.id);

    // --- Oyuna Katılma İsteği ---
    // Oluşturduğun bir oyun kodunu ve tokenını/misafir kimliğini kullanarak joinGame olayını tetikle
    socket.emit('joinGame', GAME_CODE, USER_TOKEN, '', (response) => { // Guest identifier boş bırakıldı
        if (response.status === 'success') {
            console.log('Oyuna Katılım Başarılı:', response.message);
            console.log('Oyun Durumu:', response.game);

            // Eğer host tokenı ile katıldıysan, oyunu başlatma isteği gönder
            // Bu sadece test amaçlıdır, normalde host arayüzünden başlatılır.
            // Bu kısım, client.js'de GAME_CODE ve USER_TOKEN global olarak tanımlı olduğu için doğrudan erişilebilir.
            setTimeout(() => { // Katılımdan 3 saniye sonra başlatma isteği gönder
                console.log('3 saniye bekledim, oyunu başlatma isteği gönderiliyor (Sadece host tokenı ile!)...');
                socket.emit('startGame', GAME_CODE, USER_TOKEN, (startResponse) => { // Host'un token'ı ile başlat
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
    // Burada kullanıcıya soruyu gösterip cevaplama arayüzünü açacaksın (ön yüzde)
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