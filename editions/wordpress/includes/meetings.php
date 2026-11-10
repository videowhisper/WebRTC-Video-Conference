<?php
/** Frontend routes and explicit room access. */
if (!defined('ABSPATH')) exit;
function vwc_access_mode(int $id): string {
    $mode = get_post_meta($id, '_vwc_access', true);
    return in_array($mode, ['members', 'public', 'private'], true) ? $mode : (get_post_meta($id, '_vwc_guests', true) === '1' ? 'public' : 'members');
}
function vwc_access_policy(int $id): string { return hash('sha256', vwc_access_mode($id) . ':' . get_post_meta($id, '_vwc_access_key', true)); }
function vwc_request_key(): string {
    // A read-only room capability, not a state-changing request. It is checked server-side below.
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended
    return isset($_GET['key']) && is_string($_GET['key']) ? sanitize_text_field(wp_unslash($_GET['key'])) : '';
}
function vwc_can_join(WP_Post $meeting): bool {
    if ($meeting->post_type !== 'vwc_meeting' || $meeting->post_status !== 'publish') return false;
    if (current_user_can('edit_post', $meeting->ID)) return true;
    $mode = vwc_access_mode($meeting->ID);
    if ($mode === 'members') return is_user_logged_in();
    if ($mode === 'public') return true;
    $key = get_post_meta($meeting->ID, '_vwc_access_key', true);
    return strlen($key) === 64 && hash_equals($key, vwc_request_key());
}
function vwc_meeting_url(WP_Post $meeting, bool $invite = false): string {
    $url = get_permalink($meeting);
    if ($invite && vwc_access_mode($meeting->ID) === 'private' && vwc_can_join($meeting)) {
        $key = get_post_meta($meeting->ID, '_vwc_access_key', true);
        if ($key) $url = add_query_arg('key', $key, $url);
    }
    return $url;
}
function vwc_register_meetings(): void {
    register_post_type('vwc_meeting', [
        'labels' => ['name' => __('Video Conferences', 'videowhisper-video-conference'), 'singular_name' => __('Video Conference', 'videowhisper-video-conference'),
            'add_new_item' => __('Add Video Conference', 'videowhisper-video-conference')],
        // Custom authorization renders the frontend; generic public REST/search/archive discovery stays disabled.
        'public' => false, 'publicly_queryable' => true, 'exclude_from_search' => true, 'show_ui' => true, 'show_in_rest' => false,
        'rewrite' => ['slug' => 'conference', 'with_front' => false], 'has_archive' => false, 'menu_icon' => 'dashicons-video-alt2',
        'supports' => ['title', 'editor', 'author'], 'capability_type' => 'post', 'map_meta_cap' => true,
    ]);
}
add_action('init', 'vwc_register_meetings');
add_action('admin_init', function () {
    if (current_user_can('manage_options') && get_option('vwc_rewrite_version') !== '1') {
        flush_rewrite_rules(false); update_option('vwc_rewrite_version', '1', false);
    }
});
add_action('template_redirect', function () {
    if (is_singular('vwc_meeting')) vwc_app(get_queried_object());
    $post = get_queried_object();
    if ($post instanceof WP_Post && has_shortcode($post->post_content, 'videowhisper_conference')) {
        if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
        nocache_headers(); header('Cache-Control: no-store, private, max-age=0'); header('Referrer-Policy: no-referrer');
    }
});
// Frontend routes must not turn private meeting content into generic archives, feeds or search results.
add_action('pre_get_posts', function ($query) {
    if (!is_admin() && in_array('vwc_meeting', (array) $query->get('post_type'), true) && !$query->is_singular()) $query->set('post__in', [0]);
});
add_filter('oembed_response_data', function ($data, $post) { return $post->post_type === 'vwc_meeting' ? false : $data; }, 10, 2);

