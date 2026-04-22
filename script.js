// 1. Inicialização de usuários de teste no localStorage
function inicializarUsuarios() {
    // Verifica se o "banco de dados" de usuários já existe
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
        // Salva os usuários iniciais como uma string JSON
        localStorage.setItem('usuarios_gesistec', JSON.stringify(usuariosIniciais));
    }
}

// Executa a inicialização assim que o script é carregado
inicializarUsuarios();

// 2. Lógica de Login Única
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const emailInput = document.getElementById('email').value;
    const senhaInput = document.getElementById('password').value;
    
    // 1. Busca a lista de usuários (ou inicia vazia)
    const usuarios = JSON.parse(localStorage.getItem('usuarios_gesistec')) || [];
    
    // 2. Busca o usuário comparando o e-mail e ACEITANDO 'pass' ou 'senha'
    // Isso garante que os cadastros antigos e novos funcionem juntos!
    const usuarioLogado = usuarios.find(u => 
        u.email === emailInput && (u.pass === senhaInput || u.senha === senhaInput)
    );

    if (usuarioLogado) {
        // Salva a sessão ativa com os dados encontrados
        localStorage.setItem('sessao_ativa', JSON.stringify(usuarioLogado));

        // 3. Redirecionamento Inteligente por Perfil
        if (usuarioLogado.perfil === "cliente") {
            alert(`Bem-vindo, ${usuarioLogado.nome}!`);
            window.location.href = 'tickets-cliente.html'; 
        } 
        // Aceita tanto 'admin' quanto 'colaborador' para o dashboard administrativo
        else if (usuarioLogado.perfil === "colaborador" || usuarioLogado.perfil === "admin") {
            alert(`Acesso Administrativo: ${usuarioLogado.nome}`);
            window.location.href = 'dashboard-colaborador.html';
        }
    } else {
        // 4. Acesso de Emergência (Hardcoded) para você não ficar trancado fora
        if (emailInput === "admin@admin.com" && senhaInput === "123") {
            const master = { nome: "Admin Mestre", perfil: "admin" };
            localStorage.setItem('sessao_ativa', JSON.stringify(master));
            window.location.href = 'dashboard-colaborador.html';
            return;
        }
        alert('E-mail ou senha incorretos!');
    }
});


function alternarRole(perfil) {
    // Atualiza o valor no input oculto
    document.getElementById('role').value = perfil;

    // Atualiza as classes dos botões
    document.getElementById('btn-cliente').classList.toggle('active', perfil === 'cliente');
    document.getElementById('btn-colaborador').classList.toggle('active', perfil === 'colaborador');

    // Muda o texto do botão de entrar
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.innerText = perfil === 'cliente' ? 'Entrar como Cliente' : 'Entrar como Equipe';
}