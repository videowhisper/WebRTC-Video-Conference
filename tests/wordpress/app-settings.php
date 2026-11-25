<?php
/** Owned disposable WordPress fixture only. */
$beforeServer=vwconf_settings();$before=get_option('vwconf_app_settings',null); $checks=[]; $room=0;
$check=static function($ok,$label)use(&$checks){if(!$ok)throw new RuntimeException($label);$checks[]=$label;};
try {
 wp_set_current_user(1);delete_option('vwconf_app_settings');
 $defaults=vwconf_app_defaults();$check(vwconf_app_settings()===$defaults,'Unconfigured app retains prior defaults');
 $input=array_replace($defaults,['participants'=>'2','layout'=>'speaker','panel'=>'closed','theme'=>'dark','media'=>'economy','embed_height'=>'720px','join_media'=>false,'mic_muted'=>true,'camera_off'=>true,'screen_share'=>false,'push_to_talk'=>true,'token'=>'forged','channel'=>'forged','consent'=>true]);
 $clean=vwconf_sanitize_app($input);$check(!array_intersect(['token','channel','consent'],array_keys($clean)),'Unknown authority and consent fields are discarded');update_option('vwconf_app_settings',$clean,false);
 foreach(['participants'=>['5','0','2<script>',[],2],'theme'=>['url(javascript:1)',[]],'embed_height'=>['1px;position:fixed',[]],'join_media'=>['true',[]],'push_to_talk'=>['true',[]]] as $key=>$values) foreach($values as $value) $check(vwconf_sanitize_app(array_replace($input,[$key=>$value]))===$clean,'Invalid '. $key .' rejected without changing settings');
 $base=VWCONF_Tickets::config('https://server.example.test:3000','synthetic','Guest_123','signed','room','Title');$config=vwconf_app_config($base);
 $check($config['videowhisperServer']===$base['videowhisperServer']&&$config['channel']===$base['channel'],'Presentation settings cannot alter credentials or room');
 $check($config['conference']['pushToTalk']===true&&$config['conference']['maxParticipants']===2&&!$config['conference']['allowScreenShare']&&!$config['conference']['joinWithMedia'],'Boolean and capacity controls projected');
 $check($config['stream']['width']===320&&$config['stream']['framerate']===10&&$config['stream']['videoBitrate']===90&&$config['stream']['audioBitrate']===24,'Economy profile stays below existing Free media limits');
 $room=wp_insert_post(['post_type'=>'vwconf_meeting','post_status'=>'publish','post_title'=>'App settings fixture','post_author'=>1]);
 update_option('vwconf_settings',['socket'=>'https://server.example.test:3000','account'=>'synthetic','token'=>'fixture-token'],false);
 $policy=vwconf_access_policy($room);$pin=VWCONF_Tickets::issue(wp_salt('auth'),'synthetic','Member_1',vwconf_room($room),'host',(int)$clean['participants'],0,$policy);
 $result=VWCONF_Tickets::verify(wp_salt('auth'),'fixture-token',['account'=>'synthetic','user'=>'Member_1','pin'=>$pin,'token'=>'fixture-token']);
 $check(!empty($result['login'])&&$result['conference']['maxParticipants']===2,'Participant limit is in verified signed credentials');
 $request=new WP_REST_Request('POST','/videowhisper-conference/v1/auth');$request->set_header('Content-Type','application/json');$request->set_body(wp_json_encode(['account'=>'synthetic','user'=>'Member_1','pin'=>$pin,'token'=>'fixture-token']));
 $check(!empty(rest_do_request($request)->get_data()['login']),'Current capacity credential accepted by real callback');
 $changed=array_replace($clean,['theme'=>'light']);update_option('vwconf_app_settings',$changed,false);$check(vwconf_access_policy($room)===$policy,'Cosmetic changes do not invalidate credentials');
 update_option('vwconf_app_settings',array_replace($changed,['participants'=>'3']),false);$check(vwconf_access_policy($room)!==$policy,'Capacity changes invalidate old callback policy');
 $check(empty(rest_do_request($request)->get_data()['login']),'Real callback rejects stale capacity credential');
 $html=do_shortcode('[videowhisper_conference id="'.$room.'"]');$check(str_contains($html,'height:720px;min-height:420px'),'Embed uses allowlisted height');
 update_option('vwconf_app_settings',['participants'=>99,'theme'=>[],'screen_share'=>'false'],false);$check(vwconf_app_settings()===$defaults,'Corrupt stored values fall back to safe defaults');
 echo count($checks)." app-settings assertions passed\n";
} finally {
 if($before===null)delete_option('vwconf_app_settings');else update_option('vwconf_app_settings',$before,false);
 update_option('vwconf_settings',$beforeServer,false);
 if($room)wp_delete_post($room,true);wp_set_current_user(0);
}
