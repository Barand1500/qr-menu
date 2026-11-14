# Sahne oyunları ve hikâyeleri — 14 Kasım 2026

Oyun seçimi ve hikâye görüntüleyicisi web/mobil için yenilendi. Karşılama, tema editörü, yönetim ve backend değiştirilmedi. Yeni tasarım `sahne` propuyla Sahne/Sofra'ya uygulanır; klasik temalar eski görünümlerini kullanır.

## Oyunlar

Koyu oyun lobisi, dört oyunun ayrı çizgisel simgeleri ve renkleri, rahat dokunma alanları; küçük ekran yüksekliğinde daha kompakt düzen. Oyun içindeki yüzeyler ve yazılar da koyu paletle uyumlu hale getirildi. Hafıza, XOX, Menü Dedektifi ve Sipariş Blitz'in kuralları/verileri/API'leri değişmedi. Etkin oyun listesi mevcut ayardan gelir. Yeni bağımlılık yok.

Sahne'de oyundan lobiye dönmek için ayrı geri düğmesi var; X paneli tamamen kapatır. Escape oyundayken lobiye, lobideyken menüye döner. Odak tuzağı ve gövde kaydırma kilidi uygulanır, kapanınca önceki odak ve kaydırma kilidi geri yüklenir.

## Hikâyeler ve izlenme kaydı

Sahne'de masaüstünde merkezde, telefonda tam ekran görüntüleyici; okunabilir başlık, sayaç, duraklatma, önceki/sonraki ve ürün bağlantısı. Fotoğraf kırpılmadan gösterilir; boş alanlar aynı gerçek fotoğrafın bulanık kopyasıyla doldurulur. Yeni görsel üretilmez.

Süre fotoğraf yüklendikten sonra başlar. Basılı tutma, açık duraklatma düğmesi ve arka sekmeye geçme süreyi durdurur. Uzun basmayı bırakmak ürüne gitmez. Yana sürükleme ve klavye okları geçiş yapar; boşluk tuşu uygun odakta duraklatır. Bozuk fotoğraf için hata metni ve gezinme/ürün bağlantısı kalır. Hareket azaltma tercihinde görsel geçiş animasyonları kapalıdır.

Fotoğraf başarıyla yüklenince izlenmiş sayılır. İzlenen halka gri, küçük fotoğraf ve yazı daha soluktur. Kayıt `menu-stories-seen:v1:<restaurantId>` localStorage anahtarında bu tarayıcıya özeldir; hesaplar/cihazlar arasında eşitlenmez. Kimlik + fotoğraf URL'si + bağlı ürün değişince yeni hikâye sayılır. Depolama engelliyse açık sayfada bellekten çalışır. Hatalı kayıt güvenle yok sayılır; kayıt boyutu sınırlıdır.

## Kontrol

Frontend üretim derlemesi ve diff kontrolü geçti; mevcut Vite büyük paket uyarısı sürer. Chrome/taklit API ile 320×568, 390×844, 768×1024, 1440×900 sınırlar/taşma, dört oyunun açılması ve örnek işlemleri, geri/Escape/kaydırma kilidinin geri verilmesi; hikâye sığması, duraklatma, geçiş, ürün detayı bağlantısı ve yenilemede izlenme kaydı kontrol edildi. Ayrıca uzun basma, yatay kaydırma, gizli sekmede duraklama, otomatik geçiş, işletme ayrımı, fotoğraf yenilenmesi, hatalı fotoğraf, depolama engeli ve hareket azaltma geçti. Çalışma zamanı hatası görülmedi.

Canlı sunucu, gerçek çok oyunculu XOX bağlantısı, fiziksel telefon, iOS Safari ve Zen denenmedi. Testler gerçek React bileşenleriyle, taklit API yanıtlarıyla çalışır. Betikler frontend/node_modules/.qr-check/entertainment.mjs ve entertainment-edge.mjs altında Git dışıdır. Yalnızca frontend deploy gerekir; migration yoktur.

[Web oyunlar](games-desktop.png) · [Mobil oyunlar](games-mobile.png) · [Web hikâye](story-desktop.png) · [Mobil hikâye](story-mobile.png) · [İzlenmiş halkalar](stories-seen.png)
