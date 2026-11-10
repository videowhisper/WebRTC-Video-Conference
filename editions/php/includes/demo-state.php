<?php
/** Bounded public-demo lifecycle. Caller holds the private ledger lock. */
final class VWC_DemoState {
    public static function limits(): array {
        $read = static function (string $name, int $default, int $maximum): int {
            $value = getenv($name);
            return $value !== false && ctype_digit($value) ? max(1, min($maximum, (int) $value)) : $default;
        };
        return ['session' => $read('VWC_SESSION_ROOMS_PER_HOUR', 10, 100),
            'ip' => $read('VWC_IP_ROOMS_PER_HOUR', 60, 600),
            'rooms' => $read('VWC_MAX_ROOMS', 20, 200),
            'idle' => $read('VWC_ROOM_IDLE_SECONDS', 300, 3600)];
    }

    public static function prune(array $state, int $now, int $idle): array {
        $rooms = [];
        foreach ($state['rooms'] ?? [] as $id => $entry) {
            if (($entry['expires'] ?? 0) <= $now) continue;
            $entry['members'] = array_filter($entry['members'] ?? [], static fn($seen) => $seen > $now - 60);
            // Older ledgers have only the fixed one-hour expiry and presence timestamps.
            $lastActive = $entry['lastActive'] ?? max([($entry['expires'] ?? 0) - 3600, ...array_values($entry['members'])]);
            if (!$entry['members'] && $lastActive + $idle <= $now) continue;
            $entry['lastActive'] = $lastActive;
            $rooms[$id] = $entry;
        }
        return ['rooms' => $rooms, 'rates' => array_filter($state['rates'] ?? [], static fn($rate) => ($rate['expires'] ?? 0) > $now)];
    }

    public static function creationError(array $state, string $session, string $ip, int $now, array $limits): ?array {
        foreach ([$session => ['limit' => $limits['session'], 'label' => 'This browser'], $ip => ['limit' => $limits['ip'], 'label' => 'This connection']] as $id => $policy) {
            $rate = $state['rates'][$id] ?? [];
            if (($rate['expires'] ?? 0) > $now && ($rate['count'] ?? 0) >= $policy['limit']) {
                $retry = max(1, $rate['expires'] - $now);
                return ['status' => 429, 'retry' => $retry, 'message' => $policy['label'] . ' has reached its hourly room-creation limit. Try again in ' . (int) ceil($retry / 60) . ' minutes. You can still join with an invitation or use an active public room below.'];
            }
        }
        if (count($state['rooms']) >= $limits['rooms']) {
            $retry = min(array_map(static fn($room) => max(1, min($room['expires'], $room['lastActive'] + $limits['idle']) - $now), $state['rooms']));
            return ['status' => 503, 'retry' => $retry, 'message' => 'All demo room slots are currently reserved. Empty rooms are released after ' . (int) ceil($limits['idle'] / 60) . ' minutes without activity. Join an active public room below or try again in ' . (int) ceil($retry / 60) . ' minutes.'];
        }
        return null;
    }
}
