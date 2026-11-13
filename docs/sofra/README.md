# Sofra — tek tasarım ve görsel editör

Sofra, 13 Kasım 2026 tarihinde seçilen karşılama ve menü tasarımıdır. Müşteri ekranlarında tema seçimi yoktur.

**Güncel PC görünümü:** Kullanıcı daha sonra Masaya Otur yönünü seçti. 1024 px ve üstünde 3D sofra uygulanır; aşağıdaki eski Sofra görünümü dar ekranlarda korunur. Güncel uygulama, sınırlar ve ekran görüntüleri [Masaya Otur notlarında](../masaya-otur/README.md) bulunur. Ayrı mobil tasarım henüz yapılmadı.

## Kullanım

1. Yönetim panelinde **Başlangıç Ayarları → Tema Ayarları** açılır. Oyun Ekranı aynı menüde kalır.
2. Karşılama veya Menü seçilir. Telefon/masaüstü ve düzenlenecek dil seçilebilir.
3. Önizlemedeki yazıya tıklanıp doğrudan yazılır. İşletme adı, yuvarlak rozetin yazısı ve varsayılan **Şefin Yıldızı** başlığı da önizlemeden düzenlenebilir. Fotoğrafa tıklayınca dosya seçimi açılır.
4. Çalışma saatleri isteğe bağlıdır. Ürünler ve fiyatlar, mevcut Ürünler ekranında yönetilir.
5. **Kaydet** denene kadar değişiklikler yalnızca taslaktadır. Kaydetme başarısızsa taslak korunur; başarılı kayıttan sonra yeni açılan/yenilenen müşteri ekranları kayıtlı hali gösterir.

Kaydedilmemiş değişikliklerle sekmeden ayrılırken uyarı gösterilir. Taslak kalıcı bir otomatik kayıt değildir; tarayıcı geçmişiyle gezinme veya sayfayı kapatma öncesinde Kaydet kullanılmalıdır.

## Örnek önizlemeler

Görseller gerçek bileşenlerin yerel Chrome'da, örnek ZEEN verisi ve taklit API ile alınmış görüntüleridir; canlı sunucu verisi değildir.

- [Telefon karşılama](welcome-mobile.png)
- [Telefon menü](menu-mobile.png)
- [Görsel editör](editor-preview.png)

## Korunan akışlar

- QR masa/grup ve kampanya bağlamı; konum, bakım ve masa kodu kapıları.
- Dil, kategori, alt grup, arama, stok/tükenmiş ürün ve para birimi gösterimi.
- Ürün fotoğraf galerisi, içerik/alerjen bilgisi, seçenekler, sepete ekleme ve masaya sipariş/garson isteği.
- Hikâyeler, vitrin duyuruları, beslenme tercihleri, müşteri profili, hakkında/sosyal bağlantılar, öneri ve şikâyet kutuları.
- Mevcut oyun yapılandırması ve etkin olduğunda menü asistanı.

Karşılama bir ana düğmeyle menüye açılır. Beslenme tercihleri zorunlu bir adım değildir. Mobilde kategori şeridi, arama, tam genişlikte hikâyeler ve alt araç çubuğu kullanılır; vitrin bannerları yalnızca masaüstünde görünür. Basit ürünler listeden eklenir; seçenekli veya seçenek bilgisi henüz bilinmeyen ürünler güvenli biçimde ürün detayına açılır.

## Sade paneller ve tarayıcı uyumu

- Öneri, şikâyet ve menü asistanı maskotsuz, krem/bordo ortak tasarıma sahiptir. Geri bildirim formları `SofraFeedbackSheet.tsx`, ortak alt panel ve klavye/odak yönetimi `SofraSheet.tsx`, görünüm `sofra-overlays.css` içindedir. Mevcut API uçları ve zorunlu alanlar korunur; başarısız gönderimde metin kaybolmaz.
- Sepet ve Diğer paneli masaüstünde de alttan açılır. Oyun, profil ve beslenme panellerinin açılışı da aşağıdan gelir. Hareket azaltma tercihi desteklenir. Diğer paneli artık Sofra'nın açık renklerini kullanır.
- Uzun restoran adları telefonda tam genişliği kullanır. Masaüstü kategori sütunu genişletildi; kategori numaraları daralmaz ve uzun adlar kelime aralarından bölünür.
- Bayraklar emoji veya dış CDN yerine `frontend/public/flags/` altındaki yerel SVG'lerdir. Kaynak: flag-icons; MIT lisansı aynı klasördedir. Yeni dil/ülke eşlemesi eklenirse ilgili SVG de eklenmelidir. Bilinmeyen/yüklenemeyen bayrak için küre simgesi gösterilir.
- Yeni metin anahtarları `sealText` ve `picksLabel`, diğer yazılar gibi dil bazında kaydedilir. Eski kayıtlarda varsayılanlar SOFRA ve Şefin Yıldızı'dır. Frontend ve backend birlikte güncellenmelidir.

Güncel panel örnekleri: [Öneri](feedback-mobile.png), [Şikâyet](complaint-mobile.png), [Diğer](menu-sheet-desktop.png), [Ne yesem?](assistant-desktop.png). Bunlar yerel örnek veriyle alınan ekran görüntüleridir.

