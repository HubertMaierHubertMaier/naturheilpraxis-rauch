<?php
/**
 * E-Mail Relay Endpoint für Naturheilpraxis Rauch - VERSION 3.2 (QMail SMTP + TLS Fix)
 * 
 * Optimiert für Plesk + QMail mit aktiviertem SMTP-Service auf Port 587.
 * Verwendet authentifiziertes SMTP via stream_socket_client mit STARTTLS.
 * 
 * FIX v3.2: stream_socket_client statt fsockopen für TLS-Kontext (verify_peer=false),
 *           damit STARTTLS bei IP-basierter Verbindung funktioniert.
 *           mail()-Fallback sendet jetzt auch Multipart-MIME mit Anhang.
 * 
 * INSTALLATION:
 * 1. Diese Datei auf den Server kopieren nach:
 *    /var/www/vhosts/rauch-heilpraktiker.de/httpdocs/mail-relay.php
 * 2. RELAY_SECRET, SMTP_USER und SMTP_PASS unten konfigurieren
 * 3. Alte mail-relay.php vorher sichern (umbenennen in mail-relay.php.bak)
 */

$RELAY_VERSION = '2026-03-06-v3.6-mailfix';

// CORS Headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Relay-Token');

// Debug-Log
function relay_log($message) {
    $line = '[' . date('c') . '] ' . $message . "\n";
    @file_put_contents(__DIR__ . '/mail-debug.log', $line, FILE_APPEND);
}

// OPTIONS Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Nur POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed', 'version' => $RELAY_VERSION]);
    exit;
}

// ============================================
// KONFIGURATION - BITTE ANPASSEN!
// ============================================
$RELAY_SECRET = getenv('RELAY_SECRET') ?: '';

// SMTP-Zugangsdaten (Plesk-Postfach, QMail SMTP auf Port 587)
$SMTP_HOST  = '185.248.141.144';           // QMail SMTP auf Server-IP (Port 587, alle IPs aktiviert)
$SMTP_PORT  = 587;                         // Submission-Port (Plesk QMail SMTP-Service)
$SMTP_SECURE = false;                      // false = STARTTLS wird automatisch verhandelt auf 587

// Standard-SMTP-Account (für externe Empfänger und Fallback)
$SMTP_USER  = 'info@rauch-heilpraktiker.de';
$SMTP_PASS  = '';                          // <-- HIER DAS POSTFACH-PASSWORT FÜR info@ EINTRAGEN

// Pro-Postfach SMTP-Auth für lokale Zustellung
// QMail liefert Mails an den authentifizierten Account, nicht an RCPT TO.
// Daher muss für lokale Empfänger der jeweilige Account verwendet werden.
$LOCAL_SMTP_ACCOUNTS = [
    'anamnese@art-of-therapy.de' => '',  // <-- HIER PASSWORT FÜR anamnese@ EINTRAGEN
    'iaa@art-of-therapy.de'      => '',  // <-- HIER PASSWORT FÜR iaa@ EINTRAGEN
    // 'info@rauch-heilpraktiker.de' wird automatisch über $SMTP_USER/$SMTP_PASS abgedeckt
];

// Token validieren
$token = $_SERVER['HTTP_X_RELAY_TOKEN'] ?? '';
if (empty($token) || !hash_equals($RELAY_SECRET, $token)) {
    http_response_code(401);
    relay_log('Unauthorized: remote=' . ($_SERVER['REMOTE_ADDR'] ?? '-'));
    echo json_encode(['success' => false, 'error' => 'Unauthorized', 'version' => $RELAY_VERSION]);
    exit;
}

// JSON Body lesen
$input = file_get_contents('php://input');
if (empty($input)) {
    http_response_code(400);
    relay_log('Empty input! CONTENT_LENGTH=' . ($_SERVER['CONTENT_LENGTH'] ?? 'unknown'));
    echo json_encode(['success' => false, 'error' => 'Empty request body', 'version' => $RELAY_VERSION]);
    exit;
}

