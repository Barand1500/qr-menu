# Mobil menü defteri — 13 Kasım 2026

Kullanıcının mobil geri bildirimi üzerine menü, masaüstünden ayrı MobileBookMenu bileşenine taşındı. SofraMenuView, iframe'in kendi genişliğini kullanarak 1024 px altında kitap görünümünü seçer; masaüstü AtelierMenu korunur.

- İlk menü açılışı fotoğraflı içindekilerdir. Üstte kategori sekmeleri ve seçili kategori çizgisi yoktur. Fotoğraflı bölüme dokunmak gerçek kategori/alt grup verilerini getirir. Ürün detayından geri dönüşte kategori ve defter sayfası sessionStorage kaydıyla korunur; yeni doğrudan açılış içindekilere döner.
- Header: logo object-fit contain ile sabit bir alan kullanır, uzun isim iki satırda tutulur. Dil seçimi görünürde yalnızca bayraktır; erişilebilir yerel select çalışır. Masa bilgisi profil düğmesinin altında yer alır.
- Mobil hikâyeler header altındadır; vitrin banner'ları mobil menüde gösterilmez. Hikâyeler yatay kendi şeridinde gezinir. Alerji uyarısının işlevi korunur.
- Kitap; bölüm/sayfa başlığı, fotoğraf, ürün açıklaması, fiyat/sipariş ve sayfa kontrolünden oluşur. İleri–geri düğmeleri ve yatay dokunma hareketiyle sayfa değişir. Uzun içerik yalnızca defterin iç alanında kayar. Ana belge ekran boyutunda tutulur; dış yatay/dikey sürükleme ve boş kenarlar engellenir. Azaltılmış harekette animasyonlar devre dışıdır.
- Alt çubuk: solda üst üste garson ve sepet; ortada yükseltilmiş dairesel kategori düğmesi; sağda Diğer. Oyunlar Diğer menüsünde kalır. Ne yesem işlevi, defteri kapatan yüzer düğme yerine Diğer menüsünden açılır.
- Kategori düğmesi fotoğraflı, aramalı bir alt panel açar. Açılış ve kategori öğeleri kısa animasyon kullanır; odak panelde tutulur, Escape/arka plan/kapat ile kapanır. Seçim kategoriye doğrudan götürür. Eşleşme yoksa boş sonuç yazısı gösterilir. Panelin arka planı bulanıktır; renkler mevcut kâğıt/orman yeşili dilini sürdürür.

Dosyalar: MobileBookMenu.tsx, mobile-book.css, BookNavigation.tsx. BookNavigationProvider yalnızca Sofra menü dalında kategori paneli durumunu alt çubukla paylaşır. Ortak fiyat/sepet/seçenek/garson/oyun sağlayıcıları değiştirilmedi. Diğer temalara yeni alt çubuk uygulanmaz.

Chrome/taklit API: 320x568, 375x667, 390x844, 430x932, 768x1024; uzun başlık/açıklama, 30'dan fazla kategori ve 667x375 yatay görünüm kontrol edildi. İlk fotoğraflı içindekiler, üst hikâyeler, banner gizleme, kategori arama/boş sonuç, panel kapanması, sayfa değiştirme, seçenek fiyatı/sepete ekleme, ikinci sayfaya dönüş, Diğer içinden yardımcı işlev ve masaüstüne geçiş kontrol edildi. Ana belgede yatay/dikey taşma görülmedi. Test fixture'ı bütün ürün/kategori görsellerinde aynı kahvaltı fotoğrafını kullanır; üretimde işletmenin kendi görselleri kullanılır.

Fiziksel telefon, gerçek iOS/Android klavyesi, Zen ve canlı sunucu test edilmedi; tüm cihazlarda çalıştığı iddia edilmez. Hareket azaltma ve dvh desteklemeyen tarayıcılar için sade geçiş/viewport yedeği vardır. Geçici harness: frontend/node_modules/.qr-check/mobile-book-browser.mjs (Git dışı).

- [İçindekiler](contents.png)
- [Ürün sayfası](product-page.png)
- [Kategori seçicisi](category-picker.png)
