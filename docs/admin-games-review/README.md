# Oyun Ekranı kontrolü — 2026-11-17

Yeni yönetim sayfası gerçek React AdminLayout içinde Chrome'da render edildi. API yanıtları test düzeneğinde taklit edildi; işletme verisi değiştirilmedi.

- games-1440/1024/768/390/320.png: masaüstü, tablet, telefon yerleşimleri.
- games-dark.png: koyu panel teması.
- preview-*.png: mevcut Hafıza/Dedektif/Blitz bileşenleri ve yerel XOX denemesi.
- preview-320-short.png, settings-320-short.png: 320x480 kısa ekran, iç kaydırmalı alt pencereler.

Doğrulandı: ana/tekil anahtar kaydı, ana kapalıyken tekil seçimin korunması, görsel yükleme ve çift oluşturma, özel soru doğrulaması/kaydı, kayıtta hata ve taslağın korunması, işlem sürerken Escape engeli, dış tıkla kapanmama, dört denemenin açılması/oynanması, yenileme sonrası kayıt, GET hatasında yazma olmaması ve tekrar deneme, azaltılmış hareket. JavaScript/React console hatası ve belge yatay taşması yok.

XOX admin denemesinde iki taraf aynı cihazda oynar, müşteri odası oluşturulmaz. Blitz denemesi örnek ürünlerle çalışır. Fiziksel telefon, ekran okuyucu, ekran klavyesi, Safari/Zen ve gerçek çoklu cihaz eşleşmesi test edilmedi.