$data = json_decode($input, true);
if (!$data) {
    http_response_code(400);
    relay_log('Invalid JSON: len=' . strlen($input));
    echo json_encode(['success' => false, 'error' => 'Invalid JSON', 'version' => $RELAY_VERSION]);
    exit;
}

// Pflichtfelder
$to      = filter_var($data['to'] ?? '', FILTER_VALIDATE_EMAIL);
$subject = trim($data['subject'] ?? '');
$html    = $data['html'] ?? '';
$from    = filter_var($data['from'] ?? 'info@rauch-heilpraktiker.de', FILTER_VALIDATE_EMAIL);

if (!$to || !$subject || !$html) {
    http_response_code(400);
    relay_log('Missing fields: to=' . ($data['to'] ?? '-'));
    echo json_encode(['success' => false, 'error' => 'Missing required fields', 'version' => $RELAY_VERSION]);
    exit;
}

$attachment = $data['attachment'] ?? null;
$attachInfo = 'no';
if ($attachment) {
    $b64len = strlen($attachment['base64'] ?? '');
    $attachInfo = "yes (filename={$attachment['filename']}, base64_len=$b64len, decoded_bytes=" . intval($b64len * 0.75) . ")";
}
relay_log("Accepted: to=$to from=$from subject=$subject attachment=$attachInfo");

// Subject UTF-8 encoding
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

