<?php
// Atrapa API Statystyk (tylko do testów): trzyma wpisy w pliku JSON, zachowuje się jak prawdziwe api.php
// (POST istniejącego id = błąd 500, dlatego serwer Listy najpierw robi DELETE).
header('Content-Type: application/json; charset=utf-8');
$plik = (getenv('SILT_MOCK_DIR') ?: sys_get_temp_dir()) . '/stat.json';
$db = is_file($plik) ? json_decode(file_get_contents($plik), true) : [];
$tabela = $_GET['table'] ?? '';
$id = $_GET['id'] ?? '';
$m = $_SERVER['REQUEST_METHOD'];
if ($tabela === 'pracownicy' && $m === 'GET') {
    echo json_encode([
        ['id' => 'pr1', 'imie' => 'Janek', 'stawka' => '30.00', 'premia' => '5.00', 'aktywny' => '1'],
        ['id' => 'pr2', 'imie' => 'Stary', 'stawka' => '25.00', 'premia' => '0.00', 'aktywny' => '0'],
    ]);
    exit;
}
if ($m === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);
    if (isset($db[$tabela][$b['id']])) { http_response_code(500); echo json_encode(['error' => 'Duplicate entry']); exit; }
    $db[$tabela][$b['id']] = $b;
} elseif ($m === 'DELETE') {
    unset($db[$tabela][$id]);
}
file_put_contents($plik, json_encode($db, JSON_UNESCAPED_UNICODE));
echo json_encode(['ok' => true]);
