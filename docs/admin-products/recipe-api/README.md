# Ürün formunda gerçek tarif API bağlantısı

## Kullanım

Ürün adında en az üç karakter yazıp kısa süre bekleyin. Kendi menünüz ve başlangıç kataloğunun yanında **Tiny Plates · çevrimiçi tarif** önerileri görünür. Çevrimiçi tarifi seçince ayrıntıları alınır; boş açıklama, içerik, özellik, alerjen/tercih, hazırlık süresi ve kalori alanları kaynağın sağladığı bilgilerle doldurulur. Elle yazılan bilgiler korunur. Tarif alınırken Kaydet bekler; adı değiştirmek eski isteği iptal eder. Kaydet mevcut ürün kaydetme akışını kullanır.

Yalnızca ürün adından işletmenin reçetesi veya porsiyonu doğrulanamaz. Önerilen bilgileri işletmenin gerçek tarifiyle kontrol etmek gerekir. Kaynakta olmayan alanlar tahmin edilmez; fotoğraf, fiyat ve tarifin yapılış metni içeri aktarılmaz. Tarifin asıl yayıncı bağlantısı ve varsa alerjen açıklaması formda gösterilir.

## Yapılandırma ve ücretsiz plan

- Backend ortam değişkeni: `TINYPLATES_API_KEY`. Anahtar yalnızca sunucudadır; frontend ortamına eklenmez. Kullanıcının verdiği anahtar yerel `backend/.env` dosyasına eklendi. Dosyanın Git tarafından yok sayıldığı doğrulandı. Gerçek anahtar dokümantasyonda/testlerde tutulmaz.
- Tiny Plates varsa önceliklidir. Ücretsiz ticari planın yayımlanan sınırı günlük 50, haftalık 300 istektir; arama ve seçilen tarifin ayrıntısını almak ayrı isteklerdir. Önbellek aynı sorguların tekrar kullanımını azaltır. Kota dolarsa yerel öneriler çalışır; otomatik ücretli plana geçiş veya ödeme kurulmadı.
- Anahtar yokken geliştirmede TheMealDB test anahtarı `1` kullanılabilir. Bu ücretsiz anahtar ticari üretime uygun değildir. Üretimde TheMealDB için ayrı supporter anahtarı `THEMEALDB_API_KEY` gerekir; üretim ortamında `1` reddedilir. Tiny Plates anahtarı tanımlıysa bu alternatife ihtiyaç yoktur.
- Sunucuda da Tiny Plates anahtarı ortam değişkenine eklenip backend yeniden başlatılmalı. Yerel `.env` Git ile sunucuya taşınmaz. **Frontend ve backend birlikte deploy edilmeli.** Yeni bağımlılık, veritabanı migration veya katalog yönetim ekranı yoktur.

## Veri sınırları

- API esas olarak İngilizce tarifler sağlar. Yaygın Türkçe ürün aramaları İngilizce arama terimlerine eşlenir; yaygın ad/içeriklerin yerel sözlükle Türkçe karşılıkları gösterilir. Bu tam çeviri hizmeti değildir; sözlük dışında kalan adlar özgün dilinde kalabilir.
- Tiny Plates kalorisi yalnızca `nutrition.basis.type=serving` ve birim `kcal` olduğunda alınır. 100 g veya bütün tarif enerjisi porsiyon kalorisi olarak gösterilmez.
- Hazırlık `times.prep.seconds` değerinden dakikaya çevrilir; toplam pişirme süresi yerine geçirilmez.
- Alerjenler kaynağın `true` değerlerinden eşlenir; `false` değerinden alerjensizlik garantisi çıkarılmaz. Vegan/vejetaryen yalnızca kaynağın açık işaretinden alınır. Glutensiz/diyabetik etiketi türetilmez. Panel kataloğunda karşılığı olmayan alerjenler sessizce atılmaz; kullanıcı düzeltmeden/kaldırmadan kaydetme koruması devreye girer.
- TheMealDB yapılandırılmış alerjen, süre veya kalori sağlamadığından bu alanları doldurmaz.

## Uygulama

