# Çalışma günlüğü

Bu dosya, projeyi devralan kişinin veya yapay zeka asistanının yapılan işleri ve kalan adımları anlaması içindir. Çalışmaya başlamadan önce `AGENTS.md` dosyasını okuyun.

## 2026-11-13 — Projenin alınması ve çalışma kurallarının kaydı

- `https://github.com/Barand1500/qr-menu.git` deposu doğrudan mevcut `qr-menu` klasörüne klonlandı.
- Başlangıç dalı: `main`. Klonlama sırasında son commit: `b8bfd10` (`yeni tema fix 7`).
- README, paket tanımları, frontend yönlendirmeleri, backend uygulama giriş yapısı, API yardımcısı, Prisma şemasının başlangıcı ve fikir defteri incelendi. Bu, ilk yapısal incelemedir; tüm kodların veya akışların doğrulandığı anlamına gelmez.
- Temel yapı: `frontend/` React + TypeScript + Vite + Tailwind; `backend/` Express + Prisma + MySQL; `electron/` masaüstü sarmalayıcısı.
- Kullanıcının sadelik, tıklama sayısını azaltma, kod temizliği, çalışan işlevleri koruma, mobil öncelik, klasör düzeni ve kontrollü teslim kuralları `AGENTS.md` dosyasına kaydedildi.
- Uygulama kodu değiştirilmedi. Bağımlılıklar henüz kurulmadı; uygulama çalıştırılmadı; derleme ve çalışma zamanı kontrolleri yapılmadı.
- Bu belge değişikliğinde dosyaların içeriği ve Git farkları kontrol edildi. Commit, push ve deploy yapılmadı; bunları kullanıcı gerçekleştirecek.
- Sonraki geliştirme işi henüz belirlenmedi.

## 2026-11-13 — Sayfa incelemeleri ve gruplarda hızlı görsel yükleme

- Kullanıcının çalışma sırası: önce sayfaları tek tek ele alacağız; mobil tasarım çalışması en son yapılacak.
- Özet sayfası için mevcut düzeni koruma yönünde görüş paylaşıldı; kod değiştirilmedi. Öneri olarak ürün durum başlıklarının sadeleştirilmesi ve bugün ifadesiyle son 30 günlük verinin uyuşmazlığı belirtildi; bunlar henüz uygulanmadı.
- Gruplar listesinde görsele veya görseli olmayan grubun yer tutucusuna çift tıklayınca doğrudan sistem dosya seçicisi açılır. Seçilen görsel mevcut yükleme API'siyle hemen kaydedilir; ayrıca kaydet düğmesine basılmaz.
- Satırın diğer bilgi alanlarına çift tıklama grup düzenleme penceresini açar. Ürün sayısı ve işlem butonlarının kendi davranışları korunur. Sıralama ve ana grup seçme modlarında görsel yükleme açılmaz.
- Yüklenme göstergesi, başarı/hata bildirimi ve 5 MB/görsel türü kontrolü eklendi. İptal edildiğinde istek atılmaz; yükleme başarısızsa önceki görsel kalır.
- Görsel yükleme ortak API yardımcısına taşındı; oturum tokenı ve HTTP hata kontrolü de kullanılır. Aynı yardımcı mevcut grup düzenleme akışında da kullanılır ve kaydetme hatası kullanıcıya gösterilir.
- Değişen uygulama dosyası: `frontend/src/pages/admin/GroupsPage.tsx`. Backend veya veritabanı değiştirilmedi.
- Doğrulama: frontend bağımlılıkları `npm ci` ile kuruldu; `npm run build --prefix frontend` başarılı. Vite büyük paket boyutu uyarısı verdi.
- Gerçek bileşenlerin JSDOM üzerinde, taklit API yanıtlarıyla çalıştırıldığı geçici kontroller başarılı: görsele çift tıklamanın düzenleme penceresinden ayrılması, normal satır düzenleme, görseli olmayan alt grup, klavye erişimi, otomatik yükleme, sessionStorage tokenı, yükleme göstergesi, başarı, sunucu hatasında eski görseli koruma, geçersiz/büyük dosya, iptal, sıralama modu ve ana grup seçimi. Test araçları `frontend/node_modules/.qr-check/` altında, Git dışında tutulur.
- Sınırlama: gerçek backend/MySQL ile uçtan uca ve canlı tarayıcıda görsel kontrol yapılmadı. Mobil düzenleme yapılmadı.
- Commit, push ve deploy yapılmadı; kullanıcı gerçekleştirecek.

