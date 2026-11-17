# Ürünler: etkileşimli görseller ve fiyat geçişi — 17 Kasım 2026

## Değişiklikler

- Masaüstünde çoklu görsele gelince açılan kutu artık bir görsel çalışma alanı. Sürükleme/klavye ile sıralama, silme ve fotoğrafa tıklayarak dosya değiştirme var. İşlemler doğrudan kaydolur. Etkileşim başlayınca kutu fare ayrılınca kapanmaz; X/Escape ile kapanır. Sürüklemenin sonunda yanlışlıkla dosya seçici açılmaz. Klavyede ana görselden aşağı ok ile kutuya girilebilir; Escape taşırken önce taşımayı iptal eder.
- `ProductGallery` mevcut form ve önizlemede ortak kullanılır; formdaki Kaydet akışı değişmedi. Önizleme için kısa yardım ve anında kayıt bildirimi kullanır. Telefonda mevcut dokunarak görsel ekleme ve üç noktadan Görselleri yönet akışı korunur.
- Yeni `POST /api/admin/products/:id/images/replace` bir görseli aynı konumda değiştirir. Kapak konumu ve görsel sayısı korunur; önce ekleyip sonra silen iki ayrı isteğe dayanmaz. Oturumun işletmesi, eski görsel, dosya türü ve boyut kontrolü uygulanır. Geçersiz istek/DB hatasında yeni yüklenen geçici dosya kaldırılır; eski galeri korunur. Eski dosya, başka kayıtlarda kullanılabileceği için diskten otomatik silinmez.
- Toplu fiyat işlemi sunucuda tamamlandıktan sonra mevcut sayfadaki değişen fiyatlar 220 ms aralıkla, 550 ms sayı geçişi ve kısa vurgu ile görünür. Bu yalnızca sunumdur; yeni değerler zaten kayıtlıdır. Sayfalar otomatik dolaşılmaz, kaydırma/filtre değişmez, animasyon boyunca işlemler kilitlenmez. Elle düzenleme, filtre/sayfa değişimi ve fiyat geri alma ilgili geçişi keser; azaltılmış harekette doğrudan son fiyat gösterilir. Ekran okuyucuya ara sayılar yerine son fiyat sunulur.
- “SOFRANIN İÇİNDEKİLER” üst yazısı kaldırıldı. Arama sırasında “ARAMA SONUÇLARI” korunur.
- Mobil kontrolde toplu fiyat penceresinin fieldset içeriğinin alt düğmeye taşması bulundu. Kaydırma kapsayıcısı fieldset dışına alınarak düzeltildi; istek sürerken alanların devre dışı kalması korunur.

## Kontrol

- Frontend ve backend üretim derlemeleri geçti. Mevcut Vite büyük paket uyarısı sürer. Yeni bağımlılık/migration yok. **Bu değişiklik frontend ve backend deploy gerektirir.**
- `node backend/tests/products-search.test.mjs`: gerçek Express/Multer ve taklit Prisma ile normal/kapak görsel değiştirme, görsel sayısı/sıra, geçersiz kaynak ve dosya, eksik dosya, kimlik doğrulama/işletme ayrımı, DB hatasında galeri koruma ve geçici dosya temizliği geçti. Önceki arama/sayfalama testleri de geçti.
- Yerel Chrome + gerçek React/AdminLayout + taklit API: masaüstünde hover kutusuna geçme, dosya seçiciyle değiştirme, fareyle sıralama, silme, hata durumunda eski görselin korunması, kutunun açık kalması/X ile odak dönüşü geçti. Sürükleme sonrası kutunun ürün görseline bağlı konumu ölçülüp düzeltildi.
- Fiyatların sunucuda tamamlanmış olmasına rağmen görsel olarak sırayla değişmesi, geçişlerin bitmesi ve kaydırma konumunun korunması kontrol edildi. 390/320 px mobil toplu fiyat, yatay taşma ve hareket azaltma geçti.
- Ana liste/form/stok/arama/silme akışları 1440/768/390/320 px; önceki ürün formu/öneri/galeri kontrolleri 1440/390/320 px yeniden geçti. Çalışma zamanı hatası görülmedi.
- Canlı API/veritabanı, fiziksel cihaz, ekran okuyucu ve Zen/iOS Safari denenmedi. Görüntüler taklit ürün verisi kullanır; animasyon görüntüsü hareketin tek bir anıdır. Yerel `frontend/node_modules/.qr-check/products-hover.mjs`, `products.mjs`, `editor-final.mjs` betikleri Git dışında. Commit/push/deploy yapılmadı.

## Görüntüler

- [Etkileşimli görsel kutusu](products-interactive-gallery.png)
- [Fiyat geçişinin bir anı](products-price-animation.png)
- [390 px mobil son fiyatlar](products-after-bulk-390.png)
- [320 px mobil son fiyatlar](products-after-bulk-320.png)
