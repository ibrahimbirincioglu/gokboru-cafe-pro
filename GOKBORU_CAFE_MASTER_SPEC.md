# GÖKBÖRÜ CAFE
## Profesyonel Web Sitesi, QR Menü, Masa Sipariş, Kasa, Mutfak ve Ciro Yönetim Sistemi

> **Proje adı:** Gökbörü Cafe  
> **Belge türü:** Ürün gereksinimleri + teknik mimari + geliştirme planı  
> **Hedef:** Halka açık modern kafe sitesi ile işletme içi sipariş/kasa sistemini tek projede birleştirmek  
> **Hedef cihazlar:** Telefon, tablet, masaüstü bilgisayar ve büyük mutfak ekranı  
> **Ana teknoloji:** Next.js + TypeScript + Prisma + PostgreSQL + WebSocket  
> **Varsayılan işletme saat dilimi:** Europe/Istanbul  
> **Belge sürümü:** 1.0

---

# 1. Codex İçin Ana Talimat

Bu belgeyi projenin ana gereksinim kaynağı olarak kullan.

Mevcut proje varsa sıfırdan yeni proje oluşturma. Önce mevcut kodu, Prisma şemasını, `server.ts` dosyasını, WebSocket yapısını, environment değişkenlerini ve çalışan özellikleri incele. Çalışan kodu koru; yalnızca gerekli yerlerde güvenli migration ve refactor yap.

Bilinen mevcut yapı:

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL
- `server.ts` üzerinden Next.js ve `/ws` WebSocket sunucusu
- Mevcut roller: `ADMIN`, `STAFF`
- Mevcut sipariş durumları:
  - `BEKLIYOR`
  - `ONAYLANDI`
  - `HAZIRLANIYOR`
  - `HAZIR`
  - `TAMAMLANDI`
  - `IPTAL`
- Mevcut ödeme tipleri:
  - `NAKIT`
  - `KREDI_KARTI`
- Mevcut ana modeller:
  - `User`
  - `Category`
  - `Product`
  - `Table`
  - `Order`
  - `OrderItem`
  - `Payment`

Her geliştirme aşamasında:

1. İlgili mevcut kodu incele.
2. Eksik veya riskli alanları listele.
3. Küçük ve test edilebilir bir plan yaz.
4. Yalnızca o aşamanın kapsamını uygula.
5. Veritabanı değişikliklerini Prisma migration ile yap.
6. Format, lint, TypeScript type-check, test ve production build çalıştır.
7. Başarısız test veya build varsa görevi tamamlanmış sayma.
8. Gizli anahtarları kaynak koda ekleme.
9. Gerçek üretim verisini silen komut çalıştırma.
10. `prisma migrate reset` komutunu üretim veritabanında kullanma.
11. Sahte buton, boş ekran veya çalışmayan özellik bırakma.
12. Her kritik işlem için anlaşılır hata mesajı göster.
13. Para hesaplarında JavaScript `number` veya `float` kullanma; `Decimal` kullan.
14. Sipariş kapatma ve ödeme işlemlerini tek veritabanı transaction’ı içinde yap.
15. Kullanıcı yetkisini yalnızca arayüzde değil, her sunucu isteğinde doğrula.
16. WebSocket bağlantılarında kimlik doğrulama, heartbeat ve yeniden bağlanma uygula.
17. Mevcut uygulamayı bozacak büyük değişiklikleri tek committe yapma.
18. Her görev sonunda değişen dosyaları, testleri, bilinen eksikleri ve sonraki adımı raporla.

---

# 2. Ürün Tanımı

Gökbörü Cafe sistemi iki ana parçadan oluşur:

## 2.1 Halka Açık Kafe Web Sitesi

Kafeyi tanıtan modern, hızlı, mobil uyumlu ve arama motorlarında bulunabilir bir web sitesi.

İçerikler:

- Ana sayfa
- Kafe tanıtımı
- Fotoğraf galerisi
- Kısa tanıtım videosu
- Menü önizlemesi
- Okey, nargile, hamburger, gözleme, sıcak-soğuk içecek gibi hizmetler
- Adres
- Harita
- Yol tarifi
- Telefon
- WhatsApp
- Instagram
- Çalışma saatleri
- Kampanyalar
- Duyurular
- Sık sorulan sorular
- Gizlilik ve çerez bilgileri

## 2.2 İşletme Yönetim Sistemi

Kafe çalışanlarının kullandığı profesyonel panel.

Ana modüller:

- Masalar
- QR kodlar
- Müşteri menüsü
- Siparişler
- Kasa
- Mutfak ekranı
- Ürün ve kategori yönetimi
- Ciro
- Günlük, haftalık ve aylık rapor
- Sipariş geçmişi
- Kullanıcı ve rol yönetimi
- İptal ve iade
- Denetim kayıtları
- Ayarlar
- Yedekleme ve sistem sağlık ekranı

Bu sistem klasik bir tanıtım sitesi değildir. Küçük ölçekli restoran otomasyonu, QR sipariş sistemi, kasa ekranı ve mutfak sipariş ekranının birleşimidir.

---

# 3. Temel İş Kuralları

## 3.1 Başlangıç Masaları

İlk kurulumda otomatik olarak 20 masa oluştur:

```text
Masa 1
Masa 2
...
Masa 20
```

Her masanın:

- Benzersiz veritabanı kimliği
- Görünen masa numarası
- Masa adı
- Aktif/pasif durumu
- Benzersiz ve tahmin edilemez QR tokenı
- QR kod görseli
- Oluşturulma tarihi
- Son QR yenileme tarihi

bulunmalıdır.

Admin daha sonra:

- Yeni masa oluşturabilmeli
- Masa adını ve numarasını değiştirebilmeli
- Masayı geçici olarak pasife alabilmeli
- Masayı silebilmeli
- QR tokenını yenileyebilmeli
- Tek masanın QR kodunu indirebilmeli
- Tüm QR kodları yazdırılabilir PDF olarak indirebilmeli

Aktif sipariş veya açık masa oturumu bulunan masa doğrudan silinmemelidir. Önce açık oturum kapatılmalı veya masa yalnızca pasife alınmalıdır.

## 3.2 QR Bağlantısı

Örnek:

```text
https://gokborucafe.com/menu/t/7F3QmKp9x...
```

QR bağlantısında doğrudan `tableId=1` gibi kolay tahmin edilen bir değer kullanılmamalıdır.

QR tokenı:

- Kriptografik olarak güvenli
- Yeterince uzun
- Benzersiz
- Gerektiğinde iptal edilebilir
- QR yenilendiğinde eski token geçersiz
- URL içinde hassas işletme bilgisi taşımayan

bir değer olmalıdır.

## 3.3 Müşterinin Hesap Açmaması

Masadaki müşteri QR kodu okuttuğunda hesap açmak zorunda kalmamalıdır.

Sistem:

- Masayı QR tokenından belirler.
- Masanın aktif olduğunu doğrular.
- O tarayıcı için geçici bir anonim sipariş oturumu oluşturur.
- Müşteriye doğru masa adını gösterir.
- Başka masanın kimliğini URL değiştirerek seçmesine izin vermez.
- Aynı masadaki farklı telefonlardan sipariş verilmesine izin verir.
- Siparişlerin aynı açık masa oturumunda birleşmesini sağlar.

## 3.4 Açık Masa Oturumu

