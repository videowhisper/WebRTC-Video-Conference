<?php
/** Room-scoped browser credentials; the account token never enters browser config. */
final class VWC_Tickets {
    public static function issue(string $key, string $account, string $user, string $room, string $role, int $limit = 4, int $expires = 0, string $policy = ''): string {
        $payload = ['account' => $account, 'user' => $user, 'version' => 1, 'room' => $room, 'role' => $role,
            'maxParticipants' => max(2, min(4, $limit)), 'expires' => $expires ?: time() + 3600, 'nonce' => bin2hex(random_bytes(12))];
        if ($policy !== '') $payload['policy'] = $policy;
        $body = rtrim(strtr(base64_encode(json_encode($payload, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        return $body . '.' . hash_hmac('sha256', $body, $key);
    }
    public static function verify(string $key, string $accountToken, array $input): array {
        $deny = ['login' => false];
        if (strlen($key) < 32 || !$accountToken || !isset($input['token'], $input['pin'], $input['account'], $input['user'])) return $deny;
        foreach (['token', 'pin', 'account', 'user'] as $field) if (!is_string($input[$field])) return $deny;
        if (!hash_equals($accountToken, $input['token']) || strlen($input['pin']) > 4096) return $deny;
        $parts = explode('.', $input['pin']);
        if (count($parts) !== 2 || !hash_equals(hash_hmac('sha256', $parts[0], $key), $parts[1])) return $deny;
        $data = json_decode(base64_decode(strtr($parts[0], '-_', '+/'), true) ?: '', true);
        if (!is_array($data) || ($data['account'] ?? null) !== $input['account'] || ($data['user'] ?? null) !== $input['user'] ||
            ($data['version'] ?? null) !== 1 || !is_int($data['expires'] ?? null) || $data['expires'] <= time() || $data['expires'] > time() + 3600 ||
            !preg_match('/^[A-Za-z0-9_-]{1,96}$/D', $data['room'] ?? '') || !in_array($data['role'] ?? '', ['host', 'guest'], true)) return $deny;
        if (isset($data['policy']) && (!is_string($data['policy']) || !preg_match('/^[a-f0-9]{64}$/D', $data['policy']))) return $deny;
        return ['login' => true, 'conference' => array_intersect_key($data, array_flip(['version', 'room', 'role', 'maxParticipants', 'expires', 'policy']))];
    }
    public static function config(string $socket, string $account, string $user, string $pin, string $room, string $title): array {
        return ['view' => 'Lobby', 'enableGET' => false, 'configLock' => true, 'channel' => $room, 'title' => $title,
            'username' => $user, 'displayName' => '', 'videowhisperServer' => ['socket' => rtrim($socket, '/') . '/conference', 'authentication' => 'pin', 'account' => $account, 'user' => $user, 'pin' => $pin],
            'conference' => ['maxParticipants' => 4, 'allowScreenShare' => true],
            'stream' => ['width' => 640, 'height' => 360, 'framerate' => 15, 'videoBitrate' => 180, 'audioBitrate' => 32]];
    }
}
