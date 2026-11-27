# Vega Şefim entegrasyonu — yol haritası

Bu dosya, Vega Şefim → QR menü eşitlemesinin **tek doğru kaynağıdır**. Yeni bir asistan/geliştirici işe buradan başlamalı.
Her adımın durumu: `[x]` yapıldı ve doğrulandı · `[~]` yapıldı ama gerçek ortamda denenmedi · `[ ]` bekliyor.

- Başlangıç (geri dönüş) noktası: `qr-menu` deposunda commit `8acbf63` (2026-11-27, "Müşteri girişi: Google ile devam et").
- Köprü programı ayrı klasörde: `Güzel Teknoloji Dosyaları/Cirak/` (qr-menu deposunun **dışında**, kendi git deposu).

## 1. Amaç

Restoranlar menülerini Vega Yazılım'ın **Şefim** adisyon programında yönetiyor. Şefim'de ürün/fiyat/grup değişince QR menü de kendiliğinden güncellensin.

## 2. Gerçekler (sahada doğrulandı, 2026-11-27)

- Şefim restoranın kendi bilgisayarında çalışır, **bulutta değil**. Kurulum klasörü sabit: `C:\VEGA\Sefim\`.
- Bağlantı bilgisi `C:\VEGA\Sefim\connectionstring.txt` içinde, tek satır:
  `Data Source=(local);Initial Catalog=sefim;Persist Security Info=True;User ID=sa;Password=…;`
  → Yerel **Microsoft SQL Server**, veritabanı `sefim`. (Şifre hiçbir yerde saklanmaz/yazılmaz; köprü bilgisayarında DPAPI ile şifreli durur.)
- Bulut sunucumuz bu veritabanına erişemez → restoran bilgisayarında küçük bir **köprü programı** (Çırak) gerekir.
- Şefim klasöründe .NET Framework uygulamaları var (DevExpress 18.1) → .NET Framework 4.8 her Şefim bilgisayarında bulunur.

### Şefim tabloları (ilgili olanlar)

| Tablo | Önemli sütunlar | Not |
|---|---|---|
| `Product` | `Id`, `ProductName`, `ProductGroup` (düz yazı), `Price`, `VatRate`, `ProductCode`, `[Order]` (nvarchar), `Plu`, `StockCode`, `HasOptions` | Aktif/pasif sütunu **yok**. Örnek DB'de 44.702 satır. |
| `Choice1` | `Id`, `ProductId`, `Name`, `Price`, `[Order]` | Porsiyon/boy (örn. 80 GR 275 TL, 100 GR 315 TL). |
| `Choice2` | `Id`, `ProductId`, `Choice1Id`, `Name`, `Price`, `[Order]` | Choice1'in alt seçenekleri. |
| `OptionCats` | `Id`, `Name`, `ProductId`, `MinSelections`, `MaxSelections`, `[Order]` | Örnek DB'de 1 satır. |
| `Options` | **sütunları henüz görülmedi** | 51.889 satır. Köprü sütunları çalışırken keşfeder (bkz. 7). |
| `ProductTemplate` | `Id`, `Name` | Fiyat şablonları: örn. `PAKET`, `deneme`. |
| `ProductTemplatePrice` | `TemplateId`, `ProductId`, `Choice1Id`, `Choice2Id`, `OptionsId`, `Price` | Şablona göre fiyat (paket fiyatı vb.). |

Gruplar: `$Trendyol`, `$Yemeksepeti`, `$Getir`, `$MigrosYemek`, `$KUVER` (adı `$` ile başlar) ve `[R]Rezervasyon` **sistem grupları**; paket platformlarının otomatik kopyalarıdır. Gerçek menü bunların dışındaki birkaç düzine üründür (İÇECEKLER, KLASİK DÜRÜMLER, …). Varsayılan olarak sistem grupları eşitlenmez.

## 3. Kullanıcı kararları (2026-11-27)

1. Köprü programı kurulacak. Adı **Çırak** ("Şefim'in çırağı menüyü taşır").
2. Fiyat kaynağı, silinen ürün davranışı, mevcut ürünlerin ezilip ezilmeyeceği → **restoran panelde kendisi seçer**.
3. Şefim'de olup bizde olmayan ürünler eklenir, olanlar güncellenir (varsayılan; panelden değiştirilebilir).
4. Kapsam sınırlanmasın: ürün, grup, fiyat, porsiyon ve seçenekler birlikte çalışsın.
5. Köprü programı qr-menu dışında ayrı klasörde; kurulumu basit; tasarım 21st.dev "Tangerine" paleti (koyu lacivert zemin, mandalina vurgu).

## 4. Mimari

```
Şefim (SQL Server, yerel)  ──yalnızca okur──▶  Çırak (restoran PC'si, tepsi programı)
                                                   │  HTTPS, Bearer anahtar
                                                   ▼
                                  menu sunucusu /api/sefim/push  ──▶  SefimLink.snapshot (son görüntü)
                                                   │
                         ayarlar (panel) + planSync() ──▶ ürün/grup ekle-güncelle-gizle
```

- Çırak her dakika Şefim'i okur; içerik değiştiyse tam görüntüyü, değişmediyse kısa "yaşıyorum" sinyalini gönderir.
- Sunucu son görüntüyü saklar. Panel ayarı değişince yeni görüntü beklemeden **saklanan görüntüden** yeniden plan yapılır.
- Bütün eşitleme mantığı `backend/src/lib/sefim-sync.ts` içindeki saf `planSync()` fonksiyonundadır (testli).
- Şefim veritabanına **hiçbir zaman yazılmaz**. Sorgular `READ UNCOMMITTED` ile çalışır, adisyonu kilitlemez.

## 5. Eşleştirme kuralları

- Ürün eşi: Şefim `Product.Id` ↔ bizim ürün id (`SefimMap`, kind=`product`).
- Grup eşi: Şefim grup adı ↔ bizim grup id (`SefimMap`, kind=`group`). Yoksa aynı adlı grup aranır, o da yoksa açılır.
- "Aynı adlı ürünleri birleştir" açıksa, elle eklenmiş aynı adlı ürün **kopyalanmaz**, eşleştirilir (fotoğrafı/açıklaması korunur).
- Elle eklenmiş, Şefim'de karşılığı olmayan ürünlere **asla dokunulmaz**.
- Şefim'den kalkan ürün: ayara göre **gizlenir** ya da **olduğu gibi kalır**; hiçbir zaman silinmez. Yalnızca seçili gruplardaki ürünler için geçerlidir (grup seçimden çıkarılınca ürünler gizlenmez).
- Sync gizlediği ürün Şefim'e geri gelirse tekrar açılır; restoranın elle gizlediğine dokunulmaz.
- Porsiyon (Choice1/Choice2) → bizim seçenek grubu (`single`). Seçenek fiyatlarının hepsi > 0 ise `replace` (fiyatın yerine geçer), değilse `add`. Ana fiyat 0 ise en düşük porsiyon fiyatı ana fiyat olur.
- Seçenekler (Options/OptionCats) → bizim `choice` türü, fiyatı ekler (`add`).
- "İsimleri düzelt" açıksa `KLASİK DÜRÜMLER` → `Klasik Dürümler` (Türkçe harf kuralları).

## 6. Panel ayarları (Ayarlar → Bağlantılar → Vega Şefim)

| Ayar | Seçenekler | Varsayılan |
|---|---|---|
| Ne yapsın? | Ekle ve güncelle · Sadece yenileri ekle · Sadece fiyatları güncelle | Ekle ve güncelle |
| Hangi fiyat? | Masa fiyatı (Şefim ana fiyat) · her fiyat şablonu (PAKET …) | Masa fiyatı |
| Hangi gruplar? | Şefim'deki gruplar (sistem grupları ayrı) | Sistem grupları hariç hepsi |
| Neler güncellensin? | Ad · Fiyat · Grup · Porsiyon ve seçenekler | Hepsi |
| Şefim'den silinince | Menüde gizle · Dokunma | Gizle |
| Aynı adlı ürünler | Birleştir · Ayrı ekle | Birleştir |
| Yeni ürünler | Menüde hemen görünsün · Gizli eklensin | Hemen görünsün |
| İsimleri düzelt | Açık/Kapalı | Açık |
| Uygulama | Otomatik · Önce ben bakayım (onaylı) | Otomatik |

## 7. Bilinmeyenler / doğrulanması gerekenler

- [ ] `Options` tablosunun sütunları. Çırak çalışırken sütunları kendisi bulur ve "Teşhis" ekranında gösterir; bulunamazsa seçenekler atlanır ve panelde uyarı çıkar.
- [ ] Choice1 → Choice2 ilişkisinin Şefim'deki anlamı (örn. pizza: Choice1 1044 altında KÜÇÜK/ORTA/BÜYÜK). Varsayım: Choice2'si olan Choice1, alt seçeneklerin grup başlığıdır.
- [ ] Şefim'de ürün silinince satırın tablodan gerçekten kalktığı (pasif sütunu olmadığı için varsayım).
- [ ] Gerçek restoran bilgisayarında uçtan uca deneme.

## 8. Adımlar

### Faz 0 — Hazırlık
- [x] Şefim veritabanı yapısı çıkarıldı (sqlcmd ile yalnızca okuma sorguları).
- [x] Bu yol haritası.

### Faz 1 — Sunucu (qr-menu/backend) — 2026-11-27
- [x] Prisma: `SefimLink` (`sefim_baglanti`), `SefimMap` (`sefim_esler`) tabloları. **Deploy'da `npm run setup` (db push) şart.**
- [x] `lib/sefim-sync.ts`: saf `planSync()`, ad düzeltme (yabancı kelime listesiyle: PIZZA → Pizza), porsiyon/seçenek dönüştürme, toplu kaybolma güvenliği. Test: `tests/sefim-sync.test.mjs`.
- [x] `lib/sefim-link.ts`: eşleştirme kodu, anahtar (yalnızca SHA-256), görüntü saklama, planı tek işlemde (transaction) uygulama, son 20 işlem geçmişi, Çırak sorun notu.
- [x] `routes/sefim.ts`: `/api/sefim/pair`, `/api/sefim/push` (tam görüntü · `unchanged` · `problem`), `/api/admin/sefim` (durum, ayarlar, kod, önizleme, uygula, bağlantıyı kes). Test: `tests/sefim-link.test.mjs` (bellek içi DB, uçtan uca).
- Not: "değişmedi" sinyalinde özet tutmazsa sunucu `resend` ister; görüntüsüz istek asla boş görüntü olarak kaydedilmez (menü boşalmasın).

### Faz 2 — Panel (qr-menu/frontend) — 2026-11-27
- [x] `components/admin/SefimIntegration.tsx` + `sefim-integration.css`; Ayarlar → Bağlantılar bölümünün başında "Vega Şefim" (2026-11-27'de Entegrasyonlar kartlarından buraya taşındı).
- [x] Şefim → Çırak → Menü canlı hattı, 3 adımlı kurulum (indir · Şefim'i bulsun · kod), soru kartlarıyla ayarlar, "İnce ayarlar" katlanır.
- [x] Önizleme kutuları + tek tek liste + "Menüye uygula" (onaylı modda), geçmiş, bağlantıyı kes (iki adımlı).
- [x] Fixture ile 1280/390/320, açık/koyu temada taşma ve konsol hatası yok (`frontend/node_modules/.qr-check/sf-run.mjs`).

### Faz 3 — Çırak (ayrı klasör `../Cirak`) — 2026-11-27
- [x] .NET Framework 4.8, tek exe (~160 KB), ek DLL yok. `frontend/public/indir/Cirak.exe` olarak panelden indirilir.
- [x] Tepsi simgesi (sorun olunca gri + bir kez uyarı) + Edge/Chrome `--app` penceresinde gömülü arayüz (127.0.0.1).
- [x] `C:\VEGA\Sefim\connectionstring.txt` otomatik bulma (C–F sürücüleri); bulunamazsa pencerenin her yerine sürükle-bırak.
- [x] Eşleştirme kodu, dakikalık döngü, "değişmedi" sinyali, sorun bildirimi, günlük, Windows ile başlama, kaldırma, teşhis.
- [x] Kendini `%LOCALAPPDATA%\Cirak` altına kurar; tek kopya; daha yeni sürüm açılınca eskisini kapatıp yerine geçer.

### Faz 4 — Doğrulama
- [x] Backend: tsc, `npm run test:sefim`, `test:garson`, entegrasyon testleri. Frontend: tsc, vite build.
- [x] Çırak: 46 birim testi (görüntü, bağlantı metni, pencere güvenliği), uçtan uca test (Çırak.exe ↔ gerçek `/api/sefim` kodu: eşleşme, ekleme, fiyat değişimi, değişmedi, Şefim'e ulaşılamama ve düzelme), 3 ekranın görüntüsü, gerçek exe duman testi.
- [ ] **Gerçek Şefim bilgisayarında deneme** (SQL Server'lı gerçek okuma, seçenek tablosu, kurulum/kısayol/başlangıç, SmartScreen). İlk denemede Çırak → Ayarlar → Teşhis sonucu alınmalı.
- [ ] Canlı sunucuda `db push` sonrası panelden kod alma ve eşleşme.

## 9. Deploy sırası
1. qr-menu commit/push → sunucuda her zamanki güncelleme + **`npm run setup`** (yeni tablolar) + frontend derlemesi → CloudPanel Restart.
2. Panel → Ayarlar → Bağlantılar → Vega Şefim kartı görünmeli; "Çırak'ı indir" `/indir/Cirak.exe` indirmeli.
3. Restoran bilgisayarında Çırak → kod → ilk eşitleme. İlk seferde "Önce ben bakayım" modu seçilip önizleme kontrol edilmesi önerilir.

## 10. Sıradaki olası işler (henüz yapılmadı)
- Fiyat değişikliklerini mevcut fiyat geçmişine (PriceChange) "Şefim eşitlemesi" olarak yazmak.
- Çırak için kod imzalama sertifikası (SmartScreen uyarısını kaldırır).
- Sipariş yönü (QR menü siparişini Şefim'e yazmak) — Şefim'e yazmayı gerektirir, ayrıca konuşulmalı.

## 11. Güvenlik

- Şefim şifresi sunucuya gitmez; Çırak'ta Windows DPAPI (CurrentUser) ile şifreli saklanır.
- Sunucu, köprü anahtarının yalnızca SHA-256 özetini saklar. Eşleştirme kodu 15 dakika geçerli, tek kullanımlık.
- Çırak'ın yerel arayüzü yalnızca `127.0.0.1` dinler; Host/Origin kontrolü ve özel başlık ister (başka siteler tetikleyemez).
- Öneri: Şefim için `sa` yerine yalnızca okuma yetkili ayrı SQL kullanıcısı (komut Çırak klasöründeki README'de).
