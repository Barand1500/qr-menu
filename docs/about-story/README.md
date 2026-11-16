# Sahne — Hakkımızda

16 Kasım 2026. Müşteri tarafındaki Hakkımızda, tek bir uzun hikâye sayfasına dönüştü. Sitenin sıcak koyu zemini, Bricolage başlıkları ve italik Instrument Serif vurguları kullanılır. Yönetim panelindeki Sayfa özelleştirme alanı değiştirilmedi; mevcut başlık/metin/vurgu verileri okunur, eski şablon seçimi bu yeni Sahne görünümünü belirlemez. Diğer eski temaların AboutPageView bileşeni korunur.

## Düzen ve hareket

- Logo ve menüye dönüş düğmesi sabit üst bölümde; altında büyük başlık, kaydırma bağlantısı ve sayfa ilerleme çizgisi var.
- Kapak kaydırdıkça kenarlara doğru açılır. Fotoğraflar işletmenin mevcut vitrin/kategori/ürün havuzundan alınır; Hakkımızda kapağı ek yedek kaynaktır. Yeni yapay fotoğraf üretilmedi. Aynı URL'ler tekrarlanmaz; görsel yoksa işletme adı/logo kompozisyonu gösterilir, bozuk fotoğraf mevcut Photo yer tutucusuna döner.
- Hikâye metninin kelimeleri kaydırmayla belirginleşir; geri kaydırma etkiyi tersine çevirir. Paragraflar ve tek satır sonları korunur. Metin HTML olarak çalıştırılmaz, ekran okuyuculara tam metin verilir.
- İşletme adı şeridi, kademeli fotoğraf yerleşimi, hafif fotoğraf paralaksı ve varsa mevcut vurgu cümleleri hikâyeyi sürdürür. Kapanıştaki logo/menü düğmesi ve sosyal bağlantılar korunur. İşletmeye ait olmayan tarih/ödül/istatistik eklenmedi.
- Kaydırma kilitlenmez. Yerel scroll + requestAnimationFrame + IntersectionObserver/ResizeObserver kullanılır; ek bağımlılık yok. DOM konumları topluca okunup stiller ardından yazılır; scroll sırasında React state güncellenmez. Hareket azaltmada içerik açık ve sabittir.
- Mobilde bölümler tek sütuna iner. Uzun başlıklar/metinler sarılır. Kategori içinden açıldığında geri dönüş aynı kategori ve menünün kaydırma konumuna yapılır; Hakkımızda için eski otomatik ana menü yönlendirmesi kaldırıldı.

## Doğrulama

- Frontend üretim derlemesi ve diff kontrolü geçti; mevcut Vite büyük paket uyarısı sürüyor. İlk sandbox esbuild EPERM'i süreç izniyle yeniden derleme yapılarak aşıldı.
- Chrome / gerçek React + taklit API: 320/390/768/1440 px, sayfanın açılması, genişleyen kapak, hikâye/fotoğraf/vurgu/kapanış bölümleri, menüye dönüş ve yatay taşma kontrolleri geçti. Testte eski Hakkımızda düğmesinin numara içeren erişilebilir adını dikkate almayan seçici düzeltildi.
- Uzun işletme adı, boşluksuz uzun başlık, uzun gövde/vurgular, boş logo/fotoğraf/başlık/metin, bozuk fotoğraf, güvenli düz metin, satır sonu, hareket azaltma, İngilizce arayüz ve kategori/konum koruması kontrol edildi. Kategoriye dönüşte bulunan gerçek yönlendirme sorunu düzeltildi. Çalışma zamanı hatası görülmedi.
- Canlı API/gerçek işletme verileri, fiziksel telefon, Zen ve iOS Safari denenmedi. Görüntüler test API'sindeki örnek içerik ve yerel fotoğraflarla alındı. Betikler Git dışında frontend/node_modules/.qr-check/about-page.mjs ve about-edge.mjs içinde. Bu iş için yalnızca frontend deploy yeterlidir; admin/backend/migration değişikliği yok.

[Açılış / web](opening-web.png) · [Hikâye](story-web.png) · [Fotoğraf bölümü](details-web.png) · [Açılış / mobil](opening-mobile.png) · [Kapanış / mobil](closing-mobile.png)

## İkinci düzenleme — emoji temizliği ve daha belirgin kaydırma

- Eski kayıtlı vurgu cümlelerindeki emoji süsleri müşteri görünümünde temizlenir; metin, numaralar ve mevcut çizgi/ok simgeleri korunur. Emoji içeren veri veritabanında değiştirilmez; temizlendikten sonra boş kalan satırlar gösterilmez.
- Kapak artık genişlerken hafifçe uzaklaşır, fotoğraf açıklaması açılır. Galeri fotoğrafları scroll ile açılan bir maskeye ve daha belirgin, mobilde sınırlı paralaksa sahip. Vurgu satırlarının çizgileri kaydırmayla uzar, metinleri yerleşir; kapanış başlığı ve logo da kaydırma ilerlemesini izler. Sabit zamanlı döngü veya scroll kilidi eklenmedi.
- Üretim derlemesi geçti (mevcut büyük paket uyarısı sürer). Chrome/taklit API'de 1440/390 px: düz/ZWJ emoji temizliği ve metnin korunması, fotoğraf maskesinin ilerleyip geri dönmesi, vurgu çizgisi, çalışma sırasında hareket azaltmaya geçiş, yatay taşma ve menüye dönüş geçti. Yerel betik frontend/node_modules/.qr-check/about-motion.mjs; canlı/fiziksel cihaz denenmedi.
- [Temiz vurgu satırları / web](values-clean-web.png) · [Mobil](values-clean-mobile.png). Yalnızca frontend deploy yeterli.