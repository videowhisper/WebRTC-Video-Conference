<?php
add_filter('pre_wp_mail', '__return_true');
function vwc_check($value, $message) { if (!$value) throw new RuntimeException($message); }
$id = wp_insert_post(['post_type'=>'vwc_meeting','post_status'=>'publish','post_title'=>'Local conference test','post_author'=>1]);
update_option('vwc_settings',['socket'=>'http://127.0.0.1:8092','account'=>'wordpress_test','token'=>'local-wordpress-test-token']);
$meeting=get_post($id); wp_set_current_user(0);
vwc_check(!vwc_can_join($meeting),'Guests must be disabled by default');
vwc_check(!str_contains(do_shortcode('[videowhisper_conference id="'.$id.'"]'),'<iframe'),'Guest shortcode leaked access');
update_post_meta($id,'_vwc_guests','1');vwc_check(vwc_can_join($meeting),'Explicit guest access failed');
$user=wp_create_user('vwc_subscriber','local-synthetic-password','subscriber@example.test');
if(is_wp_error($user)) $user=username_exists('vwc_subscriber');
wp_set_current_user($user);vwc_check(vwc_can_join($meeting),'Member access failed');vwc_check(!current_user_can('edit_post',$id),'Subscriber became a host');
wp_set_current_user(1);vwc_check(current_user_can('edit_post',$id),'Owner cannot host');
$pin=VWC_Tickets::issue(wp_salt('auth'),'wordpress_test','Member_1',vwc_room($id),'host',4,0,vwc_access_policy($id));
$request=new WP_REST_Request('POST','/videowhisper-conference/v1/auth');
$request->set_header('Content-Type','application/json');
$input=['token'=>'local-wordpress-test-token','account'=>'wordpress_test','user'=>'Member_1','pin'=>$pin];
$request->set_body(wp_json_encode($input));$response=rest_do_request($request)->get_data();
vwc_check(!empty($response['login']) && $response['conference']['role']==='host','Authorized host callback failed');
$input['user']='Member_2';$request->set_body(wp_json_encode($input));vwc_check(empty(rest_do_request($request)->get_data()['login']),'Cross-user replay accepted');
$input['user']='Member_1';$input['token']='wrong';$request->set_body(wp_json_encode($input));vwc_check(empty(rest_do_request($request)->get_data()['login']),'Wrong account token accepted');
// Access modes retain old defaults and enforce private keys for members and anonymous visitors.
wp_set_current_user(0); update_post_meta($id,'_vwc_access','private'); $accessKey=str_repeat('a',64); update_post_meta($id,'_vwc_access_key',$accessKey);
vwc_check(!vwc_can_join(get_post($id)),'Private room accepted missing key');
$_GET['key']='wrong';vwc_check(!vwc_can_join(get_post($id)),'Private room accepted incorrect key');
$_GET['key']=$accessKey;vwc_check(vwc_can_join(get_post($id)),'Valid private invitation denied');
wp_set_current_user($user);unset($_GET['key']);vwc_check(!vwc_can_join(get_post($id)),'Member bypassed private key');
wp_set_current_user(1);vwc_check(vwc_can_join(get_post($id)),'Owner cannot open private room');
vwc_check(str_contains(vwc_meeting_url(get_post($id),true),'key='),'Private invitation has no key');
vwc_check(!str_contains(do_shortcode('[videowhisper_conference id="'.$id.'"]'),$accessKey),'Host key leaked into outer shortcode markup');
$_POST=['vwc_access_nonce'=>wp_create_nonce('vwc_access'),'vwc_access'=>'private'];do_action('save_post_vwc_meeting',$id);vwc_check(get_post_meta($id,'_vwc_guests',true)==='0','Private room opened legacy guest flag');$_POST=[];
$pin=VWC_Tickets::issue(wp_salt('auth'),'wordpress_test','Member_1',vwc_room($id),'host',4,0,vwc_access_policy($id));
$input=['token'=>'local-wordpress-test-token','account'=>'wordpress_test','user'=>'Member_1','pin'=>$pin];$request->set_body(wp_json_encode($input));vwc_check(!empty(rest_do_request($request)->get_data()['login']),'Current access policy denied');
update_post_meta($id,'_vwc_access_key',str_repeat('b',64));vwc_check(empty(rest_do_request($request)->get_data()['login']),'Rotated key accepted stale credential');
update_post_meta($id,'_vwc_access','public');unset($_GET['key']);wp_set_current_user(0);vwc_check(vwc_can_join(get_post($id)),'Public room denied guest');
wp_set_current_user(1);$actions=apply_filters('post_row_actions',[],get_post($id));vwc_check(isset($actions['vwc_open']),'Missing Open conference row action');
$rules=get_option('rewrite_rules'); vwc_check(get_post_type_object('vwc_meeting')->publicly_queryable,'Missing frontend route');
file_put_contents('/var/www/html/wp-content/vwc-tests/meeting-id.txt',(string)$id);
echo "WordPress access/callback: 22 checks passed; fixture meeting created\n";
