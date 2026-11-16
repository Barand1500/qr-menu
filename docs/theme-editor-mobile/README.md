# Mobil tema ayarları — 2026-11-16

- Mobil düzenleme alanından fotoğraf değiştirme, dekoratif yazı ve görünen işletme adı kaldırıldı. Masaüstündeki karşılıkları ve kayıtlı değerleri korundu.
- Karşılama önizlemesi gerçek mobil bileşenin fotoğraf kolajını, italik başlığını ve alt işlem alanını kullanır. Düzenlerken fotoğraf hareketi durur. Görseller Vitrin Görselleri / Ürünler / Gruplar kaynaklarından gelir.
- Admin tema API'si oturumdaki işletmenin slug ve grup görsellerini döndürür. Önizleme yalnızca o işletmenin menü/hikâye/kategori/ürün verilerini okur; host üzerinden başka işletme çözümlemez. Veri alınamazsa mevcut admin örnekleri kullanılır.
- Metinler hem sağdaki alanlardan hem önizlemeden düzenlenir; Kaydet mevcut sürüm kontrolüyle yayınlar. Çalışma saatleri mobil karşılama ve menüde alt yazının hemen altında görünür; boş bırakılırsa gizlenir.
- Önizleme kategori seçimi ve araması çalışır. Hesap, hikâye görüntüleme, servis/sepet ve geri bildirim işlemleri müşteri işlemi oluşturmaz. Önizlemedeki müzik düğmesi ses çalmaz.

## Kontrol

Frontend/backend üretim derlemeleri ve backend `test:sofra` geçti. Mevcut Vite paket boyutu uyarısı sürüyor. Backend testi gerçek auth/yetki ve kayıt rotalarını taklit veritabanıyla sınar; canlı veri değiştirilmedi.

Yerel Chrome, gerçek React bileşenleri ve taklit API ile:

- 1440 ve 390 px genişliğinde admin: gizlenen alanlar, kolaj/italik başlık/hikâyeler/alt araçlar, satır içi ve sağ panel metin düzenleme, saatlerin konumu, Kaydet/yenile/geri al.
- Kategori seçici fare ve klavyeyle açıldı; kategori ürünleri okundu. Iframe odak/Escape/kaydırma kilidi kendi document'ını kullanır.
- Masaüstü alanları korundu; geçersiz dosya, yayın öncesi görsel hazırlama, 409 hatasında taslağın korunması, tekrar Kaydet ve yenileme kontrol edildi.
- 320×568 ve 390×844 müşteri ekranlarında hareket azaltma ile mobil karşılama/menü saatleri ve yatay taşma kontrol edildi.

Canlı sunucu, gerçek veritabanı, fiziksel telefon ve Safari/Zen denenmedi. Fotoğraflar testte yerel örnek görsel kırpmalarıyla temsil edilir; ekran görüntülerindeki işletme/metinler test verisidir. Betikler `frontend/node_modules/.qr-check/theme-mobile.mjs` ve `theme-desktop-save.mjs` altında Git dışında tutulur.

[Karşılama önizlemesi](welcome-preview.png) · [Menüde alt yazı ve saatler](menu-hours.png)

Frontend ve backend birlikte deploy edilmeli; migration gerekmez. Commit/push/deploy yapılmadı.
