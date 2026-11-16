# Web tema ayarları — 2026-11-16

- Web karşılama önizlemesi aynı işletmenin vitrin/ürün/grup fotoğraflarıyla gerçek fotoğraf yelpazesini, iki farklı yazı karakterli başlığını, kategori şeridini ve alt araçlarını gösterir. Başlık hem tıklanarak hem sağ panelden düzenlenebilir; metinden çıkıldığında biçimlendirilmiş görünüm geri gelir.
- Web menü önizlemesi gerçek vitrin görsellerini, elle değiştirilebilir vitrin noktalarını, hikâyeleri, popüler ürünleri, kategorileri/alt grupları, aramayı, dil seçimini ve alt araç çubuğunu kullanır. İşletme verisi mobilde kullanılan aynı hook'tan okunur.
- Vitrin varsa fotoğraf değiştirme sunulmaz; görseller Vitrin Görselleri sayfasından yönetilir. Vitrin yoksa ana menü/karşılama için yedek fotoğraf düzenlenebilir ve mevcut hazırlama/Kaydet akışıyla yayınlanır. Kayıtlı eski değerler silinmedi.
- Etkisiz dekoratif yazı alanı webden de kaldırıldı. İşletme adı gerçek başlığı değiştirdiği için webde korundu. Çalışma saatleri webde kullanıldığı Karşılama sekmesinde tutuldu; mobil alt yazı altındaki saatler korundu.
- Menü ana başlığı/üst yazısı/önerilen başlığını düzenlemek önizlemeyi ana menüye getirir. Kategori değişimi admin sayfasını kaydırmaz; yalnızca iframe başa alınır. Önizleme müşteri ürün dönüş konumuna veya geçiş animasyonu kayıtlarına dokunmaz.
- Düzenleme tuvalinde giriş animasyonları/otomatik vitrin değişimi durur. Müşteri animasyonları değişmedi. Hesap/servis/sepet/geri bildirim düğmeleri yalnızca görünüm içindir; istek göndermez. Önizleme ses çalmaz ve hikâyeleri izlenmiş işaretlemez.

## Doğrulama

- Frontend üretim derlemesi geçti; mevcut Vite büyük paket uyarısı devam eder. Backend, şema ve bağımlılıklar değişmedi.
- Yerel Chrome/gerçek React + taklit API ile 1440 ve 1024 px admin: gerçek fotoğraf yelpazesi/italik başlık, satır içi/sağ panel metin düzenleme, saatler, Kaydet ve yenileme, dil seçimi, vitrin noktaları, kategori görselleri/ürünleri, arama, otomatik ana menüye dönüş ve alt araçlar kontrol edildi.
- Uzun menü başlığında yatay taşma, değişiklikleri geri alma, ürün API hatası ve başka kategoriyle toparlanma; vitrin boşken yedek fotoğrafın hazırlanması ve Kaydet ile yüklenmesi kontrol edildi. Tarayıcı çalışma zamanı hatası yoktu.
- Mobil kontrol tekrarlandı: 1440/390 px admin panelinde mobil önizleme, kaldırılmış alanlar, kolaj/italik başlık/hikâyeler/alt araçlar, metin düzenleme, saatleri kaydet/yenile/geri al ve kategori seçimi; 320×568 ve 390×844 müşteri görünümünde saatler/yatay taşma geçti.
- Canlı API/veritabanı, fiziksel cihaz ve Zen/Safari denenmedi. Görseller testte yerel örnek görselin kırpmalarıyla temsil edilir; ekran görüntülerindeki işletme/veriler test verisidir. Yerel betikler `frontend/node_modules/.qr-check/theme-web.mjs` ve `theme-mobile-regression.mjs` altında Git dışında tutulur.

[Karşılama](welcome-preview.png) · [Menü](menu-preview.png)

Bu değişiklik için frontend deploy yeterli. Commit/push/deploy yapılmadı.
