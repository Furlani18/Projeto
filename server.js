const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
// Aumentado para 50mb para suportar anexos em Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
        
        if (results.length > 0) {
            const user = results[0];
            let perfilTraduzido = 'cliente';

            if (user.tipo === 'A') perfilTraduzido = 'admin';
            else if (user.tipo === 'E') perfilTraduzido = 'colaborador';
            else if (user.tipo === 'C') perfilTraduzido = 'cliente';

            res.json({
                id: user.id_empresa,
                nome: user.nome,
                email: user.email,
                perfil: perfilTraduzido
            });
        } else {
            res.status(401).json({ message: "Usuário ou senha incorretos!" });
        }
    });
});

/// ==========================================
// 2. TICKETS
// ==========================================

// LISTAR TICKETS (Agora buscando o nome da empresa)
// BUSCAR TICKETS (Com o JOIN para pegar o prazo de dias)
app.get('/api/tickets', (req, res) => {
    const { login } = req.query;
    
    // Adicionamos t.QTD_DIAS e o JOIN com tipo_ticket
    let sql = `
        SELECT 
            t.NRO_TICKET as id, 
            t.DES_TICKET as assunto, 
            t.DES_LOGIN as email_usuario, 
            e.NOM_EMPRESA as nome_empresa, 
            t.DES_STATUS as status, 
            t.DES_PRIORIDADE as prioridade, 
            t.DAT_ABERTURA as data,
            t.NRO_TIPO as nro_tipo,
            tt.DES_TIPO as tipo,
            tt.QTD_DIAS as prazo_dias -- <--- Pegando o prazo da tabela tipo_ticket
        FROM ticket t
        LEFT JOIN colaborador c ON t.DES_LOGIN = c.DES_LOGIN
        LEFT JOIN empresa e ON c.NRO_EMPRESA = e.NRO_EMPRESA
        LEFT JOIN tipo_ticket tt ON t.NRO_TIPO = tt.NRO_TIPO -- <--- Unindo as tabelas
    `;

    const params = [];
    if (login) {
        sql += ` WHERE t.DES_LOGIN = ?`;
        params.push(login);
    }
    sql += ` ORDER BY t.NRO_TICKET DESC`;

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error("ERRO NO SQL:", err.sqlMessage);
            return res.status(500).json({ error: err.sqlMessage });
        }
        res.json(results);
    });
});

