// src/db.js
const mysql = require('mysql2/promise'); // mysql2 kütüphanesinin promise tabanlı versiyonunu kullanıyoruz
require('dotenv').config(); // .env dosyasındaki değişkenleri yükler

// Veritabanı bağlantı havuzu oluşturma
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Bağlantıyı test etme (isteğe bağlı, ama iyi bir pratik)
pool.getConnection()
    .then(connection => {
        console.log('Veritabanı bağlantısı başarılı!');
        connection.release(); // Bağlantıyı havuza geri ver
    })
    .catch(err => {
        console.error('Veritabanı bağlantı hatası:', err.message);
        // Uygulamanın başlamasını engellemek isterseniz burada process.exit(1); kullanabilirsiniz
    });

module.exports = pool; // Havuzu dışa aktarıyoruz, diğer dosyalar kullanabilsin diye