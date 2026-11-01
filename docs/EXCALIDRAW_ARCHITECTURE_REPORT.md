# Excalidraw Mimari ve Çalışma Mantığı Analiz Raporu (Reverse Engineering & Architecture Report)

**Hedef Sistem**: https://excalidraw.com/  
**Tersine Mühendislik Ortamı**: REA (Reverse Engineer Anything) CLI, Web Bundle Denetleyicisi, Kaynak Haritası Analizi (`index-DVAv9QEc.js.map`, 908 TypeScript modülü)  
**Tarih**: 2026-11-01  
**Durum**: Tamamlandı (R1 Kabul Kriteri)  

---

## 1. Yönetici Özeti ve Mimari Genel Bakış

Excalidraw, elle çizilmiş (hand-drawn / sketchy) organik çizim estetiğini modern vektörel veri yapılarıyla birleştiren, yüksek performanslı, istemci taraflı (client-side) ve uçtan uca şifrelenebilen bir sanal beyaz tahta uygulamasıdır.

Yapılan REA tersine mühendislik incelemesinde elde edilen temel mimari prensipler şunlardır:
1. **Üç Katmanlı Tuval Mimarisi (Three-Tier Layered Canvas Architecture)**: Tek bir ağır tuval veya binlerce DOM düğümü yerine, üst üste binen 3 bağımsız `<canvas>` katmanı (`StaticCanvas`, `NewElementCanvas`, `InteractiveCanvas`) ve bir metin düzenleme DOM katmanı kullanılır.
2. **İki Aşamalı Önbellekleme (Dual-Tier Caching)**:
   - `ShapeCache` (WeakMap): Rough.js tarafından üretilen matematiksel `Drawable` nesnelerini eleman referansına göre önbellekler. Değişmeyen elemanlar her karede sıfırdan hesaplanmaz.
   - `elementWithCanvasCache` (WeakMap): Bireysel elemanları izole edilmiş offscreen tuval bit eşlemlerine (offscreen canvas) rasterize ederek statik sahne çizimini doğrudan `ctx.drawImage` hızına ulaştırır.
3. **Deterministik El Çizimi Tohumu (Seed Stability)**: Her elemana atanan rastgele tamsayı `seed` değeri sayesinde, Rough.js çizgi titremeleri (jitter) kareler arasında deterministik kalır; çizim hareket ettirildiğinde şekil formunu kaybetmez.
4. **Çift Koordinat Sistemi**: Ekran (viewport/client) ve Sahne (scene/infinite canvas) koordinatları arasında dönüşüm sağlayan, odak noktası imleç olan logaritmik yakınlaştırma (zoom) ve kaydırma (pan) matematiği.
5. **Delta Tabanlı Geri Alma/Yineleme (Undo/Redo History)**: Her işlemde tüm sahneyi klonlamak yerine, sadece değişen eleman özelliklerinin farkını (`StoreDelta`) saklayan bellek dostu geçmiş mimarisi.
6. **Kendi Kendini Geri Yükleyen PNG/SVG Dışa Aktarma**: Çizim PNG olarak dışa aktarılırken, sahne JSON verisi `pako` ile sıkıştırılarak PNG'nin `tEXt` (`application/vnd.excalidraw+json`) meta veri bloğuna gömülür. Böylece görsel Excalidraw'a geri sürüklendiğinde düzenlenebilir vektörel çizim olarak açılır.

---

## 2. Üç Katmanlı Tuval Render Mimarisi

Excalidraw'ın 60/120 FPS akıcılığını sağlayan temel unsur, render sorumluluklarını birbirinden yalıtan çok katmanlı yapıdır:

```
┌────────────────────────────────────────────────────────┐
│  4. DOM Textarea Overlay (En Üst)                       │
│     - Çift tıklanan metin elemanı üzerinde aktif olur   │
│     - Canvas zoom ve açısına göre CSS matrix ile döner  │
├────────────────────────────────────────────────────────┤
│  3. InteractiveCanvas                                  │
│     - Seçim kutusu (bounding box) ve 8 boyutlandırma    │
│       tutamacı (resize handles)                         │
│     - Döndürme tutamacı (rotation handle)               │
│     - Nesne hizalama kılavuzları (snap lines)           │
│     - Uzak kullanıcı imleçleri ve lazer izi             │
├────────────────────────────────────────────────────────┤
│  2. NewElementCanvas                                   │
│     - Kullanıcının fareyi sürükleyerek o anda çizdiği   │
│       taslak eleman (dikdörtgen, çizgi, kalem vs.)     │
│     - Statik sahneyi kirletmeden 60/120 FPS render      │
├────────────────────────────────────────────────────────┤
│  1. StaticCanvas (En Alt)                              │
│     - Tuval arka plan rengi ve ızgara (grid)            │
│     - Kesinleşmiş (committed) tüm sahne elemanları      │
│     - Önceden oluşturulmuş offscreen bit eşlemlerini    │
│       (bitmaps) doğrudan blit eder                      │
└────────────────────────────────────────────────────────┘
```

