# VALEO Üretim OEE Panosu

OEE (Genel Ekipman Etkinliği) panosu — `uretim-standardi.md` ve `kalici-talimat.md`
kurallarına göre yeniden üretildi. Bu sürümde önceki sürümden farklı olarak
**ayrık veri katmanı**, **tek tasarım sistemi dosyası** ve **dört eksiksiz ekran**
zorunlu tutuldu; aşağıda her kuralın çıktıda nerede karşılığı olduğu satır satır
gösteriliyor (bkz. "Kuralların Etkisi" bölümleri).

## Çalıştırma

Tarayıcılar, güvenlik nedeniyle `file://` üzerinden açılan sayfalardan yerel CSV
dosyası okumaya (fetch) izin vermez — bu, kodun bir kusuru değil, tarayıcı kısıtıdır
ve gerçek bir üretim ortamında veri zaten bir web sunucusu veya Google Sheets API
üzerinden geleceği için sorun yaratmaz. Bu klasörü yerelde denemek için:

```bash
cd oee-pano
python3 -m http.server 8000
# tarayıcıda: http://localhost:8000/
```

İstenirse Node ile `npx serve` de kullanılabilir. `index.html`'i çift tıklayarak
açmak "Veri kaynağına ulaşılamadı" hata ekranını tetikler — bu da hata durumunun
gerçekten çalıştığının bir kanıtıdır.

## Dosya yapısı

```
oee-pano/
├── index.html          → sadece HTML iskeleti, sıfır inline stil/script
├── style.css            → TEK tasarım sistemi dosyası (renk/tipografi/boşluk)
├── js/
│   ├── veri-katmani.js  → veriyi okur/ayrıştırır/doğrular — tek veri kapısı
│   └── uygulama.js      → render, filtre, sıralama, durum yönetimi
└── veri/
    └── veri.csv         → bağlı veri kaynağı (gerçek kuruluma göre bir Google
                            Sheet'in yayımlanmış CSV bağlantısıyla değiştirilebilir)
```

## Kalıcı talimat → kod eşleştirmesi

| # | Kural | Karşılığı |
|---|---|---|
| 1 | Para biçimi (₺, nokta/virgül) | Veri setinde parasal alan yok, bu yüzden görünürde tetiklenmiyor. `sayiFormat`/`Intl.NumberFormat('tr-TR')` zaten nokta/virgül kuralını genel sayı biçimlemesine de uyguluyor; parasal bir KPI eklenirse aynı yardımcılar `" TL"` ekiyle kullanılabilir. |
| 2 | Türkçe etiketler, yuvarlanmış sayılar, ham veri değişmez | Tüm başlık/etiketler Türkçe. `adetFormatla/yuzdeMetni/dakikaMetni` sadece **gösterimde** yuvarlar; toplama/oran hesapları tam hassasiyetle yapılır (`uygulama.js` → `metrikHesapla`). |
| 3 | Veri koda gömülmez | `veri-katmani.js` tek veri kapısıdır; hiçbir JS dosyasında üretim rakamı yok. Hat/Vardiya filtre seçenekleri de elle yazılmadı, yüklenen veriden türetiliyor (`filtreCubuguGuncelle`) — kaynağa yeni bir hat eklenirse arayüz otomatik uyum sağlar. |
| 4 | Inline CSS/script yasak | `index.html` içinde `style=` veya `onclick=` **yok**; tüm görsel kural `style.css`'te, tüm davranış `js/*.js` dosyalarında, olaylar `addEventListener` ile bağlanıyor. |
| 5 | WCAG AA, renk tek başına anlam taşımaz | Tüm metin/zemin kombinasyonları axe-core ile denetlendi (0 ihlal — bkz. aşağıdaki "Doğrulama" bölümü). Her durum rozetinde ikon + metin birlikte; trend çizgileri renk dışında çizgi deseniyle de (düz/kesikli/noktalı) ayrışıyor. |
| 6 | Boş/hata/yükleniyor durumları | Her ekran filtre sonucu boşsa kendi boş-durum bloğunu gösterir; veri çekme başarısızsa tüm ekranların üstüne tek bir hata katmanı + "Yeniden Dene" butonu biner; ilk yüklemede spinner + açıklama metni görünür. |
| 7 | Tarih GG.AA.YYYY, tutarlı birimler | Tüm tarihler `tarihFormatla()` ile GG.AA.YYYY üretir. Not: tarayıcının yerleşik `<input type="date">` takvim kontrolünün **görsel** biçimi işletim sistemi/tarayıcı diline bağlıdır (bu web platformlarının genel bir kısıtıdır); bu nedenle giriş kutusunun yanına, tarayıcı dilinden bağımsız olarak her zaman GG.AA.YYYY üreten küçük bir etiket eklendi. |

