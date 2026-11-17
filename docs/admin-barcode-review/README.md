# Barkod Yazdır — devralma ve tamamlama kontrolü

17 Kasım 2026

## Durum

Claude'un hazırladığı yeni tasarım ve bileşen düzeni korundu. Sayfa derleniyordu; ancak bazı işlevsel hatalar ve tamamlanmamış tarayıcı kontrolleri vardı. Sayfa baştan tasarlanmadı. Mevcut QR Menü / Masalar / Kampanyalar, canlı önizleme, renk/çerçeve/logo/şablon, mobil araçlar, link kopyalama, PNG/SVG ve yazdırma akışları kontrol edildi.

## Düzeltilenler

- **Özel masa adı:** `VIP 3` veya `Özel-3` gibi adlar sırf masa numarasıyla bitiyor diye otomatik ada çevrilmiyor. Grup/önek değiştirilince yalnızca otomatik masa adları yenilenir, özel adlar korunur.
- **Grup formu:** pencere açıkken üst bileşendeki logo/bildirim güncellemesi yazılan taslağı sıfırlamaz.
- **Güvenli veri yükleme:** masa grupları sunucudan alınamazsa yerel görünüm açılır ve hata bildirilir; varsayılan/yerel liste sunucuya otomatik gönderilip mevcut grupların üzerine yazılmaz. İstek iptali/StrictMode ele alındı; masa verisi beklenirken düzenleme ve yazdırma açılmaz. Başarılı yüklemeden sonra mevcut 700 ms gecikmeli otomatik kayıt modeli korunur.
- **Boş baskı çakışması:** eski genel `visibility:hidden` yazdırma kuralına karşı yeni çıktı alanı görünür yapılır. Diğer sayfalar yalnızca barkod baskısı sürerken saklanır; yazdırma bitince HTML/body sınıfları temizlenir. Başka sayfaların baskısı yeni barkod CSS'i yüzünden gizlenmez.
- **Baskıya hazırlık:** çıktı açılmadan yazı tipleri ve SVG içindeki logolar beklenir (en fazla 2,5 saniye); zamanlayıcı ve iki animasyon karesi temizlenir.
- **QR kenar payı:** QR bileşenlerine dört modül boşluk eklendi; bu pay SVG indirmesinde de korunur. Gerekçe: [DENSO WAVE](https://www.qrcode.com/en/howto/code.html), uygulanan özellik: [qrcode.react marginSize](https://github.com/zpao/qrcode.react#marginSize).
- **Logo:** başarısız logo HTTP yanıtı artık görsel sayılmaz; indirme mevcut logosuz devam bildirimiyle ilerler. Güncel ayarlarda logo silinmişse eski kullanıcı nesnesindeki logo yeniden kullanılmaz.
- **Mobil/tablet:** taşmaya yol açan negatif boşluk ve masa seçimlerini örten sabit önizleme kaldırıldı. 320 px alt araç yazıları ayrıldı; dokunma genişlikleri korunur. Tasarım tepsisi araç düğmesine tekrar dokunarak veya Escape ile kapanır.
- **Geç yanıtlar:** başka kampanyaya geçildikten sonra gelen eski ad güncellemesi yeni seçimin geri alma bilgisini değiştirmez; yeni yazılmakta olan adın üzerine eski yanıt basılmaz.
- URL'deki masa, grup ve kampanya değerleri kodlanır. Hareket azaltma tercihinde fareyle eğilme hareketi de durur.

## Korunan kapsam

- API yolları, masa grubu veri şekli ve eski localStorage anahtarları korunur. QR paketi/paketsiz görünüm değişmedi. Backend ve veritabanı değiştirilmedi; yeni bağımlılık/migration yok.
- Kampanya özel menü düzenleyicisi ve eski `PrintDesignerModal` bu tur değiştirilmedi. Eski genel yazdırma stilleri silinmedi; yeni çıktı onlarla birlikte çalışacak şekilde sınırlandı.
- Müşteri menüsü/karşılama, Vitrin Görselleri, ürünler, giriş/SMTP ve diğer panel sayfaları değiştirilmedi. **Yalnızca frontend deploy yeterli.**

## Doğrulama

- Frontend/backend üretim derlemeleri geçti; mevcut Vite büyük paket uyarısı sürüyor.
- Kalıcı test: `node frontend/tests/barcode-layout.test.mjs`. Tüm kart sayılarıyla A4/A5/80 mm/58 mm kart geometrisi, baskı alanına sığma, özel numaralı adları koruma ve kayıtlı veriyi okumada değiştirmeme geçti.
- Chrome/gerçek React StrictMode + AdminLayout ve taklit API ile paketli akışlar 1440/1024/768/390/320 px kontrol edildi: renk/çerçeve/şablon/yazı ve yerel tasarım, masa/grup ekle/düzenle/sil, özel masa adı, kampanya adı/kayıt hatası/ekleme ve taşma.
- Paketsiz görünüm, çağrıdan gelen masa bağlantısı, sunucu hataları, kampanya tekrar deneme/boş liste, 60 masa/uzun ad/koyu görünüm, dış tıklamada açık kalan onay ve yazdırma penceresi geçti.
- Link kopyalama, PNG/SVG indirme, tek kart/tüm grup, A4 kopyalar/kesim çizgisi ve 80 mm akış kontrolleri geçti.
- Ek kontrolde **logolu/renkli SVG ve PNG gerçekten QR okuyucuyla çözüldü**; doğru menü adresi döndü. A4/A5/80 mm/58 mm çıktı alanları `print` medya görünümünde kontrol edildi: görünürlük, 12 kart/sayfa sayısı, fiziksel CSS ölçüleri ve işlem sonrası temizlik. 203 DPI görüntüden QR'lar doğru masa bağlantısı olarak okundu. 96 DPI ekran rasteri 58 mm için baskı kanıtı olarak kullanılmadı.
- GET hatasında sunucuya sıfır PUT, grup taslağını koruma ve azaltılmış harekette fare davranışı ayrıca kontrol edildi. Son kaynak farkları ve kaldırılmayan diğer ekranlar incelendi.
- Yazdırma çağrısı/`afterprint` testte taklit edilir; Chrome'un gerçek `print` CSS'i render edilir. Fiziksel yazıcı, gerçek işletme/veritabanı kaydı, native yazıcı penceresi, Zen/Safari, ekran okuyucu ve fiziksel telefon klavyesi denenmedi. Bu klasördeki fotoğraflar/logolar test verisidir; QR adresleri yerel test sunucusuna gider, işletmede kullanılacak basılı QR değildir.

Yerel tarayıcı betikleri `frontend/node_modules/.qr-check/barcode*` altında Git dışındadır. Commit/push/deploy yapılmadı.

## Görüntüler

- [Web tasarım](b-1440-03-designed.png) · [Masalar](b-1440-05-tables.png) · [Kampanyalar](b-1440-06-campaigns.png)
- [Tablet](b-1024-05-tables.png) · [Mobil](b-390-01-classic.png) · [Mobil renk aracı](b-390-02-tray-color.png) · [320 px](b-320-01-classic.png)
- [Uzun adlar / koyu mobil](ed-03-long-dark-320.png) · [Paketsiz görünüm](fr-390-02-locked.png)
- [Toplu yazdırma](pr-03-dialog-all.png) · [Termal ayarlar](pr-04-thermal.png)
- [A4 çıktı](review-print-a4.png) · [A5 çıktı](review-print-a5.png) · [80 mm çıktı](review-print-80mm.png) · [58 mm çıktı](review-print-58mm.png)