// ============================================
// SMTP-Versand via stream_socket_client (QMail-kompatibel, TLS-Fix)
// ============================================
function smtp_send($host, $port, $user, $pass, $secure, $from, $to, $headers, $body) {
    $errors = [];
    
    $prefix = $secure ? 'ssl://' : '';
    $timeout = 30;
    
    relay_log("SMTP connecting to {$prefix}{$host}:{$port} (QMail v3.2)");
    
    // stream_socket_client statt fsockopen für TLS-Kontext-Unterstützung
    $context = stream_context_create([
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true,
        ],
    ]);
    
    $sock = @stream_socket_client(
        "{$prefix}tcp://{$host}:{$port}",
        $errno,
        $errstr,
        $timeout,
        STREAM_CLIENT_CONNECT,
        $context
    );
    
    if (!$sock) {
        return "Connection failed: $errstr ($errno)";
    }
    
    // Timeouts für Socket-Reads setzen (wichtig für QMail)
    stream_set_timeout($sock, 30);
    
    // Helper: read response (QMail-kompatibel, mit Timeout-Schutz)
    $readResponse = function() use ($sock) {
        $response = '';
        while ($line = fgets($sock, 512)) {
            $response .= $line;
            // Multiline response endet wenn 4. Zeichen ein Leerzeichen ist
            if (isset($line[3]) && $line[3] === ' ') break;
            // Einzeilige Antwort ohne Continuation
            if (strlen($line) < 4) break;
        }
        return $response;
    };
    
    // Helper: send command and check response
    $sendCmd = function($cmd, $expectedCode) use ($sock, $readResponse, &$errors) {
        fwrite($sock, $cmd . "\r\n");
        $resp = $readResponse();
        $code = (int)substr($resp, 0, 3);
        relay_log("SMTP >> " . trim($cmd) . " → $code");
        if ($code !== $expectedCode) {
            $errors[] = "CMD '" . (strpos($cmd, 'AUTH') === 0 ? 'AUTH...' : $cmd) . "' expected $expectedCode got $code: " . trim($resp);
            return false;
        }
        return $resp;
    };
    
    // Read greeting
    $greeting = $readResponse();
    relay_log("SMTP greeting: " . trim($greeting));
    
    // Prüfe ob Greeting gültig (2xx)
    $greetCode = (int)substr($greeting, 0, 3);
    if ($greetCode < 200 || $greetCode >= 300) {
        fclose($sock);
        return "Bad greeting ($greetCode): " . trim($greeting);
    }
    
    // EHLO mit dem eigenen Domain-Namen (QMail bevorzugt FQDN)
    $ehloHost = 'rauch-heilpraktiker.de';
    $ehloResp = $sendCmd("EHLO $ehloHost", 250);
    if (!$ehloResp) {
        // Fallback: HELO statt EHLO (ältere QMail-Versionen)
        relay_log("EHLO failed, trying HELO");
        $errors = [];
        $heloResp = $sendCmd("HELO $ehloHost", 250);
        if (!$heloResp) { fclose($sock); return "HELO failed: " . implode('; ', $errors); }
        $ehloResp = $heloResp;
    }
    
    // STARTTLS wenn verfügbar (Port 587 Standard bei QMail Submission)
    if (!$secure && $port == 587 && stripos($ehloResp, 'STARTTLS') !== false) {
        relay_log("STARTTLS initiating...");
        $starttlsResp = $sendCmd("STARTTLS", 220);
        if (!$starttlsResp) {
            // Manche QMail-Konfigurationen unterstützen kein STARTTLS – weitermachen ohne
            relay_log("STARTTLS not available, continuing without encryption");
            $errors = [];
        } else {
            // TLS-Handshake MIT stream_context (verify_peer=false für IP-basierte Verbindung)
            // Das ist der entscheidende Fix: stream_socket_enable_crypto nutzt jetzt den Kontext
            $cryptoMethod = STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
            }
            $cryptoOk = @stream_socket_enable_crypto($sock, true, $cryptoMethod);
            if (!$cryptoOk) {
                // Fallback: breitere Methoden versuchen
                relay_log("TLS 1.2/1.3 failed, trying broader crypto methods");
                $cryptoOk = @stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if (!$cryptoOk) {
                    // Letzter Versuch: TLS komplett überspringen, unverschlüsselt weiter
                    relay_log("STARTTLS crypto failed – continuing WITHOUT encryption (local connection)");
                    // Socket schließen und neu verbinden OHNE STARTTLS
                    fclose($sock);
                    
                    $sock = @stream_socket_client(
                        "tcp://{$host}:{$port}",
                        $errno,
                        $errstr,
                        $timeout,
                        STREAM_CLIENT_CONNECT,
                        $context
                    );
                    if (!$sock) {
                        return "Reconnect without TLS failed: $errstr ($errno)";
                    }
                    stream_set_timeout($sock, 30);
                    
                    // Reassign closures with new $sock
                    $readResponse = function() use ($sock) {
                        $response = '';
                        while ($line = fgets($sock, 512)) {
                            $response .= $line;
                            if (isset($line[3]) && $line[3] === ' ') break;
                            if (strlen($line) < 4) break;
                        }
                        return $response;
                    };
                    $sendCmd = function($cmd, $expectedCode) use ($sock, $readResponse, &$errors) {
                        fwrite($sock, $cmd . "\r\n");
                        $resp = $readResponse();
                        $code = (int)substr($resp, 0, 3);
                        relay_log("SMTP >> " . trim($cmd) . " → $code");
                        if ($code !== $expectedCode) {
                            $errors[] = "CMD '" . (strpos($cmd, 'AUTH') === 0 ? 'AUTH...' : $cmd) . "' expected $expectedCode got $code: " . trim($resp);
                            return false;
                        }
                        return $resp;
                    };
                    
                    // Read greeting again
                    $greeting = $readResponse();
                    relay_log("SMTP reconnect greeting: " . trim($greeting));
                    
                    $errors = [];
                    $ehloResp = $sendCmd("EHLO $ehloHost", 250);
                    if (!$ehloResp) {
                        $errors = [];
                        $ehloResp = $sendCmd("HELO $ehloHost", 250);
                        if (!$ehloResp) { fclose($sock); return "HELO failed on reconnect"; }
                    }
                    // Nicht nochmal STARTTLS versuchen!
                    relay_log("Continuing without TLS after reconnect");
                }
            }
            if ($cryptoOk) {
                relay_log("STARTTLS OK");
                // Re-EHLO nach STARTTLS (Pflicht laut RFC)
                $ehloResp = $sendCmd("EHLO $ehloHost", 250);
                if (!$ehloResp) {
                    $errors = [];
                    $sendCmd("HELO $ehloHost", 250);
                }
            }
        }
    } elseif (!$secure && $port == 587) {
        relay_log("STARTTLS not advertised by server, continuing unencrypted");
    }
    
    // ============================================
    // AUTH – QMail unterstützt typischerweise PLAIN und LOGIN
    // ============================================
    $authenticated = false;
    
    // Methode 1: AUTH PLAIN
    if (stripos($ehloResp, 'AUTH') !== false && stripos($ehloResp, 'PLAIN') !== false) {
        relay_log("Trying AUTH PLAIN");
        $authString = base64_encode("\0" . $user . "\0" . $pass);
        $authResp = $sendCmd("AUTH PLAIN $authString", 235);
        if ($authResp) {
            $authenticated = true;
            relay_log("AUTH PLAIN OK");
        } else {
            relay_log("AUTH PLAIN failed, trying LOGIN");
            $errors = [];
        }
    }
    
    // Methode 2: AUTH LOGIN (Fallback)
    if (!$authenticated) {
        relay_log("Trying AUTH LOGIN");
        $loginResp = $sendCmd("AUTH LOGIN", 334);
        if ($loginResp) {
            $userResp = $sendCmd(base64_encode($user), 334);
            if ($userResp) {
                $passResp = $sendCmd(base64_encode($pass), 235);
                if ($passResp) {
                    $authenticated = true;
                    relay_log("AUTH LOGIN OK");
                }
            }
        }
        if (!$authenticated) {
            fclose($sock);
            return "AUTH failed (PLAIN+LOGIN): " . implode('; ', $errors);
        }
    }
    
    relay_log("SMTP authenticated as $user");
    
    // MAIL FROM
    if (!$sendCmd("MAIL FROM:<$from>", 250)) { fclose($sock); return implode('; ', $errors); }
    
    // RCPT TO
    if (!$sendCmd("RCPT TO:<$to>", 250)) { fclose($sock); return implode('; ', $errors); }
    
    // DATA
    if (!$sendCmd("DATA", 354)) { fclose($sock); return implode('; ', $errors); }
    
    // Send headers + body
    $message = $headers . "\r\n\r\n" . $body;
    
    // Normalize bare LF to CRLF in ENTIRE message (QMail/RFC 2821 requirement!)
    // JSON-decoded HTML from Edge Functions contains bare \n which QMail rejects with 451
    $message = str_replace("\r\n", "\n", $message);   // first normalize to LF
    $message = str_replace("\r", "\n", $message);      // handle stray CR
    $message = str_replace("\n", "\r\n", $message);    // then convert all to CRLF
    
    // Dot-stuffing (RFC 5321)
    $message = str_replace("\r\n.", "\r\n..", $message);
    $fullMessage = $message . "\r\n.\r\n";
    
    // Chunked fwrite in 8KB Blöcken (kritisch für große PDF-Anhänge)
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
    
    $dataResp = $readResponse();
    $dataCode = (int)substr($dataResp, 0, 3);
    
    // QUIT
    fwrite($sock, "QUIT\r\n");
    fclose($sock);
    
    if ($dataCode !== 250) {
        return "DATA rejected ($dataCode): " . trim($dataResp);
    }
    
    return true; // success
}

