 const API_BASE_URL = 'http://localhost:8080/senai_conecta_2026_saep/backend';
;
const UPLOADS_URL = `${API_BASE_URL}/uploads/`;

// Monta o endereço de uma imagem salva em backend/uploads/
function urlImagem(nome, padrao = 'default_avatar.png') {
    return UPLOADS_URL + encodeURIComponent(nome || padrao);
}

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...(options.headers || {}) };

    // JWT: enviado quando existir (a sessão PHP também vai por cookie)
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Corpo em JSON (FormData não leva Content-Type, o navegador define)
    let body = options.body;
    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        if (typeof body !== 'string') {
            body = JSON.stringify(body);
        }
    }

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            body,
            headers,
            credentials: 'same-origin' // envia o cookie da sessão PHP
        });
    } catch (e) {
        throw new Error('Não foi possível conectar ao servidor. Verifique se o XAMPP está ligado.');
    }

    let data;
    try {
        data = await response.json();
    } catch (e) {
        throw new Error('Resposta inválida do servidor.');
    }

    if (!response.ok) {
        // token vencido ou inválido: limpa os dados locais e avisa a aplicação
        if (response.status === 401 && token && endpoint !== '/login') {
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            window.dispatchEvent(new Event('sessao-expirada'));
        }
        throw new Error(data.erro || 'Erro no processamento da requisição.');
    }
    return data;
}