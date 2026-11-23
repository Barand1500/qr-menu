# Diğer penceresi ve yönetici mesajına giriş

23 Kasım 2026.

- Zarf ikonu ve numaralı bağlantılar ortak sütunlara hizalandı; Yöneticiye yaz satırındaki fazladan boşluk giderildi.
- Masaüstünde gezinti, oyunlar ve Ne yesem alanı pencere yüksekliğine göre küçülür. Normal form, öneri/şikâyet seçimi ve gönderme düğmesi de pencereye sığar. Çok kısa ekranlarda metin alanı daha kısa tutulur.
- İsteğe bağlı geri dönüş alanları masaüstünde küçük bir panel olarak açılır; pencereyi aşağı doğru uzatmaz. Telefonda mevcut okunabilir dikey akış korunur.
- Yönetici görünümüne geçiş kısaltıldı. Dinamik yazı sırasında başlık/alt şeridin stabil çizilmesi için bu görünümün arka planı ve katmanları düzenlendi.
- Masaüstünde mesaj alanına odaklanır; kısa bir örnek metin imleçle yazılır, bekler ve geri silinir. Bu yalnızca görsel bir katmandır: gerçek textarea değeri, karakter sayısı ve gönderim içeriği değişmez. Kullanıcının tıklaması, yazması, yapıştırması veya IME girişi örneği durdurur. Başka bir kontrole yönelmiş kullanıcıdan odak alınmaz. Örnek bir kez oynar; yeniden açılırsa tekrar başlayabilir.
- Mobilde otomatik odak/örnek yazma yok; klavye kendiliğinden açılmaz. Hareket azaltmada yazma animasyonu oynatılmaz.

## Kontrol

Frontend TypeScript/Vite derlemesi geçti; mevcut büyük paket uyarısı devam ediyor. Chrome fixture ile 1366×744, 1267×712, 1024×640, 1440×900, 1280×600, 390×844 ve 320×640 kontrol edildi. Masaüstünde hem ana görünüm hem yönetici formu ve geri dönüş paneli için scrollHeight/clientHeight ölçümleri; bağlantı hizası, yazma/silme, gerçek mesajı koruma, gönderilen payload, odak, mobil klavye davranışı ve hareket azaltma doğrulandı. JavaScript/yatay taşma hatası yok. Fiziksel cihaz ve Zen tarayıcısında ayrıca denenmedi; backend değiştirilmedi.

## Görüntüler

- [Masaüstü Diğer](1366-explore.png)
- [Yazma animasyonu sırasında](1366-manager.png)
- [Kısa masaüstü Diğer](1280-explore.png)
- [Kısa masaüstü formu](1280-manager.png)
- [Telefon Diğer](390-explore.png)
- [Telefon formu](390-manager.png)