app.post('/api/tickets', (req, res) => {
    const { assunto, descricao, prioridade, login, tipo_id, anexo } = req.body;
    if (!assunto || !login || !tipo_id) {
        return res.status(400).json({ error: 'Assunto, login e tipo de chamado são obrigatórios.' });
    }

    const sqlInsertTicket = `INSERT INTO ticket (DES_TICKET, DES_PRIORIDADE, DES_LOGIN, DES_STATUS, NRO_TIPO, DAT_ABERTURA) VALUES (?, ?, ?, 'Pendente', ?, NOW())`;
    db.query(sqlInsertTicket, [assunto, prioridade || 'Média', login, tipo_id], (ticketErr, ticketResult) => {
        if (ticketErr) {
            console.error('Erro ao criar ticket:', ticketErr.message);
            return res.status(500).json({ error: ticketErr.message });
        }

        const ticketId = ticketResult.insertId;
        const tarefas = [];

        if (descricao && descricao.trim()) {
            tarefas.push(cb => {
                const sql = `INSERT INTO atende (DAT_ATENDE, DES_ATENDE, FLG_ESTADO, NRO_TICKET, DES_LOGIN) VALUES (NOW(), ?, 'D', ?, ?)`;
                db.query(sql, [descricao.trim(), ticketId, login], cb);
            });
        }

        if (anexo) {
            tarefas.push(cb => {
                const sqlAtende = `INSERT INTO atende (DAT_ATENDE, DES_ATENDE, FLG_ESTADO, NRO_TICKET, DES_LOGIN) VALUES (NOW(), ?, 'A', ?, ?)`;
                db.query(sqlAtende, ['Anexo enviado no primeiro contato', ticketId, login], (err, atResult) => {
                    if (err) return cb(err);
                    const sqlDoc = `INSERT INTO atende_doc (NRO_ATENDE, DOC_ANEXO) VALUES (?, ?)`;
                    db.query(sqlDoc, [atResult.insertId, anexo], cb);
                });
            });
        }

        if (tarefas.length === 0) {
            return res.json({ message: 'Chamado aberto com sucesso!', id: ticketId });
        }

        let concluidas = 0;
        tarefas.forEach(tarefa => {
            tarefa((err) => {
                if (err) console.error('Erro ao salvar atende:', err.message);
                concluidas++;
                if (concluidas === tarefas.length) {
                    res.json({ message: 'Chamado aberto com sucesso!', id: ticketId });
                }
            });
        });
    });
});
app.delete('/api/tickets/:id', (req, res) => {
    const ticketId = req.params.id;

    const sqlDelDocs = `DELETE ad FROM atende_doc ad INNER JOIN atende a ON ad.NRO_ATENDE = a.NRO_ATENDE WHERE a.NRO_TICKET = ?`;
    db.query(sqlDelDocs, [ticketId], (errDoc) => {
        if (errDoc) {
            console.error('Erro ao excluir anexos do ticket:', errDoc.message);
            return res.status(500).json({ error: errDoc.message });
        }

        db.query('DELETE FROM atende WHERE NRO_TICKET = ?', [ticketId], (err) => {
            if (err) {
                console.error('Erro ao excluir atendimentos do ticket:', err.message);
                return res.status(500).json({ error: err.message });
            }

            db.query('DELETE FROM ticket WHERE NRO_TICKET = ?', [ticketId], (ticketErr, result) => {
                if (ticketErr) {
                    console.error('Erro ao excluir ticket:', ticketErr.message);
                    return res.status(500).json({ error: ticketErr.message });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Ticket não encontrado.' });
                }

                res.json({ message: 'Ticket excluído com sucesso.' });
            });
        });
    });
});
// ==========================================
// 3. MENSAGENS / CHAT
// ==========================================

// BUSCAR MENSAGENS DE UM TICKET
app.get('/api/mensagens/:ticketId', (req, res) => {
    const { ticketId } = req.params;

    const sqlMsgs = `
        SELECT
            a.DES_LOGIN as email_autor,
            c.DES_NOME as nome_autor,
            c.FLG_TIP_COL as tipo_autor,
            a.DAT_ATENDE as data,
            a.DES_ATENDE as texto,
            a.NRO_ATENDE as id,
            a.FLG_ESTADO as tipo_msg
        FROM atende a
        LEFT JOIN colaborador c ON a.DES_LOGIN = c.DES_LOGIN
        WHERE a.NRO_TICKET = ?
        ORDER BY a.NRO_ATENDE ASC`;

    db.query(sqlMsgs, [ticketId], (err, msgs) => {
        if (err) return res.status(500).json({ error: err.message });

        const sqlAnexos = `
            SELECT ad.NRO_ATENDE, ad.DOC_ANEXO
            FROM atende_doc ad
            INNER JOIN atende a ON ad.NRO_ATENDE = a.NRO_ATENDE
            WHERE a.NRO_TICKET = ?
            ORDER BY ad.NRO_ATENDE_DOC ASC`;

        db.query(sqlAnexos, [ticketId], (errAnexos, anexosRows) => {
            if (errAnexos) return res.status(500).json({ error: errAnexos.message });

            const anexosPorMsg = {};
            anexosRows.forEach(row => {
                if (!anexosPorMsg[row.NRO_ATENDE]) anexosPorMsg[row.NRO_ATENDE] = [];
                if (!row.DOC_ANEXO) return;
                const raw = row.DOC_ANEXO.toString('utf-8');
                let parsed;
                try { parsed = JSON.parse(raw); } catch { parsed = { inline: false, data: raw }; }
                anexosPorMsg[row.NRO_ATENDE].push(parsed);
            });

            const tipoLabel = { 'A': 'Admin', 'E': 'Colaborador', 'C': 'Cliente' };
            const mensagensFormatadas = msgs.map(row => ({
                id: row.id,
                data: row.data,
                texto: row.texto,
                email_autor: row.email_autor,
                autor_display: row.nome_autor || row.email_autor,
                tipo_autor: tipoLabel[row.tipo_autor] || 'Cliente',
                anexos: anexosPorMsg[row.id] || [],
                tipo_msg: row.tipo_msg
            }));

            res.json(mensagensFormatadas);
        });
    });
});

