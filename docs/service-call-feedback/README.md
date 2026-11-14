# Servis çağrısı onayı — 14 Kasım 2026

Garson çağrısının başarılı yanıtından sonra otomatik Diğer/oyun önerisi açmak yerine animasyonlu bir alındı bildirimi gösterilir. Bildirim sayfayı kilitlemez, odağı kendine çekmez. Simge halkaları ve çağrı simgesi ardından onay işaretine geçer; masa bilgisi ve başarılı iletim metni görünür. Ekip tarafından görüldüğü/yola çıkıldığı iddia edilmez.

- Normalde 6,5 saniye sonra çıkış animasyonuyla kapanır. Fare üzerindeyken veya klavye odağı içindeyken kapanma bekler; çıkınca süre yeniden başlar. X ile kapatılabilir.
- Menüde oyunlar etkinse 1,7 saniye sonra Oyunlara göz at düğmesi görünür. Oyunlar yalnızca bu düğmeyle açılır; otomatik açılmaz. Ürün detayında onay vardır, oyun lobisi eklenmez. Oyunlar kapalıyken çağrı onayı yine çalışır.
- Tekrar çağrı (duplicate) yanıtında Çağrın zaten iletildi metni kullanılır. İstek hatasında başarı bildirimi üretilmez. Mevcut çağrı isteği, masa doğrulaması, yönetim bildirimi, sepet temizliği ve bekleme süreleri korunur.
- menu-service-call-confirmed olayı kind, requestId, tableNumber, lang ve duplicate verilerini taşır. Mevcut notifyWaiterCalled yardımcı işlevi eski olayı da koruyarak yeni onay olayını yayınlar. Bildirim yeni bir API isteği göndermez.
- Ortak sunum vale gibi gelecekteki türler için genişletilebilir; valet için simge/metin sunumu ve bilinmeyen türler için genel onay vardır. Vale çağırma düğmesi, API'si, kuyruk/iptal/gerçek zamanlı durum yönetimi eklenmedi.
- Telefon/masaüstü yerleşimi ve hareket azaltma desteği var. Karşılama ve yönetim tasarımları değiştirilmedi; yeni bağımlılık yok.

Doğrulama: frontend üretim derlemesi ve diff kontrolü geçti; mevcut Vite büyük paket uyarısı sürer. Chrome/taklit API ile 320×568, 390×844, 768×1024, 1440×900 sınırlar, başarı öncesi bildirim olmaması, otomatik Diğer/oyun açılmaması, isteğe bağlı oyun açma (yeni servis isteği oluşturmadan), menü/sepet/ürün detayı çağrısı kontrol edildi. API hata yanıtı, duplicate/İngilizce, oyunların kapalı olması, otomatik kapanma, hover sırasında açık kalma, elle kapatma, genel vale olayının yalnızca sunumu ve hareket azaltma geçti. Çalışma zamanı hatası görülmedi.

Canlı API/garson uygulaması, fiziksel telefon, Zen ve iOS Safari denenmedi. Animasyon temasının ayrı sepeti için payload bağlantısı ve derleme doğrulandı; o temanın tam sipariş akışı yeniden tarayıcıda çalıştırılmadı. Yerel test betikleri frontend/node_modules/.qr-check/service-notice.mjs ve service-notice-edge.mjs Git dışındadır. Yalnızca frontend deploy gerekir.

[Masaüstü](desktop.png) · [Mobil](mobile.png)
