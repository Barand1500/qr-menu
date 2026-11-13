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
