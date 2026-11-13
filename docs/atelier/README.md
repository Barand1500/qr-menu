# Atelier — müşteri menüsü

Mobilde restoran menü defteri; masaüstünde aynı gerçek fotoğraftan türeyen eskiz ve kaydırmayla fotoğrafa geçiş. Kaynaklar `frontend/src/components/public/atelier/` içinde. Eski `table/` dosyaları ve Three.js bağımlılıkları kaldırıldı.

Eskizler fotoğrafın kenar/ton bilgisinden canvas ile türetilir; elle çizilmiş veya yapay zekâyla üretilmiş illüstrasyon değildir. Fotoğrafla aynı kompozisyondadır. En büyük kenarı 640 piksele sınırlı işlem, görünür alana yaklaşan masaüstü görsellerinde yapılır. Mobil ve hareket azaltma tercihinde özgün fotoğraf kullanılır. Canvas/CORS başarısızsa özgün görsel kalır. Desteklenmeyen scroll timeline tarayıcılarında da fotoğraf gösterilir. Yeni yüklenen ürünler aynı yoldan işlenir.

Açılış oturumda bir kez dört yöne açılır. Popüler ürün fotoğrafları zamanında gelirse kullanılır; gelmezse işletmenin karşılama fotoğrafı yedektir. Tema editöründe açılış oynatılmaz. Masaüstünde kategori/aramanın yanında kaydırmayla ürünler incelenir. Mobilde içindekiler ve yatay kategori ayraçları, ürün başına bir sayfa, ileri/geri düğmeleri bulunur. Uzun içerik kesilmez, sayfa uzar ve kaydırılabilir. Bu sürüm sabit ekran yüksekliğine metin sığdıran çok sayfalı metin bölme sistemi kullanmaz.

Ürün detayından Geri düğmesi kaydedilen menü adresine/aramasına döner; defter sayfası sessionStorage ile korunur. Yalnızca aynı ürünün kayıtlı yerel menü adresi kabul edilir. Alt grup başlıkları gösterilir. Seçenekli ürün detaydan seçilir; seçenek/fiyat/sepet mevcut sağlayıcılarla çalışır. Tema yazı/marka/fotoğraf düzenleme bileşenleri korunmuştur.

Doğrulama: frontend üretim derlemesi ve TypeScript; Chrome/taklit API ile karşılama, menü, mobil içindekiler/ileri sayfa, ürün seçeneği/sepete ekleme, detaydan aynı sayfaya dönüş; 320/390/768/1024/1440/1920 px yatay taşma; arama/boş sonuç, grup hata/tekrar deneme/alt grup, iframe editör kaydı; uzun ad/açıklama, geri çevrilebilir scroll maskesi ve azaltılmış hareket kontrolleri geçti. Fiziksel telefon, Zen, canlı sunucu ve gerçek veritabanıyla uçtan uca test yapılmadı. Mevcut Vite büyük paket uyarısı sürer.

Görüntüler taklit API/ZEEN örneğiyle alındı. Test verisinde bütün ürünler aynı kahvaltı fotoğrafını kullanır; üretimde kendi ürün görselleri kullanılır.

- [Karşılama](welcome.png)
- [Masaüstü menü](menu.png)
- [Mobil defter](mobile.png)

Kaydırma araştırması: [MDN scroll timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines), [hareket azaltma](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).
