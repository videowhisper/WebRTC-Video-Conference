<?php
/** Owned native fixture only; all CRM HTTP is intercepted before any network connection. */
use VWCONF\StreamingConnect\Connection;
wp_set_current_user(1);
$key='vwconf_crm_connection_'.get_current_blog_id().'_1';
$before=get_option($key,null);$manual=get_option('vwconf_settings',[]);$calls=[];$checks=[];$scenario='normal';$provisioned=false;$proofChecks=0;
$check=static function($value,$message)use(&$checks){if(!$value)throw new RuntimeException($message);$checks[]=$message;};
$fail=static function($fn,$message)use($check){try{$fn();}catch(Throwable $error){$check(true,$message);return;}$check(false,$message);};
$token='synthetic-owned-account-token';$session=str_repeat('a',64);
$account=['id'=>7,'name'=>'conference.example.test','token'=>$token];
$form=['form'=>['name'=>'Register','instructions'=>'Fixture instructions','terms'=>'Fixture account terms','termsUrl'=>'https://consult.videowhisper.com/terms/'],'fields'=>[['name'=>'Website','type'=>'url'],['name'=>'Purpose','type'=>'select','options'=>['Testing','Meetings']],'Topics'=>['name'=>'Topics','type'=>'multiselect','options'=>['Media','Support']]]];
$mock=static function($pre,$args,$url)use(&$calls,&$scenario,&$provisioned,&$proofChecks,$account,$form,$token,$session){
 if(!str_starts_with($url,'https://consult.videowhisper.com/wp-json/video-live-support/v1/remote/'))throw new RuntimeException('Unexpected HTTP target');
 $route=basename(wp_parse_url($url,PHP_URL_PATH));$body=json_decode($args['body']??'{}',true);$calls[]=[$route,$args,$body];
 if($scenario==='network')return new WP_Error('synthetic_network','Synthetic fixture failure');
 if($scenario==='redirect')return ['body'=>'{}','response'=>['code'=>302],'headers'=>['location'=>'https://other.example.test/']];
 if($scenario==='changed_form'&&$route==='config')return ['body'=>wp_json_encode(array_replace_recursive($form,['form'=>['terms'=>'CHANGED TERMS']])),'response'=>['code'=>200]];
 if($scenario==='malformed')return ['body'=>'null','response'=>['code'=>200]];
 if($route==='callback-capabilities'){if($scenario==='old_provider')return ['body'=>'{}','response'=>['code'=>404]];$data=['version'=>1,'atomic'=>true,'site_proof'=>true,'products'=>['videowhisper-video-conference']];}
 elseif($route==='callback-provision'){
  if($scenario==='provision_fail')return new WP_Error('synthetic_provision','Fixture failure');
  $challenge=array_intersect_key($body,array_flip(['nonce','expires','site','plugin','account_id']));$challenge['version']=1;$challenge['provider']='https://consult.videowhisper.com';$challenge['properties_hash']=hash('sha256',wp_json_encode($body['properties']));
  $request=new WP_REST_Request('POST','/videowhisper-streaming-connect/v1/proof');$request->set_header('Content-Type','application/json');$request->set_body(wp_json_encode($challenge));
  $reply=Connection::proof($request);if(is_wp_error($reply))throw new RuntimeException('Valid pending proof rejected');
  $text=implode("\n",['vws-streaming-callback-v1',$body['nonce'],$body['expires'],$body['site'],$challenge['provider'],$body['plugin'],$body['account_id'],$challenge['properties_hash']]);
  if($reply->get_data()['proof']!==hash_hmac('sha256',$text,$body['proof_key'])||!str_contains($reply->get_headers()['Cache-Control'],'no-store'))throw new RuntimeException('Site proof signature/cache failure');$proofChecks++;
  foreach(['site'=>'https://foreign.example.org/','provider'=>'https://foreign.example.org','account_id'=>999,'properties_hash'=>str_repeat('0',64),'expires'=>time()-1]as$field=>$wrong){$bad=clone $request;$bad->set_body(wp_json_encode(array_replace($challenge,[$field=>$wrong])));if(!is_wp_error(Connection::proof($bad)))throw new RuntimeException('Proof binding failed: '.$field);$proofChecks++;}
  $provisioned=true;$data=['version'=>1,'account_id'=>$body['account_id'],'nonce'=>$scenario==='wrong_receipt'?'incorrect':$body['nonce'],'configured'=>['loginURL'=>hash('sha256',rest_url('videowhisper-conference/v1/auth'))]];
 }
 elseif($route==='config'){$data=$form;if($scenario==='no_website')array_shift($data['fields']);}
 elseif(in_array($route,['login','register'],true))$data=['contact_id'=>7,'confirmed'=>false];
 elseif($route==='confirm')$data=['confirmed'=>true,'contact_id'=>7,'remote_token'=>$session,'remote_token_expires'=>time()+3600,'contact_pin'=>'DO-NOT-STORE-PERMANENT-PIN','accounts'=>[$account]];
 elseif(in_array($route,['accounts','account_new'],true))$data=['accounts'=>[$account]];
 elseif($route==='settings'){
  $data=['settings'=>['vwsSocket'=>'https://signal.example.test:3000','vwsAccount'=>$account['name'],'vwsToken'=>$token,'arbitrary_private_setting'=>'DO-NOT-IMPORT','loginURL'=>rest_url('videowhisper-conference/v1/auth')],'callback_fingerprints'=>['loginURL'=>hash('sha256',rest_url('videowhisper-conference/v1/auth'))]];
  if($scenario==='conflict'){$data['settings']['loginURL']='https://other.example.test/auth';$data['callback_fingerprints']['loginURL']=hash('sha256','https://other.example.test/auth');}
  if($scenario==='missing_callback'||(in_array($scenario,['provision','old_provider','provision_fail','stale_settings','wrong_receipt'],true)&&(!$provisioned||$scenario==='stale_settings'))){unset($data['settings']['loginURL']);$data['callback_fingerprints']=[];}
  if($scenario==='bad_socket')$data['settings']['vwsSocket']='https://name:secret@signal.example.test/path?token=private';
  if($scenario==='wrong_identity')$data['settings']['vwsAccount']='someone_else';
  if($scenario==='wrong_token')$data['settings']['vwsToken']='another-owned-token';
 }
 else throw new RuntimeException('Unexpected operation');
 return ['body'=>wp_json_encode($data),'response'=>['code'=>200],'headers'=>[]];
};
add_filter('pre_http_request',$mock,1,3);
try{
 delete_option($key);delete_transient($key.'_form');
 ob_start();Connection::render();$html=ob_get_clean();
 $check(count($calls)===0,'Opening Connect makes zero CRM calls');
 $check(str_contains($html,'Email a login code')&&!str_contains($html,'Load registration form')&&str_contains($html,'contact=new'),'Existing-contact tab shows only login');
 $_GET['contact']='new';ob_start();Connection::render();$newHtml=ob_get_clean();unset($_GET['contact']);$check(str_contains($newHtml,'Load registration form')&&!str_contains($newHtml,'Email a login code'),'New-contact tab shows only opt-in registration');$check(count($calls)===0,'Contact tab navigation makes zero provider calls');$check(strrpos($newHtml,'Provider terms')>strrpos($newHtml,'</form>'),'Provider terms links follow forms at section bottom');
 $fail(fn()=>Connection::perform('login',['email'=>'fixture@example.test']),'Login requires explicit consent');
 $check(count($calls)===0,'No contact data sent before consent');
 wp_set_current_user(0);$fail(fn()=>Connection::perform('load',['consent'=>'1']),'Guests cannot initiate CRM actions');wp_set_current_user(1);
 Connection::perform('load',['consent'=>'1']);
 $check($calls[0][0]==='config'&&empty($calls[0][2]),'Registration schema load sends no personal data');
 $_GET['contact']='new';$beforeRender=count($calls);ob_start();Connection::render();$registrationHtml=ob_get_clean();unset($_GET['contact']);$check(str_contains($registrationHtml,'form-table')&&str_contains($registrationHtml,'Register with VideoWhisper')&&!str_contains($registrationHtml,'Email a login code'),'Loaded registration uses its own table-based form');$check(count($calls)===$beforeRender&&strrpos($registrationHtml,'Provider terms')>strrpos($registrationHtml,'</form>'),'Cached registration render has no HTTP and keeps terms footer last');
 $check($calls[0][1]['redirection']===0&&$calls[0][1]['limit_response_size']===262144,'Requests disable redirects and bound response size');
 foreach([['consent'=>'1','name'=>'Fixture User','email'=>'fixture@example.test'],['consent'=>'1','terms'=>'1','name'=>'Fixture User','email'=>'fixture@example.test','fields'=>['Unknown'=>'injected']],['consent'=>'1','terms'=>'1','name'=>'Fixture User','email'=>'fixture@example.test','fields'=>['Purpose'=>'Forged']]]as$bad)$fail(fn()=>Connection::perform('register',$bad),'Invalid registration terms or fields rejected');
 $fail(fn()=>Connection::perform('register',['consent'=>'1','terms'=>'1','name'=>'Fixture User','email'=>'fixture@example.test','fields'=>['Topics'=>[['nested']]]]),'Nested multiselect input rejected without conversion');
 $scenario='changed_form';$fail(fn()=>Connection::perform('register',['consent'=>'1','terms'=>'1','name'=>'Fixture User','email'=>'fixture@example.test','fields'=>['Purpose'=>'Testing']]),'Changed provider terms require a form reload before registration');$scenario='normal';
 Connection::perform('register',['consent'=>'1','terms'=>'1','name'=>'Fixture User','email'=>'fixture@example.test','fields'=>['Purpose'=>'Testing','Topics'=>['Media']]]);
 $sent=end($calls)[2];$check($sent['fields']['Website']===home_url('/')&&$sent['client_plugin']==='videowhisper-video-conference','Registration binds site and plugin server-side');
 Connection::perform('confirm',['pin'=>'SYNTHETIC-CODE']);$state=get_option($key);
 $check($state['contact_id']===7&&$state['remote_token']===$session,'Confirmed remote session stored server-side');
 $check(!str_contains(wp_json_encode($state),'DO-NOT-STORE')&&!str_contains(wp_json_encode($state),$token),'Permanent PIN and unselected account tokens are not persisted');
 ob_start();Connection::render();$html=ob_get_clean();$check(!str_contains($html,$session)&&!str_contains($html,$token),'No contact or account credential appears in rendered forms');
 $check(str_contains($html,'conference.example.test')&&str_contains($html,'Use this account'),'Owned account list renders names and numeric IDs only');
 $count=count($calls);$fail(fn()=>Connection::perform('create',[]),'Account creation needs separate approval');$check(count($calls)===$count,'Unapproved creation performs no HTTP');
 Connection::perform('create',['create_approved'=>'1']);$check(end($calls)[0]==='account_new','Approved creation uses existing CRM account endpoint');
 $fail(fn()=>Connection::perform('import',['account_id'=>'999']),'Unlisted account selection rejected');
 $beforeImport=vwconf_settings();
 foreach(['conflict','bad_socket','wrong_identity','wrong_token']as$bad){$scenario=$bad;$fail(fn()=>Connection::perform('import',['account_id'=>'7']),'Unsafe callback/settings/identity response rejected: '.$bad);$check(vwconf_settings()===$beforeImport,'Failed import retains manual settings: '.$bad);}
 $scenario='normal';update_option('vwconf_settings',array_merge($beforeImport,['retained_fixture'=>'keep']),false);Connection::perform('import',['account_id'=>'7']);
 $settings=vwconf_settings();$check($settings['account']===$account['name']&&$settings['socket']==='https://signal.example.test:3000'&&$settings['token']===$token,'Validated selected streaming credentials imported');
 $check($settings['retained_fixture']==='keep'&&!isset($settings['arbitrary_private_setting'])&&!isset($settings['loginURL']),'Only adapter allowlist imported and unrelated settings retained');
 $check(get_option($key)['callback_required']===[],'Matching callback verified without a remote write');
 $scenario='missing_callback';Connection::perform('import',['account_id'=>'7']);
 $check(get_option($key)['callback_required']===['loginURL'],'Missing callback produces explicit setup-required state');
 $check(!in_array('push',array_column($calls,0),true),'Connector never overwrites remote properties');
 $beforeProvision=vwconf_settings();
 foreach(['old_provider','provision_fail','stale_settings','wrong_receipt']as$bad){$scenario=$bad;$provisioned=false;$saved=get_option($key);$fail(fn()=>Connection::perform('provision',['account_id'=>'7']),'Safe provisioning rejects incomplete provider transaction: '.$bad);$check(vwconf_settings()===$beforeProvision&&get_option($key)===$saved,'Failed provisioning preserves local settings/session: '.$bad);}
 $scenario='conflict';$count=count($calls);$fail(fn()=>Connection::perform('provision',['account_id'=>'7']),'Provisioning rejects foreign callback before remote write');$check(!in_array('callback-provision',array_column(array_slice($calls,$count),0),true),'Foreign callback is not provisioned');
 $scenario='provision';$provisioned=false;Connection::perform('provision',['account_id'=>'7']);$check($provisioned&&get_option($key)['callback_required']===[],'Site-proven provisioning verifies fresh settings before import');$check($proofChecks>=6,'Proof is signed and bound to site, provider, account, properties and expiry');
 $lastProvision=array_values(array_filter($calls,static fn($row)=>$row[0]==='callback-provision'));$body=end($lastProvision)[2];$check($body['expected']===['loginURL'=>null],'Only an empty callback compare-and-set is requested');
 $proof=new WP_REST_Request('POST','/videowhisper-streaming-connect/v1/proof');$proof->set_header('Content-Type','application/json');$proof->set_body(wp_json_encode(['version'=>1,'nonce'=>$body['nonce']]));$check(is_wp_error(Connection::proof($proof)),'Pending proof removed after completion');
 $count=count($calls);Connection::perform('provision',['account_id'=>'7']);$check(!in_array('callback-provision',array_column(array_slice($calls,$count),0),true),'Already-correct callback imports without another remote write');
 $check(!in_array('push',array_column($calls,0),true),'No unsafe legacy push fallback');
 $priorState=get_option($key);$priorSettings=vwconf_settings();
 foreach(['network','redirect','malformed']as$bad){$scenario=$bad;$fail(fn()=>Connection::perform('accounts',[]),'Provider failure rejected: '.$bad);$check(get_option($key)===$priorState&&vwconf_settings()===$priorSettings,'Provider failure retains connection and manual configuration');}
 $scenario='normal';$expired=$priorState;$expired['expires']=time()-1;update_option($key,$expired,false);$count=count($calls);$fail(fn()=>Connection::perform('accounts',[]),'Expired remote session rejected locally');$check(count($calls)===$count,'Expired session causes no HTTP');update_option($key,$priorState,false);
 Connection::perform('disconnect',[]);$check(get_option($key,null)===null&&vwconf_settings()===$priorSettings,'Disconnect removes only the local admin session');
 $scenario='no_website';Connection::perform('load',['consent'=>'1']);Connection::perform('register',['consent'=>'1','terms'=>'1','name'=>'Fixture User','email'=>'fixture@example.test','fields'=>['Purpose'=>'Testing']]);$sent=end($calls)[2];$check(!isset($sent['fields']['Website']),'Provider schema without Website receives no unsolicited field');Connection::perform('disconnect',[]);
 $check(!array_filter($calls,static fn($row)=>!str_starts_with($row[1]['headers']['Referer'],home_url('/'))),'Provider requests identify only the native site URL');
 echo 'Streaming Connect: '.count($checks)." checks passed\n";
}finally{
 remove_filter('pre_http_request',$mock,1);null===$before?delete_option($key):update_option($key,$before,false);update_option('vwconf_settings',$manual,false);delete_transient($key.'_form');wp_set_current_user(1);
}