### 2.1 Cihaz Piksel Oranı (devicePixelRatio) Ölçekleme
Retina ve yüksek DPI ekranlarda bulanıklığı önlemek için tuval tamponları (buffer) fiziksel piksel boyutunda ayarlanır, CSS boyutları ise mantıksal piksel olarak tutulur:
```typescript
canvas.width = rect.width * window.devicePixelRatio;
canvas.height = rect.height * window.devicePixelRatio;
canvas.style.width = `${rect.width}px`;
canvas.style.height = `${rect.height}px`;

const context = canvas.getContext("2d");
context.scale(window.devicePixelRatio, window.devicePixelRatio);
```

### 2.2 Piksel Izgarasına Oturtma (Sub-Pixel Snapping)
Döndürülmemiş (0°) veya 90° katları olan elemanların koordinatları `snapScrollToDevicePixels` ile cihaz piksel sınırına yuvarlanarak yarım piksellik anti-aliasing bulanıklığı ortadan kaldırılır.

---

## 3. Sahne ve Öğe Veri Modelleri (Scene & Element State)

Excalidraw sahnesi, değişmez (immutable) eleman dizilerinden ve merkezi bir `AppState` durumundan oluşur.

### 3.1 `ExcalidrawElement` Veri Yapısı
Her eleman `_ExcalidrawElementBase` temel arayüzünü uygular:
```typescript
export interface ExcalidrawElement {
  id: string;                         // Benzersiz eleman kimliği (nanoid)
  type:                               // Eleman türü ayracı
    | "rectangle"
    | "diamond"
    | "ellipse"
    | "line"
    | "arrow"
    | "freedraw"
    | "text"
    | "image";
  x: number;                          // Sahne koordinatlarında sol-üst X
  y: number;                          // Sahne koordinatlarında sol-üst Y
  width: number;                      // Sınırlayıcı kutu genişliği
  height: number;                     // Sınırlayıcı kutu yüksekliği
  angle: number;                      // Radyan cinsinden dönme açısı (0 - 2π)
  strokeColor: string;                // Kenar çizgisi rengi (#000000)
  backgroundColor: string;            // Dolgu rengi (hex veya "transparent")
  fillStyle:                          // Rough.js dolgu deseni
    | "solid"
    | "hachure"
    | "cross-hatch"
    | "zigzag";
  strokeWidth: number;                // Çizgi kalınlığı: 1 (ince), 2 (orta), 4 (kalın)
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;                  // Pürüzlülük/Organiklik: 0 (mimar), 1 (sanatçı), 2 (karikatürist)
  opacity: number;                    // Saydamlık yüzdesi (0 - 100)
  groupIds: readonly string[];        // Hiyerarşik grup kimlikleri
  roundness: { type: number; value?: number } | null; // Köşe yuvarlama
  seed: number;                       // Rough.js için sabit rassal tohum
  version: number;                    // Her geometrik güncellemede artan revizyon
  versionNonce: number;               // Eşzamanlı çakışma çözümü için rastgele sayı
  isDeleted: boolean;                 // Yumuşak silme (soft-delete) bayrağı
  updated: number;                    // Son güncelleme zaman damgası (UTC ms)
  
  // Çizgi, Ok ve Serbest Çizim için Noktalar:
  points?: readonly [number, number][]; // [ [0,0], [dx1,dy1], [dx2,dy2], ... ]
  
  // Metin Elemanı için Özel Alanlar:
  text?: string;
  fontSize?: number;
  fontFamily?: number;                // 1: Excalifont, 2: Nunito, 3: Comic Shanns
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  lineHeight?: number;
}
```

