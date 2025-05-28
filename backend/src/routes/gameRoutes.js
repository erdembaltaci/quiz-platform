// src/routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware'); // authMiddleware
// gameManager'ı kullanmak için initializeGameManager fonksiyonunu dahil ediyoruz
// GameManager, server.js'de başlatılacak ve bu router'a paslanacak
let gameManagerInstance; // GameManager'ın bir örneğini burada tutacağız

// Bu fonksiyonu server.js'den çağırarak gameManager'ı router'a enjekte edeceğiz
function setGameManager(instance) { // Normal fonksiyon gösterimi
    gameManagerInstance = instance;
}

// Oyun Oturumu Oluşturma (Create Game Session)
// Sadece 'teacher' veya 'admin' rolüne sahip kullanıcılar oyun oturumu oluşturabilir
// POST isteği /api/games adresine gelecek
router.post('/', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const { quizId } = req.body; // Hangi quizin oynanacağını al
    const hostId = req.user.userId; // Oyun sahibinin ID'si (JWT'den)

    if (!quizId) {
        return res.status(400).json({ message: 'Oyun oluşturmak için quiz ID zorunludur.' });
    }

    try {
        // GameManager üzerinden yeni bir oyun oluştur
        // gameManagerInstance'ın setGameManager ile ayarlandığından emin olmalıyız
        if (!gameManagerInstance) {
            console.error('Game Manager örneği routerda ayarlanmamış!');
            return res.status(500).json({ message: 'Sunucu hatası: Oyun yöneticisi başlatılmadı.' });
        }

        const result = await gameManagerInstance.createGame(quizId, hostId);

        res.status(201).json({
            message: 'Oyun oturumu başarıyla oluşturuldu!',
            gameCode: result.gameCode,
            gameSessionId: result.game.sessionId
        });

    } catch (error) {
        console.error('Oyun oturumu oluşturma sırasında hata:', error.message);
        res.status(500).json({ message: error.message || 'Oyun oturumu oluşturulamadı.' });
    }
});

// TODO: Diğer oyun oturumu rotalarını buraya ekleyeceğiz (örneğin oyuna katıl, oyun durumu vb.)

module.exports = router;
module.exports.setGameManager = setGameManager; // GameManager'ı enjekte etmek için fonksiyonu dışa aktar