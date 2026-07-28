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

## Geliştirme

```bash
npm run dev
```

- Ana sayfa: `http://localhost:3000`
- Admin giriş iskeleti: `http://localhost:3000/admin/login`

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
