# Restore Part 6: PHP Mail-Relay V3 (SMTP Auth)

**Date:** 2026-02-25 | **Version:** `2026-02-25-v3-smtp`

## Übersicht

Das Mail-Relay ist ein PHP-Skript auf dem Webserver `rauch-heilpraktiker.de`, das als Brücke zwischen den Lovable Cloud Edge Functions und dem E-Mail-System fungiert. Version 3 verwendet authentifiziertes SMTP statt `mail()`, da Plesk/QMail den Systembenutzer vom Sendmail-Zugriff ausschließt.

## Architektur

```
Edge Function → HTTPS POST → mail-relay.php → SMTP Auth (Port 587) → Postfach → Empfänger
                (mit X-Relay-Token)              (STARTTLS)
```

## Installation

1. Datei kopieren:
   ```bash
   cp docs/mail-relay-v3-smtp.php /var/www/vhosts/rauch-heilpraktiker.de/httpdocs/mail-relay.php
   ```

2. SMTP-Passwort setzen (Zeile 51):
   ```php
   $SMTP_PASS = 'HIER_DAS_POSTFACH_PASSWORT';
   ```

3. Berechtigungen:
   ```bash
   chmod 644 /var/www/vhosts/rauch-heilpraktiker.de/httpdocs/mail-relay.php
   ```

## Konfiguration im PHP-Skript

```php
$RELAY_SECRET = getenv('RELAY_SECRET') ?: '';
$SMTP_HOST    = 'localhost';
$SMTP_PORT    = 587;
$SMTP_USER    = 'info@rauch-heilpraktiker.de';
$SMTP_PASS    = '';  // <-- Postfach-Passwort
$SMTP_SECURE  = false;  // true für SSL/TLS auf Port 465
```

## Funktionsweise

### Sicherheit
- Token-Validierung via `X-Relay-Token` Header (constant-time `hash_equals`)
- Nur POST-Requests akzeptiert
- CORS-Headers für Edge Function Zugriff

### SMTP-Versand
- Verbindung via `fsockopen()` zu localhost:587
- STARTTLS Upgrade wenn verfügbar
- AUTH LOGIN Authentifizierung
- Dot-Stuffing gemäß RFC 5321
- **Chunked `fwrite()` in 8KB Blöcken** (kritisch für große PDF-Anhänge)

### Anhänge (PDF)
- MIME Multipart mit Boundary
- Base64-Encoding des PDF, aufgeteilt via `chunk_split()`
- Attachment-Info Logging (filename, base64_len, decoded_bytes)

### Fallback
- Bei SMTP-Fehler: Versuch über `mail()` als letzter Ausweg (ohne Anhang)
- Beide Fehler werden geloggt

## Debug-Log

Pfad: `/var/www/vhosts/rauch-heilpraktiker.de/httpdocs/mail-debug.log`

Typische Einträge:
```
[2026-02-25T14:30:00+01:00] Accepted: to=patient@email.de from=info@rauch-heilpraktiker.de subject=Neuer Anamnesebogen attachment=yes (filename=Anamnesebogen_Max_Mustermann_2026-02-25.pdf, base64_len=45200, decoded_bytes=33900)
[2026-02-25T14:30:01+01:00] SMTP greeting: 220 mail.rauch-heilpraktiker.de ESMTP
[2026-02-25T14:30:01+01:00] SMTP authenticated as info@rauch-heilpraktiker.de
[2026-02-25T14:30:02+01:00] SMTP DATA sent: 52340 bytes total
[2026-02-25T14:30:02+01:00] SMTP OK: to=patient@email.de
```

## Shared SMTP Utility (Edge Functions)

**Pfad:** `supabase/functions/_shared/smtp.ts`

```typescript
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;  // default: info@rauch-heilpraktiker.de
  attachment?: {
    filename: string;
    base64: string;
    contentType: string;
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<{ attachmentSent: boolean }>;
```

### Verhalten:
1. Sendet JSON POST an `https://rauch-heilpraktiker.de/mail-relay.php`
2. Setzt `X-Relay-Token` Header mit `RELAY_SECRET` Secret
3. Bei Fehler mit Anhang: Automatischer Retry ohne Anhang + Hinweis im HTML
4. Prüft Response auf HTML-Fehlerseiten (Plesk Standardfehler)

## Vollständiger PHP-Quellcode

Siehe: `docs/mail-relay-v3-smtp.php` (298 Zeilen)

### Kritische Codeabschnitte

**Chunked fwrite (Zeilen 186-200):**
```php
$fullMessage = $message . "\r\n.\r\n";
$totalLen = strlen($fullMessage);
$written = 0;
$chunkSize = 8192;
while ($written < $totalLen) {
    $chunk = substr($fullMessage, $written, $chunkSize);
    $bytes = fwrite($sock, $chunk);
    if ($bytes === false || $bytes === 0) {
        $errors[] = "fwrite failed at offset $written/$totalLen";
        fclose($sock);
        return implode('; ', $errors);
    }
    $written += $bytes;
}
relay_log("SMTP DATA sent: $written bytes total");
```

**STARTTLS (Zeilen 150-159):**
```php
if (!$secure && $port == 587 && stripos($ehloResp, 'STARTTLS') !== false) {
    $sendCmd("STARTTLS", 220);
    if (!stream_socket_enable_crypto($sock, true, 
        STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
        fclose($sock);
        return "STARTTLS crypto handshake failed";
    }
    $sendCmd("EHLO " . gethostname(), 250);
}
```
