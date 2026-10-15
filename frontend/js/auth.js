function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('usuario') || 'null');
    const userMenu = document.getElementById('userMenu');
    const createPostSection = document.getElementById('createPostSection');

    if (token && user) {
        userMenu.innerHTML = `
            <span>@${escapeHtml(user.username)}</span>
            <button class="btn secondary" onclick="openProfile(${user.id_usuario})">Meu perfil</button>
            <button class="btn" onclick="logout()">Sair</button>
        `;
        createPostSection.classList.remove('hidden');
    } else {
        userMenu.innerHTML = `<button class="btn primary" onclick="openAuthModal()">Entrar</button>`;
        createPostSection.classList.add('hidden');
    }
}

function openAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
}

function switchTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
    document.getElementById('registerForm').classList.toggle('hidden', isLogin);
    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabRegister').classList.toggle('active', !isLogin);
}

async function logout() {
    try {
        await apiFetch('/logout', { method: 'POST' }); // encerra a sessão no servidor
    } catch (err) {}
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    checkAuth();
    loadFeed();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.add('hidden');

    try {
        const res = await apiFetch('/login', {
            method: 'POST',
            body: JSON.stringify({
                email: document.getElementById('loginEmail').value,
                senha: document.getElementById('loginSenha').value
            })
        });

        localStorage.setItem('token', res.token);
        localStorage.setItem('usuario', JSON.stringify(res.usuario));
        closeAuthModal();
        checkAuth();
        loadFeed();
        showToast('Login realizado com sucesso!');
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('regError');
    errorDiv.classList.add('hidden');

    const formData = new FormData();
    formData.append('nome', document.getElementById('regNome').value);
    formData.append('username', document.getElementById('regUsername').value);
    formData.append('email', document.getElementById('regEmail').value);
    formData.append('senha', document.getElementById('regSenha').value);

    const foto = document.getElementById('regFoto').files[0];
    if (foto) formData.append('foto', foto);

    try {
        await apiFetch('/cadastro', { method: 'POST', body: formData });
        showToast('Cadastro realizado com sucesso! Faça login.');
        switchTab('login');
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
});