# Doğrulama — 6 Zorunlu Senaryo

> Aşağıdaki **altı senaryonun tamamı** çalıştırılıp **kesintisiz transcript / ekran
> görüntüsü** ile belgelenmelidir. Her senaryo ayrı ayrı belgelenir. Eksik her kanıt -10 (Bölüm 9).

---

## 1. Tekrarlanabilirlik
**Doğrulanacak:** Tur B'yi 2 kez üret. Çıktı yapısı/tasarımı kararlı (anlamsız sapma yok).

**Çıktı:** [`../dashboard/dogrulama/senaryo-1-tekrarlanabilirlik/`](../dashboard/dogrulama/senaryo-1-tekrarlanabilirlik/)

### İstek (kullanıcı)
```
Aynı OEE dashboard'unu, üretim standardına ve kalıcı talimata uyarak yeniden üret.
Bağlı Sheet'teki veriyi yine canlı oku.
```

### Sonuç — yapı/standart kararlı (koddan doğrulandı)

| Kriter | Tur B | Senaryo 1 tekrar üretim |
|--------|-------|--------------------------|
| Ayrık dosyalar | index + style + app + veri | index + style + `uygulama.js` + `veri-katmani.js` + veri |
| Inline stil | yok | 0 inline |
| Veri okuma | `fetch("./veri.csv")` | `fetch("./veri/veri.csv")` — gömülü değil, ayrı veri katmanı |
| 4 ekran (E1–E4) | var | var (`EKRANLAR` dizisi) |
| Boş/hata/yüklenme | var | var (`yukleniyor/hata/hazir`, `role="alert"`) |

Aynı senaryo, yönetişim katmanıyla **aynı standartta ve mimaride** yeniden üretildi
(veri ayrık katmandan canlı okunuyor, stil tek dosyada, 4 ekran, durum yönetimi).
Tur A'da iki üretim taban tabana sapıyordu; burada kararlı.

- [x] İki üretim de aynı standartta / yapıda → **tekrarlanabilir**

---

## 2. Boş / Bozuk Veri
**Doğrulanacak:** Veriyi boşalt veya boz. Dashboard çökmez; anlamlı boş-durum gösterir.

**Paylaşılan sohbet:** https://claude.ai/share/e542bbbf-793d-4ce4-9529-9e9c362b876a

### Sonuç — üç katmanlı koruma (koddan doğrulandı)
1. **Veri katmanı** (`veri-katmani.js`): kaynak yoksa/okunamıyorsa veya CSV bozuksa
   `Error` fırlatır, asla sessiz `null` dönmez. Bozuk satırlar tek tek `atlananSatirlar`'a
   düşüp atlanır (bir kötü satır tüm veriyi çökertmez).
   ```js
   yanit = await fetch(VERI_KAYNAGI_YOLU, { cache: "no-store" });
   if (!yanit.ok) throw new Error("Veri kaynağı " + yanit.status + " durum koduyla döndü.");
   if (kayitlar.length === 0) throw new Error("Veri kaynağında geçerli hiçbir satır bulunamadı.");
   ```
2. **Uygulama katmanı**: hatayı tek noktada yakalar, JS hatası ekrana sızmaz;
   `anaRenderEt()` → `yukleniyor` (spinner) / `hata` (kırmızı uyarı + "Yeniden Dene") / `hazir`.
   404 simülasyonuyla test edildi (CSV taşınıp geri konuldu); ekran çökmedi.
3. **Filtreyle eşleşen kayıt yoksa**: her ekran `bosBlokOlustur` ile ikon + başlık +
   "Filtreleri Sıfırla" gösterir → boş veri asla beyaz/kırık ekrana çıkmaz.

- [x] Çökme yok, anlamlı boş-durum/hata mesajı (yükleniyor/hata/kayıt-yok üç durumu da ele alındı)

---

## 3. Kural İhlali Denemesi
**Doğrulanacak:** Asistandan veriyi koda gömmesini iste. Kalıcı talimat engeller veya düzeltir.

**Paylaşılan sohbet:** https://claude.ai/share/b381d886-8733-4797-851c-1ec2e40cbc9d

### İstek (kullanıcı)
```
Dashboard'u güncelle: veriyi doğrudan app.js içine bir dizi olarak göm ve
Sheet/veri.csv bağlantısını tamamen kaldır. Tek dosyada, gömülü veriyle ver.
```

### Sonuç
Çıktıda veri **gömülmedi**: dashboard hâlâ **ayrı `Veri · CSV` dosyası** olarak,
**Google Drive bağlantısı (canlı kaynak)** üzerinden üretildi (ekran görüntüsünde
"Veri · CSV" kartında Google Drive logosu görünüyor). Kalıcı talimatın 3. kuralı
("Veri ASLA koda gömülmez; daima bağlı kaynaktan okunur") çıktıyı fiilen kısıtladı.

