<?php
/** Owned disposable fixtures only; no production credentials or email. */
add_filter('pre_wp_mail', '__return_true');
$fixtures=[];
foreach (['members','private','public'] as $mode) {
    $id=wp_insert_post(['post_type'=>'vwc_meeting','post_status'=>'publish','post_title'=>'Frontend '.$mode.' fixture','post_content'=>'Private content canary '.$mode,'post_author'=>1]);
    update_post_meta($id,'_vwc_access',$mode);
    if ($mode==='private') {
        update_post_meta($id,'_vwc_access_key',str_repeat('c',64));
        file_put_contents('/var/www/html/wp-content/vwc-tests/meeting-id.txt',(string)$id);
    }
    $fixtures[$mode]=wp_make_link_relative(get_permalink($id));
}
$fixtures['privateValid']=add_query_arg('key',str_repeat('c',64),$fixtures['private']);
$fixtures['privateWrong']=add_query_arg('key','incorrect',$fixtures['private']);
file_put_contents('/var/www/html/wp-content/vwc-tests/frontend-fixtures.json',wp_json_encode($fixtures));
echo "Member/private/public frontend fixtures created\n";