### 3.2 `AppState` Veri Yapısı
Kullanıcının tuval üzerindeki etkileşimli durumunu yönetir:
```typescript
export interface AppState {
  // Görünüm ve Kamera Durumu:
  zoom: { value: number };            // Yakınlaştırma çarpanı (0.1 ile 30 arası)
  scrollX: number;                    // Sahne X kaydırma ofseti
  scrollY: number;                    // Sahne Y kaydırma ofseti
  
  // Seçili Araç:
  activeTool: {
    type: "selection" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "eraser";
    locked: boolean;                  // Çizimden sonra aracı kilitle (seçime dönme)
  };
  
  // Varsayılan Eleman Stilleri:
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: "solid" | "hachure" | "cross-hatch" | "zigzag";
  currentItemStrokeWidth: number;
  currentItemStrokeStyle: "solid" | "dashed" | "dotted";
  currentItemRoughness: number;
  currentItemOpacity: number;
  
  // Seçim Durumu:
  selectedElementIds: Record<string, boolean>; // Hızlı O(1) arama sözlüğü
  draggingElement: ExcalidrawElement | null;
  resizingElement: ExcalidrawElement | null;
  editingElement: ExcalidrawElement | null;
  
  // Tuval Ayarları:
  viewBackgroundColor: string;        // Arka plan rengi (#ffffff, #121212)
  gridSize: number | null;            // Izgara boyutu (20px) veya null
  theme: "light" | "dark";
}
```

---

## 4. Koordinat Sistemi ve Dönüşüm Matematiği

Excalidraw, ekran pikselleri ile sonsuz 2B sahne düzlemi arasında deterministik bir dönüşüm matrisi çalıştırır.

### 4.1 Dönüşüm Formülleri
- **Ekrandan Sahneye (Screen $\rightarrow$ Scene)**:
  $$\text{sceneX} = \frac{\text{clientX} - \text{offsetLeft}}{\text{zoom}} - \text{scrollX}$$
  $$\text{sceneY} = \frac{\text{clientY} - \text{offsetTop}}{\text{zoom}} - \text{scrollY}$$

- **Sahneden Ekrana (Scene $\rightarrow$ Screen)**:
  $$\text{viewportX} = (\text{sceneX} + \text{scrollX}) \times \text{zoom} + \text{offsetLeft}$$
  $$\text{viewportY} = (\text{sceneY} + \text{scrollY}) \times \text{zoom} + \text{offsetTop}$$

### 4.2 İmleç Merkezli Odak Yakınlaştırma (Focal Zooming)
Kullanıcı fare tekerleğiyle yakınlaştırma yaptığında, imlecin altındaki sahne noktası sabit kalmalıdır:
```typescript
function calculateZoom({ newZoom, currentZoom, cursorX, cursorY, scrollX, scrollY }) {
  // İmlecin sahne koordinatı:
  const sceneX = cursorX / currentZoom - scrollX;
  const sceneY = cursorY / currentZoom - scrollY;
  
  // Yeni zoom ile aynı sahne noktasını imleç altında tutacak yeni scroll:
  const nextScrollX = cursorX / newZoom - sceneX;
  const nextScrollY = cursorY / newZoom - sceneY;
  
  return { zoom: newZoom, scrollX: nextScrollX, scrollY: nextScrollY };
}
```

---

## 5. Şekil Çizimi, Pürüzlülük (Rough.js) ve Serbest Çizim (Freehand)

### 5.1 Rough.js ile Elle Çizilmiş Şekil Üretimi
Geometrik şekiller (dikdörtgen, elips, baklava, çizgi, ok) `roughjs` kütüphanesinin `RoughGenerator` sınıfı ile oluşturulur:
- `generator.rectangle(x, y, width, height, options)`
- `generator.ellipse(cx, cy, width, height, options)`
- `generator.polygon(points, options)`

**Kritik Ayarlar**:
- `seed: element.seed` $\rightarrow$ Her render çağrısında aynı jitter üretilir.
- `roughness: element.roughness` $\rightarrow$ 0 olduğunda düz vektörel çizgi, 1 ve 2 olduğunda organik el çizimi.
- `bowing` $\rightarrow$ Çizgilerin kavisli kıvrılma katsayısı.
- `fillStyle`: `"hachure"` (çapraz tarama), `"solid"` (tam dolgu), `"zigzag"` (zikzak).

### 5.2 Serbest Çizim (Freehand / Pencil) ve Basınç Duyarlılığı
Kullanıcı fare veya stylus ile çizim yaparken:
1. Her işaretçi hareketinde `(x, y, pressure)` noktası kaydedilir.
2. `perfect-freehand` kütüphanesinin `getStroke(points, options)` algoritması çağrılır:
   - Basınç ve çizim hızına bağlı olarak çizginin kalınlığı dinamik olarak hesaplanır.
   - Algoritma, pürüzsüz bir dış hat poligonu (outline polygon) döndürür.