// Build email
$boundary = '----=_Part_' . md5(uniqid(microtime(true)));

if ($attachment && !empty($attachment['base64']) && !empty($attachment['filename'])) {
    // Multipart mit Anhang
    $hdrs  = "From: Naturheilpraxis Rauch <$from>\r\n";
    $hdrs .= "To: $to\r\n";
    $hdrs .= "Subject: $encodedSubject\r\n";
    $hdrs .= "MIME-Version: 1.0\r\n";
    $hdrs .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
    $hdrs .= "Reply-To: $from\r\n";
    $hdrs .= "X-Mailer: NHP-Relay/3.2-QMail-TLSfix";
    
    $body  = "--$boundary\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $html . "\r\n\r\n";
    
    $contentType = $attachment['contentType'] ?? 'application/octet-stream';
    $filename    = $attachment['filename'];
    $body .= "--$boundary\r\n";
    $body .= "Content-Type: $contentType; name=\"$filename\"\r\n";
    $body .= "Content-Disposition: attachment; filename=\"$filename\"\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split($attachment['base64']) . "\r\n";
    $body .= "--$boundary--";
    
} else {
    // Einfache HTML-Mail
    $hdrs  = "From: Naturheilpraxis Rauch <$from>\r\n";
    $hdrs .= "To: $to\r\n";
    $hdrs .= "Subject: $encodedSubject\r\n";
    $hdrs .= "MIME-Version: 1.0\r\n";
    $hdrs .= "Content-Type: text/html; charset=UTF-8\r\n";
    $hdrs .= "Content-Transfer-Encoding: 8bit\r\n";
    $hdrs .= "Reply-To: $from\r\n";
    $hdrs .= "X-Mailer: NHP-Relay/3.2-QMail-TLSfix";
    
    $body = $html;
}

