<?php
/**
 * E-Mail Relay Endpoint für Naturheilpraxis Rauch - VERSION 2
 * 
 * WICHTIG: Diese Datei muss auf dem Server unter /mail-relay.php liegen!
 * 
 * INSTALLATION:
 * 1. Diese Datei auf Ihren Server kopieren nach: /var/www/vhosts/rauch-heilpraktiker.de/httpdocs/mail-relay.php
 * 2. Den RELAY_SECRET Wert unten durch denselben Wert ersetzen, den Sie in Lovable Cloud eingegeben haben
 */

// ===== VERSION MARKER =====
// Wenn diese Version läuft, erscheint "version": "2026-02-21-v4" in der Response
$RELAY_VERSION = '2026-02-21-v4';

// CORS Headers für Edge Function Zugriff
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Relay-Token');

// Debug-Log Funktion - schreibt nach mail-debug.log im selben Verzeichnis
function relay_log($message) {
    $line = '[' . date('c') . '] ' . $message . "\n";
    @file_put_contents(__DIR__ . '/mail-debug.log', $line, FILE_APPEND);
}

// OPTIONS Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Nur POST erlauben
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed', 'version' => $RELAY_VERSION]);
    exit;
}

// ============================================
// WICHTIG: Ersetzen Sie diesen Wert durch Ihr Secret!
// ============================================
$RELAY_SECRET = getenv('RELAY_SECRET') ?: '';

// Token validieren
$token = $_SERVER['HTTP_X_RELAY_TOKEN'] ?? '';
if (empty($token) || !hash_equals($RELAY_SECRET, $token)) {
    http_response_code(401);
    relay_log('Unauthorized request: remote=' . ($_SERVER['REMOTE_ADDR'] ?? '-') . ' ua=' . ($_SERVER['HTTP_USER_AGENT'] ?? '-'));
    echo json_encode(['success' => false, 'error' => 'Unauthorized', 'version' => $RELAY_VERSION]);
    exit;
}

// JSON Body lesen
$input = file_get_contents('php://input');

// Check for empty input (might indicate post_max_size exceeded)
if (empty($input)) {
    http_response_code(400);
    $contentLength = $_SERVER['CONTENT_LENGTH'] ?? 'unknown';
    $postMaxSize = ini_get('post_max_size');
    relay_log("Empty input! CONTENT_LENGTH={$contentLength} post_max_size={$postMaxSize}");
    echo json_encode(['success' => false, 'error' => "Empty request body (Content-Length: {$contentLength}, post_max_size: {$postMaxSize})", 'version' => $RELAY_VERSION]);
    exit;
}

$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    relay_log('Invalid JSON: remote=' . ($_SERVER['REMOTE_ADDR'] ?? '-') . ' input_len=' . strlen($input) . ' raw=' . substr($input, 0, 500));
    echo json_encode(['success' => false, 'error' => 'Invalid JSON', 'version' => $RELAY_VERSION]);
    exit;
}

// Pflichtfelder prüfen
$to = filter_var($data['to'] ?? '', FILTER_VALIDATE_EMAIL);
$subject = trim($data['subject'] ?? '');
$html = $data['html'] ?? '';
$from = filter_var($data['from'] ?? 'info@rauch-heilpraktiker.de', FILTER_VALIDATE_EMAIL);

if (!$to || !$subject || !$html) {
    http_response_code(400);
    relay_log('Missing fields: to=' . ($data['to'] ?? '-') . ' subject_len=' . strlen($subject) . ' html_len=' . strlen((string)$html));
    echo json_encode(['success' => false, 'error' => 'Missing required fields: to, subject, html', 'version' => $RELAY_VERSION]);
    exit;
}

relay_log('Accepted: to=' . $to . ' from=' . ($from ?: '-') . ' subject=' . $subject . ' has_attachment=' . (isset($data['attachment']) ? 'yes' : 'no'));

// Subject encoding
if (strpos($subject, '=?UTF-8?') === 0) {
    $encodedSubject = $subject;
} else {
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

$envelopeFrom = $from ?: 'info@rauch-heilpraktiker.de';
// WICHTIG: KEIN escapeshellarg() verwenden!
// escapeshellarg() erzeugt: -f 'email@domain.de' (mit Anführungszeichen)
// Auf diesem Server interpretiert der MTA die Anführungszeichen falsch,
// wodurch die Mail nicht an $to zugestellt wird, sondern lokal an die
// Default-Mailbox (info@) geroutet wird.
$additionalParams = '-f ' . $envelopeFrom;

// Check if attachment is present
$attachment = $data['attachment'] ?? null;

if ($attachment && !empty($attachment['base64']) && !empty($attachment['filename'])) {
    // Multipart MIME email with attachment
    $boundary = '----=_Part_' . md5(uniqid(microtime(true)));
    
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
        'From: Naturheilpraxis Rauch <' . $from . '>',
        'Reply-To: ' . $from,
        'X-Mailer: PHP/' . phpversion()
    ];
    
    $body = '--' . $boundary . "\r\n";
    $body .= 'Content-Type: text/html; charset=UTF-8' . "\r\n";
    $body .= 'Content-Transfer-Encoding: 8bit' . "\r\n\r\n";
    $body .= $html . "\r\n\r\n";
    
    $body .= '--' . $boundary . "\r\n";
    $contentType = $attachment['contentType'] ?? 'application/octet-stream';
    $filename = $attachment['filename'];
    $body .= 'Content-Type: ' . $contentType . '; name="' . $filename . '"' . "\r\n";
    $body .= 'Content-Disposition: attachment; filename="' . $filename . '"' . "\r\n";
    $body .= 'Content-Transfer-Encoding: base64' . "\r\n\r\n";
    $body .= chunk_split($attachment['base64']) . "\r\n";
    
    $body .= '--' . $boundary . '--';
    
    $success = @mail($to, $encodedSubject, $body, implode("\r\n", $headers), $additionalParams);
    $lastError = error_get_last();
    relay_log('Multipart mail ' . ($success ? 'OK' : 'FAIL') . ': to=' . $to . ' attachment=' . $filename . ' body_len=' . strlen($body) . ' base64_len=' . strlen($attachment['base64']) . ($lastError ? ' error=' . $lastError['message'] : ''));
} else {
    // Simple HTML email (no attachment)
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        'From: Naturheilpraxis Rauch <' . $from . '>',
        'Reply-To: ' . $from,
        'X-Mailer: PHP/' . phpversion()
    ];
    
    $success = mail($to, $encodedSubject, $html, implode("\r\n", $headers), $additionalParams);
    relay_log('Simple mail ' . ($success ? 'OK' : 'FAIL') . ': to=' . $to);
}

if ($success) {
    echo json_encode([
        'success' => true,
        'message' => 'Email sent',
        'version' => $RELAY_VERSION,
        'has_attachment' => !empty($attachment),
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to send email', 'version' => $RELAY_VERSION]);
}