## Üretim standardı → kod eşleştirmesi

- **Renk = anlam:** `--renk-mavi` (mevcut dönem), `--renk-gri` (önceki dönem),
  `--renk-yesil` (hedef üstü), `--renk-kirmizi` (hedef altı) — `style.css` kök
  değişkenleri. Hiçbir yerde başka bir anlam için kullanılmıyor.
- **Dekorasyon yok:** Kodda `box-shadow`, `gradient` veya 3B efekt yok; yüzeyler
  düz, ayrım ince kenarlıkla yapılıyor.
- **Ekran anatomisi:** Header → filtre çubuğu → (KPI/grafik) gövde sırası `index.html`
  iskeletinde birebir uygulanıyor.
- **Dört ekran:** E1 Özet (KPI kartları), E2 Trend (çizgi grafik, dönem karşılaştırma),
  E3 Kırılım (Pareto/bar, Hat-Vardiya-Neden boyutları arasında geçiş), E4 Detay
  (sıralanabilir tablo + durum rozetleri).
- **Grafik seçimi:** Zaman serisi → çizgi (E2); kategori karşılaştırma → bar (E3).
  Pasta/funnel grafiği gerektiren bir veri (dönüşüm aşaması, 2-3 parçalık pay)
  bu veri setinde yok, bu yüzden kullanılmadı.
- **"No-scroll":** Header/filtre/sekme sabit; içerik alanı taşarsa yalnızca kendi
  içinde kaydırır (örn. E4 tablosu en fazla 480px, kendi içinde kaydırılır).
  10 sütunlu yoğun bir tabloyu küçük ekranlarda hiç kaydırmadan sığdırmak
  gerçekçi değildir; bu, en iyi çaba (best-effort) ilkesiyle uygulandı.

## Hedef değerler hakkında not

`uygulama.js` içindeki `HEDEFLER` nesnesi (OEE %75, Kullanılabilirlik %85,
Performans %90, Kalite %98) **ölçülen veri değildir** — panonun karşılaştırma
için kullandığı, sektörde yaygın referans eşiklerdir. Gerçek kurum hedefleri
farklıysa bu tek nesne güncellenir; arayüzün hiçbir yerinde hedef, ham veriymiş
gibi sunulmaz, her yerde "Hedef" etiketiyle birlikte gösterilir.

## Google Sheet'e bağlama

Kalıcı talimat, kaynağı "Google Sheet / `veri/veri.csv`" olarak tanımlıyor.
Bu sürüm ikincisini kullanıyor. Bir Google Sheet'e geçmek için tek değişiklik
`js/veri-katmani.js` içindeki `VERI_KAYNAGI_YOLU` sabitini, sayfanın
"Web'de yayınla → CSV" bağlantısıyla değiştirmektir; sunum katmanında (`uygulama.js`)
hiçbir değişiklik gerekmez — bu, veri katmanının gerçekten ayrıştırılmış
olduğunun doğrudan kanıtıdır.

## Doğrulama (bu teslim için yapılan testler)

- **Hesap doğruluğu:** OEE/Kullanılabilirlik/Performans/Kalite formülleri,
  veri setinin tamamı üzerinde pandas ile bağımsız olarak hesaplanıp
  uygulamanın sonuçlarıyla karşılaştırıldı (eşleşti).
- **Fonksiyonel test:** Playwright ile gerçek bir tarayıcıda dört ekran,
  filtreleme, sıralama, dönem karşılaştırma, "Canlı Veriyi Yenile" ve hata/
  boş durum senaryoları otomatik olarak çalıştırıldı; konsolda hata yok.
- **Erişilebilirlik:** axe-core ile WCAG 2.0 A/AA ve 2.1 AA kontrolü dört
  ekranda da **0 ihlal** sonucunu verdi.
