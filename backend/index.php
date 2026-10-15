<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// qualquer erro inesperado vira uma resposta JSON
set_exception_handler(function ($e) {
    http_response_code(500);
    echo json_encode(["erro" => "Erro interno do servidor."]);
});

session_start(); // controle de usuário por SESSÃO

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/jwt_helper.php';

$db = (new Database())->getConnection();
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$basePath = dirname($_SERVER['SCRIPT_NAME']); // descobre a pasta do backend sozinho

if (str_starts_with($uri, $basePath)) {
    $uri = substr($uri, strlen($basePath));
}
if ($uri === '') {
    $uri = '/';
}

/* ===================== FUNÇÕES AUXILIARES ===================== */

function responder($dados, int $codigo = 200): void {
    http_response_code($codigo);
    echo json_encode($dados);
    exit;
}

// usuário logado: primeiro pela sessão, depois pelo token JWT
function getAuthenticatedUser(): ?array {
    if (!empty($_SESSION['id_usuario'])) {
        return ['id_usuario' => (int)$_SESSION['id_usuario']];
    }
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s(\S+)/', $auth, $m)) {
        return JWTHelper::decode($m[1]);
    }
    return null;
}

function exigirLogin(): array {
    $user = getAuthenticatedUser();
    if (!$user) {
        responder(["erro" => "Acesso não autorizado."], 401);
    }
    return $user;
}