Masa ilk siparişi verdiğinde bir `TableSession` açılır.

Örnek:

```text
Masa 7
Oturum başlangıcı: 19:42
Durum: AÇIK
Toplam: 685,00 TL
Sipariş turu: 3
```

Aynı masa daha sonra yeni ürün eklediğinde yeni bir `Order` oluşturulur ancak aynı `TableSession` altında tutulur.

Örnek:

```text
Masa Oturumu #TS-2026-000147
  Sipariş #1: 2 çay + nargile
  Sipariş #2: hamburger + kola
  Sipariş #3: 1 çay
```

Kasada ödeme yapılırken masa oturumunun bütün açık siparişleri toplanır.

## 3.5 Masa Durumu

Masa durumu mümkün olduğunca açık oturumdan türetilmelidir.

Görünen durumlar:

```text
BOŞ
DOLU
YENİ SİPARİŞ
HAZIRLANIYOR
SERVİS BEKLİYOR
ÖDEME BEKLİYOR
TEMİZLİK
PASİF
```

İlk sürümde zorunlu:

- BOŞ
- DOLU
- YENİ SİPARİŞ
- HAZIRLANIYOR
- ÖDEME BEKLİYOR
- PASİF

Masa kapatılınca otomatik olarak BOŞ durumuna döner.

## 3.6 Siparişin Onaylanması

Müşteri sipariş gönderince:

1. Sipariş `BEKLIYOR` olur.
2. Admin/kasa/mutfak ekranında sesli ve görsel uyarı çıkar.
3. Yetkili çalışan siparişi onaylar.
4. Sipariş `ONAYLANDI` olur.
5. Hazırlanmaya başlandığında `HAZIRLANIYOR` olur.
6. Hazır olduğunda `HAZIR` olur.
7. Servis edildiğinde ürünlerin servis bilgisi kaydedilir.
8. Masa ödemesi tamamlanınca ilgili siparişler `TAMAMLANDI` olur.

Müşteri siparişi gönderdikten sonra ürün fiyatı değişse bile o siparişteki fiyat değişmemelidir. Her `OrderItem` ürün adının ve fiyatının sipariş anındaki kopyasını saklamalıdır.

## 3.7 Sipariş İptali

Sipariş veya ürün iptali için:

- Yetkili rol
- İptal nedeni
- İşlemi yapan kullanıcı
- İşlem zamanı
- Önceki tutar
- Yeni tutar
- Denetim kaydı

zorunlu olmalıdır.

Hazırlanmaya başlanmış ürünü müşteri kendi ekranından iptal edememelidir.

## 3.8 Ödeme ve Masa Kapatma

Kasiyer masa ekranından “Ödeme Al” dediğinde:

- Açık siparişler yeniden sunucudan okunur.
- Ödenecek toplam sunucuda hesaplanır.
- Ödeme yöntemi seçilir:
  - Nakit
  - Kredi kartı
  - Karma ödeme, ikinci aşamada
- Ödeme kaydı oluşturulur.
- Siparişler tamamlandı olarak işaretlenir.
- Masa oturumu kapanır.
- Masa boş duruma döner.
- İşlem günlük ciroya dahil edilir.
- WebSocket ile tüm açık paneller güncellenir.

Bu işlemlerin tamamı tek Prisma transaction’ında gerçekleşmelidir. Herhangi bir adım başarısızsa tamamı geri alınmalıdır.

Aynı “Ödeme Al” butonuna iki kez basılması çift ödeme oluşturmamalıdır. Idempotency anahtarı veya güvenli durum kontrolü kullanılmalıdır.

## 3.9 Ciro Mantığı

**Veritabanındaki günlük ciro sıfırlanmayacaktır.**

Saat 00:00 olduğunda önceki günün verisi silinmez veya sıfıra çekilmez. Dashboard yalnızca yeni işletme gününün verisini göstermeye başlar.

Örnek:

```text
28 Temmuz 2026 günlük ciro: 34.250,00 TL
29 Temmuz 2026 saat 00:00 sonrası günlük ciro: 0,00 TL
```

28 Temmuz verisi geçmişte kalır ve raporlardan her zaman görülebilir.

Günlük ciro:

- Siparişin verildiği güne göre değil
- Ödemenin başarıyla tamamlandığı işletme gününe göre

hesaplanmalıdır.

Varsayılan işletme günü kesim saati:

```text
00:00 Europe/Istanbul
```

Bu değer sistem ayarlarında ileride değiştirilebilir olmalıdır.

## 3.10 Para Hesabı

Tüm para alanları:

```text
Decimal @db.Decimal(12, 2)
```

veya eşdeğer kesin sayısal tür kullanmalıdır.

`float`, `double` veya JavaScript kayan noktalı para toplama kullanılmamalıdır.

---

# 4. Kullanıcı Rolleri

Başlangıç rolleri:

## 4.1 OWNER

- Tüm yetkiler
- Ciro ve kâr raporları
- Kullanıcı oluşturma
- Rol verme
- Sistem ayarları
- İade ve geçmiş düzenleme
- Denetim kayıtları
- Yedekleme

## 4.2 ADMIN

- Menü yönetimi
- Masa ve QR yönetimi
- Sipariş yönetimi
- Kasa
- Raporlar
- Personel görüntüleme
- Sistem ayarlarının sınırlı bölümü

## 4.3 CASHIER

- Masa görüntüleme
- Sipariş ekleme
- Ödeme alma
- Masa kapatma
- Fiş görüntüleme
- Günlük ödeme özeti
- Yetkisi varsa indirim

## 4.4 KITCHEN

- Yeni siparişleri görme
- Siparişi hazırlamaya alma
- Hazır işaretleme
- Ürün müsaitlik durumunu geçici kapatma
- Ciroyu görememe
- Ödeme alamama

## 4.5 WAITER

- Masaları görme
- Masa adına sipariş girme
- Sipariş ekleme
- Servis edildi işaretleme
- Ödeme talebi oluşturma
- Ciro raporlarını görememe
- Menü fiyatı değiştirememe

Mevcut `ADMIN` ve `STAFF` rolleri veri kaybetmeden migration ile genişletilmelidir.

Yetkilendirme her API ve Server Action isteğinde doğrulanmalıdır. Yalnızca menü butonunu gizlemek güvenlik değildir.

---

# 5. Halka Açık Web Sitesi

## 5.1 Ana Sayfa

Bölümler:

1. Üst navigasyon
2. Büyük hero görseli veya kısa sessiz video
3. Gökbörü Cafe başlık ve sloganı
4. Menüye göz at butonu
5. Yol tarifi butonu
6. Kafe hakkında kısa tanıtım
7. Öne çıkan ürünler
8. Okey alanı
9. Nargile bölümü
10. Hamburger, gözleme ve yiyecekler
11. Fotoğraf galerisi
12. Kampanya veya etkinlik
13. Müşteri yorumları, doğrulanmış kaynak varsa
14. Çalışma saatleri
15. Harita
16. Telefon, WhatsApp ve Instagram
17. Alt bilgi

## 5.2 Ana Sayfa Tasarım Hedefi

- Gençlere hitap eden modern görünüm
- Karanlık lacivert, sıcak kahve ve doğal ahşap hissi
- Gösterişli ancak okunaklı
- Telefon ekranında hızlı
- Video yavaş bağlantıda görsel postere düşmeli
- Gereksiz animasyon kullanılmamalı
- Menü ve yol tarifi en görünür iki eylem olmalı
- Kafe içindeki gerçek fotoğraflar kullanılmalı
- Sahte stok fotoğraf havasından kaçınılmalı

