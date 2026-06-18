# VALEO × AdAstra — Ödev #1: Yönetişimli Dashboard Üretim Hattı

> Kurumsal Yapay Zekâ Yetkinlik Programı · Ara Dönem · Saha Uygulaması
> Teslim: GitHub · Teslim Tarihi: 18.06.2026 – 23:59

Bu depo, aynı dashboard'u **her seferinde aynı standartta, kurallı ve tekrarlanabilir**
biçimde üreten bir **üretim hattı** (yönetişim katmanı) kurmayı amaçlar. Değerlendirilen
çıktı (dashboard) değil, çıktıyı üreten **yapılandırmadır**: asistan kabı (Project/Gem),
kalıcı talimatlar, üretim standardı (Skill/Gem) ve canlı veri bağlantısı.

---

## 1. Genel Bilgiler

| Alan | Değer |
|------|-------|
| **Ad-Soyad** | **Yaşar KISA** |
| **Ekip** | **After-Market** |
| **Seçilen Araç** | **Claude (claude.ai)** |
| **Seçilen Senaryo** | **S1 — Hat Verimi & OEE Panosu** |
| **Hedef Persona** | Üretim Müdürü |

> Aşağıdaki şablon **S1 (OEE)** senaryosuna göre hazırlanmıştır. Farklı bir senaryo
> seçerseniz `veri/` ve standart metnindeki metrikleri ona göre uyarlayın.

---

## 2. Senaryo & Persona

**Senaryo:** S1 — Hat Verimi & OEE Panosu
**Persona:** Üretim Müdürü — vardiya ve hat bazında verimliliği tek ekranda görüp
duruş kayıplarını hızlıca tespit etmek ister.

**Panonun cevapladığı 3 soru:**
1. Hangi hat / vardiya OEE hedefinin altında kalıyor?
2. Toplam duruş süresinin başlıca nedenleri neler (Pareto)?
3. OEE trendi son dönemde iyileşiyor mu, kötüleşiyor mu?

---

## 3. Depo Yapısı

```
.
├── README.md                      # bu dosya (senaryo, araç, persona, sohbet linkleri)
├── talimatlar/
│   ├── kalici-talimat.md          # Project/Gem kalıcı talimat metni (Rule'lar)
│   └── uretim-standardi.md        # Skill/Gem üretim standardı (tasarım + anatomi + grafik)
├── veri/
│   └── veri.csv                   # sentetik veri (canlı bağlantı için Sheets'e de yüklenir)
├── dashboard/                     # üretilen çıktı (HTML/JS) — Tur B çıktısı
├── transcripts/
│   ├── tur-A.md                   # donatımsız tur oturum kaydı
│   ├── tur-B.md                   # donatılmış tur oturum kaydı
│   └── dogrulama.md               # 6 zorunlu doğrulama senaryosu
├── ekran-goruntuleri/             # Connector bağlantısı, talimat ekranı, standart uygulanışı
└── rapor.md                       # Bölüm 8 raporu (PDF'e çevrilip rapor.pdf olarak da eklenir)
```

---

## 4. Paylaşılan Sohbet Linkleri

> ⚠️ Transcript / paylaşılan sohbet linki olmayan teslim **değerlendirilmez**.
> Linkler erişime açık olmalıdır.

| Tur | Açıklama | Link |
|-----|----------|------|
| Tur A | Donatımsız (boş sohbet) | https://claude.ai/share/1b3ba858-ff98-49dc-ad40-c5b779fe6f08 |
| Tur B | Donatılmış (tam yönetişim) | Çıktı + kanıt: `dashboard/tur-B/` ve `transcripts/tur-B.md` (üretim sohbeti Project içi; çıktı dosyaları + ekran görüntüleriyle belgelendi) |
| Doğrulama (Senaryo 3 — kural ihlali) | Veri gömme reddi testi | https://claude.ai/share/b381d886-8733-4797-851c-1ec2e40cbc9d |
| Doğrulama (DS2 / DS4 / DS5 / DS6) | Boş veri, standart, canlı veri, context | https://claude.ai/share/e542bbbf-793d-4ce4-9529-9e9c362b876a |

---

## 5. Kanıt Dizini

| Kanıt | Nerede | Durum |
|-------|--------|-------|
| Standart uygulandı | `transcripts/tur-B.md` + `dashboard/tur-B/` | ✅ |
| Kural etkin | `transcripts/dogrulama.md` (Senaryo 3) | ✅ |
| Canlı veri | `ekran-goruntuleri/01,04` + `transcripts/tur-B.md` | ✅ |
| Bağlam yalın (Context notu) | `rapor.md` (Bölüm 3) + `dogrulama.md` (DS6) | ✅ |
| Tekrar kararlı | `transcripts/dogrulama.md` (Senaryo 1) | ✅ |
| Paylaşılan sohbet | bu README (3 link) | ✅ |

---

## 6. Notlar

- **Gerçek / gizli VALEO verisi kullanılmaz.** `veri/veri.csv` tamamen sentetiktir.
- Veri **koda gömülmez**; her zaman bağlı kaynaktan (Sheets/dosya) okunur.
- Transcript'ler **kesintisiz** olmalıdır (istekten çıktıya kadar). Düzenlenmiş /
  kırpılmış transcript kanıt sayılmaz.
