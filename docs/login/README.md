# Panel girişi — e-posta adımları

13 Kasım 2026. Önceki mor/turuncu arka plan ve alt dalga korunur. Masaüstünde solda karşılama yazısı, sağda açık renkli erişim alanı vardır. Telefon için ayrı yerleşim kullanılır; form açıldığında üst yazı küçülür.

Akış:

1. **E-posta ile devam et**: başlangıçta e-posta/şifre formu yoktur.
2. Yalnızca e-posta adresi ve **Hızlı giriş / Şifreli giriş** seçimi görünür.
3. Hızlı giriş, e-postaya gönderilen altı haneli kod alanını animasyonla açar. Şifreli giriş mevcut hesap şifresini sorar. Adres korunur; geri dönüp değiştirilebilir.
4. Kod tekrar istenebilir ve kod ekranından şifreli girişe geçilebilir. SMTP hatasında şifreli giriş kullanılabilir. Beni hatırla seçimi iki yöntemde de uygulanır; önceki diğer tür oturum kaydı temizlenir.

Referanstaki sosyal girişler eklenmedi; projede Google/Apple OAuth entegrasyonu bulunmuyor. Çalışmayan örnek düğmeler gösterilmez. Mevcut iletişim bilgileri/penceresi korunur.

Örnek ekranlar: [Masaüstü](desktop.png), [Telefon](mobile.png), [Telefonda kod adımı](mobile-code.png). Gerçek bileşenlerin yerel Chrome görüntüleridir; test adresi ve taklit API kullanılır.

## SMTP kurulumu

Kullanıcı SMTP kullanımını onayladı. Gerçek sunucunun `.env` dosyasına e-posta hizmetinin verdiği değerler eklenmelidir:

```dotenv
LOGIN_SMTP_HOST=smtp.saglayici.example
LOGIN_SMTP_PORT=587
LOGIN_SMTP_USER=hesap@example.com
LOGIN_SMTP_PASSWORD="saglayicinin-verdigi-parola"
LOGIN_MAIL_FROM="Menu QR <giris@example.com>"
```

Yukarıdakiler örnektir; gerçek parola depoya yazılmaz. Gönderici adresi sağlayıcının izin verdiği adres olmalıdır. 587 için STARTTLS zorunlu tutulur; sağlayıcı 465 veriyorsa port 465 yapılır ve doğrudan TLS kullanılır. Sertifika doğrulaması kapatılmaz. Kullanılan taşımanın açıklaması: [Nodemailer SMTP belgeleri](https://nodemailer.com/smtp).

Frontend ve backend birlikte deploy edilmeli, backend bağımlılıkları yüklenmeli (`npm ci --prefix backend`; tek sunucu paketinde paket kökünde `npm install --omit=dev`) ve Node süreci yeniden başlatılmalıdır. Projenin mevcut Node.js 20+ gereksinimi geçerlidir. `scripts/prepare-deploy.mjs` yeni bağımlılığı otomatik paketler; örnek SMTP alanları ürettiği `.env.example` dosyasına da eklenir. Mevcut `.env`/uploads değiştirilmez. Veritabanı migration'ı gerekmez.

SMTP alanları boşken hızlı giriş 503 ile açıkça kullanılamaz bilgisi verir; şifreli giriş devam eder. Gerçek SMTP teslimatı yerelde yapılmadı. Sunucuda ayar tamamlandıktan sonra mevcut aktif bir panel hesabıyla kodun gelen kutusuna ulaştığı ayrıca doğrulanmalıdır.

## Sunucu davranışı

- `POST /api/auth/login` mevcut şifreli giriştir. Yeni uçlar `POST /api/auth/login/code/request` ve `POST /api/auth/login/code/verify`.
- Kod yalnızca mevcut ve aktif panel kullanıcısına gönderilir. İstek yanıtı hesabın varlığını açıkça bildirmez; kod ve parola hiçbir API yanıtında veya logda gösterilmez.
- Kod altı haneli, kriptografik rastgele, beş dakika geçerli ve tek kullanımlıktır. Beş hatalı denemede kullanım kapanır. Yeniden gönderim en az 60 saniye aralıklıdır ve hesap başına saatte en fazla beş gönderim rezervasyonu vardır. Başarısız SMTP gönderimi geçerli kod bırakmaz.
- Kalıcı durum mevcut Setting tablosunda işletme/kullanıcıya ait `admin_login_code_<userId>` anahtarındadır. Düz kod saklanmaz; sunucudaki JWT_SECRET ile HMAC özeti saklanır. Ayarlar API'si bu özel kayıtları frontend'e döndürmez.
- Karşılaştırmalı atomik güncelleme eşzamanlı kod tüketimini önler; durum sunucu yeniden başlatılsa da korunur. Ek IP sınırı süreç başınadır (15 dakikada 30 gönderim isteği / 60 doğrulama); hesap sınırı veritabanında süreçler arasında ortaktır.
- Şifre ve kod aynı mevcut kullanıcı/işletme/rol oturum yapısını kullanır. Pasif kullanıcı doğrulamada tekrar kontrol edilir. Müşterilerin QR erişim kodu sistemi bu panel girişinden ayrıdır ve değişmedi.

## Kontroller

```powershell
npm run build --prefix frontend
npm run build --prefix backend
npm run test:login --prefix backend
npm run test:sofra --prefix backend
```

`test:login`, gerçek Express/JWT/bcrypt rotalarını bellek içi Prisma ve e-posta taklitleriyle sınar. Şifreli giriş, e-posta normalizasyonu, eksik SMTP, bilinmeyen/pasif hesap, kod özeti, süre/deneme/bekleme sınırları, eski ve eşzamanlı kod kullanımı, eşzamanlı gönderim, SMTP hatası ve IP sınırları kontrol edilir. Ayrı SMTP taşıma testi TLS ayarlarını, alıcı/metni ve bağlantının başarı/hata halinde kapatılmasını denetler. Gerçek veritabanına veya e-posta sunucusuna bağlanılmaz.

Yerel Chrome kontrolü 320/375/390/430/768/1440/1920 px; e-posta adımı, SMTP hatasında şifreye geçiş, yanlış şifre/kod ve tekrar deneme, yeniden gönderim, iki giriş yöntemi, kalıcı/geçici oturum saklama, iletişim/Escape ve hareket azaltma tercihini kapsar. Geçici fixture `frontend/node_modules/.qr-check/login-*` altındadır. Fiziksel telefon, Zen ve gerçek SMTP teslimatı doğrulanmadı. Vite'ın mevcut büyük paket uyarısı sürer.
