/* ==========================================================================
   UYGULAMA KATMANI (sunum / etkileşim)
   --------------------------------------------------------------------------
   Bu dosyada hiçbir üretim rakamı sabit yazılmaz (kalıcı talimat madde 3).
   Tek veri girişi VeriKatmani.veriGetir() çağrısıdır. Filtre seçeneklerinin
   (Hat, Vardiya) listesi de veriden türetilir; burada elle yazılmaz — kaynak
   veri değişirse (yeni bir hat eklenirse vb.) arayüz otomatik uyum sağlar.

   HEDEFLER nesnesi bir istisnadır: bu, ölçülen üretim verisi değil, panonun
   karşılaştırma için kullandığı *referans eşik* değerleridir (sektörde
   yaygın OEE bileşen hedefleri). Arayüzde her yerde "Hedef" etiketiyle
   birlikte gösterilir, asla ham veri gibi sunulmaz.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Referans hedefler (ölçülen veri değil; karşılaştırma eşiği)
     --------------------------------------------------------------------- */
  const HEDEFLER = {
    oee: 0.75,
    kullanilabilirlik: 0.85,
    performans: 0.90,
    kalite: 0.98,
  };

  const VARSAYILAN_DONEM_GUN = 30; // başlangıç görünümü: son 30 gün

  /* ---------------------------------------------------------------------
     Uygulama durumu (tek kaynak — state)
     --------------------------------------------------------------------- */
  const durum = {
    asama: "yukleniyor", // 'yukleniyor' | 'hata' | 'hazir'
    hataMesaji: "",
    tumKayitlar: [],
    veriMin: null,
    veriMax: null,
    alinanZaman: null,
    atlananSatirSayisi: 0,
    aktifEkran: "E1",
    filtre: { baslangic: null, bitis: null, hat: "tumu", vardiya: "tumu" },
    trendMetrik: "oee",
    kirilimBoyutu: "neden",
    siralama: { sutun: "Tarih", yon: "azalan" },
  };

  /* ---------------------------------------------------------------------
     Sayı / tarih biçimlendirme — kalıcı talimat madde 2 ve 7
     --------------------------------------------------------------------- */
  const sayiFormat = new Intl.NumberFormat("tr-TR");
  const tekOndalikFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function adetFormatla(n) { return sayiFormat.format(Math.round(n)); }
  function dakikaMetni(n) { return adetFormatla(n) + " dk"; }
  function adetMetni(n) { return adetFormatla(n) + " adet"; }
  function yuzdeMetni(oran) { return tekOndalikFormat.format(oran * 100) + "%"; }
  function puanMetni(oranFarki) { return tekOndalikFormat.format(Math.abs(oranFarki) * 100) + " puan"; }

  function ikiHane(n) { return String(n).padStart(2, "0"); }
  function tarihFormatla(d) { return `${ikiHane(d.getDate())}.${ikiHane(d.getMonth() + 1)}.${d.getFullYear()}`; }
  function tarihGirisDegeri(d) { return `${d.getFullYear()}-${ikiHane(d.getMonth() + 1)}-${ikiHane(d.getDate())}`; }
  function zamanFormatla(d) { return `${tarihFormatla(d)} ${ikiHane(d.getHours())}:${ikiHane(d.getMinutes())}`; }

  function escapeHtml(metin) {
    return String(metin).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ---------------------------------------------------------------------
     İkonlar (bağımsız, küçük SVG'ler — renk her zaman currentColor)
     --------------------------------------------------------------------- */
  function ikonTik(boyut) {
    const b = boyut || 14;
    return `<svg width="${b}" height="${b}" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.2 10.3 L9 13 L14 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function ikonUyari(boyut) {
    const b = boyut || 14;
    return `<svg width="${b}" height="${b}" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 L18 16.5 L2 16.5 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><line x1="10" y1="8" x2="10" y2="12.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="14.7" r="0.9" fill="currentColor" stroke="none"/></svg>`;
  }
  function ikonHata(boyut) {
    const b = boyut || 30;
    return `<svg width="${b}" height="${b}" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  }
  function ikonBos(boyut) {
    const b = boyut || 34;
    return `<svg width="${b}" height="${b}" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9 L7 4 H17 L21 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 9 H21 V18 H3 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 9 L9 9 L9 12 L15 12 L15 9 L21 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  }
  function ikonYenile(boyut) {
    const b = boyut || 14;
    return `<svg width="${b}" height="${b}" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 0 1 10.2-4.3M16 10a6 6 0 0 1-10.2 4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><polyline points="14 3 14.5 6.2 11.3 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><polyline points="6 17 5.5 13.8 8.7 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function ikonOkYukari() { return `<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 L11 9 L1 9 Z" fill="currentColor"/></svg>`; }
  function ikonOkAsagi() { return `<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11 L1 3 L11 3 Z" fill="currentColor"/></svg>`; }
  function ikonOkSabit() { return `<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="2"/></svg>`; }
  function ikonFiltre() {
    return `<svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="8.5" y1="15" x2="11.5" y2="15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  /* ---------------------------------------------------------------------
     Tarih yardımcıları
     --------------------------------------------------------------------- */
  function gunEkle(tarih, gun) {
    const yeni = new Date(tarih);
    yeni.setDate(yeni.getDate() + gun);
    return yeni;
  }
  function gunFarki(a, b) {
    return Math.round((a - b) / 86400000);
  }

  /* ---------------------------------------------------------------------
     Metrik hesaplama — OEE = Kullanılabilirlik x Performans x Kalite
     Toplamlar üzerinden hesaplanır (kayıt ortalamalarının ortalaması değil),
     bu, farklı uzunlukta dönemler/alt kümeler karşılaştırılırken istatistiksel
     olarak doğru sonucu verir.
     --------------------------------------------------------------------- */
  function metrikHesapla(kayitlar) {
    if (!kayitlar || kayitlar.length === 0) return null;

    let toplamPlanli = 0, toplamDurus = 0, toplamUretim = 0, toplamHatali = 0, idealSureToplam = 0;
    kayitlar.forEach((k) => {
      toplamPlanli += k.Planli_Sure_dk;
      toplamDurus += k.Durus_Suresi_dk;
      toplamUretim += k.Uretim_Adedi;
      toplamHatali += k.Hatali_Adet;
      idealSureToplam += k.Cevrim_Suresi_dk * k.Uretim_Adedi;
    });

    const toplamCalisma = toplamPlanli - toplamDurus;
    const kullanilabilirlik = toplamPlanli > 0 ? toplamCalisma / toplamPlanli : 0;
    const performans = toplamCalisma > 0 ? idealSureToplam / toplamCalisma : 0;
    const kalite = toplamUretim > 0 ? (toplamUretim - toplamHatali) / toplamUretim : 0;
    const oee = kullanilabilirlik * performans * kalite;

    return {
      kullanilabilirlik, performans, kalite, oee,
      toplamPlanli, toplamDurus, toplamCalisma, toplamUretim, toplamHatali,
      kayitSayisi: kayitlar.length,
    };
  }

  function kayitlariFiltrele(kayitlar, filtre) {
    return kayitlar.filter((k) => {
      if (filtre.hat !== "tumu" && k.Hat !== filtre.hat) return false;
      if (filtre.vardiya !== "tumu" && k.Vardiya !== filtre.vardiya) return false;
      if (filtre.baslangic && k._tarihNesnesi < filtre.baslangic) return false;
      if (filtre.bitis && k._tarihNesnesi > filtre.bitis) return false;
      return true;
    });
  }

  function gunlukOzetCikar(kayitlar) {
    const grup = new Map();
    kayitlar.forEach((k) => {
      if (!grup.has(k.Tarih)) grup.set(k.Tarih, []);
      grup.get(k.Tarih).push(k);
    });
    const sonuc = [];
    grup.forEach((liste, tarih) => {
      const m = metrikHesapla(liste);
      sonuc.push(Object.assign({ tarih, tarihNesnesi: liste[0]._tarihNesnesi }, m));
    });
    sonuc.sort((a, b) => a.tarihNesnesi - b.tarihNesnesi);
    return sonuc;
  }

  function kirilimOzetCikar(kayitlar, boyut) {
    const alan = boyut === "hat" ? "Hat" : boyut === "vardiya" ? "Vardiya" : "Durus_Nedeni";
    const grup = new Map();
    kayitlar.forEach((k) => {
      const anahtar = k[alan];
      if (!grup.has(anahtar)) grup.set(anahtar, []);
      grup.get(anahtar).push(k);
    });
    const sonuc = [];
    grup.forEach((liste, etiket) => {
      const m = metrikHesapla(liste);
      sonuc.push(Object.assign({ etiket }, m));
    });
    if (boyut === "neden") {
      sonuc.sort((a, b) => b.toplamDurus - a.toplamDurus);
    } else {
      sonuc.sort((a, b) => b.oee - a.oee);
    }
    return sonuc;
  }

  function oncekiDonemKayitlariniGetir(tumKayitlar, filtre) {
    if (!filtre.baslangic || !filtre.bitis) return [];
    const gunSayisi = gunFarki(filtre.bitis, filtre.baslangic) + 1;
    const oncekiBitis = gunEkle(filtre.baslangic, -1);
    const oncekiBaslangic = gunEkle(oncekiBitis, -(gunSayisi - 1));
    if (!durum.veriMin || oncekiBitis < durum.veriMin) return [];
    return kayitlariFiltrele(tumKayitlar, Object.assign({}, filtre, {
      baslangic: oncekiBaslangic, bitis: oncekiBitis,
    }));
  }

  /* ---------------------------------------------------------------------
     DOM referansları
     --------------------------------------------------------------------- */
  const el = {};
  function domBagla() {
    el.uygulama = document.getElementById("uygulama");
    el.basligiSon = document.getElementById("baslik-son-guncelleme");
    el.basligiKapsam = document.getElementById("baslik-veri-kapsami");
    el.yenileBtn = document.getElementById("yenile-buton");
    el.filtreCubugu = document.getElementById("filtre-cubugu");
    el.hatSecim = document.getElementById("filtre-hat");
    el.vardiyaSecim = document.getElementById("filtre-vardiya");
    el.baslangicGirdi = document.getElementById("filtre-baslangic");
    el.bitisGirdi = document.getElementById("filtre-bitis");
    el.baslangicBicimli = document.getElementById("filtre-baslangic-bicimli");
    el.bitisBicimli = document.getElementById("filtre-bitis-bicimli");
    el.sifirlaBtn = document.getElementById("filtre-sifirla");
    el.sekmeNav = document.getElementById("sekme-nav");
    el.icerik = document.getElementById("ekran-icerik");
    el.durumKatmani = document.getElementById("durum-katmani");
  }

  /* ---------------------------------------------------------------------
     Veri yükleme akışı
     --------------------------------------------------------------------- */
  async function veriYukleVeBaslat(ilkYukleme) {
    durum.asama = "yukleniyor";
    anaRenderEt();

    try {
      const sonuc = await VeriKatmani.veriGetir();
      durum.tumKayitlar = sonuc.kayitlar;
      durum.atlananSatirSayisi = sonuc.atlananSatirSayisi;
      durum.alinanZaman = sonuc.alinanZaman;

      const tarihler = durum.tumKayitlar.map((k) => k._tarihNesnesi);
      durum.veriMin = new Date(Math.min.apply(null, tarihler));
      durum.veriMax = new Date(Math.max.apply(null, tarihler));

      if (ilkYukleme) {
        const varsayilanBaslangic = gunEkle(durum.veriMax, -(VARSAYILAN_DONEM_GUN - 1));
        durum.filtre.baslangic = varsayilanBaslangic < durum.veriMin ? durum.veriMin : varsayilanBaslangic;
        durum.filtre.bitis = durum.veriMax;
      } else {
        // Yeniden okumada seçili filtreleri koru; ama aralık yeni veri
        // sınırlarının tamamen dışında kalmışsa tam kapsama geri dön.
        if (durum.filtre.baslangic < durum.veriMin) durum.filtre.baslangic = durum.veriMin;
        if (durum.filtre.bitis > durum.veriMax) durum.filtre.bitis = durum.veriMax;
      }

      durum.asama = "hazir";
    } catch (hata) {
      durum.asama = "hata";
      durum.hataMesaji = hata && hata.message ? hata.message : "Beklenmeyen bir hata oluştu.";
    }

    anaRenderEt();
  }

  /* ---------------------------------------------------------------------
     Üst ana render — global durumu (yükleniyor/hata) ve sekme yönlendirmesini
     yönetir. Her ekran fonksiyonu kendi "filtrelenmiş veri boş" durumunu
     ayrıca ele alır.
     --------------------------------------------------------------------- */
  function anaRenderEt() {
    basligiGuncelle();
    filtreCubuguGuncelle();
    sekmeleriGuncelle();

    if (durum.asama === "yukleniyor") {
      el.durumKatmani.hidden = false;
      el.durumKatmani.innerHTML = `
        <div class="durum-blok" role="status" aria-live="polite">
          <div class="spinner" aria-hidden="true"></div>
          <div class="durum-blok__baslik">Veriler yükleniyor</div>
          <div class="durum-blok__metin">Bağlı kaynaktan (veri/veri.csv) üretim verisi okunuyor…</div>
        </div>`;
      return;
    }

    if (durum.asama === "hata") {
      el.durumKatmani.hidden = false;
      el.durumKatmani.innerHTML = `
        <div class="durum-blok durum-blok--hata" role="alert">
          ${ikonHata(34)}
          <div class="durum-blok__baslik">Veri kaynağına ulaşılamadı</div>
          <div class="durum-blok__metin">${escapeHtml(durum.hataMesaji)}</div>
          <button type="button" class="buton buton-birincil" id="hata-yeniden-dene">${ikonYenile(14)} Yeniden Dene</button>
        </div>`;
      document.getElementById("hata-yeniden-dene").addEventListener("click", () => veriYukleVeBaslat(durum.tumKayitlar.length === 0));
      return;
    }

    el.durumKatmani.hidden = true;
    el.durumKatmani.innerHTML = "";
    ekraniRenderEt();
  }

  function basligiGuncelle() {
    if (durum.asama === "hazir") {
      el.basligiKapsam.textContent = `Veri kapsamı: ${tarihFormatla(durum.veriMin)} – ${tarihFormatla(durum.veriMax)} (${adetFormatla(durum.tumKayitlar.length)} kayıt)`;
      el.basligiSon.innerHTML = `Son güncelleme: <strong>${zamanFormatla(durum.alinanZaman)}</strong>`;
    } else if (durum.asama === "yukleniyor") {
      el.basligiKapsam.textContent = "Veri kapsamı: —";
      el.basligiSon.textContent = "Son güncelleme: yükleniyor…";
    } else {
      el.basligiKapsam.textContent = "Veri kapsamı: —";
      el.basligiSon.textContent = "Son güncelleme: başarısız";
    }
    el.yenileBtn.disabled = durum.asama === "yukleniyor";
    const ikonSarmalayici = el.yenileBtn.querySelector(".ikon-spin-sarici");
    if (ikonSarmalayici) {
      ikonSarmalayici.innerHTML = durum.asama === "yukleniyor" ? `<span class="ikon-spin">${ikonYenile(14)}</span>` : ikonYenile(14);
    }
  }

  function filtreCubuguGuncelle() {
    const devreDisi = durum.asama !== "hazir";
    [el.hatSecim, el.vardiyaSecim, el.baslangicGirdi, el.bitisGirdi, el.sifirlaBtn].forEach((n) => { n.disabled = devreDisi; });
    if (durum.asama !== "hazir") return;

    if (el.hatSecim.dataset.dolduruldu !== "1") {
      const hatlar = Array.from(new Set(durum.tumKayitlar.map((k) => k.Hat))).sort();
      el.hatSecim.innerHTML = `<option value="tumu">Tümü</option>` + hatlar.map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join("");
      const vardiyalar = Array.from(new Set(durum.tumKayitlar.map((k) => k.Vardiya))).sort();
      el.vardiyaSecim.innerHTML = `<option value="tumu">Tümü</option>` + vardiyalar.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
      el.hatSecim.dataset.dolduruldu = "1";
      el.vardiyaSecim.dataset.dolduruldu = "1";
    }

    el.baslangicGirdi.min = tarihGirisDegeri(durum.veriMin);
    el.baslangicGirdi.max = tarihGirisDegeri(durum.veriMax);
    el.bitisGirdi.min = tarihGirisDegeri(durum.veriMin);
    el.bitisGirdi.max = tarihGirisDegeri(durum.veriMax);
    el.hatSecim.value = durum.filtre.hat;
    el.vardiyaSecim.value = durum.filtre.vardiya;
    el.baslangicGirdi.value = tarihGirisDegeri(durum.filtre.baslangic);
    el.bitisGirdi.value = tarihGirisDegeri(durum.filtre.bitis);
    el.baslangicBicimli.textContent = tarihFormatla(durum.filtre.baslangic);
    el.bitisBicimli.textContent = tarihFormatla(durum.filtre.bitis);
  }

  const EKRANLAR = [
    { id: "E1", no: "E1", ad: "Özet" },
    { id: "E2", no: "E2", ad: "Trend" },
    { id: "E3", no: "E3", ad: "Kırılım" },
    { id: "E4", no: "E4", ad: "Detay" },
  ];

  function sekmeleriGuncelle() {
    if (el.sekmeNav.dataset.dolduruldu !== "1") {
      el.sekmeNav.innerHTML = EKRANLAR.map((e) => `
        <button type="button" class="sekme-dugme" role="tab" id="sekme-${e.id}" data-ekran="${e.id}" aria-selected="false">
          <span class="sekme-dugme__no">${e.no}</span> ${escapeHtml(e.ad)}
        </button>`).join("");
      el.sekmeNav.querySelectorAll(".sekme-dugme").forEach((btn) => {
        btn.addEventListener("click", () => {
          durum.aktifEkran = btn.dataset.ekran;
          anaRenderEt();
        });
      });
      el.sekmeNav.dataset.dolduruldu = "1";
    }
    el.sekmeNav.querySelectorAll(".sekme-dugme").forEach((btn) => {
      const secili = btn.dataset.ekran === durum.aktifEkran;
      btn.setAttribute("aria-selected", secili ? "true" : "false");
      btn.disabled = durum.asama !== "hazir";
    });
  }

  /* ---------------------------------------------------------------------
     Ortak: boş durum bloğu
     --------------------------------------------------------------------- */
  function bosBlokOlustur(baslik, metin) {
    return `
      <div class="bos-blok">
        ${ikonBos(34)}
        <div class="bos-blok__baslik">${escapeHtml(baslik)}</div>
        <div class="bos-blok__metin">${escapeHtml(metin)}</div>
        <button type="button" class="buton buton-ikincil" data-eylem="filtre-sifirla-bos">Filtreleri Sıfırla</button>
      </div>`;
  }

  function filtreOzetMetni() {
    const parcalar = [`${tarihFormatla(durum.filtre.baslangic)} – ${tarihFormatla(durum.filtre.bitis)}`];
    if (durum.filtre.hat !== "tumu") parcalar.push(durum.filtre.hat);
    if (durum.filtre.vardiya !== "tumu") parcalar.push(durum.filtre.vardiya);
    return parcalar.join(" · ");
  }

  /* ---------------------------------------------------------------------
     Ekran yönlendirme
     --------------------------------------------------------------------- */
  function ekraniRenderEt() {
    const filtreliKayitlar = kayitlariFiltrele(durum.tumKayitlar, durum.filtre);
    let html = "";
    if (durum.aktifEkran === "E1") html = e1OzetRenderEt(filtreliKayitlar);
    else if (durum.aktifEkran === "E2") html = e2TrendRenderEt(filtreliKayitlar);
    else if (durum.aktifEkran === "E3") html = e3KirilimRenderEt(filtreliKayitlar);
    else html = e4DetayRenderEt(filtreliKayitlar);

    el.icerik.innerHTML = html;
    el.icerik.querySelectorAll('[data-eylem="filtre-sifirla-bos"]').forEach((b) => b.addEventListener("click", filtreleriSifirla));
    ekranSonrasiOlaylariBagla();
  }

  /* ---------------------------------------------------------------------
     E1 — ÖZET / KPI
     --------------------------------------------------------------------- */
  function e1OzetRenderEt(kayitlar) {
    if (kayitlar.length === 0) {
      return `<div class="ekran"><div class="panel">${bosBlokOlustur("Bu filtrelerle veri bulunamadı", "Seçili tarih aralığı, hat veya vardiya için kayıt yok. Filtreleri değiştirip yeniden deneyin.")}</div></div>`;
    }

    const m = metrikHesapla(kayitlar);
    const oncekiKayitlar = oncekiDonemKayitlariniGetir(durum.tumKayitlar, durum.filtre);
    const onceki = oncekiKayitlar.length ? metrikHesapla(oncekiKayitlar) : null;

    const farkPuan = (m.oee - HEDEFLER.oee) * 100;
    const ozetCumle = `Seçili dönemde genel OEE <strong>${yuzdeMetni(m.oee)}</strong> — hedefin ${puanMetni(farkPuan / 100)} ${farkPuan >= 0 ? "üstünde" : "altında"}.`;

    const kartlar = [
      kpiKarti("OEE", m.oee, onceki && onceki.oee, HEDEFLER.oee, "yuzde"),
      kpiKarti("Kullanılabilirlik", m.kullanilabilirlik, onceki && onceki.kullanilabilirlik, HEDEFLER.kullanilabilirlik, "yuzde"),
      kpiKarti("Performans", m.performans, onceki && onceki.performans, HEDEFLER.performans, "yuzde"),
      kpiKarti("Kalite", m.kalite, onceki && onceki.kalite, HEDEFLER.kalite, "yuzde"),
      kpiKarti("Toplam Üretim", m.toplamUretim, onceki && onceki.toplamUretim, null, "adet"),
      kpiKarti("Toplam Duruş Süresi", m.toplamDurus, onceki && onceki.toplamDurus, null, "dakika"),
    ].join("");

    return `
      <div class="ekran">
        <div class="ekran__baslik-satiri">
          <div>
            <div class="ekran__baslik">Özet</div>
            <div class="ekran__aciklama">${filtreOzetMetni()} · ${adetFormatla(kayitlar.length)} kayıt</div>
          </div>
        </div>
        <div class="panel">
          <p class="panel__aciklama" style="font-size: var(--yazi-base); color: var(--renk-metin);">${ozetCumle}</p>
        </div>
        <div class="kpi-grid">${kartlar}</div>
      </div>`;
  }

  function kpiKarti(baslik, deger, oncekiDeger, hedef, birim) {
    const degerMetni = birim === "yuzde" ? yuzdeMetni(deger) : birim === "dakika" ? dakikaMetni(deger) : adetMetni(deger);
    const hedefVarMi = typeof hedef === "number";
    let rozetHtml = "";
    if (hedefVarMi) {
      const iyiMi = deger >= hedef;
      rozetHtml = `<span class="durum-rozeti ${iyiMi ? "durum-rozeti--iyi" : "durum-rozeti--kotu"}">${iyiMi ? ikonTik(13) : ikonUyari(13)}${iyiMi ? "Hedef Üstü" : "Hedef Altı"}</span>`;
    }

    let deltaHtml;
    if (oncekiDeger === null || oncekiDeger === undefined || Number.isNaN(oncekiDeger)) {
      deltaHtml = `<div class="kpi-karti__delta kpi-karti__delta--notr">${ikonOkSabit()}<span class="kpi-karti__delta-etiket">Önceki dönem verisi yok</span></div>`;
    } else {
      const fark = deger - oncekiDeger;
      const esik = birim === "yuzde" ? 0.0005 : Math.max(1, Math.abs(deger) * 0.001);
      if (Math.abs(fark) < esik) {
        deltaHtml = `<div class="kpi-karti__delta kpi-karti__delta--notr">${ikonOkSabit()}<span class="kpi-karti__delta-etiket">Önceki dönemle aynı</span></div>`;
      } else {
        const farkMetni = birim === "yuzde" ? puanMetni(fark) : birim === "dakika" ? dakikaMetni(Math.abs(fark)) : adetMetni(Math.abs(fark));
        const yonsuz = !hedefVarMi; // hedefi olmayan metriklerde (üretim adedi, duruş süresi) yön renksiz gösterilir
        const sinif = yonsuz ? "notr" : fark > 0 ? "iyi" : "kotu";
        const ikon = fark > 0 ? ikonOkYukari() : ikonOkAsagi();
        deltaHtml = `<div class="kpi-karti__delta kpi-karti__delta--${sinif}">${ikon}<span>${fark > 0 ? "+" : "-"}${farkMetni}</span><span class="kpi-karti__delta-etiket">önceki döneme göre</span></div>`;
      }
    }

    return `
      <article class="kpi-karti">
        <div class="kpi-karti__baslik">${escapeHtml(baslik)}</div>
        <div class="kpi-karti__deger">${degerMetni}</div>
        ${rozetHtml}
        ${deltaHtml}
        ${hedefVarMi ? `<div class="kpi-karti__hedef">Hedef: ${birim === "yuzde" ? yuzdeMetni(hedef) : hedef}</div>` : ""}
      </article>`;
  }

  /* ---------------------------------------------------------------------
     E2 — TREND
     --------------------------------------------------------------------- */
  const TREND_METRIKLERI = [
    { id: "oee", ad: "OEE", hedef: HEDEFLER.oee },
    { id: "kullanilabilirlik", ad: "Kullanılabilirlik", hedef: HEDEFLER.kullanilabilirlik },
    { id: "performans", ad: "Performans", hedef: HEDEFLER.performans },
    { id: "kalite", ad: "Kalite", hedef: HEDEFLER.kalite },
  ];

  function e2TrendRenderEt(kayitlar) {
    if (kayitlar.length === 0) {
      return `<div class="ekran"><div class="panel">${bosBlokOlustur("Bu filtrelerle veri bulunamadı", "Trend görüntülemek için seçili filtrelerle eşleşen kayıt yok.")}</div></div>`;
    }

    const metrikTanimi = TREND_METRIKLERI.find((m) => m.id === durum.trendMetrik) || TREND_METRIKLERI[0];
    const guncelGunluk = gunlukOzetCikar(kayitlar);

    const oncekiKayitlar = oncekiDonemKayitlariniGetir(durum.tumKayitlar, durum.filtre);
    const oncekiGunluk = oncekiKayitlar.length ? gunlukOzetCikar(oncekiKayitlar) : [];

    const segmentler = TREND_METRIKLERI.map((m) => `
      <button type="button" class="segment-dugme" role="radio" aria-checked="${m.id === durum.trendMetrik}" data-trend-metrik="${m.id}">${escapeHtml(m.ad)}</button>
    `).join("");

    const grafikSvg = cizgiGrafikSvg(guncelGunluk, oncekiGunluk, metrikTanimi);

    return `
      <div class="ekran">
        <div class="ekran__baslik-satiri">
          <div>
            <div class="ekran__baslik">Trend</div>
            <div class="ekran__aciklama">${filtreOzetMetni()} · mevcut dönem vs önceki dönem</div>
          </div>
          <div class="segment-kontrol" role="radiogroup" aria-label="Trend metriği">${segmentler}</div>
        </div>
        <div class="panel">
          <div class="panel__ust">
            <span class="panel__baslik">${escapeHtml(metrikTanimi.ad)} — Günlük Zaman Serisi</span>
            <span class="panel__aciklama">${oncekiGunluk.length ? "Önceki dönemle aynı gün sayısında hizalanmıştır" : "Önceki dönem için veri yok"}</span>
          </div>
          <div class="grafik-kapsayici">
            ${grafikSvg}
            <div class="grafik-lejant">
              <span class="grafik-lejant__oge"><span class="grafik-lejant__cizgi grafik-lejant__cizgi--guncel"></span>Mevcut Dönem</span>
              <span class="grafik-lejant__oge"><span class="grafik-lejant__cizgi grafik-lejant__cizgi--onceki"></span>Önceki Dönem</span>
              <span class="grafik-lejant__oge"><span class="grafik-lejant__cizgi grafik-lejant__cizgi--hedef"></span>Hedef (${yuzdeMetni(metrikTanimi.hedef)})</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function cizgiGrafikSvg(guncelSeri, oncekiSeri, metrikTanimi) {
    const genislik = 920, yukseklik = 300;
    const kenar = { sol: 46, sag: 18, ust: 14, alt: 30 };
    const gG = genislik - kenar.sol - kenar.sag;
    const gY = yukseklik - kenar.ust - kenar.alt;

    function xKoord(i, n) { return kenar.sol + (n <= 1 ? gG / 2 : (i / (n - 1)) * gG); }
    function yKoord(deger) { return kenar.ust + gY - Math.max(0, Math.min(1, deger)) * gY; }

    function yolUret(seri) {
      return seri.map((nokta, i) => `${i === 0 ? "M" : "L"} ${xKoord(i, seri.length).toFixed(1)} ${yKoord(nokta[metrikTanimi.id]).toFixed(1)}`).join(" ");
    }
    function noktalarUret(seri, sinif) {
      return seri.map((nokta, i) => `<circle cx="${xKoord(i, seri.length).toFixed(1)}" cy="${yKoord(nokta[metrikTanimi.id]).toFixed(1)}" r="2.6" class="${sinif}" />`).join("");
    }

    let izgara = "";
    [0, 0.25, 0.5, 0.75, 1].forEach((oran) => {
      const y = yKoord(oran);
      izgara += `<line x1="${kenar.sol}" y1="${y.toFixed(1)}" x2="${genislik - kenar.sag}" y2="${y.toFixed(1)}" class="g-izgara" />`;
      izgara += `<text x="${kenar.sol - 8}" y="${y.toFixed(1)}" class="g-eksen-etiket" text-anchor="end" dominant-baseline="middle">%${Math.round(oran * 100)}</text>`;
    });

    const hedefY = yKoord(metrikTanimi.hedef);
    const hedefSvg = `<line x1="${kenar.sol}" y1="${hedefY.toFixed(1)}" x2="${genislik - kenar.sag}" y2="${hedefY.toFixed(1)}" class="g-hedef-cizgi" />
      <text x="${genislik - kenar.sag}" y="${(hedefY - 6).toFixed(1)}" class="g-hedef-etiket" text-anchor="end">Hedef %${Math.round(metrikTanimi.hedef * 100)}</text>`;

    const oncekiYol = oncekiSeri.length ? `<path d="${yolUret(oncekiSeri)}" fill="none" class="g-cizgi-onceki" />${noktalarUret(oncekiSeri, "g-nokta-onceki")}` : "";
    const guncelYol = guncelSeri.length ? `<path d="${yolUret(guncelSeri)}" fill="none" class="g-cizgi-guncel" />${noktalarUret(guncelSeri, "g-nokta-guncel")}` : "";

    let xEtiket = "";
    const adim = Math.max(1, Math.ceil(guncelSeri.length / 6));
    guncelSeri.forEach((nokta, i) => {
      if (i % adim === 0 || i === guncelSeri.length - 1) {
        const hiza = i === 0 ? "start" : i === guncelSeri.length - 1 ? "end" : "middle";
        xEtiket += `<text x="${xKoord(i, guncelSeri.length).toFixed(1)}" y="${yukseklik - kenar.alt + 18}" class="g-eksen-etiket" text-anchor="${hiza}">${nokta.tarih}</text>`;
      }
    });

    return `<svg viewBox="0 0 ${genislik} ${yukseklik}" class="grafik-svg" role="img" aria-label="${escapeHtml(metrikTanimi.ad)} trend grafiği">
      ${izgara}${hedefSvg}${oncekiYol}${guncelYol}${xEtiket}
    </svg>`;
  }

  /* ---------------------------------------------------------------------
     E3 — KIRILIM / PARETO
     --------------------------------------------------------------------- */
  const KIRILIM_BOYUTLARI = [
    { id: "neden", ad: "Duruş Nedeni" },
    { id: "hat", ad: "Hat" },
    { id: "vardiya", ad: "Vardiya" },
  ];

  function e3KirilimRenderEt(kayitlar) {
    if (kayitlar.length === 0) {
      return `<div class="ekran"><div class="panel">${bosBlokOlustur("Bu filtrelerle veri bulunamadı", "Kırılım görüntülemek için seçili filtrelerle eşleşen kayıt yok.")}</div></div>`;
    }

    const boyutTanimi = KIRILIM_BOYUTLARI.find((b) => b.id === durum.kirilimBoyutu) || KIRILIM_BOYUTLARI[0];
    const ozet = kirilimOzetCikar(kayitlar, boyutTanimi.id);
    const nedenModu = boyutTanimi.id === "neden";

    const segmentler = KIRILIM_BOYUTLARI.map((b) => `
      <button type="button" class="segment-dugme" role="radio" aria-checked="${b.id === durum.kirilimBoyutu}" data-kirilim-boyutu="${b.id}">${escapeHtml(b.ad)}</button>
    `).join("");

    const barVerileri = ozet.map((s) => ({
      etiket: s.etiket,
      deger: nedenModu ? s.toplamDurus : s.oee,
      degerMetin: nedenModu ? dakikaMetni(s.toplamDurus) : yuzdeMetni(s.oee),
      durum: nedenModu ? "notr" : (s.oee >= HEDEFLER.oee ? "iyi" : "kotu"),
    }));

    const grafikSvg = barGrafikSvg(barVerileri, nedenModu ? null : HEDEFLER.oee, nedenModu);

    return `
      <div class="ekran">
        <div class="ekran__baslik-satiri">
          <div>
            <div class="ekran__baslik">Kırılım</div>
            <div class="ekran__aciklama">${filtreOzetMetni()}</div>
          </div>
          <div class="segment-kontrol" role="radiogroup" aria-label="Kırılım boyutu">${segmentler}</div>
        </div>
        <div class="panel">
          <div class="panel__ust">
            <span class="panel__baslik">${escapeHtml(boyutTanimi.ad)} Bazında ${nedenModu ? "Toplam Duruş Süresi" : "Ortalama OEE"}</span>
            <span class="panel__aciklama">${nedenModu ? "Büyükten küçüğe sıralı (Pareto)" : `Hedef: ${yuzdeMetni(HEDEFLER.oee)}`}</span>
          </div>
          <div class="grafik-kapsayici">${grafikSvg}</div>
        </div>
      </div>`;
  }

  function barGrafikSvg(veriler, hedef, notrMod) {
    const genislik = 920;
    const satirY = 38;
    const kenar = { sol: 168, sag: 110, ust: 10, alt: 10 };
    const gG = genislik - kenar.sol - kenar.sag;
    const yukseklik = kenar.ust + kenar.alt + veriler.length * satirY;
    const hamEnBuyuk = Math.max.apply(null, veriler.map((v) => v.deger).concat([hedef || 0, 0.0001]));
    const enBuyuk = hamEnBuyuk * 1.18; // etiketler ve hedef çizgisi için pay

    let icerik = "";
    veriler.forEach((v, i) => {
      const y = kenar.ust + i * satirY;
      const barUzunluk = Math.max((v.deger / enBuyuk) * gG, 2);
      const sinif = v.durum === "iyi" ? "g-bar-iyi" : v.durum === "kotu" ? "g-bar-kotu" : "g-bar-notr";
      const ikon = v.durum === "iyi" ? ikonTik(13) : v.durum === "kotu" ? ikonUyari(13) : "";

      icerik += `
        <text x="${kenar.sol - 10}" y="${(y + satirY / 2).toFixed(1)}" text-anchor="end" dominant-baseline="middle" class="g-bar-etiket">${escapeHtml(v.etiket)}</text>
        <rect x="${kenar.sol}" y="${(y + 7).toFixed(1)}" width="${barUzunluk.toFixed(1)}" height="${satirY - 14}" rx="3" class="${sinif}"></rect>
        <g transform="translate(${(kenar.sol + barUzunluk + 8).toFixed(1)}, ${(y + satirY / 2 - 6.5).toFixed(1)})">${ikon}</g>
        <text x="${(kenar.sol + barUzunluk + (ikon ? 26 : 8)).toFixed(1)}" y="${(y + satirY / 2).toFixed(1)}" dominant-baseline="middle" class="g-bar-deger">${v.degerMetin}</text>`;
    });

    let hedefSvg = "";
    if (!notrMod && typeof hedef === "number") {
      const hedefX = kenar.sol + (hedef / enBuyuk) * gG;
      hedefSvg = `<line x1="${hedefX.toFixed(1)}" y1="${kenar.ust}" x2="${hedefX.toFixed(1)}" y2="${yukseklik - kenar.alt}" class="g-hedef-cizgi" />`;
    }

    return `<svg viewBox="0 0 ${genislik} ${yukseklik}" class="grafik-svg" role="img" aria-label="Kırılım bar grafiği">${hedefSvg}${icerik}</svg>`;
  }

  /* ---------------------------------------------------------------------
     E4 — DETAY / AKSİYON TABLOSU
     --------------------------------------------------------------------- */
  const E4_SUTUNLAR = [
    { anahtar: "Tarih", baslik: "Tarih", tip: "tarih", erisim: (k) => k._tarihNesnesi, goster: (k) => k.Tarih },
    { anahtar: "Hat", baslik: "Hat", tip: "metin", erisim: (k) => k.Hat, goster: (k) => k.Hat },
    { anahtar: "Vardiya", baslik: "Vardiya", tip: "metin", erisim: (k) => k.Vardiya, goster: (k) => k.Vardiya },
    { anahtar: "Planli_Sure_dk", baslik: "Planlı Süre", tip: "sayi", erisim: (k) => k.Planli_Sure_dk, goster: (k) => dakikaMetni(k.Planli_Sure_dk), sayisal: true },
    { anahtar: "Durus_Suresi_dk", baslik: "Duruş Süresi", tip: "sayi", erisim: (k) => k.Durus_Suresi_dk, goster: (k) => dakikaMetni(k.Durus_Suresi_dk), sayisal: true },
    { anahtar: "Durus_Nedeni", baslik: "Duruş Nedeni", tip: "metin", erisim: (k) => k.Durus_Nedeni, goster: (k) => k.Durus_Nedeni },
    { anahtar: "Uretim_Adedi", baslik: "Üretim", tip: "sayi", erisim: (k) => k.Uretim_Adedi, goster: (k) => adetMetni(k.Uretim_Adedi), sayisal: true },
    { anahtar: "Hatali_Adet", baslik: "Hatalı", tip: "sayi", erisim: (k) => k.Hatali_Adet, goster: (k) => adetMetni(k.Hatali_Adet), sayisal: true },
    { anahtar: "OEE", baslik: "OEE", tip: "sayi", erisim: satirOee, goster: (k) => yuzdeMetni(satirOee(k)), sayisal: true },
    { anahtar: "Durum", baslik: "Durum", tip: "sayi", erisim: satirOee, durumSutunu: true },
  ];

  function satirOee(k) {
    const m = metrikHesapla([k]);
    return m.oee;
  }

  function e4DetayRenderEt(kayitlar) {
    if (kayitlar.length === 0) {
      return `<div class="ekran"><div class="panel">${bosBlokOlustur("Bu filtrelerle veri bulunamadı", "Detay tablosu için seçili filtrelerle eşleşen kayıt yok.")}</div></div>`;
    }

    const sutun = E4_SUTUNLAR.find((s) => s.anahtar === durum.siralama.sutun) || E4_SUTUNLAR[0];
    const sirali = kayitlar.slice().sort((a, b) => {
      const va = sutun.erisim(a), vb = sutun.erisim(b);
      const sonuc = sutun.tip === "metin" ? String(va).localeCompare(String(vb), "tr") : va - vb;
      return durum.siralama.yon === "azalan" ? -sonuc : sonuc;
    });

    const basliklar = E4_SUTUNLAR.map((s) => {
      const aktif = s.anahtar === durum.siralama.sutun;
      const ok = aktif ? (durum.siralama.yon === "azalan" ? ikonOkAsagi() : ikonOkYukari()) : "";
      const ariaSort = aktif ? (durum.siralama.yon === "azalan" ? "descending" : "ascending") : "none";
      return `<th aria-sort="${ariaSort}"><button type="button" class="th-sirala-dugme" data-sirala="${s.anahtar}" data-sirali="${aktif}">${escapeHtml(s.baslik)}${ok}</button></th>`;
    }).join("");

    const satirlar = sirali.map((k) => {
      const hucreler = E4_SUTUNLAR.map((s) => {
        if (s.durumSutunu) {
          const oee = satirOee(k);
          const iyiMi = oee >= HEDEFLER.oee;
          return `<td><span class="durum-rozeti ${iyiMi ? "durum-rozeti--iyi" : "durum-rozeti--kotu"}">${iyiMi ? ikonTik(12) : ikonUyari(12)}${iyiMi ? "Hedef Üstü" : "Hedef Altı"}</span></td>`;
        }
        const icerik = s.goster(k);
        return `<td class="${s.sayisal ? "td-sayi" : ""}">${escapeHtml(icerik)}</td>`;
      }).join("");
      return `<tr>${hucreler}</tr>`;
    }).join("");

    return `
      <div class="ekran">
        <div class="ekran__baslik-satiri">
          <div>
            <div class="ekran__baslik">Detay</div>
            <div class="ekran__aciklama">${filtreOzetMetni()}</div>
          </div>
        </div>
        <div class="panel">
          <div class="panel__ust">
            <span class="panel__baslik">Kayıt Listesi</span>
            <span class="panel__aciklama">Sütun başlığına tıklayarak sıralayın</span>
          </div>
          <div class="tablo-kapsayici">
            <table class="veri-tablosu">
              <thead><tr>${basliklar}</tr></thead>
              <tbody>${satirlar}</tbody>
            </table>
          </div>
          <div class="tablo-altyazi">${adetFormatla(sirali.length)} kayıt gösteriliyor (toplam ${adetFormatla(durum.tumKayitlar.length)} kayıttan)</div>
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------------------
     Ekran-içi olay bağlama (her render sonrası yeniden bağlanır)
     --------------------------------------------------------------------- */
  function ekranSonrasiOlaylariBagla() {
    el.icerik.querySelectorAll("[data-trend-metrik]").forEach((btn) => {
      btn.addEventListener("click", () => { durum.trendMetrik = btn.dataset.trendMetrik; ekraniRenderEt(); });
    });
    el.icerik.querySelectorAll("[data-kirilim-boyutu]").forEach((btn) => {
      btn.addEventListener("click", () => { durum.kirilimBoyutu = btn.dataset.kirilimBoyutu; ekraniRenderEt(); });
    });
    el.icerik.querySelectorAll("[data-sirala]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const anahtar = btn.dataset.sirala;
        if (durum.siralama.sutun === anahtar) {
          durum.siralama.yon = durum.siralama.yon === "azalan" ? "artan" : "azalan";
        } else {
          durum.siralama.sutun = anahtar;
          durum.siralama.yon = "azalan";
        }
        ekraniRenderEt();
      });
    });
  }

  /* ---------------------------------------------------------------------
     Filtre olayları
     --------------------------------------------------------------------- */
  function filtreleriSifirla() {
    const varsayilanBaslangic = gunEkle(durum.veriMax, -(VARSAYILAN_DONEM_GUN - 1));
    durum.filtre = {
      baslangic: varsayilanBaslangic < durum.veriMin ? durum.veriMin : varsayilanBaslangic,
      bitis: durum.veriMax,
      hat: "tumu",
      vardiya: "tumu",
    };
    anaRenderEt();
  }

  function filtreOlaylariniBagla() {
    el.hatSecim.addEventListener("change", () => { durum.filtre.hat = el.hatSecim.value; anaRenderEt(); });
    el.vardiyaSecim.addEventListener("change", () => { durum.filtre.vardiya = el.vardiyaSecim.value; anaRenderEt(); });
    el.baslangicGirdi.addEventListener("change", () => {
      const yeni = new Date(el.baslangicGirdi.value + "T00:00:00");
      if (yeni > durum.filtre.bitis) { durum.filtre.bitis = yeni; }
      durum.filtre.baslangic = yeni;
      anaRenderEt();
    });
    el.bitisGirdi.addEventListener("change", () => {
      const yeni = new Date(el.bitisGirdi.value + "T00:00:00");
      if (yeni < durum.filtre.baslangic) { durum.filtre.baslangic = yeni; }
      durum.filtre.bitis = yeni;
      anaRenderEt();
    });
    el.sifirlaBtn.addEventListener("click", filtreleriSifirla);
    el.yenileBtn.addEventListener("click", () => veriYukleVeBaslat(false));
  }

  /* ---------------------------------------------------------------------
     Başlangıç
     --------------------------------------------------------------------- */
  function baslat() {
    domBagla();
    el.yenileBtn.innerHTML = `<span class="ikon-spin-sarici">${ikonYenile(14)}</span> Canlı Veriyi Yenile`;
    filtreOlaylariniBagla();
    veriYukleVeBaslat(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", baslat);
  } else {
    baslat();
  }
})();
