<?php
require __DIR__ . '/../editions/shared/tickets.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
$key = str_repeat('test-key', 8); $token = 'test-account-token';
$pin = VWC_Tickets::issue($key, 'test', 'guest', 'room', 'guest');
$input = ['account' => 'test', 'user' => 'guest', 'token' => $token, 'pin' => $pin];
check(VWC_Tickets::verify($key, $token, $input)['login'], 'valid ticket rejected');
foreach (['account' => 'wrong', 'user' => 'wrong', 'token' => 'wrong', 'pin' => $pin . 'x'] as $field => $bad) {
    check(!VWC_Tickets::verify($key, $token, array_replace($input, [$field => $bad]))['login'], 'forged ' . $field . ' accepted');
}
$expired = VWC_Tickets::issue($key, 'test', 'guest', 'room', 'guest', 4, time()-1);
check(!VWC_Tickets::verify($key, $token, array_replace($input, ['pin' => $expired]))['login'], 'expired ticket accepted');
$config=VWC_Tickets::config('https://signal.example.test','test','guest',$pin,'room','Meeting');
check(!str_contains(json_encode($config), $token), 'account token leaked');
echo "PHP ticket authentication: 7 checks passed\n";
