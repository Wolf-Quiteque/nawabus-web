// resolve_promotion_for_ticket (and the booking RPCs) raise their errors in
// English; customers read Portuguese. Anything not listed passes through.
const MESSAGES_PT = [
  [/promotion code is invalid or inactive/i, 'Este código de desconto não é válido ou já não está ativo.'],
  [/affiliate code is not active/i, 'Este código de desconto já não está ativo.'],
  [/affiliates cannot use their own code/i, 'Não pode usar o seu próprio código de afiliado.'],
  [/promotion benefit exceeds the ticket fare/i, 'Este código não pode ser usado nesta viagem.'],
  [/promotion.*(already used|limit)/i, 'Este código de desconto já foi utilizado.'],
  [/invalid base fare/i, 'Não foi possível calcular o preço desta viagem. Tente novamente.'],
  [/trip not found/i, 'Esta viagem já não está disponível.'],
];

export function inPortuguese(message, fallback) {
  if (!message) return fallback;
  const hit = MESSAGES_PT.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : message;
}
