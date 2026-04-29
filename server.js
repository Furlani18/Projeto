const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'gesistec_db'
});

// ==========================================
// 1. LOGIN
// ==========================================
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    
    const sql = `SELECT 
                    NRO_EMPRESA as id_empresa, 
                    DES_NOME as nome, 
                    DES_LOGIN as email, 
                    FLG_TIP_COL as tipo 
                 FROM colaborador 
                 WHERE DES_LOGIN = ? AND DES_SENHA = ?`;

    db.query(sql, [email, senha], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Dentro da rota app.post('/api/login', ...)
if (results.length > 0) {
    const user = results[0];
    let perfilTraduzido = 'colaborador'; // Valor padrão

    if (user.tipo === 'A') perfilTraduzido = 'admin';
    if (user.tipo === 'E') perfilTraduzido = 'colaborador';
    if (user.tipo === 'C') perfilTraduzido = 'cliente'; // Aqui está o segredo!

    res.json({
        id: user.id_empresa,
        nome: user.nome,
        email: user.email,
        perfil: perfilTraduzido // O Front-end vai ler essa palavra
    });
        } else {
            res.status(401).json({ message: "Usuário ou senha incorretos!" });
        }
    });
});

// ==========================================
// 2. TICKETS
// ==========================================
app.post('/api/tickets', (req, res) => {
    const { assunto, prioridade, login, tipo_id, anexo } = req.body;
    const prioCode = prioridade ? prioridade.charAt(0).toUpperCase() : 'B';
    const sql = `INSERT INTO ticket (DES_TICKET, DES_STATUS, DES_PRIORIDADE, DAT_ABERTURA, NRO_TIPO, DES_LOGIN, DOC_ANEXO) VALUES (?, 'A', ?, CURDATE(), ?, ?, ?)`;
    
    db.query(sql, [assunto, prioCode, tipo_id || 1, login, anexo], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Ticket aberto!", id: result.insertId });
    });
});

app.get('/api/tickets', (req, res) => {
    const login = req.query.login;
    let sql = `SELECT 
                NRO_TICKET as id, 
                DES_TICKET as assunto, 
                DES_STATUS as status, 
                DES_PRIORIDADE as prioridade, 
                DAT_ABERTURA as data, 
                DES_LOGIN as usuario 
               FROM ticket`;
    
    let params = [];
    if (login) {
        sql += " WHERE DES_LOGIN = ?";
        params = [login];
    }
    
    sql += " ORDER BY NRO_TICKET DESC";

    db.query(sql, params, (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// ==========================================
// 3. CHAT / ATENDE
// ==========================================
app.post('/api/mensagens', (req, res) => {
    const { ticket_id, autor, texto, anexo_conteudo } = req.body;
    const sql = `INSERT INTO atende (DAT_ATENDE, DES_ATENDE, FLG_ESTADO, DOC_ANEXO, NRO_TICKET, DES_LOGIN) 
             VALUES (NOW(), ?, 'A', ?, ?, ?)`;
    
    db.query(sql, [texto, anexo_conteudo, ticket_id, autor], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query("UPDATE ticket SET DES_STATUS = 'E' WHERE NRO_TICKET = ?", [ticket_id]);
        res.json({ message: "Interação registrada!", id: result.insertId });
    });
});

app.get('/api/mensagens/:ticketId', (req, res) => {
    const sql = `SELECT NRO_ATENDE as id, DAT_ATENDE as data, DES_ATENDE as texto, DES_LOGIN as autor FROM atende WHERE NRO_TICKET = ? ORDER BY NRO_ATENDE ASC`;
    db.query(sql, [req.params.ticketId], (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// ==========================================
// 4. GESTÃO DE USUÁRIOS (Versão Centralizada)
// ==========================================

// LISTAR: Busca todo mundo da tabela colaborador
app.get('/api/usuarios', (req, res) => {
    const sql = `
        SELECT 
            DES_NOME as nome, 
            DES_LOGIN as email, 
            FLG_TIP_COL as tipo_flag,
            NRO_EMPRESA as empresa_id
        FROM colaborador
    `;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json(err);
        
        // Traduzimos as flags para nomes bonitos para a sua tabela no Front-end
        const listaTraduzida = data.map(user => ({
            nome: user.nome,
            email: user.email,
            perfil: user.tipo_flag === 'A' ? 'Admin' : user.tipo_flag === 'E' ? 'Colaborador' : user.tipo_flag === 'C' ? 'Cliente' : 'Cliente',
            status_tipo: 'A' // Apenas para manter compatibilidade com seu badge de 'Ativo'
        }));
        
        res.json(listaTraduzida);
    });
});

// CADASTRAR: Sempre insere na colaborador
app.post('/api/usuarios', (req, res) => {
    const { nome, email, senha, perfil } = req.body;

    let flag = 'C'; 
    if (perfil === 'admin') flag = 'A';
    if (perfil === 'cliente') flag = 'E';

    // Se for cliente, vinculamos à empresa dele (ex: 2). Se for equipe, à nossa (1).
    const nroEmpresa = (perfil === 'cliente') ? 2 : 1; 

    const sql = `INSERT INTO colaborador 
                (DES_NOME, DES_LOGIN, DES_SENHA, NRO_EMPRESA, FLG_TIP_COL) 
                VALUES (?, ?, ?, ?, ?)`;
    
    db.query(sql, [nome, email, senha, nroEmpresa, flag], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Usuário gravado com sucesso!" });
    });
});

// DELETAR: Usa o email (DES_LOGIN) que é a sua chave primária
app.delete('/api/usuarios/:email', (req, res) => {
    const { email } = req.params;
    const sql = "DELETE FROM colaborador WHERE DES_LOGIN = ?";

    db.query(sql, [email], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Acesso removido com sucesso!" });
    });
});

app.listen(3000, () => console.log("🚀 Servidor GESISTEC rodando na porta 3000"));