## 2026-11-13 — Ürünlerde hızlı ek görsel ve galeri önizlemesi

- Ürün listesindeki görsele çift tıklama doğrudan dosya seçiciyi açar; seçilen görseller otomatik olarak mevcut listenin sonuna eklenir. Mevcut kapak ve görsel sırası korunur. Görseli olmayan üründe ilk yüklenen fotoğraf kapak olur.
- Birden fazla fotoğrafı olan ürünlerde küçük bir fotoğraf sayısı rozeti gösterilir. Görselin üzerine gelince fotoğraflar yan yana kartlar halinde açılır; ilk kart Kapak olarak belirtilir. Çok sayıda fotoğraf yatay kaydırılabilir.
- Galeri tablonun taşma alanından bağımsız gösterilir; ekran kenarlarına göre konumlanır. Fareyle galerinin üzerine geçildiğinde açık kalır, ayrılınca kapanır. Klavyeden odakla önizleme ve Enter/boşluk ile dosya seçimi desteklenir.
- Ürünün diğer bilgi alanlarına çift tıklama düzenleme penceresini açmaya devam eder. Görsel yüklenirken düzenleme açılması engellenir; böylece eski görsel listesiyle düzenleme yapılmaz.
- Hızlı yüklemede tek seferde 12 dosya ve dosya başına 5 MB sınırı, yükleme göstergesi, başarı/hata bildirimi eklendi. Hata veya iptalde mevcut fotoğraflar korunur.
- Görsel hücresi ayrı `frontend/src/components/admin/ProductImageCell.tsx` bileşenine alındı. `ProductsPage.tsx` mevcut ekleme API'sini ortak API yardımcısıyla kullanır; sessionStorage tokenı da desteklenir. Backend ve veritabanı değiştirilmedi.
- Doğrulama: frontend TypeScript ve üretim derlemesi başarılı; Vite mevcut büyük paket boyutu uyarısını verdi. Gerçek sayfa bileşenini taklit API ile çalıştıran JSDOM kontrolleri başarılı: çift tıklama ayrımı, düzenleme, tek/çok görsel önizlemesi, tablo dışında galeri, ekran kenarı konumlama, galeriye geçiş/kapanma, çoklu ekleme ve kapak/sıra korunması, yükleme göstergesi, oturum tokenı, sunucu hatası, geçersiz/büyük/fazla dosya, iptal ve ilk fotoğraf yükleme.
- Geçici kontrol dosyası `frontend/node_modules/.qr-check/products-test.mjs` altında Git dışında tutulur. Gerçek backend/MySQL ve canlı tarayıcıda görsel kontrol yapılmadı. Mobil tasarım çalışması hâlâ en sona bırakılmıştır.
- Commit, push ve deploy yapılmadı; kullanıcı gerçekleştirecek.

## 2026-11-13 — Vitrin hikaye açıklamasının genişliği

- Mobil Hikayeler sekmesindeki açıklamaya verilen `max-w-2xl` (42 rem) sınırı, geniş ekranda boş alan olmasına rağmen son sözcüğü alt satıra düşürüyordu.
- `frontend/src/pages/admin/ShowcasePage.tsx` içinde yalnızca bu açıklamanın genişliği düzeltildi: metin Yeni Hikaye butonundan kalan alanı kullanır. Dar alanda doğal satır kaydırma korunur.
- Sayfanın diğer alanlarına ve işlevlerine dokunulmadı. Canlı tarayıcıda görsel kontrol yapılmadı.
- Doğrulama: frontend TypeScript ve üretim derlemesi başarılı; Git fark kontrolü temiz. Vite mevcut büyük paket boyutu uyarısını verdi. Commit, push ve deploy yapılmadı.

