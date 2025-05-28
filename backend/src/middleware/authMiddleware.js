// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken'); // JWT işlemleri için
require('dotenv').config(); // .env dosyasındaki JWT_SECRET'ı okumak için

// Rotaları koruyan middleware: Her istekte token doğrular
async function protect(req, res, next) { // Normal fonksiyon gösterimi
    let token;

    // İstek başlıklarından 'Authorization' header'ını kontrol et
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Token'ı "Bearer " kısmından ayır (örneğin "Bearer abc.xyz.123" ise sadece "abc.xyz.123" kısmını al)
            token = req.headers.authorization.split(' ')[1];

            // Token'ı JWT_SECRET ile doğrula
            // jwt.verify() fonksiyonu token'ın payload'ını (userId, role vb.) geri döner
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Doğrulanmış kullanıcı bilgilerini req objesine ekle
            // Böylece rotanın işleyici fonksiyonunda req.user.userId ve req.user.role'a erişebiliriz
            req.user = decoded; // Örneğin: { userId: 123, role: 'teacher', iat: ..., exp: ... }

            next(); // Her şey yolundaysa, isteği bir sonraki middleware'e veya rota handler'ına ilet
        } catch (error) {
            console.error('Token doğrulama hatası:', error.message);
            // Token geçersizse veya süresi dolduysa 401 Unauthorized (Yetkisiz) yanıtı dön
            return res.status(401).json({ message: 'Yetkisiz erişim, token geçersiz veya süresi dolmuş.' });
        }
    }

    if (!token) {
        // 'Authorization' başlığında token bulunamazsa
        return res.status(401).json({ message: 'Yetkisiz erişim, token bulunamadı.' });
    }
}

// Belirli rollere sahip kullanıcıların erişimini yetkilendiren middleware
function authorizeRoles(...roles) { // ...roles = "teacher", "admin" gibi parametreler alır
    return function(req, res, next) { // Normal fonksiyon gösterimi
        // req.user objesi protect middleware'i tarafından eklenir
        // Eğer req.user yoksa (protect çalışmamışsa) veya kullanıcının rolü yetkili roller listesinde değilse
        if (!req.user || !roles.includes(req.user.role)) {
            // 403 Forbidden (Yasaklı) yanıtı dön
            return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
        }
        next(); // Yetki varsa, bir sonraki middleware'e veya rota handler'ına geç
    };
}

module.exports = { protect, authorizeRoles }; // İki middleware fonksiyonunu dışa aktarıyoruz