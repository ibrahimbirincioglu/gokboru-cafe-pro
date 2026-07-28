# AGENTS.md — Gökbörü Cafe Kodlama Kuralları

## Önce Oku

Her görevden önce kök dizindeki `GOKBORU_CAFE_MASTER_SPEC.md` dosyasını oku.

Mevcut proje sıfırdan yazılmayacak. Çalışan Next.js, Prisma, PostgreSQL ve WebSocket kodunu incele, koru ve aşamalı geliştir.

## Kesin Kurallar

- Üretim verisini silme.
- Production veritabanında `prisma migrate reset` kullanma.
- Şema değişikliklerini migration ile yap.
- Para için float/number kullanma; Prisma Decimal kullan.
- Fiyatı istemciden kabul etme; sunucuda yeniden hesapla.
- Sipariş ödeme ve masa kapatmayı tek transaction içinde yap.
- Aynı ödeme veya siparişin iki kez oluşmasını engelle.
- QR bağlantısında tahmin edilebilir masa ID kullanma.
- Yetkiyi yalnızca UI’da değil, sunucuda doğrula.
- WebSocket’i veri kaynağı yapma; PostgreSQL kaynak gerçek olsun.
- WebSocket auth, heartbeat ve reconnect ekle.
- Ham token, parola, cookie, QR token veya secret loglama.
- Ürün fiyatı değişince geçmiş siparişi değiştirme.
- Sipariş ürün adı ve fiyat snapshotlarını sakla.
- Saatleri UTC sakla; işletme raporlarını Europe/Istanbul ile hesapla.
- Ciro verisini gece silme veya resetleme.
- Açık masa oturumu olan masayı silme.
- Hazırlanan siparişi neden ve yetki olmadan iptal etme.
- TODO veya placeholder’ı tamamlanmış özellik gibi sunma.
- Test ve production build geçmeden görevi bitmiş sayma.

## Her Kritik Özellik İçin Test

- Başarılı akış
- Geçersiz giriş
- Yetkisiz erişim
- Yinelenen istek
- Eş zamanlı istek
- Ağ/WebSocket kopması
- Veritabanı rollback
- Gece 00:00 tarih sınırı
- Eski QR tokenı
- Başka masaya erişim
- Çift ödeme
- Pasif ürün
- İptal nedeni
- Audit log

## Görev Sonu

Şunları raporla:

1. Değişen dosyalar
2. Migrationlar
3. Çalıştırılan komutlar
4. Test sonuçları
5. Build sonucu
6. Güvenlik kontrolleri
7. Veri kaybı riski
8. Bilinen eksikler
9. Sonraki küçük görev
10. Geri alma yöntemi