3. Bu dış hat noktaları, ardışık orta noktalar arasında ikinci dereceden Bézier eğrileri (`ctx.quadraticCurveTo`) kullanılarak pürüzsüzleştirilir ve `Path2D` nesnesine doldurulur (`ctx.fill()`).

---

## 6. Çarpışma Testi (Hit Testing) ve Seçim Mekanizması

Tuval üzerindeki bir tıklamanın hangi elemana ait olduğunu belirlemek iki aşamalı filtreleme ile yapılır:

### 6.1 Aşama 1: Geniş Aşama (Broadphase)
- Tıklanan nokta, döndürülmüş elemanın merkezine göre ters açıyla döndürülür:
  $$P' = \text{rotate}(P, -\text{angle}, \text{center})$$
- Döndürülmüş $P'$ noktasının, elemanın eksene paralel `[x, y, x + width, y + height]` sınırlayıcı kutusunda olup olmadığı kontrol edilir. Dışındaysa eleman elenir.

### 6.2 Aşama 2: Dar Aşama (Narrowphase)
- **Dolgu Alanı Varsa**: Işın atma (ray-casting / odd-parity) testi ile noktanın poligonun içinde olup olmadığına bakılır.
- **Yalnızca Çizgi Varsa**: Noktanın elemanın kenar çizgisine veya eğri parçalarına olan minimum Öklid mesafesi hesaplanır. Mesafe eşik değerinden (`threshold / zoom`) küçükse isabet kabul edilir.

### 6.3 Seçim ve 8 Noktalı Boyutlandırma Tutamaçları
Seçilen elemanların etrafına `InteractiveCanvas` katmanında 8 adet tutamaç (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`) ve 1 adet döndürme tutamacı yerleştirilir. Sürükleme yönüne göre elemanın `x, y, width, height` değerleri güncellenir; `Shift` tuşuna basıldığında en-boy oranı (aspect ratio) veya 15° açı kilitlemesi uygulanır.

---

## 7. Kalıcılık (Storage) ve Dışa Aktarma (Export)

1. **Yerel Depolama (LocalStorage)**:
   - Sahne elemanları ve `AppState` durumunun kritik alanları tarayıcının `localStorage` alanına 300ms debounce ile kaydedilir.
   - Sayfa yenilendiğinde çizim anında kaldığı yerden yüklenir.
2. **JSON Formatı (`.excalidraw`)**:
   - `type: "excalidraw"`, `version: 2`, `elements: [...]`, `appState: {...}` yapısında standart JSON dosyası olarak indirilir ve içeri aktarılabilir.
3. **Resim Dışa Aktarma (PNG / SVG)**:
   - Sahne elemanlarının ortak sınırlayıcı kutusu (`getCommonBounds`) hesaplanır.
   - Offscreen bir tuval oluşturulup sadece elemanların bulunduğu bölge istenen arka plan ve dolgu ile çizilerek PNG veri URL'si oluşturulur.
   - SVG için `roughjs/bin/svg` SVG oluşturucusu kullanılarak vektörel `<svg>` çıktısı üretilir.

---

## 8. Klon Uygulama (Excalidraw Clone) İçin Uygulama Yol Haritası

Bu rapordaki mimari bulgulara dayanarak, `~/teamwork_projects/excalidraw_clone` dizininde kişisel kullanım için geliştirilecek klon uygulamanın mimarisi şu modüllere ayrılacaktır:

1. **M1: Proje Çatısı, Bağımlılıklar ve Temel Tip Tanımları** (Vite + React + TypeScript + Rough.js + Perfect-Freehand).
2. **M2: Koordinat Sistemi, Kamera ve Çok Katmanlı Tuval Motoru** (Viewport $\leftrightarrow$ Scene dönüşümleri, zoom/pan, Static & Interactive Canvas).
3. **M3: Çizim Araçları ve Rough.js Şekil Motoru** (Dikdörtgen, Elips, Baklava, Çizgi, Ok, Kalem/Serbest Çizim, Metin).
4. **M4: Seçim, Çarpışma Testi, Taşıma ve Boyutlandırma** (Hit-testing, 8-tutamaçlı transform, silgi aracı).
5. **M5: Stil Paneli, Geri Alma/Yineleme (Undo/Redo) ve Kalıcılık** (Renk seçici, çizgi kalınlığı, LocalStorage auto-save, JSON/PNG export).
6. **M6: Uçtan Uca Doğrulama, Test Paketi ve Tarayıcı Doğrulaması**.