## 2026-11-13 — Toplu çeviri sayfasının yeniden tasarlanması

- Kullanıcının isteği: mevcut çeviri işlevlerini koruyarak daha sade, minimal ve özgün bir masaüstü tasarımı oluşturmak.
- Yeni düzen: solda hedef diller, sağda ince kategori sekmeleri ve doğrudan seçilebilen metin listesi. Önceki ayrı seçim penceresi ve dört büyük istatistik kartı kaldırıldı; seçim ve çeviri tek çalışma alanında toplandı.
- Tek ana çeviri düğmesi seçime göre tümünü veya seçilenleri çevirir. Kategori bazında toplu seçim, tümünü seçme ve seçimi temizleme desteklenir. Seçili alan sayısı tüm kategorileri kapsar.
- Başarılı sonuçların otomatik kaydı korundu. Kısmi veya hatalı sonuçlarda kaynak metin ve düzenlenebilir çeviri yan yana gösterilir; yalnızca dolu ve hatasız alanlar kaydedilir. Sonuç paneline otomatik kaydırma ve klavye odağı eklendi.
- Kayıt isteği başarısız olursa hazırlanmış çeviriler korunur ve tekrar kaydedilebilir. Hızlı dil değişikliklerinde eski API yanıtlarının yeni dili ezmesi önlendi; hatalı eksik-alan isteği için yeniden deneme görünümü eklendi.
- Tarayıcı alert pencereleri yerine sayfa içi bildirimler, yüzdesi ölçülmeyen ilerleme animasyonu yerine açık işlem durumu kullanıldı. İşlem sürerken çalışma alanı etkileşime kapatılır; eşzamanlı tekrar istekleri engellenir.
- Dil Paketi kilidi, kodla etkinleştirme ve ayarlardan dil yönetimi bağlantıları korundu. Kilitli ve boş durumlar da yeni görünüme uyarlandı.
- Sayfa stilleri `frontend/src/pages/admin/bulk-translate.css` içine alındı; yalnızca eski toplu çeviri sayfasının artık kullanılmayan stilleri `frontend/src/index.css` içinden temizlendi. Backend/API ve veritabanı şeması değiştirilmedi.
- Doğrulama: TypeScript ve üretim derlemesi başarılı; Vite mevcut büyük paket boyutu uyarısını verdi. Yerel Chrome/Playwright ile gerçek sayfa bileşeni, taklit API ve basitleştirilmiş yönetim çerçevesi içinde sınandı; açık/koyu tema ve sonuç ekran görüntüleri görsel olarak incelendi.
- Tarayıcı kontrolleri başarılı: kategori/alan seçimi, kısmi seçim işareti, tümünü ve seçilenleri çevirme, otomatik kaydetme, kısmi sonuçları düzenleyip kaydetme, başarısız kayıtta çeviriyi koruma ve yeniden deneme, çeviri servisi hatası, eksik-alan isteğini tekrar deneme, dil değiştirme yarışı, aktif hedef dil olmaması, kilitli paket ve aktivasyon penceresi. Tarayıcı çalışma zamanı hatası görülmedi.
- Geçici fixture, test ve görseller `frontend/node_modules/.qr-check/bulk-*` altında Git dışında tutulur. Gerçek çeviri servisine veya veritabanına istek gönderilmedi; canlı sunucuda uçtan uca doğrulama yapılmadı. Mobil için temel taşma koruması var; ayrıntılı mobil tasarım incelemesi kullanıcının istediği gibi sona bırakılmıştır.
- Commit, push ve deploy yapılmadı; kullanıcı gerçekleştirecek.

## 2026-11-13 — Eski tema bağlantılarını gizleme ve yeni tasarım önerileri

