# Proje çalışma kuralları

Bu dosya, bu depoda çalışan tüm yapay zeka asistanları ve geliştiriciler için kalıcı çalışma rehberidir. Projede çalışmaya başlamadan önce bu dosyayı ve `CALISMA-GUNLUGU.md` dosyasını okuyun. Kullanıcının güncel talimatları önceliklidir.

## Ürün ve tasarım

1. Uygulamayı olabildiğince sade tutun. Her alan ve işlem açık bir amaca hizmet etmelidir.
2. Gereksiz alanları ve butonları kaldırın. Bir işi üç tıklama yerine iki, mümkünse tek tıklamayla tamamlatmayı hedefleyin. Bunu yaparken gerekli işlevleri ve anlaşılır kullanımı koruyun.
3. Mobil tasarıma öncelik verin. Yalnızca masaüstünü küçültmekle yetinmeyin; gerektiğinde mobil için ayrı yerleşimler ve etkileşimler tasarlayın.

### Admin panelinde responsive çalışma yönü

- Panel sayfa sayfa sadeleştirilecek; ele alınmayan sayfaları topluca değiştirmeyin. Masaüstünde doğrudan düzenleme, mobilde tek sütun ve rahat dokunma alanları hedefleyin.
- Telefonda bilgiye ulaşmak için yatay kaydırma gerektirmeyin. Geniş tabloları anlamlı satır/kart yerleşimine dönüştürün; uzun adlar okunabilsin. Gereksiz sütunları ve tekrar eden işlem düğmelerini kaldırın.
- Mobil filtreler, işlemler ve ayrıntılar gerektiğinde alttan açılan, kendi içinde dikey kayabilen pencereler kullanmalı. Kapatma, geri/Escape, odak, kısa ekran, ekran klavyesi ve güvenli ekran boşluklarını dikkate alın. Sürükleme/sağ tık tek erişim yolu olmasın.
- Hareketler kısa ve amaca yönelik olmalı; hareket azaltma tercihine uyun. Özgünlüğü süslerden çok işi kolaylaştıran etkileşimlerde arayın. Her sayfayı dar telefon, tablet ve masaüstünde doğrulayın; fiziksel cihazda yapılmayan kontrolü yapılmış gibi sunmayın.

## Kod ve mevcut davranış

4. Gereksiz ve kullanılmayan kodları temizleyin. Bir kodun kullanılmadığını doğrulamadan silmeyin; temizliği ele alınan işin kapsamıyla sınırlayın.
5. Mevcut çalışan projeyi bozmayın. Değişiklikten önce ilgili akışı, bağımlılıklarını ve mevcut davranışı inceleyin. İstenen değişiklik dışındaki çalışan işlevleri koruyun.
6. Dosya ve klasör yapısını dikkatli, anlaşılır ve sürdürülebilir kurun. Uygun olan mevcut düzeni kullanın; hatalıysa gerekçesini açıklayarak ilgili kısmı düzenleyin. Gereksiz büyük yeniden yapılandırmalardan kaçının.

## Kontrol ve teslim

7. Değiştirilen her dosyayı ve son farkları kontrol edin. Değişikliğe uygun derleme, test veya akış kontrollerini yapın; mobil arayüz değişikliklerinde mobil görünümü de doğrulayın. Yapılmayan veya engellenen kontrolleri açıkça belirtin; doğrulanmamış bir şeyi çalışıyor olarak sunmayın.
8. Her tamamlanan değişiklikten sonra kullanıcıya şunları verin:
   - Neyin değiştiği ve neden değiştiği.
   - Yapılan kontroller, sonuçları ve varsa kalan sınırlamalar.
   - Değişikliği anlatan kısa bir commit mesajı.
   - Kullanıcının terminalde çalıştırabileceği Git komutları: yalnızca ilgili dosyaları içeren `git add`, önerilen mesajla `git commit` ve mevcut dala uygun `git push`.
9. Commit ve GitHub'a gönderme işlemlerini kullanıcı yapar. Kullanıcı ayrıca açıkça istemedikçe otomatik commit, push veya sunucuya deploy yapmayın. Kullanıcı GitHub'a gönderdikten sonra SSH üzerinden sunucuya bağlanıp deploy işlemini kendisi yapar.

## İşin devamlılığı

- Tamamlanan anlamlı işleri `CALISMA-GUNLUGU.md` dosyasına kısa kayıtlar halinde ekleyin: tarih, amaç, değişiklikler, doğrulama ve varsa kalan iş.
- Günlükte planlanan işleri tamamlanmış gibi yazmayın. Yeni bir asistanın mevcut durumu anlayabilmesi için doğrulanmış bilgi ile bekleyen işi ayırın.
- Kullanıcıyla Türkçe ve sade bir dille iletişim kurun.
