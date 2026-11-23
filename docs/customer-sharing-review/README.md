# Müşteri tarafında küçük paylaşım kontrolleri

23 Kasım 2026. Mevcut Sahne tasarımı korundu; yeni bağımlılık veya backend değişikliği yok.

- Seçili kategori başlığında ve ürün detayının üst çubuğunda küçük paylaşım simgesi.
- İletişim kartında işletmenin harita bağlantısını gönderen “Konumu paylaş”. Konum bilgisi yoksa görünmez; cihazdan konum istenmez.
- Kısa animasyonlu, ekran kenarlarında taşmayan küçük panel: WhatsApp, Telegram, bağlantıyı kopyala ve destekleyen tarayıcıda sistem paylaşımı (“Diğer”). Dış tık/X/Escape kapatır; sayfayı kilitleyen modal değildir.
- Ürün/kategori bağlantıları doğrudan mevcut public rotalardan üretilir; masa kodu, kampanya ve oturum sorguları eklenmez. Mevcut servis/masa erişim kuralları değiştirilmedi.
- Panoya erişim engellenirse eski tarayıcı kopyalama yöntemi denenir; o da başarısızsa elle kopyalanabilir bağlantı gösterilir. Başarı doğrulanmadan “kopyalandı” denmez. Sistem paylaşımı iptali hata olarak gösterilmez.
- Tema önizlemesinde, ana menüde ve arama sonuçlarında kategori paylaşımı gösterilmez. Mevcut kart resmi paylaşımı/indirmesi korunur.

## Kontrol

- npm.cmd run build --prefix frontend: TypeScript ve Vite geçti. Mevcut büyük bundle uyarısı devam ediyor.
- Yerel bileşen fixture'larıyla gerçek Chrome/Playwright: 320×640, 390×844, 768×800, 1280×800, 1440×900. Popover sınırları, yatay taşma, uzun kategori adı, çok görselli ürün detayı, kart paletleri ve hareket azaltma kontrol edildi.
- WhatsApp/Telegram URL içeriği, sorgu bilgilerinin dışarı taşınmaması, kopyalama başarı/izin hatası/eski yöntem/elle kopyalama; sistem paylaşımı başarı/iptal/hata senaryoları tarayıcı API taklitleriyle doğrulandı.
- Paylaşım desteklenmeyen tarayıcı, X/Escape/dış tık ve Escape sonrası odak dönüşü kontrol edildi. Sayfa JavaScript hatası yok.
- Mevcut iletişim kartı fixture'ı da 320/390/1280 px genişliklerinde geçti: çevirme, paylaşım balonları ve PNG indirme, taşma yok.
- Public kategori/ürün rotaları kaynak kodda kontrol edildi. Canlı sunucu verileriyle uçtan uca gezinme, fiziksel telefon ve gerçek WhatsApp/Telegram/sistem penceresine gönderim yapılmadı. Görseller yerel test verisidir; üretim ekranı değildir.

## Görüntüler

- [Masaüstü kategori](desktop.png)
- [Telefon kategori](mobile.png)
- [Dar telefon / uzun ad](narrow.png)
- [Tablet](tablet.png)
- [Ürün detayı masaüstü](product.png)
- [Ürün detayı telefon](product-mobile.png)
- [Konum paylaşımı](location.png)
- [Açık renk kart](location-light.png)
