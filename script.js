// 1. Inicialização de usuários de teste no localStorage
function inicializarUsuarios() {
    if (!localStorage.getItem('usuarios_gesistec')) {
        const usuariosIniciais = [
            { 
                email: "colaborador@gesistec.com", 
                senha: "123", 
                perfil: "colaborador", 
                nome: "Admin Gesistec" 
            },
            { 
                email: "usina@cliente.com", 
                senha: "123", 
                perfil: "cliente", 
                nome: "Usina Cerradinho" 
            }
        ];
        localStorage.setItem('usuarios_gesistec', JSON.stringify(usuariosIniciais));
    }
}

inicializarUsuarios();

// 2. Lógica de Login
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const emailInput = document.getElementById('email').value;
    const senhaInput = document.getElementById('password').value;
    const perfilSelecionado = document.getElementById('perfilSelecionado').value; // ID corrigido
    
    const usuarios = JSON.parse(localStorage.getItem('usuarios_gesistec')) || [];
    
    // Busca o usuário comparando email, senha e TAMBÉM o perfil selecionado
    const usuarioLogado = usuarios.find(u => 
        u.email === emailInput && 
        (u.pass === senhaInput || u.senha === senhaInput) &&
        u.perfil === perfilSelecionado
    );

    if (usuarioLogado) {
        localStorage.setItem('sessao_ativa', JSON.stringify(usuarioLogado));
        alert(`Bem-vindo, ${usuarioLogado.nome}!`);

        // Redirecionamento por Perfil
        if (usuarioLogado.perfil === "cliente") {
            window.location.href = 'tickets-cliente.html'; 
        } else {
            window.location.href = 'dashboard-colaborador.html';
        }
    } else {
        // Acesso de Emergência
        if (emailInput === "admin@admin.com" && senhaInput === "123") {
            const master = { nome: "Admin Mestre", perfil: "colaborador", email: "admin@admin.com" };
            localStorage.setItem('sessao_ativa', JSON.stringify(master));
            window.location.href = 'dashboard-colaborador.html';
            return;
        }
        alert('E-mail, senha ou perfil incorretos!');
    }
});

// 3. Função de Alternar Perfil (Sincronizada com IDs do seu HTML)
function selecionarPerfil(perfil) { // Mudei o nome para bater com o 'onclick' do seu HTML
    // 1. Atualiza o valor no input oculto (ID era perfilSelecionado no HTML)
    const inputOculto = document.getElementById('perfilSelecionado');
    if(inputOculto) inputOculto.value = perfil;

    // 2. Atualiza as classes dos botões (IDs corrigidos para btn-cliente e btn-equipe)
    const btnCli = document.getElementById('btn-cliente');
    const btnEqui = document.getElementById('btn-equipe');

    if(btnCli && btnEqui) {
        btnCli.classList.toggle('active', perfil === 'cliente');
        btnEqui.classList.toggle('active', perfil === 'colaborador');
    }

    // 3. Muda o texto do botão (Buscando pela classe, já que não tem ID no seu HTML)
    const btnSubmit = document.querySelector('.btn-login-submit');
    if(btnSubmit) {
        btnSubmit.innerHTML = perfil === 'cliente' ? 
            'Entrar como Cliente <i class="fas fa-arrow-right"></i>' : 
            'Entrar como Equipe <i class="fas fa-arrow-right"></i>';
    }
}