- Kullanıcı yeni tek karşılama ve tek menü tasarımıyla ilerlemek istiyor. Yeni tasarımlar için tema seçimi veya tema ayarı ekranı eklenmeyecek. Bu aşamada yalnızca öneriler hazırlanması istendi; yeni müşteri ekranları henüz uygulanmadı veya seçilmedi.
- `AdminLayout.tsx` içinde Başlangıç Ayarları altındaki Karşılama Ekranı ve Menü Ekranı bağlantıları gizlendi; Oyun Ekranı korunuyor. Masaüstü ve mobil gezinme aynı listeyi kullanır.
- Ortak `SHOW_LEGACY_THEME_SETTINGS = false` sabiti `frontend/src/lib/adminThemeSettings.ts` dosyasına eklendi. Eski tema sayfalarının kodları, rotaları, kayıtlı ayarlar ve mevcut müşteri menüsü korunuyor; yalnızca gezinme görünürlüğü değişti.
- Yönetim turu gizli sayfalara yönlendirmeyecek şekilde aynı sabite bağlandı; Başlangıç Ayarları açıklaması Oyun Ekranı'na uyarlandı.
- Yerleşik image_gen aracıyla altı farklı görsel yön hazırlandı: Sofra, Avlu, Sahne, Atlas, Gece ve İz. Her yönde ayrı karşılama ve menü önerisi var; her görsel masaüstü ve telefon yerleşimlerini birlikte gösteriyor. Toplam 12 PNG üretildi ve görsel olarak incelendi.
- Teslim klasörü: `docs/design-proposals/2026-11-13/`. `index.html` yerel inceleme galerisi, `README.md` karşılaştırma ve uygulama ilkeleri, `prompts.json` kullanılan üretim istemleridir. Bunlar uygulama ekranları veya yayınlanmış bir site değildir; uygulama paketine eklenmez.
- Görsellerdeki ZEEN adı, ürünler, masa numarası ve fiyatlar örnektir. Seçilecek tasarım gerçek metin, gerçek işletme verisi ve mevcut işlevlerle uygulanacak; görsel taslaklar tek başına tüm cihazlarda çalışmanın doğrulaması değildir. Cihaz ve erişilebilirlik kontrolleri öneri README'sinde belirtilmiştir.
- Doğrulama: frontend TypeScript ve üretim derlemesi başarılı; Vite mevcut büyük paket boyutu uyarısını verdi. İzole gezinme kontrolünde yalnızca Oyun Ekranı'nın kaldığı, diğer gezinme gruplarının ve eski sayfa/rotaların korunduğu, turun gizli sayfaları atladığı doğrulandı.
- Yerel Chrome kontrolünde 12 yüksek çözünürlüklü PNG, 12 ayrı kayıtlı istem, altı eşleşmiş galeri bölümü ve görsellerin tam boy bağlantıları doğrulandı. Galeri 1440 px ve 390 px genişliklerde yatay taşma olmadan açıldı. Geçici testler `frontend/node_modules/.qr-check/` altında Git dışında tutulur. Canlı sunucu/deploy kontrolü yapılmadı.
- Sonraki adım: kullanıcının görsel yön seçimi; ardından tek karşılama ve menünün uygulanması. Commit, push ve deploy yapılmadı; kullanıcı gerçekleştirecek.

## 2026-11-13 — Sofra'nın uygulanması ve doğrudan görsel düzenleme

