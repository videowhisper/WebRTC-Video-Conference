<?php
/** Run only in a disposable fixture; proves the no-legacy-data initialization path. */
$old = vwconf_settings();
delete_option('vwconf_schema_version'); delete_option('vwconf_settings'); delete_option('vwc_settings');
vwconf_upgrade();
if (get_option('vwconf_schema_version') !== '1' || vwconf_settings() !== []) throw new RuntimeException('Clean manual-only initialization failed');
if (!post_type_exists('vwconf_meeting') || post_type_exists('vwc_meeting')) throw new RuntimeException('Unexpected registered post types');
if (function_exists('vwc_app') || class_exists('VWC_Tickets') || defined('VWC_VERSION')) throw new RuntimeException('Old PHP globals remain');
update_option('vwconf_settings', $old, false);
echo "Clean initialization: schema, empty settings, post type and globals passed\n";
