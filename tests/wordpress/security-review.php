<?php
/** Isolated regression cases for the WordPress submission review. No production credentials. */
add_filter('pre_wp_mail', '__return_true');
$GLOBALS['vwconf_review_checks'] = 0;
function vwconf_review_check($value, $message) { $GLOBALS['vwconf_review_checks']++; if (!$value) throw new RuntimeException($message); }
$settings = ['socket' => 'http://127.0.0.1:8092', 'account' => 'wordpress_test', 'token' => 'local-wordpress-test-token'];
update_option('vwconf_settings', $settings);
$member_id = username_exists('vwconf_review_author');
if (!$member_id) $member_id = wp_create_user('vwconf_review_author', 'local-synthetic-password', 'author-review@example.test');
$member = get_userdata($member_id); $member->set_role('author');
$meeting_id = wp_insert_post(['post_type' => 'vwconf_meeting', 'post_status' => 'publish', 'post_title' => 'Authorization review fixture', 'post_author' => $member_id]);
update_post_meta($meeting_id, '_vwconf_access', 'public');
$issue = static fn($user, $role, $expires = 0) => VWCONF_Tickets::issue(wp_salt('auth'), 'wordpress_test', $user, vwconf_room($meeting_id), $role, 4, $expires, vwconf_access_policy($meeting_id));
$call = static function ($body) {
    $request = new WP_REST_Request('POST', '/videowhisper-conference/v1/auth');
    $request->set_header('Content-Type', 'application/json'); $request->set_body(wp_json_encode($body));
    return rest_do_request($request)->get_data()['login'] ?? false;
};
$input = static fn($user, $pin) => ['account' => 'wordpress_test', 'token' => 'local-wordpress-test-token', 'user' => $user, 'pin' => $pin];
$user = 'Member_' . $member_id; $host_pin = $issue($user, 'host');
vwconf_review_check($call($input($user, $host_pin)), 'Current meeting editor denied');
$member->set_role('subscriber');
vwconf_review_check(!$call($input($user, $host_pin)), 'Revoked host privilege retained at new authentication');
$member->set_role('author');
vwconf_review_check($call($input($user, $host_pin)), 'Restored editor permission denied');
$guest_pin = $issue($user, 'guest');
require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user($member_id, 1);
vwconf_review_check(!$call($input($user, $guest_pin)), 'Deleted member credential accepted');
vwconf_review_check(!$call($input('Guest_review', $issue('Guest_review', 'host'))), 'Non-member identity accepted as host');
vwconf_review_check($call($input('Guest_review', $issue('Guest_review', 'guest'))), 'Legitimate public guest denied');
vwconf_review_check(!$call($input('Guest_review', $issue('Guest_review', 'guest', time() - 1))), 'Expired guest credential accepted');
foreach ([null, false, 'invalid', [], ['account' => []], ['token' => []], ['pin' => []]] as $body) vwconf_review_check(!$call($body), 'Malformed authentication body accepted');
wp_set_current_user(1); do_action('admin_init');
$sanitize = get_registered_settings()['vwconf_settings']['sanitize_callback'];
foreach (['invalid', ['socket' => []], ['account' => []], ['token' => []]] as $bad) vwconf_review_check($sanitize($bad) === $settings, 'Malformed settings replaced existing configuration');
$valid = $sanitize(['socket' => 'https://signal.example.test', 'account' => 'wordpress_test', 'token' => '']);
vwconf_review_check($valid['token'] === $settings['token'] && $valid['socket'] === 'https://signal.example.test', 'Blank token retention or valid settings failed');
foreach (['https://signal.example.test/path', 'https://name:secret@signal.example.test', 'https://signal.example.test?x=1', 'https://signal.example.test#fragment'] as $bad) vwconf_review_check($sanitize(['socket' => $bad, 'account' => 'wordpress_test']) === $settings, 'Non-origin server URL accepted');
$before = vwconf_access_policy($meeting_id);
foreach ([['vwconf_access_nonce' => []], ['vwconf_access_nonce' => wp_create_nonce('vwconf_access'), 'vwconf_access' => []], ['vwconf_access_nonce' => 'invalid', 'vwconf_access' => 'private']] as $bad) {
    $_POST = $bad; do_action('save_post_vwconf_meeting', $meeting_id);
    vwconf_review_check(vwconf_access_policy($meeting_id) === $before, 'Malformed editor request changed access');
}
$_POST = [];
echo 'Submission security review: ' . $GLOBALS['vwconf_review_checks'] . " checks passed\n";
