const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gesistec_db'
});

// --- ROTA: Listar Tickets (Geral ou por Cliente) ---
app.get('/api/tickets', (req, res) => {
    const email = req.query.email;
    let sql = "SELECT * FROM tickets ORDER BY id DESC";
    let params = [];

    if (email) {
        sql = "SELECT * FROM tickets WHERE emailCliente = ? ORDER BY id DESC";
        params = [email];
    }

    db.query(sql, params, (err, data) => {
        if (err) return res.status(500).send(err);
        res.json(data);
    });
});


// --- ROTA DE LOGIN ---
app.post('/api/login', (req, res) => {
    const { email, senha, perfil } = req.body;
    
    // Consulta segura usando Placeholders (?) para evitar SQL Injection
    const sql = "SELECT id, nome, email, perfil FROM usuarios WHERE email = ? AND senha = ? AND perfil = ?";
    
    db.query(sql, [email, senha, perfil], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            // Usuário encontrado! Retornamos os dados dele (menos a senha)
            res.json(results[0]);
        } else {
            // Nada encontrado ou dados incorretos
            res.status(401).json({ message: "E-mail, senha ou perfil incorretos!" });
        }
    });
});

app.listen(3000, () => console.log("Servidor GESISTEC rodando na porta 3000"));
