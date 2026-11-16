# Müşteri girişi — 16 Kasım 2026

Bu değişiklik müşteri hesabı içindir. Yönetim panelinin giriş ekranı, admin SMTP ayarları ve menü/karşılama tasarımları değiştirilmedi. Yeni giriş masaüstünde iki bölümlü ekran, telefonda tam ekran kullanır; alttan açılan eski giriş/kayıt formu kaldırıldı. Profil ayrı MenuCustomerProfileModal bileşenine taşındı; mevcut QR, puan, tercih ve profil adımları korunur. Mobil Sahne başlığındaki profil düğmesi görünür yapıldı.

## Görünüm — 16 Kasım 2026 güncellemesi (Sahne dili)

İlk görünüm (bilet kartı, yeşilimsi davetiye, "Biraz daha sen.") Sahne tasarımına uymadığı için baştan çizildi; akış, API ve güvenlik kuralları aynen korundu. Güncel görünüm `customer-sign-in.css` ve `CustomerSignIn.tsx` içindedir.

- Aynı palet ve yazı dili: koyu zemin, turuncu→amber gradyan, Bricolage başlık, son satırı italik Instrument Serif ve gradyanlı. Başlık oyunlar penceresindeki gibi yuvarlak rozet + üst yazı + işletme adı + kapat düğmesiyle başlar.
- Masaüstünde sol tarafta işletmenin kendi fotoğrafları (vitrin, kategori, popüler ürün sırasıyla en fazla üç) yelpaze olarak süzülür; karşılama ekranındaki yelpazeyle aynı dil. Fotoğraf yoksa işletme adından kayan hayalet yazı gösterilir. Telefonda başlığın üstünde üst üste binen küçük fotoğraf destesi vardır; kısa ekranlarda gizlenir.
- Giriş seçenekleri: önce turuncu hap düğme (E-posta ile Devam Et), ardından devre dışı Google ve Yakında rozeti. Alanlar hap biçimli, odakta turuncu halka. Doğrulama kodu altı kutuda; dolan kutu turuncu parlar, sıradaki kutuda yanıp sönen imleç vardır. İşlem sürerken düğmedeki ok dönen göstergeye dönüşür. Hata ve başarı mesajları simgeli, renkli kutulardadır.
- Başlıklar sade ve işleve dönük: "Sofraya katıl.", "E-postan neydi?", "Tekrar hoş geldin.", "Gelen kutuna bak.", "Şifreni belirle." Üst yazılar adımı söyler (GİRİŞ YAP YA DA KAYIT OL, E-POSTA, DOĞRULAMA, SON ADIM).
- Hareket azaltma tercihinde animasyonlar kapalıdır. Uzun adımlarda içerik başlığın altında kalmadan kaydırılır.
- Fotoğraf ve logo `PublicMenuPage` üzerinden isteğe bağlı `photos`/`logoUrl` ile gelir; eski çağrılar bozulmaz.

## Akış

1. Google ile Devam Et şimdilik devre dışı, Yakında olarak görünür. Google istemci değişkenleri yalnızca sonraki entegrasyon için ayrıldı; doldurmak düğmeyi kendiliğinden açmaz. Bu sürüm OAuth hesabı seçimi veya Google token doğrulaması içermez.
2. E-posta ile Devam Et yalnızca e-posta sorar. Kayıtlıysa şifre alanına geçer; mevcut şifre girişi çalışır. Yeni adreste SMTP ile 6 haneli doğrulama kodu gönderilir.
3. Kod doğruysa şifre belirlenir. Yeni e-posta hesabı yalnızca doğrulamadan ve mevcut KVKK onayından sonra oluşturulur; adı başlangıçta Misafir olur, profilden değiştirilebilir. Kullanıcı ardından menüye döner.
4. Şifremi unuttum ayrı amaçla kod gönderir. Doğrulama ve yeni şifreden sonra kullanıcı yeni şifresiyle giriş yapar. Yeni şifre en az 8 karakterdir; bcrypt sınırı nedeniyle UTF-8 olarak en fazla 72 bayt olabilir. Eski, daha kısa şifreler için giriş kuralı değiştirilmedi.

Telefon sekmeleri yeni arayüzde yoktur. Eski telefon API'leri uyumluluk için korunur; telefonla açılmış ve e-postası olmayan hesaplar yeni e-posta ekranından otomatik eşlenmez. Doğrulamasız eski e-posta /register çağrıları 410 döner; önbellekteki eski istemci yenilenmelidir.

## Sunucu ve güvenlik