## 5.3 Genel Menü Sayfası

QR masaya bağlı olmayan ziyaretçiler de menüyü görebilir.

Fark:

- Normal menü sayfasında sipariş butonu gösterilmez.
- Masaya özel QR menüsünde sipariş verilebilir.

## 5.4 İçerik Yönetimi

Admin panelinden aşağıdakiler değiştirilebilmeli:

- Ana başlık
- Açıklama
- Hero görseli
- Hero videosu
- Hakkımızda metni
- Galeri
- Çalışma saatleri
- Adres
- Harita bağlantısı
- Telefon
- WhatsApp
- Instagram
- Kampanya
- Duyuru
- Ana sayfada gösterilecek ürünler
- SEO başlık ve açıklaması

---

# 6. QR Müşteri Menüsü

## 6.1 İlk Ekran

QR okutulunca:

```text
Gökbörü Cafe
Masa 7
Hoş geldiniz
```

Gösterilecek alanlar:

- Masa adı
- Kategori yatay menüsü
- Ürün arama
- Ürün fotoğrafı
- Ürün adı
- Açıklama
- Fiyat
- Müsaitlik
- Sepete ekle
- Mevcut sipariş durumu
- Garson çağır
- Hesap iste
- Dil seçimi, ikinci aşamada

## 6.2 Kategoriler

Örnek:

- Sıcak İçecekler
- Soğuk İçecekler
- Kahveler
- Nargile
- Hamburger
- Tost ve Sandviç
- Gözleme
- Atıştırmalıklar
- Tatlılar

Kategori sırası admin panelinden sürükle-bırak ile değiştirilebilmelidir.

## 6.3 Ürün

Her ürün:

- Ad
- Kısa açıklama
- Kategori
- Fotoğraf
- Fiyat
- İndirimli fiyat, varsa
- Aktif/pasif
- Geçici olarak tükendi
- Öne çıkan
- Hazırlama alanı:
  - BAR
  - MUTFAK
  - NARGILE
- Sıralama
- Alerjen bilgisi, varsa
- Seçenek grupları
- Not kabul etme durumu

## 6.4 Ürün Seçenekleri

Örnek:

```text
Hamburger:
- Et pişme derecesi
- Ekstra peynir
- Soğansız
- Menüye çevir

Çay:
- Açık
- Normal
- Demli

Nargile:
- Aroma
- Lüle tipi
- Ek köz
```

Seçenekler fiyatı artırabilir veya değiştirebilir.

## 6.5 Sepet

Sepette:

- Ürün
- Adet
- Seçenekler
- Ürün notu
- Birim fiyat
- Ara toplam
- Sipariş toplamı
- Masa bilgisi
- Siparişi gönder

Sipariş gönderilirken:

- Sepet fiyatlarına istemciden güvenilmemeli.
- Sunucu ürünleri ve fiyatları tekrar okumalı.
- Pasif veya tükenmiş ürün reddedilmeli.
- Müşteriye hangi ürünün neden eklenemediği açıklanmalı.
- Aynı gönderimin iki kere sipariş oluşturması engellenmeli.

## 6.6 Sipariş Takibi

Müşteri şu durumları görebilmeli:

```text
Sipariş alındı
Onaylandı
Hazırlanıyor
Hazır
Servis edildi
```

İptal edilen ürün varsa nedeni gösterilmelidir.

## 6.7 Garson Çağır

Müşteri:

- Garson çağır
- Hesap iste
- Köz iste
- Masayı temizlet
- Diğer

talebi oluşturabilir.

Aynı talep kısa sürede sürekli gönderilememelidir. Aktif talep çözülmeden yenisi sınırlandırılmalıdır.

---

# 7. Admin Paneli

Ana rota:

```text
/admin
```

Admin paneli halka açık siteden görsel ve güvenlik olarak ayrılmalıdır.

## 7.1 Dashboard

Kartlar:

- Bugünkü ciro
- Bu haftaki ciro
- Bu ayki ciro
- Nakit toplamı
- Kart toplamı
- Açık masa sayısı
- Bekleyen sipariş
- Hazırlanan sipariş
- Bugünkü iptal toplamı
- Ortalama masa hesabı
- En çok satan ürün
- Son siparişler

Grafikler:

- Saatlik ciro
- Son 7 gün ciro
- Ödeme yöntemi dağılımı
- Kategori satış dağılımı
- En çok satan ürünler
- En yoğun saatler

Dashboard verileri yalnızca yetkili rollere gösterilmelidir.

## 7.2 Masa Yönetimi

Grid görünümü:

```text
Masa 1  BOŞ
Masa 2  DOLU       420,00 TL
Masa 3  YENİ       185,00 TL
Masa 4  HAZIRLANIYOR
Masa 5  ÖDEME İSTİYOR
```

Her masa kartında:

- Masa adı
- Durum
- Açılış saati
- Geçen süre
- Açık toplam
- Son sipariş zamanı
- Yeni sipariş rozeti
- Hesap talebi rozeti

Masa detayı:

- Bütün sipariş turları
- Ürünler
- Durum
- Ürün ekle
- Ürün çıkar
- Not
- İndirim, yetkiliyse
- Sipariş iptal et
- Ödeme al
- Masa taşı, ikinci aşamada
- Masa birleştir, ikinci aşamada

## 7.3 Canlı Sipariş Ekranı

Kolonlar:

```text
BEKLEYEN
ONAYLANDI
HAZIRLANIYOR
HAZIR
```

Sipariş kartında:

- Sipariş numarası
- Masa
- Saat
- Geçen süre
- Ürünler
- Adet
- Seçenek
- Not
- Hazırlama alanı
- Durum butonları

Yeni sipariş:

- Sesli bildirim
- Görsel vurgu
- Tarayıcı bildirimi, izin varsa
- WebSocket ile gecikmeden düşmeli

## 7.4 Mutfak Ekranı

Rota:

```text
/kitchen
```

Özellikler:

- Tam ekran kullanılabilir
- Büyük yazı
- Dokunmatik ekrana uygun
- Yeni sipariş sesi
- Süre sayacı
- Hazırlama alanına göre filtre
- Siparişi hazırlamaya al
- Hazır işaretle
- Ürün bazında hazır işaretleme, ikinci aşamada
- Ciro ve ödeme bilgisi göstermez
- Mutfak rolü dışında erişim engellenir

## 7.5 Kasa Ekranı

Rota:

```text
/pos
```

Özellikler:

- Açık masalar
- Masa arama
- Sipariş özeti
- Ürün ekleme
- Adet değiştirme
- Yetkili iptal
- İndirim
- Ödeme yöntemi
- Ödeme alma
- Masa kapatma
- Fiş görünümü
- Son işlemi görme
- Yetkili iade

İlk sürümde gerçek banka POS cihazı entegrasyonu zorunlu değildir. Kasiyer fiziksel POS’tan ödemeyi aldıktan sonra sistemde `KREDI_KARTI` seçer.

## 7.6 Menü Yönetimi

- Kategori oluştur
- Kategori düzenle
- Sıralama
- Ürün oluştur
- Fotoğraf yükle
- Fiyat güncelle
- Geçici tükendi
- Aktif/pasif
- Seçenek grubu
- Hazırlama alanı
- Çoklu ürün güncelleme
- Değişiklik geçmişi

