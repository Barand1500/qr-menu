# Anlaşılır öne çıkar seçimi

17 Kasım 2026

- Başlıktaki belirsiz Önerilen etiketi, **Öne çıkar / Menünün üstünde göster** açıklaması ve durum anahtarıyla değiştirildi. Seçili başlık **Öne çıkarılacak** olur. Yıldız kısa bir hareketle canlanır; anahtar yumuşakça geçer. Sürekli animasyon yoktur; hareket azaltma tercihinde hareket kaldırılır.
- Seçimde mevcut AdminToast kullanılır: “Bu lezzet başrolde! Kaydettiğinde menünün üstündeki önerilen ürünler arasında görünecek.” Kaldırınca kategorisinde kalacağını ve yine Kaydet gerektiğini söyler. Değişiklik anında yayınlanmaz, form taslağında kalır.
- Toast sayfayı kaydırmaz, dört saniyede kapanır; üzerine gelme/odakta bekler, X ile de kapanır. Ürün modalı mobilde açıkken toast Kaydet'in üzerinde durur; başlıktaki yeni seçimi örtmez. Diğer sayfalardaki standart toast konumu korunur. AdminToast'a yalnızca isteğe bağlı CSS sınıfı desteği eklendi.
- Klavye/dokunma, `role=switch` ve `aria-checked`, gönderim sırasında kilit ve mevcut kayıt verisi korunur. Yeni API, bağımlılık veya veri değişikliği yoktur. Backend/müşteri menüsü/karşılama/diğer panel sayfaları değiştirilmedi.

## Kontroller

Frontend üretim derlemesi geçti; mevcut Vite büyük paket uyarısı sürer. Gerçek Chrome/React/AdminLayout + taklit API'de 1440/768/390/320 px (320×480 dahil) seç/aç/kapat, yıldız animasyonu, klavyeyle seçim, toast'ın kendiliğinden kapanması ve X, yerleşim kaymaması, yalnızca taslak güncelleme ve Kaydet verisi kontrol edildi. Koyu kısa mobil ve hareket azaltma kontrolü geçti. Canlı veritabanı/fiziksel cihaz, ekran okuyucu veya Zen/Safari denenmedi. Yerel betikler `frontend/node_modules/.qr-check/featured*` altında Git dışındadır. Bu tur frontend deploy yeterlidir.

## Görüntüler

- [Web seçimi](featured-selected-1440.png) · [Web toast](featured-toast-1440.png)
- [Mobil toast](featured-toast-390.png) · [Kısa telefon seçimi](featured-selected-320.png) · [Kısa telefon toast](featured-toast-320.png)
- [Hareket azaltma / koyu kısa telefon](featured-reduced-dark-320.png)
