# Hafıza ve Sipariş Blitz — Sahne oyun yüzeyleri

16 Kasım 2026. Bu çalışma lobi yerine oyunların açıldıktan sonraki görünümünü yeniler.

## Hafıza

- Mor kartlar sıcak koyu tonlara alındı; arkada sitenin çizgisel çatal/kaşık simgesi var, eşleşme vurgu rengi amber.
- Sahne'de 1024 px ve üzeri web görünümünde emoji boyutu 60–96 px. Mobil emoji boyutu ve kart ızgarası korunur. Yönetimden yüklenen iki eş fotoğraf kart yüzünü tamamen doldurur; mevcut object-fit: cover davranışı korunur.
- Kart eşleştirme, kilit, hamle, süre ve yeniden başlatma kuralları değiştirilmedi. Eski temalar yeni kart arka simgesini kullanmaz.

## Sipariş Blitz

- SahneBlitzView, mevcut oyun durumunu gösteren ayrı bir sunum bileşeni. Açılışta büyük başlık/çizim; ezberlemede sıcak kâğıt tonunda sipariş fişi ve turuncu süre çizgisi; seçimde ince ayırıcılar/işaretleme kutuları; sonuçta sade puan ve tekrar oynama var. Mavi yüzey/timer/seçenekler kaldırıldı.
- 5 saniyelik süre, 3–4 hedef ürün ve puanlama korunur. Mobil seçimler tek sütuna iner, uzun isimler sarılır. Basılı seçim durumu aria-pressed ile gösterilir, hareket azaltma desteklenir.
- İncelemede bulunan gerçek oyun hatası düzeltildi: önce hedefler ve fazla yanıltıcı seçenekler birlikte karıştırılıp ilk sekizi alındığı için doğru cevaplar listeden düşebiliyordu. Şimdi tüm hedefler korunur, yalnızca sekiz seçeneği dolduracak sayıda yanıltıcı seçenek eklenir, sonra karıştırılır. Bu düzeltme ortak oyun mantığındadır; eski temaların görünümü korunur.
- Menü ürünü havuzu ve altıdan az üründe kullanılan mevcut örnek havuz değişmedi. Yeni veri, bağımlılık, admin/backend değişikliği yok; frontend deploy yeterli.

## Kontroller

- Frontend üretim derlemesi ve diff geçti; mevcut Vite büyük paket uyarısı sürer.
- Chrome/gerçek React + taklit API: 1440/1024/390/320 px 16 Hafıza kartı, büyük web/küçük mobil emoji boyutu, eşleşme/yeniden başlatma; ayrıca yönetimin iki ayrı fotoğraflı eşleri ve fotoğrafın yüzeyi doldurması kontrol edildi.
- Blitz'in açılış/ezber/seçim/tam doğru sonuç akışı dört boyutta geçti. Ek olarak 12 turda dört hedefin her seferinde sekiz seçenek arasında bulunması, tam doğru/yanlış seçim cezası, boş seçimde düğmenin kapalı olması, tekrar oynama, hareket azaltma, 320 px uzun isimler ve İngilizce fiş kontrol edildi. İlk testte puan metninin boşluk içeren biçimi dikkate alınarak test düzeltildi, yeniden geçti. Çalışma zamanı hatası görülmedi.
- Canlı API/gerçek yükleme, fiziksel telefon, Zen ve iOS Safari denenmedi. Görüntüler yerel örnek veri/fotoğraflardır. XOX ve dedektif bu tur değiştirilmedi/yeniden test edilmedi. Betikler Git dışında frontend/node_modules/.qr-check/games-play.mjs ve games-play-edge.mjs içinde.

[Hafıza / web](memory-web.png) · [Yüklenen görseller](memory-photos-web.png) · [Blitz / açılış](blitz-intro-web.png) · [Sipariş fişi](blitz-ticket-web.png) · [Fiş / mobil](blitz-ticket-mobile.png) · [Seçim / mobil](blitz-recall-mobile.png)
