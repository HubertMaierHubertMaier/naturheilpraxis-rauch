<?php
/**
 * E-Mail Relay Endpoint für Naturheilpraxis Rauch
 * 
 * Dieses Skript empfängt HTTPS-Anfragen von der Lovable Cloud Edge Function
 * und versendet E-Mails lokal über den Server.
 * 
 * INSTALLATION:
 * 1. Diese Datei auf Ihren Server kopieren nach: /var/www/vhosts/rauch-heilpraktiker.de/httpdocs/api/send-email.php
 * 2. Den RELAY_SECRET Wert unten durch denselben Wert ersetzen, den Sie in Lovable Cloud eingegeben haben
 * 3. Sicherstellen, dass das Verzeichnis /api/ existiert
 * 
 * SICHERHEIT:
 * - Das Skript akzeptiert nur POST-Anfragen
 * - Nur Anfragen mit gültigem X-Relay-Token werden verarbeitet
 * - Alle Eingaben werden validiert und sanitized
 */

// Erhöhen, wenn Sie eine neue Version deployen (zum Abgleich, ob wirklich das richtige Script live ist)
$RELAY_VERSION = '2026-01-29-v2';

// CORS Headers für Edge Function Zugriff
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Relay-Token');

// Minimaler Debug-Log (Server-seitig). Datei muss beschreibbar sein.
function relay_log($message) {
    $line = '[' . date('c') . '] ' . $message . "\n";
    // Log im selben Verzeichnis wie das Script
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
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    relay_log('Invalid JSON: remote=' . ($_SERVER['REMOTE_ADDR'] ?? '-') . ' raw=' . substr($input, 0, 500));
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

relay_log('Accepted: to=' . $to . ' from=' . ($from ?: '-') . ' subject=' . $subject);

// E-Mail Header
$headers = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: Naturheilpraxis Rauch <' . $from . '>',
    'Reply-To: ' . $from,
    'X-Mailer: PHP/' . phpversion()
];

// E-Mail senden
// Envelope-From explizit setzen, um unerwünschtes Umschreiben zu vermeiden
$envelopeFrom = $from ?: 'info@rauch-heilpraktiker.de';
$success = mail($to, $subject, $html, implode("\r\n", $headers), '-f ' . escapeshellarg($envelopeFrom));

if ($success) {
    relay_log('Mail OK: to=' . $to . ' envelopeFrom=' . $envelopeFrom);
    echo json_encode([
        'success' => true,
        'message' => 'Email sent',
        'version' => $RELAY_VERSION,
        'received_to' => $to,
        'received_from' => $from,
        'envelope_from' => $envelopeFrom,
    ]);
} else {
    http_response_code(500);
    relay_log('Mail FAIL: to=' . $to . ' envelopeFrom=' . $envelopeFrom);
    echo json_encode(['success' => false, 'error' => 'Failed to send email', 'version' => $RELAY_VERSION]);
}