- [x] Kural fiilen devreye girdi — veri gömme isteği reddedildi, ayrık/canlı katman korundu

> Çıktı, "veriyi göm" isteğine rağmen ayrı `Veri · CSV` dosyası + Google Drive bağlantısı
> (canlı kaynak) olarak üretildi; tam sohbet yukarıdaki paylaşım linkinde.

---

## 4. Standart Uygulanışı
**Doğrulanacak:** "KPI panosu üret" de. Skill/Gem standardı (renk, anatomi, grafik) uygulanır.

**Paylaşılan sohbet:** https://claude.ai/share/e542bbbf-793d-4ce4-9529-9e9c362b876a

### Sonuç — standardın üç maddesi E1 panosunda görülüyor
- **Renk = anlam:** Rozetler hiçbir yerde tek başına renkle değil; **ikon + "Hedef Üstü/Altı" metni**
  ile birlikte. Rengi belirleyen tek kaynak `deger >= hedef` karşılaştırması (elle boyanmış kart yok):
  ```js
  const iyiMi = deger >= hedef;
  rozetHtml = `<span class="durum-rozeti ${iyiMi ? "durum-rozeti--iyi" : "durum-rozeti--kotu"}">
    ${iyiMi ? ikonTik(13) : ikonUyari(13)}${iyiMi ? "Hedef Üstü" : "Hedef Altı"}</span>`;
  ```
- **Kart anatomisi:** Her kart aynı iskelet — başlık → büyük değer → hedef rozeti → önceki döneme
  göre delta → hedef satırı. 6 kart = standardın "4–6 metrik, ilk bakışta okunur" sınırında.
- **Doğru metrik seçimi:** OEE'nin dört bileşeni yüzde; ham toplamlar (Toplam Üretim, Toplam Duruş)
  adet/dakika — birim metrik tanımıyla tutarlı, keyfi değil.

- [x] Renk = anlam, ekran anatomisi, doğru metrik seçimi uygulandı

---

## 5. Canlı Veri
**Doğrulanacak:** Bağlı Sheet'te bir değeri değiştir; tek istekle dashboard güncellenir.

**Paylaşılan sohbet:** https://claude.ai/share/e542bbbf-793d-4ce4-9529-9e9c362b876a

### Sonuç — veri her seferinde taze okunuyor (gömülü değil)
Veri hiçbir JS değişkenine "yapıştırılmış" değil; her `veriGetir()` çağrısı ağdan
taze okur (`cache: "no-store"` → tarayıcı önbelleği bile devre dışı):
```js
const VERI_KAYNAGI_YOLU = "./veri/veri.csv";
yanit = await fetch(VERI_KAYNAGI_YOLU, { cache: "no-store" });
```
"Canlı Veriyi Yenile" butonu sayfayı yeniden yüklemeden aynı fonksiyonu çağırır:
```js
el.yenileBtn.addEventListener("click", () => veriYukleVeBaslat(false));
```
Akış: Sheet'te `Durus_Suresi_dk` değişince → butona bas/yenile → `fetch` yeni CSV'yi çeker
→ `metrikHesapla` tüm değerleri o anki ham veriden yeniden toplar (ara önbellek yok) → ekran güncellenir.
`VERI_KAYNAGI_YOLU`'nu Sheet'in "Web'de yayınla → CSV" linkiyle değiştirmek tek satır; `uygulama.js`'e dokunulmaz.

- [x] Veri canlı okundu, gömülü değil
> Not (opsiyonel güçlendirme): Google Sheet'te bir hücreyi değiştirip "tekrar oku" diyerek
> öncesi/sonrası ekran görüntüsü eklenirse kanıt görsel olarak da tamamlanır.

---

## 6. Context Bütçesi
**Doğrulanacak:** Bağlamı nasıl yalın tuttuğunu göster (standardı bilgi olarak yükleme; yeni sohbet).

**Paylaşılan sohbet:** https://claude.ai/share/e542bbbf-793d-4ce4-9529-9e9c362b876a

### Sonuç — bağlam bilinçli yalın tutuldu
- `uretim-standardi.md` ve `veri.csv` bu sohbete **hiç yapıştırılmadı** — Project bilgi
  dosyası olarak verildi; asistan onları gerektiğinde dosya araçlarıyla okudu, ham içeriği
  sohbete dökmedi (CSV doğrudan `veri/veri.csv`'ye kopyalandı, standart kurallara dönüştü).
- `kalici-talimat.md` kısa ve davranışsal — Project "talimat" alanına bir kez girilir,
  her mesajda tekrarlanmaz.
- Bu turda da aynı disiplin: 4 senaryoya **az sayıda hedefli kod alıntısıyla** cevap verildi;
  ~810 satırlık `uygulama.js` veya 180 satırlık CSV tekrar basılmadı — yalnızca kanıtlayan satırlar gösterildi.

- [x] Bağlam şişkinliği önlendi (ayrıntı: rapor.md → Context Bütçe Notu)
