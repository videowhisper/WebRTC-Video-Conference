<?php
require __DIR__ . '/../editions/php/includes/demo-state.php';
$checks = 0;
function verify($condition, $message) { global $checks; $checks++; if (!$condition) throw new RuntimeException($message); }
$now = 10000;
$limits = ['session' => 10, 'ip' => 60, 'rooms' => 20, 'idle' => 300];
$room = ['expires' => $now + 3600, 'lastActive' => $now, 'members' => []];
$state = ['rooms' => [
    'recent' => $room,
    'idle' => array_replace($room, ['lastActive' => $now - 300]),
    'occupied' => array_replace($room, ['lastActive' => $now - 1000, 'members' => ['guest' => $now - 59]]),
    'stale' => array_replace($room, ['lastActive' => $now - 300, 'members' => ['guest' => $now - 60]]),
    'expired' => array_replace($room, ['expires' => $now]),
    'legacy-recent' => ['expires' => $now + 3599, 'members' => []],
    'legacy-idle' => ['expires' => $now + 3300, 'members' => []],
    'legacy-present' => ['expires' => $now + 3000, 'members' => ['guest' => $now]],
], 'rates' => ['expired' => ['expires' => $now, 'count' => 60], 'current' => ['expires' => $now + 100, 'count' => 5]]];
$clean = VWC_DemoState::prune($state, $now, $limits['idle']);
verify(array_keys($clean['rooms']) === ['recent', 'occupied', 'legacy-recent', 'legacy-present'], 'Idle/expired cleanup or occupied-room preservation failed');
verify(array_keys($clean['rates']) === ['current'], 'Expired rate window retained');
verify($clean['rooms']['legacy-present']['lastActive'] === $now, 'Legacy presence migration failed');
verify(VWC_DemoState::creationError($clean, 'session:a', 'ip', $now, $limits) === null, 'Available slot blocked');
$clean['rates']['session:a'] = ['expires' => $now + 61, 'count' => 10];
$denied = VWC_DemoState::creationError($clean, 'session:a', 'ip', $now, $limits);
verify($denied['status'] === 429 && $denied['retry'] === 61 && str_contains($denied['message'], 'This browser'), 'Browser limit/retry missing');
verify(VWC_DemoState::creationError($clean, 'session:b', 'ip', $now, $limits) === null, 'Shared IP incorrectly blocks another browser');
$clean['rates']['ip'] = ['expires' => $now + 120, 'count' => 60];
$denied = VWC_DemoState::creationError($clean, 'session:b', 'ip', $now, $limits);
verify($denied['status'] === 429 && $denied['retry'] === 120 && str_contains($denied['message'], 'This connection'), 'IP abuse limit missing');
$clean['rates'] = [];
$clean['rooms'] = array_fill(0, 20, $room);
$denied = VWC_DemoState::creationError($clean, 'session:b', 'ip', $now, $limits);
verify($denied['status'] === 503 && $denied['retry'] === 300, 'Global capacity/retry missing');
$clean = VWC_DemoState::prune($clean, $now + 300, $limits['idle']);
verify(VWC_DemoState::creationError($clean, 'session:b', 'ip', $now + 300, $limits) === null, 'Idle slots did not become available');
putenv('VWC_SESSION_ROOMS_PER_HOUR=0'); putenv('VWC_IP_ROOMS_PER_HOUR=99999'); putenv('VWC_ROOM_IDLE_SECONDS=invalid');
$configured = VWC_DemoState::limits();
verify($configured['session'] === 1 && $configured['ip'] === 600 && $configured['idle'] === 300, 'Configuration bounds/defaults failed');
foreach (['VWC_SESSION_ROOMS_PER_HOUR', 'VWC_IP_ROOMS_PER_HOUR', 'VWC_ROOM_IDLE_SECONDS'] as $name) putenv($name);
echo "PHP demo lifecycle: $checks checks passed\n";
