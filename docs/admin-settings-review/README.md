# Ayarlar — 18 Kasım 2026

Uzun ayar ekranı beş çalışma alanına ayrıldı: **İşletme**, **Menü deneyimi**, **Dil ve para**, **Sosyal bağlantılar**, **Bağlantılar**. Masaüstünde yan gezinme, 1023 px altında üstte bölüm düğmesi ve alttan açılan seçim alanı vardır. Bölüm değişince form taslakları korunur. Kaydedilmemiş bölümler işaretlenir; sabit Kaydet alanı yalnızca değişiklik varsa görünür.

## Davranış

- İsim/logo ve Hakkımızda metni düzenlenebilir. Eski sayfa özelleştirme penceresi, tek kullanıcısı kaldırıldığı doğrulanarak bileşeni ve editör stilleri temizlendi. Mevcut Hakkımızda kapak/başlık/şablon bilgileri kayıtta korunur. Müşterinin gördüğü Hakkımızda CSS kurallarının aynı kaldığı ayrıca karşılaştırıldı.
- Genel Kaydet yalnızca değiştirilen bölümlerin endpoint'lerini çağırır. Servis, masa kodu/süresi ve konum artık aynı taslak/Kaydet akışındadır. Harita bu sayfada ayrı bir kayıt düğmesi göstermez; mevcut bileşene isteğe bağlı draftOnly eklendi. Menü Asistanı, dil/para ekleme-silme mevcut API'lerle hemen uygulanır; bu durum ilgili arayüzde belirtilir.
- Dil ve para birimi etkinliği, korunmuş Türkçe/TRY, katalog arama/ekleme ve silme onayı vardır. Karşılama metinlerinin çevirisi aynı çeviri API'sini kullanır; çeviri sırasında kayıt engellenir ve hata toast ile gösterilir.
- Sosyal platformlar ve özel linklerde isim/URL, karşılama/menü görünürlüğü, ikon seçimi ve özel ikon yükleme korunur. Entegrasyon, API anahtarı, müzik, lisans/destek ve restoran kodunu kopyalama korunur.
- Hata durumunda taslak silinmez. Çoklu endpoint kaydı atomik değildir: ara hata olursa bazı ayarların kaydedilmiş olabileceği açıkça söylenir; tekrar denenebilir. Kayıt sürerken alanlar kilitlenir ve tekrar gönderim engellenir. Düzenlenen modallar dış tıkla kapanmaz; X/Escape ve işlem kilidi kullanılır.
- Müşteri ödülü ürün/grup seçicisindeki iç arama alanının ikinci çerçevesi kaldırıldı. Arama, seçim ve Escape'in önce seçiciyi kapatma davranışı korunur.

## Kontrol

- Frontend TypeScript/Vite üretim derlemesi geçti; mevcut büyük paket uyarısı sürer.
- Gerçek Chrome + gerçek AdminLayout + taklit API: beş bölümün her birinde 1440/1024/768/390/320 px. Uzun isim, 320x480 katalog penceresi, mobil Kaydet alanı ve büyütülmüş temel yazı kontrol edildi. Yatay belge taşması yok.
- Bölüm geçişi/taslak koruma, yalnızca değişen endpoint'lere kayıt, ilk ve ara istekte hata/tekrar deneme, kayıt kilidi, logo yükleme ve yeni URL önizlemesi, Hakkımızda metadata koruması.
- Dil/para katalog ekleme, görünürlük, silme onayı, ekleme/silme hataları; çeviri; servis/masa kodu/süresi, asistan, konum kilidi ve bölge arama; 320 px harita; sosyal link/ikon/yükleme, entegrasyon ve lisans görünümü.
- Yükleme hatası/tekrar deneme, ?focus=languages bağlantısı, koyu tema, azaltılmış hareket, dış tık/Escape. JavaScript/React hatası yok.
- Ürün/grup seçicisinde Chrome computed style ile iç arama border=0 ve outline=none; arama/seçim/Escape ve 320 px kontrolü geçti.

Yerel betikler `frontend/node_modules/.qr-check/settings-v1.mjs`, `settings-edge.mjs`, `reward-combo-review.mjs` (Git'e dahil değildir). Tüm veriler ve API yanıtları taklittir. Harita karoları ve bölge araması da testte taklittir; gerçek harita sağlayıcısı/konum izni denenmedi. Canlı ayar/veri değiştirilmedi; gerçek çeviri servisine istek veya destek mesajı gönderilmedi. Fiziksel telefon, gerçek ekran klavyesi, ekran okuyucu ve Safari/Zen denenmedi.

## Görseller

- [İşletme — masaüstü](settings-business-1440.png)
- [İşletme — 320 px](settings-business-320.png)
- [Değişiklikleri kaydet](settings-mobile-save.png)
- [Dil ve para](settings-localization.png)
- [Sosyal bağlantılar](settings-social.png)
- [Bağlantılar ve lisans](settings-connections.png)
- [Kısa ekran kataloğu](settings-short-picker.png)
- [Mobil harita — taklit karolar](settings-map-mobile.png)
- [Ürün seçicisi](combo-product.png)
- [Grup seçicisi](combo-group.png)

Backend/API/şema, müşteri menüsü, karşılama, giriş ve SMTP değiştirilmedi. Yeni bağımlılık yok; frontend deploy yeterli. SUNUCU-KOMUTLAR.txt kullanıcı değişikliği kapsam dışıdır. Commit/push/deploy yapılmadı.
