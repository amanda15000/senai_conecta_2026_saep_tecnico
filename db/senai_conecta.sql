CREATE DATABASE IF NOT EXISTS senai_conecta CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE senai_conecta;

CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    foto VARCHAR(255) DEFAULT 'avatar.png',
    tipo_perfil ENUM('usuario', 'criador') DEFAULT 'usuario',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
	atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE publicacao (
    id_publicacao INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    texto TEXT NOT NULL, 
    imagem VARCHAR(255) NULL,
    datahora_publicacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE cascade
) ENGINE=InnoDB;

CREATE TABLE curtida (
    id_curtida INT AUTO_INCREMENT PRIMARY KEY,
    id_publicacao INT NOT NULL,
    id_usuario INT NOT NULL,
    datahora_curtida DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_curtida (id_publicacao, id_usuario),
    FOREIGN KEY (id_publicacao) REFERENCES publicacao(id_publicacao) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;
