# AI StegCloak Protocol v0.1

Bu belge, araştırma prototipinin mevcut protokolünü tarif eder. v0.1 deneysel bir sürümdür ve geriye dönük uyumluluk garantisi vermez.

## Amaç

Katılımcı bir AI sağlayıcısının kullanıcıya sunduğu metne, görünür içeriği değiştirmeden dağıtık bir provenance sinyali eklemek. Protokol kullanıcı kimliği taşımaz ve istatistiksel bir AI sınıflandırıcısı değildir.

## Görünmez alfabe

Protokol dört Unicode karakteri kullanır:

| Değer | Kod noktası | Ad |
| --- | --- | --- |
| 0 | `U+2061` | FUNCTION APPLICATION |
| 1 | `U+2062` | INVISIBLE TIMES |
| 2 | `U+2063` | INVISIBLE SEPARATOR |
| 3 | `U+2064` | INVISIBLE PLUS |

Bir karakter iki bit taşır. Her görünür kelimeden sonra tam üç karakter eklenir; dolayısıyla her kelime 6 bitlik bir sembol taşır.

ZWNJ ve ZWJ, bazı yazı sistemlerinde şekillendirmeyi veya emoji birleşimini etkileyebildiği için veri alfabesine dahil edilmemiştir.

## Sembol üretimi

Her cevap için rastgele bir UUID oluşturulur. Kelime `i` için sembol:

```text
digest   = HMAC-SHA-256(masterKey, "aizwc:v1:" || watermarkId || ":" || i)
symbol_i = digest[0] & 0x3f
```

Master key yalnızca provenance backend’inde bulunur. Sağlayıcı istemcisi parola veya HMAC anahtarı almaz.

## Registry kaydı

v0.1 bellek içi registry şu alanları saklar:

```text
watermarkId
providerId
createdAt
wordCount
symbolSequence
contentFingerprint
```

Kullanıcı, IP adresi ve prompt verisi saklanmaz.

## Tespit

Dedektör üçlü ZWC tag’lerini çıkarır ve registry’deki sembol dizileriyle karşılaştırır:

- Dört sembollük kayan pencereler eşleştirilir.
- En uzun kesintisiz ortak sembol dizisi hesaplanır.
- Silinen kelimelerden kaynaklanan boşluklara rağmen yeterli bağımsız pencere hayatta kalırsa filigran doğrulanır.
- Tag taşıyan görünür kelimelerin üçlü kelime fingerprint’leri kayıtlı içerikle karşılaştırılır.

Mevcut varsayılan güçlü eşiklerden biri sağlanmalıdır:

- En az sekiz kesintisiz sembol; veya
- En az üç eşleşen dört-sembol penceresi ve en az `%25` pencere kapsamı.

Sekizden az çıkarılmış sembol `insufficient_evidence` sonucudur.

## Sonuç semantiği

`verified_ai_provenance`, metinde kayıtlı ve içerikle tutarlı bir sağlayıcı filigranı bulunduğunu belirtir. Metindeki her karakterin AI tarafından yazıldığını iddia etmez.

`not_detected`, insan yazımı anlamına gelmez. Platform temizliği veya kasıtlı ZWC silme işlemi filigranı yok edebilir.

`suspicious_transplant`, geçerli sembol dizisinin görünür içeriğinin kayıtlı kaynakla uyuşmadığını belirtir.