// Pro-Postfach Auth: Für lokale Empfänger den jeweiligen SMTP-Account verwenden
$smtp_user_for_send = $SMTP_USER;
$smtp_pass_for_send = $SMTP_PASS;
$envelope_from = $from;  // MAIL FROM im SMTP-Envelope

if (isset($LOCAL_SMTP_ACCOUNTS[$to]) && !empty($LOCAL_SMTP_ACCOUNTS[$to])) {
    $smtp_user_for_send = $to;
    $smtp_pass_for_send = $LOCAL_SMTP_ACCOUNTS[$to];
    // KRITISCH: MAIL FROM muss dem authentifizierten Account entsprechen!
    // QMail liefert sonst an das Postfach des MAIL FROM (info@) statt RCPT TO.
    $envelope_from = $to;
    relay_log("Using per-recipient SMTP auth: authenticating AND sending as $to (MAIL FROM=$to, instead of $from)");
    
    // Auch die E-Mail-Header anpassen (From: und Reply-To:)
    $hdrs = preg_replace('/^From: .*$/m', "From: Naturheilpraxis Rauch <$to>", $hdrs);
    $hdrs = preg_replace('/^Reply-To: .*$/m', "Reply-To: $from", $hdrs);  // Reply-To bleibt info@
} else {
    relay_log("Using default SMTP auth: $SMTP_USER (recipient: $to)");
}

// Senden – envelope_from wird als MAIL FROM verwendet
$result = smtp_send($SMTP_HOST, $SMTP_PORT, $smtp_user_for_send, $smtp_pass_for_send, $SMTP_SECURE, $envelope_from, $to, $hdrs, $body);

