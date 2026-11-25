<?php
/** Allowlisted Free app defaults. Device IDs, consent and credentials are never settings. */
defined('ABSPATH') || exit;
function vwconf_app_defaults(): array {
    return ['participants' => '4', 'layout' => 'gallery', 'panel' => 'chat', 'theme' => 'system', 'media' => 'standard', 'embed_height' => '80vh', 'join_media' => true, 'mic_muted' => false, 'camera_off' => false, 'screen_share' => true, 'push_to_talk' => false];
}
function vwconf_app_choices(): array {
    return ['participants' => ['2', '3', '4'], 'layout' => ['gallery', 'speaker'], 'panel' => ['chat', 'people', 'closed'], 'theme' => ['system', 'light', 'dark'], 'media' => ['standard', 'economy'], 'embed_height' => ['80vh', '600px', '720px', '900px']];
}
function vwconf_app_settings(): array {
    $settings = vwconf_app_defaults(); $saved = get_option('vwconf_app_settings', []);
    if (!is_array($saved)) return $settings;
    foreach (vwconf_app_choices() as $key => $choices) if (is_string($saved[$key] ?? null) && in_array($saved[$key], $choices, true)) $settings[$key] = $saved[$key];
    foreach (['join_media', 'mic_muted', 'camera_off', 'screen_share', 'push_to_talk'] as $key) if (is_bool($saved[$key] ?? null)) $settings[$key] = $saved[$key];
    return $settings;
}
function vwconf_sanitize_app($input): array {
    $settings = vwconf_app_settings(); $invalid = !is_array($input);
    if (!is_array($input)) $input = [];
    foreach (vwconf_app_choices() as $key => $choices) {
        if (is_string($input[$key] ?? null) && in_array($input[$key], $choices, true)) $settings[$key] = $input[$key];
        else $invalid = true;
    }
    foreach (['join_media', 'mic_muted', 'camera_off', 'screen_share', 'push_to_talk'] as $key) {
        $value = $input[$key] ?? false;
        if (in_array($value, [true, false, 1, 0, '1', '0', ''], true)) $settings[$key] = in_array($value, [true, 1, '1'], true);
        else $invalid = true;
    }
    if ($invalid) {
        add_settings_error('vwconf_app_settings', 'invalid', __('VideoWhisper Video Conference: Invalid app settings were not saved.', 'videowhisper-video-conference'));
        return vwconf_app_settings();
    }
    return $settings;
}
add_action('admin_init', function () {
    register_setting('vwconf_app_group', 'vwconf_app_settings', ['type' => 'array', 'sanitize_callback' => 'vwconf_sanitize_app']);
});
function vwconf_app_config(array $config): array {
    $settings = vwconf_app_settings();
    $config['conference'] = array_replace($config['conference'] ?? [], [
        'maxParticipants' => (int) $settings['participants'], 'allowScreenShare' => $settings['screen_share'],
        'defaultLayout' => $settings['layout'], 'defaultPanel' => $settings['panel'], 'defaultTheme' => $settings['theme'],
        'pushToTalk' => $settings['push_to_talk'], 'joinWithMedia' => $settings['join_media'], 'startMicMuted' => $settings['mic_muted'], 'startCameraOff' => $settings['camera_off'],
    ]);
    if ($settings['media'] === 'economy') $config['stream'] = array_replace($config['stream'] ?? [], ['width' => 320, 'height' => 180, 'framerate' => 10, 'videoBitrate' => 90, 'audioBitrate' => 24]);
    return $config;
}
function vwconf_app_tab(): void {
    settings_errors('vwconf_app_settings'); $settings = vwconf_app_settings();
    echo '<h2>' . esc_html__('Free app defaults', 'videowhisper-video-conference') . '</h2><p>' . esc_html__('Defaults apply when opening a conference. Participants can change their layout, theme and media controls. Joining still requires consent; no device permission or connection is requested automatically.', 'videowhisper-video-conference') . '</p><form method="post" action="options.php">';
    settings_fields('vwconf_app_group');
    $fields = [
        'participants' => [__('Participant limit', 'videowhisper-video-conference'), ['2' => '2', '3' => '3', '4' => '4']],
        'layout' => [__('Initial video layout', 'videowhisper-video-conference'), ['gallery' => __('Gallery', 'videowhisper-video-conference'), 'speaker' => __('Speaker', 'videowhisper-video-conference')]],
        'panel' => [__('Initially open panel', 'videowhisper-video-conference'), ['chat' => __('Chat', 'videowhisper-video-conference'), 'people' => __('Participants', 'videowhisper-video-conference'), 'closed' => __('None', 'videowhisper-video-conference')]],
        'theme' => [__('Default appearance', 'videowhisper-video-conference'), ['system' => __('System', 'videowhisper-video-conference'), 'light' => __('Light', 'videowhisper-video-conference'), 'dark' => __('Dark', 'videowhisper-video-conference')]],
        'media' => [__('Media quality', 'videowhisper-video-conference'), ['standard' => __('Standard: 640 × 360, 15 fps, 180 kbps video / 32 kbps audio', 'videowhisper-video-conference'), 'economy' => __('Economy: 320 × 180, 10 fps, 90 kbps video / 24 kbps audio', 'videowhisper-video-conference')]],
        'embed_height' => [__('Embedded conference height', 'videowhisper-video-conference'), ['80vh' => __('Responsive: 80 percent of viewport height', 'videowhisper-video-conference'), '600px' => '600 px', '720px' => '720 px', '900px' => '900 px']],
    ];
    echo '<table class="form-table"><tbody>';
    foreach ($fields as $key => [$label, $choices]) {
        echo '<tr><th scope="row"><label for="vwconf-app-' . esc_attr($key) . '">' . esc_html($label) . '</label></th><td><select id="vwconf-app-' . esc_attr($key) . '" name="vwconf_app_settings[' . esc_attr($key) . ']">';
        foreach ($choices as $value => $text) echo '<option value="' . esc_attr((string) $value) . '" ' . selected($settings[$key], (string) $value, false) . '>' . esc_html($text) . '</option>';
        echo '</select></td></tr>';
    }
    foreach (['join_media' => __('Select Use camera and microphone on the entry form by default.', 'videowhisper-video-conference'), 'mic_muted' => __('Start the microphone muted when joining with media.', 'videowhisper-video-conference'), 'camera_off' => __('Start the camera turned off when joining with media.', 'videowhisper-video-conference'), 'push_to_talk' => __('Enable push to talk by default; participants can choose whether to use it.', 'videowhisper-video-conference'), 'screen_share' => __('Show the screen sharing button.', 'videowhisper-video-conference')] as $key => $label) {
        echo '<tr><th scope="row"></th><td><label><input type="checkbox" name="vwconf_app_settings[' . esc_attr($key) . ']" value="1" ' . checked($settings[$key], true, false) . '> ' . esc_html($label) . '</label></td></tr>';
    }
    echo '</tbody></table><p>' . esc_html__('The Free edition supports up to four participants. Capacity is signed into join credentials. After changing capacity, everyone should leave and rejoin so an existing server room can be recreated with the new limit.', 'videowhisper-video-conference') . '</p><p>' . esc_html__('A saved browser theme takes priority over Default appearance. Economy reduces requested capture size and sending bitrate; actual quality depends on devices and the network. Embed height applies to the individual conference shortcode, with a minimum height of 420 px.', 'videowhisper-video-conference') . '</p><p>' . esc_html__('Screen sharing visibility is an interface preference, not a server access restriction. Muted or disabled tracks may still use the selected devices; turn off Use camera and microphone to join without capturing media.', 'videowhisper-video-conference') . '</p>';
    echo '<p>' . esc_html__('Push to talk starts muted. Hold the talk button, or focus it and hold Space or Enter, to speak. Release, focus loss or a hidden tab mutes the microphone. Disabling push to talk leaves the microphone muted until the participant unmutes it.', 'videowhisper-video-conference') . '</p>';
    submit_button(); echo '</form>';
}
