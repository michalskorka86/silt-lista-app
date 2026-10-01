<?php
// Atrapa API Anthropic (tylko do testów): sprawdza klucz i zdjęcie, odpowiada jak Claude — tekst z JSON-em listy graczy.
header('Content-Type: application/json; charset=utf-8');
$naglowki = function_exists('getallheaders') ? array_change_key_case(getallheaders()) : [];
$j = json_decode((string)file_get_contents('php://input'), true);
if (($naglowki['x-api-key'] ?? '') !== 'test-key') { http_response_code(401); echo json_encode(['type' => 'error', 'error' => ['message' => 'invalid x-api-key']]); exit; }
$obraz = $j['messages'][0]['content'][0]['source']['data'] ?? '';
if ($obraz === '') { http_response_code(400); echo json_encode(['error' => ['message' => 'no image']]); exit; }
$tekst = "Oto lista:\n" . json_encode(['gracze' => [
    ['imie' => 'Alex', 'kulki' => [100, 100], 'dokupione' => [500], 'dym' => 1],
    ['imie' => 'Ola', 'kulki' => [200, -5, 'x'], 'dokupione' => [], 'dym' => 0],
    ['imie' => '?', 'kulki' => [100], 'dokupione' => [], 'dym' => 0],
]], JSON_UNESCAPED_UNICODE);
echo json_encode(['content' => [['type' => 'text', 'text' => $tekst]], 'model' => $j['model'] ?? ''], JSON_UNESCAPED_UNICODE);