// ENVIAR MENSAGEM NO CHAT
app.post('/api/mensagens', (req, res) => {
    const { ticket_id, autor, texto, anexos } = req.body;

    const sqlAtende = `INSERT INTO atende (DAT_ATENDE, DES_ATENDE, FLG_ESTADO, NRO_TICKET, DES_LOGIN) VALUES (NOW(), ?, 'A', ?, ?)`;

    db.query(sqlAtende, [texto, ticket_id, autor], (err, result) => {
        if (err) return res.status(500).json({ error: "Erro ao salvar mensagem" });

        const lista = (Array.isArray(anexos) ? anexos : []).filter(Boolean).slice(0, 2);
        if (lista.length === 0) {
            return res.json({ message: "Mensagem enviada com sucesso!", id: result.insertId });
        }

        const values = lista.map(a => [result.insertId, JSON.stringify(a)]);
        db.query('INSERT INTO atende_doc (NRO_ATENDE, DOC_ANEXO) VALUES ?', [values], (errDoc) => {
            if (errDoc) return res.status(500).json({ error: "Erro ao salvar anexos" });
            res.json({ message: "Mensagem enviada com sucesso!", id: result.insertId });
        });
    });
});

// ==========================================
// 4. GESTÃO DE USUÁRIOS
// ==========================================

app.get('/api/usuarios', (req, res) => {
    const sql = `SELECT c.DES_NOME as nome, c.DES_LOGIN as email, c.FLG_TIP_COL as tipo_flag, e.NOM_EMPRESA as empresa FROM colaborador c LEFT JOIN empresa e ON c.NRO_EMPRESA = e.NRO_EMPRESA`;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json(err);
        
        const listaTraduzida = data.map(user => ({
            nome: user.nome,
            email: user.email,
            perfil: user.tipo_flag === 'A' ? 'Admin' : user.tipo_flag === 'E' ? 'Colaborador' : 'Cliente',
            empresa: user.empresa || '---'
        }));
        res.json(listaTraduzida);
    });
});

