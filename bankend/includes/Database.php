<?php
/**
 * 首席图像架构师 - 数据库类
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Core;

use PDO;
use PDOException;
use RuntimeException;

class Database
{
    private static ?Database $instance = null;
    private ?PDO $connection = null;
    private array $config;
    private int $queryCount = 0;
    private float $queryTime = 0;

    private function __construct(array $config)
    {
        $this->config = $config;
    }

    public static function getInstance(array $config = null): self
    {
        if (self::$instance === null) {
            if ($config === null) {
                $config = require __DIR__ . '/../config/database.php';
                $config = $config['default'];
            }
            self::$instance = new self($config);
        }
        return self::$instance;
    }

    public function connect(): PDO
    {
        if ($this->connection !== null) {
            return $this->connection;
        }

        try {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $this->config['host'],
                $this->config['port'],
                $this->config['database'],
                $this->config['charset']
            );

            $this->connection = new PDO(
                $dsn,
                $this->config['username'],
                $this->config['password'],
                $this->config['options']
            );

            return $this->connection;
        } catch (PDOException $e) {
            throw new RuntimeException('Database connection failed: ' . $e->getMessage());
        }
    }

    public function query(string $sql, array $params = []): array
    {
        $start = microtime(true);
        $stmt = $this->connect()->prepare($sql);
        $stmt->execute($params);
        
        $this->queryCount++;
        $this->queryTime += microtime(true) - $start;
        
        return $stmt->fetchAll();
    }

    public function queryOne(string $sql, array $params = []): ?array
    {
        $result = $this->query($sql, $params);
        return $result[0] ?? null;
    }

    public function execute(string $sql, array $params = []): bool
    {
        $start = microtime(true);
        $stmt = $this->connect()->prepare($sql);
        $result = $stmt->execute($params);
        
        $this->queryCount++;
        $this->queryTime += microtime(true) - $start;
        
        return $result;
    }

    public function insert(string $table, array $data): int
    {
        $columns = implode(', ', array_keys($data));
        $placeholders = implode(', ', array_fill(0, count($data), '?'));
        
        $sql = sprintf(
            'INSERT INTO %s%s (%s) VALUES (%s)',
            $this->config['prefix'] ?? '',
            $table,
            $columns,
            $placeholders
        );
        
        $this->execute($sql, array_values($data));
        return (int) $this->connect()->lastInsertId();
    }

    public function update(string $table, array $data, array $where): int
    {
        $setParts = [];
        foreach (array_keys($data) as $column) {
            $setParts[] = "$column = ?";
        }
        
        $whereParts = [];
        foreach (array_keys($where) as $column) {
            $whereParts[] = "$column = ?";
        }
        
        $sql = sprintf(
            'UPDATE %s%s SET %s WHERE %s',
            $this->config['prefix'] ?? '',
            $table,
            implode(', ', $setParts),
            implode(' AND ', $whereParts)
        );
        
        $stmt = $this->connect()->prepare($sql);
        $stmt->execute(array_merge(array_values($data), array_values($where)));
        return $stmt->rowCount();
    }

    public function delete(string $table, array $where): int
    {
        $whereParts = [];
        foreach (array_keys($where) as $column) {
            $whereParts[] = "$column = ?";
        }
        
        $sql = sprintf(
            'DELETE FROM %s%s WHERE %s',
            $this->config['prefix'] ?? '',
            $table,
            implode(' AND ', $whereParts)
        );
        
        $stmt = $this->connect()->prepare($sql);
        $stmt->execute(array_values($where));
        return $stmt->rowCount();
    }

    public function beginTransaction(): bool
    {
        return $this->connect()->beginTransaction();
    }

    public function commit(): bool
    {
        return $this->connect()->commit();
    }

    public function rollBack(): bool
    {
        return $this->connect()->rollBack();
    }

    public function lastInsertId(): int
    {
        return (int) $this->connect()->lastInsertId();
    }

    public function getQueryCount(): int
    {
        return $this->queryCount;
    }

    public function getQueryTime(): float
    {
        return $this->queryTime;
    }

    public function getConnection(): ?PDO
    {
        return $this->connection;
    }
}
