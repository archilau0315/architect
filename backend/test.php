<?php
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => 'PHP工作正常',
    'time' => date('Y-m-d H:i:s')
]);
