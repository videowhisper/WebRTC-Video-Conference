<?php
/** Run after replacing the original ZIP with the review candidate. */
$checks = 0;
$check = static function ($ok, $message) use (&$checks) { $checks++; if (!$ok) throw new RuntimeException($message); };
$fixtures = json_decode(file_get_contents('/var/www/html/wp-content/vwc-tests/upgrade-fixtures.json'), true);
$check(vwconf_settings()['token'] === 'local-wordpress-test-token', 'Settings/token lost');
$check(get_option('vwc_settings', null) === null, 'Obsolete token copy retained');
wp_set_current_user(0); $_GET = [];
foreach ($fixtures as $mode => $expected) {
    $post = get_post($expected['id']);
    $check($post->post_type === 'vwconf_meeting', 'Post type not migrated');
    $check($post->post_name === $expected['slug'], 'Meeting slug changed');
    $check(vwconf_room($post->ID) === $expected['room'], 'Network room changed');
    $check(get_post_meta($post->ID, '_vwconf_access_key', true) === str_repeat('d', 64), 'Stored invitation key changed');
    $check(vwconf_access_mode($post->ID) === ($mode === 'legacy' ? 'public' : ($mode === 'trash' ? 'private' : $mode)), 'Room access mode changed');
    $check(vwconf_meeting_url($post) === str_replace('post_type=vwc_meeting', 'post_type=vwconf_meeting', $expected['url']), 'Frontend URL changed');
    $check(!metadata_exists('post', $post->ID, '_vwc_access_key'), 'Obsolete key copy retained');
    $check(vwconf_can_join($post) === in_array($mode, ['public', 'legacy'], true), 'Guest permissions changed');
    $_GET['key'] = str_repeat('d', 64);
    $check(vwconf_can_join($post) === ($mode !== 'members' && $mode !== 'trash'), 'Private key or unpublished permission changed');
    $_GET = [];
}
$check(has_action('admin_post_vwc_app', 'vwconf_app') !== false && has_action('admin_post_nopriv_vwc_app', 'vwconf_app') !== false, 'Legacy app routes lost');
$check(apply_filters('request', ['vwc_meeting' => 'upgrade-private']) === ['vwconf_meeting' => 'upgrade-private'], 'Legacy query variable lost');
delete_option('vwconf_schema_version'); vwconf_upgrade();
$check(count(get_posts(['post_type' => 'vwc_meeting', 'post_status' => array_keys(get_post_stati()), 'numberposts' => -1])) === 0, 'Migration not idempotent');
echo 'Prefix upgrade: ' . $checks . " checks passed\n";
