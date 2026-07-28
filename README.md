# Gökbörü Cafe Pro

Gökbörü Cafe için Next.js, TypeScript, Prisma ve PostgreSQL tabanlı web ve
işletme yönetim sistemi.

Proje şu anda başlangıç iskeleti ve Aşama 1 temel veri modelini içerir:

- Next.js App Router ve TypeScript
- Prisma/PostgreSQL bağlantı tanımı
- Ana sayfa iskeleti
- İşlevsiz ve açıkça etiketlenmiş admin giriş iskeleti
- Tekrarlanabilir biçimde 20 başlangıç masası oluşturan seed
- Lint, type-check, test ve production build komutları

Temel veri modeli ayrıca kullanıcı rolleri, kategori, ürün, masa oturumu,
sipariş, sipariş kalemi snapshot'ları, durum geçmişi, ödeme, servis talebi,
audit log ve uygulama ayarlarını içerir. Para sütunları PostgreSQL
`DECIMAL(12,2)` olarak saklanır.

Sipariş, ödeme, QR, gerçek kimlik doğrulama ve WebSocket özellikleri henüz
uygulanmamıştır.

## Gereksinimler

- Node.js 20 veya üzeri
- npm
- PostgreSQL

## Kurulum

```bash
npm install
cp .env.example .env
npm run prisma:generate
```

`.env` içindeki `DATABASE_URL` değerini yerel PostgreSQL bağlantınıza göre
değiştirin.

## Veritabanı

Hazır başlangıç migration'ını geliştirme veritabanına uygulamak için:

```bash
npx prisma migrate dev
```

20 başlangıç masasını güvenli ve tekrarlanabilir biçimde eklemek için:

```bash
npm run prisma:seed
```

Seed işlemi `Masa 1` ile `Masa 20` arasındaki kayıtları `number` alanına göre
upsert eder; mevcut diğer verileri silmez.

Geliştirme ortamında `DEV_SEED_PASSWORD_HASH` geçerli bir Argon2id hash
olarak ayarlanırsa seed ayrıca `owner`, `admin`, `cashier` ve `waiter`
kullanıcılarını oluşturur. Kaynak koda veya `.env.example` dosyasına düz
metin parola yazmayın. Bu geliştirme kullanıcıları production ortamında
oluşturulmaz.

## Geliştirme

```bash
npm run dev
```

- Ana sayfa: `http://localhost:3000`
- Admin giriş iskeleti: `http://localhost:3000/admin/login`

## Kimlik ve yetki

- `/admin`: OWNER ve ADMIN
- `/pos`: OWNER, ADMIN ve CASHIER
- `/waiter`: OWNER, ADMIN ve WAITER
- `/api/admin/session`: yalnızca admin erişim izni olan roller

Oturum tokenı yalnızca HttpOnly cookie'de taşınır ve veritabanında SHA-256
hash olarak saklanır. Oturumların 8 saat mutlak, 30 dakika hareketsizlik
süresi vardır. Başarısız girişler kullanıcı ve IP için HMAC'lenmiş
tanımlayıcılarla 15 dakikalık pencerede sınırlandırılır.

Reverse proxy, istemcinin dışarıdan gönderdiği `X-Forwarded-For` başlığını
temizleyip güvenilir istemci IP'siyle yeniden yazmalıdır.

## Menü yönetimi

`/admin/menu` yalnızca `MENU_MANAGE` sunucu iznine sahip OWNER ve ADMIN
rollerine açıktır. Kategori, ürün, fiyat, açıklama, sıralama, fotoğraf URL'si,
tükenmiş durumu ve ürün seçenekleri yönetilebilir.

Kayıtlar hard-delete edilmez; pasife alınır ve değişiklikler audit log'a
yazılır. Fotoğraflar bu aşamada yalnızca doğrulanmış HTTPS URL olarak kabul
edilir. Dosya yükleme ve object storage altyapısı bu aşamanın kapsamı
dışındadır.

## Masa ve QR yönetimi

`/admin/tables` yalnızca `TABLES_MANAGE` sunucu iznine sahip OWNER ve ADMIN
rollerine açıktır. Masa ekleme, düzenleme, pasife alma, QR yenileme, tekil
PNG/SVG indirme ve tüm masaları yazdırma/PDF kaydetme desteklenir.

