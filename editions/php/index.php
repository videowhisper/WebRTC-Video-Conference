<?php
/** PHP 8.2+ standalone meeting host. Keep environment configuration outside the webroot. */
require __DIR__ . '/includes/tickets.php';
require __DIR__ . '/includes/demo-state.php';
header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
$account = getenv('VWC_ACCOUNT') ?: '';
$token = getenv('VWC_ACCOUNT_TOKEN') ?: '';
$key = getenv('VWC_SIGNING_KEY') ?: '';
$socket = getenv('VWC_SOCKET_URL') ?: '';
$storage = getenv('VWC_STORAGE_DIR') ?: '';
$realStorage = realpath($storage) ?: '';
$webroot = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__) ?: __DIR__;
$outsideWebroot = $realStorage && $realStorage !== $webroot && !str_starts_with($realStorage, $webroot . DIRECTORY_SEPARATOR);
$ready = $outsideWebroot && $account && $token && strlen($key) >= 32 && $socket && is_writable($storage);
$e = static fn($text) => htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
$limits = VWC_DemoState::limits();
if (($_GET['action'] ?? '') === 'auth') {
    header('Content-Type: application/json');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !$ready) { http_response_code(403); echo '{"login":false}'; exit; }
    $input = json_decode(file_get_contents('php://input', false, null, 0, 16384), true);
    $result = is_array($input) ? VWC_Tickets::verify($key, $token, $input) : ['login' => false];
    if ($result['login']) {
        $ledger = is_file($storage . '/rooms.json') ? fopen($storage . '/rooms.json', 'r') : false;
        if (!$ledger || !flock($ledger, LOCK_SH)) $result = ['login' => false];
        else {
            $state = VWC_DemoState::prune(json_decode(stream_get_contents($ledger), true) ?: [], time(), $limits['idle']);
            if (!isset($state['rooms'][$result['conference']['room']])) $result = ['login' => false];
            flock($ledger, LOCK_UN);
        }
        if ($ledger) fclose($ledger);
    }
    echo json_encode($result); exit;
}
$secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
if (!$secure && !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) { http_response_code(400); exit('HTTPS required.'); }
session_name('vwc_demo');
session_set_cookie_params(['httponly' => true, 'secure' => $secure, 'samesite' => 'Lax']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(24));
$_SESSION['user'] ??= 'Guest_' . bin2hex(random_bytes(12));
$_SESSION['rooms'] ??= [];
$_SESSION['authorized'] ??= [];
$_SESSION['entry_config'] ??= [];
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
if (!preg_match('/^[a-zA-Z0-9.\-\[\]:]+$/D', $host)) $host = 'localhost';
$base = ($secure ? 'https://' : 'http://') . $host . strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
$error = ''; $config = null; $publicRooms = []; $roomInfo = null;
$inputRoom = (string) ($_POST['room'] ?? $_GET['room'] ?? '');
$accessKey = (string) ($_POST['key'] ?? $_GET['key'] ?? '');
// A pasted invitation is parsed locally; it never causes a remote request.
if (str_contains($inputRoom, '://') && strlen($inputRoom) <= 2048) {
    parse_str(parse_url($inputRoom, PHP_URL_QUERY) ?: '', $invitation);
    $inputRoom = is_string($invitation['room'] ?? null) ? $invitation['room'] : '';
    $accessKey = is_string($invitation['key'] ?? null) ? $invitation['key'] : '';
}
if (strlen($inputRoom) > 96 || strlen($accessKey) > 128) { $inputRoom = ''; $accessKey = ''; $error = 'Enter a valid room name or invitation link.'; }
if ($ready) {
    $file = fopen($storage . '/rooms.json', 'c+');
    if (!$file || !flock($file, LOCK_EX)) { http_response_code(503); exit('Meeting storage unavailable.'); }
    $state = json_decode(stream_get_contents($file), true) ?: ['rooms' => [], 'rates' => []];
    $now = time();
    $state = VWC_DemoState::prune($state, $now, $limits['idle']);
    $_SESSION['rooms'] = array_intersect_key($_SESSION['rooms'], $state['rooms']);
    $_SESSION['entry_config'] = array_intersect_key($_SESSION['entry_config'], $state['rooms']);
    $_SESSION['authorized'] = array_intersect_key(array_filter($_SESSION['authorized'], static fn($expires) => $expires > $now), $state['rooms']);
    if (($_GET['action'] ?? '') === 'presence') {
        $presence = json_decode(file_get_contents('php://input', false, null, 0, 4096), true);
        $room = is_string($presence['room'] ?? null) ? $presence['room'] : '';
        $valid = $_SERVER['REQUEST_METHOD'] === 'POST' && is_string($presence['csrf'] ?? null) && hash_equals($_SESSION['csrf'], $presence['csrf']) &&
            ($_SESSION['authorized'][$room] ?? 0) > $now && isset($state['rooms'][$room]);
        if ($valid) {
            $state['rooms'][$room]['lastActive'] = $now;
            $member = hash_hmac('sha256', $_SESSION['user'], $key);
            if (($presence['present'] ?? false) === true) {
                if (isset($state['rooms'][$room]['members'][$member]) || count($state['rooms'][$room]['members']) < 16) $state['rooms'][$room]['members'][$member] = $now;
            }
            else unset($state['rooms'][$room]['members'][$member]);
        }
        ftruncate($file, 0); rewind($file); fwrite($file, json_encode($state, JSON_INVALID_UTF8_SUBSTITUTE)); fflush($file); flock($file, LOCK_UN); fclose($file);
        header('Content-Type: application/json'); http_response_code($valid ? 200 : 403); echo json_encode(['ok' => $valid]); exit;
    }
    $room = $inputRoom;
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$error) {
        if (!is_string($_POST['csrf'] ?? null) || !hash_equals($_SESSION['csrf'], $_POST['csrf']) || empty($_POST['consent'])) {
            http_response_code(403); $error = 'Please confirm consent and try again.';
        } else {
            if (($_POST['operation'] ?? '') === 'create' || (!$room && !isset($_POST['operation']))) {
                $ip = hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? '', $key);
                $session = 'session:' . hash_hmac('sha256', $_SESSION['user'], $key);
                $denied = VWC_DemoState::creationError($state, $session, $ip, $now, $limits);
                if ($denied) {
                    $error = $denied['message']; http_response_code($denied['status']); header('Retry-After: ' . $denied['retry']);
                }
                else {
                    $room = 'Meeting_' . bin2hex(random_bytes(16));
                    $access = ($_POST['access'] ?? '') === 'public' ? 'public' : 'private';
                    $accessKey = $access === 'private' ? bin2hex(random_bytes(32)) : '';
                    $title = trim((string) ($_POST['title'] ?? ''));
                    $title = preg_match('/^.{1,80}/us', $title, $titleMatch) ? $titleMatch[0] : 'Video conference';
                    $state['rooms'][$room] = ['expires' => $now + 3600, 'lastActive' => $now, 'access' => $access, 'title' => $title,
                        'keyHash' => $accessKey ? hash('sha256', $accessKey) : '', 'members' => []];
                    $_SESSION['rooms'][$room] = ['key' => $accessKey];
                    foreach ([$session, $ip] as $id) {
                        $rate = $state['rates'][$id] ?? ['expires' => $now + 3600, 'count' => 0];
                        $rate['count']++; $state['rates'][$id] = $rate;
                    }
                }
            }
            if (!$error && (!preg_match('/^Meeting_[a-f0-9]{32}$/D', $room) || !isset($state['rooms'][$room]))) $error = 'This meeting does not exist or has expired. Ask its owner for a new invitation.';
            if (!$error) {
                $entry = $state['rooms'][$room];
                $isHost = isset($_SESSION['rooms'][$room]);
                if ($isHost && is_array($_SESSION['rooms'][$room])) $accessKey = $_SESSION['rooms'][$room]['key'] ?? '';
                if (!$isHost && !empty($entry['keyHash']) && !hash_equals($entry['keyHash'], hash('sha256', $accessKey))) {
                    http_response_code(403); $error = 'This private room requires its access key. Use the complete invitation link or enter the key below.';
                } else {
                    $_SESSION['authorized'][$room] = $entry['expires'];
                    $state['rooms'][$room]['lastActive'] = $now;
                    $pin = VWC_Tickets::issue($key, $account, $_SESSION['user'], $room, $isHost ? 'host' : 'guest', 4, $entry['expires']);
                    $config = VWC_Tickets::config($socket, $account, $_SESSION['user'], $pin, $room, $entry['title'] ?? 'Video conference');
                    $config['displayName'] = 'Guest ' . strtoupper(substr($_SESSION['user'], -4));
                    $config['roomAccess'] = $entry['access'] ?? 'private';
                    $config['inviteUrl'] = $base . '?' . http_build_query(array_filter(['room' => $room, 'key' => $accessKey], static fn($v) => $v !== ''));
                    $config['presenceUrl'] = $base . '?action=presence'; $config['presenceCsrf'] = $_SESSION['csrf'];
                }
            }
        }
    }
    // POST/redirect/GET keeps the invitation in the address bar and prevents refresh from creating another room.
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_SESSION['entry_config'][$room], $state['rooms'][$room])) {
        $entry = $state['rooms'][$room];
        if (isset($_SESSION['rooms'][$room]) || empty($entry['keyHash']) || hash_equals($entry['keyHash'], hash('sha256', $accessKey))) {
            $config = $_SESSION['entry_config'][$room]; $state['rooms'][$room]['lastActive'] = $now;
        }
    }
    $roomInfo = $state['rooms'][$room] ?? null;
    foreach ($state['rooms'] as $id => $entry) {
        if (($entry['access'] ?? '') === 'public' && count($entry['members']) > 0) $publicRooms[$id] = $entry;
    }
    ftruncate($file, 0); rewind($file); fwrite($file, json_encode($state, JSON_INVALID_UTF8_SUBSTITUTE)); fflush($file); flock($file, LOCK_UN); fclose($file);
    if ($config && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $_SESSION['entry_config'][$room] = $config;
        session_write_close(); header('Location: ' . $config['inviteUrl'], true, 303); exit;
    }
}
$csrf = $_SESSION['csrf'];
session_write_close();
$nonce = base64_encode(random_bytes(18));
$socketOrigin = parse_url($socket, PHP_URL_SCHEME) . '://' . parse_url($socket, PHP_URL_HOST) . (parse_url($socket, PHP_URL_PORT) ? ':' . parse_url($socket, PHP_URL_PORT) : '');
$wsOrigin = preg_replace('/^http/', 'ws', $socketOrigin);
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-$nonce'; style-src 'self'; connect-src 'self' $socketOrigin $wsOrigin; media-src 'self' blob:; img-src 'self' data:; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
$assetHashes = '';
foreach (['assets/conference.js', 'assets/conference.css', 'setup.css', 'setup.js', 'theme.js'] as $asset) $assetHashes .= is_file(__DIR__ . '/' . $asset) ? hash_file('sha256', __DIR__ . '/' . $asset) : '';
$assetVersion = substr(hash('sha256', $assetHashes), 0, 12);
$suggestedTitle = trim((string) ($_POST['title'] ?? '')) ?: 'Video meeting ' . strtoupper(bin2hex(random_bytes(2)));
$suggestedAccess = ($_POST['access'] ?? '') === 'public' ? 'public' : 'private';
$consent = 'I agree to connect to this site\'s configured signaling service. Other participants receive my display name and enabled media. TURN may relay media. Rooms expire after one hour, or after ' . (int) ceil($limits['idle'] / 60) . ' minutes without activity; chat is held in server memory while the room exists. Do not share sensitive information on this public demo.';
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VideoWhisper Video Conference</title><link rel="stylesheet" href="./assets/conference.css?v=<?php echo $e($assetVersion); ?>"><link rel="stylesheet" href="./setup.css?v=<?php echo $e($assetVersion); ?>"></head><body>
<?php if ($config): ?>
<div id="root"></div><script nonce="<?php echo $e($nonce); ?>">window.videowhisperConfig=<?php echo json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE); ?>;</script><script type="module" src="./assets/conference.js?v=<?php echo $e($assetVersion); ?>"></script>
<?php else: ?>
<main class="setup"><header class="setup-header"><a class="wordmark" href="<?php echo $e($base); ?>">VideoWhisper</a><button type="button" data-theme-toggle class="vwc-theme-toggle" aria-label="Theme: system. Switch to light." title="Theme: system. Switch to light."><span data-theme-icon aria-hidden="true">◐</span></button></header>
<h1>Video Conference</h1><p>Meet on your site. Share one invitation to bring up to four people into the same room, with screen sharing and chat.</p>
<?php if (!$ready): ?><p>Ask the administrator to configure the conference server. See the installation README.</p><?php else: ?>
<?php if ($error): ?><p class="setup-error" role="alert"><?php echo $e($error); ?></p><?php endif; ?>
<?php if ($inputRoom): ?>
<section class="setup-card"><h2>Join an existing room</h2><p>Use the same room invitation as the other participants. You will choose your name and media before joining.</p>
<form method="post"><input type="hidden" name="csrf" value="<?php echo $e($csrf); ?>"><input type="hidden" name="operation" value="join"><input type="hidden" name="room" value="<?php echo $e($inputRoom); ?>">
<label>Access key (for private rooms)<input name="key" value="<?php echo $e($accessKey); ?>" autocomplete="off" maxlength="128"></label>
<label class="consent"><input type="checkbox" name="consent" required> <?php echo $e($consent); ?></label><button type="submit">Open meeting</button></form></section>
<?php else: ?>
<div class="setup-columns"><section class="setup-card"><h2>Create a room</h2><p>Create once, then use Invite in the meeting to copy its link for everyone.</p>
<form method="post"><input type="hidden" name="csrf" value="<?php echo $e($csrf); ?>"><input type="hidden" name="operation" value="create">
<label>Room title<input name="title" maxlength="80" value="<?php echo $e($suggestedTitle); ?>"></label>
<label>Room access<select name="access"><option value="private" <?php echo $suggestedAccess === 'private' ? 'selected' : ''; ?>>Private — invitation with access key</option><option value="public" <?php echo $suggestedAccess === 'public' ? 'selected' : ''; ?>>Public — listed while participants are present</option></select></label>
<label class="consent"><input type="checkbox" name="consent" required> <?php echo $e($consent); ?></label><button type="submit">Create meeting</button></form></section>
<section class="setup-card"><h2>Have an invitation?</h2><p>Paste the invitation link or room name. Creating a new room will not join your existing meeting.</p>
<form method="post"><input type="hidden" name="csrf" value="<?php echo $e($csrf); ?>"><input type="hidden" name="operation" value="join"><label>Invitation link or room name<input name="room" required maxlength="2048" placeholder="Paste an invitation link"></label><label>Access key (if not in the link)<input name="key" autocomplete="off" maxlength="128"></label><label class="consent"><input type="checkbox" name="consent" required> <?php echo $e($consent); ?></label><button type="submit">Open meeting</button></form></section></div>
<section class="setup-card"><h2>Active public rooms</h2><p>Public rooms appear after someone joins. Presence refreshes every 20 seconds and clears within a minute after an interrupted connection. Private rooms are never listed.</p>
<?php if (!$publicRooms): ?><p>No public rooms have participants right now. Create one or use an invitation.</p><?php else: ?><ul class="public-rooms"><?php foreach ($publicRooms as $id => $entry): ?><li><a href="?room=<?php echo $e($id); ?>"><?php echo $e($entry['title']); ?></a><span><?php echo count($entry['members']); ?> present</span></li><?php endforeach; ?></ul><?php endif; ?><a href="<?php echo $e($base); ?>">Refresh public rooms</a></section>
<?php endif; ?>
<?php endif; ?>
<footer><a href="https://webrtchost.com/">WebRTC hosting</a> · <a href="https://site2stream.com/live/">Turnkey live streaming sites</a> · <a href="https://consult.videowhisper.com/">Setup help and abuse reports</a></footer></main>
<script type="module" src="./setup.js?v=<?php echo $e($assetVersion); ?>"></script>
<?php endif; ?></body></html>
