<?php
$before = get_option('vwc_settings', []);
$id = wp_insert_post(['post_type'=>'vwc_meeting','post_status'=>'publish','post_title'=>'Local setup notice regression','post_author'=>1]);
function vwc_setup_assert($ok, $text) { if (!$ok) throw new RuntimeException($text); }
try {
    update_option('vwc_settings', []);
    wp_set_current_user(1);
    $html = do_shortcode('[videowhisper_conference id="'.$id.'"]');
    vwc_setup_assert(str_contains($html,'Ask the administrator') && str_contains($html,'page=vwc-settings') && !str_contains($html,'<iframe'), 'Unconfigured owner notice failed');
    update_post_meta($id,'_vwc_guests','1'); wp_set_current_user(0);
    $html = do_shortcode('[videowhisper_conference id="'.$id.'"]');
    vwc_setup_assert(str_contains($html,'Ask the administrator') && !str_contains($html,'page=vwc-settings'), 'Guest settings link leaked');
    update_post_meta($id,'_vwc_guests','0');
    vwc_setup_assert(!str_contains(do_shortcode('[videowhisper_conference id="'.$id.'"]'),'Ask the administrator'), 'Denied meeting leaked setup state');
    wp_set_current_user(1); update_option('vwc_settings',['socket'=>'https://conference.example.invalid','account'=>'fixture','token'=>'local-test-fixture-only']);
    $html=do_shortcode('[videowhisper_conference id="'.$id.'"]');
    vwc_setup_assert(str_contains($html,'<iframe') && str_contains($html,esc_url(get_permalink($id))), 'Configured embed regressed');
    echo "Setup notice: owner, public guest, denied guest and configured embed passed\n";
} finally { update_option('vwc_settings',$before); wp_set_current_user(1); wp_trash_post($id); }