Fiyat değişikliği geçmiş siparişleri değiştirmemelidir.

## 7.7 QR ve Masa Yönetimi

- 20 başlangıç masası
- Masa ekle
- Masa düzenle
- Pasife al
- Sil
- QR yenile
- PNG indir
- SVG indir
- Tüm QR’ları PDF indir
- Baskı şablonu
- QR önizleme
- QR test et
- Son okutulma tarihi
- Geçersiz QR kayıtları

## 7.8 Sipariş Geçmişi

Filtreler:

- Tarih aralığı
- Saat
- Masa
- Sipariş numarası
- Ürün
- Kategori
- Durum
- Ödeme tipi
- İşlemi yapan çalışan
- İptal edilenler
- İade edilenler

Her geçmiş kaydında:

- Sipariş numarası
- Masa
- Masa oturumu
- Sipariş başlangıç zamanı
- Ödeme zamanı
- Ürünler
- Birim fiyatlar
- Seçenekler
- Notlar
- Ara toplam
- İndirim
- İptal
- Net toplam
- Ödeme tipi
- Kasiyer
- Sipariş durum geçmişi

Örnek kullanıcı isteği:

> “İki gün önce saat 21:15’te Masa 4 ne sipariş vermişti?”

Bu soru tarih, saat ve masa filtresiyle kolayca cevaplanabilmelidir.

## 7.9 Ciro ve Raporlar

Rapor dönemleri:

- Bugün
- Dün
- Bu hafta
- Geçen hafta
- Bu ay
- Geçen ay
- Özel tarih aralığı

Gösterilecek metrikler:

- Brüt satış
- İndirim
- İptal
- İade
- Net ciro
- Nakit
- Kart
- Karma ödeme, eklenirse
- Sipariş sayısı
- Kapanan masa sayısı
- Ortalama masa hesabı
- Ortalama ürün adedi
- En çok satan ürünler
- En az satan ürünler
- Kategori satışları
- Yoğun saatler
- Çalışan bazlı işlem
- İptal nedenleri

Dışa aktarım:

- CSV
- XLSX, ikinci aşamada
- Yazdırılabilir PDF, ikinci aşamada

## 7.10 Kullanıcı Yönetimi

- Kullanıcı oluştur
- Rol ver
- Aktif/pasif
- Şifre sıfırlama
- Son giriş
- Oturumu sonlandırma
- Yetki geçmişi
- İşlem geçmişi

## 7.11 Denetim Kaydı

Aşağıdaki kritik işlemler loglanmalı:

- Giriş
- Başarısız giriş
- Ürün fiyatı değişikliği
- Ürün silme/pasife alma
- Sipariş iptali
- Ürün iptali
- İndirim
- Ödeme
- İade
- Masa kapatma
- QR yenileme
- Kullanıcı rolü değişikliği
- Ayar değişikliği

Audit log değiştirilemez olmalıdır.

---

# 8. Sipariş Durum Makineleri

## 8.1 OrderStatus

Mevcut enum korunabilir:

```text
BEKLIYOR
ONAYLANDI
HAZIRLANIYOR
HAZIR
TAMAMLANDI
IPTAL
```

İzin verilen temel geçişler:

```text
BEKLIYOR -> ONAYLANDI
BEKLIYOR -> IPTAL
ONAYLANDI -> HAZIRLANIYOR
ONAYLANDI -> IPTAL
HAZIRLANIYOR -> HAZIR
HAZIRLANIYOR -> IPTAL, yalnızca yetkili ve neden ile
HAZIR -> TAMAMLANDI
HAZIR -> IPTAL, yalnızca yüksek yetki ve neden ile
```

Geçersiz geçişler engellenmelidir.

Örnek:

```text
TAMAMLANDI -> BEKLIYOR
```

doğrudan yapılamaz.

## 8.2 TableSessionStatus

```text
OPEN
PAYMENT_REQUESTED
PAYMENT_PROCESSING
CLOSED
CANCELLED
```

## 8.3 PaymentStatus

```text
PENDING
COMPLETED
FAILED
REFUNDED
PARTIALLY_REFUNDED
VOIDED
```

## 8.4 ServiceRequestStatus

```text
OPEN
ACKNOWLEDGED
RESOLVED
CANCELLED
```

---

# 9. Önerilen Veritabanı Modeli

Mevcut modeller migration ile genişletilmelidir.

## 9.1 User

```text
id
name
username
email
passwordHash
role
isActive
lastLoginAt
createdAt
updatedAt
```

## 9.2 Category

```text
id
name
slug
description
imageUrl
sortOrder
isActive
createdAt
updatedAt
```

## 9.3 Product

```text
id
categoryId
name
slug
description
imageUrl
price Decimal
discountPrice Decimal?
prepStation
isActive
isAvailable
isFeatured
allowNote
sortOrder
createdAt
updatedAt
```

## 9.4 ProductOptionGroup

```text
id
productId
name
minSelect
maxSelect
required
sortOrder
```

## 9.5 ProductOption

```text
id
groupId
name
priceDelta Decimal
isActive
sortOrder
```

## 9.6 Table

Prisma model adı `Table` çakışma yaratmıyorsa korunabilir.

```text
id
number Int
name String
slug String
qrTokenHash String
qrTokenVersion Int
isActive Boolean
sortOrder Int
createdAt
updatedAt
deletedAt?
```

Ham QR tokenı veritabanında açık olarak saklanmak zorunda değildir. Hash saklama modeli değerlendirilsin.

## 9.7 AnonymousGuestSession

```text
id
tableId
browserTokenHash
expiresAt
lastSeenAt
createdAt
```

## 9.8 TableSession

```text
id
tableId
status
openedAt
paymentRequestedAt?
closedAt?
openedByUserId?
closedByUserId?
guestCount?
note?
businessDate Date
createdAt
updatedAt
```

Bir masada aynı anda yalnızca bir açık TableSession olmalıdır. Bu kural mümkünse veritabanı seviyesinde kısmi unique index ile desteklenmelidir.

## 9.9 Order

```text
id
orderNumber
tableSessionId
tableId
guestSessionId?
createdByUserId?
status
source: QR / CASHIER / WAITER
subtotal Decimal
discountTotal Decimal
cancelledTotal Decimal
total Decimal
customerNote?
acceptedAt?
preparingAt?
readyAt?
completedAt?
cancelledAt?
cancelReason?
createdAt
updatedAt
version Int
```

## 9.10 OrderItem

```text
id
orderId
productId?
productNameSnapshot
unitPriceSnapshot Decimal
quantity Int
lineSubtotal Decimal
note?
status
prepStation
cancelledQuantity Int
cancelReason?
createdAt
updatedAt
```

## 9.11 OrderItemOption

```text
id
orderItemId
optionId?
optionNameSnapshot
priceDeltaSnapshot Decimal
```

## 9.12 OrderStatusHistory

```text
id
orderId
fromStatus?
toStatus
changedByUserId?
source
note?
createdAt
```

## 9.13 Payment

```text
id
paymentNumber
tableSessionId
amount Decimal
paymentType
status
idempotencyKey Unique
receivedByUserId
businessDate Date
paidAt
refundedAmount Decimal
note?
createdAt
updatedAt
```

## 9.14 PaymentAllocation

İleride bölünmüş ödeme için:

