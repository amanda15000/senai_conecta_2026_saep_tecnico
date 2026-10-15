// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadFeed();
    iniciarPesquisa();
});

// ===== UTILITÁRIOS =====
function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, match => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[match]));
}

function usuarioLogado() {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
}

function imgAvatar(foto, classe = '') {
    return `<img class="avatar ${classe}" src="${urlImagem(foto)}" onerror="this.onerror=null;this.src=urlImagem();">`;
}

// mensagem de sucesso ou erro (some sozinha)
function showToast(msg, tipo = 'success') {
    let box = document.getElementById('toastContainer');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toastContainer';
        box.className = 'toast-container';
        document.body.appendChild(box);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = msg;
    box.appendChild(toast);
    setTimeout(() => toast.remove(), 3700);
}

// ===== FEED =====
async function loadFeed() {
    const feed = document.getElementById('feed');
    try {
        const posts = await apiFetch('/publicacoes');
        feed.innerHTML = posts.length
            ? posts.map(renderPost).join('')
            : `<div class="empty-state">Nenhuma publicação ainda.</div>`;
    } catch (err) {
        feed.innerHTML = `<div class="empty-state">Erro ao carregar o feed.</div>`;
    }
}

function renderPost(post) {
    const user = usuarioLogado();
    const isOwner = user && Number(user.id_usuario) === Number(post.id_usuario);
    const isLiked = post.curtido_pelo_usuario == 1;

    return `
        <div class="post-card">
            <div class="post-header">
                <div class="post-user" onclick="openProfile(${post.id_usuario})">
                    ${imgAvatar(post.foto_usuario)}
                    <div>
                        <div class="post-author">${escapeHtml(post.nome)}</div>
                        <div class="post-username">@${escapeHtml(post.username)}</div>
                    </div>
                </div>
                ${isOwner ? `<button class="btn ghost" onclick="deletePost(${post.id_publicacao})">🗑 Excluir</button>` : ''}
            </div>
            ${post.texto ? `<p class="post-text">${escapeHtml(post.texto)}</p>` : ''}
            ${post.imagem ? `<img src="${urlImagem(post.imagem)}" class="post-image">` : ''}
            <div class="post-actions">
                <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${post.id_publicacao}, this)">
                    ${isLiked ? '♥' : '♡'} ${post.total_curtidas}
                </button>
                <span class="post-date">${new Date(post.datahora_publicacao).toLocaleString('pt-BR')}</span>
            </div>
        </div>
    `;
}

// ===== CURTIR =====
async function toggleLike(id, botao) {
    if (!usuarioLogado()) {
        openAuthModal(); // pede login sem sair da página
        return;
    }
    try {
        const r = await apiFetch('/curtir', {
            method: 'POST',
            body: JSON.stringify({ id_publicacao: id })
        });
        const curtiu = r.status === 'adicionado';
        botao.classList.toggle('liked', curtiu);
        botao.innerHTML = `${curtiu ? '♥' : '♡'} ${r.total_curtidas}`;
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===== EXCLUIR (com modal de confirmação) =====
function confirmarExclusao() {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-btn">&times;</span>
                <h2>Excluir publicação</h2>
                <p>Deseja realmente excluir esta publicação?</p>
                <div class="modal-actions">
                    <button class="btn secondary">Cancelar</button>
                    <button class="btn danger">Excluir</button>
                </div>
            </div>`;
        modal.onclick = (e) => {
            const alvo = e.target;
            if (alvo.classList.contains('danger')) {
                modal.remove();
                resolve(true);
            } else if (alvo === modal || alvo.classList.contains('close-btn') || alvo.classList.contains('secondary')) {
                modal.remove();
                resolve(false);
            }
        };
        document.body.appendChild(modal);
    });
}

async function deletePost(id) {
    if (!(await confirmarExclusao())) return;
    try {
        await apiFetch(`/publicacoes/${id}`, { method: 'DELETE' });
        showToast('Publicação excluída com sucesso.');
        loadFeed();
        if (document.getElementById('profileModal')) openProfile(usuarioLogado().id_usuario);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===== NOVA PUBLICAÇÃO =====
document.getElementById('postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('texto', document.getElementById('postText').value);

    const img = document.getElementById('postImage').files[0];
    if (img) formData.append('imagem', img);

    try {
        await apiFetch('/publicacoes', { method: 'POST', body: formData });
        document.getElementById('postForm').reset();
        showToast('Publicação criada com sucesso!');
        loadFeed();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ===== PERFIL =====
async function openProfile(id) {
    try {
        const d = await apiFetch(`/perfil/${id}`);
        const u = d.usuario;
        const eu = usuarioLogado();
        const isMe = eu && Number(eu.id_usuario) === Number(u.id_usuario);

        let modal = document.getElementById('profileModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'profileModal';
            modal.className = 'modal';
            modal.onclick = (e) => {
                if (e.target === modal || e.target.classList.contains('close-btn')) modal.remove();
            };
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width:640px;max-height:90vh;overflow-y:auto;background:var(--background);">
                <span class="close-btn">&times;</span>
                <div class="card profile-header">
                    ${imgAvatar(u.foto, 'large')}
                    ${isMe ? `<label class="btn secondary">Alterar foto
                        <input type="file" accept="image/*" hidden onchange="trocarFoto(this)"></label>` : ''}
                    <div class="profile-name">${escapeHtml(u.nome)}</div>
                    <div class="profile-username">@${escapeHtml(u.username)}</div>
                    <div class="profile-stats">
                        <div class="stat"><strong>${d.total_publicacoes}</strong><span>Publicações</span></div>
                        <div class="stat"><strong>${d.total_curtidas_recebidas}</strong><span>Curtidas recebidas</span></div>
                    </div>
                </div>
                <h3 class="section-title">Publicações</h3>
                ${d.publicacoes.length
                    ? d.publicacoes.map(renderPost).join('')
                    : `<div class="empty-state">Este usuário ainda não publicou nada.</div>`}
            </div>`;
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function trocarFoto(input) {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append('foto', input.files[0]);

    try {
        const r = await apiFetch('/foto', { method: 'POST', body: formData });
        const eu = usuarioLogado();
        eu.foto = r.foto;
        localStorage.setItem('usuario', JSON.stringify(eu));
        showToast('Foto de perfil atualizada!');
        openProfile(eu.id_usuario);
        loadFeed();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===== PESQUISA DE USUÁRIOS =====
function iniciarPesquisa() {
    const input = document.getElementById('searchInput');
    const caixa = document.createElement('div');
    caixa.className = 'search-results hidden';
    input.parentElement.appendChild(caixa);

    input.addEventListener('input', async () => {
        const termo = input.value.trim();
        if (!termo) {
            caixa.classList.add('hidden');
            return;
        }
        try {
            const usuarios = await apiFetch(`/usuarios?busca=${encodeURIComponent(termo)}`);
            caixa.classList.remove('hidden');
            caixa.innerHTML = usuarios.length
                ? usuarios.map(u => `
                    <div class="search-item" onclick="abrirDaPesquisa(${u.id_usuario})">
                        ${imgAvatar(u.foto, 'small')}
                        <div>
                            <div class="post-author">${escapeHtml(u.nome)}</div>
                            <div class="username">@${escapeHtml(u.username)}</div>
                        </div>
                    </div>`).join('')
                : `<div class="search-empty">Nenhum usuário encontrado.</div>`;
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // clicar fora fecha a lista
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) caixa.classList.add('hidden');
    });
}

function abrirDaPesquisa(id) {
    document.querySelector('.search-results').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    openProfile(id);
}