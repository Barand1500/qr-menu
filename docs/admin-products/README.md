# Ürün yönetimi — 16 Kasım 2026

Ürün oluşturma/düzenleme formunun sonraki sadeleştirmesi, öneriler ve sürüklenebilir galeri için [güncel form notlarına](editor/README.md) bakın. Aşağıdaki ekran görüntüleri ilk liste çalışmasını belgeler; güncel form görüntüleri bu bağlantıdadır. Form güncellemesi yalnızca frontend gerektirir; ilk liste çalışmasının backend arama düzeltmesi ayrıca korunur.

## Tasarım kararı

Beş düzen yaklaşımı karşılaştırıldı; beş ayrı uygulama/prototip üretilmedi.

| Yaklaşım | Alınan özellik | Kaçınılan yük |
| --- | --- | --- |
| Fotoğraf kartları | Ürünü görselinden tanıma | Çok üründe büyük kart duvarı |
| Kompakt liste | İsim, fiyat ve durumu birlikte tarama | Telefonu yana kaydıran tablo |
| Kategori rafı | Webde doğrudan grup/alt grup seçimi | Mobilde yer kaplayan yan panel |
| Yerinde düzenleme | Ad ve fiyatı Enter ile kaydetme | Her değişiklikte form açma |
| Ayrıntı çalışma alanı | Gerektiğinde form ve araçlar | Bütün işlemleri her satıra yığma |

Sonuç: mevcut panel renklerini kullanan **Menü atölyesi**. Webde solda kategori rayı, sağda görsel ürün listesi; telefonda tek sütun, aramalı kategori alt penceresi ve ayrı stok/görünürlük satırı. İşlem sütunu yerine üç nokta/sağ tık; fotoğrafa masaüstünde çift tıklama, telefonda dokunma ile ek görsel seçimi. Masaüstündeki çoklu fotoğraf önizlemesi korundu.

Ad/fiyat alanındaki küçük ipucu sağ uçta; Enter kaydeder, Escape vazgeçer. Görünürlük filtresi düğme altında açılır, seçim anında uygulanır; tik yerine panel vurgu rengi kullanır. Sık kullanılmayan toplu fiyat/geri alma/seçenekler/içerik havuzu/saatlik menü işlemleri Araçlar içinde.

Ürün ayrıntıları webde sağ panel, mobilde alttan açılan pencere. Kaydet sabit altta; genel bilgiler, alerjen/diyet, çeviriler, içerik havuzu ve çoklu görseller korunur. İsteğe bağlı alerjen/diyet alanlarını boş bırakmak için eski ek onay adımı kaldırıldı; alanlar ve filtre bağlantıları korunur. Stok ve toplu fiyat pencereleri de aynı kapatma/odak kuralını kullanır. Dış tık kapatmaz; X/Escape veya başarılı işlem kapatır; istek sürerken kapatma ve çift gönderim engellenir. Toast sayfayı itmez.

## Veri ve kod

- `ProductsPage.tsx`: veri yükleme, filtre/sayfalama, mevcut API işlemleri. Eski satır satır toplu fiyat animasyonu/sayfa dolaştırma kaldırıldı; işlem sonrası geçerli filtre ve sayfa yenilenir.
- `components/admin/products`: satır, tipler, form dönüştürücü ve yalnızca ürün sayfasına ait CSS.
- `AdminOverlay`: bu ürün akışları için portal, arka planı inert yapma, kaydırma kilidi, Tab döngüsü, odak dönüşü ve kısa açılış hareketi. Ortak bileşenin eklenmesi diğer modalları topluca değiştirmez.
- Fotoğraf taslaklarının blob temizliği düzeltildi: ikinci dosya seçimi birinci önizlemeyi bozmuyor. Oluşturma başarılı, görsel yükleme başarısızsa tekrar Kaydet mevcut ürünü günceller; ikinci ürün açmaz.
- `backend/src/routes/products.ts`: arama önce bütün eşleşen ürünlerde, ardından sayfalama yapılır. Önceden yalnızca mevcut sayfadaki 15 ürün aranıyordu ve toplam sayısı filtrelenmiyordu. İşletme/grup/görünürlük kapsamı korunur. İsim eşleştirme yöntemi değiştirilmedi.
- Müşteri menüsü, karşılama, giriş, SMTP, Gruplar sayfası ve diğer yönetim sayfaları değiştirilmedi. Yeni bağımlılık veya veritabanı migration yok. **Frontend ve backend birlikte deploy edilmeli.**

## Doğrulama

- Frontend ve backend üretim derlemeleri geçti. Mevcut Vite büyük paket uyarısı sürüyor.
- `node backend/tests/products-search.test.mjs`: gerçek Express route + kimlik doğrulama, taklit Prisma ile sayfa öncesi arama, doğru toplamlar, grup/görünürlük filtreleri, işletme ayrımı ve boş sorgu geçti. Gerçek veritabanına bağlanmaz.
- Yerel Chrome, gerçek AdminLayout/React StrictMode ve taklit API ile 1440/768/390/320 px: liste, yatay taşma, uzun ad, ad/fiyat, virgüllü fiyat, Escape, görünürlük, grup/alt grup seçimi, filtre, ürün oluştur/düzenle/sil, ürün ve varyant stoğu geçti.
- 1440 ve 320 px (320×480 kısa ekran dahil): toplu fiyat önizleme hatası/taslağı koruma, seçenek fiyatlarına uygulama/geri alma, çoklu dosya önizlemesi, yükleme hatasından sonra tek ürünle devam, form hatasında taslak ve X/Escape kontrol edildi. İstek sonrası odak gövdeye döndüğünde Escape'in çalışmaması bulundu ve düzeltildi; tekrar geçti.
- URL ile ilk sayfada olmayan ürünü düzenleme, İngilizce açıklama/diyet değişikliği ve mevcut alerjenin korunması, içerik havuzunu Escape ile kapatıp formda kalma, kapak sıralama/silme/ek görsel, masaüstü hover galerisi, geç gelen arama yanıtının yeni sonucu bozmaması, hareket azaltma geçti.
- Koyu mobil görünüm, aramalı kategori penceresi/odak dönüşü, formda Tab/Shift+Tab döngüsü ve artırılmış kök yazı boyutunda taşma kontrolü geçti. Çalışma zamanı hatası görülmedi.
- Değişen dosyalar ve son Git farkları kontrol edildi. Commit/push/deploy yapılmadı.

Tarayıcı betikleri yerelde `frontend/node_modules/.qr-check/products*.mjs` altında Git dışında tutulur; API yanıtları ve dosya yüklemeleri taklittir. Canlı sunucu/veritabanı, fiziksel telefon/ekran klavyesi, ekran okuyucu ve Zen/iOS Safari denenmedi. Görüntüler test verisi kullanır; ürün fotoğrafları yerel testte aynı örnek görsele yönlendirilmiştir, uygulamada gerçek ürün URL'leri kullanılır.

## Görüntüler

- [Web — 1440 px](products-1440.png)
- [Tablet — 768 px](products-768.png)
- [Mobil — 390 px](products-390.png)
- [Dar telefon — 320 px](products-320.png)
- [Mobil ürün formu](product-editor-390.png)
- [Dar mobil toplu fiyat önizlemesi](products-bulk-320.png)
- [Koyu mobil liste](products-dark-mobile.png)
- [Mobil kategori penceresi](products-category-mobile.png)