- Kullanıcı Sofra tasarımını seçti ve uygulamayı istedi. Önceki yalnızca öneri aşaması bitti. Tema Ayarları adlı, önizlemedeki yazıya/fotoğrafa tıklanarak düzenlenen ve son Kaydet işlemiyle yayınlanan bir ekran ayrıca istendi. Bu iş için mobil tasarım açıkça önceliklendirildi.
- Başlangıç Ayarları altında Oyun Ekranı korundu; yanına Tema Ayarları eklendi. Yardım turu güncellendi. Eski karşılama/menü ayar URL'leri yeni editöre yönlenir; eski eklenti tema kartları gizlidir. Eski kaynak kodları ve kayıtlar silinmedi.
- Karşılama ve müşteri menüsü tek Sofra görünümüne bağlandı: krem/bordo, serif tipografi, özgün kahvaltı fotoğrafı, editoryal masaüstü düzeni ve telefon için ayrı kategori/ürün yerleşimi. Ürün detayı mevcut seçenek/galeri/sepet bileşenleri korunarak Sofra'ya uyarlandı.
- Karşılama tek düğmeyle menüye açılır; beslenme tercihi isteğe bağlıdır. Hikâyeler ve vitrin duyuruları telefonda kompakt tutulur. Arama, kategori/alt grup, tükenmiş ürün, para birimi, ürün seçenekleri, sepet, masaya iletme/garson isteği, profil, sosyal/hakkında, oyunlar, mevcut asistan ve QR/konum/bakım/masa kodu kapıları korunur.
- Yeni editör gerçek Sofra bileşenlerini kullanır. Telefon/masaüstü iframe önizlemesi, dil bazlı metinler, doğrudan işletme adı düzenleme, isteğe bağlı saatler, ayrı karşılama/menü fotoğrafları, değişikliği geri alma ve kaydedilmemiş değişiklik uyarısı vardır. Yazarken imleç korunur ve Kaydet hemen etkinleşir.
- Taslaklar müşteriye yansımaz. Dosyalar son kayıtta yüklenir; config kaydı başarılı olmadan yayındaki fotoğraf/metin değişmez. Kayıt hatasında taslak korunur. Başka oturumun değişikliğinin üzerine yazılmasını önleyen karşılaştırmalı kayıt vardır.
- Kalıcı veri mevcut Setting tablosunda işletmeye özel `sofra_theme_v1` olarak saklanır. Yönetim API'si yalnızca gerçek oturumdaki yöneticilere açıktır. Görseller 5 MB PNG/JPG/WebP ile sınırlı ve dosya imzası doğrulanır. Yeni tablo/migration gerekmez.
- Ortak saf şema `backend/src/lib/sofra-config.ts` dosyasındadır; frontend `lib/sofra.ts` üzerinden kullanır. Şemada sunucu bağımlılığı veya gizli veri yoktur. Eski karşılama alt metinleri, yeni editörde açıkça değiştirilene kadar başlangıç verisi olarak korunur.
- Ürün, kategori, arama ve önerilen ürün isteklerinde hata/tekrar deneme ve eski yanıtları yok sayma korumaları eklendi. Dokunma hedefleri ve açık zemin üzerindeki profil/servis kontrastı kontrol edildi.
- Yerleşik image_gen ile bu iş için yeni fotoğraf üretildi; piksel içeriği değiştirilmeden 1536×1024 WebP'ye kodlandı (433660 bayt). Dosya: `frontend/public/sofra/breakfast.webp`. İstem ve uygulama notları `docs/sofra/` altında, gerçek bileşenlerden alınmış örnek verili önizlemelerle saklanır.
- Kalıcı API testi `backend/tests/theme-settings.test.mjs`; komut `npm run test:sofra --prefix backend`. Gerçek Express/JWT middleware'i ve bellek içi Prisma taklidiyle yetki, işletme izolasyonu, kalıcı config okuma/yazma, eşzamanlı kayıt, geçersiz veri ve aşamalı görsel yayını kontrolleri başarılı.
- Son frontend ve backend TypeScript/üretim derlemeleri başarılı. Gerçek bileşenlerin yerel Chrome testleri başarılı: editörde karakter karakter yazma ve doğrudan kaydetme, yenilemede kayıt, hatada taslak, fotoğraf yayını, tercih penceresi/Escape, QR masa/grup/kampanya, kategori/alt grup, arama, stok, sepet, seçenek fiyatı, siparişin doğru masaya/fiyatla iletilmesi, oyunlar ve hata sonrası tekrar deneme. Tarayıcı çalışma zamanı hatası görülmedi.
- Karşılama/menü 320, 375, 390, 430, 768, 1440 px genişliklerde; uzun Türkçe, Arapça/RTL ve eksik görselle sınandı. Yerel geçici tarayıcı harness'i `frontend/node_modules/.qr-check/sofra-*` altında Git dışında tutulur. Vite'ın mevcut büyük paket boyutu uyarısı sürer. Fiziksel telefonlar ve canlı MySQL/sunucu üzerinde uçtan uca doğrulama yapılmadı.
- Frontend ve backend birlikte deploy edilmelidir. Commit, push ve deploy yapılmadı; kullanıcı gerçekleştirecek.
- Son görsel kontrolde yükleme/bağlantı hatası ekranları da Sofra'nın nötr görünümüne uyarlandı; müşteriye gösterilen geliştirme komutları kaldırıldı. Son frontend derlemesi ve tüm tarayıcı kontrolleri bu düzeltmelerden sonra tekrar başarılı oldu.

