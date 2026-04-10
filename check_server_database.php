<?php
/**
 * 数据库结构检查脚本
 * 用于在服务器上检查数据库表结构与代码的一致性
 * 
 * 使用方法：
 * 1. 将此文件上传到服务器的 backend 目录
 * 2. 在服务器终端执行：php check_server_database.php
 * 
 * 会输出详细的数据库结构信息和与代码的一致性检查
 */

// 数据库配置
$config = [
    'host' => 'localhost',
    'user' => 'kbitai0302',
    'password' => 'kbitai2026',
    'database' => 'kbitai0302',
    'port' => 3306
];

// 控制器文件路径
$controllerFiles = [
    'backend/controllers/userController.js',
    'backend/controllers/authController.js',
    'backend/controllers/adminController.js',
    'backend/controllers/AdminController.php'
];

// 本地SQL文件路径
$sqlFile = 'backend/database.sql';

// 连接数据库
function connectDatabase($config) {
    $mysqli = new mysqli(
        $config['host'],
        $config['user'],
        $config['password'],
        $config['database'],
        $config['port']
    );
    
    if ($mysqli->connect_error) {
        die("连接数据库失败: " . $mysqli->connect_error);
    }
    
    return $mysqli;
}

// 获取服务器上的表结构
function getServerTables($mysqli) {
    $tables = [];
    
    $result = $mysqli->query("SHOW TABLES");
    if ($result) {
        while ($row = $result->fetch_row()) {
            $tableName = $row[0];
            $tables[$tableName] = getTableFields($mysqli, $tableName);
        }
        $result->free();
    }
    
    return $tables;
}

// 获取表的字段结构
function getTableFields($mysqli, $tableName) {
    $fields = [];
    
    $result = $mysqli->query("DESCRIBE `$tableName`");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $fields[] = [
                'fieldName' => $row['Field'],
                'fieldType' => $row['Type'],
                'null' => $row['Null'],
                'key' => $row['Key'],
                'default' => $row['Default'],
                'extra' => $row['Extra']
            ];
        }
        $result->free();
    }
    
    return $fields;
}

// 解析本地SQL文件，获取表结构
function parseLocalSql($sqlFile) {
    if (!file_exists($sqlFile)) {
        return [];
    }
    
    $sqlContent = file_get_contents($sqlFile);
    $tables = [];
    
    // 提取CREATE TABLE语句
    preg_match_all('/CREATE TABLE IF NOT EXISTS ([\w_]+)\s*\(([\s\S]*?)\) ENGINE=/', $sqlContent, $tableMatches, PREG_SET_ORDER);
    
    foreach ($tableMatches as $match) {
        $tableName = $match[1];
        $fieldsContent = $match[2];
        
        $fields = [];
        $fieldLines = explode(',\n', $fieldsContent);
        
        foreach ($fieldLines as $line) {
            $line = trim($line);
            if ($line && !str_starts_with($line, 'PRIMARY KEY') && !str_starts_with($line, 'INDEX') && !str_starts_with($line, 'ENGINE=')) {
                if (preg_match('/^\s*(\w+)\s+([\w\s]+)(?:\s+COMMENT\s+\'([^\']+)\'|$)/', $line, $fieldMatch)) {
                    $fields[] = [
                        'fieldName' => $fieldMatch[1],
                        'fieldType' => trim($fieldMatch[2]),
                        'comment' => $fieldMatch[3] ?? ''
                    ];
                }
            }
        }
        
        $tables[$tableName] = $fields;
    }
    
    return $tables;
}

// 扫描控制器文件，获取使用的表名
function scanControllers($controllerFiles) {
    $usage = [];
    
    foreach ($controllerFiles as $file) {
        if (file_exists($file)) {
            $content = file_get_contents($file);
            $controllerName = basename($file, '.php');
            $controllerName = basename($controllerName, '.js');
            
            // 提取SQL查询中的表名
            preg_match_all('/FROM\s+(`?)([\w_]+)\1|UPDATE\s+(`?)([\w_]+)\3|INSERT INTO\s+(`?)([\w_]+)\5/', $content, $tableMatches, PREG_SET_ORDER);
            
            $tables = [];
            foreach ($tableMatches as $match) {
                for ($i = 2; $i <= 5; $i += 2) {
                    if (!empty($match[$i])) {
                        $tableName = $match[$i];
                        if (!in_array($tableName, $tables)) {
                            $tables[] = $tableName;
                        }
                        break;
                    }
                }
            }
            
            if (!empty($tables)) {
                $usage[$controllerName] = $tables;
            }
        }
    }
    
    return $usage;
}

