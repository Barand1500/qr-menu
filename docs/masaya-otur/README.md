# Masaya Otur — güncel PC görünümü

13 Kasım 2026. Kullanıcının ilk 3D masa denemesine verdiği geri bildirim sonrası sunum sadeleştirildi. Öncelik yemeği rahat görmek ve siparişe ulaşmak; ayrı mobil tasarım daha sonra yapılacak.

## Güncel davranış

- 1024 px ve üstünde karşılama, menü ve ürün detayında varsayılan görünüm büyük, sabit ve kırpılmayan gerçek fotoğraftır. Menüde açıklama, fiyat ve detay bağlantısı fotoğrafın altındadır; sağdaki görselli liste bütün ürünleri gösterir.
- Küçük ürün görseline tıklama veya önceki/sonraki düğmeleri büyük görseli değiştirir. Fareyle üzerine gelmek ve klavye odağı seçimi değiştirmez. Ürün adına veya büyük fotoğrafa tıklama gerçek ürün detayını açar. Kategori, alt grup, arama, hata/tekrar deneme, tükenmiş ürün ve sepete ekleme korunur.
- **3D sunum isteğe bağlıdır.** Seçilene kadar Three.js render modülü yüklenmez ve WebGL bağlamı kurulmaz. Sunum yalnızca sabit kamerayla tek seramik tabak gösterir; masa, bardak, değirmen, dal, keten ve çatal-bıçak kaldırılmıştır. Fare takibi, kendiliğinden dönme, sürükleme ve kamera giriş animasyonu yoktur. Ürün detayındaki çevirme düğmesi yalnızca açık kullanıcı isteğiyle tabağı döndürür. Sürekli çizim döngüsü yoktur; boyut, görsel ve açık döndürme değişiminde çizilir.
- **Yemek 3D gıda modeli değildir.** Mevcut ürün fotoğrafı 3D tabağın yüzeyine yerleşir; bu modda yuvarlak kırpma uygulanır. Fotoğraf modunda özgün görsel tamamıyla gösterilir. Higgsfield üretimi, GLB entegrasyonu veya ücretli model işlemi yapılmadı. Bu oturumda Higgsfield üretim aracı görünmedi; düzeltme için yeni model gerekmedi.
- Ürün detayındaki gerçek galeri/ikinci fotoğraflar, içerik, seçenekler, fiyat hesabı, alerjenler, ilgili ürünler ve sipariş mantığı korunur. Masaüstü sepete eklemede önceki servis fişi animasyonu ve erişilebilir bildirim sürer.
- Tema editörünün yazı, marka, rozet ve karşılama fotoğrafı düzenleme/kaydetme akışı sürer. Karşılama fotoğrafına veya görsel değiştirme düğmesine tıklanır. Editör iframe genişliğini kullanır. Menü fotoğrafları Ürünler verisinden gelir; eski menuImage yalnızca dar ekran görünümünde kullanılır.

## Mobil ve yedek görünüm

1024 px altındaki karşılama, menü ve ürün galerisi önceki görünümü kullanır; bu işte ayrı mobil tasarım yapılmadı. Mobilde yeni WebGL sahnesi kurulmaz.

İsteğe bağlı sunumda WebGL başlatılamazsa, bağlam kaybolursa veya doku yüklenemezse 2D tabak yedeği gösterilir. Fotoğraf düğmesiyle özgün görsele dönülebilir. Kategori, liste ve sipariş WebGL'e bağlı değildir. Ürün fotoğrafları yeniden üretilmez. Harici dokular kaynak sunucuda uygun CORS başlığı gerektirir.

## Kaynaklar ve doğrulama

Kaynaklar frontend/src/components/public/table/ içindedir. TablePresentation fotoğraf/3D seçimini, TableScene dinamik render ve yedeğini, tableRenderer tek tabağın geometrisi/çizimi/temizliğini yönetir. DesktopTableSurface dar ekran görünümünü seçer. Three.js ayrı dinamik pakettir; üretim çıktısı yaklaşık 133 KB gzip. Mevcut Vite büyük paket uyarısı sürer.

Yerel Chrome, gerçek WebGL (yazılımsal GPU) ve taklit API ile fotoğrafın varsayılan olması, kırpılmaması, üzerine gelme/odakla değişmemesi; isteğe bağlı 3D, fare hareketinde sabit kamera, düğmeyle çevirme ve fotoğrafa dönüş; kategori/alt grup/arama/hata-tekrar deneme/tükenmiş ürün; seçenek fiyatı/sepet/fiş/içerik; GPU kaybı ve WebGL kapalı yedek; iframe editör kaydı kontrol edildi. 1024/1280/1440/1920 px masaüstü, uzun adlar/RTL taşması, 320/390/768/1023 px korunan dar görünüm ve mobil galeri doğrulandı. Çalışma zamanı hatası görülmedi. Geçici test harness'i frontend/node_modules/.qr-check/table-focus-browser.mjs içinde Git dışındadır.

Fiziksel cihaz, Zen ve canlı sunucu test edilmedi. Backend değişmedi; frontend deploy edilir. Commit/push/deploy kullanıcıya bırakıldı.

## Örnek görüntüler

Taklit API, ZEEN örnek verisini ve bütün ürünlerde aynı kahvaltı fotoğrafını kullanır. Üretimde her ürün kendi fotoğrafını alır.

- [PC karşılama](welcome-desktop.png)
- [PC menü](menu-desktop.png)
- [PC ürün detayı](product-desktop.png)
- [İsteğe bağlı 3D sunum](optional-3d.png)
- [Korunan mobil ürün görünümü](mobile-preserved.png)
