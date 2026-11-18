# Kullanıcılar — 18 Kasım 2026

Kullanıcı listesi sayfanın ana alanıdır. Panel adresi ve sekme adı, üstteki **Panel ayarları** düğmesinden açılır. Önceki ayarlar korunmuştur; başka bir sayfaya taşınmamıştır.

- Masaüstünde isim, iletişim, rol ve erişim aynı satırdadır. Satıra tıklamak kullanıcıyı düzenler; erişim anahtarı ayrı çalışır.
- Telefonda aynı bilgiler tek sütun halinde görünür. Rol ve erişim aynı alt satıra alınmıştır. Yatay tablo kaydırması yoktur.
- Yeni kullanıcı ve düzenleme pencerelerinde ad, e-posta, şifre, isteğe bağlı telefon, rol ve aktiflik korunur. Düzenlemede boş şifre mevcut şifreyi değiştirmez. Şifre gösterme düğmesi vardır.
- Eski ekranda API varsayılanı nedeniyle yalnızca ilk 10 kullanıcı gösteriliyordu; mevcut API sayfalaması bağlanarak tüm kayıtlar 20'li sayfalarla ulaşılabilir hale getirildi. Arama geciktirilir, eski istekler iptal edilir.
- Başarı/hata toast bildirimi kullanır. Form hataları formda kalır. Başarısız erişim değişikliğinde anahtar yanlış durum göstermez. İşlemler sırasında tekrar gönderim ve pencereyi kapatma engellenir. Dışarı tıklamak pencereleri kapatmaz; X/Escape kullanılır.
- Panel adresi değişikliği mevcut ayrılmış yol doğrulamasını ve eski adresin kapanacağına dair onayı korur. Adres önizlemesi, kayıtta kullanılan normalizasyonla aynıdır. Başarılı değişiklik yeni kullanıcılar adresine yönlendirir. Ayarlar okunamazsa varsayılan değerlerle üzerine yazılmaz; tekrar deneme gösterilir.

## Kontrol

Frontend TypeScript/Vite derlemesi geçti; mevcut büyük paket uyarısı devam eder. Chrome'da gerçek AdminLayout + taklit API kullanıldı:

- 1440/1024/768/390/320 px; uzun isim/e-posta ve 320x480 kısa form. Yatay belge taşması yok.
- Oluşturma/düzenleme, rol, boş şifrenin payload'a eklenmemesi, şifre göster/gizle, kayıt hatasında formun korunması, kayıt sürerken Escape kilidi.
- Erişim aç/kapat başarı ve hata, arama/geciken yanıt, 20'li sayfalama.
- Sekme adı kaydı, ayrılmış adres reddi, adres onayı, kayıt hatası ve başarılı yeni adrese yönlendirme.
- Liste/ayar yükleme hatası ve tekrar deneme, boş liste, koyu tema ve azaltılmış hareket. JavaScript/React hatası görülmedi.

Yerel betik: `frontend/node_modules/.qr-check/users-v1.mjs` (Git'e dahil değildir). Tüm hesaplar ve iletişim bilgileri taklittir. Canlı kullanıcı/şifre/panel yolu değiştirilmedi. Fiziksel telefon, gerçek ekran klavyesi, ekran okuyucu, Safari/Zen ve gerçek personel oturumu denenmedi. Backend yetkileri/API/şema değişmedi; mevcut rol davranışı korunur.

## Görseller

- [Masaüstü liste](users-list-1440.png)
- [320 px liste](users-list-320.png)
- [Düzenleme](users-edit-desktop.png)
- [Kısa mobil form](users-short-form.png)
- [Mobil panel ayarları](users-settings-mobile.png)
- [Koyu tema](users-dark.png)

Menü, karşılama, giriş ve SMTP değiştirilmedi. Frontend deploy yeterli. SUNUCU-KOMUTLAR.txt kullanıcı değişikliği kapsam dışıdır. Commit/push/deploy yapılmadı.
