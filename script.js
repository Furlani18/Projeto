// Este arquivo NÃO pode ter 'require' ou 'mysql'
// Ele serve apenas para o fetch e interação da página de login

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
            
            alert(`Bem-vindo, ${usuarioLogado.nome}!`);

            // Redirecionamento automático baseado no perfil vindo do banco de dados
            if (usuarioLogado.perfil === 'cliente') {
                window.location.href = 'tickets-cliente.html';
            } 
            else if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'colaborador') {
                window.location.href = 'dashboard-colaborador.html';
            } 
            else {
                alert("Erro: Perfil não identificado. Contate o suporte.");
            }
        } else {
            alert(usuarioLogado.error || "E-mail ou senha incorretos.");
        }
    } catch (error) {
        alert("O servidor GESISTEC não está respondendo!");
    }
}); 