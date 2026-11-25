<?php
/** Native frontend room management; every mutation rechecks capability and ownership. */
defined('ABSPATH') || exit;
function vwconf_pages_settings(): array {
    $saved = get_option('vwconf_pages_settings', []);
    return array_replace(['management_page' => 0, 'account_menu' => true], is_array($saved) ? $saved : []);
}
function vwconf_management_url(): string {
    $page = get_post(absint(vwconf_pages_settings()['management_page']));
    return $page && $page->post_type === 'page' && $page->post_status === 'publish' && has_shortcode($page->post_content, 'videowhisper_conference_manager') ? get_permalink($page) : '';
}
function vwconf_current_management_page(): int {
    $page = get_queried_object();
    return $page instanceof WP_Post && $page->post_status === 'publish' && has_shortcode($page->post_content, 'videowhisper_conference_manager') ? $page->ID : 0;
}
function vwconf_frontend_management_url(): string {
    $id = vwconf_current_management_page();
    return $id ? get_permalink($id) : vwconf_management_url();
}
function vwconf_management_revision(WP_Post $post): string {
    return hash('sha256', wp_json_encode([$post->ID, $post->post_title, $post->post_content, $post->post_status, $post->post_author, $post->post_modified_gmt, vwconf_access_policy($post->ID)]));
}
function vwconf_management_result(string $code, int $return_id = 0): void {
    $page = $return_id ? get_post($return_id) : null;
    $url = $page && $page->post_status === 'publish' && has_shortcode($page->post_content, 'videowhisper_conference_manager') ? get_permalink($page) : (vwconf_management_url() ?: admin_url('edit.php?post_type=vwconf_meeting'));
    wp_safe_redirect(add_query_arg('vwconf_result', $code, $url)); exit;
}
function vwconf_manage_submission(array $input) {
    if (!is_user_logged_in() || !vwconf_can_manage()) return new WP_Error('vwconf_denied');
    $operation = $input['operation'] ?? null; $raw_id = $input['meeting_id'] ?? null;
    if (!is_string($operation) || !in_array($operation, ['save', 'trash'], true) || !is_string($raw_id) || !ctype_digit($raw_id)) return new WP_Error('vwconf_invalid');
    $id = (int) $raw_id;
    if (!is_string($input['_wpnonce'] ?? null) || !wp_verify_nonce($input['_wpnonce'], 'vwconf_manage_room_' . $id)) return new WP_Error('vwconf_nonce');
    $post = $id ? get_post($id) : null;
    if ($id && (!$post || !vwconf_can_manage($id) || !in_array($post->post_status, ['publish', 'draft'], true))) return new WP_Error('vwconf_denied');
    if ($post && (!is_string($input['revision'] ?? null) || !hash_equals(vwconf_management_revision($post), $input['revision']))) return new WP_Error('vwconf_conflict');
    if ($operation === 'trash') {
        if (!$post || !current_user_can('delete_post', $id)) return new WP_Error('vwconf_denied');
        return wp_trash_post($id) ? 'trashed' : new WP_Error('vwconf_failed');
    }
    if (!is_string($input['title'] ?? null) || !is_string($input['access'] ?? null) || !is_string($input['status'] ?? null) ||
        !in_array($input['access'], ['members', 'private', 'public'], true) || !in_array($input['status'], ['publish', 'draft'], true) ||
        (isset($input['rotate_key']) && !is_string($input['rotate_key']))) return new WP_Error('vwconf_invalid');
    $title = sanitize_text_field($input['title']);
    if ($title === '' || strlen($title) > 480 || preg_match_all('/./us', $title) > 120 || ($input['status'] === 'publish' && !current_user_can('publish_vwconf_meetings'))) return new WP_Error('vwconf_invalid');
    $record = ['post_title' => $title, 'post_status' => $input['status']];
    // Neither ownership, post type nor arbitrary metadata/content are taken from browser fields.
    if ($post) $saved = wp_update_post(wp_slash($record + ['ID' => $id]), true);
    else $saved = wp_insert_post(wp_slash($record + ['post_type' => 'vwconf_meeting', 'post_author' => get_current_user_id()]), true);
    if (is_wp_error($saved) || !$saved) return new WP_Error('vwconf_failed');
    $id = (int) $saved;
    if ($input['access'] === 'private' && (strlen(get_post_meta($id, '_vwconf_access_key', true)) !== 64 || ($input['rotate_key'] ?? '') === '1')) update_post_meta($id, '_vwconf_access_key', bin2hex(random_bytes(32)));
    update_post_meta($id, '_vwconf_access', $input['access']); update_post_meta($id, '_vwconf_guests', $input['access'] === 'public' ? '1' : '0');
    return 'saved';
}
function vwconf_manage_post(): void {
    if (!vwconf_request_is('post')) wp_die(esc_html__('POST is required.', 'videowhisper-video-conference'), '', ['response' => 405]);
    if (!is_user_logged_in()) wp_die(esc_html__('Sign in to manage conferences.', 'videowhisper-video-conference'), '', ['response' => 401]);
    if (!isset($_POST['meeting_id']) || !is_string($_POST['meeting_id']) || !ctype_digit(sanitize_text_field(wp_unslash($_POST['meeting_id'])))) wp_die(esc_html__('Invalid conference request.', 'videowhisper-video-conference'), '', ['response' => 400]);
    check_admin_referer('vwconf_manage_room_' . absint(wp_unslash($_POST['meeting_id'])));
    // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Every field is shape/capability/nonce checked by the submission handler.
    $input = wp_unslash($_POST); $result = vwconf_manage_submission($input);
    $return_id = isset($input['return_page']) && is_string($input['return_page']) ? absint($input['return_page']) : 0;
    if (is_wp_error($result)) vwconf_management_result($result->get_error_code() === 'vwconf_conflict' ? 'conflict' : 'failed', $return_id);
    vwconf_management_result($result, $return_id);
}
add_action('admin_post_vwconf_manage_room', 'vwconf_manage_post');
add_action('admin_post_nopriv_vwconf_manage_room', 'vwconf_manage_post');
function vwconf_management_form(?WP_Post $post = null): string {
    $id = $post ? $post->ID : 0; $mode = $post ? vwconf_access_mode($id) : 'members';
    ob_start(); ?>
    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="vwconf-manage-form">
        <h3><?php echo $post ? esc_html__('Edit conference', 'videowhisper-video-conference') : esc_html__('Create conference', 'videowhisper-video-conference'); ?></h3>
        <input type="hidden" name="return_page" value="<?php echo absint(vwconf_current_management_page()); ?>"><input type="hidden" name="action" value="vwconf_manage_room"><input type="hidden" name="operation" value="save"><input type="hidden" name="meeting_id" value="<?php echo absint($id); ?>">
        <?php wp_nonce_field('vwconf_manage_room_' . $id); if ($post) { ?><input type="hidden" name="revision" value="<?php echo esc_attr(vwconf_management_revision($post)); ?>"><?php } ?>
        <p><label><?php esc_html_e('Room name', 'videowhisper-video-conference'); ?><br><input name="title" maxlength="120" required value="<?php echo esc_attr($post ? $post->post_title : sprintf( /* translators: %s: randomly generated room suffix. */ __('Video meeting %s', 'videowhisper-video-conference'), strtoupper(bin2hex(random_bytes(2))))); ?>"></label></p>
        <p><label for="vwconf-room-access-<?php echo absint($id); ?>"><?php esc_html_e('Room access', 'videowhisper-video-conference'); ?></label><br><select id="vwconf-room-access-<?php echo absint($id); ?>" name="access"><?php foreach (['members' => __('Signed-in members', 'videowhisper-video-conference'), 'private' => __('Private invitation with access key', 'videowhisper-video-conference'), 'public' => __('Public room', 'videowhisper-video-conference')] as $value => $label) echo '<option value="' . esc_attr($value) . '" ' . selected($mode, $value, false) . '>' . esc_html($label) . '</option>'; ?></select></p>
        <p><label for="vwconf-room-status-<?php echo absint($id); ?>"><?php esc_html_e('Publication', 'videowhisper-video-conference'); ?></label><br><select id="vwconf-room-status-<?php echo absint($id); ?>" name="status"><?php if (current_user_can('publish_vwconf_meetings')) { ?><option value="publish"><?php esc_html_e('Published', 'videowhisper-video-conference'); ?></option><?php } ?><option value="draft" <?php selected($post ? $post->post_status : '', 'draft'); ?>><?php esc_html_e('Draft', 'videowhisper-video-conference'); ?></option></select></p>
        <?php if ($post) { ?><p><label><input type="checkbox" name="rotate_key" value="1"> <?php esc_html_e('Replace the private invitation key when saving.', 'videowhisper-video-conference'); ?></label></p><?php } ?>
        <p><?php esc_html_e('Site access rules also apply. A private invitation never bypasses a site role restriction.', 'videowhisper-video-conference'); ?></p>
        <button type="submit"><?php esc_html_e('Save conference', 'videowhisper-video-conference'); ?></button>
    </form><?php return ob_get_clean();
}
function vwconf_management_shortcode(): string {
    if (!is_user_logged_in()) return '<p>' . esc_html__('Sign in to manage conferences.', 'videowhisper-video-conference') . ' <a href="' . esc_url(wp_login_url(vwconf_frontend_management_url() ?: home_url('/'))) . '">' . esc_html__('Sign in', 'videowhisper-video-conference') . '</a></p>';
    if (!vwconf_can_manage()) return '<p>' . esc_html__('Your role cannot manage conference rooms. Contact the site administrator.', 'videowhisper-video-conference') . '</p>';
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only editing selection; each form has its own POST nonce and object capability check.
    $id = isset($_GET['vwconf_edit']) && is_string($_GET['vwconf_edit']) ? absint($_GET['vwconf_edit']) : 0;
    $edit = $id && vwconf_can_manage($id) ? get_post($id) : null;
    if ($edit && !in_array($edit->post_status, ['publish', 'draft'], true)) $edit = null;
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only pagination.
    $page = isset($_GET['vwconf_page']) && is_string($_GET['vwconf_page']) ? max(1, absint($_GET['vwconf_page'])) : 1;
    $args = ['post_type' => 'vwconf_meeting', 'post_status' => ['publish', 'draft'], 'posts_per_page' => 10, 'vwconf_management_query' => true, 'paged' => $page, 'orderby' => 'ID', 'order' => 'DESC'];
    if (!current_user_can('edit_others_vwconf_meetings')) $args['author'] = get_current_user_id();
    $query = new WP_Query($args); ob_start(); ?>
    <section class="vwconf-manager"><h2><?php esc_html_e('My conferences', 'videowhisper-video-conference'); ?></h2>
    <?php // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Allowlisted read-only operation status.
    $result = isset($_GET['vwconf_result']) && is_string($_GET['vwconf_result']) ? sanitize_key(wp_unslash($_GET['vwconf_result'])) : '';
    $messages = ['saved' => __('Conference saved.', 'videowhisper-video-conference'), 'trashed' => __('Conference moved to Trash.', 'videowhisper-video-conference'), 'conflict' => __('This conference changed. Reload the page before editing it again.', 'videowhisper-video-conference'), 'failed' => __('The request could not be completed. Check your permissions, reload the page and retry.', 'videowhisper-video-conference')];
    if (isset($messages[$result])) echo '<p role="status">' . esc_html($messages[$result]) . '</p>';
    echo vwconf_management_form($edit); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Helper escapes each field and generates native nonces.
    if ($edit && vwconf_frontend_management_url()) echo '<p><a href="' . esc_url(vwconf_frontend_management_url()) . '">' . esc_html__('Create another conference', 'videowhisper-video-conference') . '</a></p>';
    foreach ($query->posts as $meeting) {
        if (!vwconf_can_manage($meeting->ID)) continue;
        echo '<article class="vwconf-manage-room"><h3>' . esc_html($meeting->post_title) . '</h3>';
        if ($meeting->post_status === 'publish') echo '<p><a href="' . esc_url(vwconf_meeting_url($meeting)) . '">' . esc_html__('Open conference', 'videowhisper-video-conference') . '</a></p><p><label>' . esc_html__('Invitation link', 'videowhisper-video-conference') . '<br><input type="url" readonly value="' . esc_url(vwconf_meeting_url($meeting, true)) . '"></label></p>';
        else echo '<p>' . esc_html__('Draft', 'videowhisper-video-conference') . '</p>';
        if (vwconf_frontend_management_url()) echo '<p><a href="' . esc_url(add_query_arg('vwconf_edit', $meeting->ID, vwconf_frontend_management_url())) . '">' . esc_html__('Edit conference', 'videowhisper-video-conference') . '</a></p>';
        if (current_user_can('delete_post', $meeting->ID)) {
            echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="vwconf_manage_room"><input type="hidden" name="return_page" value="' . absint(vwconf_current_management_page()) . '"><input type="hidden" name="operation" value="trash"><input type="hidden" name="meeting_id" value="' . absint($meeting->ID) . '"><input type="hidden" name="revision" value="' . esc_attr(vwconf_management_revision($meeting)) . '">';
            wp_nonce_field('vwconf_manage_room_' . $meeting->ID); echo '<button type="submit">' . esc_html__('Move to Trash', 'videowhisper-video-conference') . '</button></form>';
        }
        echo '</article>';
    }
    if (!$query->posts) echo '<p>' . esc_html__('No conference rooms yet.', 'videowhisper-video-conference') . '</p>';
    $base = vwconf_frontend_management_url();
    if ($base && $page > 1) echo '<a href="' . esc_url(add_query_arg('vwconf_page', $page - 1, $base)) . '">' . esc_html__('Previous rooms', 'videowhisper-video-conference') . '</a> ';
    if ($base && $page < $query->max_num_pages) echo '<a href="' . esc_url(add_query_arg('vwconf_page', $page + 1, $base)) . '">' . esc_html__('Next rooms', 'videowhisper-video-conference') . '</a>';
    ?></section><?php return ob_get_clean();
}
add_shortcode('videowhisper_conference_manager', 'vwconf_management_shortcode');
