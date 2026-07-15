import pg from 'pg';
import promptSync from 'prompt-sync';

const { Client } = pg;
const prompt = promptSync({ sigint: true });

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'sistema_almoxarifado',
});

async function initTables() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Usuario" (
      "id" SERIAL PRIMARY KEY,
      "nome" VARCHAR(40) NOT NULL,
      "email" VARCHAR(255) NOT NULL UNIQUE,
      "adm" BOOLEAN NOT NULL
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS produto (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(75) NOT NULL,
      quantidade INTEGER NOT NULL,
      preco DECIMAL NOT NULL
    );
  `);
}

function isAdminAnswer(value) {
  return value.trim().toLowerCase() === 's';
}

async function criarUsuario() {
  try {
    console.log('\n  CADASTRAR NOVO USUÁRIO\n');
    const nome = prompt('Nome do usuário: ').trim();
    const email = prompt('Email: ').trim();
    const senha = prompt('Senha: ').trim();
    const respostaAdm = prompt('Administrador (s/n): ');
    const adm = isAdminAnswer(respostaAdm);

    if (!nome || !email || !senha) {
      console.log('❌ Nome, email e senha são obrigatórios.');
      return;
    }

    await client.query(
      'INSERT INTO "Usuario" (nome, email, adm) VALUES ($1, $2, $3);',
      [nome, email, adm]
    );

    console.log(`\n✅ Usuário ${nome} cadastrado como ${adm ? 'ADMIN' : 'OPERÁRIO'}.`);
    if (adm) {
      console.log('✅ Permissão: alterar tudo e excluir produtos.');
    } else {
      console.log('✅ Permissão: cadastrar e listar produtos; sem exclusão.');
    }
  } catch (erro) {
    console.log('❌ Erro ao cadastrar usuário:', erro.message);
  }
}

async function cadastrarProduto() {
  try {
    console.log('\n  CADASTRAR NOVO PRODUTO\n');
    const nome = prompt('Nome do produto: ').trim();
    const preco = prompt('Preço: ').trim();
    const quantidade = prompt('Quantidade inicial: ').trim();

    if (!nome || !preco || !quantidade) {
      console.log('❌ Nome, preço e quantidade são obrigatórios.');
      return;
    }

    const resultado = await client.query(
      'INSERT INTO produto (nome, preco, quantidade) VALUES ($1, $2, $3) RETURNING *;', 
      [nome, preco, quantidade]
    );

    console.log('\n✅ Produto cadastrado com sucesso!');
    console.log(`   ID: ${resultado.rows[0].id} | ${resultado.rows[0].nome}`);
  } catch (erro) {
    console.log('❌ Erro ao cadastrar produto:', erro.message);
  }
}

async function listarProdutos() {
  try {
    const resultado = await client.query('SELECT id, nome, preco, quantidade FROM produto ORDER BY id;');
    if (resultado.rows.length === 0) {
      console.log('\nNenhum produto cadastrado.');
      return;
    }

    console.log('\nPRODUTOS CADASTRADOS:');
    resultado.rows.forEach((produto) => {
      console.log(`ID: ${produto.id} | ${produto.nome} | Preço: ${produto.preco} | Quantidade: ${produto.quantidade}`);
    });
  } catch (erro) {
    console.log('❌ Erro ao listar produtos:', erro.message);
  }
}

async function alterarProduto() {
  try {
    const adm = isAdminAnswer(prompt('Você é administrador? (s/n): '));
    const id = prompt('ID do produto a alterar: ').trim();
    if (!id) {
      console.log('❌ ID inválido.');
      return;
    }

    if (adm) {
      console.log('✅ Admin: pode alterar nome, preço e quantidade.');
      const nome = prompt('Novo nome: ').trim();
      const preco = prompt('Novo preço: ').trim();
      const quantidade = prompt('Nova quantidade: ').trim();

      await client.query(
        'UPDATE produto SET nome = $1, preco = $2, quantidade = $3 WHERE id = $4;', 
        [nome, preco, quantidade, id]
      );
      console.log('✅ Produto alterado com sucesso.');
    } else {
      console.log('⚠️ Operário: só pode alterar a quantidade.');
      const quantidade = prompt('Nova quantidade: ').trim();
      await client.query(
        'UPDATE produto SET quantidade = $1 WHERE id = $2;', 
        [quantidade, id]
      );
      console.log('✅ Quantidade atualizada com sucesso.');
    }
  } catch (erro) {
    console.log('❌ Erro ao alterar produto:', erro.message);
  }
}

async function excluirProduto() {
  try {
    const adm = isAdminAnswer(prompt('Você é administrador? (s/n): '));

    if (!adm) {
      console.log('⛔ Apenas admin pode excluir produtos.');
      return;
    }

    const id = prompt('ID do produto a excluir: ').trim();
    if (!id) {
      console.log('❌ ID inválido.');
      return;
    }

    await client.query('DELETE FROM produto WHERE id = $1;', [id]);
    console.log('✅ Produto excluído com sucesso.');
  } catch (erro) {
    console.log('❌ Erro ao excluir produto:', erro.message);
  }
}

async function menu() {
  while (true) {
    console.log('\n=== MENU DO ALMOXARIFADO ===');
    console.log('1 - Cadastrar usuário');
    console.log('2 - Cadastrar produto');
    console.log('3 - Listar produtos');
    console.log('4 - Alterar produto');
    console.log('5 - Excluir produto (somente admin)');
    console.log('6 - Sair');

    const opcao = prompt('Escolha uma opção: ').trim();

    switch (opcao) {
      case '1':
        await criarUsuario();
        break;
      case '2':
        await cadastrarProduto();
        break;
      case '3':
        await listarProdutos();
        break;
      case '4':
        await alterarProduto();
        break;
      case '5':
        await excluirProduto();
        break;
      case '6':
        console.log('Saindo...');
        await client.end();
        process.exit(0);
      default:
        console.log('Opção inválida. Tente novamente.');
    }
  }
}

async function main() {
  try {
    await client.connect();
    await initTables();
    await menu();
  } catch (erro) {
    console.log('❌ Erro na aplicação:', erro.message);
  }
}

main();
