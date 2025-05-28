// src/routes/quizRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // Veritabanı bağlantımız
// authMiddleware dosyasından protect ve authorizeRoles middleware'larını dahil ediyoruz
const { protect, authorizeRoles } = require('../middleware/authMiddleware'); // Dosya yapısını düzelttiğimiz için ./ ile başlıyor

// Quiz Oluşturma (Create Quiz) endpoint'i
// POST isteği /api/quizzes adresine gelecek
router.post('/', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const { title, description } = req.body;
    const creator_user_id = req.user.userId; // JWT token'ından gelen kullanıcının ID'si

    // 1. Veri Doğrulama
    if (!title) {
        return res.status(400).json({ message: 'Quiz başlığı zorunludur.' });
    }

    try {
        // 2. Quizi veritabanına kaydet
        const [result] = await pool.query(
            'INSERT INTO quizzes (title, description, creator_user_id) VALUES (?, ?, ?)',
            [title, description || null, creator_user_id]
        );

        // 3. Başarılı yanıt
        res.status(201).json({
            message: 'Quiz başarıyla oluşturuldu!',
            quizId: result.insertId,
            title: title
        });

    } catch (error) {
        console.error('Quiz oluşturma sırasında hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});

// Tüm Quizleri Getirme (Get All Quizzes)
// Sadece kimliği doğrulanmış kullanıcılar (öğretmenler veya adminler) kendi quizlerini listeleyebilir.
// GET isteği /api/quizzes adresine gelecek
router.get('/', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const creator_user_id = req.user.userId; // Middleware'den gelen kullanıcı ID'si

    try {
        // Kullanıcının oluşturduğu tüm quizleri veritabanından çek
        const [quizzes] = await pool.query(
            'SELECT id, title, description, created_at, updated_at FROM quizzes WHERE creator_user_id = ? ORDER BY created_at DESC',
            [creator_user_id]
        );

        res.status(200).json({ quizzes: quizzes });

    } catch (error) {
        console.error('Quizleri getirirken hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});

// Belirli Bir Quizi ID'ye Göre Getirme (Get Single Quiz by ID)
// Sadece kimliği doğrulanmış kullanıcılar (öğretmenler veya adminler) ve quizi oluşturan kişi görebilir.
// GET isteği /api/quizzes/:id adresine gelecek
router.get('/:id', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const quizId = req.params.id; // URL'den gelen quiz ID'si
    const creator_user_id = req.user.userId; // Middleware'den gelen kullanıcı ID'si

    try {
        const [quizzes] = await pool.query(
            'SELECT id, title, description, creator_user_id, created_at, updated_at FROM quizzes WHERE id = ?',
            [quizId]
        );

        const quiz = quizzes[0]; // İlk bulunan quizi al

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz bulunamadı.' });
        }

        // Sadece quizi oluşturan kullanıcı veya adminler görebilir (güvenlik için ekstra kontrol)
        if (quiz.creator_user_id !== creator_user_id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu quizi görüntülemek için yetkiniz yok.' });
        }

        res.status(200).json({ quiz: quiz });

    } catch (error) {
        console.error('Belirli quizi getirirken hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});

// Quiz Güncelleme (Update Quiz)
// Sadece quizin sahibi (teacher/admin) quizi güncelleyebilir.
// PUT isteği /api/quizzes/:id adresine gelecek
router.put('/:id', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const quizId = req.params.id; // URL'den gelen quiz ID'si
    const { title, description } = req.body; // Güncellenecek bilgiler
    const creator_user_id = req.user.userId; // JWT'den gelen kullanıcı ID'si (güncelleyen kişi)

    // 1. Veri Doğrulama (Başlık zorunlu)
    if (!title) {
        return res.status(400).json({ message: 'Quiz başlığı zorunludur.' });
    }

    try {
        // 2. Güncellenecek quizi veritabanında bul (sahibini kontrol etmek için)
        const [quizzes] = await pool.query('SELECT creator_user_id FROM quizzes WHERE id = ?', [quizId]);
        const quiz = quizzes[0]; // Bulunan quizi al

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz bulunamadı.' });
        }

        // 3. Yetkilendirme kontrolü: Sadece quizi oluşturan veya admin güncelleyebilir
        if (quiz.creator_user_id !== creator_user_id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu quizi güncellemek için yetkiniz yok.' });
        }

        // 4. Quizi veritabanında güncelle
        const [updateResult] = await pool.query(
            'UPDATE quizzes SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, description || null, quizId] // description boşsa NULL kaydet
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Quiz bulunamadı veya güncellenemedi.' });
        }

        res.status(200).json({ message: 'Quiz başarıyla güncellendi!' });

    } catch (error) {
        console.error('Quiz güncelleme sırasında hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});

// Quiz Silme (Delete Quiz)
// Sadece quizin sahibi (teacher/admin) quizi silebilir.
// DELETE isteği /api/quizzes/:id adresine gelecek
router.delete('/:id', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const quizId = req.params.id; // URL'den gelen quiz ID'si
    const creator_user_id = req.user.userId; // JWT'den gelen kullanıcı ID'si (silen kişi)

    try {
        // 1. Silinecek quizi veritabanında bul (sahibini kontrol etmek için)
        const [quizzes] = await pool.query('SELECT creator_user_id FROM quizzes WHERE id = ?', [quizId]);
        const quiz = quizzes[0];

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz bulunamadı.' });
        }

        // 2. Yetkilendirme kontrolü: Sadece quizi oluşturan veya admin silebilir
        if (quiz.creator_user_id !== creator_user_id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu quizi silmek için yetkiniz yok.' });
        }

        // 3. Quizi veritabanından sil
        const [deleteResult] = await pool.query('DELETE FROM quizzes WHERE id = ?', [quizId]);

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Quiz bulunamadı veya silinemedi.' });
        }

        res.status(200).json({ message: 'Quiz başarıyla silindi!' });

    } catch (error) {
        console.error('Quiz silme sırasında hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});

// src/routes/quizRoutes.js (Mevcut kodunun altına, module.exports'tan önce ekle)
// ... (router.delete('/:id', ...) fonksiyonu bittikten sonra)

// Soru Oluşturma (Create Question for a Quiz)
// Belirli bir quize yeni bir soru ve şıklarını ekler.
// Sadece quizin sahibi (teacher/admin) soru ekleyebilir.
// POST isteği /api/quizzes/:quizId/questions adresine gelecek
router.post('/:quizId/questions', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const quizId = req.params.quizId; // URL'den gelen quiz ID'si
    const { text, type, options, correct_option_letter } = req.body; // Soru metni, tipi, şıklar ve doğru şık harfi
    const creator_user_id = req.user.userId; // JWT'den gelen kullanıcı ID'si

    // 1. Veri Doğrulama
    if (!text || !options || !Array.isArray(options) || options.length === 0 || !correct_option_letter) {
        return res.status(400).json({ message: 'Soru metni, şıklar ve doğru şık zorunludur.' });
    }
    if (type && type !== 'multiple_choice') {
        return res.status(400).json({ message: 'Şimdilik sadece "multiple_choice" tipi desteklenmektedir.' });
    }
    if (!options.some(opt => opt.option_letter === correct_option_letter)) {
        return res.status(400).json({ message: 'Doğru şık, verilen seçenekler arasında bulunmuyor.' });
    }

    let connection; // Veritabanı bağlantısı için değişken

    try {
        // 2. Quizi veritabanında bul (soruyu ekleyenin quizin sahibi olduğunu doğrulamak için)
        const [quizzes] = await pool.query('SELECT creator_user_id FROM quizzes WHERE id = ?', [quizId]);
        const quiz = quizzes[0];

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz bulunamadı.' });
        }

        // Yetkilendirme kontrolü: Sadece quizi oluşturan veya admin soru ekleyebilir
        if (quiz.creator_user_id !== creator_user_id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu quize soru eklemek için yetkiniz yok.' });
        }

        // --- Başlangıç: Veritabanı İşlemleri (Transaction) ---
        connection = await pool.getConnection(); // Havuzdan bir bağlantı al
        await connection.beginTransaction(); // İşlemi başlat

        // 3. Soruyu `questions` tablosuna ekle
        const [questionResult] = await connection.query(
            'INSERT INTO questions (quiz_id, text, type) VALUES (?, ?, ?)',
            [quizId, text, type || 'multiple_choice']
        );
        const newQuestionId = questionResult.insertId; // Yeni sorunun ID'si

        let correctOptionId = null;
        const optionValues = options.map(opt => [newQuestionId, opt.option_letter, opt.option_text]);

        // 4. Şıkları `answer_options` tablosuna ekle
        const [optionsResult] = await connection.query(
            'INSERT INTO answer_options (question_id, option_letter, option_text) VALUES ?',
            [optionValues] // Tek seferde birden çok şık ekle
        );

        // Doğru şıkkın ID'sini bul
        for (const option of options) {
            if (option.option_letter === correct_option_letter) {
                // Şıklar eklendikten sonra, eklenen şıkların ID'lerini almalıyız.
                // Basit bir SELECT sorgusuyla doğru şıkkın ID'sini bulalım.
                const [correctOption] = await connection.query(
                    'SELECT id FROM answer_options WHERE question_id = ? AND option_letter = ?',
                    [newQuestionId, correct_option_letter]
                );
                if (correctOption.length > 0) {
                    correctOptionId = correctOption[0].id;
                }
                break;
            }
        }

        if (!correctOptionId) {
            throw new Error('Doğru şık ID\'si bulunamadı, işlem geri alındı.');
        }

        // 5. `questions` tablosundaki doğru şık ID'sini güncelle
        await connection.query(
            'UPDATE questions SET correct_answer_option_id = ? WHERE id = ?',
            [correctOptionId, newQuestionId]
        );

        await connection.commit(); // Tüm işlemler başarılıysa değişikliği onayla
        // --- Son: Veritabanı İşlemleri (Transaction) ---

        res.status(201).json({
            message: 'Soru ve şıkları başarıyla oluşturuldu!',
            questionId: newQuestionId,
            quizId: quizId
        });

    } catch (error) {
        if (connection) await connection.rollback(); // Hata olursa işlemi geri al
        console.error('Soru oluşturma sırasında hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    } finally {
        if (connection) connection.release(); // Bağlantıyı havuza geri ver
    }
});

// src/routes/quizRoutes.js (Mevcut kodunun altına, module.exports'tan önce ekle)
// ... (router.post('/:quizId/questions', ...) fonksiyonu bittikten sonra)

// Tüm Soruları Listeleme (Get All Questions for a Quiz)
// Belirli bir quizin tüm sorularını şıklarıyla birlikte getirir.
// Sadece quizin sahibi (teacher/admin) görüntüleyebilir.
// GET isteği /api/quizzes/:quizId/questions adresine gelecek
router.get('/:quizId/questions', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const quizId = req.params.quizId;
    const creator_user_id = req.user.userId;

    try {
        // Quizi kontrol et (yetkilendirme için)
        const [quizzes] = await pool.query('SELECT creator_user_id FROM quizzes WHERE id = ?', [quizId]);
        const quiz = quizzes[0];

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz bulunamadı.' });
        }
        if (quiz.creator_user_id !== creator_user_id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu quize ait soruları görüntülemek için yetkiniz yok.' });
        }

        // Soruları ve şıkları JOIN ile çek
        const [questionsData] = await pool.query(`
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
        const questions = [];
        let currentQuestion = null;

        questionsData.forEach(row => {
            if (!currentQuestion || currentQuestion.questionId !== row.questionId) {
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                currentQuestion = {
                    questionId: row.questionId,
                    questionText: row.questionText,
                    questionType: row.questionType,
                    correct_answer_option_id: row.correct_answer_option_id,
                    options: []
                };
            }
            if (row.optionId) { // Soruya ait şık varsa ekle
                currentQuestion.options.push({
                    optionId: row.optionId,
                    option_letter: row.option_letter,
                    option_text: row.option_text
                });
            }
        });
        if (currentQuestion) {
            questions.push(currentQuestion);
        }

        res.status(200).json({ questions: questions });

    } catch (error) {
        console.error('Quiz sorularını getirirken hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});

// Belirli Bir Soruyu ID'ye Göre Getirme (Get Single Question)
// GET isteği /api/quizzes/:quizId/questions/:questionId adresine gelecek
router.get('/:quizId/questions/:questionId', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const quizId = req.params.quizId;
    const questionId = req.params.questionId;
    const creator_user_id = req.user.userId;

    try {
        // Quizi kontrol et (yetkilendirme için)
        const [quizzes] = await pool.query('SELECT creator_user_id FROM quizzes WHERE id = ?', [quizId]);
        const quiz = quizzes[0];

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz bulunamadı.' });
        }
        if (quiz.creator_user_id !== creator_user_id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu quize ait soruyu görüntülemek için yetkiniz yok.' });
        }

        // Soruyu ve şıkları JOIN ile çek
        const [questionData] = await pool.query(`
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
            WHERE q.quiz_id = ? AND q.id = ?
            ORDER BY ao.option_letter
        `, [quizId, questionId]);

        if (questionData.length === 0) {
            return res.status(404).json({ message: 'Soru bulunamadı.' });
        }

        // Çekilen veriyi yapılandır (sorunun altında şıkları dizi olarak)
        const question = {
            questionId: questionData[0].questionId,
            questionText: questionData[0].questionText,
            questionType: questionData[0].questionType,
            correct_answer_option_id: questionData[0].correct_answer_option_id,
            options: []
        };
        questionData.forEach(row => {
            if (row.optionId) {
                question.options.push({
                    optionId: row.optionId,
                    option_letter: row.option_letter,
                    option_text: row.option_text
                });
            }
        });

        res.status(200).json({ question: question });

    } catch (error) {
        console.error('Belirli soruyu getirirken hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});

// Soruyu Güncelleme (Update Question)
// Sadece quizin sahibi (teacher/admin) soruyu güncelleyebilir.
// PUT isteği /api/quizzes/:quizId/questions/:questionId adresine gelecek
router.put('/:quizId/questions/:questionId', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const quizId = req.params.quizId;
    const questionId = req.params.questionId;
    const { text, type, options, correct_option_letter } = req.body;
    const creator_user_id = req.user.userId;

    // 1. Veri Doğrulama
    if (!text || !options || !Array.isArray(options) || options.length === 0 || !correct_option_letter) {
        return res.status(400).json({ message: 'Soru metni, şıklar ve doğru şık zorunludur.' });
    }
    if (type && type !== 'multiple_choice') {
        return res.status(400).json({ message: 'Şimdilik sadece "multiple_choice" tipi desteklenmektedir.' });
    }
    if (!options.some(opt => opt.option_letter === correct_option_letter)) {
        return res.status(400).json({ message: 'Doğru şık, verilen seçenekler arasında bulunmuyor.' });
    }

    let connection; // Veritabanı bağlantısı için değişken

    try {
        // Quizi ve soruyu kontrol et (yetkilendirme için)
        const [quizCheck] = await pool.query('SELECT creator_user_id FROM quizzes WHERE id = ?', [quizId]);
        const quiz = quizCheck[0];
        if (!quiz) { return res.status(404).json({ message: 'Quiz bulunamadı.' }); }
        if (quiz.creator_user_id !== creator_user_id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu quize ait soruyu güncellemek için yetkiniz yok.' });
        }

        const [questionCheck] = await pool.query('SELECT id FROM questions WHERE id = ? AND quiz_id = ?', [questionId, quizId]);
        if (questionCheck.length === 0) { return res.status(404).json({ message: 'Soru bulunamadı.' }); }


        // --- Başlangıç: Veritabanı İşlemleri (Transaction) ---
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 2. Soruyu `questions` tablosunda güncelle
        await connection.query(
            'UPDATE questions SET text = ?, type = ? WHERE id = ?',
            [text, type || 'multiple_choice', questionId]
        );

        // 3. Mevcut şıkları sil
        await connection.query('DELETE FROM answer_options WHERE question_id = ?', [questionId]);

        // 4. Yeni şıkları ekle
        const optionValues = options.map(opt => [questionId, opt.option_letter, opt.option_text]);
        await connection.query('INSERT INTO answer_options (question_id, option_letter, option_text) VALUES ?', [optionValues]);

        // 5. Doğru şıkkın ID'sini bul
        let correctOptionId = null;
        const [correctOption] = await connection.query(
            'SELECT id FROM answer_options WHERE question_id = ? AND option_letter = ?',
            [questionId, correct_option_letter]
        );
        if (correctOption.length > 0) {
            correctOptionId = correctOption[0].id;
        } else {
            throw new Error('Güncelleme sonrası doğru şık ID\'si bulunamadı, işlem geri alındı.');
        }

        // 6. `questions` tablosundaki doğru şık ID'sini güncelle
        await connection.query(
            'UPDATE questions SET correct_answer_option_id = ? WHERE id = ?',
            [correctOptionId, questionId]
        );

        await connection.commit(); // Tüm işlemler başarılıysa onayla
        // --- Son: Veritabanı İşlemleri (Transaction) ---

        res.status(200).json({ message: 'Soru ve şıkları başarıyla güncellendi!' });

    } catch (error) {
        if (connection) await connection.rollback(); // Hata olursa geri al
        console.error('Soru güncelleme sırasında hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    } finally {
        if (connection) connection.release(); // Bağlantıyı havuza geri ver
    }
});

// Soruyu Silme (Delete Question)
// Sadece quizin sahibi (teacher/admin) soruyu silebilir.
// DELETE isteği /api/quizzes/:quizId/questions/:questionId adresine gelecek
router.delete('/:quizId/questions/:questionId', protect, authorizeRoles('teacher', 'admin'), async function(req, res) {
    const quizId = req.params.quizId;
    const questionId = req.params.questionId;
    const creator_user_id = req.user.userId;

    let connection; // Veritabanı bağlantısı için değişken

    try {
        // Quizi ve soruyu kontrol et (yetkilendirme için)
        const [quizCheck] = await pool.query('SELECT creator_user_id FROM quizzes WHERE id = ?', [quizId]);
        const quiz = quizCheck[0];
        if (!quiz) { return res.status(404).json({ message: 'Quiz bulunamadı.' }); }
        if (quiz.creator_user_id !== creator_user_id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu quize ait soruyu silmek için yetkiniz yok.' });
        }

        const [questionCheck] = await pool.query('SELECT id FROM questions WHERE id = ? AND quiz_id = ?', [questionId, quizId]);
        if (questionCheck.length === 0) { return res.status(404).json({ message: 'Soru bulunamadı.' }); }


        // --- Başlangıç: Veritabanı İşlemleri (Transaction) ---
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Şıkları sil (önce silinmeli, çünkü questions tablosu ona referans veriyor olabilir)
        await connection.query('DELETE FROM answer_options WHERE question_id = ?', [questionId]);

        // 2. Soruyu sil
        const [deleteResult] = await connection.query('DELETE FROM questions WHERE id = ? AND quiz_id = ?', [questionId, quizId]);

        if (deleteResult.affectedRows === 0) {
            // Eğer silme herhangi bir satırı etkilemediyse (zaten yukarıda kontrol ettik)
            throw new Error('Soru bulunamadı veya silinemedi.');
        }

        await connection.commit(); // Tüm işlemler başarılıysa onayla
        // --- Son: Veritabanı İşlemleri (Transaction) ---

        res.status(200).json({ message: 'Soru başarıyla silindi!' });

    } catch (error) {
        if (connection) await connection.rollback(); // Hata olursa geri al
        console.error('Soru silme sırasında hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    } finally {
        if (connection) connection.release(); // Bağlantıyı havuza geri ver
    }
});

module.exports = router;