import { slugify } from './slugify.js';

describe('slugify', () => {
  it.each([
    ['Anéis', 'aneis'],
    ['Alianças', 'aliancas'],
    ['Restauração', 'restauracao'],
    ['  Brincos de Ouro 18k ', 'brincos-de-ouro-18k'],
    ['Peças --- Únicas!', 'pecas-unicas'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('retorna vazio quando não há caracteres válidos', () => {
    expect(slugify('***')).toBe('');
  });
});
