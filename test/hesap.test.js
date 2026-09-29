// Hesap çekirdeği sınamaları. Çalıştır: node --test test/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const H = require(path.join(__dirname, "..", "hesap.js"));
const S = require(path.join(__dirname, "..", "sorular.js"));

const yakin = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b} (tolerans ${tol})`);

// Bağımsız Python hesabıyla karşılaştırılan örnek: devir 2026-10, işletmeye giriş 2022-10.
// Yerli katkı tam 1. yılın sonunda, alım garantisi tam 6. yılın sonunda biter.
// Fiyatlar: YEKDEM 71,7 $/MWh, katkı 15,3 $/MWh (kr/kWh karşılıkları kurdan çıkarıldı).
function ornekHam(ek) {
  return Object.assign({
    fiyatTL: "70.000.000", kur: "48,9", degerlemeAy: "2026-10",
    kuruluMW: "1,4", kabulAy: "2022-10", rejim: "otomatik", yerliKatki: "evet",
    yeniYekdemKr: String(71.7 * 48.9 / 10).replace(".", ","), yeniKatkiKr: String(15.3 * 48.9 / 10).replace(".", ","),
    eskiYekdemCent: "7,3", eskiKatkiCent: "2,3", piyasaUsd: "55",
    verimliAy: "6", verimliAylikMin: "2.000.000", verimliAylikMax: "2.000.000",
    digerMin: "2.670.000", digerMax: "2.670.000", kdv: "haric",
    giderYillik: "60.000", ilkBakim: "40.000", revizyonYil: "12", revizyonTutar: "150.000",
    sure: "25", getiriDusuk: "12", getiriYuksek: "15", vergiOrani: "25", amortisman: "0", degerlemeEsasi: "oncesi"
  }, ek || {});
}
function oku(ek) {
  const r = H.girdileriOku(ornekHam(ek));
  assert.ok(r.ok, "örnek girdiler geçerli olmalı: " + JSON.stringify(r.hatalar));
  return r.g;
}

// ---------------- Sayı okuma ----------------
test("para: Türkçe yazımlar doğru okunur", () => {
  const iyi = { "65.000.000": 65e6, "1.800.000": 1.8e6, "1.800.000,50": 1800000.5, "60000": 60000, "1,5": 1.5, "1.5": 1.5, "0": 0, " 2.670.000 ": 2670000 };
  for (const [g, v] of Object.entries(iyi)) {
    const r = H.sayiOku(g, "para");
    assert.ok(r.ok, `${g} kabul edilmeli: ${r.hata}`);
    yakin(r.deger, v);
  }
});

test("ondalık: tek nokta ondalıktır, binlik sayılmaz", () => {
  yakin(H.sayiOku("48.9", "ondalik").deger, 48.9);
  yakin(H.sayiOku("48,9", "ondalik").deger, 48.9);
  yakin(H.sayiOku("1.500", "ondalik").deger, 1.5);   // MW alanında 1.500 = 1,5
  yakin(H.sayiOku("1.500", "para").deger, 1500);     // para alanında 1.500 = bin beş yüz
});

test("reddedilen yazımlar sessizce sayıya dönmez", () => {
  for (const g of ["-5", "5e2", "abc", "1,2,3", "1.2.3", "2 3", "65 milyon", "₺65", ",", ".", "Infinity", "1".repeat(30), "12,3.4"]) {
    const r = H.sayiOku(g, "para");
    assert.equal(r.ok, false, `${JSON.stringify(g)} reddedilmeli, ${r.deger} okundu`);
  }
  const bos = H.sayiOku("  ", "para");
  assert.equal(bos.ok, false); assert.equal(bos.bos, true);
});

test("ay okuma: üç yazım biçimi ve sınırlar", () => {
  yakin(H.ayOku("2022-12").deger, 2022 + 11 / 12);
  yakin(H.ayOku("12.2022").deger, 2022 + 11 / 12);
  yakin(H.ayOku("7/2021").deger, 2021.5);
  for (const k of ["2022-13", "2022-00", "13.2022", "2022", "2022-1-1", "1850-01", "abc"]) assert.equal(H.ayOku(k).ok, false, k);
  assert.equal(H.ayMetni(2022 + 11 / 12), "12.2022");
  assert.equal(H.ayMetni(2032.75), "10.2032");
});

// ---------------- Girdi denetimi ----------------
test("örnek değerler kendi içinde geçerli", () => {
  const ham = {};
  for (const a of H.ALANLAR) ham[a.k] = a.ornek;
  const r = H.girdileriOku(ham, new Date(2026, 8, 29));
  assert.ok(r.ok, JSON.stringify(r.hatalar));
  yakin(r.g.degerlemeAy, 2026 + 8 / 12);  // boş devir tarihi → bu ay
});

test("hatalı tek alan bütün sonucu durdurur", () => {
  const r = H.girdileriOku(ornekHam({ kur: "abc" }));
  assert.equal(r.ok, false);
  assert.ok(r.hatalar.kur);
});

test("çapraz denetimler: en az > en çok, alt getiri > üst, devir < işletmeye giriş", () => {
  let r = H.girdileriOku(ornekHam({ verimliAylikMin: "3.000.000" }));
  assert.equal(r.ok, false); assert.ok(r.hatalar.verimliAylikMax);
  r = H.girdileriOku(ornekHam({ digerMin: "9.000.000" }));
  assert.ok(r.hatalar.digerMax);
  r = H.girdileriOku(ornekHam({ getiriDusuk: "20" }));
  assert.ok(r.hatalar.getiriYuksek);
  r = H.girdileriOku(ornekHam({ degerlemeAy: "2020-01" }));
  assert.ok(r.hatalar.degerlemeAy);
});

test("sınır dışı ve tam sayı olmayan değerler reddedilir", () => {
  let r = H.girdileriOku(ornekHam({ verimliAy: "13" }));
  assert.ok(r.hatalar.verimliAy);
  r = H.girdileriOku(ornekHam({ sure: "10,5" }));
  assert.ok(r.hatalar.sure);
  r = H.girdileriOku(ornekHam({ rejim: "baska" }));
  assert.ok(r.hatalar.rejim);
});

// ---------------- Fiyat ve YEKDEM ----------------
test("YEKDEM türü 1 Temmuz 2021 sınırında değişir", () => {
  assert.equal(H.rejimBelirle(oku({ kabulAy: "2021-06" })), "eski");
  assert.equal(H.rejimBelirle(oku({ kabulAy: "2021-07" })), "yeni");
  assert.equal(H.rejimBelirle(oku({ kabulAy: "2021-06", rejim: "yeni" })), "yeni");  // elle seçim önceliklidir
});

test("birim çevirme: kr/kWh ve cent/kWh → $/MWh", () => {
  const g = oku({ yeniYekdemKr: "350,49", yeniKatkiKr: "74,78" });
  const f = H.fiyatlar(g);
  yakin(f.yekdem, 3504.9 / 48.9, 1e-9);
  yakin(f.katki, 747.8 / 48.9, 1e-9);
  const e = H.fiyatlar(oku({ kabulAy: "2020-03" }));
  yakin(e.yekdem, 73); yakin(e.katki, 23);
  yakin(H.fiyatlar(oku({ yerliKatki: "hayir" })).katki, 0);
});

test("katkı ve garanti bitişi yıl içine düşerse fiyat kesirli bölünür", () => {
  // İşletmeye giriş 2022-12: katkı 2027-12'de biter. 2. yıl (10.2027–10.2028) 2 ay katkılı.
  const g = oku({ kabulAy: "2022-12" });
  const a = H.nakitAkisi(g, 0.5);
  const f = a.f;
  yakin(a.yillar[1].fiyat, f.yekdem + f.katki * (2 / 12), 1e-9);
  // 7. yıl (10.2032–10.2033): garanti 12.2032'de biter, 2 ay YEKDEM, 10 ay piyasa.
  yakin(a.yillar[6].fiyat, f.yekdem * (2 / 12) + f.piyasa * (10 / 12), 1e-9);
  yakin(a.yillar[7].fiyat, f.piyasa, 1e-9);
});

test("oncePay sınır durumları", () => {
  assert.equal(H.oncePay(2026, 2027, 2025), 0);
  assert.equal(H.oncePay(2026, 2027, 2026), 0);
  assert.equal(H.oncePay(2026, 2027, 2027), 1);
  yakin(H.oncePay(2026, 2027, 2026.25), 0.25);
});

// ---------------- Nakit akışı: bağımsız hesapla karşılaştırma ----------------
test("nakit akışı bağımsız Python hesabıyla aynı", () => {
  const g = oku();
  yakin(H.yillikCiroTL(g, 0.5), 14670000, 1e-6);
  const a = H.nakitAkisi(g, 0.5);
  yakin(a.uretimMWh, 3448.2758620689656, 1e-6);
  yakin(a.yillar[0].net, 200000, 1e-6);
  yakin(a.yillar[1].net, 187241.37931034484, 1e-6);
  yakin(a.yillar[6].net, 129655.1724137931, 1e-6);
  yakin(a.yillar[11].net, 129655.1724137931 - 150000, 1e-6);  // büyük revizyon yılı
  assert.equal(a.yillar.length, 25);
});

test("değerleme bağımsız Python hesabıyla aynı", () => {
  const d = H.degerle(oku());
  const b = d.sen[1];
  yakin(b.irrOnce, 0.0957975394426248, 1e-6);
  yakin(b.irrSonra, 0.05788045975042865, 1e-6);
  yakin(b.degerDusuk, 1226554.2682824028, 1e-3);
  yakin(b.degerYuksek, 1039102.7478134437, 1e-3);
  yakin(b.geriDonus, 8.27747139189836, 1e-6);
  yakin(d.pazarlik.hedef, 1226554.2682824028 * 48.9, 1);
  yakin(d.pazarlik.acilis, 1039102.7478134437 * 48.9, 1);
  assert.equal(d.karar, "pahali");  // senaryolar aynı olduğu için üst sınır = hedef ≈ 60 milyon < 70 milyon
  yakin(d.kalanGarantiYil, 6);
});

test("karar: fiyat hedefin altındaysa uygun, hedef ile üst sınır arasındaysa dikkat", () => {
  const ek = { verimliAylikMin: "1.800.000", verimliAylikMax: "2.200.000", digerMin: "2.000.000", digerMax: "4.000.000" };
  const d0 = H.degerle(oku(ek));
  const arada = (d0.pazarlik.hedef + d0.pazarlik.ustSinir) / 2;
  assert.ok(d0.pazarlik.ustSinir > d0.pazarlik.hedef);
  assert.equal(H.degerle(oku(Object.assign({ fiyatTL: String(Math.round(arada)) }, ek))).karar, "dikkat");
  assert.equal(H.degerle(oku(Object.assign({ fiyatTL: String(Math.round(d0.pazarlik.hedef * 0.9)) }, ek))).karar, "uygun");
  assert.equal(H.degerle(oku(Object.assign({ fiyatTL: String(Math.round(d0.pazarlik.ustSinir * 1.1)) }, ek))).karar, "pahali");
});

test("senaryolar sıralı: kötü ≤ beklenen ≤ iyi", () => {
  const d = H.degerle(oku({ verimliAylikMin: "1.500.000", verimliAylikMax: "2.200.000", digerMin: "1.000.000", digerMax: "4.000.000" }));
  const [k, b, i] = d.sen;
  assert.ok(k.ciroUsd < b.ciroUsd && b.ciroUsd < i.ciroUsd);
  assert.ok(k.degerDusuk < b.degerDusuk && b.degerDusuk < i.degerDusuk);
  assert.ok(k.irrOnce < b.irrOnce && b.irrOnce < i.irrOnce);
});

test("KDV dahil gelir 1,2'ye bölünür", () => {
  const a = H.yillikCiroTL(oku({ kdv: "dahil" }), 0.5);
  yakin(a, 14670000 / 1.2, 1e-6);
});

test("vergi sonrası esasla makul fiyat düşer", () => {
  const once = H.degerle(oku()).pazarlik.hedef;
  const sonra = H.degerle(oku({ degerlemeEsasi: "sonrasi" })).pazarlik.hedef;
  assert.ok(sonra < once);
  const amort = H.degerle(oku({ degerlemeEsasi: "sonrasi", amortisman: "100.000" })).pazarlik.hedef;
  assert.ok(amort > sonra && amort < once);
});

test("verimli ay ortalama gücü: 2 milyon TL/ay → yaklaşık 0,64 MW", () => {
  const b = H.degerle(oku()).sen[1];
  yakin(b.verimliOrtMW, 2e6 / 48.9 / 87 / 730, 1e-9);
  yakin(b.kapasiteFaktoru, 3448.2758620689656 / (1.4 * 8760), 1e-9);
});

// ---------------- Getiri, geri dönüş ----------------
test("iç verim: bilinen değerler ve dönmeyen yatırım", () => {
  yakin(H.icVerim(100, [110]), 0.10, 1e-9);
  yakin(H.icVerim(100, [0, 121]), 0.10, 1e-9);
  assert.equal(H.icVerim(100, [0, 0, 0]), null);
  assert.equal(H.icVerim(100, [-5, -5]), null);
  assert.equal(H.icVerim(0, [10]), null);
  assert.ok(H.icVerim(100, [30, 30, 30]) < 0);  // toplam fiyatın altında: negatif getiri
});

test("geri dönüş kesirli yıl verir, dönmüyorsa null", () => {
  yakin(H.geriDonus(120, [50, 50, 50]), 2.4, 1e-9);
  yakin(H.geriDonus(100, [50, 50]), 2, 1e-9);
  assert.equal(H.geriDonus(200, [50, 50]), null);
  assert.equal(H.geriDonus(100, [150, -80, 10]), 100 / 150);
});

// ---------------- Uyarılar ----------------
const uyariVar = (d, kalip) => d.uyarilar.some((u) => kalip.test(u.m));

test("uyarı: kurulu güçten fazla üretim gerektiren gelir", () => {
  const d = H.degerle(oku({ verimliAylikMin: "5.000.000", verimliAylikMax: "5.000.000" }));
  assert.ok(d.uyarilar.some((u) => u.s === "hata" && /kurulu gücünden fazla/.test(u.m)));
});

test("uyarı: gerçekçi olmayan kapasite faktörü", () => {
  const d = H.degerle(oku({ digerMin: "20.000.000", digerMax: "20.000.000" }));
  assert.ok(uyariVar(d, /kapasite faktörü %\d+\. Küçük nehir/));
});

test("uyarı: geri dönüş garantinin kalan süresinden uzun", () => {
  assert.ok(uyariVar(H.degerle(oku()), /alım garantisinin ise 6,0 yılı kalmış/));
});

test("uyarı: rejim sınırına yakın işletmeye giriş tarihi", () => {
  assert.ok(uyariVar(H.degerle(oku({ kabulAy: "2021-05" })), /1 Temmuz 2021/));
  assert.ok(!uyariVar(H.degerle(oku({ kabulAy: "2022-10" })), /1 Temmuz 2021/));
});

test("uyarı: garanti bitmişse", () => {
  const d = H.degerle(oku({ kabulAy: "2015-01", yerliKatki: "hayir" }));
  assert.ok(uyariVar(d, /tarihinde bitmiş\. Satış piyasa/));
  assert.equal(d.kalanGarantiYil, 0);
});

// ---------------- Teknik ----------------
test("hidrolik güç: 240 m, 1 m³/s, %85 → 2001 kW", () => {
  const r = H.hidrolikGuc({ dusu: 240, debi: 1, verim: 85, kurulu: 1.4 });
  yakin(r.kw, 2001.24, 1e-6);
  yakin(r.gerekenDebi, 1400 / (9.81 * 240 * 0.85), 1e-9);
});

test("cebri boru çevre gerilmesi", () => {
  const r = H.cebriBoru({ dusu: 240, darbe: 20, cap: 600, kalinlik: 10, korozyon: 2, celik: "235", emniyet: 1.67 });
  assert.ok(r.ok);
  yakin(r.pMPa, 2.825280, 1e-6);
  yakin(r.sigma, 2.82528 * 600 / 16, 1e-6);
  yakin(r.izin, 235 / 1.67, 1e-9);
  const kalin = H.cebriBoru({ dusu: 240, darbe: 20, cap: 600, kalinlik: 2, korozyon: 2, celik: "235", emniyet: 1.67 });
  assert.equal(kalin.ok, false);
});

test("teknik alan örnekleri geçerli", () => {
  const ham = {};
  for (const a of H.TEKNIK_ALANLAR) ham[a.k] = a.ornek;
  assert.ok(H.teknikOku(ham).ok);
});

// ---------------- Kayıt dosyası ----------------
test("kayıt dosyası: geçerli dosya okunur, bilinmeyen alan atlanır", () => {
  const r = H.durumDogrula({
    tur: "hes-degerleme", girdiler: { kur: "48,9", fiyatTL: 65000000, bilinmeyen: "x" },
    sorular: { "turbin": { d: "tamam", n: "2 ünite" }, "yeni-soru": { d: "dikkat", n: "" } }
  });
  assert.ok(r.ok);
  assert.equal(r.durum.girdiler.kur, "48,9");
  assert.equal(r.durum.girdiler.fiyatTL, "65000000");
  assert.ok(!("bilinmeyen" in r.durum.girdiler));
  assert.equal(r.durum.sorular.turbin.d, "tamam");
  assert.equal(r.durum.sorular["yeni-soru"].d, "dikkat");  // ileriki sürümlerin soruları kaybolmaz
});

test("kayıt dosyası: düşmanca içerik reddedilir ya da temizlenir", () => {
  for (const kotu of [null, 5, "metin", [], [1, 2]]) assert.equal(H.durumDogrula(kotu).ok, false);
  assert.equal(H.durumDogrula({ tur: "kuyumcu" }).ok, false);
  const r = H.durumDogrula(JSON.parse('{"girdiler":{"kur":{"x":1},"__proto__":{"kirli":1}},"sorular":{"__proto__":{"d":"tamam"},"TURBIN":{"d":"tamam"},"turbin":{"d":"yok-boyle","n":5},"ariza":{"d":"dikkat","n":"' + "a".repeat(5000) + '"}}}'));
  assert.ok(r.ok);
  assert.ok(!("kur" in r.durum.girdiler));
  assert.equal({}.kirli, undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(r.durum.sorular, "__proto__"));
  assert.ok(!("TURBIN" in r.durum.sorular));
  assert.equal(r.durum.sorular.turbin.d, "acik");
  assert.equal(r.durum.sorular.turbin.n, "");
  assert.equal(r.durum.sorular.ariza.n.length, 4000);
  assert.ok(r.uyari.length >= 3);
});

// ---------------- Soru bankası ----------------
test("soru kimlikleri benzersiz ve kalıba uygun", () => {
  const ids = S.hepsi().map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]{1,40}$/);
  const say = S.say({ turbin: { d: "tamam" }, ariza: { d: "dikkat" } });
  assert.equal(say.toplam, ids.length);
  assert.equal(say.tamam, 1); assert.equal(say.dikkat, 1); assert.equal(say.acik, ids.length - 2);
});

test("özet metni üretilir ve temel rakamları içerir", () => {
  const d = H.degerle(oku());
  const m = H.ozetMetni(d, { acik: 3, dikkat: 1 });
  assert.match(m, /İstenen: 70,0 milyon TL/);
  assert.match(m, /Alım garantisi bitişi: 10\.2032/);
  assert.match(m, /3 açık, 1 dikkat/);
});
