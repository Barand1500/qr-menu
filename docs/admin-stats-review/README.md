# İstatistikler kontrolü — 2026-11-17

Gerçek Chrome, React AdminLayout ve taklit API ile doğrulandı. İşletme verisi değiştirilmedi.

- stats-1440/1024/768/390/320.png: sıralamalar, uzun ürün adı, dönem seçimleri.
- audience-*.png: dil dağılımı ve telefon yerleşimi.
- stats-dark.png: koyu panel teması.
- stats-empty.png: boş dönem.
- stats-partial-error.png: bir veri kaynağı başarısızken diğer raporlar.

Kontroller: ay/yıl aralıkları ve anında filtreleme, eski yanıtın yeni raporu ezmemesi, sekmelerde ok tuşları, cihaz seçimine göre halka yüzdesi, kısmi hata/yeniden deneme, boş ve bozuk sayılar, azaltılmış hareket, demo modu. Beş ekran genişliğinde yatay belge taşması ve JavaScript/React console hatası yok.

Ek test: frontend/tests/stats-model.test.mjs, üç saat diliminde takvim sınırları ve artık yıl; sayı temizleme ve sıralama.

Tüm rakamlar örnektir. İlk 10 kayıt toplamı ile tekil ziyaretçi sayısı birbirine karıştırılmaz. Canlı veri, fiziksel cihaz, ekran okuyucu ve Safari/Zen test edilmedi.