// 比较结构并输出报告
function compareStructures($serverTables, $localTables, $controllerUsage) {
    echo "=== 数据库结构检查报告 ===\n\n";
    
    // 1. 服务器上存在的表
    echo "1. 服务器上存在的表:\n";
    foreach (array_keys($serverTables) as $tableName) {
        echo "   - $tableName\n";
    }
    echo "\n";
    
    // 2. 本地SQL中定义的表
    echo "2. 本地SQL中定义的表:\n";
    foreach (array_keys($localTables) as $tableName) {
        echo "   - $tableName\n";
    }
    echo "\n";
    
    // 3. 控制器中使用的表
    echo "3. 控制器中使用的表:\n";
    foreach ($controllerUsage as $controller => $tables) {
        echo "   $controller:\n";
        foreach ($tables as $table) {
            echo "     - $table\n";
        }
    }
    echo "\n";
    
    // 4. 差异分析
    echo "4. 差异分析:\n";
    
    // 服务器有但本地没有的表
    $serverOnly = array_diff(array_keys($serverTables), array_keys($localTables));
    if (!empty($serverOnly)) {
        echo "   服务器有但本地SQL中没有的表:\n";
        foreach ($serverOnly as $table) {
            echo "     - $table\n";
        }
    }
    
    // 本地有但服务器没有的表
    $localOnly = array_diff(array_keys($localTables), array_keys($serverTables));
    if (!empty($localOnly)) {
        echo "   本地SQL中有但服务器没有的表:\n";
        foreach ($localOnly as $table) {
            echo "     - $table\n";
        }
    }
    echo "\n";
    
    // 5. 字段差异
    echo "5. 字段差异:\n";
    foreach (array_keys($localTables) as $tableName) {
        if (isset($serverTables[$tableName])) {
            $localFields = array_column($localTables[$tableName], 'fieldName');
            $serverFields = array_column($serverTables[$tableName], 'fieldName');
            
            $localOnlyFields = array_diff($localFields, $serverFields);
            $serverOnlyFields = array_diff($serverFields, $localFields);
            
            if (!empty($localOnlyFields) || !empty($serverOnlyFields)) {
                echo "   表 $tableName:\n";
                
                if (!empty($localOnlyFields)) {
                    echo "     本地有但服务器没有的字段: " . implode(', ', $localOnlyFields) . "\n";
                }
                
                if (!empty($serverOnlyFields)) {
                    echo "     服务器有但本地没有的字段: " . implode(', ', $serverOnlyFields) . "\n";
                }
            }
        }
    }
    echo "\n";
    
    // 6. 控制器使用检查
    echo "6. 控制器使用检查:\n";
    foreach ($controllerUsage as $controller => $tables) {
        foreach ($tables as $table) {
            if (!isset($serverTables[$table])) {
                echo "   $controller 使用了服务器上不存在的表: $table\n";
            }
        }
    }
    echo "\n";
    
    // 7. 表结构详情
    echo "7. 关键表结构详情:\n";
    $keyTables = ['kbit_users', 'admins', 'point_logs', 'content_registry'];
    foreach ($keyTables as $table) {
        if (isset($serverTables[$table])) {
            echo "   表 $table 的字段:\n";
            foreach ($serverTables[$table] as $field) {
                echo "     - {$field['fieldName']} ({$field['fieldType']})";
                if (!empty($field['key'])) {
                    echo " [{$field['key']}]";
                }
                echo "\n";
            }
            echo "\n";
        }
    }
    
    echo "=== 检查完成 ===\n";
}

// 主函数
function main() {
    global $config, $controllerFiles, $sqlFile;
    
    echo "开始检查数据库结构...\n";
    echo "=====================================\n";
    
    // 连接数据库
    $mysqli = connectDatabase($config);
    
    // 获取服务器表结构
    $serverTables = getServerTables($mysqli);
    
    // 解析本地SQL
    $localTables = parseLocalSql($sqlFile);
    
    // 扫描控制器
    $controllerUsage = scanControllers($controllerFiles);
    
    // 比较结构
    compareStructures($serverTables, $localTables, $controllerUsage);
    
    // 关闭连接
    $mysqli->close();
    
    echo "=====================================\n";
    echo "检查完成\n";
}

// 运行
main();
?>