```text
id
paymentId
orderId
amount Decimal
```

## 9.15 Discount

```text
id
tableSessionId?
orderId?
type: FIXED / PERCENT
value Decimal
amount Decimal
reason
approvedByUserId
createdAt
```

## 9.16 ServiceRequest

```text
id
tableSessionId
type
status
message?
createdAt
acknowledgedAt?
resolvedAt?
handledByUserId?
```

## 9.17 SiteContent

```text
id
key Unique
valueJson
updatedByUserId
updatedAt
```

## 9.18 MediaAsset

```text
id
kind
url
storageKey
mimeType
sizeBytes
altText
createdByUserId
createdAt
```

## 9.19 AuditLog

```text
id
actorUserId?
action
entityType
entityId?
beforeJson?
afterJson?
safeMetadata?
ipHash?
createdAt
```

## 9.20 AppSetting

```text
id
key Unique
valueJson
updatedAt
updatedByUserId
```

Örnek ayarlar:

```text
businessTimezone = Europe/Istanbul
businessDayCutoff = 00:00
currency = TRY
defaultLocale = tr-TR
orderAutoAccept = false
serviceChargeEnabled = false
```

---

# 10. Tarih, Saat ve İşletme Günü

Tüm gerçek zaman damgaları veritabanında UTC `timestamptz` mantığıyla tutulmalıdır.

Gösterimde:

```text
Europe/Istanbul
```

kullanılmalıdır.

Ayrıca ödeme anında hesaplanmış `businessDate` alanı saklanmalıdır.

Örnek:

```text
paidAt: 2026-07-28T21:15:00Z
businessDate: 2026-07-29
```

Gerçek dönüşüm Europe/Istanbul saatine göre yapılmalıdır.

Günlük dashboard sorgusu `businessDate` üzerinden yapılmalıdır. Her gece veri silen veya ciroyu sıfırlayan cron görevi yazılmamalıdır.

---

# 11. API ve Sunucu İşlemleri

Tüm kritik işlemler yalnızca sunucu tarafında yapılmalıdır.

## 11.1 Public Site

```text
GET /api/public/site
GET /api/public/menu
GET /api/public/products/:slug
```

## 11.2 QR Menü

```text
POST /api/guest/session
GET  /api/guest/menu
GET  /api/guest/table-session
POST /api/guest/orders
GET  /api/guest/orders/:id
POST /api/guest/service-requests
```

## 11.3 Admin Auth

```text
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

## 11.4 Masalar

```text
GET    /api/admin/tables
POST   /api/admin/tables
GET    /api/admin/tables/:id
PATCH  /api/admin/tables/:id
DELETE /api/admin/tables/:id
POST   /api/admin/tables/:id/regenerate-qr
GET    /api/admin/tables/:id/qr
GET    /api/admin/tables/qr-sheet
```

## 11.5 Siparişler

```text
GET  /api/admin/orders
GET  /api/admin/orders/:id
POST /api/admin/orders
POST /api/admin/orders/:id/accept
POST /api/admin/orders/:id/start-preparing
POST /api/admin/orders/:id/ready
POST /api/admin/orders/:id/complete
POST /api/admin/orders/:id/cancel
POST /api/admin/orders/:id/items
POST /api/admin/orders/:id/items/:itemId/cancel
```

## 11.6 Kasa

```text
GET  /api/admin/table-sessions/:id/bill
POST /api/admin/table-sessions/:id/request-payment
POST /api/admin/table-sessions/:id/pay
POST /api/admin/payments/:id/refund
GET  /api/admin/payments/:id/receipt
```

## 11.7 Raporlar

```text
GET /api/admin/reports/summary
GET /api/admin/reports/revenue
GET /api/admin/reports/products
GET /api/admin/reports/categories
GET /api/admin/reports/payments
GET /api/admin/reports/cancellations
GET /api/admin/reports/orders/export
```

## 11.8 İçerik

```text
GET   /api/admin/site-content
PATCH /api/admin/site-content
POST  /api/admin/media
DELETE /api/admin/media/:id
```

## 11.9 API Kuralları

- Zod veya eşdeğer sunucu doğrulaması
- Standart hata cevabı
- Request ID
- Rate limit
- Yetki kontrolü
- Idempotency
- Cursor pagination
- UTC zaman
- Decimal para değerleri string olarak taşınabilir
- İstemciden gelen toplam fiyata güvenmeme
- Sunucuda yeniden hesaplama
- Silme yerine gerektiğinde soft delete
- Hassas teknik hata ayrıntılarını müşteriye göstermeme

Örnek hata:

```json
{
  "error": {
    "code": "PRODUCT_UNAVAILABLE",
    "message": "Bu ürün şu anda siparişe kapalı.",
    "requestId": "req_..."
  }
}
```

---

# 12. WebSocket Gerçek Zamanlı Yapı

Mevcut `/ws` sunucusu korunarak profesyonelleştirilebilir.

## 12.1 Olaylar

```text
order.created
order.updated
order.accepted
order.preparing
order.ready
order.cancelled
table.updated
table.session.opened
table.session.closed
payment.completed
service_request.created
service_request.updated
menu.updated
product.availability.changed
```

## 12.2 Oda/Kanal Yapısı

```text
admin
kitchen
cashier
table:{tableId}
order:{orderId}
```

Müşteri yalnızca kendi QR oturumuna ve ilgili masa oturumuna ait güvenli kanala abone olmalıdır.

## 12.3 Güvenilirlik

- Kimlik doğrulama
- Yetkilendirme
- Ping/pong heartbeat
- Kopuk istemci temizliği
- Exponential backoff reconnect
- Son olay sıra numarası
- Yeniden bağlanınca REST ile güncel durum alma
- Aynı olay iki kez gelirse idempotent istemci state
- WebSocket çalışmazsa kontrollü polling fallback

WebSocket tek veri kaynağı değildir. Gerçek veri PostgreSQL’dir.

---

# 13. Ödeme Transaction Örneği

Masa kapatma akışı:

```text
1. TableSession kaydını kilitle veya güvenli concurrency kontrolü uygula.
2. Durumunun OPEN veya PAYMENT_REQUESTED olduğunu doğrula.
3. Tamamlanmamış ve iptal edilmemiş siparişleri çek.
4. Toplamı sunucuda Decimal ile hesapla.
5. Aynı idempotencyKey ile ödeme var mı kontrol et.
6. Payment oluştur.
7. Siparişleri TAMAMLANDI yap.
8. Status history oluştur.
9. TableSession durumunu CLOSED yap.
10. closedAt ve closedByUserId kaydet.
11. AuditLog oluştur.
12. Transaction commit.
13. Commit sonrası WebSocket olayı yayınla.
```

Network isteği veya WebSocket yayını açık veritabanı transaction’ı içinde bekletilmemelidir.

---

# 14. Güvenlik

## 14.1 Admin Oturumu

- Güvenli şifre hash
- HttpOnly cookie
- Secure cookie üretimde
- SameSite ayarı
- Session rotation
- Kısa erişim süresi
- Oturum iptali
- Brute-force koruması
- Başarısız giriş limiti
- OWNER için iki aşamalı doğrulama ileride

## 14.2 Yetkilendirme

- Varsayılan reddet
- Her istekte izin kontrolü
- Tahmin edilebilir ID erişimine güvenmeme
- Kullanıcı yalnızca yetkili olduğu işletme verisini görmeli
- Mutfak ciroyu görememeli
- Garson kullanıcı yönetememeli
- Kasiyer ürün fiyatı değiştirememeli
- Yalnızca OWNER belirli iadeleri yapabilmeli

## 14.3 QR Güvenliği

- Tahmin edilemez token
- Token yenileme
- Rate limit
- Masa aktiflik kontrolü
- Müşteri siparişinin aynı masaya bağlı olması
- QR ile admin endpointlerine erişememe
- Cross-table sipariş engeli
- Eski token iptali
- Bot ve spam sipariş koruması

## 14.4 Dosya Yükleme

- MIME doğrulama
- Uzantıya güvenmeme
- Boyut limiti
- Görsel yeniden kodlama
- Rastgele dosya adı
- Script çalıştırılamayan object storage
- Video boyut limiti
- Admin rol kontrolü
- Zararlı SVG riskini değerlendirme

## 14.5 Genel

- CSRF koruması
- XSS önleme
- SQL injection’a karşı parametrik sorgular
- Güvenlik headerları
- Content Security Policy
- Secret scan
- Dependency audit
- Audit log
- Hassas veri loglamama
- Veritabanı yedeği
- HTTPS zorunluluğu

---

# 15. Performans ve Kullanılabilirlik

## 15.1 Halka Açık Site

- Core Web Vitals hedefleri
- Optimize görsel
- Responsive image
- Video poster
- Lazy loading
- SEO metadata
- Schema.org LocalBusiness/CafeOrCoffeeShop yapılandırılmış veri
- Sitemap
- Robots
- Canonical URL
- Open Graph
- Türkçe karakter desteği
- Erişilebilir başlık sırası
- Klavye desteği
- Alt metin

## 15.2 QR Menü

- İlk açılış hızlı
- Zayıf mobil internette kullanılabilir
- Büyük dokunma alanı
- Sepet kaybolmamalı
- Müşteri iki kere dokununca çift sipariş oluşmamalı
- Menü güncellemesi sonrası güvenli cache invalidation
- Görsel yüklenmezse ürün bilgisi görünmeye devam etmeli

## 15.3 Admin

- 1000+ geçmiş siparişte pagination
- Rapor sorgularında index
- Tarih, masa, durum ve ödeme tipi indexleri
- Büyük raporu tarayıcıda hesaplamama
- Dashboard sorgularında aggregate
- Uzun liste virtualization gerektiğinde
- WebSocket olaylarının UI’ı kilitlememesi

---

# 16. PWA ve Cihaz Kullanımı

Admin, mutfak ve kasa ekranları PWA olarak kurulabilir olmalıdır.

- Ana ekrana ekleme
- Uygulama simgesi
- Tam ekran görünüm
- Güncelleme bildirimi
- Ağ durumu göstergesi
- Kritik mutation işlemlerini offline kuyruğa almama
- Salt okunur son menü cache’i
- Offline sipariş vaat etmeme
- Yazdırma desteği
- Tablet yatay görünüm

İlk sürümde fiziksel fiş yazıcısı entegrasyonu zorunlu değildir. Tarayıcı yazdırma görünümü hazırlanmalıdır.

---

# 17. Tasarım Sistemi

## 17.1 Marka Hissi

- Modern genç kafe
- Koyu lacivert
- Füme
- Sıcak ahşap
- Krem
- Bakır vurgu
- Okey ve nargileyi çağrıştıran küçük detaylar
- Ağır Osmanlı süsü veya ucuz neon görünümünden kaçınma

## 17.2 Bileşenler

- Button
- Input
- Select
- Dialog
- Toast
- Drawer
- Tabs
- Table
- Data grid
- Status badge
- Order card
- Table card
- Revenue card
- Confirmation modal
- Skeleton
- Empty state
- Error state
- Offline banner
- Permission denied

## 17.3 Durum Renkleri

Renk tek başına anlam taşımamalıdır. İkon ve metin de kullanılmalıdır.

Örnek:

```text
BOŞ: nötr
YENİ: dikkat
HAZIRLANIYOR: işlemde
HAZIR: başarı
ÖDEME BEKLİYOR: uyarı
İPTAL: hata
```

---

# 18. Sayfa ve Rota Yapısı

```text
/
  Ana sayfa

