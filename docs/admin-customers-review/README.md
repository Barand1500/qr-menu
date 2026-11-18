# Müşteriler — 18 Kasım 2026

Masaüstünde müşteri listesi ve kart yan yana; 1023 px altında kart alttan açılır. Kartta Puan, Özel indirim, Borç ekle ve Ödeme al seçeneklerinden yalnızca seçilen işlemin formu gösterilir. Hareketler ve puan ödülleri ayrı alanlardır. Kısa giriş animasyonları ve hareket azaltma desteği vardır.

## Doğrulama

- Frontend TypeScript / Vite üretim derlemesi geçti. Mevcut büyük paket uyarısı sürer.
- Gerçek Chrome, gerçek AdminLayout ve taklit API ile 1440, 1024, 768, 390 ve 320 px yerleşimleri; 320x480 kısa ekran, uzun isim/iletişim/notlar ve büyütülmüş temel yazı ölçüsü kontrol edildi. Yatay belge taşması yok.
- Kod doğrulaması öncesinde müşteri ayrıntısı istenmemesi, hatalı koddan sonra yeniden deneme ve kodla kart açma doğrulandı. QR desteği olmayan Chrome ortamında kod girişine dönüş kontrol edildi; gerçek kamera ile QR okutulmadı.
- Puanı sıfırlama, indirim uygulama/kaldırma, borç/ödeme, virgüllü tutarın doğru gönderilmesi, hata sonrası taslağın korunması, kayıt sürerken işlemlerin kilitlenmesi, hareketler/sayfalama/geri alma doğrulandı.
- Arama, geciken eski arama yanıtının yok sayılması, borçlu filtresi, sayfalama, şifreli silmede hatalı şifre ve son kayıttan sonra geçerli sayfaya dönüş doğrulandı.
- Dört ödül türü, düzenleme, aktif/pasif, silme onayı, hata/yeniden deneme ve ödüller yüklenemezken kaydın engellenmesi doğrulandı. Açılır ürün/grup seçicisinde ilk Escape yalnızca seçiciyi kapatır.
- Mobil kart ve formlarda dış tıkla kapanmama, X/Escape ve kayıt sırasında kapanma kilidi kontrol edildi. Boş liste, yükleme hataları, koyu tema ve azaltılmış hareket kontrol edildi. JavaScript/React hatası görülmedi.

Yerel kontrol betikleri `frontend/node_modules/.qr-check/customers-v2.mjs` ve `customers-edge.mjs` altındadır; node_modules Git'e dahil değildir. Ekran görüntülerindeki müşteri, bakiye, iletişim ve ödüller test verisidir. Canlı müşteri kaydı değiştirilmedi. Fiziksel telefon, gerçek ekran klavyesi, ekran okuyucu, Safari ve Zen denenmedi.

## Görseller

- [Masaüstü müşteri kartı](customers-card-desktop.png)
- [Mobil işlem seçimi](customers-mobile-actions.png)
- [320 px müşteri listesi](customers-list-320.png)
- [Kısa ekran puan formu](customers-short-form.png)
- [Puan ödülleri](customers-rewards.png)
- [Mobil ödül formu](customers-reward-mobile-form.png)
- [Koyu tema](customers-dark-profile.png)

Yalnızca müşteriler sayfası ve ona ait doğrulama penceresi değişti. Backend/API/şema, müşteri menüsü, karşılama ve giriş ekranları değiştirilmedi. Frontend deploy yeterlidir; commit/push/deploy yapılmadı. Kullanıcının SUNUCU-KOMUTLAR.txt değişikliği kapsam dışıdır.
