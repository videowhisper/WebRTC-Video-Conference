<?php
/** Run with the original 0.2.4 ZIP installed in a disposable database. */
wp_set_current_user(1);
delete_option('vwconf_schema_version');
// Repeated harness runs restore a clean fixture instead of downgrading migrated data.
foreach (['vwc_meeting', 'vwconf_meeting'] as $type) {
    foreach (get_posts(['post_type' => $type, 'post_status' => array_keys(get_post_stati()), 'numberposts' => -1, 'fields' => 'ids', 'suppress_filters' => true]) as $id) wp_delete_post($id, true);
}
update_option('vwc_settings', ['socket' => 'http://127.0.0.1:8092', 'account' => 'wordpress_test', 'token' => 'local-wordpress-test-token']);
$fixtures = [];
foreach (['members', 'public', 'private', 'legacy', 'trash'] as $mode) {
    $id = wp_insert_post(['post_type' => 'vwc_meeting', 'post_status' => $mode === 'trash' ? 'trash' : 'publish', 'post_title' => 'Upgrade fixture ' . $mode, 'post_name' => 'upgrade-' . $mode, 'post_author' => 1]);
    if ($mode === 'legacy') update_post_meta($id, '_vwc_guests', '1');
    else update_post_meta($id, '_vwc_access', $mode === 'trash' ? 'private' : $mode);
    update_post_meta($id, '_vwc_access_key', str_repeat('d', 64));
    $fixtures[$mode] = ['id' => $id, 'slug' => get_post($id)->post_name, 'room' => vwc_room($id), 'policy' => vwc_access_policy($id), 'url' => vwc_meeting_url(get_post($id))];
}
file_put_contents('/var/www/html/wp-content/vwc-tests/upgrade-fixtures.json', wp_json_encode($fixtures));
echo "Legacy upgrade fixture seeded\n";
