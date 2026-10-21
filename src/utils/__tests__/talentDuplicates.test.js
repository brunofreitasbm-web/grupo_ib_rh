import { describe, it, expect } from 'vitest';
import { normalizePhone, findDuplicateClusters, suggestMaster } from '../talentDuplicates';

describe('talentDuplicates', () => {
  it('normaliza telefone ignorando máscara e DDI 55', () => {
    expect(normalizePhone('+55 (21) 99999-8888')).toBe('21999998888');
    expect(normalizePhone('21 99999-8888')).toBe('21999998888');
    expect(normalizePhone('123')).toBe('');
  });

  it('agrupa por e-mail ou telefone, transitivamente, nunca só por nome', () => {
    const list = [
      { id: 1, full_name: 'Ana', email: 'Ana@x.com', phone: '' },
      { id: 2, full_name: 'Ana S', email: 'ana@x.com ', phone: '21999998888' },
      { id: 3, full_name: 'A. Silva', email: 'outro@x.com', phone: '(21) 99999-8888' },
      { id: 4, full_name: 'Ana', email: 'diferente@x.com', phone: '' },
    ];
    const { clusters, clusterById } = findDuplicateClusters(list);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].map((c) => c.id).sort()).toEqual([1, 2, 3]);
    expect(clusterById.has('4')).toBe(false);
  });

  it('principal sugerido é a candidatura mais recente', () => {
    expect(suggestMaster([{ id: 1, created_at_ms: 10 }, { id: 2, created_at_ms: 99 }]).id).toBe(2);
  });
});
