/* HES Değerleme — arayüz. Hesap kuralları hesap.js'de; burada ekran, kayıt, grafik ve güncelleme denetimi var.
 * Kullanıcının yazdığı hiçbir metin HTML olarak basılmaz; hepsi textContent ile girer.
 */
(function () {
  "use strict";
  const H = window.Hesap, S = window.Sorular;
  const ANAHTAR = "hes-degerleme.v1";
  const SEKME_ANAHTAR = "hes-degerleme.sekme";
  const GENIS = new Set(["fiyatTL", "kabulAy", "piyasaUsd", "amortisman", "degerlemeEsasi", "giderYillik", "rejim", "yerliKatki"]);
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");

  function el(tag, attrs, ...cocuk) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of cocuk.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : String(c));
    return e;
  }
  const NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, metin) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (metin !== undefined) e.textContent = metin;
    return e;
  }

  // ---------- Durum ve kayıt ----------
  function ornekDurum() {
    const girdiler = {}, teknik = {};
    for (const a of H.ALANLAR) girdiler[a.k] = a.ornek;
    for (const a of H.TEKNIK_ALANLAR) teknik[a.k] = a.ornek;
    return { baslik: "", girdiler, teknik, sorular: {}, ornek: true };
  }
  function tamamla(d) {
    const o = ornekDurum();
    return {
      baslik: d.baslik || "",
      girdiler: Object.assign(o.girdiler, d.girdiler),
      teknik: Object.assign(o.teknik, d.teknik),
      sorular: d.sorular || {},
      ornek: false
    };
  }
  function depodanOku() {
    try {
      const s = localStorage.getItem(ANAHTAR);
      if (!s) return null;
      const r = H.durumDogrula(JSON.parse(s));
      return r.ok ? tamamla(r.durum) : null;
    } catch (e) { return null; }
  }

  let durum = depodanOku() || ornekDurum();
  let depoCalisiyor = true, kayitZamani = null, zamanlayici = null, sonDeger = null;

  function kayitNesnesi() {
    return {
      tur: "hes-degerleme", surum: H.SURUM, kaydedildi: new Date().toISOString(),
      baslik: durum.baslik, girdiler: durum.girdiler, teknik: durum.teknik, sorular: durum.sorular
    };
  }
  function degisti() {
    durum.ornek = false;
    $("ornekBant").hidden = true;
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(depoyaYaz, 400);
  }
  function depoyaYaz() {
    try { localStorage.setItem(ANAHTAR, JSON.stringify(kayitNesnesi())); depoCalisiyor = true; kayitZamani = new Date(); }
    catch (e) { depoCalisiyor = false; }
    kayitDurumuGoster();
  }
  function kayitDurumuGoster() {
    $("kayitDurumu").textContent = !depoCalisiyor
      ? "Tarayıcı kaydı çalışmıyor; işinizi dosyaya kaydedin."
      : kayitZamani ? "Bu tarayıcıda kayıtlı · " + pad(kayitZamani.getHours()) + ":" + pad(kayitZamani.getMinutes()) : "";
  }

  let iletiZaman = null;
  function ileti(metin, tur) {
    const b = $("ileti");
    b.className = "bant " + (tur || "bilgi");
    b.textContent = metin;
    b.hidden = false;
    clearTimeout(iletiZaman);
    iletiZaman = setTimeout(() => { b.hidden = true; }, 8000);
  }

  function dosyaAdi() {
    const t = new Date();
    const tarih = t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
    const ad = (durum.baslik || "hes-degerleme").toLocaleLowerCase("tr-TR")
      .replace(/[^a-z0-9çğıöşü]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "hes-degerleme";
    return ad + "-" + tarih + ".json";
  }
  function dosyayaKaydet() {
    const ad = dosyaAdi();
    const url = URL.createObjectURL(new Blob([JSON.stringify(kayitNesnesi(), null, 2)], { type: "application/json" }));
    const a = el("a", { href: url, download: ad });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    ileti("Dosya indirildi: " + ad + ". Ortaklar bu dosyayı \"Dosyadan aç\" ile açar.");
  }
  async function dosyadanAc(f) {
    if (!f) return;
    if (f.size > 2e6) return ileti("Dosya çok büyük; bu programın kayıt dosyası değil.", "hata");
    let obj;
    try { obj = JSON.parse(await f.text()); } catch (e) { return ileti("Dosya okunamadı: kayıt dosyası değil.", "hata"); }
    const r = H.durumDogrula(obj);
    if (!r.ok) return ileti(r.hata, "hata");
    if (!durum.ornek && !confirm("Ekrandaki girdiler ve notlar, dosyadakilerle değişecek. Devam edilsin mi?")) return;
    durum = tamamla(r.durum);
    depoyaYaz();
    hepsiniCiz();
    ileti("\"" + f.name + "\" açıldı." + (r.uyari.length ? " " + r.uyari.length + " kayıt okunamadı ve atlandı." : ""), r.uyari.length ? "uyari" : "bilgi");
  }

  async function ozetKopyala() {
    if (!sonDeger) return ileti("Önce hatalı alanları düzeltin; eksik hesabın özeti çıkarılmaz.", "uyari");
    const s = S.say(durum.sorular);
    const metin = (durum.baslik ? durum.baslik + "\n" : "") + H.ozetMetni(sonDeger, { acik: s.acik + s.soruldu, dikkat: s.dikkat });
    try {
      await navigator.clipboard.writeText(metin);
    } catch (e) {
      const t = el("textarea", { style: "position:fixed;top:-100px" });
      t.value = metin; document.body.append(t); t.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      t.remove();
      if (!ok) return ileti("Kopyalanamadı. Tarayıcı panoya erişim vermedi.", "hata");
    }
    ileti("Özet kopyalandı. WhatsApp'a yapıştırabilirsiniz.");
  }

  // ---------- Girdi alanları ----------
  const girdiEl = {}, teknikEl = {};
  let rejimBilgiEl = null;

  function alanKur(a, kayit, degisince, onek) {
    const id = onek + a.k;
    let input;
    if (a.tur === "secim") {
      input = el("select", { id }, a.secenekler.map(([v, t]) => el("option", { value: v, text: t })));
      input.addEventListener("change", () => degisince(a.k, input.value));
    } else {
      const ay = a.tur === "ay";
      input = el("input", {
        id, class: ay ? null : "n", type: ay ? "month" : "text", inputmode: ay ? null : "decimal",
        autocomplete: "off", spellcheck: "false", placeholder: ay ? "yyyy-aa" : a.ornek
      });
      input.addEventListener("input", () => degisince(a.k, input.value));
    }
    const hata = el("small", { class: "hata", id: id + "-h" });
    const yanki = el("small", { class: "yanki" });
    input.setAttribute("aria-describedby", id + "-h");
    const kap = el("label", { class: "alan" + (GENIS.has(a.k) ? " genis" : ""), for: id },
      el("span", { class: "et" }, a.etiket, a.birim ? el("span", { class: "birim", text: " · " + a.birim }) : null),
      input,
      a.ipucu ? el("small", { class: "ipucu", text: a.ipucu }) : null,
      yanki, hata);
    kayit[a.k] = { input, hata, yanki, kap, a };
    return kap;
  }

  function degerKoy(x, ham) {
    let v = ham === undefined || ham === null ? "" : String(ham);
    if (x.a.tur === "ay" && x.input.type === "month" && v !== "" && !/^\d{4}-\d{2}$/.test(v)) {
      const r = H.ayOku(v);
      if (r.ok) { const top = Math.round(r.deger * 12); v = Math.floor(top / 12) + "-" + pad(top % 12 + 1); }
    }
    if (document.activeElement !== x.input) x.input.value = v;
  }

  function formKur() {
    const kap = $("girdiler");
    kap.textContent = "";
    for (const [gid, gad] of H.GRUPLAR) {
      const alanlar = el("div", { class: "alanlar" });
      for (const a of H.ALANLAR.filter((x) => x.g === gid)) {
        alanlar.append(alanKur(a, girdiEl, (k, v) => { durum.girdiler[k] = v; degisti(); hesapla(); }, "a-"));
      }
      if (gid === "santral") { rejimBilgiEl = el("div", { class: "rejim-bilgi" }); alanlar.append(rejimBilgiEl); }
      kap.append(el("fieldset", null, el("legend", { text: gad }), alanlar));
    }
  }

  function okunur(v, birim) {
    if (Math.abs(v) >= 1e6) return "≈ " + H.fmt(v / 1e6, 2) + " milyon " + birim;
    if (Math.abs(v) >= 1e3) return "≈ " + H.fmt(v / 1e3, 0) + " bin " + birim;
    return "";
  }

  function alanHatalariniGoster(tanimlar, elMap, hatalar, degerler) {
    for (const a of tanimlar) {
      const x = elMap[a.k];
      const h = hatalar[a.k];
      x.hata.textContent = h ? (h === "Boş" ? "Boş bırakılamaz" : h) : "";
      x.input.setAttribute("aria-invalid", h ? "true" : "false");
      x.yanki.textContent = a.tur === "para" && !h ? okunur(degerler[a.k], a.birim) : "";
    }
  }

  function gorunenRejim(ham) {
    const k = H.ayOku(ham.kabulAy);
    if (ham.rejim === "yeni" || ham.rejim === "eski") return ham.rejim;
    return k.ok ? H.rejimBelirle({ rejim: "otomatik", kabulAy: k.deger }) : "yeni";
  }

  // ---------- Değerleme ----------
  function hesapla() {
    const ham = Object.assign({}, durum.girdiler);
    const rejim = gorunenRejim(ham);
    const katki = ham.yerliKatki === "evet";
    for (const a of H.ALANLAR) {
      const gizli = (a.rejim && a.rejim !== rejim) || (a.katki && !katki);
      girdiEl[a.k].kap.hidden = !!gizli;
      // Görünmeyen alan hesaba girmez; içindeki eski bir yazım hatası sonucu durdurmasın.
      if (gizli && !H.alanOku(a, ham[a.k]).ok) ham[a.k] = a.ornek;
    }
    const r = H.girdileriOku(ham);
    alanHatalariniGoster(H.ALANLAR, girdiEl, r.hatalar, r.g);
    rejimBilgisi(ham, rejim, r);
    if (!r.ok) { sonDeger = null; sonucHata(r.hatalar); altCubuk(null); return; }
    sonDeger = H.degerle(r.g);
    sonucCiz(sonDeger);
    altCubuk(sonDeger);
  }

  function rejimBilgisi(ham, rejim, r) {
    const k = H.ayOku(ham.kabulAy);
    if (!k.ok) { rejimBilgiEl.textContent = "İşletmeye giriş tarihini yazın; YEKDEM türü ve bitişi buradan çıkar."; return; }
    let m = (rejim === "yeni" ? "Yeni YEKDEM (TL, dolara göre güncellenir)" : "Eski YEKDEM (dolar)") +
      ". Alım garantisi " + H.ayMetni(k.deger + H.SABIT.yekdemYil) + " tarihinde biter";
    if (ham.yerliKatki === "evet") m += ", yerli katkı " + H.ayMetni(k.deger + H.SABIT.katkiYil) + " tarihinde";
    m += ".";
    if (r.ok) {
      const f = H.fiyatlar(r.g);
      m += " Bugünkü fiyat " + H.fmt(f.yekdem, 1) + " $/MWh" + (f.katki > 0 ? " + katkı " + H.fmt(f.katki, 1) : "") + ".";
    }
    rejimBilgiEl.textContent = m;
  }

  function sonucHata(hatalar) {
    const kap = $("sonuclar");
    kap.textContent = "";
    const adlar = Object.keys(hatalar).map((k) => {
      const a = H.ALANLAR.find((x) => x.k === k);
      return a ? a.etiket : k;
    });
    kap.append(el("div", { class: "bant hata" }, "Hesap yapılamadı. Düzeltilecek alanlar: " + adlar.join(", ") + "."));
  }

  const Mtl = (v) => H.fmt(v / 1e6, 1);
  const KARAR = {
    uygun: ["✓", "İstenen fiyat makul aralıkta"],
    dikkat: ["!", "Pazarlıkla inmesi gerekiyor"],
    pahali: ["✕", "İstenen fiyat pahalı"]
  };

  function sonucCiz(d) {
    const kap = $("sonuclar");
    kap.textContent = "";
    const g = d.g, p = d.pazarlik, [kotu, bek, iyi] = d.sen;

    let aciklama;
    if (p.hedef <= 0) {
      aciklama = `Beklenen senaryoda santral ${g.sure} yılda %${H.fmt(g.getiriDusuk, 0)} getiri beklentisini karşılayacak nakit üretmiyor.`;
    } else {
      aciklama = `İstenen ${Mtl(g.fiyatTL)} milyon TL. Beklenen senaryoda makul fiyat ${Mtl(p.acilis)}–${Mtl(p.hedef)} milyon TL; istenen fiyat hedefin %${H.fmt(Math.abs(d.farkYuzde), 0)} ${d.farkYuzde >= 0 ? "üstünde" : "altında"}.`;
      if (d.karar === "dikkat") aciklama += ` Üst sınıra (${Mtl(p.ustSinir)} milyon TL) ancak iyi senaryo faturayla teyit edilirse çıkılır.`;
    }
    kap.append(el("div", { class: "karar " + d.karar },
      el("div", { class: "kb" }, el("span", { class: "ik" }, el("span", { text: KARAR[d.karar][0] })), KARAR[d.karar][1]),
      el("p", { text: aciklama })));

    kap.append(el("div", { class: "kutular" },
      kutu("Açılış teklifi", p.acilis, `Beklenen senaryo, %${H.fmt(g.getiriYuksek, 0)} getiri`),
      kutu("Hedef", p.hedef, `Beklenen senaryo, %${H.fmt(g.getiriDusuk, 0)} getiri`, true),
      kutu("Üst sınır", p.ustSinir, `İyi senaryo, %${H.fmt(g.getiriDusuk, 0)} getiri. Faturayla teyit şartı.`)));

    // Senaryo tablosu
    const esasAd = g.degerlemeEsasi === "sonrasi" ? "vergi sonrası" : "vergi öncesi";
    const satirlar = [
      ["Yıllık ciro", (s) => `${H.fmt(s.ciroTL / 1e6, 1)} M TL · ${H.fmt(s.ciroUsd / 1e3, 0)} bin $`],
      ["Yıllık üretim", (s) => H.fmt(s.uretimMWh / 1000, 2) + " GWh"],
      ["Kapasite faktörü", (s) => "%" + H.fmt(s.kapasiteFaktoru * 100, 0)],
      ["Verimli ayda ortalama güç", (s) => (s.verimliOrtMW === null ? "–" : H.fmt(s.verimliOrtMW, 2) + " MW")],
      ["Yıllık dolar getirisi, vergi öncesi *", (s) => H.yuzde(s.irrOnce)],
      ["Yıllık dolar getirisi, vergi sonrası *", (s) => H.yuzde(s.irrSonra)],
      [`Geri dönüş (${esasAd}) *`, (s) => H.yil(s.geriDonus)],
      [`Makul fiyat, %${H.fmt(g.getiriDusuk, 0)} getiriyle`, (s) => Mtl(s.degerDusuk * g.kur) + " M TL"],
      [`Makul fiyat, %${H.fmt(g.getiriYuksek, 0)} getiriyle`, (s) => Mtl(s.degerYuksek * g.kur) + " M TL"]
    ];
    const renk = { kotu: "s2", beklenen: "s1", iyi: "s3" };
    const tablo = el("table", null,
      el("thead", null, el("tr", null, el("th", { text: "" }),
        d.sen.map((s) => el("th", null, el("span", { class: "nokta " + renk[s.k] }), s.ad)))),
      el("tbody", null, satirlar.map(([ad, f], j) => el("tr", { class: j === 7 ? "vurgu" : null },
        el("td", { text: ad }), d.sen.map((s) => el("td", { class: "num", text: f(s) }))))));
    kap.append(el("div", { class: "card" },
      el("h3", { text: "Senaryolar" }),
      el("div", { class: "tablo-kap" }, tablo),
      el("p", { class: "not", style: "margin-top:8px" },
        "* İstenen fiyatla. Kötü: satıcının en az rakamları, iyi: en çok rakamları, beklenen: ikisinin ortası.")));

    // Grafik
    const grafikKap = el("div", { class: "grafik-kap" });
    kap.append(el("div", { class: "card" },
      el("h3", { text: `Kasaya giren toplam nakit (${esasAd}, bugünkü kurla milyon TL)` }),
      el("div", { class: "lejant" },
        el("span", null, el("i", { class: "s2" }), "Kötü"),
        el("span", null, el("i", { class: "s1" }), "Beklenen"),
        el("span", null, el("i", { class: "s3" }), "İyi"),
        el("span", null, el("i", { class: "fiyat" }), "İstenen fiyat")),
      grafikKap,
      el("p", { class: "not", style: "margin-top:6px" },
        "Çizgi fiyatı geçtiği yılda yatırım döner. Noktalı dikey çizgi, alım garantisinin bittiği an. Rakamlar için alttaki yıllık tabloya bakın.")));
    grafikCiz(grafikKap, d);

    if (d.uyarilar.length) {
      kap.append(el("div", { class: "card" }, el("h3", { text: "Dikkat edilecekler" }),
        el("ul", { class: "uyarilar" }, d.uyarilar.map((u) => el("li", { class: u.s, text: u.m })))));
    }

    // Yıllık tablo
    const gBit = d.f.yekdemBitis;
    const yt = el("table", null,
      el("thead", null, el("tr", null, ["Yıl", "Dönem", "Satış fiyatı $/MWh", "Gelir", "Gider", "Net", "Vergi", "Vergi sonrası", "Toplam (" + esasAd + ")"]
        .map((b) => el("th", { text: b })))),
      el("tbody", null, bek.yillar.map((y) => el("tr", { class: gBit > y.bas && gBit <= y.bas + 1 ? "vurgu" : null },
        el("td", { text: String(y.t) }),
        el("td", { class: "num", text: H.ayMetni(y.bas) }),
        [y.fiyat, y.gelir / 1e3, y.gider / 1e3, y.net / 1e3, y.vergi / 1e3, y.netVS / 1e3, (g.degerlemeEsasi === "sonrasi" ? y.kumVS : y.kum) / 1e3]
          .map((v, j) => el("td", { class: "num", text: H.fmt(v, j === 0 ? 1 : 0) }))))));
    kap.append(el("details", { class: "card" },
      el("summary", { text: "Yıllık nakit akışı, beklenen senaryo (bin $)" }),
      el("div", { class: "tablo-kap" }, yt),
      el("p", { class: "not", style: "margin-top:8px" }, "Vurgulu satır: alım garantisinin bittiği yıl.")));

    kap.append(el("div", { class: "card not" },
      el("h3", { text: "Hesabın varsayımları" }),
      el("ul", { style: "margin:0;padding-left:18px" },
        el("li", { text: `Kur ${H.fmt(g.kur, 2)} TL/$. Satış fiyatı dolar bazında sabit sayılır; YEKDEM fiyatı dolara göre güncellendiği için.` }),
        el("li", { text: "Üretim, satıcının söylediği gelirin son 12 aydaki fiyata bölünmesiyle bulunur ve her yıl aynı kalır. Kurak ve yağışlı yıl farkını senaryolar gösterir." }),
        el("li", { text: `Giderler dolar bazında sabit. İlk yıl ek bakım${g.revizyonYil > 0 && g.revizyonYil <= g.sure ? " ve " + g.revizyonYil + ". yılda büyük revizyon" : ""} dahil.` }),
        el("li", { text: `${g.sure} yıldan sonrası için değer verilmez. Garanti bitince satış ${H.fmt(g.piyasaUsd, 0)} $/MWh'ten yapılır.` }),
        el("li", { text: `Vergi %${H.fmt(g.vergiOrani, 0)}, yıllık amortisman ${H.fmt(g.amortisman / 1e3, 0)} bin $. Makul fiyat ${esasAd} nakitle hesaplanır.` }),
        el("li", { text: "Yatırım tavsiyesi değildir. Karar öncesi faturalarla bir mali müşavire ya da değerleme uzmanına teyit ettirin." }))));
  }

  function kutu(ad, deger, alt, vurgu) {
    return el("div", { class: "kutu" + (vurgu ? " vurgu" : "") },
      el("small", { text: ad }), el("b", { text: deger > 0 ? Mtl(deger) + " M TL" : "–" }), el("small", { text: alt }));
  }

  function altCubuk(d) {
    const c = $("altCubuk");
    const degerlemede = !$("s-degerleme").hidden;
    if (!d || !degerlemede) { c.className = "alt-cubuk"; c.textContent = ""; return; }
    c.className = "alt-cubuk goster " + d.karar;
    c.textContent = d.pazarlik.hedef > 0
      ? `Makul ${Mtl(d.pazarlik.acilis)}–${Mtl(d.pazarlik.hedef)} · İstenen ${Mtl(d.g.fiyatTL)} milyon TL`
      : `İstenen ${Mtl(d.g.fiyatTL)} milyon TL · beklenti karşılanmıyor`;
  }

  // ---------- Grafik ----------
  function guzelAdim(x) {
    if (!(x > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x))), n = x / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  function grafikCiz(kap, d) {
    const W = 640, HH = 280, m = { l: 44, r: 84, t: 14, b: 28 };
    const kur = d.g.kur, mil = (v) => v * kur / 1e6;
    const seriler = [{ s: d.sen[0], c: "s2" }, { s: d.sen[1], c: "s1" }, { s: d.sen[2], c: "s3" }];
    const N = d.sen[1].kumulatif.length - 1;
    const fiyat = mil(d.fiyatUsd);
    let lo = 0, hi = fiyat;
    for (const x of seriler) for (const v of x.s.kumulatif) { lo = Math.min(lo, mil(v)); hi = Math.max(hi, mil(v)); }
    const adim = guzelAdim((hi - lo) / 5);
    lo = Math.floor(lo / adim) * adim;
    hi = Math.ceil(hi / adim) * adim;
    if (hi <= lo) hi = lo + adim;
    const X = (i) => m.l + (i / N) * (W - m.l - m.r);
    const Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (HH - m.t - m.b);
    const bek = d.sen[1];
    const svg = sv("svg", {
      viewBox: `0 0 ${W} ${HH}`, role: "img",
      "aria-label": `Kasaya giren toplam nakit. Beklenen senaryoda geri dönüş: ${H.yil(bek.geriDonus)}.`
    });

    for (let v = lo; v <= hi + adim * 1e-6; v += adim) {
      svg.append(sv("line", { class: "izgara", x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }));
      svg.append(sv("text", { class: "eksen-yazi", x: m.l - 6, y: Y(v) + 4, "text-anchor": "end" }, H.fmt(v, adim < 1 ? 1 : 0)));
    }
    const xAdim = N <= 12 ? 1 : N <= 30 ? 5 : 10;
    for (let i = 0; i <= N; i += xAdim) {
      svg.append(sv("text", { class: "eksen-yazi", x: X(i), y: HH - 8, "text-anchor": "middle" }, String(i)));
    }
    svg.append(sv("text", { class: "eksen-yazi", x: W - m.r + 18, y: HH - 8 }, "yıl"));

    if (d.kalanGarantiYil > 0 && d.kalanGarantiYil < N) {
      const gx = X(d.kalanGarantiYil);
      svg.append(sv("line", { class: "garanti-cizgi", x1: gx, x2: gx, y1: m.t, y2: HH - m.b }));
      svg.append(sv("text", { class: "eksen-yazi", x: gx + 4, y: m.t + 10 }, "Garanti biter"));
    }
    svg.append(sv("line", { class: "fiyat-cizgi", x1: m.l, x2: W - m.r, y1: Y(fiyat), y2: Y(fiyat) }));
    for (const x of seriler) {
      svg.append(sv("polyline", {
        class: "seri " + x.c,
        points: x.s.kumulatif.map((v, i) => X(i).toFixed(1) + "," + Y(mil(v)).toFixed(1)).join(" ")
      }));
    }

    // Sağ uç yazıları: üst üste binmesin diye aralarında en az 13 birim bırakılır.
    const uclar = seriler.map((x) => ({ ad: x.s.ad, y: Y(mil(x.s.kumulatif[N])) }))
      .concat([{ ad: "Fiyat", y: Y(fiyat) }]).sort((a, b) => a.y - b.y);
    for (let j = 1; j < uclar.length; j++) if (uclar[j].y - uclar[j - 1].y < 13) uclar[j].y = uclar[j - 1].y + 13;
    for (let j = uclar.length - 1; j >= 0; j--) {
      const enAlt = j === uclar.length - 1 ? HH - m.b : uclar[j + 1].y - 13;
      if (uclar[j].y > enAlt) uclar[j].y = enAlt;
    }
    for (const u of uclar) svg.append(sv("text", { class: "uc-yazi", x: W - m.r + 6, y: u.y + 4 }, u.ad));

    // Üzerine gelince: dikey imleç, noktalar ve ipucu kutusu.
    const imlec = sv("line", { class: "imlec", y1: m.t, y2: HH - m.b, visibility: "hidden" });
    const isaretler = seriler.map((x) => sv("circle", { class: "isaret " + x.c, r: 4.5, visibility: "hidden" }));
    const alan = sv("rect", { x: m.l - 10, y: 0, width: W - m.l - m.r + 20, height: HH, fill: "transparent" });
    svg.append(imlec, ...isaretler, alan);
    const ipucu = el("div", { class: "ipucu-kutu", hidden: true });
    kap.textContent = "";
    kap.append(svg, ipucu);

    function goster(e) {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * W / r.width;
      const i = Math.max(0, Math.min(N, Math.round((px - m.l) / (W - m.l - m.r) * N)));
      imlec.setAttribute("x1", X(i)); imlec.setAttribute("x2", X(i)); imlec.setAttribute("visibility", "visible");
      seriler.forEach((x, j) => {
        isaretler[j].setAttribute("cx", X(i));
        isaretler[j].setAttribute("cy", Y(mil(x.s.kumulatif[i])));
        isaretler[j].setAttribute("visibility", "visible");
      });
      ipucu.textContent = "";
      ipucu.append(el("b", { text: i === 0 ? "Başlangıç" : i + ". yılın sonunda" }));
      for (const x of [seriler[2], seriler[1], seriler[0]]) {
        ipucu.append(el("div", null, el("span", null, el("i", { class: "nokta " + x.c }), x.s.ad),
          el("span", { text: H.fmt(mil(x.s.kumulatif[i]), 1) + " M TL" })));
      }
      ipucu.append(el("div", null, el("span", { text: "İstenen fiyat" }), el("span", { text: H.fmt(fiyat, 1) + " M TL" })));
      ipucu.hidden = false;
      const sol = X(i) / W * r.width, w = ipucu.offsetWidth;
      ipucu.style.left = (sol + 12 + w > r.width ? Math.max(0, sol - 12 - w) : sol + 12) + "px";
    }
    function gizle() {
      ipucu.hidden = true;
      imlec.setAttribute("visibility", "hidden");
      isaretler.forEach((c) => c.setAttribute("visibility", "hidden"));
    }
    alan.addEventListener("pointermove", goster);
    alan.addEventListener("pointerdown", goster);
    alan.addEventListener("pointerleave", gizle);
  }

  // ---------- Sorular ----------
  const grupSayacEl = {};
  const kapaliGruplar = new Set();
  const durumu = (id) => (durum.sorular[id] ? durum.sorular[id].d : "acik");
  const cevaplandi = (d) => d === "tamam" || d === "dikkat";

  function suzgeceUyar(suz, d) {
    if (suz === "acikta") return d === "acik" || d === "soruldu";
    if (suz === "dikkat") return d === "dikkat";
    if (suz === "bitti") return cevaplandi(d);
    return true;
  }

  function soruKaydet(id, degisiklik) {
    const k = Object.assign({ d: "acik", n: "" }, durum.sorular[id] || {}, degisiklik);
    if (k.d === "acik" && !k.n) delete durum.sorular[id];
    else durum.sorular[id] = k;
    degisti();
  }

  function boyutla(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, 400) + "px"; }

  function soruKur(q) {
    const k = durum.sorular[q.id] || { d: "acik", n: "" };
    const sec = el("select", { "aria-label": "Durum" }, Object.entries(H.DURUMLAR).map(([v, t]) => el("option", { value: v, text: t })));
    sec.value = k.d;
    const not = el("textarea", { rows: "1", placeholder: "Cevap ya da not", "aria-label": "Cevap ya da not", maxlength: "4000" });
    not.value = k.n;
    const kutu_ = el("div", { class: "soru " + k.d }, el("p", { text: q.m }), sec, not);
    sec.addEventListener("change", () => {
      soruKaydet(q.id, { d: sec.value });
      kutu_.className = "soru " + sec.value;
      sayaclariCiz();
    });
    not.addEventListener("input", () => { soruKaydet(q.id, { n: not.value }); boyutla(not); });
    requestAnimationFrame(() => boyutla(not));
    return kutu_;
  }

  function sorulariCiz() {
    const kap = $("soruListesi");
    kap.textContent = "";
    const suz = $("suzgec").value;
    for (const g of S.GRUPLAR) {
      const liste = g.sorular.filter((q) => suzgeceUyar(suz, durumu(q.id)));
      if (!liste.length) continue;
      const sayac = el("small");
      grupSayacEl[g.id] = sayac;
      const det = el("details", { class: "grup", open: !kapaliGruplar.has(g.id) },
        el("summary", null, el("span", { class: "ad", text: g.ad }), sayac));
      det.addEventListener("toggle", () => { if (det.open) kapaliGruplar.delete(g.id); else kapaliGruplar.add(g.id); });
      if (g.aciklama) det.append(el("p", { class: "aciklama", text: g.aciklama }));
      for (const q of liste) det.append(soruKur(q));
      kap.append(det);
    }
    if (!kap.children.length) kap.append(el("p", { class: "card not", text: "Bu süzgece uyan soru yok." }));
    sayaclariCiz();
  }

  function sayaclariCiz() {
    const s = S.say(durum.sorular);
    const kap = $("sayaclar");
    kap.textContent = "";
    kap.append(
      el("span", { class: "hap", text: s.acik + " sorulmadı" }),
      el("span", { class: "hap soruldu", text: s.soruldu + " cevap bekliyor" }),
      el("span", { class: "hap tamam", text: s.tamam + " tamam" }),
      el("span", { class: "hap dikkat", text: s.dikkat + " dikkat" }));
    $("soruSayac").textContent = String(s.acik + s.soruldu);
    for (const g of S.GRUPLAR) {
      if (!grupSayacEl[g.id]) continue;
      grupSayacEl[g.id].textContent = g.sorular.filter((q) => cevaplandi(durumu(q.id))).length + "/" + g.sorular.length;
    }
  }

  function yazdir() {
    const kap = $("yazdir");
    kap.textContent = "";
    kap.append(el("h1", { text: "Sorulacaklar ve istenecek belgeler" }));
    kap.append(el("p", { text: (durum.baslik ? durum.baslik + " · " : "") + new Date().toLocaleDateString("tr-TR") }));
    let n = 0;
    for (const g of S.GRUPLAR) {
      if (g.icSoru) continue;
      const acik = g.sorular.filter((q) => !cevaplandi(durumu(q.id)));
      if (!acik.length) continue;
      kap.append(el("h2", { text: g.ad }));
      kap.append(el("ol", { start: String(n + 1) }, acik.map((q) => el("li", null, q.m, g.belge ? null : el("div", { class: "cizgi" })))));
      n += acik.length;
    }
    if (!n) return ileti("Yazdırılacak açık soru yok.", "bilgi");
    document.body.classList.add("yazdir-sorular");
    window.print();
  }

  // ---------- Teknik ----------
  function teknikKur() {
    const guc = ["dusu", "debi", "verim", "kurulu"], boru = ["cap", "kalinlik", "darbe", "korozyon", "celik", "emniyet"];
    for (const [kapId, liste] of [["tk-guc-girdi", guc], ["tk-boru-girdi", boru]]) {
      const kap = $(kapId);
      kap.textContent = "";
      for (const k of liste) {
        const a = H.TEKNIK_ALANLAR.find((x) => x.k === k);
        kap.append(alanKur(a, teknikEl, (kk, v) => { durum.teknik[kk] = v; degisti(); teknikHesapla(); }, "t-"));
      }
    }
  }

  function satir(ad, deger) { return el("div", { class: "sonuc-satir" }, el("span", { text: ad }), el("span", { text: deger })); }

  function teknikHesapla() {
    const r = H.teknikOku(durum.teknik);
    alanHatalariniGoster(H.TEKNIK_ALANLAR, teknikEl, r.hatalar, r.t);
    const tamam = (ks) => ks.every((k) => !(k in r.hatalar));

    const gk = $("tk-guc-sonuc");
    gk.textContent = "";
    if (tamam(["dusu", "debi", "verim", "kurulu"])) {
      const h = H.hidrolikGuc(r.t);
      gk.append(el("div", { style: "margin-top:10px" },
        satir("Düşü ve debiden çıkan güç", H.fmt(h.kw, 0) + " kW"),
        satir("Kurulu güç", H.fmt(r.t.kurulu * 1000, 0) + " kW"),
        satir("Oran", "%" + H.fmt(h.oran * 100, 0)),
        satir("Kurulu güç için gereken debi", H.fmt(h.gerekenDebi, 2) + " m³/s")));
      let sinif, m;
      if (h.oran > 1.15) {
        sinif = "bilgi";
        m = `Düşü ve debi kurulu gücün %${H.fmt(h.oran * 100, 0)}'ini veriyor. Ya bu rakamlar brüt ya da proje değerleri, ya da santral kurulu güçle sınırlanmış. Fazla su kurulu gücü artırmaz; yalnız kurak aylarda tam güçte çalışma süresini uzatır.`;
      } else if (h.oran >= 0.85) {
        sinif = "uygun"; m = "Düşü, debi ve kurulu güç birbiriyle tutarlı.";
      } else {
        sinif = "dikkat"; m = "Bu düşü ve debiyle santral kurulu gücüne çıkamaz. Rakamlardan biri eksik ya da kurulu güç fazla yazılmış.";
      }
      gk.append(el("div", { class: "yorum " + sinif, text: m }));
    }

    const bk = $("tk-boru-sonuc");
    bk.textContent = "";
    if (tamam(["dusu", "cap", "kalinlik", "darbe", "korozyon", "celik", "emniyet"])) {
      const b = H.cebriBoru(r.t);
      const kutu_ = el("div", { style: "margin-top:10px" },
        satir("Alt uçta basınç (darbe dahil)", H.fmt(b.pMPa * 10, 1) + " bar"),
        b.ok ? satir("Çevre gerilmesi", H.fmt(b.sigma, 0) + " MPa") : null,
        satir("İzin verilen gerilme", H.fmt(b.izin, 0) + " MPa"),
        b.ok ? satir("Kullanım oranı", "%" + H.fmt(b.oran * 100, 1)) : null,
        satir("Gereken en az et kalınlığı", H.fmt(b.gereken, 1) + " mm"));
      bk.append(kutu_);
      let sinif, m;
      if (!b.ok) { sinif = "pahali"; m = b.hata + "."; }
      else if (b.oran <= 0.8) { sinif = "uygun"; m = "Bu çap ve kalınlık, verilen basınç için yeterli görünüyor."; }
      else if (b.oran <= 1) { sinif = "dikkat"; m = "Sınıra yakın. Borunun alt bölümünde ultrasonik kalınlık ölçümü isteyin; paslanma payı erimişse gerilme artar."; }
      else { sinif = "pahali"; m = "Yetersiz görünüyor. Çelik kalitesini ve kalınlığı belgeyle teyit edin, alt bölümde ölçüm yaptırın."; }
      bk.append(el("div", { class: "yorum " + sinif, text: m }));
      bk.append(el("p", { class: "not", style: "margin-top:8px", text: "Kaba sağlamadır: kaynak katsayısı, dış yükler ve boru sınıfı hesaba girmez. Karar için mühendis hesabı gerekir." }));
    }
  }

  // ---------- Sekmeler ----------
  const SEKMELER = ["degerleme", "sorular", "teknik"];
  function sekmeAc(ad) {
    if (!SEKMELER.includes(ad)) ad = "degerleme";
    for (const s of SEKMELER) {
      $("t-" + s).setAttribute("aria-selected", s === ad ? "true" : "false");
      $("s-" + s).hidden = s !== ad;
    }
    try { localStorage.setItem(SEKME_ANAHTAR, ad); } catch (e) { /* tercih kaydedilemezse sorun değil */ }
    altCubuk(sonDeger);
  }

  // ---------- Hepsini çiz ----------
  function hepsiniCiz() {
    $("baslik").value = durum.baslik;
    for (const a of H.ALANLAR) degerKoy(girdiEl[a.k], durum.girdiler[a.k]);
    for (const a of H.TEKNIK_ALANLAR) degerKoy(teknikEl[a.k], durum.teknik[a.k]);
    hesapla();
    teknikHesapla();
    sorulariCiz();
    $("ornekBant").hidden = !durum.ornek;
    kayitDurumuGoster();
  }

  // ---------- Güncelleme ----------
  // Depoya yeni sürüm gönderildiğinde sayfa bunu hesap.js'deki sürüm numarasından anlar.
  // Servis çalışanı önce ağa gider; "Yenile" demek yeni dosyaları getirmeye yeter.
  function surumDenetle() {
    if (!location.protocol.startsWith("http")) return;
    fetch("hesap.js?surum=" + Date.now(), { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => {
        const m = /SURUM = "([^"]+)"/.exec(t);
        if (m && m[1] !== H.SURUM) $("guncelleme").hidden = false;
      })
      .catch(() => { /* çevrimdışı: denetim sonra yeniden yapılır */ });
  }

  // ---------- Başlat ----------
  function baslat() {
    $("surum").textContent = H.SURUM;
    formKur();
    teknikKur();
    $("baslik").addEventListener("input", (e) => { durum.baslik = e.target.value.slice(0, 120); degisti(); });
    $("kaydet").addEventListener("click", dosyayaKaydet);
    $("dosya").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; dosyadanAc(f); });
    $("kopyala").addEventListener("click", ozetKopyala);
    $("sifirla").addEventListener("click", () => {
      if (!confirm("Bütün girdiler ve notlar silinip örnek değerlere dönülecek. Önce dosyaya kaydetmediyseniz geri alınamaz. Emin misiniz?")) return;
      durum = ornekDurum();
      try { localStorage.removeItem(ANAHTAR); } catch (e) { /* yoksa sorun değil */ }
      kayitZamani = null;
      hepsiniCiz();
    });
    $("suzgec").addEventListener("change", sorulariCiz);
    $("yazdirDugme").addEventListener("click", yazdir);
    window.addEventListener("afterprint", () => document.body.classList.remove("yazdir-sorular"));
    for (const s of SEKMELER) $("t-" + s).addEventListener("click", () => sekmeAc(s));
    $("yenile").addEventListener("click", () => location.reload());

    hepsiniCiz();
    let sekme = "degerleme";
    try { sekme = localStorage.getItem(SEKME_ANAHTAR) || sekme; } catch (e) { /* varsayılan sekme */ }
    sekmeAc(sekme);

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* çevrimdışı önbellek olmadan da çalışır */ });
    }
    setTimeout(surumDenetle, 3000);
    setInterval(surumDenetle, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") surumDenetle(); });
  }

  baslat();
})();
