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
    event.preventDefault(); // Impede o recarregamento da página

    const emailInput = document.getElementById('email').value;
    const senhaInput = document.getElementById('password').value;
    
    // Recupera a lista de usuários do localStorage
    const usuarios = JSON.parse(localStorage.getItem('usuarios_gesistec'));
    
    // Busca o usuário que coincida com e-mail E senha
    const usuarioLogado = usuarios.find(u => u.email === emailInput && u.senha === senhaInput);

    if (usuarioLogado) {
        // Salva a sessão ativa para que a próxima página saiba quem entrou
        localStorage.setItem('sessao_ativa', JSON.stringify(usuarioLogado));

        // Redirecionamento baseado no perfil conforme Storyboard 1:
        if (usuarioLogado.perfil === "cliente") {
            // Clientes são direcionados para a página de Tickets [cite: 317]
            alert(`Bem-vindo, ${usuarioLogado.nome}! Direcionando para seus Tickets.`);
            window.location.href = 'tickets-cliente.html'; 
        } else if (usuarioLogado.perfil === "colaborador") {
            // Colaboradores acessam manutenção ou atendimento de tickets [cite: 318]
            alert(`Acesso Administrativo: ${usuarioLogado.nome}`);
            window.location.href = 'dashboard-colaborador.html';
        }
    } else {
        // Feedback de erro para o usuário
        alert('E-mail ou senha incorretos! Tente as credenciais de teste.');
    }
});