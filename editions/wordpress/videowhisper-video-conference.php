<?php
/**
 * Plugin Name: VideoWhisper Video Conference
 * Description: Small group WebRTC video meetings with push to talk, chat, screen sharing and optional turnkey streaming setup.
 * Version: 0.7.0
 * Requires at least: 6.9
 * Requires PHP: 8.2
 * Author: VideoWhisper.com
 * Author URI: https://videowhisper.com/
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: videowhisper-video-conference
 */
if (!defined('ABSPATH')) exit;
define('VWCONF_VERSION', '0.7.0');
require_once __DIR__ . '/includes/tickets.php';

function vwconf_settings(): array { return (array) get_option('vwconf_settings', []); }
function vwconf_room(int $id): string { return 'WP_' . substr(hash('sha256', home_url('/')), 0, 16) . '_' . $id; }
require_once __DIR__ . '/includes/upgrade.php';
require_once __DIR__ . '/includes/access.php';
require_once __DIR__ . '/includes/app-settings.php';
require_once __DIR__ . '/includes/meetings.php';
require_once __DIR__ . '/includes/management.php';
require_once __DIR__ . '/includes/admin.php';
require_once __DIR__ . '/includes/connect.php';
add_action('admin_menu', function () {
    add_submenu_page('edit.php?post_type=vwconf_meeting', __('Conference settings', 'videowhisper-video-conference'), __('Settings', 'videowhisper-video-conference'), 'manage_options', 'vwconf-settings', 'vwconf_settings_page');
});
add_action('admin_init', function () {
    register_setting('vwconf_settings_group', 'vwconf_settings', ['type' => 'array', 'sanitize_callback' => function ($input) {
        $old = vwconf_settings(); $out = $old;
        if (!is_array($input)) return $old;
        foreach (['socket', 'account', 'token'] as $field) if (isset($input[$field]) && !is_string($input[$field])) return $old;
        $url = esc_url_raw($input['socket'] ?? '', ['https']);
        // Local HTTP is deliberately limited to loopback for reproducible development.
        if (!$url && preg_match('#^http://(127\.0\.0\.1|localhost)(:\d+)?/?$#D', $input['socket'] ?? '')) $url = $input['socket'];
        if (!$url || !wp_parse_url($url, PHP_URL_HOST) || wp_parse_url($url, PHP_URL_USER) || wp_parse_url($url, PHP_URL_PASS) ||
            !in_array(wp_parse_url($url, PHP_URL_PATH), [null, '', '/'], true) || wp_parse_url($url, PHP_URL_QUERY) || wp_parse_url($url, PHP_URL_FRAGMENT)) {
            add_settings_error('vwconf_settings', 'socket', __('Enter an HTTPS signaling server origin, without credentials, a query or a fragment.', 'videowhisper-video-conference'));
            return $old;
        }
        $out['socket'] = rtrim($url, '/');
        $out['account'] = sanitize_text_field($input['account'] ?? '');
        if (!preg_match('/^[a-zA-Z0-9_.-]+$/D', $out['account'])) return $old;
        $out['token'] = !empty($input['token']) ? sanitize_text_field($input['token']) : ($old['token'] ?? '');
        return $out;
    }]);
});
function vwconf_settings_page(): void {
    if (!current_user_can('manage_options')) return;
    $settings = vwconf_settings();
    echo '<div class="wrap"><h1>' . esc_html__('Video Conference settings', 'videowhisper-video-conference') . '</h1>';
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only allowlisted tab selection.
    $tab = isset($_GET['tab']) && is_string($_GET['tab']) && in_array($_GET['tab'], ['settings', 'connect', 'app', 'access', 'pages'], true) ? sanitize_key(wp_unslash($_GET['tab'])) : 'settings';
    echo '<nav class="nav-tab-wrapper" aria-label="' . esc_attr__('Conference settings tabs', 'videowhisper-video-conference') . '">';
    foreach (['settings' => __('Manual server settings', 'videowhisper-video-conference'), 'connect' => __('VideoWhisper connection', 'videowhisper-video-conference'), 'app' => __('App', 'videowhisper-video-conference'), 'access' => __('Access', 'videowhisper-video-conference'), 'pages' => __('Pages', 'videowhisper-video-conference')] as $key => $label) {
        echo '<a class="nav-tab ' . ($tab === $key ? 'nav-tab-active' : '') . '" href="' . esc_url(add_query_arg(['post_type' => 'vwconf_meeting', 'page' => 'vwconf-settings', 'tab' => $key], admin_url('edit.php'))) . '">' . esc_html($label) . '</a>';
    }
    echo '</nav>';
    if ($tab === 'connect') { \VWCONF\StreamingConnect\Connection::render(); echo '</div>'; return; }
    if ($tab === 'access') { vwconf_access_tab(); echo '</div>'; return; }
    if ($tab === 'app') { vwconf_app_tab(); echo '</div>'; return; }
    if ($tab === 'pages') { vwconf_pages_tab(); echo '</div>'; return; }
    settings_errors('vwconf_settings');
    echo '<p>' . esc_html__('Configure a dedicated VideoWhisper server account with the conference extension enabled. Manual setup does not register an account or contact the CRM.', 'videowhisper-video-conference') . '</p>';
    echo '<p><a class="button button-secondary" href="' . esc_url(admin_url('edit.php?post_type=vwconf_meeting&page=vwconf-settings&tab=connect')) . '">' . esc_html__('Turnkey streaming setup with VideoWhisper', 'videowhisper-video-conference') . '</a></p><p>' . esc_html__('Use the VideoWhisper connection tab to request a free trial streaming account where offered, or connect an existing paid account and configure compatible server settings automatically. Manual setup remains available below.', 'videowhisper-video-conference') . '</p>';
    echo '<form method="post" action="options.php">'; settings_fields('vwconf_settings_group');
    foreach (['socket' => __('Signaling server origin', 'videowhisper-video-conference'), 'account' => __('Account name', 'videowhisper-video-conference'), 'token' => __('Account token (leave blank to retain)', 'videowhisper-video-conference')] as $field => $label) {
        echo '<p><label for="vwconf-' . esc_attr($field) . '">' . esc_html($label) . '</label><br><input class="regular-text" id="vwconf-' . esc_attr($field) . '" name="vwconf_settings[' . esc_attr($field) . ']" type="' . ($field === 'token' ? 'password' : 'text') . '" autocomplete="off" value="' . esc_attr($field === 'token' ? '' : ($settings[$field] ?? '')) . '"></p>';
    }
    submit_button(); echo '</form><h2>' . esc_html__('Server callback', 'videowhisper-video-conference') . '</h2><code>' . esc_url(rest_url('videowhisper-conference/v1/auth')) . '</code>';
    echo '<p>' . esc_html__('Set this URL as loginURL for a dedicated server account. Do not replace callbacks belonging to another plugin. The token stays on the server; browsers receive expiring room credentials.', 'videowhisper-video-conference') . '</p>';
    echo '<p>' . esc_html__('Create and publish a Video Conference, choose its access setting, then use Open conference and Invite. A shortcode is optional. Check the provider terms and privacy policy before enabling meetings.', 'videowhisper-video-conference') . '</p>';
    echo '<p><a href="https://webrtchost.com/">' . esc_html__('Optional managed hosting', 'videowhisper-video-conference') . '</a> | <a href="https://consult.videowhisper.com/">' . esc_html__('Setup help', 'videowhisper-video-conference') . '</a></p></div>';
}
add_shortcode('videowhisper_conference', function ($attributes) {
    $attributes = shortcode_atts(['id' => 0], $attributes, 'videowhisper_conference');
    $meeting = get_post(absint($attributes['id']));
    if (!$meeting || $meeting->post_type !== 'vwconf_meeting') return '';
    if (!vwconf_can_join($meeting)) return '<p>' . esc_html__('Open this meeting to sign in or enter its private access key.', 'videowhisper-video-conference') . ' <a href="' . esc_url(vwconf_meeting_url($meeting)) . '">' . esc_html__('Open conference', 'videowhisper-video-conference') . '</a></p>';
    $settings = vwconf_settings();
    if (empty($settings['socket']) || empty($settings['account']) || empty($settings['token'])) {
        $notice = '<p>' . esc_html__('Ask the administrator to configure the conference server.', 'videowhisper-video-conference');
        if (current_user_can('manage_options')) {
            $notice .= ' <a href="' . esc_url(admin_url('edit.php?post_type=vwconf_meeting&page=vwconf-settings')) . '">' . esc_html__('Conference settings', 'videowhisper-video-conference') . '</a>';
        }
        return $notice . '</p>';
    }
    $url = vwconf_meeting_url($meeting);
    if (vwconf_access_mode($meeting->ID) === 'private' && vwconf_request_key()) $url = add_query_arg('key', vwconf_request_key(), $url);
    return '<iframe title="' . esc_attr__('Video conference', 'videowhisper-video-conference') . '" src="' . esc_url($url) . '" allow="camera; microphone; display-capture; autoplay; fullscreen" style="width:100%;height:' . esc_attr(vwconf_app_settings()['embed_height']) . ';min-height:420px;border:0" loading="lazy"></iframe>';
});
// Public callback authenticates the Node server with the account token and verifies the signed, room-scoped PIN.
add_action('rest_api_init', function () {
    register_rest_route('videowhisper-conference/v1', '/auth', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => function (WP_REST_Request $request) {
        $settings = vwconf_settings(); $input = $request->get_json_params();
        $result = is_array($input) ? VWCONF_Tickets::verify(wp_salt('auth'), $settings['token'] ?? '', $input) : ['login' => false];
        if (($input['account'] ?? '') !== ($settings['account'] ?? '')) $result = ['login' => false];
        if (!empty($result['login'])) {
            $prefix = 'WP_' . substr(hash('sha256', home_url('/')), 0, 16) . '_';
            $room = $result['conference']['room'];
            $id = str_starts_with($room, $prefix) ? absint(substr($room, strlen($prefix))) : 0;
            $meeting = get_post($id);
            if (!$meeting || $meeting->post_type !== 'vwconf_meeting' || $meeting->post_status !== 'publish' || !hash_equals(vwconf_access_policy($id), $result['conference']['policy'] ?? '')) $result = ['login' => false];
            if (!empty($result['login'])) {
                // Signed claims cannot retain host privileges after WordPress revokes them.
                $member_id = preg_match('/^Member_([1-9][0-9]*)$/D', $input['user'], $member) ? (int) $member[1] : 0;
                if (!vwconf_claim_allowed($meeting, $member_id, $result['conference']['role'])) $result = ['login' => false];
            }
        }
        $response = new WP_REST_Response($result); $response->header('Cache-Control', 'no-store, private'); return $response;
    }]);
});
function vwconf_app($meeting = null): void {
    // Cache-plugin interoperability flag: its established name must remain unchanged.
    // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound
    if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
    // Read-only app rendering; access is checked against the meeting below.
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended
    $meeting = $meeting instanceof WP_Post ? $meeting : get_post(isset($_GET['meeting']) && is_string($_GET['meeting']) ? absint($_GET['meeting']) : 0);
    nocache_headers(); header('Cache-Control: no-store, private, max-age=0'); header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex, nofollow');
    if (!$meeting || $meeting->post_type !== 'vwconf_meeting') { status_header(404); exit(esc_html__('This meeting does not exist. Check the invitation link.', 'videowhisper-video-conference')); }
    if (!vwconf_can_join($meeting)) vwconf_access_page($meeting);
    $settings = vwconf_settings();
    if (empty($settings['socket']) || empty($settings['account']) || empty($settings['token'])) { status_header(503); exit(esc_html__('Ask the administrator to configure the conference server.', 'videowhisper-video-conference')); }
    nocache_headers(); header('Cache-Control: no-store, private, max-age=0'); header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex, nofollow');
    $role = current_user_can('edit_post', $meeting->ID) ? 'host' : 'guest';
    // A signed HttpOnly session cookie gives guests a stable identity across reloads without trusting user input.
    $cookie = 'vwconf_guest_' . get_current_blog_id();
    $proof = isset($_COOKIE[$cookie]) ? sanitize_text_field(wp_unslash($_COOKIE[$cookie])) : '';
    $parts = explode('.', $proof);
    if (count($parts) !== 2 || !preg_match('/^[a-f0-9]{32}$/D', $parts[0]) || !hash_equals(hash_hmac('sha256', $parts[0], wp_salt('nonce')), $parts[1])) {
        $id = bin2hex(random_bytes(16)); $proof = $id . '.' . hash_hmac('sha256', $id, wp_salt('nonce'));
        setcookie($cookie, $proof, ['expires' => 0, 'path' => '/', 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax']);
    }
    $user = is_user_logged_in() ? 'Member_' . get_current_user_id() : 'Guest_' . substr(hash('sha256', $proof), 0, 24);
    $room = vwconf_room($meeting->ID);
    $pin = VWCONF_Tickets::issue(wp_salt('auth'), $settings['account'], $user, $room, $role, (int) vwconf_app_settings()['participants'], 0, vwconf_access_policy($meeting->ID));
    $config = VWCONF_Tickets::config($settings['socket'], $settings['account'], $user, $pin, $room, get_the_title($meeting));
    $config = vwconf_app_config($config);
    $config['inviteUrl'] = vwconf_meeting_url($meeting, true);
    $config['roomAccess'] = vwconf_access_mode($meeting->ID);
    $config['displayName'] = is_user_logged_in() ? wp_get_current_user()->display_name : '';
    require __DIR__ . '/includes/labels.php'; $config['labels'] = vwconf_labels();
    /** Change presentation settings only; authorization is always derived by the host callback. */
    $config = apply_filters('vwconf_client_config', $config, $meeting);
    $assets = plugin_dir_url(__FILE__) . 'assets/';
    header('X-Content-Type-Options: nosniff');
    wp_enqueue_style('vwconf-conference', $assets . 'conference.css', [], VWCONF_VERSION);
    wp_register_script('vwconf-config', false, [], VWCONF_VERSION, true);
    wp_enqueue_script('vwconf-conference', $assets . 'conference.js', ['wp-element', 'vwconf-config'], VWCONF_VERSION, true);
    wp_add_inline_script('vwconf-config', 'window.videowhisperConfig=' . wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';', 'before');
    add_filter('script_loader_tag', static function ($tag, $handle, $src) {
        return $handle === 'vwconf-conference' ? wp_get_script_tag(['type' => 'module', 'src' => $src, 'id' => 'vwconf-conference-js']) : $tag;
    }, 10, 3);
    ?><!doctype html><html <?php language_attributes(); ?>><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?php echo esc_html(get_the_title($meeting)); ?></title><?php wp_print_styles(['vwconf-conference']); ?></head><body><div id="root"></div><?php wp_print_scripts(['vwconf-conference']); ?></body></html><?php
    exit;
}
add_action('admin_post_vwconf_app', 'vwconf_app');
add_action('admin_post_nopriv_vwconf_app', 'vwconf_app');

// Compatibility routes for invitations issued by pre-directory demo builds.
add_action('admin_post_vwc_app', 'vwconf_app');
add_action('admin_post_nopriv_vwc_app', 'vwconf_app');
