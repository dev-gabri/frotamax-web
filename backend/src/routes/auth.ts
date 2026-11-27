import { NextFunction, Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { query } from '../db/pool';
import { authenticate, gerarToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { mensagens, validate } from '../middleware/validate';
import { AuthenticatedRequest, Perfil } from '../types';

const router = Router();

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(160).required().label('E-mail'),
  senha: Joi.string().min(1).max(128).required().label('Senha'),
}).messages(mensagens);

/**
 * Limite de tentativas (proteção contra força bruta):
 *  - após 5 falhas para o mesmo e-mail e origem, esse e-mail fica bloqueado nessa origem por 15 minutos;
 *  - após 20 falhas da mesma origem, com quaisquer e-mails, a origem fica bloqueada por 15 minutos,
 *    o que impede testar uma senha em muitas contas (BUG-09).
 * Os registros vencidos são descartados para que a memória não cresça sem limite.
 */
const MAX_TENTATIVAS = 5;
const MAX_FALHAS_POR_ORIGEM = 20;
const JANELA_MS = 15 * 60 * 1000;
const LIMPEZA_A_PARTIR_DE = 500;

interface Falhas { falhas: number; desde: number }
const tentativas = new Map<string, Falhas>();
const porOrigem = new Map<string, Falhas>();

function chave(req: Request, email: string) {
  return `${req.ip}|${email}`;
}

/** Retorna o registro ainda dentro da janela de bloqueio, descartando o vencido. */
function registroAtual(mapa: Map<string, Falhas>, k: string): Falhas | undefined {
  const registro = mapa.get(k);
  if (registro && Date.now() - registro.desde >= JANELA_MS) {
    mapa.delete(k);
    return undefined;
  }
  return registro;
}

function contarFalha(mapa: Map<string, Falhas>, k: string) {
  const atual = registroAtual(mapa, k) ?? { falhas: 0, desde: Date.now() };
  mapa.set(k, { falhas: atual.falhas + 1, desde: atual.desde });
}

function descartarVencidos() {
  if (tentativas.size + porOrigem.size < LIMPEZA_A_PARTIR_DE) return;
  for (const mapa of [tentativas, porOrigem]) {
    for (const k of mapa.keys()) registroAtual(mapa, k);
  }
}

export function limparTentativas() {
  tentativas.clear();
  porOrigem.clear();
}

// Hash usado quando o e-mail não existe, para que o tempo de resposta não revele contas válidas
const HASH_FICTICIO = bcrypt.hashSync('frotamax-hash-ficticio', 12);

const MENSAGEM_CREDENCIAIS = 'E-mail ou senha inválidos.';

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, senha } = req.body as { email: string; senha: string };
    descartarVencidos();
    const k = chave(req, email);
    const origem = req.ip ?? 'desconhecida';
    const doEmail = registroAtual(tentativas, k);
    const daOrigem = registroAtual(porOrigem, origem);
    if ((doEmail && doEmail.falhas >= MAX_TENTATIVAS) || (daOrigem && daOrigem.falhas >= MAX_FALHAS_POR_ORIGEM)) {
      throw new AppError(429, 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.');
    }

    const { rows } = await query<{ id: string; nome: string; email: string; perfil: Perfil; senha_hash: string; ativo: boolean }>(
      'SELECT id, nome, email, perfil, senha_hash, ativo FROM usuarios WHERE LOWER(email) = $1',
      [email]
    );
    const usuario = rows[0];
    const senhaConfere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FICTICIO);

    if (!usuario || !senhaConfere || !usuario.ativo) {
      contarFalha(tentativas, k);
      contarFalha(porOrigem, origem);
      throw new AppError(401, MENSAGEM_CREDENCIAIS);
    }

    tentativas.delete(k);
    await query('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1', [usuario.id]);

    res.json({
      success: true,
      data: {
        token: gerarToken(usuario.id),
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      },
    });
  } catch (error) {
    next(error);
  }
});

/** Retorna o usuário da sessão atual (usado pela interface para validar o token). */
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: req.usuario });
});

export default router;
