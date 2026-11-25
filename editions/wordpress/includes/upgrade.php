<?php
/** Migrate pre-directory demo identifiers without changing room IDs or invitations. */
if (!defined('ABSPATH')) exit;
function vwconf_upgrade(): void {
    if (get_option('vwconf_schema_version') === '1') return;
    $previous = get_option('vwc_settings', null);
    if (is_array($previous) && get_option('vwconf_settings', null) === null) {
        if (!add_option('vwconf_settings', $previous, '', false)) return;
    }
    // Scope migration to this plugin's old post type, including drafts and trash.
    // A one-time data migration must include every locale, not a frontend filtered subset.
    // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.SuppressFilters_suppress_filters
    $ids = get_posts(['post_type' => 'vwc_meeting', 'post_status' => array_keys(get_post_stati()), 'numberposts' => -1, 'fields' => 'ids', 'suppress_filters' => true]);
    foreach ($ids as $id) {
        foreach (['access', 'access_key', 'guests'] as $field) {
            $old = '_vwc_' . $field; $new = '_vwconf_' . $field;
            if (metadata_exists('post', $id, $old) && !metadata_exists('post', $id, $new)) {
                if (!add_post_meta($id, $new, get_post_meta($id, $old, true), true)) return;
            }
        }
        if (is_wp_error(wp_update_post(['ID' => $id, 'post_type' => 'vwconf_meeting'], true))) return;
        foreach (['access', 'access_key', 'guests'] as $field) delete_post_meta($id, '_vwc_' . $field);
    }
    if (is_array($previous) && get_option('vwconf_settings', null) !== null) delete_option('vwc_settings');
    delete_option('vwc_rewrite_version');
    update_option('vwconf_schema_version', '1', false);
}
add_action('init', 'vwconf_upgrade', 1);

// Retain read-only links from demo builds without registering old global APIs.
add_filter('query_vars', function ($vars) { $vars[] = 'vwc_meeting'; return $vars; });
add_filter('request', function ($vars) {
    if (isset($vars['vwc_meeting']) && is_string($vars['vwc_meeting'])) {
        $vars['vwconf_meeting'] = $vars['vwc_meeting']; unset($vars['vwc_meeting']);
    }
    if (($vars['post_type'] ?? '') === 'vwc_meeting') $vars['post_type'] = 'vwconf_meeting';
    return $vars;
});
