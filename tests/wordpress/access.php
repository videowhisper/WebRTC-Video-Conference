<?php
add_filter('pre_wp_mail', '__return_true');
function vwconf_check($value, $message) { if (!$value) throw new RuntimeException($message); }
$id = wp_insert_post(['post_type'=>'vwconf_meeting','post_status'=>'publish','post_title'=>'Local conference test','post_author'=>1]);
update_option('vwconf_settings',['socket'=>'http://127.0.0.1:8092','account'=>'wordpress_test','token'=>'local-wordpress-test-token']);
$meeting=get_post($id); wp_set_current_user(0);
vwconf_check(!vwconf_can_join($meeting),'Guests must be disabled by default');
vwconf_check(!str_contains(do_shortcode('[videowhisper_conference id="'.$id.'"]'),'<iframe'),'Guest shortcode leaked access');
update_post_meta($id,'_vwconf_guests','1');vwconf_check(vwconf_can_join($meeting),'Explicit guest access failed');
$user=wp_create_user('vwconf_subscriber','local-synthetic-password','subscriber@example.test');
if(is_wp_error($user)) $user=username_exists('vwconf_subscriber');
wp_set_current_user($user);vwconf_check(vwconf_can_join($meeting),'Member access failed');vwconf_check(!current_user_can('edit_post',$id),'Subscriber became a host');
wp_set_current_user(1);vwconf_check(current_user_can('edit_post',$id),'Owner cannot host');
$pin=VWCONF_Tickets::issue(wp_salt('auth'),'wordpress_test','Member_1',vwconf_room($id),'host',4,0,vwconf_access_policy($id));
$request=new WP_REST_Request('POST','/videowhisper-conference/v1/auth');
$request->set_header('Content-Type','application/json');
$input=['token'=>'local-wordpress-test-token','account'=>'wordpress_test','user'=>'Member_1','pin'=>$pin];
$request->set_body(wp_json_encode($input));$response=rest_do_request($request)->get_data();
vwconf_check(!empty($response['login']) && $response['conference']['role']==='host','Authorized host callback failed');
$input['user']='Member_2';$request->set_body(wp_json_encode($input));vwconf_check(empty(rest_do_request($request)->get_data()['login']),'Cross-user replay accepted');
$input['user']='Member_1';$input['token']='wrong';$request->set_body(wp_json_encode($input));vwconf_check(empty(rest_do_request($request)->get_data()['login']),'Wrong account token accepted');
// Access modes retain old defaults and enforce private keys for members and anonymous visitors.
wp_set_current_user(0); update_post_meta($id,'_vwconf_access','private'); $accessKey=str_repeat('a',64); update_post_meta($id,'_vwconf_access_key',$accessKey);
vwconf_check(!vwconf_can_join(get_post($id)),'Private room accepted missing key');
$_GET['key']='wrong';vwconf_check(!vwconf_can_join(get_post($id)),'Private room accepted incorrect key');
$_GET['key']=$accessKey;vwconf_check(vwconf_can_join(get_post($id)),'Valid private invitation denied');
wp_set_current_user($user);unset($_GET['key']);vwconf_check(!vwconf_can_join(get_post($id)),'Member bypassed private key');
wp_set_current_user(1);vwconf_check(vwconf_can_join(get_post($id)),'Owner cannot open private room');
vwconf_check(str_contains(vwconf_meeting_url(get_post($id),true),'key='),'Private invitation has no key');
vwconf_check(!str_contains(do_shortcode('[videowhisper_conference id="'.$id.'"]'),$accessKey),'Host key leaked into outer shortcode markup');
$_POST=['vwconf_access_nonce'=>wp_create_nonce('vwconf_access'),'vwconf_access'=>'private'];do_action('save_post_vwconf_meeting',$id);vwconf_check(get_post_meta($id,'_vwconf_guests',true)==='0','Private room opened legacy guest flag');$_POST=[];
$pin=VWCONF_Tickets::issue(wp_salt('auth'),'wordpress_test','Member_1',vwconf_room($id),'host',4,0,vwconf_access_policy($id));
$input=['token'=>'local-wordpress-test-token','account'=>'wordpress_test','user'=>'Member_1','pin'=>$pin];$request->set_body(wp_json_encode($input));vwconf_check(!empty(rest_do_request($request)->get_data()['login']),'Current access policy denied');
update_post_meta($id,'_vwconf_access_key',str_repeat('b',64));vwconf_check(empty(rest_do_request($request)->get_data()['login']),'Rotated key accepted stale credential');
update_post_meta($id,'_vwconf_access','public');unset($_GET['key']);wp_set_current_user(0);vwconf_check(vwconf_can_join(get_post($id)),'Public room denied guest');
wp_set_current_user(1);$actions=apply_filters('post_row_actions',[],get_post($id));vwconf_check(isset($actions['vwconf_open']),'Missing Open conference row action');
$rules=get_option('rewrite_rules'); vwconf_check(get_post_type_object('vwconf_meeting')->publicly_queryable,'Missing frontend route');
file_put_contents('/var/www/html/wp-content/vwc-tests/meeting-id.txt',(string)$id);
echo "WordPress access/callback: 22 checks passed; fixture meeting created\n";
