<?php
/** Read-only boundary check: wp eval-file /path/to/rest-privacy.php */
$type = get_post_type_object('vwc_meeting');
if (!$type || $type->show_in_rest) {
    throw new RuntimeException('Member-only meetings must not register generic public post REST routes.');
}
wp_set_current_user(0);
foreach (['/wp/v2/vwc_meeting', '/wp/v2/vwc_meeting/2504'] as $route) {
    $response = rest_do_request(new WP_REST_Request('GET', $route));
    if ($response->get_status() !== 404) {
        throw new RuntimeException('Unexpected public meeting metadata route.');
    }
}
$id=wp_insert_post(['post_type'=>'vwc_meeting','post_status'=>'publish','post_title'=>'Private query canary','post_content'=>'Private test content','post_author'=>1]);
$query=new WP_Query(['post_type'=>'vwc_meeting','posts_per_page'=>100]);
if ($query->post_count !== 0) throw new RuntimeException('Generic frontend query exposed meeting records.');
if (get_oembed_response_data($id,600) !== false) throw new RuntimeException('Generic embed exposed meeting metadata.');
wp_set_current_user(1);wp_trash_post($id);
echo "Meeting REST/query/embed privacy: 5 checks passed\n";
