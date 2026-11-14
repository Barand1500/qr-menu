# Tema Ayarları paneli — 14 Kasım 2026

Değişiklik yalnızca yönetim editöründedir. Müşteri karşılama/menü bileşenleri, stilleri ve backend değiştirilmedi.

- Telefon (390×844) ve masaüstü (1280×800) iframe önizlemesi hem genişliğe hem kullanılabilir yüksekliğe göre sığdırılır. Ölçek gösterilir. Dar yönetim ekranında alanlar önizlemenin altına geçer.
- Karşılama/menü sekmelerine göre anlaşılır başlıklarla metin alanları görünür. Seçili dilin metinleri önizleme ile iki yönlü güncellenir. İşletme adı, saat ve fotoğraf kontrolleri aynı yan alandadır. Satır sonları korunur. Önizlemedeki doğrudan düzenleme de devam eder.
- Menüde kategori ve arama, panelin örnek ürünleri üzerinde yerel çalışır. Bu, müşterinin sepet/sipariş akışını başlatan bir önizleme değildir. API'nin örnek ürün/grup sınırı değişmedi.
- İframe stil dosyalarını hazır olduğunda kullanır; sonradan gelen/değişen stilleri eşler. Bekleme sınırlıdır; font/stil yükleme hatasında panel alanları kullanılabilir kalır.
- Kayıt sırasında önizleme düzenleme modunda kalır ve etkileşimi kilitlenir. Böylece müşteri açılışı veya fotoğraf isteği başlatılmaz. Mevcut Kaydet, geri alma, görsel doğrulama, taslak yükleme ve revision tabanlı kayıt sözleşmesi korunur. Fotoğraf yalnızca Kaydet sırasında yüklenir.

Kontrol: frontend üretim derlemesi ve git diff kontrolü; Chrome/taklit API ile 1440/390 px önizlemenin sığması, yatay taşma, telefon/masaüstü geçişi, iki yönlü metin düzenleme, dil ayrımı, kategori seçimi, kaydetme/yeniden açma/geri alma, sonradan eklenen CSS eşleme; geçersiz fotoğraf, kayıt öncesi yükleme olmaması, 409 hatasında taslağın korunması, tekrar kaydetme ve görsel URL'sinin kalıcılığı geçti. Çalışma zamanı hatası görülmedi. Mevcut Vite büyük paket uyarısı sürer.

Gerçek API/veritabanı, fiziksel cihaz, Zen ve iOS Safari test edilmedi. Kontrol betikleri frontend/node_modules/.qr-check/theme-editor.mjs ve theme-editor-save.mjs içinde Git dışındadır. Frontend deploy yeterlidir; migration yoktur.

[Web paneli](desktop.png) · [Dar panel](mobile.png)
