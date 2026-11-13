# Atelier — müşteri menüsü

Mobilde restoran menü defteri; masaüstünde aynı gerçek fotoğraftan türeyen eskiz ve kaydırmayla fotoğrafa geçiş. Kaynaklar `frontend/src/components/public/atelier/` içinde. Eski `table/` dosyaları ve Three.js bağımlılıkları kaldırıldı.

Eskizler fotoğrafın kenar/ton bilgisinden canvas ile türetilir; elle çizilmiş veya yapay zekâyla üretilmiş illüstrasyon değildir. Fotoğrafla aynı kompozisyondadır. En büyük kenarı 640 piksele sınırlı işlem, görünür alana yaklaşan masaüstü görsellerinde yapılır. Mobil ve hareket azaltma tercihinde özgün fotoğraf kullanılır. Canvas/CORS başarısızsa özgün görsel kalır. Yeni yüklenen ürünler aynı yoldan işlenir. Masaüstünde ürün sahnesi sticky konumda sabit kalır; doğal sayfa kaydırması uzun sahne boyunca fotoğraf maskesini ilerletir. Dönüşüm bittiğinde sahne serbest kalır. Kaydırma engellenmez; pasif dinleyici ve requestAnimationFrame ile ilerleme hesaplanır, CSS scroll timeline desteği gerekmez. Azaltılmış harekette sabitleme ve maske kapalıdır.

Açılış karşılama ekranının her açılışında yaklaşık 2,7 saniyede dört yöne açılır. Popüler ürün fotoğrafları zamanında gelirse kullanılır; gelmezse işletmenin karşılama fotoğrafı yedektir. Tema editöründe açılış oynatılmaz. Masaüstü karşılama yüksekliği ekrana göre düzenlenir. Masaüstünde içindekiler düğmesi yoktur; doğrudan kategori ve arama vardır. Ürün fotoğrafları solda, bilgileri düzenli aralıklarla sağdadır. Ortak özel dil seçici menü/karşılamada kullanılır; mobilde yerel select korunur. Arama odak çizgisi, iletildi durumu ve tercih penceresinin Tamam düğmesi düzenlenmiştir. Mobilde içindekiler ve yatay kategori ayraçları, ürün başına bir sayfa, ileri/geri düğmeleri bulunur. Uzun içerik kesilmez, sayfa uzar ve kaydırılabilir. Bu sürüm sabit ekran yüksekliğine metin sığdıran çok sayfalı metin bölme sistemi kullanmaz.

Ürün detayından Geri düğmesi kaydedilen menü adresine/aramasına döner; defter sayfası sessionStorage ile korunur. Yalnızca aynı ürünün kayıtlı yerel menü adresi kabul edilir. Alt grup başlıkları gösterilir. Seçenekli ürün detaydan seçilir; seçenek/fiyat/sepet mevcut sağlayıcılarla çalışır. Tema yazı/marka/fotoğraf düzenleme bileşenleri korunmuştur.

Doğrulama: frontend üretim derlemesi ve TypeScript; Chrome/taklit API ile karşılama, menü, mobil içindekiler/ileri sayfa, ürün seçeneği/sepete ekleme, detaydan aynı sayfaya dönüş; 320/390/768/1024/1440/1920 px yatay taşma; arama/boş sonuç, grup hata/tekrar deneme/alt grup, iframe editör kaydı; uzun ad/açıklama, geri çevrilebilir scroll maskesi ve azaltılmış hareket kontrolleri geçti. Fiziksel telefon, Zen, canlı sunucu ve gerçek veritabanıyla uçtan uca test yapılmadı. Mevcut Vite büyük paket uyarısı sürer.

Görüntüler taklit API/ZEEN örneğiyle alındı. Test verisinde bütün ürünler aynı kahvaltı fotoğrafını kullanır; üretimde kendi ürün görselleri kullanılır.

- [Karşılama](welcome.png)
- [Masaüstü menü](menu.png)
- [Mobil defter](mobile.png)

Kaydırma araştırması: [MDN scroll timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines), [hareket azaltma](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).

- [Sabit sahnede eskizden fotoğrafa geçiş](scroll-progress.png)

## Son düzenleme — karşılama ve ürün seçenekleri

Karşılamadaki SOFRA/rozet satırı kaldırıldı. Şikayet Kutusu / Öneri Kutusu bağlantıları yan yana gösterilir. Canlı karşılamada menü API'sinin showcase alanındaki ilk geçerli işletme görseli ana fotoğraf olarak kullanılır; vitrin boşsa tema karşılama fotoğrafı yedektir. Açılış kompozisyonu da aynı vitrin listesini kullanır. Tema editörü kendi taslak karşılama fotoğrafını göstermeye devam eder.

Masaüstü menüde fotoğraf/bilgi tarafları ürün sırasına göre dönüşümlüdür. Alt araç çubuğunun yazı, ikon ve dokunma alanları büyütüldü. Seçenekli Sofra ürünlerinde masaüstünde bölüm düğmeleri vardır; aynı anda bir seçenek grubu görünür, diğer gruplardaki seçimler korunur. Ekstralar geniş ekranda iki sütuna yayılır; uzun gruplar kendi alanında kaydırılabilir. Seçim özeti/fiyat, yan yana içerik ve alerjen bilgisi ve sepete ekleme alanı panelin altında yer alır. Fiyat, limit ve sepet hesaplamaları aynı fonksiyonları kullanır. Mobilde seçenek grupları eski şekilde birlikte gösterilir; bölüm düğmeleri gizlidir. Diğer temalarda kompakt görünüm varsayılan olarak kapalıdır.

Doğrulama: üretim derlemesi, TypeScript ve fark kontrolü; Chrome/taklit API ile vitrin önceliği ve boş vitrin yedeği, rozetin kaldırılması/bağlantılar, dönüşümlü yerleşim/alt düğme boyutu, seçenek bölümleri arasında geçiş/seçimlerin korunması, Double + ekstralar için fiyat, maksimum adet engeli ve sepette seçenek isimleri; 1024/1280/1920 px ürün taşması ve 390 px mobilde tüm seçeneklerin görünmesi kontrol edildi. Gerçek sunucu ve fiziksel cihaz testi yapılmadı. Geçici harness frontend/node_modules/.qr-check/atelier-refine.mjs içinde Git dışındadır.

[Seçenekli ürün detayı](product-options.png). Örnek API bütün ürünlerde aynı kahvaltı fotoğrafını kullanır; bu, gerçek işletmenin ürün görseli değiştirildiği anlamına gelmez.

## Güncel mobil tasarım

Mobil menü fotoğraflı içindekiler, ayrı kitap sayfaları ve alttan açılan kategori seçiciyle yeniden düzenlendi. Önceki mobil ekran görüntüsü tarihsel örnektir. [Güncel mobil notlar ve görüntüler](mobile-book/README.md).
