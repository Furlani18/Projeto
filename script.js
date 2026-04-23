const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Aumentado para suportar anexos em Base64

// Configuração da Conexão com o MySQL
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'gesistec_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ==========================================
// 1. ROTAS DE USUÁRIO & LOGIN
// ==========================================

// Login
app.post('/api/login', (req, res) => {
    const { email, senha, perfil } = req.body;
    const sql = "SELECT id, nome, email, perfil FROM usuarios WHERE email = ? AND senha = ? AND perfil = ?";
    db.query(sql, [email, senha, perfil], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length > 0) res.json(results[0]);
        else res.status(401).json({ message: "Credenciais inválidas!" });
    });
});

// Listar todos os usuários (Painel Admin)
app.get('/api/usuarios', (req, res) => {
    db.query("SELECT id, nome, email, perfil, data_criacao FROM usuarios", (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// Criar novo usuário (Painel Admin)
app.post('/api/usuarios', (req, res) => {
    const { nome, email, senha, perfil } = req.body;
    const sql = "INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)";
    db.query(sql, [nome, email, senha, perfil], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Usuário criado!", id: result.insertId });
    });
});

// Deletar usuário
app.delete('/api/usuarios/:id', (req, res) => {
    db.query("DELETE FROM usuarios WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Usuário removido!" });
    });
});

// ==========================================
// 2. ROTAS DE TICKETS (CHAMADOS)
// ==========================================

// Criar Ticket
app.post('/api/tickets', (req, res) => {
    const { assunto, tipo, prioridade, descricao, clienteNome, emailCliente } = req.body;
    const sql = "INSERT INTO tickets (assunto, tipo, prioridade, descricao, cliente_nome, email_cliente) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(sql, [assunto, tipo, prioridade, descricao, clienteNome, emailCliente], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Ticket criado!", id: result.insertId });
    });
});

// Listar Tickets (Filtra por e-mail se for cliente)
app.get('/api/tickets', (req, res) => {
    const email = req.query.email;
    let sql = "SELECT * FROM tickets ORDER BY id DESC";
    let params = [];

    if (email) {
        sql = "SELECT * FROM tickets WHERE email_cliente = ? ORDER BY id DESC";
        params = [email];
    }

    db.query(sql, params, (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// Atualizar Status/Prioridade (Ação do Admin/Colaborador)
app.patch('/api/tickets/:id', (req, res) => {
    const { status, prioridade } = req.body;
    const sql = "UPDATE tickets SET status = ?, prioridade = ? WHERE id = ?";
    db.query(sql, [status, prioridade, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Ticket atualizado!" });
    });
});

// ==========================================
// 3. ROTAS DE MENSAGENS (INTERAÇÕES)
// ==========================================

// Adicionar Mensagem ao Histórico
app.post('/api/mensagens', (req, res) => {
    const { ticket_id, autor, perfil, texto, anexo_nome, anexo_conteudo } = req.body;
    const sql = "INSERT INTO mensagens (ticket_id, autor, perfil, texto, anexo_nome, anexo_conteudo) VALUES (?, ?, ?, ?, ?, ?)";
    
    db.query(sql, [ticket_id, autor, perfil, texto, anexo_nome, anexo_conteudo], (err, result) => {
        if (err) return res.status(500).json(err);
        
        // Quando uma resposta é enviada, atualizamos o status do ticket automaticamente
        const novoStatus = perfil === 'suporte' ? 'Em Atendimento' : 'Pendente';
        db.query("UPDATE tickets SET status = ? WHERE id = ?", [novoStatus, ticket_id]);
        
        res.json({ message: "Mensagem enviada!", id: result.insertId });
    });
});

// Buscar histórico de mensagens de um ticket
app.get('/api/mensagens/:ticketId', (req, res) => {
    const sql = "SELECT * FROM mensagens WHERE ticket_id = ? ORDER BY data_envio ASC";
    db.query(sql, [req.params.ticketId], (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// Iniciar o servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor GESISTEC rodando em http://localhost:${PORT}`);
});