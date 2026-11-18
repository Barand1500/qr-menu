# Şikayet Kutusu kontrolü — 2026-11-18

Gerçek Chrome ve React AdminLayout, taklit API verileriyle çalıştırıldı. İşletme verileri değiştirilmedi.

- complaints-1440/1024/768/390/320.png: web/tablet/telefon, uzun isim ve mesaj.
- reader-320-short.png, reply-320-short.png: kısa telefon ekranında okuma ve yanıt.
- complaints-reply.png: masaüstü yanıt hazırlama.
- complaints-empty.png, complaints-dark-empty.png, complaints-dark.png: boş ve koyu tema.

İki tam test paketi geçti: yeni Şikayet Kutusu ve ortak bileşene taşınan mevcut Öneri Kutusu. Arama/geç yanıt, okunmamış filtresi, okundu işaretleme, silme başarı/hataları, sayfalama/son kaydı silme, mobil dış tık/Escape/işlem kilidi, tekrar deneme, boş durum, koyu tema ve azaltılmış hareket kontrol edildi. Beş genişlikte yatay taşma ve JavaScript/React console hatası yok.

Şikayette puan alanı gösterilmediği ve e-posta taslağının Şikayet yanıtı konusunu kullandığı doğrulandı. Yanıt URL'si window.open taklidiyle kontrol edildi; gerçek mesaj gönderilmedi. Okundu bir çözüm durumu değildir.

Fiziksel cihaz, ekran klavyesi, ekran okuyucu ve Safari/Zen test edilmedi.
