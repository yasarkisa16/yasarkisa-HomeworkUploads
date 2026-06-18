# Üretim Standardı — Skill/Gem bilgi dosyası

Kurumun dashboard üretim standardı. Bu paket, asistanın **her üretimde aynı standardı**
uygulamasını sağlar (2. gün tasarım sistemi + ekran anatomisi + grafik seçim kuralları).
Bu metni Claude'da bir **Skill** / Project bilgi dosyası, Gemini'de bir **Gem bilgi dosyası**
olarak yükleyin — sohbete yapıştırmayın (bkz. Context Bütçesi).

## 1. Tasarım Sistemi

- **Renk = anlam:**
  - Mavi → mevcut/güncel dönem
  - Gri → referans / önceki dönem
  - Yeşil → hedefin üstünde (iyi), Kırmızı → hedefin altında (kötü)
  - Renk asla tek başına bilgi taşımaz; etiket + ikon eşlik eder (WCAG AA kontrast).
- **Tipografi & boşluk:** Sabit tipografi ve boşluk ölçeği. Dekoratif gölge, 3B
  efekt, gradient kullanılmaz.
- **Stil kaynağı:** Tek tasarım sistemi dosyası; inline stil yok.

## 2. Ekran Anatomisi (her ekran)

```
┌──────────────────────────────────────────────┐
│ Header: başlık + son güncelleme zamanı         │
├──────────────────────────────────────────────┤
│ Filtre çubuğu: tarih / hat / vardiya            │
├──────────────────────────────────────────────┤
│ KPI kartları (4–6 adet, ilk bakışta okunur)     │
├──────────────────────────────────────────────┤
│ Grafik gövdesi (asıl içerik)                    │
└──────────────────────────────────────────────┘
```

## 3. Grafik Seçim Kuralları

| Amaç | Doğru Grafik |
|------|--------------|
| Zaman serisi / trend | Çizgi grafik |
| Kategori karşılaştırma | Sütun / bar |
| Dönüşüm / aşama | Funnel |
| Pay (yalnızca 2–3 parça) | Pasta |

- **'No-scroll' kuralı:** En önemli bilgi tek ekranda, kaydırmadan görünür.

## 4. Beklenen Ekranlar (en az 4)

| Ekran | İçerik | İlke |
|-------|--------|------|
| E1 — Özet / KPI | En kritik 4–6 metrik kartı | Bilgi hiyerarşisi; tek ekranda özet |
| E2 — Trend | Zaman serisi; mevcut vs önceki dönem | Çizgi grafik; renk = dönem |
| E3 — Kırılım / Pareto | Hat/vardiya/neden bazında dağılım | Sütun/bar; doğru grafik seçimi |
| E4 — Detay / Aksiyon | Tablo + durum sütunları | Yoğunluk + okunabilirlik dengesi |

## 5. Çıktı Kuralları

- En az **4 ekran**.
- **Ayrık veri katmanı** (veri koda gömülmez).
- Her ekranda **boş / hata / yüklenme** durumları zorunludur.
- Kalıcı talimat kuralları (₺ biçimi, Türkçe etiket, erişilebilirlik) uygulanır.

> ⚠️ Standart tanımlanıp hiç uygulanmamışsa **dekoratiftir** ve cezalandırılır.
> `transcripts/tur-B.md` çıktısında bu standardın uygulandığı (renk/anatomi/grafik)
> açıkça görülmelidir.
