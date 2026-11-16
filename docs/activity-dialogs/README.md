# Oyunlar ve servis — müşteri girişiyle ortak tasarım dili

16 Kasım 2026. Bu görünüm önceki renkli oyun kartları ve servis kutularının yerini alır. Kullanıcının yenilediği CustomerSignIn incelendi: sıcak koyu zemin, Bricolage başlık, italik Instrument Serif vurgu, ince ayırıcılar, sınırlı turuncu ve yuvarlak aksiyonlar kullanıldı. Giriş bileşeni değiştirilmedi.

- **Web oyun lobisi:** solda başlık ve kodla çizilmiş oyun önizlemesi; sağda numaralı, tek tıkla oyunu başlatan liste. Fare/klavye odağı çizimi değiştirir; ek bir başlatma adımı yoktur. Hafıza, XOX, dedektif ve Blitz kuralları/API'leri korunur. Boş katalog için kullanılabilirlik mesajı var. Diğer temaların eski lobi düzeni korunur.
- **Servis:** solda masa bilgisi ve servis çizimi; sağda garson/nargileci/vale listesi. Vale aynı panelde plaka formuna geçer. Renkli kutular ve süs numaraları kaldırıldı. Mevcut masa kodu, API, tekrar çağrı, plaka, hata ve başarı bildirimi akışları değişmedi.
- **Mobil:** iki sütun tek sütuna dönüşür; büyük çizimler gizlenir. 320×568 gibi kısa ekranda servis başlığı sadeleşir. İçerik gerektiğinde panel içinde kayar; dışarı taşmaz. Hareket azaltma tercihi, Escape ve odak tuzağı korunur.
- Eski lobiye ait kullanılmayan 198 satır CSS temizlendi. Yeni oyun lobisi ve ortak SVG çizimleri ayrı bileşenlerdir. Yeni bağımlılık ve backend değişikliği yok; bu tur için frontend deploy yeterli.

## Doğrulama

- Frontend üretim derlemesi geçti; mevcut büyük paket uyarısı sürüyor. Son derlemede sandbox'ın esbuild alt sürecine verdiği EPERM, gerekli süreç izniyle yeniden çalıştırılarak aşıldı.
- Yerel Chrome/gerçek React + taklit API: 320/390/768/1440 px lobi ve servis sınırları; dört oyunun açılması/örnek etkileşimleri; geri/Escape/kaydırma kilidinin kalkması; servis türü/plaka yükleri ve bildirimleri; hata/tekrar deneme; ürün detayından çağrı ve sepet siparişi geçti.
- Ek kontroller: oyun çizimlerinin klavye odağıyla değişmesi, nötr liste zeminleri, Tab/Shift+Tab, İngilizce, hareket azaltma; masa kodunu iptal etme/doğrulama sonrası vale çağrısı, yinelenen yanıt, 320×480 ve kısa ekran geçti. İlk servis ek testindeki eski İngilizce başlık beklentisi güncellendi ve test yeniden geçti.
- Çalışma zamanı hatası görülmedi. Canlı personel/API/çok oyunculu servis, fiziksel telefon, Zen ve iOS Safari denenmedi. Ekranlar örnek API verileri kullanır. Test betikleri Git dışında frontend/node_modules/.qr-check/lobby-redesign*.mjs, services*.mjs içinde. Lobi testinden hikâye kontrolleri çıkarıldı; bu turda hikâyeler yeniden test edilmedi/değiştirilmedi.

[Oyunlar / web](games-web.png) · [Oyun önizlemesi](games-preview.png) · [Oyunlar / mobil](games-mobile.png) · [Servis / web](service-web.png) · [Servis / mobil](service-mobile.png) · [Vale](valet-web.png)