20 başlangıç masası korunur. İdempotent seed eksik QR kayıtlarını tamamlar.
Tokenlar 256-bit rastgele üretilir; veritabanında doğrulama hash'i ve
`QR_TOKEN_SECRET` ile AES-GCM şifreli kopyası saklanır. QR yenilendiğinde eski
hash değiştiği için eski bağlantı hemen geçersiz olur. Ham token audit log'a
yazılmaz.

## QR müşteri menüsü ve sipariş

- `/menu/t/[qrToken]` aktif masayı doğrular ve yalnızca aktif kategori, ürün ve
  seçenekleri gösterir.
- Müşteri hesap açmadan HttpOnly, SameSite guest session cookie'si alır. Oturum
  masa ve QR sürümüne bağlıdır; QR yenilenirse eski oturum sipariş veremez.
- Sepet tarayıcıda korunur; ürün/seçenek notları ve adetler sunucuya gönderilir.
- Ürün, indirim ve seçenek fiyatları istemciden kabul edilmez. PostgreSQL'den
  yeniden okunup Prisma Decimal ile hesaplanır ve sipariş snapshot alanlarına
  yazılır.
- İlk sipariş Serializable transaction içinde masa oturumu açar; sonraki
  siparişler aynı `OPEN` oturuma eklenir. Ödeme süreci başlamış masaya yeni QR
  siparişi alınmaz.
- UUID idempotency anahtarı ve veritabanı unique index'i çift siparişi engeller.
- Sipariş sonrası 256-bit güvenli `/order/[publicOrderToken]` takip bağlantısı
döner; veritabanında token hash'i ve şifreli kopyası saklanır.

## Canlı sipariş ve masa takibi

- Uygulama `npm run dev` ve `npm start` ile `server.ts` özel Node sunucusunu
  çalıştırır; `/ws` WebSocket bağlantıları aynı süreçte yönetilir.
- `/admin/orders` PostgreSQL kaynaklı sipariş ve masa görünümüdür. WebSocket
  yalnızca değişiklik bildirir; her olaydan sonra REST ile yeniden okunur ve
  bağlantı kesilirse 10 saniyelik polling devam eder.
- Admin WebSocket bağlantısı HttpOnly oturum cookie'si, aktif kullanıcı ve
  `ORDERS_MANAGE` izniyle doğrulanır. Müşteri bağlantısı yalnızca kendi public
  sipariş tokenıyla kendi sipariş kanalına bağlanabilir.
- Sunucu 25 saniyede bir ping/pong heartbeat ve periyodik yetki kontrolü yapar.
  İstemci üstel gecikmeyle tekrar bağlanır ve olay kimliklerini tekrar işlemez.
- Yeni siparişte görsel uyarı oluşur. Tarayıcı otomatik ses politikasına uygun
  olarak kullanıcı sesi etkinleştirdikten sonra sesli uyarı da verilir.
- Siparişler yalnızca `BEKLIYOR → ONAYLANDI → HAZIRLANIYOR → HAZIR →
  TAMAMLANDI` yönünde ve optimistic version kontrolüyle ilerler. Her geçiş
  transaction içinde status history ve audit log oluşturur.
- Masa kartları boş/dolu/pasif, açık toplam, son sipariş ve mevcutsa ödeme
  talebi durumunu gösterir. Bu aşama ödeme alma veya masa kapatma yapmaz.

## Doğrulama

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Migration entegrasyon testi, SQL dosyalarını bellek içi PostgreSQL üzerinde
uygular; mevcut masa verisinin korunduğunu, bir masada yalnızca tek aktif
oturum açılabildiğini ve audit log kayıtlarının değiştirilemediğini doğrular.

## Güvenlik notları

- Gerçek secret değerleri repoya eklenmez.
- `.env` Git tarafından yok sayılır; yalnızca `.env.example` paylaşılır.
- Admin formu gerçek kimlik doğrulama eklenene kadar devre dışıdır.
- Seed üretim verisini silmez ve `prisma migrate reset` kullanmaz.