## 2026-11-13 — Sofra geri bildirimleri, alt paneller ve mobil düzeltmeler

- Kullanıcının görseller üzerinden istediği düzeltmeler uygulandı. Tema Ayarları'ndaki “Yazıya tıkla, düzenle…” açıklaması ve kullanılmayan stilleri kaldırıldı.
- Öneri ve şikâyet kutuları ortak `SofraFeedbackSheet.tsx` bileşenine taşındı. Maskot, konuşma balonu, parçacık ve cam görünümü yerine krem/bordo, düz alanlar ve sade yıldız puanı kullanılıyor. Zorunlu alanlar, isteğe bağlı iletişim bilgileri ve mevcut API uçları korundu; gönderim hatasında girilen metin korunuyor ve tekrar gönderilebiliyor.
- Ne yesem? aynı görsel dile ve ortak `SofraSheet.tsx` alt paneline taşındı. Maskot kaldırıldı; üç soruluk öneri akışı ve ürün bağlantıları korundu. Başarısız öneri isteği boş sonuçtan ayrılıyor; kapatılmış oturumun eski yanıtı yeni oturumu ezmiyor.
- Sepet masaüstünde de ekranın altından açılır ve kapanır. Diğer paneli sağdaki koyu çekmece yerine Sofra renklerinde alt paneldir. Oyun, giriş/profil ve beslenme pencereleri de aşağıdan açılır. Escape, odak geri dönüşü, sepet/ortak panel/Diğer içinde klavye odağı ve hareket azaltma tercihi desteklenir. İç içe masa kodu penceresinin klavye yönetimi korunur.
- Garson çağır düğmesinin kenarlık, dolgu ve gölgesi sadeleştirildi; doğrudan garson isteği işlevi korunur. Masaüstü kategori sütunu genişletildi; sıra numarası daralmaz, uzun adlar kelime aralarından bölünür. Mobilde restoran adı tam satır kullanır; dil, masa ve profil araçları ikinci satıra yerleşir.
- Mobil hikâyeler tam genişliğe çıkarıldı; aynı alandaki web bannerları telefonda gizlendi. Masaüstündeki bannerlar korunur.
- Dil bayrakları dış CDN yerine projedeki 34 yerel SVG'den yüklenir. `frontend/public/flags/LICENSE.txt` flag-icons MIT lisansını içerir. Menü başlığındaki eksik bayrak eklendi; bilinmeyen/yüklenemeyen görsel için küre simgesi vardır.
- Yuvarlak SOFRA rozeti ve varsayılan Şefin Yıldızı başlığı önizlemeden doğrudan düzenlenebilir. Ortak şemaya dil bazında `sealText` ve `picksLabel` eklendi; eski kayıtlara varsayılanlar uygulanır. Yeni tablo/migration yoktur; frontend ve backend birlikte deploy edilmelidir.
- Doğrulama: son frontend/backend derlemeleri, `npm run test:sofra --prefix backend` ve fark/boşluk kontrolü başarılı. Kalıcı API testine rozet/başlık kaydı doğrulaması eklendi. Vite'ın mevcut büyük paket uyarısı sürer.
- Gerçek bileşenlerle yerel Chrome/Playwright kontrolü başarılı: 320–1440 px, uzun Türkçe ve Arapça/RTL, yerel bayrakların yüklenmesi, hikâye genişliği/banner gizleme, kategori kırılması, rozet/başlık düzenleme-kaydetme-yenileme, öneri/şikâyet doğrulama-gönderme-hata-tekrar deneme, asistan hata/sonuç akışı, PC'de Diğer/sepet/oyun/giriş panelinin alt kenara oturması ve Escape. Önceki sepet/seçenek fiyatı/masa-grup-kampanya/arama/hata sonrası tekrar deneme kontrolleri de başarılı; tarayıcı çalışma zamanı hatası görülmedi.
- Ekran görüntüleri ve mimari notlar `docs/sofra/` içinde güncellendi. Geçici test harness'i `frontend/node_modules/.qr-check/sofra-*` altında Git dışındadır. Zen tarayıcısı, fiziksel telefon ve canlı sunucu/MySQL üzerinde doğrudan test yapılmadı. Commit, push ve deploy yapılmadı; kullanıcı gerçekleştirecek.