/menu
  Genel görüntülenebilir menü

/menu/t/[qrToken]
  Masaya özel sipariş menüsü

/order/[publicOrderToken]
  Müşteri sipariş takip ekranı

/about
/gallery
/contact
/privacy
/terms

/admin
/admin/orders
/admin/tables
/admin/tables/[id]
/admin/menu
/admin/menu/categories
/admin/menu/products
/admin/qr
/admin/reports
/admin/history
/admin/users
/admin/audit
/admin/settings
/admin/site-content

/pos
/pos/table/[id]

/kitchen

/login
```

---

# 19. Dosya ve Kod Yapısı

Öneri:

```text
src/
  app/
    (public)/
    (guest-menu)/
    (admin)/
    (pos)/
    (kitchen)/
    api/
  components/
    public-site/
    menu/
    orders/
    tables/
    pos/
    kitchen/
    reports/
    ui/
  features/
    auth/
    catalog/
    qr/
    table-sessions/
    orders/
    payments/
    reports/
    site-content/
    users/
    audit/
  lib/
    auth/
    db/
    permissions/
    money/
    time/
    validation/
    websocket/
    observability/
    idempotency/
  server/
    services/
    repositories/
    events/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  tests/
```

İş mantığı React componentlerinin içine gömülmemelidir.

---

# 20. Seed Verisi

Geliştirme seed’i:

- 1 OWNER
- 1 ADMIN
- 1 CASHIER
- 1 KITCHEN
- 1 WAITER
- 20 masa
- En az 8 kategori
- Örnek ürünler
- Örnek seçenek grupları
- Örnek açık ve kapalı siparişler
- Son 30 güne ait sahte rapor verisi, yalnızca development ortamında

Seed şifreleri üretimde kullanılmamalıdır.

---

# 21. Test Stratejisi

## 21.1 Birim Testleri

- Decimal para hesaplama
- İşletme günü hesabı
- Europe/Istanbul tarih dönüşümü
- Sipariş durum geçişi
- Masa oturumu durumu
- Yetki matrisi
- QR token doğrulama
- İndirim hesabı
- İade hesabı
- Ciro toplamı
- Sipariş snapshot fiyatı

## 21.2 Entegrasyon Testleri

- QR okut → menü aç
- Sepet → sipariş gönder
- Sipariş admin ekranına düş
- Sipariş kabul
- Hazırlanıyor
- Hazır
- Müşteri durum güncellemesi
- Aynı masadan ikinci sipariş
- Masa hesabı
- Nakit ödeme
- Kart ödeme
- Masa kapanışı
- Ciroya yansıma
- Geçmişte görünme
- Çift ödeme engeli
- Pasif ürün sipariş engeli
- Eski QR tokenı engeli
- Yetkisiz rapor erişimi engeli

## 21.3 E2E Testleri

En az iki ayrı tarayıcı oturumu:

```text
Müşteri telefonu
Admin/kasa ekranı
```

Senaryo:

1. Masa 1 QR açılır.
2. Ürün eklenir.
3. Sipariş gönderilir.
4. Admin canlı görür.
5. Sipariş kabul edilir.
6. Mutfak hazırlar.
7. Müşteri durumu görür.
8. Aynı masa ikinci sipariş verir.
9. Kasiyer hesabı açar.
10. Nakit ödeme alır.
11. Masa boş olur.
12. Günlük ciro artar.
13. Geçmişte iki sipariş ve tek masa oturumu görünür.

## 21.4 Güvenlik Testleri

- Başka masa tokenını tahmin etme
- URL’de ID değiştirme
- Yetkisiz admin endpointi
- CASHIER ile fiyat değiştirme
- KITCHEN ile rapor görüntüleme
- Tekrar gönderilen payment request
- Tekrar gönderilen order request
- XSS içeren müşteri notu
- Büyük dosya yükleme
- Geçersiz MIME
- Brute-force login
- CSRF
- WebSocket sahte event
- WebSocket başka masaya abonelik

## 21.5 Yük Testi

- Aynı anda 20 masa
- Her masada 3 telefon
- 60 eş zamanlı QR menü kullanıcısı
- 100 sipariş/dakika kısa yük testi
- WebSocket bağlantı kopma/yeniden bağlanma
- 100 bin geçmiş siparişte rapor
- Aynı masaya eş zamanlı iki ödeme denemesi

---

# 22. Yedekleme ve Operasyon

- PostgreSQL düzenli yedek
- Otomatik günlük yedek
- Ayrı saklama alanı
- Saklama süresi
- Geri yükleme testi
- Görsel dosya yedeği
- Environment secret yedeği güvenli yerde
- Hata izleme
- Uptime kontrolü
- Disk kullanımı alarmı
- Veritabanı bağlantı alarmı
- WebSocket bağlantı sayısı
- Başarısız sipariş sayısı
- Başarısız ödeme kapatma sayısı

Yedek var demek yeterli değildir; geri yükleme düzenli test edilmelidir.

---

# 23. Dağıtım

Mevcut özel `server.ts` ve sürekli WebSocket bağlantısı nedeniyle uygulama:

- Node.js server
- Docker container
- Uzun çalışan VPS/PaaS

üzerinde çalışmalıdır.

Statik hosting veya yalnızca kısa ömürlü serverless fonksiyon mantığına güvenilmemelidir.

Önerilen üretim bileşenleri:

```text
Reverse proxy / HTTPS
Next.js Node server
WebSocket server
PostgreSQL
Object storage
Backup job
Monitoring
```

Production migration:

```text
prisma migrate deploy
```

ile CI/CD içinde uygulanmalıdır.

---

# 24. Loglama ve Gözlemlenebilirlik

Her kritik istekte:

```text
requestId
userId
role
tableId
tableSessionId
orderId
paymentId
eventType
durationMs
result
```

Kişisel ve hassas bilgiler azaltılmalıdır.

Loglara:

- Parola
- Session token
- QR ham tokenı
- Cookie
- Database URL
- Secret
- Tam ödeme bilgisi

yazılmamalıdır.

Metricler:

- Sipariş oluşturma başarısı
- Ortalama sipariş kabul süresi
- Ortalama hazırlama süresi
- WebSocket bağlı istemci
- WebSocket kopma
- Ödeme transaction başarısı
- Çift ödeme engelleme sayısı
- API p95
- Veritabanı sorgu süresi
- Hata oranı

---

# 25. Birinci Sürüm Kapsamı

Zorunlu:

- Modern ana sayfa
- Genel menü
- 20 başlangıç masası
- Her masaya benzersiz QR
- QR müşteri menüsü
- Sepet ve sipariş
- Canlı admin sipariş ekranı
- Masa dolu/boş
- Sipariş durumu
- Mutfak ekranı
- Kasa ekranı
- Nakit/kart
- Masa kapatma
- Günlük/haftalık/aylık ciro
- Sipariş geçmişi
- Menü yönetimi
- QR yönetimi
- Kullanıcı rolleri
- Audit log
- Responsive tasarım
- Testler
- Yedekleme planı

İkinci sürüme bırakılabilecek:

- Karma ödeme
- Hesabı kişi bazlı bölme
- Masa taşıma
- Masa birleştirme
- Stok takibi
- Reçete/maliyet
- Gerçek POS cihazı entegrasyonu
- Fiş yazıcı entegrasyonu
- E-fatura/e-arşiv
- Rezervasyon
- Sadakat puanı
- Kupon
- Paket servis
- Çok şubeli yapı
- Mobil native uygulama

---

# 26. Geliştirme Aşamaları

## Aşama 0 — Mevcut Proje Denetimi

- Projeyi çalıştır
- Dosya yapısını çıkar
- Prisma şemasını incele
- Migration durumunu incele
- Auth yapısını incele
- WebSocket yapısını incele
- Çalışan ekranları listele
- Hataları listele
- Güvenlik açıklarını listele
- Test durumunu listele
- Veri kaybetmeden migration planı yaz

Bu aşamada büyük kod değişikliği yapma.

## Aşama 1 — Temel Veri Modeli

- Yeni roller
- TableSession
- Order status history
- Product snapshot
- Payment status
- Business date
- Service request
- Audit log
- App settings
- Migration
- Seed
- Test

## Aşama 2 — Kimlik ve Yetki

- Güvenli admin login
- Rol bazlı route koruma
- Endpoint permission
- Oturum yönetimi
- Login rate limit
- Yetki testleri

## Aşama 3 — Menü Yönetimi

- Kategori CRUD
- Ürün CRUD
- Fotoğraf
- Seçenekler
- Aktif/pasif
- Tükendi
- Sıralama
- Ürün snapshot testi

## Aşama 4 — Masa ve QR

- 20 masa seed
- QR token
- QR üretim
- QR yenileme
- PDF/print görünümü
- Public QR doğrulama
- Güvenlik testleri

## Aşama 5 — QR Sipariş

- Müşteri menüsü
- Sepet
- Guest session
- Sipariş oluşturma
- Sunucu fiyat doğrulama
- TableSession açma
- Idempotency
- Sipariş takip

## Aşama 6 — Canlı Sipariş ve Mutfak

- WebSocket auth
- Kanallar
- Order eventleri
- Admin board
- Kitchen board
- Sesli uyarı
- Reconnect
- Poll fallback

## Aşama 7 — Kasa

- Masa hesabı
- Ürün ekleme
- Yetkili iptal
- Nakit/kart
- Payment transaction
- Masa kapatma
- Çift ödeme engeli
- Fiş görünümü

## Aşama 8 — Ciro ve Geçmiş

- BusinessDate
- Bugün/hafta/ay
- Nakit/kart
- Sipariş geçmişi
- Detay filtre
- CSV
- Index ve performans testleri

## Aşama 9 — Halka Açık Site

- Ana sayfa
- Fotoğraf/video
- Hakkımızda
- Galeri
- İletişim
- Harita
- Çalışma saatleri
- SEO
- Admin içerik yönetimi

## Aşama 10 — Güvenlik ve Yayın

- E2E
- Load test
- Security test
- Backup
- Monitoring
- HTTPS
- Production migration
- Staging
- Canlı yayın
- Geri dönüş planı

---

# 27. İlk Codex Görevi

Codex’e ilk olarak yalnızca aşağıdaki görev verilmelidir:

```text
Kök dizindeki GOKBORU_CAFE_MASTER_SPEC.md ve AGENTS.md dosyalarını tamamen oku.

