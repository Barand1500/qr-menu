# Öneri Kutusu kontrolü — 2026-11-18

Gerçek Chrome ve React AdminLayout kullanıldı; API yanıtları taklit edildi. İşletme verisi değiştirilmedi.

- suggestions-1440/1024/768/390/320.png: gelen kutusu, uzun isimler ve mobil liste.
- reader-320-short.png ve reply-320-short.png: 320x480 kısa ekranda okuma ve yanıt alanı.
- suggestions-reply.png: masaüstü yanıt düzeni.
- suggestions-empty.png, suggestions-dark-empty.png ve suggestions-dark.png: boş ve koyu tema görünümleri.

Arama ve geciken yanıt koruması, okunmamış filtresi, okundu işaretleme, silme onayı ve hataları, sayfalama, son sayfadaki son kaydın silinmesi, mobil dış tık/Escape/işlem kilidi, GET hatası/tekrar deneme, anonim ve yalnızca puan içeren öneriler doğrulandı. Beş genişlikte yatay taşma ve JavaScript/React console hatası yok. Hareket azaltma kontrolü geçti.

E-posta yanıt URL'si window.open taklidiyle kontrol edildi; dış uygulama açılmadı, mesaj gönderilmedi. İstatistiklerde istenmeyen iki yazı ve eski boşluk alanının kaldırılması da kontrol edildi.

Fiziksel telefon, ekran klavyesi, ekran okuyucu ve Safari/Zen denenmedi. Önceki turda testin son seçicisi iki zarf görseline eşleşmişti; seçici yalnızca görünür gelen kutusuna daraltılarak tüm test 18 Kasım'da başarıyla tamamlandı.
