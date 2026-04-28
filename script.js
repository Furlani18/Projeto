// Este arquivo NÃO pode ter 'require' ou 'mysql'
// Ele serve apenas para os botões e para o fetch


function selecionarPerfil(perfil) {
    const inputOculto = document.getElementById('perfilSelecionado');
    if(inputOculto) inputOculto.value = perfil;

    const btnCli = document.getElementById('btn-cliente');
    const btnEqui = document.getElementById('btn-equipe');

    if(btnCli && btnEqui) {
        btnCli.classList.toggle('active', perfil === 'cliente');
        btnEqui.classList.toggle('active', perfil === 'colaborador');
    }

    const btnSubmit = document.querySelector('.btn-login-submit');
    if(btnSubmit) {
        btnSubmit.innerHTML = perfil === 'cliente' ? 
            'Entrar como Cliente <i class="fas fa-arrow-right"></i>' : 
            'Entrar como Equipe <i class="fas fa-arrow-right"></i>';
    }
}

// Lógica do Formulário
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const emailInput = document.getElementById('email').value;
    const senhaInput = document.getElementById('password').value;
    const perfilSelecionado = document.getElementById('perfilSelecionado').value;
    
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailInput,
                senha: senhaInput,
                perfil: perfilSelecionado
            })
        });

       if (response.ok) {
    const usuarioLogado = await response.json();
    localStorage.setItem('sessao_ativa', JSON.stringify(usuarioLogado));
    
    alert(`Bem-vindo, ${usuarioLogado.nome}!`);

    // Redirecionamento baseado no perfil que o Servidor enviou
    if (usuarioLogado.perfil === 'cliente') {
        window.location.href = 'tickets-cliente.html';
    } 
    else if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'colaborador') {
        window.location.href = 'dashboard-colaborador.html';
    } 
    else {
        alert("Perfil não identificado. Contate o administrador.");
    }
}
    } catch (error) {
        alert("Servidor Node.js (server.js) não está respondendo!");
    }
});