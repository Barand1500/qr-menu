# Ürün oluşturma ve düzenleme — 16 Kasım 2026

Kullanıcı ilk formu kalabalık buldu. Oluşturma ve düzenleme aynı sade arayüzde yeniden ele alındı; ürün listesi, müşteri menüsü ve diğer panel sayfaları değiştirilmedi.

- Üç bölüm: **Ürün, Çeviriler, Görseller**. Ayrı alerjen sekmesi ve büyük ikon kutusu kaldırıldı. Çeviri alanları/içerik havuzu korunur.
- Ad önde; grup ve birleşik fiyat/para birimi alanı ardından gelir. Para birimi kısa sembol/kod olarak aynı çerçevede. Ana ekranda kısa açıklama, küçük süre/kalori alanları, açılır alerjen/tercih ve özellik bölümleri var. Seçili etiketlerin özeti kapalı bölümde görünür. Mobil tek sütun; Kaydet sabit altta.
- İki karakterden itibaren ad önerileri: oturumun mevcut ürün arama API'si + küçük bir Türkçe yemek adı sözlüğü. Kendi menüsünden seçilen ürünün kayıtlı süre/kalorisi yalnızca boş alanlara alınır. Elle girilmiş değerler ve sıfır korunur. Kayıtlı alerjen/tercihleri almak ayrı açık bir seçimdir ve mevcut seçime ekler. Sözlük önerisi yalnızca adı doldurur.
- Yeni `ProductNameField` öneri listesi fare/dokunma/ok/Enter ile kullanılabilir; Escape önce öneriyi kapatır. Gecikmiş istekler iptal edilir. Arama API'si hata verirse ad sözlüğü çalışır. Harici servise ürün bilgisi gönderilmez.
- Yeni `ProductGallery` mevcut `@dnd-kit` bağımlılıklarını kullanır; yeni paket yok. Görseldeki oklar kaldırıldı, yalnızca sil düğmesi kaldı. Fareyle sürükleme, telefonda basılı tutma ve klavyede boşluk/ok/boşluk desteklenir. Escape taşıma sırasında önce taşımayı iptal eder; form açık kalır.
- Eski ve yeni görseller aynı ızgarada sıralanır; yeni fotoğraf en başa taşınıp kapak olabilir. Sıralama ve yeni dosyalar Kaydet ile yayınlanır. Mevcut fotoğrafın silinmesi önceki davranıştaki gibi anında kaydedilir; bekleyen dosyayı silmek yalnızca taslağı kaldırır. Yükleme başarılı ama sıralama isteği başarısızsa tekrar Kaydet fotoğrafları ikinci kez yüklemez. Sıralamayı X ile kaydetmeden kapatmak sunucu sırasını değiştirmez.
- Süre/kalori boş veya sıfır olabilir; veritabanının tam sayı sınırına uymayan, negatif/ondalıklı değerler API isteği öncesinde formda açıklanır. Kalori etiketi kcal olarak düzeltildi.

## Otomatik bilgi araştırması

[Edamam Nutrition Analysis](https://developer.edamam.com/edamam-docs-nutrition-api) miktarlı tariften besin değerleri ve sağlık/diyet etiketleri çıkarır. [Recipe API](https://developer.edamam.com/edamam-docs-recipe-api) tarif araması sağlar; erişim/attribution/lisans koşulları ayrıca değerlendirilmelidir. [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/) besin arama ve ayrıntı uçları sunar, API anahtarı ister; restoranın hazırlama süresini sağlamaz.

Çıkarım: yalnızca ürün adından, gerçek malzemeleri ve porsiyonu bilinmeyen bir restoran yemeğinin kalorisini/alerjenini güvenilir biçimde kesinleştiremeyiz. Harici servis bu tur bağlanmadı; anahtar, ücretli plan veya hazır tahmini beslenme değerleri eklenmedi. Uygulanan otomatik doldurma işletmenin mevcut kayıtlarıyla sınırlıdır. Harici tarif analizi ayrı bir sonraki iştir: tarif/miktar/porsiyon verisi ve sağlayıcı seçimi gerekir. Hazırlama süresi de işletmenin kendi işleyişine göre girilir veya kendi kaydından alınır.

## Kontrol ve sınırlar

- Frontend üretim derlemesi geçti. Mevcut Vite büyük paket uyarısı sürer. Backend, env ve bağımlılık dosyaları değişmedi; bu tur frontend deploy yeterli.
- Gerçek Chrome + gerçek React StrictMode/AdminLayout + taklit API ile 1440/390/320 px oluştur/düzenle, birleşik fiyat/para birimi, virgüllü fiyat, öneri/seçim, boş süre/kalori doldurma, elle girilmiş değerin korunması, açık seçimle alerjen aktarımı/diyet kaydı ve İngilizce açıklamanın korunması geçti.
- Klavye ile görsel sırası/kapak kaydı ve taşıma sırasında Escape'in formu kapatmaması geçti. 1440 px fare, 390 px Chrome dokunma olaylarıyla basılı tutup taşıma geçti. Mevcut+yeni dört fotoğraf içinde yeni fotoğrafı kapak yapma; sıralama hatası sonrası dosyayı tekrar yüklemeden Kaydet; API kapalıyken ad önerileri geçti.
- Negatif kalori gönderilmedi, boş kalori ve sıfır korundu. Bekleyen dosyayı kaldırma ve mevcut fotoğrafı silince kalan görselin kapak olması geçti. URL'den seçili grupta oluşturma, öneriyi ok/Enter ile seçme, 320×480 kısa ekran, koyu mobil ve hareket azaltma kontrol edildi. Yatay taşma/çalışma zamanı hatası görülmedi.
- Ana ürün akışları 1440/768/390/320 px yeniden geçti: liste, fiyat/ad/görünürlük, grup/filtre, oluştur/düzenle, stok, arama ve ürün silme.
- Betikler yerel/Git dışında `frontend/node_modules/.qr-check/editor-*.mjs` ve `products.mjs` altında. Görüntüler taklit ürün verisi kullanır. Gerçek API/veritabanı, fiziksel telefon/ekran klavyesi, ekran okuyucu ve Zen/iOS Safari denenmedi. Sağlayıcılarla canlı istek/anahtar testi yapılmadı. Commit/push/deploy yapılmadı.

## Görüntüler

- [Web düzenleme formu](editor-final-1440.png)
- [Koyu mobil form](editor-final-390.png)
- [320 px kısa ekran](editor-final-320.png)
- [Mobil galeri](editor-final-gallery-390.png)
- [Ad önerileri](editor-suggestions-390.png)