if ($result === true) {
    relay_log("SMTP OK: to=$to attachment=$attachInfo");
    echo json_encode([
        'success' => true,
        'message' => 'Email sent via SMTP (QMail)',
        'version' => $RELAY_VERSION,
        'has_attachment' => !empty($attachment),
    ]);
} else {
    // ============================================
    // Fallback: mail() MIT Anhang-Unterstützung (v3.6 Fix!)
    // WICHTIG: Für lokale Empfänger envelope sender auf $to setzen!
    // ============================================
    relay_log("SMTP FAIL: $result – trying mail() fallback WITH attachment support");
    
    // Envelope-Sender: Für lokale Empfänger den Empfänger selbst verwenden,
    // damit QMail die Mail in das richtige Postfach zustellt.
    $mail_envelope = $envelope_from;  // $envelope_from ist bereits per-recipient gesetzt
    $mail_extra_params = '-f ' . escapeshellarg($mail_envelope);
    relay_log("mail() fallback using envelope sender: $mail_envelope");
    
    // From-Header für lokale Empfänger anpassen (wie beim SMTP-Pfad)
    $mail_from_header = $from;
    if (isset($LOCAL_SMTP_ACCOUNTS[$to]) && !empty($LOCAL_SMTP_ACCOUNTS[$to])) {
        $mail_from_header = $to;
    }
    
    if ($attachment && !empty($attachment['base64']) && !empty($attachment['filename'])) {
        // mail() Fallback MIT Multipart-MIME und Anhang
        $fallbackBoundary = '----=_MailFB_' . md5(uniqid(microtime(true)));
        
        $mailHeaders = [
            'MIME-Version: 1.0',
            "Content-Type: multipart/mixed; boundary=\"$fallbackBoundary\"",
            "From: Naturheilpraxis Rauch <$mail_from_header>",
            "Reply-To: $from",
            "X-Mailer: NHP-Relay/3.6-QMail-Fallback",
        ];
        
        $mailBody  = "--$fallbackBoundary\r\n";
        $mailBody .= "Content-Type: text/html; charset=UTF-8\r\n";
        $mailBody .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $mailBody .= $html . "\r\n\r\n";
        
        $aContentType = $attachment['contentType'] ?? 'application/octet-stream';
        $aFilename    = $attachment['filename'];
        $mailBody .= "--$fallbackBoundary\r\n";
        $mailBody .= "Content-Type: $aContentType; name=\"$aFilename\"\r\n";
        $mailBody .= "Content-Disposition: attachment; filename=\"$aFilename\"\r\n";
        $mailBody .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $mailBody .= chunk_split($attachment['base64']) . "\r\n";
        $mailBody .= "--$fallbackBoundary--";
        
        $mailSuccess = @mail($to, $encodedSubject, $mailBody, implode("\r\n", $mailHeaders), $mail_extra_params);
        
        if ($mailSuccess) {
            relay_log("mail() fallback OK WITH attachment: to=$to filename=$aFilename envelope=$mail_envelope");
            echo json_encode([
                'success' => true,
                'message' => 'Email sent via mail() fallback with attachment',
                'version' => $RELAY_VERSION,
                'has_attachment' => true,
                'smtp_error' => $result,
            ]);
        } else {
            // Letzter Versuch: mail() ohne Anhang
            relay_log("mail() with attachment failed, trying without");
            $simpleHeaders = [
                'MIME-Version: 1.0',
                'Content-type: text/html; charset=UTF-8',
                "From: Naturheilpraxis Rauch <$mail_from_header>",
                "Reply-To: $from",
            ];
            $mailSuccess = @mail($to, $encodedSubject, $html, implode("\r\n", $simpleHeaders), $mail_extra_params);
            if ($mailSuccess) {
                relay_log("mail() fallback OK WITHOUT attachment: to=$to envelope=$mail_envelope");
                echo json_encode([
                    'success' => true,
                    'message' => 'Email sent via mail() fallback (no attachment)',
                    'version' => $RELAY_VERSION,
                    'has_attachment' => false,
                    'smtp_error' => $result,
                ]);
            } else {
                http_response_code(500);
                relay_log("BOTH SMTP and mail() FAILED: to=$to smtp_error=$result");
                echo json_encode([
                    'success' => false,
                    'error' => 'Failed to send email',
                    'version' => $RELAY_VERSION,
                    'smtp_error' => $result,
                ]);
            }
        }
    } else {
        // Einfache Mail ohne Anhang
        $mailHeaders = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            "From: Naturheilpraxis Rauch <$mail_from_header>",
            "Reply-To: $from",
        ];
        $mailSuccess = @mail($to, $encodedSubject, $html, implode("\r\n", $mailHeaders), $mail_extra_params);
        
        if ($mailSuccess) {
            relay_log("mail() fallback OK: to=$to envelope=$mail_envelope");
            echo json_encode([
                'success' => true,
                'message' => 'Email sent via mail() fallback',
                'version' => $RELAY_VERSION,
                'smtp_error' => $result,
            ]);
        } else {
            http_response_code(500);
            relay_log("BOTH SMTP and mail() FAILED: to=$to smtp_error=$result");
            echo json_encode([
                'success' => false,
                'error' => 'Failed to send email',
                'version' => $RELAY_VERSION,
                'smtp_error' => $result,
            ]);
        }
    }
}
