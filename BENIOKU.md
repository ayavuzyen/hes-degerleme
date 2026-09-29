# HES Satın Alma Değerlendirmesi

Satılık küçük bir hidroelektrik santrali için satıcının verdiği rakamlardan makul fiyatı,
geri dönüş süresini ve pazarlık aralığını çıkarır. Satıcıya sorulacakları ve istenecek
belgeleri takip eder, cevapları not olarak tutar.

**Adres:** https://ayavuzyen.github.io/hes-degerleme/

## Bölümler

- **Değerleme:** fiyat, kur, işletmeye giriş tarihi, satıcının söylediği aylık gelir ve
  giderler girilir. Program üç senaryo (kötü, beklenen, iyi) hesaplar, açılış teklifi, hedef
  ve üst sınırı verir. Yazılan rakamlarda tutarsızlık varsa uyarır: kurulu güçten fazla
  üretim gerektiren gelir, gerçekçi olmayan kapasite faktörü, garantiden uzun geri dönüş gibi.
- **Sorular:** satıcıya sorulacaklar ve istenecek belgeler. Her birinin durumu ve notu
  tutulur. "Satıcıya gidecek listeyi yazdır" yalnız cevabı alınmamış soruları basar;
  notlarınız ve ortaklar arasındaki sorular kâğıda çıkmaz.
- **Teknik sağlama:** düşü ve debiden çıkan güç kurulu güçle tutuyor mu, cebri boru
  kalınlığı basınca yetiyor mu? Kaba sağlamadır, mühendis hesabının yerini tutmaz.

## Verileriniz nerede durur

Rakamlar ve notlar **yalnız sizin tarayıcınızda** ve kaydettiğiniz dosyada durur. Hiçbir
sunucuya gönderilmez, bu depoya da girmez. Depoda yalnızca program vardır; herhangi bir
santrale ait bilgi yoktur.

- Tarayıcı her değişikliği kendiliğinden saklar. Aynı bilgisayarda aynı tarayıcıyla
  açınca kaldığınız yerden devam edersiniz.
- **Dosyaya kaydet** ile bir `.json` dosyası iner. Ortaklara bu dosyayı gönderin
  (WhatsApp, e-posta); onlar **Dosyadan aç** ile açar.
- Gizli sekmede ya da tarayıcı verisi silinince tarayıcıdaki kayıt kaybolur. Önemli
  aşamalarda dosyaya kaydedin.

## Telefona uygulama olarak ekleme

- **Android (Chrome):** adresi açın → sağ üstteki ⋮ → *Ana ekrana ekle*.
- **iPhone (Safari):** adresi açın → Paylaş → *Ana Ekrana Ekle*.

Bir kez açıldıktan sonra internet yokken de çalışır.

## Güncelleme nasıl gelir

Program GitHub Pages'ten yayımlanır. Depoya yeni sürüm gönderilince:

1. GitHub birkaç dakika içinde sayfayı yeniler.
2. Açık olan sayfa her 30 dakikada bir ve sekmeye her dönüldüğünde `hesap.js` içindeki
   sürüm numarasına bakar. Numara değiştiyse üstte **"Programın yeni sürümü yüklendi"**
   bandı çıkar; **Yenile** demek yeter.
3. Sayfayı ilk kez açan ya da kapatıp açan herkes zaten yeni sürümü alır.

Tarayıcıda ve dosyada saklanan veriler güncellemeden etkilenmez.

**Yeni sürüm çıkarırken:** `hesap.js` içindeki `SURUM` numarasını artırın, sınamaları
çalıştırın, sonra gönderin.

```
python test/hepsi.py
git commit -am "..."
git push
```

## Hesap kuralları

- İç hesap dolardır. Satıcının TL rakamları girilen kurla dolara çevrilir. YEKDEM fiyatı
  dolara göre güncellendiği için satış fiyatı dolar bazında sabit sayılır.
- Yıllık üretim, satıcının söylediği gelirin son 12 aydaki satış fiyatına bölünmesiyle
  bulunur. Sonraki yıllarda aynı üretim o yılın fiyatıyla satılır.
- İşletmeye giriş 1 Temmuz 2021'den önceyse eski (dolar) YEKDEM, sonrasıysa yeni (TL)
  YEKDEM uygulanır. Alım garantisi 10 yıl, yerli katkı ilavesi 5 yıl sürer. Bitiş yıl
  içine düşerse o yıl kesirli bölünür.
- Garanti bitince satış, yazılan piyasa fiyatından yapılır.
- Makul fiyat, nakit akışının beklenen getiriyle bugüne indirgenmiş değeridir.
  Açılış = beklenen senaryo, üst getiri. Hedef = beklenen senaryo, alt getiri.
  Üst sınır = iyi senaryo, alt getiri.
- Bir alan hatalıysa **hiçbir sonuç gösterilmez**; hangi alanın hatalı olduğu yazılır.
  Eksik girdiyle çıkan bir sonuç doğru sanılabilir.
- `60.000.000` ve `60000000` aynı okunur. Para alanında nokta binlik ayırıcıdır;
  diğer alanlarda (kur, MW) tek nokta ondalık sayılır.

Hesaplar yatırım tavsiyesi değildir. Karar öncesi faturalarla bir mali müşavire ya da
değerleme uzmanına teyit ettirin.

## Sınama

```
python test/hepsi.py
```

Sırasıyla: hesap çekirdeği sınamaları (Node; sonuçlar bağımsız bir Python hesabıyla
karşılaştırılır), teslim paketi (depoda yalnız beyaz listedeki dosyalar), gizli veri
(deponun dışındaki `gizli-kelimeler.txt` listesindeki kelimeler depoda geçmemeli) ve
tutarlılık (çevrimdışı önbellek listesi, dış adres yokluğu). Gereken: Python 3.10+, Node 18+.
