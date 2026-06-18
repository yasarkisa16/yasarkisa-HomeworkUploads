# Tur A — Donatımsız (Kontrol Turu)

> **Kurulum:** Boş sohbet. Project/Gem **YOK**, Kalıcı Talimat **YOK**, Connector **YOK**.
> Tek serbest promptla dashboard üretilir.
>
> **Amaç:** Yönetişim katmanı olmadan çıktının nasıl olduğunu (tutarsızlık, kural
> ihlali, gömülü veri) belgelemek — Tur B ile karşılaştırma için kontrol grubu.

**Araç:** Claude (claude.ai) · **Senaryo:** S1 — OEE Panosu

---

## Paylaşılan sohbet linki

https://claude.ai/share/1b3ba858-ff98-49dc-ad40-c5b779fe6f08

---

## Üretim 1

### Prompt (kullanıcı)

```
VALEO üretim hattı için bir OEE (Genel Ekipman Etkinliği) dashboard'u üret.
Üretim Müdürü için olsun; hat ve vardiya bazında OEE, kullanılabilirlik,
performans, kalite ve duruş nedenlerini göstersin. Tek dosyada HTML/CSS/JS
olarak ver.
```

### Çıktı

Tek dosya HTML/CSS/JS dashboard üretildi → [`../dashboard/tur-A/valeo-oee-dashboard.html`](../dashboard/tur-A/valeo-oee-dashboard.html)

> Tam kesintisiz sohbet yukarıdaki **paylaşım linkinden** erişilebilir.
> Çıktı dosyası: `../dashboard/tur-A/valeo-oee-dashboard.html`

---

## Üretim 2 (tekrarlanabilirlik kontrolü)

Aynı prompt **boş yeni bir sohbette** 2. kez çalıştırıldı → çıktı **saptı**.
İkinci çıktı: [`../dashboard/tur-A/valeo-oee-dashboard-uretim-2.html`](../dashboard/tur-A/valeo-oee-dashboard-uretim-2.html)

### İki üretim arasındaki farklar (kanıt)

| Eksen | Üretim 1 | Üretim 2 |
|-------|----------|----------|
| Dosya tipi | Tam HTML belgesi (kendi `:root` teması) | Parça/artifact (`--color-*` token'ları, inline stil) |
| Veri üretimi | `mulberry32`, seed 20260617, 30 gün | `seededRandom` LCG, seed 42, 21 gün |
| Hat adları | "Hat 1 – Silecek Sistemleri" vb. açıklamalı | Sadece "Hat 1".."Hat 4" |
| Ekran kompozisyonu | Gauge + Trend + Hat bar + Vardiya bar + Pareto + 2 tablo | Gauge + Trend + Pareto + 1 tablo |
| Durum etiketleri | "Hedefte / İzlenmeli / Kritik" | "Dünya standardı / Kabul edilebilir / İyileştirme gerekli" |
| Renk paleti | #4a90d9 / #0e1217 | #185FA5 / #D85A30 |

**Sonuç:** Aynı prompt, yönetişim katmanı olmadan **farklı veri modeli, farklı görsel
sistem, farklı ekran sayısı ve farklı durum taksonomisi** üretti. Tur A çıktısı
**tekrarlanabilir değildir**. Tur B'de aynı senaryo, üretim standardı + kalıcı talimat
sayesinde kararlı biçimde üretilecektir.

---

## Gözlem Notları (Tur A — gerçek çıktıdan)

| Gözlem | Durum | Kanıt |
|--------|-------|-------|
| Veri koda gömülü mü? | ❌ **Gömülü** (beklenen) | `mulberry32` seeded RNG + `generateDataset(30)` ile veri JS içinde üretiliyor; bağlı kaynak yok |
| Inline CSS / `<script>`? | ❌ **Var** (beklenen) | Tüm stil ve script tek dosyada gömülü |
| Dekoratif efekt? | ⚠️ Var | `radial-gradient` arka plan + gölgeler — standartla çelişir |
| Türkçe etiket | ✅ Var | ama kural zorlamadı; araç kendiliğinden yaptı |
| Boş-durum mesajı | ✅ Var | "Seçili filtreyle eşleşen veri yok" |
| Tekrarlanabilirlik | ⚠️ Garanti değil | yönetişim yok → 2. üretimde yapı/tasarım sapar |

**Sonuç:** Çıktı görsel olarak başarılı; ancak veri gömülü, stil ayrık değil ve
tekrarlanabilirlik garanti edilmiyor. Bu eksiklikler Tur B'de yönetişim katmanıyla
giderilecek (bkz. `tur-B.md`).