## 2026-11-13 — Sofra hizalama, arama odağı ve Hakkımızda düzeltmeleri

- Kullanıcının yeni ekran görüntülerindeki sorunlar giderildi. Karşılama ve menüde 1800 px azami genişlik kaldırıldı; geniş ekranda dış kenarlarda farklı renkli boşluk kalmaz. İçerik için mevcut iç kenar payları korunur.
- Masaüstündeki Ne yesem? düğmesinin merkezi alt araç çubuğunun üst çizgisine hizalandı. Araç çubuğunun yüksekliği ve düğme konumu ortak CSS değişkenine bağlandı; güvenli alan payı hesaba katılır. Mobil asistan konumu korunur.
- Arama input'unda genel `:focus-visible` kuralının oluşturduğu iç dikdörtgen çerçeve engellendi. Klavye odağı kapsayıcının tek yuvarlak bordo kenarlığından anlaşılır.
- Mobil aktif kategori alt çizgisini kısaltan masaüstü kuralı yalnızca 768 px ve üstüne sınırlandı; telefonda çizgi kategori başlığının tamamını kaplar.
- Garson yolda oyun önerisi Sofra renklerine uyarlandı: okunaklı bordo başlık, krem zemin, sade kartlar. Eski parlayan/yanıp sönen animasyonlar bu alan için kapatıldı; oyun bağlantıları ve çağrı akışı korundu.
- Hakkımızda sayfasının büyük bordo Menüyе dön düğmesi, solda ok bulunan 44 px dokunma hedefli sade metin düğmesine dönüştü. Kapakla arasına boşluk eklendi; mobil/masaüstü görünüm ve menüye dönüş doğrulandı.
- Doğrulama: frontend TypeScript/üretim derlemesi ve `git diff --check` başarılı; mevcut büyük paket uyarısı sürüyor. Yerel Chrome'da 1920/2560 px tam genişlik, düğmenin çizgiyle merkez hizası, 320/390/1440 px arama odağı, mobil alt çizgi, gerçek garson çağrısından açılan oyun önerisi, kapaklı/kartlı Hakkımızda ve dönüş akışı sınandı. Önceki Sofra editör/sepet/masa/arama/hata/alt panel kontrolleri de başarılı; çalışma zamanı hatası görülmedi.
- `docs/sofra/` notları ve dört yeni örnek ekran görüntüsü eklendi. Geçici kontrol `frontend/node_modules/.qr-check/sofra-refinements.mjs` içinde, önceki kapsamlı harness ile birlikte Git dışında durur. Backend/API değişmedi. Fiziksel telefon, Zen ve canlı sunucu üzerinde doğrudan kontrol yapılmadı. Commit/push/deploy kullanıcıya bırakıldı.
