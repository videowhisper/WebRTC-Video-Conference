<?php
/** Native settings sections, feature page setup and shared toolbar integration. */
defined('ABSPATH') || exit;
add_action('admin_init', function () {
    register_setting('vwconf_access_group', 'vwconf_access_settings', ['type' => 'array', 'sanitize_callback' => 'vwconf_sanitize_access']);
    register_setting('vwconf_pages_group', 'vwconf_pages_settings', ['type' => 'array', 'sanitize_callback' => 'vwconf_sanitize_pages']);
});
function vwconf_sanitize_pages($input): array {
    $old = vwconf_pages_settings();
    if (!is_array($input) || !(is_int($input['management_page'] ?? null) || (is_string($input['management_page'] ?? null) && ctype_digit($input['management_page']))) ||
        !in_array($input['account_menu'] ?? false, [true, false, 1, 0, '1', '0', ''], true)) return $old;
    $id = absint($input['management_page']); $page = $id ? get_post($id) : null;
    if ($id && (!$page || $page->post_type !== 'page' || $page->post_status !== 'publish' || !has_shortcode($page->post_content, 'videowhisper_conference_manager'))) {
        add_settings_error('vwconf_pages_settings', 'page', __('VideoWhisper Video Conference: Choose a published page containing the conference management shortcode.', 'videowhisper-video-conference')); return $old;
    }
    return ['management_page' => $id, 'account_menu' => in_array($input['account_menu'] ?? false, [true, 1, '1'], true)];
}
function vwconf_role_checkboxes(string $field, array $selected): void {
    foreach (wp_roles()->roles as $slug => $role) {
        echo '<p><label><input type="checkbox" name="vwconf_access_settings[' . esc_attr($field) . '][]" value="' . esc_attr($slug) . '" ' . checked(in_array($slug, $selected, true), true, false) . '> ' . esc_html(translate_user_role($role['name'])) . '</label></p>';
    }
}
function vwconf_access_tab(): void {
    $settings = vwconf_access_settings();
    echo '<h2>' . esc_html__('Room management', 'videowhisper-video-conference') . '</h2><p>' . esc_html__('These permissions apply only to conference rooms. They do not grant access to ordinary posts, pages, plugin settings or server credentials. Users with Manage Options can always manage all rooms. Until you save Access, existing WordPress publishing permissions are retained; saving delegates conference publishing to the selected managers.', 'videowhisper-video-conference') . '</p><form method="post" action="options.php">';
    settings_fields('vwconf_access_group');
    echo '<fieldset><legend><strong>' . esc_html__('Create and manage own rooms', 'videowhisper-video-conference') . '</strong></legend>'; vwconf_role_checkboxes('manager_roles', $settings['manager_roles']); echo '</fieldset>';
    echo '<fieldset><legend><strong>' . esc_html__('Manage all conference rooms', 'videowhisper-video-conference') . '</strong></legend><p>' . esc_html__('These roles can also create rooms and edit or move other users’ conference rooms to Trash.', 'videowhisper-video-conference') . '</p>'; vwconf_role_checkboxes('manage_all_roles', $settings['manage_all_roles']); echo '</fieldset>';
    echo '<h2>' . esc_html__('Who can join conferences?', 'videowhisper-video-conference') . '</h2><p><label for="vwconf-join-mode">' . esc_html__('Site access', 'videowhisper-video-conference') . '</label> <select id="vwconf-join-mode" name="vwconf_access_settings[join_mode]">';
    foreach (['members' => __('All signed-in users', 'videowhisper-video-conference'), 'roles' => __('Selected signed-in roles', 'videowhisper-video-conference'), 'everyone' => __('Everybody, including visitors without login', 'videowhisper-video-conference')] as $value => $label) echo '<option value="' . esc_attr($value) . '" ' . selected($settings['join_mode'], $value, false) . '>' . esc_html($label) . '</option>';
    echo '</select></p><fieldset><legend><strong>' . esc_html__('Roles allowed to join when Selected signed-in roles is chosen', 'videowhisper-video-conference') . '</strong></legend>'; vwconf_role_checkboxes('join_roles', $settings['join_roles']); echo '</fieldset>';
    echo '<p>' . esc_html__('Site access limits apply to every room. Per-room member or private-invitation settings can narrow access further. Authorized room managers can always open their managed rooms. Changing access invalidates previously issued join credentials; it does not end media already being exchanged.', 'videowhisper-video-conference') . '</p>';
    submit_button(); echo '</form>';
}
function vwconf_pages_tab(): void {
    settings_errors('vwconf_pages_settings'); $settings = vwconf_pages_settings();
    echo '<h2>' . esc_html__('Conference management page', 'videowhisper-video-conference') . '</h2><p>' . esc_html__('Place the shortcode below on a published page to let authorized users create, edit, invite participants and move their conference rooms to Trash from the frontend.', 'videowhisper-video-conference') . '</p><p><code>[videowhisper_conference_manager]</code></p><form method="post" action="options.php">';
    settings_fields('vwconf_pages_group');
    echo '<p><label for="vwconf-management-page">' . esc_html__('Management page', 'videowhisper-video-conference') . '</label> ';
    wp_dropdown_pages(['name' => 'vwconf_pages_settings[management_page]', 'id' => 'vwconf-management-page', 'selected' => absint($settings['management_page']), 'show_option_none' => esc_html__('No page selected', 'videowhisper-video-conference'), 'option_none_value' => '0', 'post_status' => 'publish']);
    echo '</p><p><label><input type="checkbox" name="vwconf_pages_settings[account_menu]" value="1" ' . checked(!empty($settings['account_menu']), true, false) . '> ' . esc_html__('Show a Video Conference section in the top-right user menu for authorized room managers.', 'videowhisper-video-conference') . '</label></p>';
    submit_button(); echo '</form>';
    if (vwconf_management_url()) echo '<p><a class="button" href="' . esc_url(vwconf_management_url()) . '">' . esc_html__('Open management page', 'videowhisper-video-conference') . '</a> <a class="button" href="' . esc_url(get_edit_post_link(absint($settings['management_page']), 'raw')) . '">' . esc_html__('Edit page', 'videowhisper-video-conference') . '</a></p>';
    if (current_user_can('publish_pages') && current_user_can('edit_pages')) {
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="vwconf_create_management_page">'; wp_nonce_field('vwconf_create_management_page');
        submit_button(__('Create management page', 'videowhisper-video-conference'), 'secondary'); echo '<p>' . esc_html__('Creates a published page containing only the management shortcode. Existing selected pages are kept and are never overwritten. Room managers still need permission under Access.', 'videowhisper-video-conference') . '</p></form>';
    }
    echo '<p>' . esc_html__('Each published room has its own conference URL and invitation. An individual room can also be embedded with its shortcode.', 'videowhisper-video-conference') . ' <code>[videowhisper_conference id="123"]</code></p>';
}
function vwconf_create_management_page(): void {
    if (!vwconf_request_is('post')) wp_die(esc_html__('POST is required.', 'videowhisper-video-conference'), '', ['response' => 405]);
    if (!current_user_can('manage_options') || !current_user_can('publish_pages') || !current_user_can('edit_pages')) wp_die(esc_html__('You cannot create this feature page.', 'videowhisper-video-conference'), '', ['response' => 403]);
    check_admin_referer('vwconf_create_management_page');
    if (!vwconf_management_url()) {
        $pages = get_posts(['post_type' => 'page', 'post_status' => 'publish', 'numberposts' => 1, 'meta_key' => '_vwconf_feature_page', 'meta_value' => 'management']);
        $id = $pages && has_shortcode($pages[0]->post_content, 'videowhisper_conference_manager') ? $pages[0]->ID : wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_author' => get_current_user_id(), 'post_title' => __('My Video Conferences', 'videowhisper-video-conference'), 'post_content' => '[videowhisper_conference_manager]'], true);
        if (!is_wp_error($id) && $id) { update_post_meta($id, '_vwconf_feature_page', 'management'); update_option('vwconf_pages_settings', array_replace(vwconf_pages_settings(), ['management_page' => (int) $id]), false); }
    }
    wp_safe_redirect(admin_url('edit.php?post_type=vwconf_meeting&page=vwconf-settings&tab=pages')); exit;
}
add_action('admin_post_vwconf_create_management_page', 'vwconf_create_management_page');
function vwconf_admin_bar(WP_Admin_Bar $bar): void {
    if (!is_user_logged_in() || !vwconf_can_manage()) return;
    $manage = vwconf_management_url(); $list = admin_url('edit.php?post_type=vwconf_meeting');
    if (!$bar->get_node('videowhisper')) $bar->add_node(['id' => 'videowhisper', 'title' => 'VideoWhisper', 'href' => $list]);
    $bar->add_node(['id' => 'videowhisper-vwconf', 'parent' => 'videowhisper', 'title' => __('Video Conference', 'videowhisper-video-conference'), 'href' => $list]);
    $links = ['rooms' => [__('Conference rooms', 'videowhisper-video-conference'), $list], 'create' => [__('Add conference', 'videowhisper-video-conference'), admin_url('post-new.php?post_type=vwconf_meeting')]];
    if ($manage) $links['frontend'] = [__('My conferences', 'videowhisper-video-conference'), $manage];
    if (current_user_can('manage_options')) foreach (['settings' => __('Server settings', 'videowhisper-video-conference'), 'connect' => __('VideoWhisper connection', 'videowhisper-video-conference'), 'app' => __('App defaults', 'videowhisper-video-conference'), 'access' => __('Access', 'videowhisper-video-conference'), 'pages' => __('Pages', 'videowhisper-video-conference')] as $tab => $label) $links[$tab] = [$label, admin_url('edit.php?post_type=vwconf_meeting&page=vwconf-settings&tab=' . $tab)];
    foreach ($links as $key => [$title, $url]) $bar->add_node(['id' => 'vwconf-toolbar-' . $key, 'parent' => 'videowhisper-vwconf', 'title' => $title, 'href' => $url]);
    if ($manage && !empty(vwconf_pages_settings()['account_menu'])) {
        $bar->add_node(['id' => 'vwconf-account', 'parent' => 'my-account', 'title' => __('Video Conference', 'videowhisper-video-conference'), 'href' => $manage]);
        $bar->add_node(['id' => 'vwconf-account-rooms', 'parent' => 'vwconf-account', 'title' => __('My conferences', 'videowhisper-video-conference'), 'href' => $manage]);
        $bar->add_node(['id' => 'vwconf-account-create', 'parent' => 'vwconf-account', 'title' => __('Create conference', 'videowhisper-video-conference'), 'href' => $manage]);
    }
}
add_action('admin_bar_menu', 'vwconf_admin_bar', 1000);
// Admin menu authorization runs before admin_init, so migrate bookmarks during init.
add_action('init', function () {
    if (!is_admin() || !vwconf_request_is('get') || !vwconf_can_manage()) return;
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only migration of bookmarked legacy admin URLs.
    $type = isset($_GET['post_type']) && is_string($_GET['post_type']) ? sanitize_key(wp_unslash($_GET['post_type'])) : '';
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only legacy settings bookmark.
    $page = isset($_GET['page']) && is_string($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
    if ($type === 'vwc_meeting' || $page === 'vwc-settings') {
        $url = admin_url('edit.php?post_type=vwconf_meeting');
        if ($page === 'vwc-settings') $url = add_query_arg('page', 'vwconf-settings', $url);
        wp_safe_redirect($url); exit;
    }
}, 20);
add_action('wp_enqueue_scripts', function () {
    $post = get_queried_object();
    if ($post instanceof WP_Post && has_shortcode($post->post_content, 'videowhisper_conference_manager')) wp_enqueue_style('vwconf-management', plugin_dir_url(dirname(__DIR__) . '/videowhisper-video-conference.php') . 'management.css', [], VWCONF_VERSION);
});
