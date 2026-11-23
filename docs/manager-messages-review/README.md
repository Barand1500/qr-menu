# Yöneticiye yaz

23 Kasım 2026 — mevcut Sahne/Sofra müşteri tasarımına uyumlu özel mesaj kanalı.

## Kullanım

1. Başlangıç Ayarları → Tema Ayarları → **Yöneticiye yaz** anahtarını açın; Kaydet ile yayınlayın.
Kaydet sonrası aynı tarayıcıdaki açık menü sekmeleri de güncellenir. Diğer cihazlar odak/sekme dönüşünde veya görünür sayfada 30 saniyelik kontrolle değişikliği alır. Bunun için yalnızca açık/kapalı durumu ve yayınlanan iletişim bilgilerini döndüren `manager-contact` endpoint’i kullanılır; mesaj içerikleri bu yoldan okunmaz.

2. Yönetici e-postası ve telefonu isteğe bağlıdır. Doldurulan bilgiler bu bölümde müşteriye görünür. Boş bırakılırsa mesaj formu yine çalışır.
3. Müşteri karşılama ekranından veya menüde Diğer → Yöneticiye yaz üzerinden ulaşır. Öneri/şikâyet seçer; adı ve geri dönüş bilgisi isteğe bağlıdır.
4. Mesaj **Raporlar → Yönetici Mesajları** gelen kutusuna kaydolur. Yönetici okuyabilir, arayabilir, okundu işaretleyebilir ve silebilir. İletişim bırakan misafir için mevcut yanıt bağlantıları kullanılır.
5. Özellik kapalıyken müşteri bağlantıları görünmez ve sunucu yeni gönderimleri reddeder. Eski mesajlar yöneticinin gelen kutusunda korunur.

## Yetki ve veri

- Ayrı `ManagerMessage` modeli (`yonetici_mesajlari`); mevcut öneri/şikâyet tablolarına kopyalanmaz. Bu nedenle personelin mevcut geri bildirim listelerinde, sayaçlarında veya asistan bağlamında yer almaz.
- Okuma, okundu işaretleme ve silme API'si gerçek veritabanındaki güncel `admin` rolünü her istekte kontrol eder. Menü gizlemesi tek güvenlik katmanı değildir.
- Her okuma/değişiklik işletme kimliğiyle sınırlıdır. İstemcinin gönderdiği hedef işletme/rol bilgisi kabul edilmez. Gelen kutusu yanıtı `no-store` kullanır; public mesaj okuma API'si yoktur.
- Mesaj 5–2000 karakter; ad ve geri dönüş bilgisi isteğe bağlı ve doğrulanır. Gönderimde tekrar tıklama engellenir. Hata olursa taslak korunur. Başarıdan sonra not metni formdan temizlenir ve alındı durumu gösterilir.
- İsimsiz gönderim endpoint'i işletme/IP başına 10 dakikada 5 istek sınırı uygular; bu sınırlayıcı tek sunucu sürecinin belleğindedir.
- Kapalı özellikte yönetici iletişim bilgileri public tema yanıtından da çıkarılır. Yönetim taslağında korunur.

## Sunucuda deploy

Yeni tabloyu oluşturmak ve Prisma istemcisini güncellemek gerekir. Proje kökünden, standart deploy akışınızda:

```sh
npm run db:push --prefix backend
npm run db:generate --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
```

Ardından mevcut servisiniz için kullandığınız yeniden başlatma işlemini yapın. Buradaki çalışmada `prisma generate` ve derlemeler çalıştırıldı; canlı veritabanına `db push` uygulanmadı. Yeni paket bağımlılığı eklenmedi.

## Doğrulama

- Backend ve frontend derlemeleri geçti. Önceki Vite büyük paket uyarısı devam ediyor.
- `node backend/tests/manager-messages.test.mjs`: gerçek Express route ve auth middleware'i, taklit veritabanı ile test edildi. Kapalı/açık özellik, form doğrulaması, anonim gönderim, personel erişim reddi, JWT içindeki sahte role güvenilmemesi, rol kaldırılınca erişim reddi, işletme ayrımı, arama/sayfalama, okundu/silme ve gönderim limiti geçti.
- `node backend/tests/theme-settings.test.mjs` ve `node backend/tests/sofra-config.test.mjs` geçti.
- Gerçek Chrome fixture: 320×640, 390×844, 768×800, 1024×640 ve 1440×900. Form açma/gönderme, öneri-şikâyet bilgisi, isteğe bağlı iletişim, gönderim sırasında Escape ile kapanmama, hata sonrası taslağı koruma, gelen kutusu, personel sayfa engeli (liste isteği atılmaz), kapalı özelliğin gizlenmesi, yatay taşma ve JavaScript hataları kontrol edildi. Tema Ayarları anahtarı ve e-posta alanının Kaydet isteğine gitmesi; ikinci açık menü sekmesinde yenilemeden gizlenme/geri gelme ve yeni e-postanın görünmesi de doğrulandı.
- Fiziksel telefon, gerçek MySQL tablo işlemleri ve canlı sunucuda uçtan uca gönderim denenmedi. Görüntüler fixture verileriyle çekildi.

## Görüntüler

- [Masaüstü form](desktop-form.png)
- [Telefon formu](mobile-form.png)
- [Dar telefon formu](narrow-form.png)
- [Tablet formu](tablet-form.png)
- [Kısa masaüstü ekranı](short-desktop-form.png)
- [Telefon gönderim durumu](mobile-sent.png)
- [Masaüstü gelen kutusu](desktop-inbox.png)
- [Telefon gelen kutusu](mobile-inbox.png)
