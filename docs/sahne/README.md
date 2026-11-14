# Sahne — müşteri karşılama ve menü tasarımı

Önceki Atelier (eskiz/kitap) tasarımı kaldırıldı. Yerine koyu zeminli, turuncu/amber vurgulu, hareketli "Sahne" tasarımı geldi. Masaüstü ve mobil ayrı tasarımlardır (kırılma: 1023 px). Kaynaklar `frontend/src/components/public/sahne/` içindedir; `sofra/SofraCanvas.tsx` yalnızca giriş noktasıdır.

## Ekranlar

**Masaüstü karşılama:** 0→100 sayaçlı açılış perdesi, kelime kelime yükselen başlık, işletme fotoğraflarından yelpaze (fareye göre eğilir, üzerine gelince açılır), dönen yazılı rozet, mıknatıslı Menüyü keşfet düğmesi, kayan kategori şeridi. Girişte renk, basılan düğmeden tüm ekrana yayılır ve menüde perde gibi açılır.

**Mobil karşılama:** Fotoğraflardan akan eğik duvar (4+ fotoğraf varsa; azsa yavaş yakınlaşan tek fotoğraf/slayt), altta büyük başlık ve "kaydır ya da dokun" giriş sürgüsü. Tek ekrana sığar, kaydırma yok.

**Masaüstü menü:** Solda kayan vurgulu kategori listesi (üzerine gelince kategori fotoğrafı belirir), üstte arama (`/` kısayolu), vitrin görselli ana alan, fareyi izleyen ışıklı ve eğilen ürün kartları, kategori karoları, altta büyüyen araç çubuğu (Diğer, Oyunlar, Ne yesem?, Garson çağır, Sepet).

**Mobil menü:** Yapışkan fotoğraflı kategori çipleri, hikâyeler, yana kaydırılan Şefin Yıldızı vitrini, kategori kartları; kategoride büyük ilk ürün + iki sütun ürün kartı. Altta dört sekmeli araç çubuğu; Kategoriler tam ekran seçiciyi açar.

## Korunan işlevler

Arama, kategori/alt grup, tükenmiş ürün, kalori, para birimi, seçenekli ürünlerin detay sayfasına gitmesi, doğrudan sepete ekleme, sepet, garson çağırma, oyunlar, Ne yesem?, profil, dil, masa bilgisi, hikâyeler, vitrin, beslenme tercihi, öneri/şikâyet kutuları, müzik, tema editöründe yazı/marka/fotoğraf düzenleme ve ürün detayından aynı kaydırma konumuna dönüş. Ürün detayı, sepet, Diğer paneli ve diğer alt paneller aynı koyu palete taşındı; yerleşimleri değişmedi.

Vitrin görseli varsa karşılamanın ana fotoğrafı ve menü ana alanı vitrinden gelir; yoksa tema fotoğrafı kullanılır. Editörde taslak fotoğraf gösterilir ve açılış animasyonu oynatılmaz. Hareket azaltma tercihinde animasyonlar kapalıdır.

## Notlar

- Yeni bağımlılık yok. Animasyonlar CSS + küçük React/rAF kodlarıdır.
- `index.html` içine Bricolage Grotesque ve Instrument Serif (Google Fonts) eklendi; yüklenemezse mevcut yazı tiplerine düşer.
- Mobilde kategori karoları ve ürün kartları ekrana girdikçe belirir (IntersectionObserver).
- Backend/API ve veritabanı değişmedi; yalnızca frontend deploy yeterlidir.

## Görüntüler (taklit API, örnek veri)

[Masaüstü karşılama](d-02-welcome.png) · [Masaüstü menü](d-06-menu-home.png) · [Masaüstü kategori](d-11-group.png) · [Mobil karşılama](m-01-welcome.png) · [Mobil menü](m-04-home.png) · [Mobil kategori seçici](m-08-picker.png) · [Mobil kategori](m-09-group.png)

Örnek veride tüm ürünler aynı örnek kahvaltı fotoğrafının farklı kesitlerini kullanır; gerçek işletmede kendi görselleri görünür.

## Yazım hatalarını anlayan arama — 14 Kasım 2026

Arama ürün ve kategori adlarında çalışır; Türkçe karakter ve harf büyüklüğü normalleştirilir. Normal eşleşme varsa önce o sonuçlar kullanılır. Normal sonuç yoksa küçük ekleme/silme/değiştirme ve bitişik harf yer değiştirmeleri değerlendirilir: örneğin piza → Pizza, buger → Burger. Üç harften kısa kelimeler için yaklaşık eşleştirme yapılmaz; uzun kelimelerde de hata sayısı sınırlıdır. Alakasız sorgular sonuçsuz kalır. Kategori eşleşmesi o kategorinin ürünlerini bulabilir.