app.post('/api/usuarios', (req, res) => {
    const { nome, email, senha, perfil, nro_empresa } = req.body;
    let flag = perfil === 'admin' ? 'A' : (perfil === 'colaborador' ? 'E' : 'C');

    if (!nome || !email || !senha || !nro_empresa) {
        return res.status(400).json({ error: 'Nome, email, senha e empresa são obrigatórios.' });
    }

    const sql = `INSERT INTO colaborador (DES_NOME, DES_LOGIN, DES_SENHA, NRO_EMPRESA, FLG_TIP_COL) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [nome, email, senha, nro_empresa, flag], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Usuário gravado com sucesso!" });
    });
});

app.delete('/api/usuarios/:email', (req, res) => {
    db.query("DELETE FROM colaborador WHERE DES_LOGIN = ?", [req.params.email], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Acesso removido!" });
    });
});

// ==========================================
// 5. GESTÃO DE EMPRESAS
// ==========================================

app.get('/api/empresas', (req, res) => {
    const sql = `SELECT NRO_EMPRESA as id, NOM_EMPRESA as nome, NRO_CNPJ as cnpj, NOM_CIDADE as cidade, DES_ENDERECO as endereco, NRO_CEP as cep, FLG_EMP as tipo FROM empresa ORDER BY NRO_EMPRESA DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/empresas', (req, res) => {
    const { nome, cnpj, cidade, endereco, cep, flg_emp } = req.body;
    if (!nome || !cnpj || !cidade || !endereco || !cep || !flg_emp) {
        return res.status(400).json({ error: 'Todos os campos da empresa são obrigatórios.' });
    }
    const sql = `INSERT INTO empresa (NOM_EMPRESA, NRO_CNPJ, NOM_CIDADE, DES_ENDERECO, NRO_CEP, FLG_EMP) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(sql, [nome, cnpj, cidade, endereco, cep, flg_emp], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Empresa cadastrada com sucesso!', id: result.insertId });
    });
});

app.delete('/api/empresas/:id', (req, res) => {
    const sql = `DELETE FROM empresa WHERE NRO_EMPRESA = ?`;
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Empresa removida com sucesso!' });
    });
});

// ==========================================
// 6. GESTÃO DE TIPOS DE CHAMADOS
// ==========================================

app.get('/api/tipos-ticket', (req, res) => {
    const sql = `SELECT NRO_TIPO as id, DES_TIPO as nome, QTD_DIAS as prazo_dias FROM tipo_ticket ORDER BY NRO_TIPO DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/tipos-ticket', (req, res) => {
    const { nome, prazo_dias } = req.body;
    if (!nome || prazo_dias == null) {
        return res.status(400).json({ error: 'Nome e prazo são obrigatórios.' });
    }
    const sql = `INSERT INTO tipo_ticket (DES_TIPO, QTD_DIAS) VALUES (?, ?)`;
    db.query(sql, [nome, prazo_dias], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tipo de chamado cadastrado com sucesso!', id: result.insertId });
    });
});

app.delete('/api/tipos-ticket/:id', (req, res) => {
    const sql = `DELETE FROM tipo_ticket WHERE NRO_TIPO = ?`;
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tipo de chamado removido com sucesso!' });
    });
});

// Atualizar status simples do ticket (Cancelar, Finalizar, mudar status rápido)
app.put('/api/tickets/:id/status', (req, res) => {
    const { id } = req.params;
    const { novoStatus } = req.body;
    const statusAceito = ['P', 'E', 'V', 'F', 'C'];

    if (!novoStatus || !statusAceito.includes(novoStatus)) {
        return res.status(400).json({ error: 'Status inválido. Use P, E, V, F ou C.' });
    }

    const sql = `UPDATE ticket SET DES_STATUS = ? WHERE NRO_TICKET = ?`;
    db.query(sql, [novoStatus, id], (err, result) => {
        if (err) {
            console.error("Erro ao atualizar status do ticket:", err.message);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Ticket não encontrado." });
        }

        res.json({ message: "Status do ticket atualizado com sucesso!" });
    });
});

// ATUALIZAÇÃO COMPLETA DO TICKET (Assunto, Prioridade e Status)
app.put('/api/tickets/:id', (req, res) => {
    const { id } = req.params;
    const { assunto, prioridade, status } = req.body;

    // Sincronizado com os nomes das colunas da sua tabela 'ticket'
    const sql = `UPDATE ticket 
                 SET DES_TICKET = ?, 
                     DES_PRIORIDADE = ?, 
                     DES_STATUS = ? 
                 WHERE NRO_TICKET = ?`;

    db.query(sql, [assunto, prioridade, status, id], (err, result) => {
        if (err) {
            console.error("Erro ao atualizar ticket:", err.message);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Ticket não encontrado." });
        }

        res.json({ message: "Ticket atualizado com sucesso!" });
    });
});

app.listen(3000, () => console.log("🚀 Servidor GESISTEC rodando na porta 3000"));