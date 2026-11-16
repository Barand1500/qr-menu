# Gruplar — sade liste / mobil alt pencereler

2026-11-16. Mevcut admin renk ve tema değişkenleri korundu; müşteri menüsü, karşılama, giriş, SMTP ve backend değiştirilmedi. Yeni bağımlılık yok.

## Kullanım

- Tablo başlıkları ve Tip / Sıra / İşlem sütunları kaldırıldı. Görsel ve ad birleştirildi; alt gruplar isim özeti ve açılır hiyerarşiyle gösterilir. Üstte yalnızca Grup ekle var.
- Ada tıklayıp yerinde değiştirin; Enter kaydeder, Escape vazgeçer. Alanın içinde kısa klavye ipucu bulunur; ayrı onay/iptal düğmesi yoktur. Ana dil Türkçe, yoksa ilk etkin dildir. Diğer çeviriler korunur; ayrıntılarda tüm etkin diller ve otomatik çeviri hâlâ kullanılabilir.
- Görsele tek dokunuş dosya seçiciyi açar; seçilen görsel doğrudan kaydedilir. Açık/Gizli kontrolü menü görünürlüğünü değiştirir. Ürün sayısı ürünleri açar; oradan ürün düzenleme/ekleme sayfasına gidilebilir.
- Sağ tık veya `···` aynı işlemleri sunar. Masaüstünde konuma bağlı küçük pencere; telefonda alt pencere. Alt grup doğrudan seçili ana gruba eklenir. Ana grubun altları açılmışsa listenin sonunda da ekleme kısayolu vardır.
- Sıralama modu kaldırıldı. Masaüstünde tutamaçtan fare veya klavyeyle sürükleyin; bırakılacak yerde çizgi belirir. Telefonda tutamaç gizlidir: normal dikey kaydırma sürüklemeye dönüşmez. Her iki görünümde işlem menüsündeki yukarı/aşağı taşı kullanılabilir. Farklı üst gruplar arasında sürükleme, grubu taşımaya dönüştürülmez.
- Arama/filtre varken eksik görünen listeyi yanlışlıkla sıralamamak için sıralama kapalıdır. Alt grup eşleşmesinde ana grup bağlam olarak gösterilir. Sayfalama aile bazındadır; ana grup ile altları farklı sayfalara ayrılmaz. API'deki 200 sınırının ötesindeki gruplar da okunur.
- Ad/görsel/görünürlük/sıra işlemlerinde tekrar istekler engellenir; hata gösterilir. Sıra ve görünürlük hatasında yerel değişiklik geri alınır. Görsel yüklemesi oluşturma işleminden sonra başarısız olursa tekrar Kaydet ikinci bir grup oluşturmaz. Sunucunun ürün/alt grup içeren grupları silme koruması korunur.

## Responsive ve erişim

Telefon tek sütun kullanır; yatay tablo kaydırması yoktur. Uzun isimler satıra bölünür. İşlem/düzenleme/ürün/silme pencereleri alttan açılır, kısa ekranda içeriği kendi içinde dikey kayar. Native dialog ve açık Tab/Shift+Tab döngüsü, Escape, odak dönüşü, güvenli alt boşluk ve hareket azaltma desteği vardır. Sağ tık, hover veya sürükleme tek işlem yolu değildir. Pencereler için kullanılan bileşen ve stiller `frontend/src/components/admin/groups/` altında tutulur.

### Son düzeltme: toast / doğrudan filtre / açık kapatma

- Sayfa içindeki bildirim bandı kaldırıldı. Ortak `AdminToast` bileşeni body portalında sabit konumda görünür; listeyi itmez. Başarı 4 saniye, hata 7 saniye sonra kısa çıkış animasyonuyla kapanır. Fareyle üzerinde dururken veya klavye odağı içindeyken süre durur; ayrılınca yeniden başlar. X ile kapatılabilir. Form ve silme doğrulama hataları, toast kaybolsa da ilgili formda kalır.
- Filtreler artık modal değildir: düğmenin altında küçük panel açılır, seçim anında listeye yansır. Uygula/Listeyi göster adımı kaldırıldı. Panel X/Escape/dış tıklamayla kapanır; sayfayı kilitlemez. Dar/kısa ekranda kendi içinde kayabilir.
- Grup modallarında dış/arka plan tıklaması kapatmaz; X veya Escape kullanılır. Gereksiz Vazgeç düğmeleri kaldırıldı. Başarılı Kaydet/Sil ve açık bir işlem seçimi kendi akışını tamamlar. Bekleyen istek sırasında kapatma engeli korunur. Bu davranış diğer panel sayfalarına topluca uygulanmadı; genel kural AGENTS.md'de kayıtlıdır.
- Chrome/gerçek admin yerleşimi + taklit API ile 1440/390/320 px: toast geldiğinde liste koordinatının değişmemesi, otomatik kapanma, X sonrası yeni toast'ın kapanabilmesi, modal dış tıklamasında dört pencere türünün açık kalması, X/Escape, filtreden anlık seçim ve panel sınırları kontrol edildi. 1440/768/390/320 px mevcut grup akışları tekrar geçti; çalışma zamanı hatası yoktu. Frontend derlemesi geçti; mevcut paket boyutu uyarısı sürer. Canlı sunucu/fiziksel cihaz denenmedi.
- Yerel kontroller `groups-toast.mjs` ve `groups-toast-regression.mjs` altında Git dışında. Frontend deploy yeterli.