Son yerleşim düzeltmeleri: karşılama/menü geniş ekranın tamamını kullanır; önceki 1800 px sınırı kaldırılmıştır. Masaüstü asistan düğmesi alt araç çubuğunun üst çizgisini ortalar. Arama odağı yalnızca kapsayıcının yuvarlak kenarlığını vurgular; input'a ikinci çerçeve çizilmez. Mobil aktif kategori çizgisi kategori genişliğini kaplar. Hakkımızda dönüşü kompakt ok/metin düğmesidir; garson bildirimi koyu yazılı, sabit açık zeminlidir.

Örnekler: [Geniş ekran](layout-desktop.png), [Mobil arama ve kategori çizgisi](search-mobile.png), [Hakkımızda](about-mobile.png), [Garson bildirimi](waiter-promo.png).

## Kalıcı kayıt ve mimari

- Yeni tablo veya migration yoktur. `Setting` tablosundaki işletmeye özel `sofra_theme_v1` anahtarı kullanılır.
- Ortak bağımlılıksız veri şeması: `backend/src/lib/sofra-config.ts`. Frontend bunu `frontend/src/lib/sofra.ts` üzerinden kullanır. Ortak modülde Prisma, sunucu ayarı veya gizli bilgi bulunmaz; frontend derlemesinde paketlenir.
- Yönetim API'si: `GET/PUT /api/admin/theme-settings`, `POST /api/admin/theme-settings/image`. Gerçek kullanıcı/işletme bilgisi oturumdan alınır; yalnızca yönetici düzenleyebilir.
- Kaydetme bir JSON değerini karşılaştırmalı günceller. Başka oturumda değişiklik varsa 409 döner ve taslağın üzerine yazılmaz.
- Fotoğraflar en fazla 5 MB PNG/JPG/WebP olabilir; sunucuda dosya imzası da kontrol edilir. Görsel yüklenmesi tek başına temayı yayınlamaz; son config kaydı gerekir. Başarısız/terk edilmiş bir kayıt kullanılmayan bir yükleme dosyası bırakabilir; mevcut görseli silmez.
- Eski karşılama mesajları, Sofra editöründe ilgili dilin alt metni ayrıca tanımlanmadığı sürece başlangıç verisi olarak korunur. Açıkça düzenlenmiş Sofra metni önceliklidir.
- `SofraCanvas.tsx` hem gerçek müşteri ekranını hem editör önizlemesini çizer. Telefon önizlemesi gerçek iframe genişliği kullanır; yalnızca masaüstü görünümünü küçültmez.
- Eski tema kaynakları ve kayıtları silinmedi. Eski tema ayar bağlantıları ve eklenti kartları gizli; eski ayar URL'leri yeni editöre yönlenir. Müşteri API'leri tek `sofra` temasını döndürür. `SHOW_LEGACY_THEME_SETTINGS` sadece eski yönetim arayüzünün görünürlüğünü kontrol eder; bu sabit tek başına müşterinin temasını geri değiştirmez.

## Doğrulama

```powershell
npm run build --prefix frontend
npm run build --prefix backend
npm run test:sofra --prefix backend
```

Kalıcı API testi gerçek Express/JWT middleware'i ile bellek içi Prisma taklidi kullanır; gerçek veritabanına bağlanmaz. Yetki, işletme izolasyonu, kayıt/yeniden okuma, eşzamanlı değişiklik, geçersiz veri ve görsel yükleme kontrollerini kapsar. Geliştirme bağımlılıkları kurulu olmalıdır.

Yerel Playwright/Chrome kontrollerinde gerçek müşteri ve editör bileşenleri kullanıldı. Yazarken imleç/kayıt düğmesi, kayıt/yenileme, hata sonrası taslak, fotoğrafın aşamalı yayını, QR sorguları, kategori/alt grup, arama, tükenmiş ürün, seçenek fiyatı, sepet, masaya iletme, oyunlar, beslenme penceresi ve hata sonrası tekrar deneme doğrulandı.

Karşılama/menü 320, 375, 390, 430, 768 ve 1440 piksel genişliklerde kontrol edildi; uzun Türkçe metinler, Arapça/RTL ve eksik ürün fotoğrafı da sınandı. Bunlar tarayıcı kontrolleridir; fiziksel iPhone/Android cihaz ve canlı MySQL/sunucu üzerinde uçtan uca doğrulama yapılmadı. Vite'ın mevcut büyük paket uyarısı sürüyor.

Frontend ve backend birlikte deploy edilmelidir. Yeni görsel `frontend/public/sofra/breakfast.webp` dosyasıdır; Vite bunu derleme çıktısına kopyalar. Veritabanı migration'ı gerekmez. Commit, push ve deploy kullanıcıya bırakılır.

## Görsel kaynağı

Sofra kahvaltı fotoğrafı yerleşik **image_gen** ile bu uygulama için üretildi; başka bir tasarım panosundan kesilmedi. İçeriği değiştirilmeden WebP kodlamasına dönüştürüldü: 1536×1024, yaklaşık 434 KB. Üretim metni [asset-prompt.txt](asset-prompt.txt) dosyasındadır.