- `backend/src/lib/tinyplates.ts`: sabit sağlayıcı adresi, sunucu tarafı Bearer anahtarı, yanıt dönüşümü, 7 sn zaman aşımı, sınırlı önbellek ve aynı isteği birleştirme. Arama 1 saat, tarif 24 saat süreç içi önbellekte kalır; kalıcı veri havuzuna toplu aktarım yapılmaz. 429 sonrası Retry-After (en fazla 24 saat), yoksa 60 sn bekleme uygulanır.
- `backend/src/lib/mealdb.ts`: geliştirme alternatifi, Türkçe arama/temel karşılıklar, kaynak dönüşümü ve sınırlı önbellek.
- `backend/src/routes/recipe-suggestions.ts`: mevcut admin kimlik doğrulaması ve işletme kontrolünün arkasında arama/ayrıntı uçları. İşletme başına dakikada 30 istek; sorgu/kimlik doğrulaması, anlaşılır hata/kota yanıtları. Sağlayıcı anahtarı yanıtlara veya URL'ye eklenmez.
- `ProductNameField.tsx`: 900 ms beklemeli çevrimiçi arama, yerel/kayıtlı önerilerle aynı liste, kaynak etiketleri ve eski isteği iptal etme. Menüde aynı adlı kayıt varsa mevcut ürün önerisi önceliklidir.
- `dishDraft.ts` ve `ProductModal.tsx`: boş alanları doldurma, manuel değişiklikleri koruma, kaynak/uyarı ve ayrıntı isteği sırasında Kaydet koruması. Müşteri menüsü/karşılama, giriş, SMTP ve diğer panel sayfaları değiştirilmedi.

## Doğrulama — 17 Kasım 2026

- Backend ve frontend üretim derlemeleri geçti; mevcut Vite büyük paket uyarısı sürüyor.
- `backend/tests/mealdb.test.mjs`, `backend/tests/tinyplates.test.mjs`, `backend/tests/products-search.test.mjs`, `frontend/tests/dish-catalog.test.mjs` geçti. Sağlayıcı birim testleri taklit yanıtlar; veri dönüşümü/eksik veri, yanlış kalori temeli, kaynak adresi, önbellek, kota, yetkilendirme/işletme kapsamı ve manuel veri koruması kontrol edilir.
- **Gerçek Tiny Plates API** kullanıcı anahtarıyla çalıştırıldı: `tav` araması dört tarif döndürdü. Seçilen Portakallı tavuk tarifinde 20 içerik, alerjenler, 597 kcal/porsiyon ve 40 dk hazırlık geldi. Bunlar API tarifinin değerleridir; işletmenin ürünü için doğrulanmış ölçümler değildir.
- Chrome/gerçek React AdminLayout formunda gerçek Tiny Plates arama/ayrıntı yanıtları 1440/390/320 px ile kontrol edildi: öneriler, seçim, kaynak, açıklama/içerik/alerjen/süre/kalori ve kaydetme isteği alanları doğrulandı. Ürün kaydetme API'si/veritabanı bu tarayıcı testinde taklittir; canlı veritabanına ürün eklenmedi.
- Ayrıca taklit Tiny Plates yanıtlarıyla üç boyutta kota/eksik anahtar, bekleyen tarifte Kaydet kilidi, adı değiştirince eski ayrıntıyı iptal ve yerel katalogla devam kontrol edildi. Canlı TheMealDB arama/ayrıntı ve önceki tarayıcı kontrolü de geçti.
- Ana ürün listesi/form/fiyat/ad/durum/grup/filtre/stok/oluştur/ara/sil regresyonu 1440/768/390/320 px tekrar geçti; çalışma zamanı hatası görülmedi. Express uçlarında Tiny Plates önceliği, ayrıntısı ve kota yanıtı da taklit sağlayıcıyla doğrulandı.
- Yerel betikler `frontend/node_modules/.qr-check` altında Git dışında. Fiziksel telefon, ekran klavyesi/ekran okuyucu, Zen/Safari ve canlı sunucuda kayıt/deploy kontrolü yapılmadı. Commit/push/deploy yapılmadı.

## Ekran görüntüleri

Gerçek Tiny Plates tarifleri, taklit ürün kaydetme servisi:

- [Web arama](tiny-live-search-1440.png) · [Web doldurulmuş form](tiny-live-filled-1440.png)
- [Mobil arama](tiny-live-search-390.png) · [Mobil doldurulmuş form](tiny-live-filled-390.png)
- [Dar telefon arama](tiny-live-search-320.png) · [Dar telefon doldurulmuş form](tiny-live-filled-320.png)

## Birincil kaynaklar

- [Tiny Plates fiyatlandırma ve ücretsiz kota](https://www.tinyplates.dev/pricing)
- [Tiny Plates ticari kullanım ve kaynak/önbellek açıklaması](https://www.tinyplates.dev/blog/free-food-apis)
- [Arama API](https://www.tinyplates.dev/docs/api/search-recipes) · [Tarif ayrıntısı API](https://www.tinyplates.dev/docs/api/get-recipe)
- [TheMealDB API anahtarı koşulları](https://www.themealdb.com/docs_api_guide.php) · [Ticari kullanım FAQ](https://www.themealdb.com/faq.php)
