// src/routes/authRoutes.js (Sadece router.post kısmını değiştiriyoruz)
const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

console.log('Router Rota Yolu:', '/register');

router.post('/register', async function(req, res) {
    const { username, email, password, role } = req.body;

    // --- Başlangıç: Veri Doğrulama (Validation) ---
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Kullanıcı adı, e-posta ve şifre zorunludur.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Geçerli bir e-posta adresi giriniz.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır.' });
    }
    // YENİ KURAL: Kullanıcı adı ile şifrenin aynı olmaması kontrolü
    if (username === password) {
        return res.status(400).json({ message: 'Kullanıcı adı ve şifre aynı olamaz.' });
    }
    // Rol kontrolü
    if (role && !['teacher', 'player', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Geçersiz rol belirtildi. Rol "teacher", "player" veya "admin" olmalıdır.' });
    }
    // --- Son: Veri Doğrulama ---

    try {
        // --- Kullanıcının Zaten Var Olup Olmadığını Kontrol Etme ---
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);

        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor.' });
        }
        // --- Son: Kullanıcının Zaten Var Olup Olmadığını Kontrol Etme ---

        // --- Şifreyi Hashleme ---
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        // --- Son: Şifreyi Hashleme ---

        // --- Yeni Kullanıcıyı Veritabanına Kaydetme ---
        const newUserRole = role || 'player';
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, newUserRole]
        );

        res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi!', userId: result.insertId });

    } catch (error) {
        console.error('Kayıt işlemi sırasında hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});


// src/routes/authRoutes.js (Mevcut kodunun altına, module.exports'tan önce ekle)
// ... (router.post('/register', ...) fonksiyonu bittikten sonra)

// Giriş Yapma (Login) endpoint'i
// POST isteği /api/auth/login adresine gelecek
router.post('/login', async function(req, res) {
    const { email, password } = req.body; // Giriş için e-posta (veya kullanıcı adı) ve şifre yeterli

    // 1. Temel doğrulama: E-posta ve şifre boş mu?
    if (!email || !password) {
        return res.status(400).json({ message: 'E-posta ve şifre zorunludur.' });
    }

    try {
        // 2. Kullanıcıyı veritabanında e-posta veya kullanıcı adına göre bul
        // Kullanıcı adı ile de giriş yapılabiliyorsa, sorguyu ona göre genişlet
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]); // Hem email hem username için kontrol

        const user = users[0]; // İlk bulunan kullanıcıyı al

        if (!user) {
            // Kullanıcı bulunamazsa
            return res.status(401).json({ message: 'Geçersiz e-posta/kullanıcı adı veya şifre.' });
        }

        // 3. Şifreyi karşılaştır
        // Kullanıcının girdiği şifreyi (password) veritabanındaki hashlenmiş şifre (user.password) ile karşılaştır
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            // Şifre eşleşmezse
            return res.status(401).json({ message: 'Geçersiz e-posta/kullanıcı adı veya şifre.' });
        }

        // 4. Şifre doğruysa JWT Token oluştur
        // Token'ın içine kullanıcının benzersiz ID'si ve rolü gibi bilgileri koyarız (payload)
        const payload = {
            userId: user.id,
            role: user.role
        };
        // Token'ı oluştur. process.env.JWT_SECRET gizli anahtarımızdır.
        // expiresIn: '1h' demek, token 1 saat sonra geçersiz olacak demektir.
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        // 5. Başarılı yanıt: Token'ı ve kullanıcı bilgilerini geri dön
        res.status(200).json({
            message: 'Giriş başarılı!',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Giriş işlemi sırasında hata oluştu:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.' });
    }
});

module.exports = router;