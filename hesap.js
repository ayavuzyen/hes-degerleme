/* HES Satın Alma Değerlendirmesi — hesap çekirdeği.
 * Arayüzden bağımsız, saf fonksiyonlar. Tarayıcıda window.Hesap, Node'da module.exports.
 * Her kural test/hesap.test.js içinde bir sınamayla karşılanır.
 *
 * Para birimi: iç hesap dolar. Satıcının TL rakamları girilen kurla dolara çevrilir,
 * sonuçlar yine bu kurla TL'ye döner. Kur ileride değişirse TL karşılıkları değişir,
 * dolar bazlı değer değişmez; YEKDEM fiyatı da dolara bağlı güncellendiği için bu yaklaşım
 * gerçeğe en yakın olanı.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Hesap = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Sürüm tek kaynaktan: sayfa altı ve servis çalışanının önbellek adı bunu okur.
  const SURUM = "1.0.0";

  const SABIT = Object.freeze({
    yeniRejimBaslangic: 2021 + 6 / 12,  // 1 Temmuz 2021 ve sonrası işletmeye girenler yeni (TL) YEKDEM'e tabi
    katkiYil: 5,                         // yerli katkı ilavesi işletmeye girişten itibaren 5 yıl
    yekdemYil: 10,                       // alım garantisi 10 yıl
    saatYil: 8760,
    saatAy: 730,
    kdv: 0.20
  });

  const DURUMLAR = Object.freeze({
    acik: "Sorulmadı",
    soruldu: "Soruldu, cevap bekleniyor",
    tamam: "Cevap alındı, sorun yok",
    dikkat: "Cevap alındı, dikkat gerekiyor"
  });

  // ---------- Girdi alanları ----------
  // tur: para (binlik noktası kabul), ondalik, tam, ay (YYYY-MM), secim.
  // ornek: sayfa ilk açıldığında gösterilen, belirli bir santrale ait olmayan değer.
  const ALANLAR = Object.freeze([
    { k: "fiyatTL", g: "fiyat", etiket: "İstenen fiyat", birim: "TL", tur: "para", min: 100000, max: 1e11, ornek: "60.000.000" },
    { k: "kur", g: "fiyat", etiket: "Dolar kuru", birim: "TL", tur: "ondalik", min: 1, max: 1000, ornek: "48,9" },
    { k: "degerlemeAy", g: "fiyat", etiket: "Devir tarihi", tur: "ay", ornek: "", ipucu: "Boş bırakılırsa bu ay alınır." },

    { k: "kuruluMW", g: "santral", etiket: "Kurulu güç", birim: "MW", tur: "ondalik", min: 0.01, max: 100, ornek: "1,5" },
    { k: "kabulAy", g: "santral", etiket: "İşletmeye giriş (geçici kabul)", tur: "ay", ornek: "2022-06", ipucu: "Tutanaktaki tarih. YEKDEM türünü ve bitişini bu belirler." },
    { k: "rejim", g: "santral", etiket: "YEKDEM türü", tur: "secim", ornek: "otomatik",
      secenekler: [["otomatik", "Tarihe göre seç"], ["yeni", "Yeni YEKDEM (TL)"], ["eski", "Eski YEKDEM (dolar)"]] },
    { k: "yerliKatki", g: "santral", etiket: "Yerli katkı ilavesi", tur: "secim", ornek: "hayir",
      secenekler: [["evet", "Var (türbin/jeneratör yerli)"], ["hayir", "Yok"]] },
    { k: "yeniYekdemKr", g: "santral", etiket: "YEKDEM fiyatı", birim: "kr/kWh", tur: "ondalik", min: 1, max: 1e5, ornek: "350,49",
      rejim: "yeni", ipucu: "EPİAŞ her ay yayımlar. Nehir tipi HES, Temmuz 2026: 350,49." },
    { k: "yeniKatkiKr", g: "santral", etiket: "Yerli katkı", birim: "kr/kWh", tur: "ondalik", min: 0, max: 1e5, ornek: "74,78",
      rejim: "yeni", katki: true, ipucu: "Temmuz 2026: 74,78." },
    { k: "eskiYekdemCent", g: "santral", etiket: "YEKDEM fiyatı", birim: "$cent/kWh", tur: "ondalik", min: 0.1, max: 100, ornek: "7,3",
      rejim: "eski", ipucu: "HES için 7,3." },
    { k: "eskiKatkiCent", g: "santral", etiket: "Yerli katkı", birim: "$cent/kWh", tur: "ondalik", min: 0, max: 100, ornek: "2,3",
      rejim: "eski", katki: true, ipucu: "Türbin 1,3 + jeneratör 1,0; yalnız yerli olan parçayı yazın." },
    { k: "piyasaUsd", g: "santral", etiket: "Garanti bitince satış fiyatı", birim: "$/MWh", tur: "ondalik", min: 0, max: 1000, ornek: "55",
      ipucu: "Piyasa fiyatı. HES'in bol ürettiği ilkbaharda düşük olur; temkinli yazın." },

    { k: "verimliAy", g: "gelir", etiket: "Verimli ay sayısı", birim: "ay", tur: "tam", min: 0, max: 12, ornek: "6" },
    { k: "verimliAylikMin", g: "gelir", etiket: "Verimli ayda aylık gelir, en az", birim: "TL", tur: "para", min: 0, max: 1e10, ornek: "1.500.000" },
    { k: "verimliAylikMax", g: "gelir", etiket: "Verimli ayda aylık gelir, en çok", birim: "TL", tur: "para", min: 0, max: 1e10, ornek: "1.800.000" },
    { k: "digerMin", g: "gelir", etiket: "Kalan ayların toplam geliri, en az", birim: "TL", tur: "para", min: 0, max: 1e11, ornek: "2.000.000" },
    { k: "digerMax", g: "gelir", etiket: "Kalan ayların toplam geliri, en çok", birim: "TL", tur: "para", min: 0, max: 1e11, ornek: "3.500.000" },
    { k: "kdv", g: "gelir", etiket: "Gelir rakamları", tur: "secim", ornek: "haric",
      secenekler: [["haric", "KDV hariç"], ["dahil", "KDV dahil"]] },

    { k: "giderYillik", g: "gider", etiket: "Yıllık işletme gideri", birim: "$", tur: "para", min: 0, max: 1e9, ornek: "60.000",
      ipucu: "Personel, bakım, sigorta, regülatör temizliği, muhasebe, haberleşme." },
    { k: "ilkBakim", g: "gider", etiket: "İlk yıl ek bakım", birim: "$", tur: "para", min: 0, max: 1e9, ornek: "40.000",
      ipucu: "Ertelenmiş revizyon, muayenede çıkan işler." },
    { k: "revizyonYil", g: "gider", etiket: "Büyük revizyon yılı", birim: "yıl", tur: "tam", min: 0, max: 50, ornek: "12",
      ipucu: "0 yazılırsa büyük revizyon hesaba girmez." },
    { k: "revizyonTutar", g: "gider", etiket: "Büyük revizyon tutarı", birim: "$", tur: "para", min: 0, max: 1e9, ornek: "150.000" },

    { k: "sure", g: "beklenti", etiket: "Değerlendirme süresi", birim: "yıl", tur: "tam", min: 1, max: 50, ornek: "25",
      ipucu: "Sonrası için değer verilmez (temkinli)." },
    { k: "getiriDusuk", g: "beklenti", etiket: "Beklenen yıllık getiri, alt", birim: "%", tur: "ondalik", min: 0, max: 100, ornek: "12" },
    { k: "getiriYuksek", g: "beklenti", etiket: "Beklenen yıllık getiri, üst", birim: "%", tur: "ondalik", min: 0, max: 100, ornek: "15" },
    { k: "vergiOrani", g: "beklenti", etiket: "Kurumlar vergisi", birim: "%", tur: "ondalik", min: 0, max: 100, ornek: "25" },
    { k: "amortisman", g: "beklenti", etiket: "Vergiden düşülecek yıllık amortisman", birim: "$", tur: "para", min: 0, max: 1e9, ornek: "0",
      ipucu: "Bilinmiyorsa 0 (temkinli)." },
    { k: "degerlemeEsasi", g: "beklenti", etiket: "Makul fiyatı hesaplarken", tur: "secim", ornek: "oncesi",
      secenekler: [["oncesi", "Vergi öncesi nakit"], ["sonrasi", "Vergi sonrası nakit"]] }
  ]);

  const GRUPLAR = Object.freeze([
    ["fiyat", "Fiyat ve kur"],
    ["santral", "Santral ve satış fiyatı"],
    ["gelir", "Satıcının söylediği gelir"],
    ["gider", "Giderler"],
    ["beklenti", "Beklenti ve vergi"]
  ]);

  const TEKNIK_ALANLAR = Object.freeze([
    { k: "dusu", etiket: "Düşü", birim: "m", tur: "ondalik", min: 1, max: 2000, ornek: "240" },
    { k: "debi", etiket: "Debi", birim: "m³/s", tur: "ondalik", min: 0.001, max: 1000, ornek: "1" },
    { k: "verim", etiket: "Toplam verim", birim: "%", tur: "ondalik", min: 30, max: 95, ornek: "85" },
    { k: "kurulu", etiket: "Kurulu güç", birim: "MW", tur: "ondalik", min: 0.01, max: 100, ornek: "1,5" },
    { k: "cap", etiket: "Cebri boru çapı", birim: "mm", tur: "ondalik", min: 50, max: 10000, ornek: "600" },
    { k: "kalinlik", etiket: "Et kalınlığı", birim: "mm", tur: "ondalik", min: 1, max: 200, ornek: "10" },
    { k: "darbe", etiket: "Su darbesi payı", birim: "%", tur: "ondalik", min: 0, max: 200, ornek: "20",
      ipucu: "Saptırıcılı Pelton'da %10–20, saptırıcısız kapamada daha fazla." },
    { k: "korozyon", etiket: "Paslanma payı", birim: "mm", tur: "ondalik", min: 0, max: 50, ornek: "2" },
    { k: "celik", etiket: "Çelik kalitesi", tur: "secim", ornek: "235",
      secenekler: [["235", "S235 (St37)"], ["275", "S275"], ["355", "S355 (St52)"]] },
    { k: "emniyet", etiket: "Emniyet katsayısı", tur: "ondalik", min: 1, max: 5, ornek: "1,67",
      ipucu: "1,67: izin verilen gerilme akmanın %60'ı." }
  ]);

  // ---------- Sayı ve tarih okuma ----------
  // Türkçe yazımda virgül ondalık, nokta binliktir; çoğu kişi yine de nokta ile ondalık yazar.
  // Para alanında "1.800.000" binlik sayılır; diğer alanlarda tek nokta ondalıktır.
  // İçerideki boşluk silinmez: "2 3" sessizce 23 olmasın.
  function temizle(s) {
    if (s === null || s === undefined) return "";
    return String(s).normalize("NFKC").trim();
  }

  function sayiOku(girdi, tur) {
    const s = temizle(girdi);
    if (s === "") return { ok: false, bos: true, hata: "Boş" };
    if (s.length > 24) return { ok: false, hata: "Çok uzun" };
    if (!/^[0-9.,]+$/.test(s)) return { ok: false, hata: "Yalnızca rakam, nokta ve virgül yazın" };
    if (!/[0-9]/.test(s)) return { ok: false, hata: "Rakam yok" };
    let norm;
    const virgul = (s.match(/,/g) || []).length;
    if (virgul > 1) return { ok: false, hata: "Birden fazla virgül var" };
    if (virgul === 1) {
      if (!/^(\d{1,3}(\.\d{3})+|\d+)?,\d*$/.test(s)) return { ok: false, hata: "Sayı anlaşılmadı" };
      norm = s.replace(/\./g, "").replace(",", ".");
    } else {
      const nokta = (s.match(/\./g) || []).length;
      if (tur === "para" && /^\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, "");
      else if (nokta > 1) return { ok: false, hata: "Sayı anlaşılmadı" };
      else norm = s;
    }
    const v = Number(norm);
    if (!Number.isFinite(v)) return { ok: false, hata: "Sayı anlaşılmadı" };
    return { ok: true, deger: v };
  }

  // "2022-12", "12.2022" ya da "12/2022" → 2022 + 11/12
  function ayOku(girdi) {
    const s = temizle(girdi);
    if (s === "") return { ok: false, bos: true, hata: "Boş" };
    let m = /^(\d{4})-(\d{1,2})$/.exec(s), y, a;
    if (m) { y = +m[1]; a = +m[2]; }
    else if ((m = /^(\d{1,2})[./](\d{4})$/.exec(s))) { a = +m[1]; y = +m[2]; }
    else return { ok: false, hata: "Ay ve yıl anlaşılmadı (örnek: 2022-12)" };
    if (a < 1 || a > 12) return { ok: false, hata: "Ay 1 ile 12 arasında olmalı" };
    if (y < 1990 || y > 2100) return { ok: false, hata: "Yıl 1990 ile 2100 arasında olmalı" };
    return { ok: true, deger: y + (a - 1) / 12 };
  }

  function ayMetni(ondalikYil) {
    const top = Math.round(ondalikYil * 12);
    const y = Math.floor(top / 12), a = top - y * 12 + 1;
    return String(a).padStart(2, "0") + "." + y;
  }

  function buAy(tarih) {
    const d = tarih || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  // Tek alanı okur. Hata varsa { ok:false, hata }.
  function alanOku(tanim, ham) {
    if (tanim.tur === "secim") {
      const v = temizle(ham);
      const var_ = tanim.secenekler.some((s) => s[0] === v);
      return var_ ? { ok: true, deger: v } : { ok: false, hata: "Seçim geçersiz" };
    }
    const r = tanim.tur === "ay" ? ayOku(ham) : sayiOku(ham, tanim.tur);
    if (!r.ok) return r;
    if (tanim.tur === "tam" && !Number.isInteger(r.deger)) return { ok: false, hata: "Tam sayı olmalı" };
    if (tanim.min !== undefined && r.deger < tanim.min) return { ok: false, hata: `En az ${fmt(tanim.min, 2)} olmalı` };
    if (tanim.max !== undefined && r.deger > tanim.max) return { ok: false, hata: `En çok ${fmt(tanim.max, 2)} olabilir` };
    return r;
  }

  // Bütün girdileri okur. Parçalardan biri hatalıysa sonuç verilmez:
  // eksik bir hesap tam sanılabilir.
  function girdileriOku(ham, bugun) {
    const g = {}, hatalar = {};
    const h = Object.assign({}, ham || {});
    if (temizle(h.degerlemeAy) === "") h.degerlemeAy = buAy(bugun);
    for (const t of ALANLAR) {
      const r = alanOku(t, h[t.k]);
      if (r.ok) g[t.k] = r.deger; else hatalar[t.k] = r.hata;
    }
    const cift = [["verimliAylikMin", "verimliAylikMax"], ["digerMin", "digerMax"]];
    for (const [a, b] of cift) {
      if (!(a in hatalar) && !(b in hatalar) && g[a] > g[b]) hatalar[b] = "En az değerinden küçük olamaz";
    }
    if (!("getiriDusuk" in hatalar) && !("getiriYuksek" in hatalar) && g.getiriDusuk > g.getiriYuksek) {
      hatalar.getiriYuksek = "Alt değerden küçük olamaz";
    }
    if (!("kabulAy" in hatalar) && !("degerlemeAy" in hatalar) && g.degerlemeAy < g.kabulAy) {
      hatalar.degerlemeAy = "İşletmeye giriş tarihinden önce olamaz";
    }
    return { ok: Object.keys(hatalar).length === 0, g, hatalar };
  }

  // ---------- Satış fiyatı ----------
  function rejimBelirle(g) {
    if (g.rejim === "yeni" || g.rejim === "eski") return g.rejim;
    return g.kabulAy >= SABIT.yeniRejimBaslangic - 1e-9 ? "yeni" : "eski";
  }

  // Bütün fiyatlar $/MWh. kr/kWh × 10 = TL/MWh; cent/kWh × 10 = $/MWh.
  function fiyatlar(g) {
    const rejim = rejimBelirle(g);
    const yekdem = rejim === "yeni" ? g.yeniYekdemKr * 10 / g.kur : g.eskiYekdemCent * 10;
    const katkiHam = rejim === "yeni" ? g.yeniKatkiKr * 10 / g.kur : g.eskiKatkiCent * 10;
    return {
      rejim, yekdem,
      katki: g.yerliKatki === "evet" ? katkiHam : 0,
      piyasa: g.piyasaUsd,
      katkiBitis: g.kabulAy + SABIT.katkiYil,
      yekdemBitis: g.kabulAy + SABIT.yekdemYil
    };
  }

  // [a, b) aralığının sınırdan önce kalan payı.
  function oncePay(a, b, sinir) {
    if (sinir <= a) return 0;
    if (sinir >= b) return 1;
    return (sinir - a) / (b - a);
  }

  // Aralıktaki ortalama fiyat. Mevsimsellik yok sayılır: yıl içindeki her ay eşit ağırlıklı.
  function ortalamaFiyat(f, a, b) {
    const pY = oncePay(a, b, f.yekdemBitis), pK = oncePay(a, b, Math.min(f.katkiBitis, f.yekdemBitis));
    return f.yekdem * pY + f.katki * pK + f.piyasa * (1 - pY);
  }

  // ---------- Senaryolar ----------
  const SENARYOLAR = Object.freeze([
    { k: "kotu", ad: "Kötü", pay: 0 },
    { k: "beklenen", ad: "Beklenen", pay: 0.5 },
    { k: "iyi", ad: "İyi", pay: 1 }
  ]);

  function aylikGelirTL(g, pay) {
    const v = g.verimliAylikMin + (g.verimliAylikMax - g.verimliAylikMin) * pay;
    return g.kdv === "dahil" ? v / (1 + SABIT.kdv) : v;
  }

  function yillikCiroTL(g, pay) {
    const diger = g.digerMin + (g.digerMax - g.digerMin) * pay;
    const brut = g.verimliAy * (g.verimliAylikMin + (g.verimliAylikMax - g.verimliAylikMin) * pay) + diger;
    return g.kdv === "dahil" ? brut / (1 + SABIT.kdv) : brut;
  }

  // Satıcının geliri son 12 ayın fiyatıyla elde edildi; üretim buradan geri hesaplanır.
  // Sonraki yıllarda aynı üretim, o yılın fiyatıyla satılır.
  function nakitAkisi(g, pay) {
    const f = fiyatlar(g);
    const ciroTL = yillikCiroTL(g, pay), ciroUsd = ciroTL / g.kur;
    const refFiyat = ortalamaFiyat(f, g.degerlemeAy - 1, g.degerlemeAy);
    const uretimMWh = refFiyat > 0 ? ciroUsd / refFiyat : 0;
    const yillar = [];
    let kum = 0, kumVS = 0;
    for (let t = 1; t <= g.sure; t++) {
      const a = g.degerlemeAy + t - 1, b = a + 1;
      const fiyat = ortalamaFiyat(f, a, b);
      const gelir = uretimMWh * fiyat;
      const gider = g.giderYillik + (t === 1 ? g.ilkBakim : 0) + (t === g.revizyonYil ? g.revizyonTutar : 0);
      const net = gelir - gider;
      const vergi = Math.max(0, net - g.amortisman) * g.vergiOrani / 100;
      kum += net; kumVS += net - vergi;
      yillar.push({ t, bas: a, fiyat, gelir, gider, net, vergi, netVS: net - vergi, kum, kumVS });
    }
    return { f, ciroTL, ciroUsd, refFiyat, uretimMWh, yillar };
  }

  function bugunkuDeger(akis, r) {
    let s = 0;
    for (let i = 0; i < akis.length; i++) s += akis[i] / Math.pow(1 + r, i + 1);
    return s;
  }

  // Ödenen fiyatı akışa eşitleyen yıllık getiri. Hiç dönmüyorsa null.
  function icVerim(fiyat, akis) {
    const fark = (r) => bugunkuDeger(akis, r) - fiyat;
    let lo = -0.99, hi = 1;
    if (!(fiyat > 0) || fark(lo) < 0 || fark(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
      const m = (lo + hi) / 2;
      if (fark(m) > 0) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  // Toplam nakdin fiyatı ilk geçtiği an, yıl kesirli. Dönmüyorsa null.
  function geriDonus(fiyat, akis) {
    let kum = 0;
    for (let i = 0; i < akis.length; i++) {
      const once = kum;
      kum += akis[i];
      if (kum >= fiyat && akis[i] > 0) return i + (fiyat - once) / akis[i];
    }
    return null;
  }

  function degerle(g) {
    const fiyatUsd = g.fiyatTL / g.kur;
    const esas = g.degerlemeEsasi === "sonrasi" ? "netVS" : "net";
    const kumEsas = esas === "netVS" ? "kumVS" : "kum";
    const sen = SENARYOLAR.map((s) => {
      const a = nakitAkisi(g, s.pay);
      const nakit = a.yillar.map((y) => y[esas]);
      const aylikUsd = aylikGelirTL(g, s.pay) / g.kur;
      return Object.assign({}, s, a, {
        kapasiteFaktoru: g.kuruluMW > 0 ? a.uretimMWh / (g.kuruluMW * SABIT.saatYil) : null,
        verimliOrtMW: g.verimliAy > 0 && a.refFiyat > 0 ? aylikUsd / a.refFiyat / SABIT.saatAy : null,
        irrOnce: icVerim(fiyatUsd, a.yillar.map((y) => y.net)),
        irrSonra: icVerim(fiyatUsd, a.yillar.map((y) => y.netVS)),
        geriDonus: geriDonus(fiyatUsd, nakit),
        degerDusuk: bugunkuDeger(nakit, g.getiriDusuk / 100),
        degerYuksek: bugunkuDeger(nakit, g.getiriYuksek / 100),
        kumulatif: [0].concat(a.yillar.map((y) => y[kumEsas]))
      });
    });

    const [kotu, bek, iyi] = sen;
    const pazarlik = {
      acilis: bek.degerYuksek * g.kur,
      hedef: bek.degerDusuk * g.kur,
      ustSinir: Math.max(iyi.degerDusuk, bek.degerDusuk) * g.kur
    };
    let karar;
    if (pazarlik.hedef <= 0 || g.fiyatTL > pazarlik.ustSinir) karar = "pahali";
    else if (g.fiyatTL > pazarlik.hedef) karar = "dikkat";
    else karar = "uygun";

    return {
      g, fiyatUsd, sen, pazarlik, karar,
      farkYuzde: pazarlik.hedef > 0 ? (g.fiyatTL / pazarlik.hedef - 1) * 100 : null,
      f: bek.f,
      kalanGarantiYil: Math.max(0, bek.f.yekdemBitis - g.degerlemeAy),
      kalanKatkiYil: bek.f.katki > 0 ? Math.max(0, Math.min(bek.f.katkiBitis, bek.f.yekdemBitis) - g.degerlemeAy) : 0,
      uyarilar: uyarilar(g, sen, bek.f)
    };
  }

  function uyarilar(g, sen, f) {
    const u = [];
    const [kotu, bek, iyi] = sen;
    const say = (v) => fmt(v * 100, 0);
    if (iyi.verimliOrtMW !== null && iyi.verimliOrtMW > g.kuruluMW * 1.02) {
      u.push({ s: "hata", m: `Verimli ay geliri, santralin kurulu gücünden fazla üretim gerektiriyor (${fmt(iyi.verimliOrtMW, 2)} MW > ${fmt(g.kuruluMW, 2)} MW). Gelir, fiyat ya da kurulu güç yanlış yazılmış.` });
    } else if (bek.verimliOrtMW !== null && bek.verimliOrtMW < g.kuruluMW * 0.6) {
      u.push({ s: "bilgi", m: `En verimli aylarda bile santral ortalama ${fmt(bek.verimliOrtMW, 2)} MW, kurulu gücün %${say(bek.verimliOrtMW / g.kuruluMW)}'i ile çalışıyor. Su tasarımdaki kadar değil ya da gelir rakamı eksik söylenmiş.` });
    }
    for (const s of sen) {
      if (s.kapasiteFaktoru === null) continue;
      if (s.kapasiteFaktoru > 0.6) {
        u.push({ s: "hata", m: `${s.ad} senaryoda kapasite faktörü %${say(s.kapasiteFaktoru)}. Küçük nehir santralinde bu gerçekçi değil; gelir rakamını faturayla teyit edin.` });
        break;
      } else if (s.kapasiteFaktoru > 0.5) {
        u.push({ s: "dikkat", m: `${s.ad} senaryoda kapasite faktörü %${say(s.kapasiteFaktoru)}. Küçük nehir santrali için yüksek; faturayla teyit edin.` });
        break;
      }
    }
    const kalan = f.yekdemBitis - g.degerlemeAy;
    if (kalan <= 0) {
      u.push({ s: "dikkat", m: `Alım garantisi ${ayMetni(f.yekdemBitis)} tarihinde bitmiş. Satış piyasa fiyatından yapılıyor.` });
    } else if (bek.geriDonus !== null && bek.geriDonus > kalan) {
      u.push({ s: "dikkat", m: `Beklenen senaryoda yatırım ${fmt(bek.geriDonus, 1)} yılda dönüyor, alım garantisinin ise ${fmt(kalan, 1)} yılı kalmış (${ayMetni(f.yekdemBitis)}). Geri dönüşün bir kısmı piyasa fiyatına bağlı.` });
    }
    if (bek.geriDonus === null) {
      u.push({ s: "hata", m: `Beklenen senaryoda ${g.sure} yıl içinde yatırım geri dönmüyor.` });
    }
    if (f.katki > 0) {
      const kb = Math.min(f.katkiBitis, f.yekdemBitis);
      if (kb <= g.degerlemeAy) u.push({ s: "bilgi", m: `Yerli katkı ilavesi ${ayMetni(kb)} tarihinde bitmiş.` });
      else u.push({ s: "bilgi", m: `Yerli katkı ilavesi ${ayMetni(kb)} tarihinde bitiyor. Sonrasında gelir yaklaşık %${say(f.katki / (f.yekdem + f.katki))} düşer; hesap bunu içeriyor.` });
    }
    if (g.rejim === "otomatik" && Math.abs(g.kabulAy - SABIT.yeniRejimBaslangic) <= 0.5 + 1e-9) {
      u.push({ s: "dikkat", m: "İşletmeye giriş tarihi eski ve yeni YEKDEM sınırına (1 Temmuz 2021) yakın. Fark büyük; tarihi geçici kabul tutanağından teyit edin." });
    }
    if (g.revizyonYil > g.sure) {
      u.push({ s: "bilgi", m: "Büyük revizyon yılı değerlendirme süresinin dışında; hesaba girmedi." });
    }
    return u;
  }

  // ---------- Teknik sağlama ----------
  // P = ρ g Q H η. kW döner.
  function hidrolikGuc(t) {
    const kw = 9.81 * t.debi * t.dusu * t.verim / 100;
    const gerekenDebi = t.kurulu * 1000 / (9.81 * t.dusu * t.verim / 100);
    return { kw, oran: kw / (t.kurulu * 1000), gerekenDebi };
  }

  // İnce cidarlı boru çevre gerilmesi: σ = p·D / (2·t_etkin).
  function cebriBoru(t) {
    const pMPa = 1000 * 9.81 * t.dusu * (1 + t.darbe / 100) / 1e6;
    const etkin = t.kalinlik - t.korozyon;
    const izin = Number(t.celik) / t.emniyet;
    const gereken = pMPa * t.cap / (2 * izin) + t.korozyon;
    if (!(etkin > 0)) return { ok: false, hata: "Paslanma payı et kalınlığından büyük", pMPa, izin, gereken };
    const sigma = pMPa * t.cap / (2 * etkin);
    return { ok: true, pMPa, sigma, izin, oran: sigma / izin, gereken };
  }

  function teknikOku(ham) {
    const t = {}, hatalar = {};
    for (const a of TEKNIK_ALANLAR) {
      const r = alanOku(a, (ham || {})[a.k]);
      if (r.ok) t[a.k] = r.deger; else hatalar[a.k] = r.hata;
    }
    return { ok: Object.keys(hatalar).length === 0, t, hatalar };
  }

  // ---------- Kayıt dosyası ----------
  // Dosyadan açılan veri güvenilmez: yalnız bilinen alanlar, dizge değerler ve sınırlı uzunluk alınır.
  const ID_KALIBI = /^[a-z0-9-]{1,40}$/;
  const NOT_MAX = 4000;
  function kendi(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function duzNesne(o) { return o !== null && typeof o === "object" && !Array.isArray(o); }

  function durumDogrula(ham) {
    if (!duzNesne(ham)) return { ok: false, hata: "Dosya bir kayıt dosyası değil" };
    if (ham.tur !== undefined && ham.tur !== "hes-degerleme") return { ok: false, hata: "Bu dosya başka bir programa ait" };
    const uyari = [];
    const alanDizgeleri = (kaynak, tanimlar) => {
      const out = {};
      if (!duzNesne(kaynak)) return out;
      for (const t of tanimlar) {
        if (!kendi(kaynak, t.k)) continue;
        const v = kaynak[t.k];
        if (typeof v === "string" && v.length <= 40) out[t.k] = v;
        else if (typeof v === "number" && Number.isFinite(v)) out[t.k] = String(v).replace(".", ",");
        else uyari.push(`"${t.k}" alanı okunamadı, atlandı`);
      }
      return out;
    };
    const durum = {
      girdiler: alanDizgeleri(ham.girdiler, ALANLAR),
      teknik: alanDizgeleri(ham.teknik, TEKNIK_ALANLAR),
      sorular: {},
      baslik: typeof ham.baslik === "string" ? ham.baslik.slice(0, 120) : ""
    };
    if (duzNesne(ham.sorular)) {
      for (const id of Object.keys(ham.sorular)) {
        const s = ham.sorular[id];
        if (!ID_KALIBI.test(id) || !duzNesne(s)) { uyari.push(`"${String(id).slice(0, 40)}" sorusu okunamadı, atlandı`); continue; }
        const d = typeof s.d === "string" && kendi(DURUMLAR, s.d) ? s.d : "acik";
        const n = typeof s.n === "string" ? s.n.slice(0, NOT_MAX) : "";
        if (typeof s.n === "string" && s.n.length > NOT_MAX) uyari.push(`"${id}" notu ${NOT_MAX} karakterde kesildi`);
        durum.sorular[id] = { d, n };
      }
    }
    return { ok: true, durum, uyari };
  }

  // ---------- Biçim ----------
  const bicimciler = {};
  function fmt(v, basamak) {
    if (v === null || v === undefined || !Number.isFinite(v)) return "–";
    const b = basamak === undefined ? 2 : basamak;
    const key = String(b);
    if (!bicimciler[key]) bicimciler[key] = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: b, maximumFractionDigits: b });
    const s = bicimciler[key].format(v);
    return s === "-0" || /^-0,0+$/.test(s) ? s.slice(1) : s;
  }
  const milyonTL = (v) => fmt(v / 1e6, 1) + " milyon TL";
  const binUsd = (v) => fmt(v / 1000, 0) + " bin $";
  const yuzde = (v) => (v === null ? "dönmüyor" : "%" + fmt(v * 100, 1));
  const yil = (v) => (v === null ? "dönmüyor" : fmt(v, 1) + " yıl");

  function ozetMetni(d, soruSay) {
    if (!d) return "";
    const g = d.g, [k, b, i] = d.sen;
    const out = [];
    out.push("HES SATIN ALMA DEĞERLENDİRMESİ");
    out.push(`İstenen: ${milyonTL(g.fiyatTL)} (${fmt(d.fiyatUsd / 1e6, 2)} milyon $, kur ${fmt(g.kur, 2)})`);
    out.push(`Makul fiyat (beklenen senaryo, %${fmt(g.getiriYuksek, 0)}–%${fmt(g.getiriDusuk, 0)} getiri): ${fmt(d.pazarlik.acilis / 1e6, 1)}–${fmt(d.pazarlik.hedef / 1e6, 1)} milyon TL`);
    out.push(`Pazarlık: açılış ${fmt(d.pazarlik.acilis / 1e6, 1)}, hedef ${fmt(d.pazarlik.hedef / 1e6, 1)}, üst sınır ${fmt(d.pazarlik.ustSinir / 1e6, 1)} milyon TL`);
    out.push(`Yıllık ciro: kötü ${binUsd(k.ciroUsd)}, beklenen ${binUsd(b.ciroUsd)}, iyi ${binUsd(i.ciroUsd)}`);
    out.push(`İstenen fiyatla yıllık dolar getirisi (vergi öncesi): ${yuzde(k.irrOnce)} / ${yuzde(b.irrOnce)} / ${yuzde(i.irrOnce)}`);
    out.push(`Geri dönüş: ${yil(k.geriDonus)} / ${yil(b.geriDonus)} / ${yil(i.geriDonus)}`);
    out.push(`Alım garantisi bitişi: ${ayMetni(d.f.yekdemBitis)} (kalan ${fmt(d.kalanGarantiYil, 1)} yıl)`);
    if (soruSay) out.push(`Sorular: ${soruSay.acik} açık, ${soruSay.dikkat} dikkat gerektiren`);
    out.push("Not: satıcının rakamlarına dayalı kaba hesaptır, yatırım tavsiyesi değildir.");
    return out.join("\n");
  }

  return {
    SURUM, SABIT, DURUMLAR, ALANLAR, GRUPLAR, TEKNIK_ALANLAR, SENARYOLAR,
    sayiOku, ayOku, ayMetni, buAy, alanOku, girdileriOku,
    rejimBelirle, fiyatlar, oncePay, ortalamaFiyat, yillikCiroTL, nakitAkisi,
    bugunkuDeger, icVerim, geriDonus, degerle,
    hidrolikGuc, cebriBoru, teknikOku, durumDogrula,
    fmt, milyonTL, binUsd, yuzde, yil, ozetMetni
  };
});
