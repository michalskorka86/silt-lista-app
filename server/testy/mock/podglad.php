<?php
// Atrapa podglad.php z systemu rezerwacji (tylko do testów): dwie rezerwacje w podanym zakresie.
header('Content-Type: application/json; charset=utf-8');
if (($_GET['token'] ?? '') !== 'test') { echo json_encode(['ok' => false, 'msg' => 'Zły token']); exit; }
$od = $_GET['from'] ?? date('Y-m-01');
echo json_encode(['ok' => true, 'teraz' => date('c'),
    'atrakcje' => [['nazwa' => 'Paintball Klasyczny', 'kolor' => '#8B6355'], ['nazwa' => 'ASG', 'kolor' => '#D4607A']],
    'data' => [
        ['id' => 1, 'data' => $od, 'od' => '10:00', 'do' => '12:00', 'osoby' => 12, 'klient' => 'Jan Kowalski', 'atrakcja' => 'Paintball Klasyczny',
         'kolor' => '#8B6355', 'marka' => 'silt', 'lok' => 'SILT', 'uwagi' => 'Urodziny', 'instrukcje' => 'Przygotować 2 pola', 'dodatki' => ['Ognisko'], 'potw' => true, 'zadatek' => true],
        ['id' => 2, 'data' => $od, 'od' => '14:30', 'do' => '', 'osoby' => 8, 'klient' => 'Firma X', 'atrakcja' => 'ASG',
         'kolor' => '#D4607A', 'marka' => 'arsenal', 'lok' => 'Arsenał · Rembertów', 'uwagi' => '', 'instrukcje' => '', 'dodatki' => [], 'potw' => false, 'zadatek' => false],
    ]], JSON_UNESCAPED_UNICODE);
