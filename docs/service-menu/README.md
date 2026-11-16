# Servis menüsü — 16 Kasım 2026

Alt çubuktaki tek **Servis** düğmesi garson, nargileci ve vale seçeneklerini açar. Seçimler yan yana küçük butonlar yerine büyük simgeli, açıklamalı satırlardır. Panel perspektif/ölçek geçişiyle, satırlar sırayla açılır; hareket azaltma tercihi desteklenir. Vale aynı panel içinde plaka formuna geçer. Menü, karşılama ve paralel yürütülen giriş tasarımı bu iş için düzenlenmedi.

## Çağrı akışı

- Garson/nargileci seçiminde mevcut masa kodu kontrolünden sonra çağrı gönderilir. Vale plaka ister; yurt içi/yurt dışı plakalar için 4–20 karakter, harf/rakam/boşluk/tire kabul edilir, en az bir rakam gerekir. Sunucu büyük harfe çevirir, boşlukları normalleştirir ve doğrular. Plaka istemcinin serbest notu olarak kabul edilmez; sunucu `Plaka: ...` notunu oluşturur.
- `POST /api/menu/:slug/table-request` artık `waiter`, `hookah`, `valet` kabul eder. Sipariş yalnızca `waiter` türünde kabul edilir. Sepetten sipariş gönderme akışı korunur.
- Üç tür mevcut ortak personel çağrı kuyruğuna gider. Ayrı personele otomatik yönlendirme/vale araç yönetimi eklenmedi. Personel listesi ve bildirimleri tür adını/simgesini, mevcut not alanı da plakayı gösterir.
- Çağrı başarılı olunca mevcut animasyonlu bildirim doğru servis adıyla görünür. Başarısız istek başarı bildirimi göstermez, yeniden denenebilir. Masa kodu gerektiğinde servis paneli geçici olarak gizlenir; kod ekranı arkada kalmaz. Kod iptalinde servis seçimine dönülür.
- Mevcut 45 saniyelik tekrar çağrı kontrolü tür + masa + grup bazındadır. Aynı plakaya tekrar çağrı mevcut kayıtla yanıtlanır. Bu sürede farklı plaka gönderilirse önceki çağrının iletildiğini açıklayan 409 yanıtı verilir. Plaka tarayıcı depolamasına yazılmaz.
- Şimdilik mevcut genel masa hizmeti anahtarı üç servisi birlikte kontrol eder. Servis bazında yönetim paneli aç/kapat ayarları sonraki iş; bu sürümde üç seçim de görünür. Mevcut raporlarda yeni servisler yanlışlıkla garson adedine eklenmez; toplam çağrı sayısına dahildir.

## Kontroller

- Backend ve frontend üretim derlemeleri geçti; mevcut Vite büyük paket uyarısı sürer.
- `node backend/tests/service-request.test.mjs`: servis türleri, plaka doğrulaması/normalleştirmesi, geçersiz veri, garson sipariş uyumu ve diğer servislerin sipariş içermemesi geçti.
- Yerel Chrome, gerçek React ve taklit API: 320/390/768/1440 px panel/plaka formu sığması; üç türün gönderdiği veri ve bildirimi; zorunlu plaka; hata/tekrar deneme; Escape/odağın düğmeye dönmesi; sepet siparişi ve ürün detayından çağrı geçti.
- Ek kontrol: masa kodu ekranının görünmesi/iptali/doğrulaması sonrası vale çağrısı, yinelenen yanıt, 320×480 kısa ekran, hareket azaltma ve İngilizce geçti. Çalışma zamanı hatası görülmedi. Betikler Git dışında `frontend/node_modules/.qr-check/services.mjs` ve `services-edge.mjs` içinde.
- Canlı API/veritabanı, gerçek personel bildirimi, fiziksel telefon klavyesi, Zen ve iOS Safari denenmedi. Yeni servisler için tablo/kolon eklenmedi; bu iş özelinde migration gerekmez. **Backend ve frontend birlikte deploy edilmelidir.**

Görüntüler: [Masaüstü](desktop.png), [Mobil](mobile.png), [Vale / masaüstü](valet-desktop.png), [Vale / mobil](valet-mobile.png).
