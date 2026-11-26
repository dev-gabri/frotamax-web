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
 * Limite simples de tentativas: após 5 falhas para o mesmo e-mail e origem,
 * novas tentativas ficam bloqueadas por 15 minutos (proteção contra força bruta).
 */
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { falhas: number; desde: number }>();

function chave(req: Request, email: string) {
  return `${req.ip}|${email}`;
}

export function limparTentativas() {
  tentativas.clear();
}

// Hash usado quando o e-mail não existe, para que o tempo de resposta não revele contas válidas
const HASH_FICTICIO = bcrypt.hashSync('frotamax-hash-ficticio', 12);

const MENSAGEM_CREDENCIAIS = 'E-mail ou senha inválidos.';

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, senha } = req.body as { email: string; senha: string };
    const k = chave(req, email);
    const registro = tentativas.get(k);
    if (registro && registro.falhas >= MAX_TENTATIVAS && Date.now() - registro.desde < JANELA_MS) {
      throw new AppError(429, 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.');
    }

    const { rows } = await query<{ id: string; nome: string; email: string; perfil: Perfil; senha_hash: string; ativo: boolean }>(
      'SELECT id, nome, email, perfil, senha_hash, ativo FROM usuarios WHERE LOWER(email) = $1',
      [email]
    );
    const usuario = rows[0];
    const senhaConfere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FICTICIO);

    if (!usuario || !senhaConfere || !usuario.ativo) {
      const atual = registro && Date.now() - registro.desde < JANELA_MS ? registro : { falhas: 0, desde: Date.now() };
      tentativas.set(k, { falhas: atual.falhas + 1, desde: atual.desde });
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