- /api/customer/auth/email/start, /code, /verify ve /complete rotaları eklendi. İstemcinin gönderdiği email/purpose/grant değerleri sunucuda doğrulanır. Kayıtlı hesap dalı kullanıcının istediği tasarım gereği hesap varlığını gösterir; sıfırlama isteği bilinmeyen hesap için genel yanıt verir.
- 6 haneli kod 5 dakika, doğrulama sonrası opak yetki 10 dakika geçerlidir. Kod ve yetki düz metin olarak veritabanına yazılmaz; JWT anahtarından alan/amaç ayrımıyla HMAC türetilir. Kod en fazla 5 denemeye açıktır. Yeniden gönderme aralığı 60 saniye, e-posta başına gönderim sınırı saatte 5'tir. IP sınırları süreç başına, e-posta kod sınırları kalıcı veritabanındadır.
- Kod ve yetki tek kullanımlıdır. Yeni kod öncekini iptal eder. Sürüm koşullu güncelleme ve işlem içinde tüketim, eşzamanlı doğrulama/kayıt tekrarlarını engeller. Sıfırlama yetkisi müşteri kimliğine ve şifre sürümüne bağlanır.
- Sıfırlamada authVersion artar. Daha eski müşteri JWT'leri sunucuda reddedilir. Mevcut sürüm 0 hesapların eski JWT'leri, şifreleri değiştirilene kadar çalışır. Admin oturumları etkilenmez.
- SMTP yapılandırılmamışsa yeni kayıt/sıfırlama kod gönderilmiş gibi ilerlemez; 503 ve açık mesaj döner. Kayıtlı kullanıcının şifreyle girişi SMTP'ye bağlı değildir. Gönderim hatasında kod geçersizleştirilir; kota korunur. Kodlar yanıtta/logda gösterilmez.
- Kullanılmayan doğrulama satırları 24 saatten sonra, yeni kod isteklerinde en fazla 10 dakikada bir temizlenir. Aktif kayıtlar/saatlik kota korunur. Yeni bağımlılık yoktur.

Yöntem kaynakları: [OWASP şifre yenileme rehberi](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Node.js kripto API'si](https://nodejs.org/api/crypto.html). Kurallar uygulamanın mevcut müşteri yapısına uyarlandı.

## Yapılandırma ve sunucuya geçiş

**Bu sürüm yalnızca frontend deploy edilerek tamamlanmaz. Önce veritabanı eklemesi, sonra backend ve frontend birlikte güncellenmelidir.**

MySQL için backend/prisma/migrations_manual/customer_email_auth.sql dosyası mevcut müşteri tablosuna varsayılanı 0 olan auth_version sütununu ve InnoDB doğrulama tablosunu ekler. Silme/sıfırlama komutu içermez ve yeniden çalıştırılabilir. Bu çalışma sırasında canlı veritabanına uygulanmadı. Repo içindeki Prisma 6 CLI'nin db execute --file / --schema seçenekleri kontrol edildi.

Sunucuda repo kökünden, mevcut DATABASE_URL yapılandırmasını kullanarak:

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations_manual/customer_email_auth.sql
npm run db:generate
npm run build
cd ../frontend
npm run build
```

Ardından mevcut backend yeniden başlatma / frontend yayınlama adımlarınızı uygulayın. Veritabanı eklenmeden yeni backend başlatılmamalıdır.

Backend'in sunucudaki .env dosyasına şu müşteri değişkenlerini ekleyin (değerler repoya yazılmadı):

```dotenv
CUSTOMER_SMTP_HOST=
CUSTOMER_SMTP_PORT=587
CUSTOMER_SMTP_USER=
CUSTOMER_SMTP_PASSWORD=
CUSTOMER_MAIL_FROM=
```

587 için zorunlu STARTTLS, 465 için doğrudan TLS kullanılır. Mevcut LOGIN_SMTP_* admin alanlarına dokunulmadı; müşteri gönderimi bu yeni alanlarla yapılandırılır. Google için CUSTOMER_GOOGLE_CLIENT_ID / CUSTOMER_GOOGLE_CLIENT_SECRET örnekte ayrılmıştır; etkinleştirme ve güvenilir OAuth doğrulaması sonraki iştir.

## Doğrulama ve sınırlar

- Backend/frontend üretim derlemeleri geçti; mevcut frontend Vite büyük paket uyarısı sürer.
- npm run test:customer --prefix backend: gerçek Express rotaları, taklit veritabanı ve SMTP ile kayıt, giriş, sıfırlama, onay, süre, tekrar kullanım, yanlış kod sınırı, yeniden gönderim, eşzamanlı kullanım, gönderim hatası/kota ve oturum sürümü geçti. SMTP taşıyıcısı TLS/mesaj/kapama davranışı da taklit taşıyıcıyla kontrol edildi. Gerçek e-posta gönderilmedi.
- npm run test:login --prefix backend: mevcut admin giriş ve admin SMTP testleri geçti.
- Gerçek Chrome/React ve taklit API ile 320×568, 390×844, 768×1024, 1440×900 görünümleri; masa numaralı mobil başlık ve giriş düğmesi, kayıtlı/yeni hesap, yanlış şifre/kod, sıfırlama ve yeniden giriş, SMTP hatası, KVKK, kalıcı ve oturumluk token, Tab/Escape/odak dönüşü, kod yapıştırma/yeniden gönderim, hareket azaltma ve mevcut profil/QR/tercih adımları geçti. Çalışma zamanı hatası görülmedi.
- Canlı MySQL işlemi, SMTP teslimi, Google OAuth, fiziksel telefon klavyesi, Zen ve iOS Safari denenmedi. Tarayıcı betikleri frontend/node_modules/.qr-check/customer-entry.mjs ve customer-entry-edge.mjs altında Git dışındadır. Gerçek sunucuda veritabanı eklemesinden ve SMTP ayarından sonra bir müşteri e-posta teslimi ve kayıt/sıfırlama akışı ayrıca denenmelidir.

[Geniş ekran](desktop.png) · [Mobil](mobile.png) · [Doğrulama kodu](code.png) · [Şifre belirleme](password.png)
