# Ödül ve müşteri kodu pencereleri — 18 Kasım 2026

Önceki **Yeni kural** ekranı, **Yeni ödül** olarak yenilendi. Büyük tür kutuları kısa bir tür seçimine dönüştü. Çay/kahve ikramı, grup indirimi ve tutar indirimi şablonları kullanıcı seçimiyle formu doldurur; tüm değerler değiştirilebilir. Ürün ve grup ödülleri işletmenin mevcut ürün/grup listesinden seçim gerektirir. Önizleme başlık ve puanı formdan canlı okur. Şablon seçmek tek başına kayıt/yayın yapmaz. Düzenlemede mevcut ödülün türü ve aktifliği korunur.

Müşteri kodu penceresinde masaüstünde yöntem seçimi solda, giriş alanı sağdadır. Telefonda yöntem seçimi üstteki iki büyük düğmeye dönüşür; pencere alttan açılır ve kısa ekranda kendi içinde kayar. Mevcut 6 haneli kod, yapıştırma, QR/kamera desteği, doğrulama, X/Escape ve kayıt sırasında kapatma kilidi korunur. Dış tık kapatmaz.

## Doğrulama

- Chrome/AdminLayout + taklit API ile mevcut müşteri regresyon paketi geçti: kod doğrulama/hatalı kod, puan/indirim/borç/ödeme/geri alma, arama/filtre/sayfalama/silme, dört ödül türü/düzenleme/pasiflik/silme ve yükleme hataları.
- Ek kontrol: şablonun başlık/puan/tutar/yüzdeyi doğru doldurması ve kaydetmeden önce önizlemesi, gerçek grup seçimi, 6 hanenin yapıştırılması, dış tık/Escape, kayıt sırasında kapanma kilidi, 1440/768/390/320 px ve 320x480 kısa ekran, koyu tema ve azaltılmış hareket. JavaScript/React hatası ve yatay belge taşması yok.
- Frontend üretim derlemesi geçti; mevcut büyük Vite paketi uyarısı sürer.

Yerel betikler `node_modules/.qr-check/customers-dialogs-v3.mjs` ve `account-dialogs-focused.mjs` (frontend altında, Git'e dahil değildir). Canlı müşteri/ödül kaydı değiştirilmedi. Gerçek kamera/QR, fiziksel telefon/ekran klavyesi/ekran okuyucu/Safari/Zen denenmedi. Backend/API/şema ve müşteri menüsü değişmedi.

## Görseller

- [Ödül şablonu — masaüstü](reward-template-desktop.png)
- [Ödül şablonu — mobil](reward-template-390.png)
- [Grup indirimi](reward-group-template.png)
- [Kod penceresi — masaüstü](customer-code-desktop.png)
- [Kod penceresi — 320 px](customer-code-320.png)
- [Kısa ekran](customer-code-short.png)

Önceki `admin-customers-review` görsellerindeki kural/kod pencerelerinin yerini bu tasarımlar alır. Diğer müşteri ekranları korunur. Frontend deploy yeterli; commit/push/deploy yapılmadı.
