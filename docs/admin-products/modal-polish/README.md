# Ürün modalı — alan ve başlık sadeleştirmesi

17 Kasım 2026

- Grup ve fiyat aynı yükseklik/genişlikte hizalanır; kenarlık ve etiket satırları eşitlenir. Mobilde iki alan tek sütunda aynı ölçüde kalır.
- Hazırlanma/kalori alanlarının yerel sayı okları bu forma özel gizlenir; sayısal giriş, mobil sayısal klavye ve doğrulama korunur.
- Önerilen ürün seçimi, başlığın yanında yıldızlı ve durumunu gösteren bir anahtara taşındı. Klavye odağı ve `role=switch`/`aria-checked` desteği var. Menüde aktif kontrolü ve boşta kalan alt satır/stilleri kaldırıldı. Yeni ürünün varsayılan görünürlüğü, mevcut ürünün gizli/aktif durumu ve liste üzerinden görünürlük yönetimi korunur.
- Ad alanı altındaki ücretsiz geliştirme/API arama durum metinleri kaldırıldı. Öneri listesi alanın 4 px altında açılır; kısa ekranlarda kendi içinde kayacak biçimde yüksekliği sınırlanır. Başarısız isteğe ait hata bilgisi ve seçilen tarifin kaynak/alan bilgileri korunur. API bağlantısı ve boş alanları doldurma davranışı değişmedi.

## Kontrol

- Frontend üretim derlemesi geçti; mevcut Vite büyük paket uyarısı sürer.
- Chrome/gerçek React StrictMode + AdminLayout ve taklit API: 1440/768/390/320 px (320×480 kısa ekran dahil) taşma, grup/fiyat ölçüleri, başlık seçimi ve kaydetme isteğinde önerilen işareti, sayı oklarının gizlenmesi, teknik arama yazısının olmaması ve 4 px öneri aralığı doğrulandı. Gizli ürünü düzenleyip kaydetmek ürünü aktifleştirmedi; sayısal alanlar kaydedildi.
- API/veritabanı, fiziksel telefon, Zen/Firefox/Safari ve ekran okuyucu üzerinde test yapılmadı. Tarayıcı betikleri `frontend/node_modules/.qr-check/modal-polish*` altında Git dışındadır. Bu tur yalnızca frontend deploy gerekir.

## Görüntüler

- [Web formu](modal-polish-1440.png) · [Tablet formu](modal-polish-768.png)
- [Mobil formu](modal-polish-390.png) · [Kısa telefon formu](modal-polish-320.png)
- [Web arama önerileri](modal-search-1440.png) · [Mobil arama önerileri](modal-search-390.png) · [Kısa telefon arama önerileri](modal-search-320.png)
