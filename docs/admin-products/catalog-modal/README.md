# Ortalanmış ürün modalı ve başlangıç kataloğu — 17 Kasım 2026

Kullanıcı büyük yan paneli beğenmedi; normal modal ve adı yazınca açıklama/alerjen/tercih/özellik doldurma istedi. Harici API'nin bağlı olmadığı açıklandı. Bu çalışma önceki ürün formunun yerini alır.

## Güncel davranış

- Masaüstünde 620 px genişliğinde, en fazla 740 px yüksekliğinde ortalanmış modal. İçerik kendi içinde kayar; kısa/görsel sekmelerinde pencere içerik kadar küçülür. Mobilde mevcut güvenli alt pencere ve sabit Kaydet korunur. İçerik havuzu açılırsa yan alan için genişler. X/Escape, odak ve dış tıklamayla kapanmama kuralları aynı.
- `frontend/src/lib/dishCatalog.ts` 61 yemek/içeceğin başlangıç tarifini içerir. Ad, alternatif adlar, kısa açıklama, içerik, alerjen, tercih ve özellik alanları ayrı veridir. Fotoğraf/fiyat/porsiyon kalorisi/hazırlama süresi içermez. **Bunlar işletme için doğrulanmış tarifler değildir**; düzenlenebilir örnek tariflerdir. Örneğin tavuk pilav şablonu tereyağlı pilavı tarif eder ve süt alerjeni önerir; işletme farklı tarif kullanıyorsa bunu değiştirmelidir. Hiçbir kayıt otomatik glutensiz veya diyabetik olarak etiketlenmez; boş alerjen listesi çapraz bulaşma veya alerjensizlik garantisi değildir.
- Yeni üründe tam ad/alternatif ad yazılınca veya katalog önerisi seçilince boş alanlar doldurulur. Örneğin “tav” kısmi sorgudur, öneriler gösterir; hangi tavuk yemeği olduğuna karar vermez. “Tavuk” tek başına yalnızca ad önerisidir. Kayıtlı ürün önerileri katalogdan önce gelir ve kayıtlı açıklama/içerik/etiket/özellik ile varsa süre/kaloriyi getirir.
- `dishDraft.ts` doldurma ve geri alma işini formdan ayırır. Manuel dolu değerler, sıfır, diğer diller, fiyat, grup ve fotoğraflar korunur. Öneri sonrası ad değişince yalnızca otomatik doldurulmuş ve henüz değiştirilmemiş değerler önceki haline döner; yeni tarifin bilgileri uygulanır. Manuel düzeltmeler korunur; diyet bayrakları ve etiketleri birlikte ele alınır.
- Mevcut ürün düzenlemeye açılınca katalog kendiliğinden çalışmaz ve kayıtlı tarif değişmez. Düzenlemede açıkça öneri seçmek boş alanları doldurur.
- Formda örnek tarif kaynağı ve içerik görünür. Kullanıcının etiket listesinden kaldırılmış bir alerjen/tercih önerilirse sessizce kaybolmaz: eksik etiket gösterilir, düzeltilene/kaldırılana kadar Kaydet engellenir. Kullanıcı kendi etiketini mevcut yönetim bölümünden seçebilir.
- Önceki ikinci ad listesi temizlendi. Katalogdaki adlar artık tek veri kaynağından gelir. Eski ayrı “alerjenleri de kullan” adımı kaldırıldı; kayıtlı ürünün boş etiket alanları da diğer bilgilerle birlikte dolar.

## API ve veri merkezi sınırı

Harici servis **bağlı değildir**. Bu, ücretli API veya sunucu veritabanı yerine projeye eklenen, sürüm kontrollü bir başlangıç kataloğudur. Bu katalog için ayrı admin ekranı/API henüz yoktur; yeni örnekler `dishCatalog.ts` içinden eklenir. İşletme formda değiştirdiği bilgileri kendi ürün kaydı olarak normal Kaydet akışıyla saklar; ana örnek kataloğu değiştirmez.

Kalori ve hazırlama süresi için örnek sayı üretilmez; yalnızca işletmenin kayıtlı ürün verisi alınır. Gerçek tarif/porsiyon bazlı analiz ve merkezi katalog yönetim ekranı ileride ayrıca ele alınabilir. Backend/env/bağımlılıklar değişmedi; bu tur yalnızca frontend deploy gerekir.

## Kontroller

- Frontend üretim derlemesi ve son fark kontrolü geçti. Mevcut Vite büyük paket uyarısı sürer.
- `node frontend/tests/dish-catalog.test.mjs`: 61 kayıtta benzersiz kimlik/ad/alternatif ad, içerik ve geçerli etiketler, alternatif ad eşleşmesi, doldurma, geri alma, manuel açıklama/özellik/etiket/sıfır değer/çeviri koruma ve diyet bayrakları tutarlılığı geçti.
- Gerçek Chrome/React StrictMode/AdminLayout + taklit API ile 1440/768/390/320 px: modalın merkez/genişlik/yüksekliği, tam adla doldurma, tavuk pilav → menemen değişiminde eski alerjenin temizlenmesi, bilinmeyen ada dönüşte üretilen açıklamanın temizlenmesi, elle girilmiş açıklamanın korunması, kaydet/yeniden aç, menüden öneri ve içerik havuzu/Escape geçti. Katalog dışı ilk adın yazılmasında taslak nesnesini yeniden oluşturmayan hata bu testte bulundu ve düzeltildi.
- Koyu/hareket azaltılmış mobil, kısmi adla katalog önerisini seçme ve silinmiş standart etiketlerin görünür uyarı/Kaydet koruması geçti. Ana ürün listesi, ad/fiyat/görünürlük, kategori/filtre, oluştur/düzenle, stok, arama ve silme 1440/768/390/320 px yeniden geçti. Yatay taşma veya çalışma zamanı hatası görülmedi.
- Tarayıcı betikleri `frontend/node_modules/.qr-check/catalog-modal.mjs`, `catalog-extra.mjs`, `products.mjs` altında yerel/Git dışında. Görüntüler taklit ürün verisiyle oluşturulmuştur; bazı görüntüler manuel açıklamanın korunmasını gösterir. Canlı sunucu/veritabanı, fiziksel telefon/klavye, ekran okuyucu ve Zen/iOS Safari denenmedi. Harici servis isteği yapılmadı. Commit/push/deploy yapılmadı.

## Görüntüler

- [Masaüstü modal](catalog-modal-1440.png)
- [Tablet modal](catalog-modal-768.png)
- [Mobil form](catalog-modal-390.png)
- [320 px kısa ekran](catalog-modal-320.png)