Mevcut Gökbörü Cafe projesini incele ve yalnızca Aşama 0 proje denetimini yap.

Görev:
1. Projenin teknoloji yığınını ve klasör yapısını çıkar.
2. package.json, Prisma schema, migrations, server.ts, auth, WebSocket ve ana route’ları incele.
3. Projeyi yerelde çalıştırmayı dene.
4. Mevcut TypeScript, lint, test ve production build durumunu raporla.
5. Hangi özelliklerin gerçekten çalıştığını kanıtlarıyla listele.
6. Bozuk, eksik, güvensiz veya geçici alanları listele.
7. Mevcut veriyi kaybetmeden yeni veri modeline geçiş planı hazırla.
8. Özellikle masa, sipariş, ödeme ve ciro akışındaki yarış koşullarını incele.
9. Henüz büyük özellik geliştirme veya toplu refactor yapma.
10. Yalnızca gerekli küçük denetim düzeltmeleri dışında kod değiştirme.

Çıktı:
- CURRENT_STATE_AUDIT.md
- MIGRATION_PLAN.md
- Test ve build sonuçları
- Önerilen ilk küçük geliştirme görevi
```

---

# 28. İkinci Codex Görevi

Aşama 0 tamamlandıktan sonra:

```text
Mevcut veriyi koruyarak temel veri modelini geliştir.

