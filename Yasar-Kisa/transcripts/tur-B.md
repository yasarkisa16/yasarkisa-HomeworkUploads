# Tur B — Donatılmış (Tam Yönetişim Katmanı)

> **Kurulum:** Project (Bağlam) + Custom Instructions (Kalıcı Talimat) + Project Knowledge
> (Üretim Standardı + veri şeması) + Google Drive Connector (Canlı Veri) aktif.
>
> **Amaç:** Aynı senaryoyu kurallı ve tekrarlanabilir biçimde üretmek ve her
> mekanizmanın etkisini kanıtlamak.

**Araç:** Claude (claude.ai) · Model: Sonnet 4.6 · **Senaryo:** S1 — OEE Panosu

---

## Kanıt

Tur B üretimi **Project içinde** yapıldı. Çıktı dosyaları `../dashboard/tur-B/`
(index.html, style.css, app.js, veri.csv) ve ekran görüntüleri
`../ekran-goruntuleri/04-canli-veri.png`, `05-dashboard.png` ile belgelenmiştir.
Doğrulama senaryolarının paylaşım linkleri README'dedir.

---

## Prompt (kullanıcı)

```
Bağlı Google Drive'daki "VALEO-OEE-Veri" Google E-Tablosundaki veriyi CANLI oku
(veriyi koda gömme, bağlı kaynaktan oku).

Project bilgisindeki üretim standardına (tasarım sistemi, ekran anatomisi,
grafik seçim kuralları) ve kalıcı talimatlara (₺ biçimi + binlik ayıraç, tüm
etiketler Türkçe, inline CSS/script yasak, WCAG AA kontrast + renk tek başına
anlam taşımaz, her ekranda boş/hata/yüklenme durumu) tam uyarak, Üretim Müdürü
için en az 4 ekranlı bir OEE dashboard'u üret:

- E1 — Özet / KPI: en kritik 4-6 metrik kartı
- E2 — Trend: zaman serisi, mevcut vs önceki dönem
- E3 — Kırılım / Pareto: hat/vardiya/duruş nedeni dağılımı
- E4 — Detay / Aksiyon: tablo + durum sütunları

Stil tek tasarım sistemi dosyasından gelsin. Çıktıyı tek HTML + ayrı CSS olarak ver.
```

## Çıktı

Ayrık dosyalar olarak üretildi → [`../dashboard/tur-B/`](../dashboard/tur-B/)
- `index.html` — yapı, 4 ekran (E1–E4), `<link rel="stylesheet" href="style.css">` + `<script src="app.js">`
- `style.css` — tek tasarım sistemi dosyası
- `app.js` — uygulama mantığı; veriyi `fetch("./veri.csv")` ile çalışma zamanında okur
- `veri.csv` — bağlı Google Drive'dan çekilen sentetik veri (koddan ayrık katman)

---

## Kanıt Kontrol Listesi (Tur B) — gerçek koddan doğrulandı

| Kural / Kanıt | Sonuç | Koddaki yeri |
|---------------|-------|--------------|
| **Veri koda gömülü değil** (canlı/ayrık katman) | ✅ | `app.js` → `CONFIG.DATA_SOURCE_URL="./veri.csv"`, `fetch(...).then(parseCSV)`; yorum: "bu dosyaya gömülü değil, çalışma zamanında okunur" |
| **Canlı veri Drive'dan okundu** | ✅ | Üretim sırasında "Veri" dosyası Google Drive logosuyla bağlı tablodan çekildi (ekran görüntüsü 04) |
| **Inline CSS/script yasak; stil tek dosyadan** | ✅ | `index.html` yalnızca `style.css` + `app.js` linkler; `style.css` başlığı: "tek stil kaynağı… Inline stil kullanılmaz" |
| **Tüm etiketler Türkçe; sayı biçimi tr-TR** | ✅ | `Intl.NumberFormat("tr-TR")`, tüm başlık/etiket Türkçe |
| **Renk tek başına anlam taşımaz (ikon+etiket)** | ✅ | `.status-pill` → ikon (✓/!/✕) + metin; CSS yorumu: "renk TEK BAŞINA anlam taşımaz" |
| **Boş / hata / yüklenme durumları** | ✅ | Her ekranda `loading/error/empty/content`; `setScreenState`, `state-box`, `skeleton` |
| **4 ekran (üretim standardı)** | ✅ | E1 Özet/KPI, E2 Trend, E3 Kırılım/Pareto, E4 Detay/Aksiyon |
| **Grafik seçimi standarda uygun** | ✅ | Trend → çizgi; kırılım → sütun; Pareto → çubuk + kümülatif çizgi (%80 eşiği) |
| **Renk = anlam (mavi mevcut / gri önceki)** | ✅ | CSS değişkenleri `--mevcut` mavi, `--onceki` gri; E2 mevcut vs önceki dönem |

**Sonuç:** Üretim standardı ve kalıcı talimat çıktıda **fiilen uygulandı** (dekoratif değil).
Veri ayrık katmandan canlı okunuyor, stil tek dosyadan geliyor, dört ekran standart
anatomiye uyuyor. Tur A'daki gömülü veri + inline stil + kuralsız üretimle net kontrast.

---

## Tur A ↔ Tur B kontrastı (özet)

| Eksen | Tur A (donatımsız) | Tur B (donatımlı) |
|-------|--------------------|--------------------|
| Veri | JS içinde RNG ile üretiliyor (gömülü) | `veri.csv`'den `fetch` ile okunuyor (ayrık/canlı) |
| Stil | Tek dosyada inline `<style>` | Ayrı `style.css`, inline yok |
| Tekrarlanabilirlik | İki üretim sapıyor | Standart + talimat → kararlı (bkz. dogrulama.md/1) |
| Durumlar | Kısmi | Her ekranda boş/hata/yüklenme |
