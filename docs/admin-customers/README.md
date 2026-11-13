# Müşteriler — sade yönetim alanı

13 Kasım 2026 güncellemesi. Müşteri listesi/kartı ve puan ödülleri iki ayrı sekmededir. QR okut ve Kod ile aç düğmeleri üstten erişilebilir. Liste araması, borçlu filtresi, sayfalama, kodla erişim, puan/indirim/borç/ödeme, hareketler ve ödül yönetiminin API sözleşmeleri korunur.

Müşteri doğrulama penceresi `CustomerUnlockModal.tsx` ve yanındaki `customer-unlock.css` içindedir. Eski yeşil stiller `menu-customer.css` dosyasından taşındı. Pencere, sayfadaki transform/animasyondan etkilenmemesi için `document.body` içine portal olarak çizilir. Açık/koyu yönetim renklerini kullanır; Escape, odak sınırı, odağı geri verme ve istek sırasında çift göndermeyi engelleme vardır. Kamera/QR desteği yoksa kod girişine geçilir. Mevcut müşteri kodu doğrulaması ve erişim süresi değişmedi.

Eklentiler sayfası silinmedi. `SHOW_EXTENSIONS_ENTRY = false` yalnızca yan menü alt bağlantısını ve yardım turundaki ilgili adımı gizler. Alt çubuk CSS grid ile görünür üç düğmeyi eşit genişliğe dağıtır; tekrar açıldığında düğme sayısına uyum sağlar.

Yerel Chrome'da gerçek bileşenler ve taklit API ile alınan örnekler:

- [Müşteri kartı — masaüstü](detail-desktop.png)
- [Kod penceresi](unlock-desktop.png)
- [Müşteri kartı — telefon](detail-mobile.png)
- [Üç düğmeli yan menü](sidebar.png)

Kontroller: frontend üretim derlemesi; 320/390/768/1440 px açık/koyu görünüm; arama/borçlu filtresi; hatalı kod ve tekrar deneme; müşteri açma/puan kaydı/hareketler; ödül sekmesi ve düzenleyicisi; modalın ekranı kaplaması/Escape; QR desteği veya kamera erişimi olmadığında alternatif; Eklentiler bağlantısının ve tur adımının gizlenmesi; eşit genişlikte üç alt düğme. Geçici kontroller `frontend/node_modules/.qr-check/customers-*` ve `navigation-test.mjs` içinde Git dışında tutulur.

Gerçek kamera ile QR tarama, fiziksel cihaz ve canlı müşteri veritabanı üzerinde işlem yapılmadı. Backend değişmedi; yalnızca frontend deploy edilir.
