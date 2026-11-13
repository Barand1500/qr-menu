# Masaya Otur — PC sürümü

13 Kasım 2026. Kullanıcı beş etkileşim fikrinden **Masaya Otur** yönünü seçti ve önce PC sürümünün uygulanmasını istedi. Ayrı mobil tasarım sonraki iş olarak bırakıldı.

## Uygulanan deneyim

- 1024 px ve üstünde müşteri karşılama, menü ve ürün detayında gerçek Three.js/WebGL sofra kullanılır. Ahşap masa, keten yüzey, seramik tabaklar, çatal/bıçak, cam bardaklar, değirmenler ve dal geometridir. Dokular kodda üretilir; ışık, çevre yansımaları ve gölgeler render edilir.
- **Yemeklerin kendileri şu an 3D gıda modeli değildir.** İşletmenin mevcut fotoğrafları üç boyutlu tabakların yüzeyine yerleşir. Henüz ürüne özel GLB modelleri veya bir 3D model servisi entegrasyonu yoktur. Ürün fotoğrafları yeniden üretilmez ve yapay içerikle değiştirilmez.
- Karşılama düğmesi kamerayı masaya yaklaştırır, sonra mevcut menü rotasına geçer. Başlıklar, işletme adı, rozet yazısı, karşılama fotoğrafı ve metinler mevcut Tema Ayarları'ndan yönetilir. Editörde 3D tabağa veya görsel değiştirme düğmesine tıklanarak karşılama fotoğrafı seçilebilir.
- Menü kart yığını kullanmaz. Sofrada aynı anda en fazla üç tabak vardır; yanındaki metin listesi bütün ürünlere doğrudan erişim sağlar. Listedeki ürüne odaklanınca/üzerine gelince sofradaki seçili ürün değişir. Oklarla da geçilebilir. Kategori, arama, alt grup, tükenmiş ürün, fiyat, sepete ekleme ve mevcut yardımcı araçlar korunur.
- Ürün detayında seçilen tabak yakına gelir. Sürükleme veya çevirme düğmesiyle döndürülür; içerik bilgisi tabak üzerinden açılabilir. Gerçek ürün seçenekleri ve fiyat hesabı, alerjenler, galeri küçük görselleri, ilgili ürünler ve sipariş mantığı mevcut bileşenlerde çalışır. Dönme mevcut fotoğrafın gösterimini değiştirir; yemeğin görülmeyen arka yüzüne ait yeni veri üretmez.
- Masaüstü sepete eklemede ürün adı/fiyatını taşıyan kısa bir servis fişi animasyonu sepet yönüne gider. Sepet verisi aynı cart sağlayıcısında tutulur. Hareket azaltma tercihinde bu görsel animasyon oynatılmaz; mevcut erişilebilir ekleme bildirimi korunur.

## Mobil ve yedek görünüm

1024 px altındaki karşılama/menü ve ürün galerisi önceki görünümü kullanır. Yeni mobil tasarım yapılmadı. Three.js render modülü yalnızca masaüstü sahnesi bağlandığında dinamik yüklenir; mobilde sahne kurulmaz.

WebGL başlatılamazsa, GPU bağlamı kaybolursa veya fotoğraf dokusu yüklenemezse fotoğraflı 2D tabak yedeği gösterilir. Menü listesi, kategori düğmeleri, fiyat ve sipariş araçları WebGL'e bağlı değildir. Harici görsellerin WebGL dokusu olarak kullanılabilmesi için kaynak sunucunun uygun CORS başlığı vermesi gerekir; yerel `/uploads` görselleri mevcut API altyapısını kullanır.

## Dosyalar

- `frontend/src/components/public/table/`: masaüstü görünüm ayrımı, sahne adaptörü, Three.js sahne/yaşam döngüsü, karşılama/menü, ürün inceleme ve servis fişi.
- `SofraElements.tsx`: eski ve yeni görünümün ortak doğrudan düzenlenebilir yazı/marka/fotoğraf bileşenleri.
- `SofraCanvas.tsx`: aynı dış arayüzle uygun görünümü seçer. Eski Sofra bileşenleri mobil için korunur.
- `SiparisProductPage.tsx`: isteğe bağlı `renderHero` alanı yeni masaüstü görselini kabul eder; ürün/sepet/opsiyon hesapları değişmez.
- `useSiparisCart.tsx`: yeni masa görünümü varken servis fişi olayını, diğer görünümlerde önceki görsel uçurma animasyonunu çalıştırır.

Tema editörü önizlemesinde dış tarayıcı genişliği yerine iframe'in kendi genişliği dikkate alınır. Masaüstü menüde tabak görselleri Ürünler verisinden gelir. Önceki `menuImage` alanı mobil klasik görünümde çalışmaya devam eder; masaüstü editörde bu fark açıklanır. API şeması, ayar kayıtları ve tema seçici değiştirilmedi.

## Kaynak kullanımı ve doğrulama

Sahne her zaman sonsuz animasyon döngüsü çalıştırmaz; etkileşim/geçiş/görsel yüklemesinde çizim yapılır, sekme gizliyken durur. Piksel oranı sınırlıdır, fotoğraf dokuları küçültülür ve önbellek sınırlanır. Sayfa/viewport değişiminde olaylar, geometri, materyal, doku, ortam haritası ve WebGL bağlamı temizlenir. Three.js MIT lisanslı bağımlılıktır. Renderer API kaynağı: [Three.js belgeleri](https://threejs.org/docs/pages/WebGLRenderer).

Frontend üretim derlemesi başarılı. Three.js ayrı bir dinamik render paketindedir. Mevcut büyük ana paket uyarısına ek olarak 3D paketi de Vite'ın 500 KB uyarı eşiğini aşar; gzip boyutu yaklaşık 141 KB'dir ve mobil sahne tarafından çağrılmaz.

Yerel Chrome/Playwright ve gerçek WebGL (test ortamında yazılımsal GPU), taklit API ile sınandı: karşılama/menü/detay, kategori/alt grup, arama ve tekrar deneme, tükenmiş ürün, seçenek fiyatı/sepet/fiş, sürükleme/düğmeyle çevirme, içerik açma, 1024/1280/1440/1920 px, uzun adlar ve RTL taşması, GPU kaybı ve WebGL kapalı yedek, iframe editöründe düzenleme/kaydetme. 320/390/768/1023 px eski görünüm ve mobil ürün galerisi kontrol edildi. Çalışma zamanı hatası görülmedi. Geçici fixture `frontend/node_modules/.qr-check/table-browser.mjs` içinde Git dışındadır.

Canlı sunucu, fiziksel cihaz veya farklı ekran kartlarında performans ölçümü yapılmadı. Backend değişmedi; yalnızca frontend deploy edilir. Commit/push/deploy kullanıcıya bırakılır.

## Örnek görüntüler

Testte örnek ZEEN verisi ve aynı kahvaltı fotoğrafı birden fazla ürün için kullanılır; üretimde her ürün kendi görselini alır.

- [PC karşılama](welcome-desktop.png)
- [PC menü](menu-desktop.png)
- [PC ürün detayı](product-desktop.png)
- [Korunan mobil ürün görünümü](mobile-preserved.png)
