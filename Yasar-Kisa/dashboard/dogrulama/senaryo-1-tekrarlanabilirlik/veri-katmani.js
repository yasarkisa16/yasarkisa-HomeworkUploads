/* ==========================================================================
   VERİ KATMANI
   --------------------------------------------------------------------------
   Kalıcı talimat madde 3 — "Veri ASLA koda gömülmez": bu dosya hiçbir üretim
   rakamı içermez. Tek görevi, bağlı kaynaktan (burada: veri/veri.csv —
   gerçek kurulumda aynı arayüz bir Google Sheet'e bağlanabilir) veriyi canlı
   okumak, ayrıştırmak ve doğrulamaktır. Sunum katmanı (js/uygulama.js) bu
   modülün ürettiği kayıt listesini kullanır; ham CSV ile hiç konuşmaz.
   ========================================================================== */

const VeriKatmani = (() => {
  const VERI_KAYNAGI_YOLU = "./veri/veri.csv";

  const BEKLENEN_BASLIKLAR = [
    "Tarih", "Hat", "Vardiya", "Planli_Sure_dk", "Durus_Suresi_dk",
    "Durus_Nedeni", "Uretim_Adedi", "Hatali_Adet", "Cevrim_Suresi_dk",
  ];

  const SAYISAL_ALANLAR = [
    "Planli_Sure_dk", "Durus_Suresi_dk", "Uretim_Adedi",
    "Hatali_Adet", "Cevrim_Suresi_dk",
  ];

  const TARIH_DESENI = /^(\d{2})\.(\d{2})\.(\d{4})$/;

  function csvSatiriniBol(satir) {
    // Veri setinde tırnaklı/virgüllü metin alanı yok; basit ve denetlenebilir
    // bir bölme yeterli ve hata ayıklaması daha kolay.
    return satir.split(",").map((h) => h.trim());
  }

  function tarihGecerliMi(metin) {
    return TARIH_DESENI.test(metin);
  }

  function tarihNesnesiUret(metin) {
    const eslesme = TARIH_DESENI.exec(metin);
    if (!eslesme) return null;
    const [, gun, ay, yil] = eslesme;
    return new Date(Number(yil), Number(ay) - 1, Number(gun));
  }

  function csvAyristir(metin) {
    const satirlar = metin.replace(/\r/g, "").split("\n").filter((s) => s.trim().length > 0);
    if (satirlar.length < 1) {
      throw new Error("Veri kaynağı boş.");
    }

    const baslik = csvSatiriniBol(satirlar[0]);
    const baslikGecerli = BEKLENEN_BASLIKLAR.every((b, i) => baslik[i] === b);
    if (!baslikGecerli) {
      throw new Error(
        "Veri kaynağının sütun yapısı beklenenden farklı. Beklenen: " +
        BEKLENEN_BASLIKLAR.join(", ")
      );
    }

    const kayitlar = [];
    const atlananSatirlar = [];

    for (let i = 1; i < satirlar.length; i += 1) {
      const hucreler = csvSatiriniBol(satirlar[i]);
      if (hucreler.length !== BEKLENEN_BASLIKLAR.length) {
        atlananSatirlar.push(i + 1);
        continue;
      }

      const kayit = {};
      BEKLENEN_BASLIKLAR.forEach((alan, idx) => {
        kayit[alan] = hucreler[idx];
      });

      let satirGecerli = tarihGecerliMi(kayit.Tarih);
      SAYISAL_ALANLAR.forEach((alan) => {
        const sayi = Number(kayit[alan]);
        if (Number.isNaN(sayi)) {
          satirGecerli = false;
        } else {
          kayit[alan] = sayi;
        }
      });

      if (!satirGecerli) {
        atlananSatirlar.push(i + 1);
        continue;
      }

      // Filtreleme/sıralama için türetilmiş alan — ham alanların hiçbiri
      // değiştirilmiyor, sadece ek bir Date nesnesi ekleniyor.
      kayit._tarihNesnesi = tarihNesnesiUret(kayit.Tarih);
      kayitlar.push(kayit);
    }

    if (kayitlar.length === 0) {
      throw new Error("Veri kaynağında geçerli hiçbir satır bulunamadı.");
    }

    return { kayitlar, atlananSatirlar };
  }

  async function veriGetir() {
    let yanit;
    try {
      yanit = await fetch(VERI_KAYNAGI_YOLU, { cache: "no-store" });
    } catch (aglariHatasi) {
      throw new Error(
        "Veri kaynağına ağ üzerinden ulaşılamadı. Dosyanın yerel bir web " +
        "sunucusu üzerinden sunulduğundan emin olun."
      );
    }

    if (!yanit.ok) {
      throw new Error("Veri kaynağı " + yanit.status + " durum koduyla döndü.");
    }

    const metin = await yanit.text();
    const sonuc = csvAyristir(metin);

    return {
      kayitlar: sonuc.kayitlar,
      atlananSatirSayisi: sonuc.atlananSatirlar.length,
      alinanZaman: new Date(),
      kaynakYolu: VERI_KAYNAGI_YOLU,
    };
  }

  return { veriGetir };
})();
