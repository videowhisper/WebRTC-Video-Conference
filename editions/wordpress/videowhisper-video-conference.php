<?php
/**
 * Plugin Name: VideoWhisper Video Conference
 * Description: Small group WebRTC video meetings with chat, screen sharing and a manually configured signaling server.
 * Version: 0.2.1
 * Requires at least: 6.9
 * Requires PHP: 8.2
 * Author: VideoWhisper.com
 * Author URI: https://videowhisper.com/
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: videowhisper-video-conference
 * Domain Path: /languages
 */
if (!defined('ABSPATH')) exit;
define('VWC_VERSION', '0.2.1');
require_once __DIR__ . '/includes/tickets.php';

function vwc_settings(): array { return (array) get_option('vwc_settings', []); }
function vwc_room(int $id): string { return 'WP_' . substr(hash('sha256', home_url('/')), 0, 16) . '_' . $id; }
require_once __DIR__ . '/includes/meetings.php';
add_action('admin_menu', function () {
    add_submenu_page('edit.php?post_type=vwc_meeting', __('Conference settings', 'videowhisper-video-conference'), __('Settings', 'videowhisper-video-conference'), 'manage_options', 'vwc-settings', 'vwc_settings_page');
});
add_action('admin_init', function () {
    register_setting('vwc_settings_group', 'vwc_settings', ['type' => 'array', 'sanitize_callback' => function ($input) {
        $old = vwc_settings(); $out = [];
        $url = esc_url_raw($input['socket'] ?? '', ['https']);
        // Local HTTP is deliberately limited to loopback for reproducible development.
        if (!$url && preg_match('#^http://(127\.0\.0\.1|localhost)(:\d+)?/?$#D', $input['socket'] ?? '')) $url = $input['socket'];
        if (!$url || wp_parse_url($url, PHP_URL_USER) || wp_parse_url($url, PHP_URL_QUERY) || wp_parse_url($url, PHP_URL_FRAGMENT)) {
            add_settings_error('vwc_settings', 'socket', __('Enter an HTTPS signaling server origin, without credentials, a query or a fragment.', 'videowhisper-video-conference'));
            return $old;
        }
        $out['socket'] = rtrim($url, '/');
        $out['account'] = sanitize_text_field($input['account'] ?? '');
        if (!preg_match('/^[a-zA-Z0-9_.-]+$/D', $out['account'])) return $old;
        $out['token'] = !empty($input['token']) ? sanitize_text_field($input['token']) : ($old['token'] ?? '');
        return $out;
    }]);
});
function vwc_settings_page(): void {
    if (!current_user_can('manage_options')) return;
    $settings = vwc_settings();
    echo '<div class="wrap"><h1>' . esc_html__('Video Conference settings', 'videowhisper-video-conference') . '</h1>';
    settings_errors('vwc_settings');
    echo '<p>' . esc_html__('Configure a dedicated VideoWhisper server account with the conference extension enabled. Manual setup does not register an account or contact the CRM.', 'videowhisper-video-conference') . '</p>';
    echo '<form method="post" action="options.php">'; settings_fields('vwc_settings_group');
    foreach (['socket' => __('Signaling server origin', 'videowhisper-video-conference'), 'account' => __('Account name', 'videowhisper-video-conference'), 'token' => __('Account token (leave blank to retain)', 'videowhisper-video-conference')] as $field => $label) {
        echo '<p><label for="vwc-' . esc_attr($field) . '">' . esc_html($label) . '</label><br><input class="regular-text" id="vwc-' . esc_attr($field) . '" name="vwc_settings[' . esc_attr($field) . ']" type="' . ($field === 'token' ? 'password' : 'text') . '" autocomplete="off" value="' . esc_attr($field === 'token' ? '' : ($settings[$field] ?? '')) . '"></p>';
    }
    submit_button(); echo '</form><h2>' . esc_html__('Server callback', 'videowhisper-video-conference') . '</h2><code>' . esc_url(rest_url('videowhisper-conference/v1/auth')) . '</code>';
    echo '<p>' . esc_html__('Set this URL as loginURL for a dedicated server account. Do not replace callbacks belonging to another plugin. The token stays on the server; browsers receive expiring room credentials.', 'videowhisper-video-conference') . '</p>';
    echo '<p>' . esc_html__('Create and publish a Video Conference, choose its access setting, then use Open conference and Invite. A shortcode is optional. Check the provider terms and privacy policy before enabling meetings.', 'videowhisper-video-conference') . '</p>';
    echo '<p><a href="https://webrtchost.com/">' . esc_html__('Optional managed hosting', 'videowhisper-video-conference') . '</a> | <a href="https://consult.videowhisper.com/">' . esc_html__('Setup help', 'videowhisper-video-conference') . '</a></p></div>';
}
add_shortcode('videowhisper_conference', function ($attributes) {
    $attributes = shortcode_atts(['id' => 0], $attributes, 'videowhisper_conference');
    $meeting = get_post(absint($attributes['id']));
    if (!$meeting || $meeting->post_type !== 'vwc_meeting') return '';
    if (!vwc_can_join($meeting)) return '<p>' . esc_html__('Open this meeting to sign in or enter its private access key.', 'videowhisper-video-conference') . ' <a href="' . esc_url(vwc_meeting_url($meeting)) . '">' . esc_html__('Open conference', 'videowhisper-video-conference') . '</a></p>';
    $settings = vwc_settings();
    if (empty($settings['socket']) || empty($settings['account']) || empty($settings['token'])) {
        $notice = '<p>' . esc_html__('Ask the administrator to configure the conference server.', 'videowhisper-video-conference');
        if (current_user_can('manage_options')) {
            $notice .= ' <a href="' . esc_url(admin_url('edit.php?post_type=vwc_meeting&page=vwc-settings')) . '">' . esc_html__('Conference settings', 'videowhisper-video-conference') . '</a>';
        }
        return $notice . '</p>';
    }
    $url = vwc_meeting_url($meeting);
    if (vwc_access_mode($meeting->ID) === 'private' && vwc_request_key()) $url = add_query_arg('key', vwc_request_key(), $url);
    return '<iframe title="' . esc_attr__('Video conference', 'videowhisper-video-conference') . '" src="' . esc_url($url) . '" allow="camera; microphone; display-capture; autoplay; fullscreen" style="width:100%;height:80vh;min-height:420px;border:0" loading="lazy"></iframe>';
});
// Public callback authenticates the Node server with the account token and verifies the signed, room-scoped PIN.
add_action('rest_api_init', function () {
    register_rest_route('videowhisper-conference/v1', '/auth', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => function (WP_REST_Request $request) {
        $settings = vwc_settings(); $input = $request->get_json_params();
        $result = is_array($input) ? VWC_Tickets::verify(wp_salt('auth'), $settings['token'] ?? '', $input) : ['login' => false];
        if (($input['account'] ?? '') !== ($settings['account'] ?? '')) $result = ['login' => false];
        if (!empty($result['login'])) {
            $prefix = 'WP_' . substr(hash('sha256', home_url('/')), 0, 16) . '_';
            $room = $result['conference']['room'];
            $id = str_starts_with($room, $prefix) ? absint(substr($room, strlen($prefix))) : 0;
            $meeting = get_post($id);
            if (!$meeting || $meeting->post_type !== 'vwc_meeting' || $meeting->post_status !== 'publish' || !hash_equals(vwc_access_policy($id), $result['conference']['policy'] ?? '')) $result = ['login' => false];
        }
        $response = new WP_REST_Response($result); $response->header('Cache-Control', 'no-store, private'); return $response;
    }]);
});
function vwc_app($meeting = null): void {
    if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
    // Read-only app rendering; access is checked against the meeting below.
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended
    $meeting = $meeting instanceof WP_Post ? $meeting : get_post(absint($_GET['meeting'] ?? 0));
    nocache_headers(); header('Cache-Control: no-store, private, max-age=0'); header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex, nofollow');
    if (!$meeting || $meeting->post_type !== 'vwc_meeting') { status_header(404); exit(esc_html__('This meeting does not exist. Check the invitation link.', 'videowhisper-video-conference')); }
    if (!vwc_can_join($meeting)) vwc_access_page($meeting);
    $settings = vwc_settings();
    if (empty($settings['socket']) || empty($settings['account']) || empty($settings['token'])) { status_header(503); exit(esc_html__('Ask the administrator to configure the conference server.', 'videowhisper-video-conference')); }
    nocache_headers(); header('Cache-Control: no-store, private, max-age=0'); header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex, nofollow');
    $role = current_user_can('edit_post', $meeting->ID) ? 'host' : 'guest';
    // A signed HttpOnly session cookie gives guests a stable identity across reloads without trusting user input.
    $cookie = 'vwc_guest_' . get_current_blog_id();
    $proof = isset($_COOKIE[$cookie]) ? sanitize_text_field(wp_unslash($_COOKIE[$cookie])) : '';
    $parts = explode('.', $proof);
    if (count($parts) !== 2 || !preg_match('/^[a-f0-9]{32}$/D', $parts[0]) || !hash_equals(hash_hmac('sha256', $parts[0], wp_salt('nonce')), $parts[1])) {
        $id = bin2hex(random_bytes(16)); $proof = $id . '.' . hash_hmac('sha256', $id, wp_salt('nonce'));
        setcookie($cookie, $proof, ['expires' => 0, 'path' => '/', 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax']);
    }
    $user = is_user_logged_in() ? 'Member_' . get_current_user_id() : 'Guest_' . substr(hash('sha256', $proof), 0, 24);
    $room = vwc_room($meeting->ID);
    $pin = VWC_Tickets::issue(wp_salt('auth'), $settings['account'], $user, $room, $role, 4, 0, vwc_access_policy($meeting->ID));
    $config = VWC_Tickets::config($settings['socket'], $settings['account'], $user, $pin, $room, get_the_title($meeting));
    $config['inviteUrl'] = vwc_meeting_url($meeting, true);
    $config['roomAccess'] = vwc_access_mode($meeting->ID);
    $config['displayName'] = is_user_logged_in() ? wp_get_current_user()->display_name : '';
    require __DIR__ . '/includes/labels.php'; $config['labels'] = vwc_labels();
    /** Change presentation settings only; authorization is always derived by the host callback. */
    $config = apply_filters('vwc_client_config', $config, $meeting);
    $assets = plugin_dir_url(__FILE__) . 'assets/';
    header('X-Content-Type-Options: nosniff');
    wp_enqueue_style('vwc-conference', $assets . 'conference.css', [], VWC_VERSION);
    wp_register_script('vwc-config', false, [], VWC_VERSION, true);
    wp_enqueue_script('vwc-conference', $assets . 'conference.js', ['wp-element', 'vwc-config'], VWC_VERSION, true);
    wp_add_inline_script('vwc-config', 'window.videowhisperConfig=' . wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';', 'before');
    add_filter('script_loader_tag', static function ($tag, $handle, $src) {
        return $handle === 'vwc-conference' ? wp_get_script_tag(['type' => 'module', 'src' => $src, 'id' => 'vwc-conference-js']) : $tag;
    }, 10, 3);
    ?><!doctype html><html <?php language_attributes(); ?>><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?php echo esc_html(get_the_title($meeting)); ?></title><?php wp_print_styles(['vwc-conference']); ?></head><body><div id="root"></div><?php wp_print_scripts(['vwc-conference']); ?></body></html><?php
    exit;
}
add_action('admin_post_vwc_app', 'vwc_app');
add_action('admin_post_nopriv_vwc_app', 'vwc_app');
