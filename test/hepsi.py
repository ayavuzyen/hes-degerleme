"""Bütün sınamaları sırayla koşar ve yayına gidecek paketi denetler. Çalıştır: python test/hepsi.py
Kritik bulguda çıkış kodu sıfırdan farklıdır.

Adımlar:
1. Hesap çekirdeği sınamaları (Node).
2. Teslim paketi: depoda yalnız beyaz listedeki dosyalar var mı?
3. Gizli veri: depodaki dosyalarda santrale ait bir kelime geçiyor mu?
   Kelime listesi deponun DIŞINDA durur (../gizli-kelimeler.txt); liste yoksa adım
   "atlandı" diye yazılır, "geçti" diye değil.
4. Tutarlılık: servis çalışanının önbellek listesi ve sayfanın betikleri gerçekten var mı,
   sayfada dış adres var mı?
"""
from __future__ import annotations

import os
import re
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIZLI_LISTE = os.path.join(os.path.dirname(KOK), "gizli-kelimeler.txt")

# Depoda bulunabilecek dosyalar. Burada olmayan dosya pakete girmez; unutulan bir kayıt
# dosyası ya da not yayına çıkmasın.
BEYAZ_LISTE = {
    "index.html", "hesap.js", "sorular.js", "arayuz.js", "sw.js", "manifest.webmanifest",
    "ikon-192.png", "ikon-512.png", "BENIOKU.md", ".gitignore", ".gitattributes",
    "test/hesap.test.js", "test/hepsi.py",
}


def depo_dosyalari() -> set[str] | None:
    r = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=KOK,
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        return None
    return set(r.stdout.split("\n")) - {""}


def adim_node() -> bool:
    print("\n== Hesap çekirdeği sınamaları", flush=True)
    r = subprocess.run(["node", "--test", "test/hesap.test.js"], cwd=KOK, capture_output=True,
                       text=True, encoding="utf-8")
    cikti = (r.stdout + r.stderr).splitlines()
    ozet = [s for s in cikti if re.search(r"^ℹ (tests|pass|fail)|^✖|not ok", s)]
    print("\n".join(ozet) or "\n".join(cikti[-15:]))
    print("TAMAM" if r.returncode == 0 else f"HATA (çıkış {r.returncode})")
    return r.returncode == 0


def adim_teslim(dosyalar: set[str] | None) -> bool:
    print("\n== Teslim paketi", flush=True)
    if dosyalar is None:
        print("HATA: git ls-files çalışmadı (depo başlatılmamış mı?)")
        return False
    fazla, eksik = sorted(dosyalar - BEYAZ_LISTE), sorted(BEYAZ_LISTE - dosyalar)
    if fazla:
        print(f"HATA: beyaz listede olmayan dosya: {fazla}")
    if eksik:
        print(f"HATA: eksik dosya: {eksik}")
    if not fazla and not eksik:
        print(f"TAMAM ({len(dosyalar)} dosya)")
    return not fazla and not eksik


def adim_gizli(dosyalar: set[str] | None) -> bool:
    print("\n== Gizli veri", flush=True)
    if not os.path.exists(GIZLI_LISTE):
        print(f"ATLANDI: {GIZLI_LISTE} yok. Santrale ait kelimeler denetlenmedi.")
        return True
    with open(GIZLI_LISTE, encoding="utf-8") as f:
        kelimeler = [s.strip() for s in f if s.strip() and not s.startswith("#")]
    bulgu = []
    for yol in sorted(dosyalar or []):
        tam = os.path.join(KOK, yol)
        if yol.endswith(".png") or not os.path.isfile(tam):
            continue
        with open(tam, encoding="utf-8", errors="replace") as f:
            metin = f.read().casefold()
        for k in kelimeler:
            if k.casefold() in metin:
                bulgu.append(f"{yol}: '{k}'")
    if bulgu:
        print("HATA: santrale ait kelime depoda:\n  " + "\n  ".join(bulgu))
        return False
    print(f"TAMAM ({len(kelimeler)} kelime, hiçbiri depoda yok)")
    return True


def adim_tutarlilik() -> bool:
    print("\n== Tutarlılık", flush=True)
    sorun = []
    with open(os.path.join(KOK, "sw.js"), encoding="utf-8") as f:
        sw = f.read()
    m = re.search(r"const KABUK = \[(.*?)\];", sw, re.S)
    kabuk = re.findall(r'"([^"]+)"', m.group(1)) if m else []
    if not kabuk:
        sorun.append("sw.js içinde KABUK listesi bulunamadı")
    for k in kabuk:
        if k != "./" and not os.path.isfile(os.path.join(KOK, k)):
            sorun.append(f"sw.js önbellek listesinde olmayan dosya: {k}")
    with open(os.path.join(KOK, "index.html"), encoding="utf-8") as f:
        html = f.read()
    for src in re.findall(r'<script src="([^"]+)"', html):
        if not os.path.isfile(os.path.join(KOK, src)):
            sorun.append(f"index.html'in çağırdığı betik yok: {src}")
        if src not in kabuk:
            sorun.append(f"betik çevrimdışı önbellekte değil: {src}")
    for yol in ("index.html", "hesap.js", "sorular.js", "arayuz.js", "sw.js"):
        with open(os.path.join(KOK, yol), encoding="utf-8") as f:
            if re.search(r"https?://(?!www\.w3\.org/2000/svg)", f.read()):
                sorun.append(f"{yol} dış adres içeriyor (veri hiçbir yere gitmemeli)")
    if sorun:
        print("HATA:\n  " + "\n  ".join(sorun))
        return False
    print("TAMAM")
    return True


def main() -> int:
    # Windows konsolu cp1254 olabilir; Node'un ℹ ✖ işaretleri yazdırılırken çökmesin.
    for akis in (sys.stdout, sys.stderr):
        if hasattr(akis, "reconfigure"):
            akis.reconfigure(encoding="utf-8", errors="replace")
    dosyalar = depo_dosyalari()
    sonuc = [adim_node(), adim_teslim(dosyalar), adim_gizli(dosyalar), adim_tutarlilik()]
    print("\n" + ("BÜTÜN ADIMLAR TAMAM" if all(sonuc) else "SORUN VAR"))
    return 0 if all(sonuc) else 1


if __name__ == "__main__":
    sys.exit(main())
