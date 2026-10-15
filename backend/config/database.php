<?php
class Database {
    private string $host = "localhost";
    private string $db_name = "senai_conecta";
    private string $username = "root";
    private string $password = "";
    public ?PDO $conn = null;

    public function getConnection(): PDO {
        if ($this->conn === null) {
            try {
                $this->conn = new PDO(
                    "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
                    $this->username,
                    $this->password,
                    [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                    ]
                );
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(["erro" => "Falha na conexão com o banco de dados."]);
                exit;
            }
        }
        return $this->conn;
    }
}