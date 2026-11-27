import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { AppError } from './errorHandler';

type Origem = 'body' | 'query' | 'params';

/**
 * Valida a entrada no servidor antes de qualquer processamento.
 * Campos não previstos são descartados e as mensagens retornadas são compreensíveis.
 */
export const validate = (schema: Joi.ObjectSchema, origem: Origem = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const { value, error } = schema.validate(req[origem], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
      errors: { wrap: { label: false } },
    });
    if (error) {
      return next(new AppError(400, 'Dados inválidos. Verifique os campos informados.', error.details.map((d) => d.message)));
    }
    // Express 4 permite substituir body/params; query é tratado da mesma forma
    (req as unknown as Record<Origem, unknown>)[origem] = value;
    next();
  };

/** Mensagens padrão em português para os validadores Joi. */
export const mensagens: Joi.LanguageMessages = {
  'any.required': 'O campo {#label} é obrigatório.',
  'string.empty': 'O campo {#label} é obrigatório.',
  'string.base': 'O campo {#label} deve ser um texto.',
  'string.email': 'O campo {#label} deve conter um e-mail válido.',
  'string.min': 'O campo {#label} deve ter pelo menos {#limit} caracteres.',
  'string.max': 'O campo {#label} deve ter no máximo {#limit} caracteres.',
  'string.pattern.base': 'O campo {#label} está em formato inválido.',
  'number.base': 'O campo {#label} deve ser um número.',
  'number.integer': 'O campo {#label} deve ser um número inteiro.',
  'number.min': 'O campo {#label} deve ser maior ou igual a {#limit}.',
  'number.max': 'O campo {#label} deve ser menor ou igual a {#limit}.',
  'any.only': 'O campo {#label} possui um valor não permitido.',
  'object.min': 'Informe ao menos um campo para atualizar.',
  'string.guid': 'O identificador informado é inválido.',
  'date.base': 'O campo {#label} deve conter uma data válida.',
  'date.format': 'O campo {#label} deve conter uma data válida.',
  'boolean.base': 'O campo {#label} deve ser verdadeiro ou falso.',
};
