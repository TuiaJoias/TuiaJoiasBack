/**
 * Cria (ou redefine a senha de) um administrador.
 *
 *   npm run admin:create                       → pergunta nome, email e senha
 *   npm run admin:create -- --reset-password   → troca a senha de um admin existente
 *
 * Uso não interativo (ex.: CI/servidor): defina ADMIN_NAME, ADMIN_EMAIL e
 * ADMIN_PASSWORD no ambiente. Evite deixar a senha no histórico do shell.
 */
import { isEmail } from 'class-validator';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../../auth/password.js';
import { normalizeEmail } from '../../common/utils/normalize-email.js';
import { User } from '../../users/entities/user.entity.js';
import { fail, withDataSource } from './seed-runner.js';

/** bcrypt considera apenas os primeiros 72 bytes da senha. */
const BCRYPT_MAX_BYTES = 72;
const resetPassword = process.argv.includes('--reset-password');

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Lê a senha sem exibi-la no terminal. */
function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    return Promise.reject(new Error('Terminal não interativo: defina ADMIN_PASSWORD.'));
  }
  return new Promise((resolve, reject) => {
    let value = '';
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();

    const finish = (callback: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
      callback();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          return finish(() => resolve(value));
        }
        if (char === '\u0003') {
          return finish(() => reject(new Error('Operação cancelada.')));
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    stdin.on('data', onData);
  });
}

function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
    fail(`A senha deve ter no máximo ${BCRYPT_MAX_BYTES} bytes.`);
  }
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (fromEnv) {
    validatePassword(fromEnv);
    return fromEnv;
  }
  const password = await askHidden('Senha: ');
  validatePassword(password);
  const confirmation = await askHidden('Confirme a senha: ');
  if (password !== confirmation) {
    fail('As senhas não conferem.');
  }
  return password;
}

async function main(): Promise<void> {
  console.log(resetPassword ? '\nRedefinir senha do administrador\n' : '\nCriar administrador\n');

  const email = normalizeEmail(process.env.ADMIN_EMAIL ?? (await ask('Email: ')));
  if (!isEmail(email)) {
    fail('Email inválido.');
  }

  const name = resetPassword ? '' : (process.env.ADMIN_NAME ?? (await ask('Nome: '))).trim();
  if (!resetPassword && (name.length < 2 || name.length > 120)) {
    fail('O nome deve ter entre 2 e 120 caracteres.');
  }

  await withDataSource(async (dataSource) => {
    const users = dataSource.getRepository(User);
    const existing = await users.findOneBy({ email });

    if (resetPassword && !existing) {
      fail(`Nenhum administrador com o email ${email}.`);
    }
    if (!resetPassword && existing) {
      fail(`Já existe um administrador com o email ${email}. Use --reset-password para trocar a senha.`);
    }

    const passwordHash = await hashPassword(await readPassword());

    if (existing) {
      await users.update({ id: existing.id }, { passwordHash });
      console.log(`\n✔ Senha de ${email} redefinida.\n`);
    } else {
      await users.insert({ name, email, passwordHash });
      console.log(`\n✔ Administrador ${email} criado. Faça login em /admin/login.\n`);
    }
  });
}

main().catch((error: Error) => fail(error.message));