[Mobil toast](toast-mobile.png) · [Küçük filtre paneli](filter-mobile.png) · [Web filtre paneli](filter-desktop.png)

### Yerinde düzenleme ve filtre ikonları sadeleştirildi

Ad alanının onay/iptal düğmeleri ve kullanılmayan ikon/stilleri kaldırıldı. Enter/Escape ve mobil klavyede tamam tuşu kullanılır; alan içindeki ipucu `aria-describedby` ile de bağlıdır. Kaydetme sırasında aynı yerde metinle bilgi verilir. Filtrelerin seçili kutusunda tik yoktur; tema vurgu rengi ve `aria-pressed` durumu korunur. Chrome + taklit API'de 1440/390/320 px Enter ile kaydetme, Escape ile istek göndermeden iptal, çevirilerin korunması, ipucu/taşma ve tiksiz seçimin listeye etkisi kontrol edildi. Yerel betik `groups-minimal.mjs` Git dışındadır. Fiziksel telefon/telefon klavyesi denenmedi.

[Mobil ad alanı](rename-mobile.png) · [Tiksiz filtre](filter-minimal.png)

İpucunun konumu düzeltildi: alta ayrılan satır kaldırıldı; ipucu alanın sağ ucunda, metinle aynı hizada. Web alanı yaklaşık 42 px, mobil alan 46 px yüksekliğinde. Telefonda yalnızca kısa "Enter ile kaydet" görünür; Escape davranışı korunur. Düzenleme sırasında mobil ad alanı son sütuna kadar genişler. Chrome + taklit API'de 1440/390/320 px alan yüksekliği, ipucunun sağda/dikey ortada olması, metinle çakışmaması ve Enter/Escape akışları doğrulandı. Güncel betik `groups-inline-hint.mjs` Git dışındadır.

## Doğrulama

- Frontend üretim derlemesi geçti. Mevcut Vite büyük paket uyarısı sürer. Backend/şema değişmedi; bu tur frontend deploy yeterli.
- Yerel Chrome, gerçek AdminLayout + GroupsPage + sağlayıcılar (StrictMode), taklit API ile 1440/768/390/320 px: ilk görünüm, yatay taşma, altları açma, yerinde ad değiştirme/çevirilerin korunması, durum değiştirme ve hata dönüşü, taşıma, sağ tık/Escape, ana/alt grup oluşturma, ürün listesi, arama/filtre, görsel yükleme ve silme geçti.
- Fare ve klavye sürüklemesinin API sıralama yükü kontrol edildi. Ek testlerde sıra hatasında eski konum, ad hatasında taslak/iptal, geçersiz görsel, ürün hata/tekrar dene/odak dönüşü, silme hatasında kaydın korunması, 320×480 form/başarısız görsel/tekrar kaydetmede tek kayıt, 205 ana grup ve alt grup için çoklu API sayfası/aile sayfalama, boş liste ve ilk yükleme hatasında tekrar dene geçti.
- Koyu mobil görünüm, hareket azaltma ve 12 Tab adımında odağın işlem penceresinde kalması kontrol edildi. İlk turda görülen mobil filtre erişilebilir adı ve Tab odağının dışarı çıkması düzeltildi; tekrar kontroller geçti. Çalışma zamanı hatası yok.
- Canlı API/veritabanı/deploy, fiziksel cihaz, ekran okuyucu, gerçek telefon klavyesi ve Zen/iOS Safari denenmedi. API test verisidir; ekran görüntülerindeki görseller yerel örnek görseldir. Yerel betikler `frontend/node_modules/.qr-check/groups.mjs`, `groups-edge-final.mjs`, `groups-fixture.tsx` altında Git dışında tutulur.

[Masaüstü](desktop.png) · [Mobil](mobile.png) · [Mobil işlemler](mobile-actions.png) · [Sağ tık](desktop-context.png) · [Kısa telefon formu](short-phone-form.png) · [Koyu mobil](mobile-dark.png)

Responsive yönü AGENTS.md'ye kaydedildi. Diğer panel sayfaları bu tur dönüştürülmedi. Commit/push/deploy yapılmadı.
