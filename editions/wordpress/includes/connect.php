<?php
/** Product-specific mapping over the separately bundled streaming Connect contract. */
if (!defined('ABSPATH')) exit;
require_once __DIR__ . '/class-streaming-connect.php';

function vwconf_validate_streaming_settings(array $settings): array {
    foreach (['vwsSocket', 'vwsAccount', 'vwsToken'] as $key) {
        if (!isset($settings[$key]) || !is_string($settings[$key])) throw new RuntimeException('invalid_streaming_settings');
    }
    $url = wp_parse_url($settings['vwsSocket']);
    if (!is_array($url) || ($url['scheme'] ?? '') !== 'https' || empty($url['host']) ||
        isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment']) || !in_array($url['path'] ?? '', ['', '/'], true) ||
        !preg_match('/\A[A-Za-z0-9_.-]{1,96}\z/', $settings['vwsAccount']) || strlen($settings['vwsToken']) < 8 || strlen($settings['vwsToken']) > 512 ||
        preg_match('/[\x00-\x20\x7f]/', $settings['vwsToken'])) throw new RuntimeException('invalid_streaming_settings');
    return ['socket' => rtrim(esc_url_raw($settings['vwsSocket'], ['https']), '/'), 'account' => $settings['vwsAccount'], 'token' => $settings['vwsToken']];
}
function vwconf_import_streaming_settings(array $settings): void {
    $mapped = vwconf_validate_streaming_settings($settings);
    update_option('vwconf_settings', array_replace(vwconf_settings(), $mapped), false);
}
\VWCONF\StreamingConnect\Connection::boot([
    'slug' => 'videowhisper-video-conference',
    'name' => 'VideoWhisper Video Conference',
    'option' => 'vwconf_crm_connection',
    'action' => 'vwconf_crm_connection',
    'page' => 'edit.php?post_type=vwconf_meeting&page=vwconf-settings&tab=connect',
    'properties' => static fn() => ['loginURL' => rest_url('videowhisper-conference/v1/auth')],
    'import' => 'vwconf_import_streaming_settings',
    'validate' => 'vwconf_validate_streaming_settings',
]);