// salva a imagem em uploads/ e devolve o nome do arquivo
function salvarImagem(string $campo): ?string {
    if (!isset($_FILES[$campo]) || $_FILES[$campo]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $ext = strtolower(pathinfo($_FILES[$campo]['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
        responder(["erro" => "Formato de imagem inválido."], 400);
    }
    $nome = uniqid() . "." . $ext;
    move_uploaded_file($_FILES[$campo]['tmp_name'], __DIR__ . "/uploads/" . $nome);
    return $nome;
}

// publicações (todas ou de um usuário), mais recentes primeiro
function buscarPublicacoes(PDO $db, int $idAtual, ?int $idAutor = null): array {
    $where = $idAutor ? "WHERE p.id_usuario = " . $idAutor : "";
    $stmt = $db->prepare("
        SELECT p.*, u.nome, u.username, u.foto AS foto_usuario,
               COUNT(c.id_publicacao) AS total_curtidas,
               MAX(CASE WHEN c.id_usuario = ? THEN 1 ELSE 0 END) AS curtido_pelo_usuario
        FROM publicacao p
        JOIN usuario u ON p.id_usuario = u.id_usuario
        LEFT JOIN curtida c ON p.id_publicacao = c.id_publicacao
        $where
        GROUP BY p.id_publicacao
        ORDER BY p.datahora_publicacao DESC
    ");
    $stmt->execute([$idAtual]);
    return $stmt->fetchAll();
}

/* ============================ ROTAS ============================ */

// POST /login
if ($uri === '/login' && $method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $email = trim($data['email'] ?? '');
    $senha = (string)($data['senha'] ?? '');

    $stmt = $db->prepare("SELECT * FROM usuario WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // aceita senha com hash (cadastros novos) ou texto puro (usuários do CSV)
    if (!$user || !(password_verify($senha, $user['senha']) || $senha === $user['senha'])) {
        responder(["erro" => "E-mail ou senha inválidos."], 401);
    }

    $_SESSION['id_usuario'] = (int)$user['id_usuario']; // cria a sessão

    $token = JWTHelper::encode([
        'id_usuario' => (int)$user['id_usuario'],
        'exp' => time() + (8 * 3600)
    ]);

    responder([
        "token" => $token,
        "usuario" => [
            "id_usuario" => (int)$user['id_usuario'],
            "nome" => $user['nome'],
            "username" => $user['username'],
            "foto" => $user['foto'],
            "tipo_perfil" => $user['tipo_perfil']
        ]
    ]);
}

// POST /logout
if ($uri === '/logout' && $method === 'POST') {
    session_destroy();
    responder(["mensagem" => "Sessão encerrada."]);
}

// POST /cadastro
if ($uri === '/cadastro' && $method === 'POST') {
    $nome = trim($_POST['nome'] ?? '');
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $senha = $_POST['senha'] ?? '';

    if ($nome === '' || $username === '' || $email === '' || $senha === '') {
        responder(["erro" => "Preencha todos os campos obrigatórios."], 400);
    }

    $stmt = $db->prepare("SELECT id_usuario FROM usuario WHERE username = ? OR email = ?");
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) {
        responder(["erro" => "Nome de usuário ou e-mail já cadastrados."], 409);
    }

    $foto = salvarImagem('foto') ?? "avatar.png";

    // quem se cadastra pelo sistema entra como 'usuario' (só curte)
    $stmt = $db->prepare("INSERT INTO usuario (nome, username, email, senha, foto, tipo_perfil) VALUES (?, ?, ?, ?, ?, 'usuario')");
    $stmt->execute([$nome, $username, $email, password_hash($senha, PASSWORD_DEFAULT), $foto]);

    responder(["mensagem" => "Usuário cadastrado com sucesso!"], 201);
}

// POST /foto (trocar foto de perfil)
if ($uri === '/foto' && $method === 'POST') {
    $user = exigirLogin();
    $foto = salvarImagem('foto');

    if ($foto === null) {
        responder(["erro" => "Escolha uma imagem."], 400);
    }

    $db->prepare("UPDATE usuario SET foto = ? WHERE id_usuario = ?")->execute([$foto, $user['id_usuario']]);
    responder(["mensagem" => "Foto de perfil atualizada!", "foto" => $foto]);
}

// GET /publicacoes (feed)
if ($uri === '/publicacoes' && $method === 'GET') {
    $user = getAuthenticatedUser();
    responder(buscarPublicacoes($db, $user ? $user['id_usuario'] : 0));
}

// POST /publicacoes (só criador pode publicar)
if ($uri === '/publicacoes' && $method === 'POST') {
    $user = exigirLogin();

    $stmt = $db->prepare("SELECT tipo_perfil FROM usuario WHERE id_usuario = ?");
    $stmt->execute([$user['id_usuario']]);
    if ($stmt->fetchColumn() !== 'criador') {
        responder(["erro" => "Apenas criadores podem publicar."], 403);
    }

    $texto = trim($_POST['texto'] ?? '');
    $imagem = salvarImagem('imagem');

    if ($texto === '' && $imagem === null) {
        responder(["erro" => "Escreva um texto ou escolha uma imagem."], 400);
    }

    $stmt = $db->prepare("INSERT INTO publicacao (id_usuario, texto, imagem) VALUES (?, ?, ?)");
    $stmt->execute([$user['id_usuario'], $texto, $imagem]);

    responder(["mensagem" => "Publicação criada com sucesso!"], 201);
}

// POST /curtir (curte; se já curtiu, retira a curtida)
if ($uri === '/curtir' && $method === 'POST') {
    $user = exigirLogin();
    $data = json_decode(file_get_contents("php://input"), true);
    $idPub = (int)($data['id_publicacao'] ?? 0);

    $stmt = $db->prepare("SELECT 1 FROM curtida WHERE id_publicacao = ? AND id_usuario = ?");
    $stmt->execute([$idPub, $user['id_usuario']]);

    if ($stmt->fetch()) {
        $db->prepare("DELETE FROM curtida WHERE id_publicacao = ? AND id_usuario = ?")->execute([$idPub, $user['id_usuario']]);
        $status = "removido";
    } else {
        $db->prepare("INSERT INTO curtida (id_publicacao, id_usuario) VALUES (?, ?)")->execute([$idPub, $user['id_usuario']]);
        $status = "adicionado";
    }

    $stmt = $db->prepare("SELECT COUNT(*) FROM curtida WHERE id_publicacao = ?");
    $stmt->execute([$idPub]);
    responder(["status" => $status, "total_curtidas" => (int)$stmt->fetchColumn()]);
}

// GET /perfil/{id}
if (preg_match('/^\/perfil\/(\d+)$/', $uri, $m) && $method === 'GET') {
    $id = (int)$m[1];
    $user = getAuthenticatedUser();

    $stmt = $db->prepare("
        SELECT u.id_usuario, u.nome, u.username, u.foto, u.tipo_perfil,
            (SELECT COUNT(*) FROM publicacao WHERE id_usuario = u.id_usuario) AS total_publicacoes,
            (SELECT COUNT(*) FROM curtida c JOIN publicacao p ON c.id_publicacao = p.id_publicacao
              WHERE p.id_usuario = u.id_usuario) AS total_curtidas_recebidas
        FROM usuario u WHERE u.id_usuario = ?
    ");
    $stmt->execute([$id]);
    $perfil = $stmt->fetch();

    if (!$perfil) {
        responder(["erro" => "Usuário não encontrado."], 404);
    }

    responder([
        "usuario" => $perfil,
        "total_publicacoes" => $perfil['total_publicacoes'],
        "total_curtidas_recebidas" => $perfil['total_curtidas_recebidas'],
        "publicacoes" => buscarPublicacoes($db, $user ? $user['id_usuario'] : 0, $id)
    ]);
}

// GET /usuarios?busca=texto (pesquisa por username)
if ($uri === '/usuarios' && $method === 'GET') {
    $busca = ltrim(trim($_GET['busca'] ?? ''), '@');
    $stmt = $db->prepare("SELECT id_usuario, nome, username, foto FROM usuario WHERE username LIKE ? ORDER BY username LIMIT 20");
    $stmt->execute(['%' . $busca . '%']);
    responder($busca === '' ? [] : $stmt->fetchAll());
}

// DELETE /publicacoes/{id} (só o dono pode excluir)
if (preg_match('/^\/publicacoes\/(\d+)$/', $uri, $m) && $method === 'DELETE') {
    $user = exigirLogin();
    $idPub = (int)$m[1];

    $stmt = $db->prepare("SELECT 1 FROM publicacao WHERE id_publicacao = ? AND id_usuario = ?");
    $stmt->execute([$idPub, $user['id_usuario']]);
    if (!$stmt->fetch()) {
        responder(["erro" => "Ação não permitida ou publicação inexistente."], 403);
    }

    // apaga as curtidas primeiro por causa da chave estrangeira
    $db->prepare("DELETE FROM curtida WHERE id_publicacao = ?")->execute([$idPub]);
    $db->prepare("DELETE FROM publicacao WHERE id_publicacao = ?")->execute([$idPub]);

    responder(["mensagem" => "Publicação excluída com sucesso."]);
}

responder(["erro" => "Rota não encontrada."], 404);