add_filter('post_row_actions', function ($actions, $post) {
    if ($post->post_type === 'vwc_meeting' && $post->post_status === 'publish' && current_user_can('edit_post', $post->ID)) {
        $actions['vwc_open'] = '<a href="' . esc_url(vwc_meeting_url($post)) . '" target="_blank" rel="noopener noreferrer">' . esc_html__('Open conference', 'videowhisper-video-conference') . '</a>';
    }
    return $actions;
}, 10, 2);
add_action('add_meta_boxes_vwc_meeting', function () {
    add_meta_box('vwc_access', __('Meeting access and invitations', 'videowhisper-video-conference'), function ($post) {
        wp_nonce_field('vwc_access', 'vwc_access_nonce');
        echo '<p><label for="vwc-access">' . esc_html__('Who can join?', 'videowhisper-video-conference') . '</label> <select id="vwc-access" name="vwc_access">';
        foreach (['members' => __('Signed-in members', 'videowhisper-video-conference'), 'private' => __('Private — invitation with access key', 'videowhisper-video-conference'), 'public' => __('Public — anyone with the room URL', 'videowhisper-video-conference')] as $value => $label) {
            echo '<option value="' . esc_attr($value) . '" ' . selected(vwc_access_mode($post->ID), $value, false) . '>' . esc_html($label) . '</option>';
        }
        echo '</select></p><p>' . esc_html__('Meeting editors are hosts. Private invitations allow guests with the complete link; treat the access key as confidential. Existing meetings keep their access setting.', 'videowhisper-video-conference') . '</p>';
        if ($post->post_status === 'publish') {
            echo '<p><a class="button button-primary" href="' . esc_url(vwc_meeting_url($post)) . '" target="_blank" rel="noopener noreferrer">' . esc_html__('Open conference', 'videowhisper-video-conference') . '</a></p>';
            echo '<p><label for="vwc-invitation">' . esc_html__('Invitation link', 'videowhisper-video-conference') . '</label><br><input id="vwc-invitation" class="large-text" type="url" readonly value="' . esc_url(vwc_meeting_url($post, true)) . '"></p>';
        } else echo '<p>' . esc_html__('Publish the meeting to open it and share its invitation.', 'videowhisper-video-conference') . '</p>';
        echo '<p><label><input type="checkbox" name="vwc_rotate_key" value="1"> ' . esc_html__('Replace the private access key when saving. Previous invitations stop working for new connections.', 'videowhisper-video-conference') . '</label></p>';
        echo '<p>' . esc_html__('Optional shortcode for another page:', 'videowhisper-video-conference') . '</p><code>[videowhisper_conference id="' . absint($post->ID) . '"]</code>';
    });
});
add_action('save_post_vwc_meeting', function ($id) {
    if (wp_is_post_autosave($id) || wp_is_post_revision($id) || !current_user_can('edit_post', $id) ||
        !isset($_POST['vwc_access_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['vwc_access_nonce'])), 'vwc_access')) return;
    $mode = isset($_POST['vwc_access']) ? sanitize_key(wp_unslash($_POST['vwc_access'])) : vwc_access_mode($id);
    if (!in_array($mode, ['members', 'public', 'private'], true)) return;
    if ($mode === 'private' && (strlen(get_post_meta($id, '_vwc_access_key', true)) !== 64 || !empty($_POST['vwc_rotate_key']))) update_post_meta($id, '_vwc_access_key', bin2hex(random_bytes(32)));
    update_post_meta($id, '_vwc_access', $mode);
    // Legacy guest adapters may only treat deliberately public rooms as open. Private access uses vwc_can_join().
    update_post_meta($id, '_vwc_guests', $mode === 'public' ? '1' : '0');
});
function vwc_access_page(WP_Post $meeting): void {
    status_header($meeting->post_status === 'publish' ? (vwc_access_mode($meeting->ID) === 'members' ? 401 : 403) : 404);
    $mode = vwc_access_mode($meeting->ID);
    $assets = plugin_dir_url(dirname(__DIR__) . '/videowhisper-video-conference.php') . 'assets/';
    wp_enqueue_style('vwc-conference-access', $assets . 'conference.css', [], VWC_VERSION);
    ?><!doctype html><html <?php language_attributes(); ?>><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?php esc_html_e('Join conference', 'videowhisper-video-conference'); ?></title><?php wp_print_styles(['vwc-conference-access']); ?></head><body><main class="vwc-access-page"><h1><?php esc_html_e('Join conference', 'videowhisper-video-conference'); ?></h1>
    <?php if ($meeting->post_status !== 'publish'): ?><p><?php esc_html_e('This meeting is not published. Ask its owner to publish it first.', 'videowhisper-video-conference'); ?></p>
    <?php elseif ($mode === 'members'): ?><p><?php esc_html_e('This meeting requires a site account. Sign in, then open the invitation again.', 'videowhisper-video-conference'); ?></p><a href="<?php echo esc_url(wp_login_url(vwc_meeting_url($meeting))); ?>"><?php esc_html_e('Sign in to join', 'videowhisper-video-conference'); ?></a>
    <?php else: ?><p><?php esc_html_e('This private room requires its access key. Open the complete invitation or enter the key from the meeting owner.', 'videowhisper-video-conference'); ?></p><form method="get" action="<?php echo esc_url(vwc_meeting_url($meeting)); ?>"><?php
        $query = wp_parse_url(vwc_meeting_url($meeting), PHP_URL_QUERY); $fields = []; wp_parse_str($query ?: '', $fields);
        foreach (['p', 'post_type', 'vwc_meeting'] as $field) if (isset($fields[$field])) echo '<input type="hidden" name="' . esc_attr($field) . '" value="' . esc_attr($fields[$field]) . '">';
        ?><label for="vwc-room-key"><?php esc_html_e('Access key', 'videowhisper-video-conference'); ?></label><input id="vwc-room-key" name="key" maxlength="128" autocomplete="off" required><button type="submit"><?php esc_html_e('Open meeting', 'videowhisper-video-conference'); ?></button></form><?php endif; ?>
    </main></body></html><?php
    exit;
}
