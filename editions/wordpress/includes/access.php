<?php
/** Conference-only capabilities and site-wide eligibility. */
defined('ABSPATH') || exit;
function vwconf_request_is(string $method): bool {
    return isset($_SERVER['REQUEST_METHOD']) && is_string($_SERVER['REQUEST_METHOD']) && sanitize_key(wp_unslash($_SERVER['REQUEST_METHOD'])) === $method;
}
function vwconf_access_settings(): array {
    $own = []; $all = [];
    foreach (wp_roles()->roles as $slug => $role) {
        if (!empty($role['capabilities']['edit_posts'])) $own[] = $slug;
        if (!empty($role['capabilities']['edit_others_posts'])) $all[] = $slug;
    }
    $saved = get_option('vwconf_access_settings', null);
    if ($saved === null) return ['manager_roles' => $own, 'manage_all_roles' => $all, 'join_mode' => 'everyone', 'join_roles' => []];
    if (!is_array($saved)) return ['manager_roles' => [], 'manage_all_roles' => [], 'join_mode' => 'roles', 'join_roles' => []];
    $next = ['join_mode' => in_array($saved['join_mode'] ?? null, ['members', 'roles', 'everyone'], true) ? $saved['join_mode'] : 'roles'];
    foreach (['manager_roles', 'manage_all_roles', 'join_roles'] as $field) $next[$field] = vwconf_role_list($saved[$field] ?? []) ?? [];
    $next['manager_roles'] = array_values(array_unique(array_merge($next['manager_roles'], $next['manage_all_roles']))); sort($next['manager_roles']);
    return $next;
}
function vwconf_role_list($value): ?array {
    if (!is_array($value) || count($value) > 100) return null;
    $out = [];
    foreach ($value as $slug) {
        if (!is_string($slug) || !isset(wp_roles()->roles[$slug])) return null;
        $out[] = $slug;
    }
    $out = array_values(array_unique($out)); sort($out); return $out;
}
function vwconf_sanitize_access($input): array {
    $old = vwconf_access_settings();
    if (!is_array($input) || !is_string($input['join_mode'] ?? null) || !in_array($input['join_mode'], ['members', 'roles', 'everyone'], true)) return $old;
    $next = ['join_mode' => $input['join_mode']];
    foreach (['manager_roles', 'manage_all_roles', 'join_roles'] as $field) {
        $roles = vwconf_role_list($input[$field] ?? []);
        if ($roles === null) return $old;
        $next[$field] = $roles;
    }
    $next['manager_roles'] = array_values(array_unique(array_merge($next['manager_roles'], $next['manage_all_roles']))); sort($next['manager_roles']);
    return $next;
}
function vwconf_user_manages(WP_User $user, bool $all = false): bool {
    if (!$user->exists()) return false;
    if (!empty($user->allcaps['manage_options'])) return true;
    $settings = vwconf_access_settings();
    return (bool) array_intersect($user->roles, (array) $settings[$all ? 'manage_all_roles' : 'manager_roles']);
}
add_filter('user_has_cap', function ($caps, $required, $args, $user) {
    // Only this post type's primitive capabilities are delegated; never edit_posts/manage_options.
    if (get_option('vwconf_access_settings', null) === null) {
        // Retain each legacy WordPress permission until the administrator explicitly saves role delegation.
        $legacy = ['edit_vwconf_meetings' => 'edit_posts', 'publish_vwconf_meetings' => 'publish_posts', 'delete_vwconf_meetings' => 'delete_posts', 'edit_published_vwconf_meetings' => 'edit_published_posts', 'delete_published_vwconf_meetings' => 'delete_published_posts', 'vwconf_create_meetings' => 'edit_posts', 'edit_others_vwconf_meetings' => 'edit_others_posts', 'delete_others_vwconf_meetings' => 'delete_others_posts', 'read_private_vwconf_meetings' => 'read_private_posts', 'edit_private_vwconf_meetings' => 'edit_private_posts', 'delete_private_vwconf_meetings' => 'delete_private_posts'];
        foreach ($legacy as $custom => $original) $caps[$custom] = !empty($user->allcaps['manage_options']) || !empty($caps[$original]);
        return $caps;
    }
    $own = vwconf_user_manages($user); $all = vwconf_user_manages($user, true);
    foreach (['edit_vwconf_meetings', 'publish_vwconf_meetings', 'delete_vwconf_meetings', 'edit_published_vwconf_meetings', 'delete_published_vwconf_meetings', 'vwconf_create_meetings'] as $cap) $caps[$cap] = $own;
    foreach (['edit_others_vwconf_meetings', 'delete_others_vwconf_meetings', 'read_private_vwconf_meetings', 'edit_private_vwconf_meetings', 'delete_private_vwconf_meetings'] as $cap) $caps[$cap] = $all;
    return $caps;
}, 10, 4);
function vwconf_site_allows(int $user_id): bool {
    $settings = vwconf_access_settings();
    if ($settings['join_mode'] === 'everyone') return true;
    $user = $user_id ? get_userdata($user_id) : false;
    if (!$user) return false;
    return $settings['join_mode'] === 'members' || (bool) array_intersect($user->roles, (array) $settings['join_roles']);
}
function vwconf_can_manage(int $id = 0, int $user_id = 0): bool {
    $user_id = $user_id ?: get_current_user_id();
    if (!$user_id) return false;
    if (!$id) return user_can($user_id, 'vwconf_create_meetings');
    $post = get_post($id);
    return $post && $post->post_type === 'vwconf_meeting' && user_can($user_id, 'edit_post', $id);
}
/** Recheck signed member/host claims against current eligibility, not a saved role label. */
function vwconf_claim_allowed(WP_Post $meeting, int $user_id, string $role): bool {
    if ($user_id && !get_userdata($user_id)) return false;
    if ($role === 'host') return $user_id && vwconf_can_manage($meeting->ID, $user_id);
    if (!vwconf_site_allows($user_id)) return false;
    return vwconf_access_mode($meeting->ID) !== 'members' || $user_id > 0;
}
