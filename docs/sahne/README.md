# Sahne — müşteri karşılama ve menü tasarımı

Önceki Atelier (eskiz/kitap) tasarımı kaldırıldı. Yerine koyu zeminli, turuncu/amber vurgulu, hareketli "Sahne" tasarımı geldi. Masaüstü ve mobil ayrı tasarımlardır (kırılma: 1023 px). Kaynaklar `frontend/src/components/public/sahne/` içindedir; `sofra/SofraCanvas.tsx` yalnızca giriş noktasıdır.

## Ekranlar

**Masaüstü karşılama:** 0→100 sayaçlı açılış perdesi, kelime kelime yükselen başlık, işletme fotoğraflarından yelpaze (fareye göre eğilir, üzerine gelince açılır), dönen yazılı rozet, mıknatıslı Menüyü keşfet düğmesi, kayan kategori şeridi. Girişte renk, basılan düğmeden tüm ekrana yayılır ve menüde perde gibi açılır.

**Mobil karşılama:** Fotoğraflardan akan eğik duvar (4+ fotoğraf varsa; azsa yavaş yakınlaşan tek fotoğraf/slayt), altta büyük başlık ve "kaydır ya da dokun" giriş sürgüsü. Tek ekrana sığar, kaydırma yok.

**Masaüstü menü:** Solda kayan vurgulu kategori listesi (üzerine gelince kategori fotoğrafı belirir), üstte arama (`/` kısayolu), vitrin görselli ana alan, fareyi izleyen ışıklı ve eğilen ürün kartları, kategori karoları, altta büyüyen araç çubuğu (Diğer, Oyunlar, Ne yesem?, Garson çağır, Sepet).

**Mobil menü:** Yapışkan fotoğraflı kategori çipleri, hikâyeler, yana kaydırılan Şefin Yıldızı vitrini, kategori kartları; kategoride büyük ilk ürün + iki sütun ürün kartı. Altta dört sekmeli araç çubuğu; Kategoriler tam ekran seçiciyi açar.

## Korunan işlevler

Arama, kategori/alt grup, tükenmiş ürün, kalori, para birimi, seçenekli ürünlerin detay sayfasına gitmesi, doğrudan sepete ekleme, sepet, garson çağırma, oyunlar, Ne yesem?, profil, dil, masa bilgisi, hikâyeler, vitrin, beslenme tercihi, öneri/şikâyet kutuları, müzik, tema editöründe yazı/marka/fotoğraf düzenleme ve ürün detayından aynı kaydırma konumuna dönüş. Ürün detayı, sepet, Diğer paneli ve diğer alt paneller aynı koyu palete taşındı; yerleşimleri değişmedi.

Vitrin görseli varsa karşılamanın ana fotoğrafı ve menü ana alanı vitrinden gelir; yoksa tema fotoğrafı kullanılır. Editörde taslak fotoğraf gösterilir ve açılış animasyonu oynatılmaz. Hareket azaltma tercihinde animasyonlar kapalıdır.

## Notlar

- Yeni bağımlılık yok. Animasyonlar CSS + küçük React/rAF kodlarıdır.
- `index.html` içine Bricolage Grotesque ve Instrument Serif (Google Fonts) eklendi; yüklenemezse mevcut yazı tiplerine düşer.
- Mobilde kategori karoları ve ürün kartları ekrana girdikçe belirir (IntersectionObserver).
- Backend/API ve veritabanı değişmedi; yalnızca frontend deploy yeterlidir.

## Görüntüler (taklit API, örnek veri)

[Masaüstü karşılama](d-02-welcome.png) · [Masaüstü menü](d-06-menu-home.png) · [Masaüstü kategori](d-11-group.png) · [Mobil karşılama](m-01-welcome.png) · [Mobil menü](m-04-home.png) · [Mobil kategori seçici](m-08-picker.png) · [Mobil kategori](m-09-group.png)

Örnek veride tüm ürünler aynı örnek kahvaltı fotoğrafının farklı kesitlerini kullanır; gerçek işletmede kendi görselleri görünür.
