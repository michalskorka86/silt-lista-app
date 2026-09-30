<?php
// Atrapa SMSAPI (tylko do testów): zapisuje SMS-y do pliku; plik sms.fail wymusza błąd.
header('Content-Type: application/json; charset=utf-8');
$dir = getenv('SILT_MOCK_DIR') ?: sys_get_temp_dir();
if (is_file("$dir/sms.fail")) { echo json_encode(['error' => 13, 'message' => 'Test: brak środków']); exit; }
if (($_SERVER['HTTP_AUTHORIZATION'] ?? '') !== 'Bearer test-token') { echo json_encode(['error' => 101, 'message' => 'Zły token']); exit; }
$log = is_file("$dir/sms.json") ? json_decode(file_get_contents("$dir/sms.json"), true) : [];
$log[] = ['to' => $_POST['to'] ?? '', 'message' => $_POST['message'] ?? ''];
file_put_contents("$dir/sms.json", json_encode($log, JSON_UNESCAPED_UNICODE));
echo json_encode(['count' => 1, 'list' => [['id' => 'x', 'points' => 0.16]]]);