Kapsam:
- OWNER, ADMIN, CASHIER, KITCHEN, WAITER rolleri
- TableSession
- TableSessionStatus
- PaymentStatus
- OrderStatusHistory
- ServiceRequest
- AuditLog
- businessDate
- OrderItem ürün adı ve fiyat snapshot alanları
- Para alanlarını Decimal olarak doğrulama
- 20 başlangıç masası seed
- Gerekli indexler
- Prisma migration
- Migration güvenlik incelemesi
- Birim ve entegrasyon testleri

Kapsam dışı:
- Yeni QR müşteri arayüzü
- Canlı sipariş ekranı
- Ödeme UI
- Halka açık ana sayfa

Mevcut production verisini silme.
```

---

# 29. Üçüncü Codex Görevi

```text
Masa ve QR yönetimini tamamla.

Kapsam:
- Admin masa listesi
- Masa oluşturma/düzenleme/pasife alma
- Aktif oturumu olan masayı silmeme
- Güvenli QR token üretme
- QR token yenileme
- Eski tokenı geçersiz kılma
- Tek QR PNG/SVG
- 20 QR için yazdırma sayfası
- Public QR doğrulama
- QR üzerinden başka masaya erişim engeli
- Rate limit
- Audit log
- Testler
```

---

# 30. Dördüncü Codex Görevi

```text
QR müşteri menüsü ve sipariş akışını tamamla.

Kapsam:
- /menu/t/[qrToken]
- Masa doğrulama
- Guest session
- Kategori ve ürün listesi
- Ürün seçenekleri
- Sepet
- Sunucuda fiyat yeniden hesaplama
- Sipariş idempotency
- İlk siparişte TableSession açma
- Sonraki siparişleri aynı TableSession altında tutma
- Sipariş durum takip ekranı
- Garson ve hesap talebi
- Mobil responsive tasarım
- E2E test
```

---

# 31. Beşinci Codex Görevi

```text
Canlı sipariş, mutfak ve masa ekranını tamamla.

Kapsam:
- WebSocket auth
- Ping/pong heartbeat
- Reconnect
- Admin sipariş board
- Mutfak board
- Yeni sipariş sesli uyarı
- Sipariş durum geçişleri
- Masa durum kartları
- Servis talebi
- WebSocket kesilince REST senkronizasyonu
- Yetki testleri
- İki tarayıcı ile E2E test
```

---

# 32. Altıncı Codex Görevi

```text
Kasa, ödeme, masa kapatma ve ciro işlemlerini tamamla.

Kapsam:
- Masa hesabı
- Sunucuda Decimal toplam
- Nakit ve kredi kartı
- Idempotency key
- Tek Prisma transaction içinde:
  Payment oluşturma
  Siparişleri tamamlama
  TableSession kapatma
  AuditLog oluşturma
- Commit sonrası WebSocket
- Günlük businessDate
- Bugün, hafta ve ay ciro
- Sipariş geçmişi
- Tarih/saat/masa filtreleri
- Çift ödeme yarış testi
- Gece 00:00 işletme günü testi
```

---

# 33. Tamamlanma Kriterleri

Sistem tamamlandı sayılmadan önce:

- [ ] Ana sayfa modern ve mobil uyumlu
- [ ] 20 masanın QR kodu var
- [ ] Her QR doğru masayı açıyor
- [ ] Müşteri hesap açmadan sipariş veriyor
- [ ] Fiyat sunucuda doğrulanıyor
- [ ] Aynı sipariş iki kez oluşmuyor
- [ ] Sipariş canlı admin ekranına düşüyor
- [ ] Mutfak siparişi hazırlamaya alıyor
- [ ] Müşteri durum değişikliğini görüyor
- [ ] Aynı masa birden fazla sipariş ekleyebiliyor
- [ ] Masa hesabı bütün siparişleri topluyor
- [ ] Nakit/kart ödeme çalışıyor
- [ ] Çift ödeme oluşmuyor
- [ ] Masa kapanınca boş oluyor
- [ ] Ciro ödeme tarihinde görünüyor
- [ ] Saat 00:00 sonrası yeni gün 0 TL ile başlıyor
- [ ] Önceki gün silinmiyor
- [ ] İki gün önceki sipariş masa ve saatle bulunuyor
- [ ] Rol yetkileri sunucu tarafında uygulanıyor
- [ ] QR tokenı tahmin edilemiyor
- [ ] WebSocket kopunca sistem toparlanıyor
- [ ] Audit log çalışıyor
- [ ] Production build geçiyor
- [ ] Migration güvenli
- [ ] Backup ve restore denenmiş
- [ ] E2E testler geçiyor
- [ ] Hassas secret kaynak kodda yok

---

# 34. Codex Görev Sonu Rapor Şablonu

Her görev sonunda:

```text
1. Ne yaptın?
2. Hangi dosyalar değişti?
3. Hangi migration eklendi?
4. Veri kaybı riski var mı?
5. Hangi komutları çalıştırdın?
6. Test sonuçları ne?
7. Production build geçti mi?
8. Güvenlik kontrolleri ne?
9. Bilinen eksikler ne?
10. Sonraki küçük görev ne?
11. Değişiklik nasıl geri alınır?
```

---

# 35. Teknik Karar Özeti

- Mevcut Next.js + Prisma + PostgreSQL + WebSocket yapı korunur.
- Ciro “sıfırlanmaz”; tarih bazlı raporlanır.
- Sipariş, masa oturumu ve ödeme birbirinden ayrılır.
- Aynı masa farklı zamanlarda ürün ekleyebilir.
- Ödeme ve masa kapatma transaction içinde olur.
- Para `Decimal` olur.
- Saatler UTC saklanır, Europe/Istanbul gösterilir.
- QR tokenları tahmin edilemez olur.
- Müşteri hesap açmadan sipariş verebilir.
- Admin, kasa, mutfak ve müşteri ekranları farklı yetki ve akışlara sahiptir.
- WebSocket yalnızca anlık bildirimdir; veri kaynağı PostgreSQL’dir.
- Her kritik değişiklik audit loga yazılır.
- Uygulama gerçek cihazlar ve iki tarayıcıyla uçtan uca test edilir.
