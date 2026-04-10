<?php
require_once __DIR__ . '/includes/Database.php';

$dbConfig = require __DIR__ . '/config/database.php';
\KbitArchitect\Core\Database::getInstance($dbConfig['default']);
$db = \KbitArchitect\Core\Database::getInstance();

header('Content-Type: application/json');

$rows = $db->query('SELECT id, user_id, points_cost, actual_cost, created_at FROM kbit_usage_logs ORDER BY created_at DESC LIMIT 5');
echo json_encode($rows, JSON_PRETTY_PRINT);