Backend arama yanıtı dizi biçimini korur; yaklaşık sonuçlara isteğe bağlı searchSuggestion alanı eklenir. Mevcut restoran/aktif ürün/kampanya/zaman menüsü ve fiyat/stok hesapları korunur. İlk 100 ürünle sınırlama kaldırıldı; eşleşmeler tüm restoran kataloğundan değerlendirilir, yanıt en fazla 20 üründür. Mevcut istemci beslenme/alerjen filtresi korunur.

Sahne web ve mobilinde küçük bir öneri satırı görünür: Bunu mu demek istediniz? Öneriye dokunmak aramayı günceller. Özgün yazı, kullanıcı dokunana kadar arama kutusunda kalır. Küçük yazım hataları bizde sorun değil. ♡ metni mevcut koyu/amber renklerle gösterilir; yükleme, hata, normal eşleşme veya eşleşmeyen sorguda satır gösterilmez.

Kaynak: backend/src/lib/menuSearch.ts ve public-menu search rotası; frontend sahne/menuShared SearchCorrection. Yeni servis/bağımlılık/migration yok. Frontend ve backend birlikte deploy edilmelidir.

Doğrulama: backend/frontend üretim derlemeleri; node backend/tests/menu-search.test.mjs (harf eksikliği/tekrarı/yer değiştirmesi, Türkçe, kategoriler, çok kelime, normal eşleşme önceliği, kısa/ilgisiz/boş sorgu ve 100'den sonraki ürün); Chrome/taklit API'de gerçek arama yardımcı fonksiyonuyla 1440 ve 390 px sonuç/öneriye tıklama/normal arama/ilgisiz arama/taşma kontrolü geçti. Canlı veritabanı/sunucu veya fiziksel telefon testi yapılmadı. Geçici tarayıcı harness'i frontend/node_modules/.qr-check/sahne-search.mjs içindedir.

[Web arama](search-desktop.png) · [Mobil arama](search-mobile.png)

## Diğer / küçük bir ara — 14 Kasım 2026

İlk panel düzeni kullanıcı tarafından reddedildi. Güncel `SahneMore.tsx`, klasik yan menüden bağımsız bir bileşendir; `PublicMenuPage` bunu yalnızca Sofra/Sahne için seçer. Önceki Sahne panelinin stilleri değiştirildi, kullanılmayan Sofra yan menü kuralları kaldırıldı. Diğer temalar klasik bileşeni kullanır.

- Ana alan: Ne yesem? özelliği açıksa tabak illüstrasyonlu öneri daveti; kapalıysa menüye dönüş. Fotoğraf veya yemek verisi uydurulmaz; dekor CSS ve mevcut Lucide simgeleriyle çizilir.
- Gezinme büyük numaralı bağlantılarla, oyunlar küçük eğimli nesnelerden oluşan bir rafla sunulur. Her oyun doğrudan açılır; işaretçi/klavye odağında kısa açıklaması görünür ve erişilebilir adına da eklenir. Garson sonrası oyun mesajı korunur.
- Dil ve alerji/tercih düğmeleri alt şerittedir. İçeriği aşağı büyüten liste/akordeon yerine aynı panelde ayrı görünüm açılır. Geri/Tamam veya Escape ile ana görünüme ve tetikleyici odağına dönülür. Escape ana görünümde paneli kapatır. Tercihler mevcut akışta anında uygulanır; yeni Kaydet adımı yoktur. Vegan seçiminin vejetaryeni de işaretleme davranışı korunur.
- Masaüstünde ortalanmış kompozisyon, mobilde köşeden genişleyen tam ekran açılış; düşük yükseklikte yalnızca içerik alanı kayar. Alt araçlar ve kapatma sabit kalır. Hareket azaltmada geçişler kapanır. Yeni bağımlılık yoktur.

İlham için [21st Expanding Cards](https://21st.dev/@vaib215/components/expanding-cards) ve [React Bits Staggered Menu](https://reactbits.dev/components/staggered-menu) incelendi; bileşen kaynakları kopyalanmadı.

[Geniş ekran](more-desktop.png) · [Mobil](more-mobile.png) — Chrome ve taklit API, örnek işletme verileri.

Kontrol: frontend üretim derlemesi ve diff kontrolü; Chrome'da 320×568, 390×844, 768×1024, 1440×900, 1920×1080 panel sınırları; dil görünümü/seçimi, alerjen seçme/temizleme, vegan/vejetaryen bağı, Ne yesem? açılması, oyun başlatma, Hakkımızda'ya geçiş, Escape/odak dönüşü/Tab, uzun isim, Arapça yerleşim, hareket azaltma ve özellikler kapalıyken menüye dönüş geçti. Son kompakt düzenin 390/1440 görüntüleri tekrar alındı. Çalışma zamanı hatası görülmedi. Mevcut Vite büyük paket uyarısı devam eder. Fiziksel telefon, iOS Safari, Zen ve canlı sunucu denenmedi. Bu değişiklik yalnızca frontend deploy gerektirir.
