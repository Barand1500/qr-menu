# Vitrin Görselleri — 17 Kasım 2026

## Tasarım ve kullanım

Eski küçük görselli tablo ve her kayıtta tekrarlanan işlem düğmeleri kaldırıldı. Afişler geniş fotoğraf önizlemesi, hikâyeler dikey kareler halinde yönetilir. Panelin mevcut renkleri korunur; yeni bağımlılık eklenmedi.

- **Afişler / Hikâyeler:** tek sekme satırı ve seçili türe uygun tek ekleme düğmesi. Uzun açıklamalar, tekrarlanan bölüm başlıkları, ayrı işlem sütunu ve sürekli görünen sıralama okları kaldırıldı.
- Fotoğrafa veya adına bir kez tıklamak düzenlemeyi açar. Menüde göster/gizle doğrudan kart üzerindedir. Fotoğrafı/ürün bağlantısı eksik kayıtlar yayımlanmış gibi gösterilmez; **Tamamla** düzenlemeye götürür.
- Üç nokta veya sağ tık düzenle/gizle/taşı/sil menüsünü açar. Masaüstünde tutamaktan sürükleyerek veya ok tuşlarıyla sıralanabilir. Telefonda tutamak gizlenir; alttan açılan menüde Öne taşı/Geri taşı vardır. İki türün sıraları birbirine karışmaz.
- Mobilde afişler tek sütun, hikâyeler iki sütundur. Uzun adlar satıra geçer; tablo/yatay sayfa kaydırma yoktur. Küçük resmin yanında tekrar eden üç işlem yerine geniş görsel, okunabilir ad, görünürlük ve tek işlem menüsü kullanılır.

## Ortak editör

İki eski modal yalnızca bu sayfada kullanıldıkları doğrulanarak kaldırıldı; `admin/showcase` altında tek editör, kart, tipler ve sayfaya özel CSS eklendi. Desktop ortalanmış pencere, mobil alttan açılan/içi kaydırılan pencere ve sabit Kaydet kullanılır. X/Escape kapatır; dış tıklama kapatmaz. İşlem sırasında alanlar/X/Escape kilitlenir. Silme de bu kuralları izler; silme başarısızsa pencere açık kalır.

- Fotoğraf alanı doğrudan dosya seçer ve önizler; 8 MB görsel sınırı kontrol edilir. Menüye görünmeyecek boş fotoğraflı yeni kayıt açılması önlenir.
- Hikâyede ürün bağlantısı zorunludur. 3/5/8 saniye kısa seçimleri yanında 2–30 saniye arası özel süre korunur.
- Afişte ürün bağlantısı isteğe bağlıdır ve kaldırılabilir. Başlık/alt başlık ve diller **Yazılar ve çeviriler** bölümünde korunur. Panel adı boşsa ürün adından veya türden ad verilir.
- Kayıt ve fotoğraf yükleme hataları görünürdür. Oluşturulan kaydın kimliği fotoğraf yüklemeden önce saklanır; fotoğraf yüklenemezse tekrar Kaydet aynı kaydı günceller, ikinci kayıt oluşturmaz. Yüklemede ortak API yardımcı fonksiyonu kullanılır; mevcut API adresi ve local/session token davranışı korunur.
- İşlem bildirimleri mevcut animasyonlu/kendiliğinden kapanan AdminToast üzerinden gelir; sayfayı itmez. Kalıcı form hataları ayrıca gösterilir. Mobil modal toast'ı Kaydet'in üstünde konumlanır.
- Ürün seçiminde ilk 200 kayıtla sınırlı kalınmaz; kalan sayfalar da yüklenir. İlk yükleme hatası tekrar denenebilir. Bozuk görsellerin yedeği, boş liste, gizli kayıt ve hareket azaltma tercihleri ele alındı.

## Kapsam

Değişen uygulama dosyaları: `ShowcasePage.tsx`, yeni `components/admin/showcase` klasörü ve `index.css` içindeki artık kullanılmayan eski admin hikâye stilleri. `ShowcaseModal.tsx` ve `StoryModal.tsx` kaldırıldı. Müşteri hikâye izleyicisi/görselleri, karşılama, tema editörü, ürünler ve diğer panel sayfaları değiştirilmedi. Backend uçları/veritabanı/migration ve bağımlılıklar değişmedi. **Bu tur yalnızca frontend deploy gerekir.**

## Doğrulama

- Frontend üretim derlemesi geçti; mevcut Vite büyük paket uyarısı sürüyor. Son farklar ve kaldırılan bileşen/stillerin kullanım yerleri kontrol edildi.
- Gerçek Chrome/React StrictMode/AdminLayout, taklit API ile 1440/768/390/320 px (320×480 kısa ekran dahil): afiş/hikâye görünümü, yatay taşma, uzun ad, düzenleme, Türkçe başlık ve mevcut İngilizce çeviriyi koruma, göster/gizle, afiş sıralama, hikâye süresi, ekleme/silme ve başarısız fotoğraf sonrası **tek kayıtla** yeniden kaydetme geçti.
- Ek kontroller: gerçek fare sürükleme ve klavye sıralama; yükleme/yeniden deneme, sıralama/durum/kaydet/sil hataları, hata sonrası taslak, işlem sürerken X/Escape kilidi, dosya/ürün/süre doğrulaması ve 201. ürünün seçilmesi geçti.
- Kısa koyu mobilde artırılmış kök yazı boyutu, hareket azaltma, mobil işlem menüsü/dış tık/Escape, boş liste ve ürüne bağlanmayan ilk afiş kaydı kontrol edildi. Çalışma zamanı hatası görülmedi.
- Son kontrolde eksik kaydın Tamamla ile açılması ve silme sonrası odağın ekleme düğmesine dönmesi doğrulandı. Özel `VITE_API_URL` önekiyle kayıtlı fotoğraf adresinin bir kez çözülmesi, yeni dosyanın blob önizlemesinin gerçekten açılması ve session token ile fotoğraf yüklenmesi kontrol edildi.
- API/veritabanı ve yüklenen dosyanın sunucuda kalıcılığı testlerde taklittir. Canlı sunucuda/gerçek veritabanında değişiklik yapılmadı. Fiziksel telefon, ekran klavyesi/ekran okuyucu, Zen/Firefox/iOS Safari denenmedi. Yerel test betikleri `frontend/node_modules/.qr-check/showcase*` altında Git dışındadır. Test fotoğrafları aynı yerel örneğe yönlendirilmiştir; uygulama gerçek kayıtların fotoğraf URL'lerini kullanır.

## Görüntüler

- [Web afişler](showcase-banners-1440.png) · [Web hikâyeler](showcase-stories-1440.png) · [Web editör](showcase-editor-1440.png)
- [Tablet afişler](showcase-banners-768.png) · [Tablet hikâyeler](showcase-stories-768.png)
- [Mobil afişler](showcase-banners-390.png) · [Mobil hikâyeler](showcase-stories-390.png) · [Mobil editör](showcase-editor-390.png)
- [Kısa telefon](showcase-stories-320.png) · [Mobil işlem menüsü](showcase-mobile-actions.png)
- [Koyu kısa ekran editörü](showcase-short-dark-editor.png) · [Boş liste](showcase-empty-mobile.png)
