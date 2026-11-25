<?php
/** Synthetic browser actors, no real emails. Owned fixture only. */
add_filter('pre_wp_mail','__return_true');wp_set_current_user(1);
foreach(['vwconf_manager_a','vwconf_manager_b']as$name){$id=username_exists($name);if(!$id)$id=wp_create_user($name,'local-synthetic-password',$name.'@example.test');(new WP_User($id))->set_role('subscriber');}
$prior=get_option('vwconf_access_settings',null);update_option('vwconf_browser_prior_access',$prior,false);
$pages=get_option('vwconf_pages_settings',null);update_option('vwconf_browser_prior_pages',$pages,false);
update_option('vwconf_access_settings',vwconf_sanitize_access(['manager_roles'=>['administrator','editor','author','contributor'],'manage_all_roles'=>['administrator','editor'],'join_mode'=>'everyone','join_roles'=>[]]),false);
echo "Frontend management actors and previous settings saved\n";
