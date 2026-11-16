# Gruplar — sade liste / mobil alt pencereler

2026-11-16. Mevcut admin renk ve tema değişkenleri korundu; müşteri menüsü, karşılama, giriş, SMTP ve backend değiştirilmedi. Yeni bağımlılık yok.

## Kullanım

- Tablo başlıkları ve Tip / Sıra / İşlem sütunları kaldırıldı. Görsel ve ad birleştirildi; alt gruplar isim özeti ve açılır hiyerarşiyle gösterilir. Üstte yalnızca Grup ekle var.
- Ada tıklayıp yerinde değiştirin; Enter veya onay düğmesi kaydeder, Escape vazgeçer. Ana dil Türkçe, yoksa ilk etkin dildir. Diğer çeviriler korunur; ayrıntılarda tüm etkin diller ve otomatik çeviri hâlâ kullanılabilir.
- Görsele tek dokunuş dosya seçiciyi açar; seçilen görsel doğrudan kaydedilir. Açık/Gizli kontrolü menü görünürlüğünü değiştirir. Ürün sayısı ürünleri açar; oradan ürün düzenleme/ekleme sayfasına gidilebilir.
- Sağ tık veya `···` aynı işlemleri sunar. Masaüstünde konuma bağlı küçük pencere; telefonda alt pencere. Alt grup doğrudan seçili ana gruba eklenir. Ana grubun altları açılmışsa listenin sonunda da ekleme kısayolu vardır.
- Sıralama modu kaldırıldı. Masaüstünde tutamaçtan fare veya klavyeyle sürükleyin; bırakılacak yerde çizgi belirir. Telefonda tutamaç gizlidir: normal dikey kaydırma sürüklemeye dönüşmez. Her iki görünümde işlem menüsündeki yukarı/aşağı taşı kullanılabilir. Farklı üst gruplar arasında sürükleme, grubu taşımaya dönüştürülmez.
- Arama/filtre varken eksik görünen listeyi yanlışlıkla sıralamamak için sıralama kapalıdır. Alt grup eşleşmesinde ana grup bağlam olarak gösterilir. Sayfalama aile bazındadır; ana grup ile altları farklı sayfalara ayrılmaz. API'deki 200 sınırının ötesindeki gruplar da okunur.
- Ad/görsel/görünürlük/sıra işlemlerinde tekrar istekler engellenir; hata gösterilir. Sıra ve görünürlük hatasında yerel değişiklik geri alınır. Görsel yüklemesi oluşturma işleminden sonra başarısız olursa tekrar Kaydet ikinci bir grup oluşturmaz. Sunucunun ürün/alt grup içeren grupları silme koruması korunur.

## Responsive ve erişim

Telefon tek sütun kullanır; yatay tablo kaydırması yoktur. Uzun isimler satıra bölünür. Filtre/işlem/düzenleme/ürün/silme pencereleri alttan açılır, kısa ekranda içeriği kendi içinde dikey kayar. Native dialog ve açık Tab/Shift+Tab döngüsü, Escape, odak dönüşü, güvenli alt boşluk ve hareket azaltma desteği vardır. Sağ tık, hover veya sürükleme tek işlem yolu değildir. Pencereler için kullanılan bileşen ve stiller `frontend/src/components/admin/groups/` altında tutulur.

## Doğrulama

- Frontend üretim derlemesi geçti. Mevcut Vite büyük paket uyarısı sürer. Backend/şema değişmedi; bu tur frontend deploy yeterli.
- Yerel Chrome, gerçek AdminLayout + GroupsPage + sağlayıcılar (StrictMode), taklit API ile 1440/768/390/320 px: ilk görünüm, yatay taşma, altları açma, yerinde ad değiştirme/çevirilerin korunması, durum değiştirme ve hata dönüşü, taşıma, sağ tık/Escape, ana/alt grup oluşturma, ürün listesi, arama/filtre, görsel yükleme ve silme geçti.
- Fare ve klavye sürüklemesinin API sıralama yükü kontrol edildi. Ek testlerde sıra hatasında eski konum, ad hatasında taslak/iptal, geçersiz görsel, ürün hata/tekrar dene/odak dönüşü, silme hatasında kaydın korunması, 320×480 form/başarısız görsel/tekrar kaydetmede tek kayıt, 205 ana grup ve alt grup için çoklu API sayfası/aile sayfalama, boş liste ve ilk yükleme hatasında tekrar dene geçti.
- Koyu mobil görünüm, hareket azaltma ve 12 Tab adımında odağın işlem penceresinde kalması kontrol edildi. İlk turda görülen mobil filtre erişilebilir adı ve Tab odağının dışarı çıkması düzeltildi; tekrar kontroller geçti. Çalışma zamanı hatası yok.
- Canlı API/veritabanı/deploy, fiziksel cihaz, ekran okuyucu, gerçek telefon klavyesi ve Zen/iOS Safari denenmedi. API test verisidir; ekran görüntülerindeki görseller yerel örnek görseldir. Yerel betikler `frontend/node_modules/.qr-check/groups.mjs`, `groups-edge-final.mjs`, `groups-fixture.tsx` altında Git dışında tutulur.

[Masaüstü](desktop.png) · [Mobil](mobile.png) · [Mobil işlemler](mobile-actions.png) · [Sağ tık](desktop-context.png) · [Kısa telefon formu](short-phone-form.png) · [Koyu mobil](mobile-dark.png)

Responsive yönü AGENTS.md'ye kaydedildi. Diğer panel sayfaları bu tur dönüştürülmedi. Commit/push/deploy yapılmadı.
