/* Satıcıya sorulacaklar ve istenecek belgeler.
 * Belirli bir santrale ait bilgi burada durmaz; cevaplar ve notlar kullanıcının kayıt dosyasındadır.
 * Kimlikler (id) kalıcıdır: değiştirilirse eski kayıtlardaki notlar eşleşmez.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Sorular = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const GRUPLAR = [
    {
      id: "kritik", ad: "İlk görüşmede sorulacaklar",
      aciklama: "Anlaşmayı bozabilecek konular. Cevapsız kalan varsa fiyat konuşulmaz.",
      sorular: [
        { id: "lisans-turu", m: "Santral lisanslı mı, lisanssız mı? Lisans ya da çağrı mektubu numarası, bitiş tarihi, hangi dağıtım şirketine bağlı?" },
        { id: "satis-sekli", m: "Şirket (hisse) mi satılıyor, yalnız santral (varlık) mı? Hisse devri için onay mı gerekiyor, bildirim yeterli mi?" },
        { id: "yekdem", m: "YEKDEM'den yararlanıyor mu? Geçici kabul (işletmeye giriş) tarihi günü gününe ne? Fiyat TL mi, dolar mı? Yerli katkı ilavesi alıyor mu, ne zaman bitiyor?" },
        { id: "uretim-5yil", m: "Son yılların aylık üretimi (kWh) ve satış faturaları. Satıcının tablosu değil, dağıtım şirketinin ya da EPİAŞ'ın kaydı." },
        { id: "su-hakki", m: "DSİ Su Kullanım Hakkı Anlaşması geçerli mi, süresi ne kadar kaldı? Can suyu ne kadar, kurak ayda üretimi ne kadar kesiyor?" },
        { id: "arazi", m: "Santral binası, regülatör, iletim hattı ve cebri boru kimin arazisinde? Hazine ya da orman arazisi için kesin izin var mı? Kamulaştırması bitmemiş parsel var mı?" },
        { id: "rehin-dava", m: "Rehin, ipotek, haciz ya da dava var mı? Banka kredisi için hisse ya da lisans rehni verilmiş mi?" }
      ]
    },
    {
      id: "teknik", ad: "Teknik",
      sorular: [
        { id: "turbin", m: "Türbin tipi, üreticisi, ünite sayısı ve imal yılı? Plaka fotoğrafları." },
        { id: "jenerator", m: "Jeneratör, trafo ve şalt ne durumda? Üreticileri ve plakaları?" },
        { id: "revizyon", m: "En son ne zaman revizyon yapıldı? Bakım kim tarafından, hangi sıklıkla yapılıyor? Yazılı bakım sözleşmesi var mı?" },
        { id: "tasarim", m: "Tasarım düşüsü (net) ve tasarım debisi ne? Fiili değerler bunlara ne kadar yakın?" },
        { id: "ariza", m: "Son 3 yılda kaç arıza oldu, santral toplam kaç gün durdu? Arıza ve bakım defteri görülebilir mi?" },
        { id: "iletim", m: "İletim yapısı (kanal, tünel, boru) ne, uzunluğu ve malzemesi ne? Sızıntı, heyelan ya da çatlak var mı?" },
        { id: "heyelan", m: "Heyelan olan bölge hangi yapının üstünde? Tamir nasıl yapıldı, rapor ve fotoğraf var mı? Zemin hareketi izleniyor mu?" },
        { id: "regulator", m: "Regülatör ve çökeltim havuzunda sediment sorunu var mı? Temizlik yılda kaç kez yapılıyor, kim yapıyor?" },
        { id: "cebri-boru", m: "Cebri borunun çapı, et kalınlığı (boydan boya aynı mı), çelik kalitesi ne? Son kalınlık ölçümü ne zaman yapıldı?" },
        { id: "scada", m: "SCADA ve uzaktan izleme var mı? Santral insansız çalışabiliyor mu? Alarm kime gidiyor?" },
        { id: "yedek-parca", m: "Yedek parça stoğu ne? Çark, meme ve iğne, yatak rulmanı yedeği var mı? Üretici hâlâ parça veriyor mu?" },
        { id: "baglanti", m: "Enerji nakil hattı ve bağlantı noktasının kapasitesi yeterli mi? Şebeke kaynaklı kesinti sık oluyor mu?" },
        { id: "kacak", m: "Makine dairesinde su ya da yağ kaçağı var mı? Türbin gövdesi ve jeneratör altındaki lekeler nereden geliyor?" },
        { id: "yatak-sicaklik", m: "Yatak ve sargı sıcaklıkları normal mi? SCADA'dan son bir yılın sıcaklık grafiği." },
        { id: "taskin", m: "Taşkında santral binası ya da makine çukuru su alıyor mu? Drenaj pompası var mı?" },
        { id: "muayene", m: "Satın almadan önce bağımsız muayene: çark kovaları ve meme kontrolü (çatlak testi), jeneratör izolasyon testi, trafo yağ analizi yapılabilir mi?" },
        { id: "personel", m: "Kaç kişi çalışıyor? Tek kişiyse izin, hastalık ve gece alarmında kim gidiyor? Resmi işletme sorumlusu kim?" }
      ]
    },
    {
      id: "hidroloji", ad: "Su ve havza",
      sorular: [
        { id: "agi", m: "Hangi akım gözlem istasyonunun (AGİ) verisi kullanılıyor, kaç yıllık veri var?" },
        { id: "memba", m: "Havzada, santralin yukarısında yeni HES, sulama ya da içme suyu projesi var mı?" },
        { id: "komsu-proje", m: "Aynı dere ya da havzada başka santral veya proje var mı? Yukarıda mı, aşağıda mı? Aynı enerji hattına mı bağlı?" },
        { id: "komsu-uretim", m: "Komşu santralin üretimi görülebilir mi? Aynı yağışla ne üretiyor, bizimkiyle karşılaştırılabilir mi?" },
        { id: "ilave-su", m: "İlave su bağlama ya da güneş santrali ekleme konuşuluyorsa: izin durumu ne, bağlantı kapasitesi yeter mi? (Fiyata katılmamalı.)" }
      ]
    },
    {
      id: "mali", ad: "Ticari ve mali",
      sorular: [
        { id: "gelir", m: "Son 3 yılın gelir tablosu. Elektrik kime, hangi yolla satılıyor?" },
        { id: "gelir-donem", m: "Söylenen aylık gelir hangi döneme ait, KDV dahil mi? Yıllık toplam faturayla ne kadar?" },
        { id: "gider", m: "Yıllık işletme gideri kalem kalem: personel, bakım, sigorta, sistem kullanım bedeli, kira, muhasebe." },
        { id: "sigorta", m: "Sigorta poliçesi var mı? Makine kırılması, kâr kaybı, sel ve heyelan teminatı içeriyor mu?" },
        { id: "borc", m: "Vergi, SGK ya da belediye borcu var mı? Güncel borç yazıları." },
        { id: "fiyat-dayanak", m: "İstenen fiyat nasıl hesaplandı? Fiyat TL mi, dolar mı? Devir tarihine kadarki gelir kime kalacak?" },
        { id: "neden", m: "Santral neden satılıyor?" },
        { id: "mahsup", m: "Kendi şirketimizin tüketimiyle mahsuplaşma mümkün mü? Dağıtım şirketinden yazılı görüş alındı mı?" }
      ]
    },
    {
      id: "mevzuat", ad: "Mevzuat ve izinler",
      sorular: [
        { id: "ced", m: "ÇED kararı ya da ÇED gerekli değildir belgesi var mı? Taahhütlere uyuluyor mu?" },
        { id: "anlasmalar", m: "Bağlantı anlaşması ve sistem kullanım anlaşması geçerli mi?" },
        { id: "kabul", m: "Geçici ve kesin kabul tutanakları tamam mı? Kesin kabul yapılmadıysa neden?" },
        { id: "ruhsat", m: "Yapı ruhsatı ve yapı kullanma izni (iskân) var mı?" },
        { id: "ceza", m: "EPDK, DSİ ya da çevre müdürlüğünden son yıllarda ceza veya uyarı gelmiş mi?" },
        { id: "dsi-payi", m: "DSİ katkı payı ya da benzeri bir ödeme yükümlülüğü var mı? Anlaşmada yazılı olarak görüldü mü?" }
      ]
    },
    {
      id: "ortaklik", ad: "Bizim taraf: ortaklık ve devir",
      aciklama: "Satıcıya değil, ortaklar arasında netleşecek konular. Yazdırılan listeye girmez.",
      icSoru: true,
      sorular: [
        { id: "araci-pay", m: "Aracı ya da yüklenici ortağın payı nasıl alınıyor: parasını koyarak mı, emek ya da aracılık karşılığı mı?" },
        { id: "araci-alacak", m: "Yüklenicinin satıcıdan inşaat alacağı var mı? Varsa satış onun tahsilat yolu mu?" },
        { id: "bagimsiz", m: "Bağımsız teknik muayeneyi kim yapacak? (Santrali yapan kişi değil.)" },
        { id: "ortaklar-sozlesmesi", m: "Ortaklar sözleşmesi: kim karar verir, onaysız harcama sınırı, ortak çıkarsa önalım ve değerleme, kâr dağıtımı." },
        { id: "bakim-fonu", m: "Bakım fonu: cironun ne kadarı ayrı hesapta tutulacak?" },
        { id: "normal-arizalar", m: "Ortaklara 'normal arızalar' listesi okutuldu mu? (Izgara tıkanması, sediment, şebeke kesintisi, rulman, hidrolik yağ kaçağı.)" },
        { id: "odeme-plani", m: "Ödeme planı: bedelin bir kısmı ilk sezon üretimi teyit edilince mi ödenecek?" },
        { id: "teminat", m: "Geçmiş vergi, SGK ve dava borçları için sözleşme maddesi ve bedelden teminat tutulacak mı?" }
      ]
    },
    {
      id: "belgeler", ad: "İstenecek belgeler",
      belge: true,
      sorular: [
        { id: "b-uretim", m: "Son yılların aylık üretim ve satış faturaları, sayaç kayıtları" },
        { id: "b-kabul", m: "Geçici ve kesin kabul tutanakları" },
        { id: "b-lisans", m: "Lisans ya da çağrı mektubu, bağlantı ve sistem kullanım anlaşmaları" },
        { id: "b-su", m: "DSİ Su Kullanım Hakkı Anlaşması" },
        { id: "b-arazi", m: "Tapu, kira, irtifak belgeleri; orman ve hazine izinleri" },
        { id: "b-plaka", m: "Türbin, jeneratör ve trafo plakaları ve teknik föyleri; yerli malı belgesi" },
        { id: "b-scada", m: "SCADA'dan son bir yıl: debi, güç, yatak sıcaklığı, duruş kayıtları" },
        { id: "b-bakim", m: "Arıza ve bakım defteri, revizyon raporları" },
        { id: "b-proje", m: "Proje sonu (as-built) çizimleri ve hesapları" },
        { id: "b-gider", m: "Son iki yılın gider dökümü" },
        { id: "b-sirket", m: "Şirket: bilanço, vergi levhası, ticaret sicili, vergi ve SGK borcu yoktur yazısı, kredi ve rehin kayıtları, dava listesi" }
      ]
    }
  ];

  function hepsi() {
    const out = [];
    for (const g of GRUPLAR) for (const s of g.sorular) out.push(Object.assign({ grup: g.id }, s));
    return out;
  }

  // Durum sayıları. Kaydı olmayan soru "açık" sayılır.
  function say(kayit) {
    const s = { toplam: 0, acik: 0, soruldu: 0, tamam: 0, dikkat: 0 };
    for (const q of hepsi()) {
      s.toplam++;
      const d = kayit && kayit[q.id] ? kayit[q.id].d : "acik";
      s[d in s ? d : "acik"]++;
    }
    return s;
  }

  return { GRUPLAR, hepsi, say };
});
