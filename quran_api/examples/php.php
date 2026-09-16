<?php
/**
 * FALAH Quran API — PHP client (no dependencies).
 * Usage: FALAH_API_BASE_URL=https://api.example.com php php.php
 */
declare(strict_types=1);

final class QuranApiException extends RuntimeException
{
    public readonly string $errorCode;

    public function __construct(string $errorCode, string $message)
    {
        parent::__construct("$errorCode: $message");
        $this->errorCode = $errorCode;
    }
}

final class QuranApi
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly ?string $token = null,
    ) {}

    private function get(string $path): array
    {
        $headers = ['Accept: application/json'];
        if ($this->token !== null) {
            $headers[] = 'Authorization: Bearer ' . $this->token;
        }

        $handle = curl_init(rtrim($this->baseUrl, '/') . '/api/v1' . $path);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        $raw = curl_exec($handle);
        if ($raw === false) {
            throw new QuranApiException('NETWORK_ERROR', curl_error($handle));
        }
        curl_close($handle);

        $body = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
        if (($body['success'] ?? false) !== true) {
            throw new QuranApiException(
                $body['error']['code'] ?? 'UNKNOWN',
                $body['error']['message'] ?? 'request failed',
            );
        }
        return $body;
    }

    public function health(): array
    {
        return $this->get('/health')['data'];
    }

    public function version(): array
    {
        return $this->get('/version')['data'];
    }

    /** @return array<int, array<string, mixed>> */
    public function surahs(): array
    {
        return $this->get('/surahs?limit=114')['data'];
    }

    public function ayah(int $surah, int $ayah, ?string $translation = null): array
    {
        $query = $translation !== null ? '?translation=' . rawurlencode($translation) : '';
        return $this->get("/ayahs/by-key/$surah:$ayah$query")['data'];
    }

    /** @return array{0: array<int, array<string, mixed>>, 1: int} */
    public function search(string $query, int $limit = 20): array
    {
        $body = $this->get('/search?' . http_build_query(['q' => $query, 'limit' => $limit]));
        return [$body['data'], $body['meta']['total']];
    }
}

$base = getenv('FALAH_API_BASE_URL');
if ($base === false || $base === '') {
    fwrite(STDERR, "set FALAH_API_BASE_URL\n");
    exit(2);
}

$api = new QuranApi($base);
printf("status : %s\n", $api->health()['status']);
printf("dataset: %s\n", $api->version()['dataset']['version']);
printf("surahs : %d\n", count($api->surahs()));

$ayah = $api->ayah(1, 1, 'en-saheeh');
printf("%s: %s\n", $ayah['ayah_key'], $ayah['text']);
printf("hash   : %s\n", $ayah['content_hash']);

[$hits, $total] = $api->search('الحمد لله', 3);
printf("search : %d hits\n", $total);
