// Este arquivo NÃO pode ter 'require' ou 'mysql'
// Ele serve apenas para o fetch e interação da página de login

function ensureNotificationContainer() {
    let container = document.getElementById('gesistec-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'gesistec-toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showNotification(message, type = 'info', duration = 4500) {
    const container = ensureNotificationContainer();
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    window.requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    // Captura os valores dos campos de entrada
    const emailInput = document.getElementById('email').value;
    const passwordInput = document.getElementById('password').value; 
    
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailInput,
                senha: passwordInput
                // O perfil não é mais enviado daqui, o servidor decidirá quem você é
            })
        });

        const usuarioLogado = await response.json();

        if (response.ok) {
            // Armazena a sessão completa retornada pelo backend (nome, email e perfil)
            localStorage.setItem('sessao_ativa', JSON.stringify(usuarioLogado));

            // Armazena a mensagem para ser exibida após o redirecionamento
            localStorage.setItem('gesistec_pending_toast', JSON.stringify({
                message: `Seja bem-vindo, ${usuarioLogado.nome}!`,
                type: 'success'
            }));

            // Redirecionamento automático baseado no perfil vindo do banco de dados
            if (usuarioLogado.perfil === 'cliente') {
                window.location.href = 'tickets-cliente.html';
            } 
            else if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'colaborador') {
                window.location.href = 'dashboard-colaborador.html';
            } 
            else {
                showNotification("Perfil não identificado. Contate o suporte para assistência.", 'error');
            }
        } else {
            showNotification(usuarioLogado.error || "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.", 'error');
        }
    } catch (error) {
        showNotification("O servidor GESISTEC não está respondendo. Aguarde alguns instantes e tente novamente.", 'error');
    }
}); 