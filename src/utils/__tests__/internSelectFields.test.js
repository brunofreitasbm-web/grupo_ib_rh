import { describe, it, expect } from 'vitest';
import {
  INTERN_SELECT_FIELDS,
  INTERN_SELECT_FIELDS_WITH_BIOMETRY,
  mapInternFromDb,
  mapInternToDb,
} from '../mappings';

describe('INTERN_SELECT_FIELDS', () => {
  it('lista padrão não traz colunas pesadas', () => {
    const cols = INTERN_SELECT_FIELDS.split(',').map((c) => c.trim());
    expect(cols).not.toContain('photo');
    expect(cols).not.toContain('face_descriptor');
  });

  it('variante com biometria inclui photo e face_descriptor', () => {
    const cols = INTERN_SELECT_FIELDS_WITH_BIOMETRY.split(',').map((c) => c.trim());
    expect(cols).toContain('photo');
    expect(cols).toContain('face_descriptor');
    expect(cols).toContain('id');
  });
});

describe('mapInternFromDb / mapInternToDb com biometria ausente', () => {
  it('tolera photo/face_descriptor ausentes', () => {
    const i = mapInternFromDb({ id: '1', name: 'A' });
    expect(i.photo).toBeUndefined();
    expect(i.faceDescriptor).toBeUndefined();
  });

  it('update não inclui face_descriptor/photo quando não carregados (não apaga biometria)', () => {
    const db = mapInternToDb(mapInternFromDb({ id: '1', name: 'A' }));
    expect('face_descriptor' in db).toBe(false);
    expect(JSON.parse(JSON.stringify(db))).not.toHaveProperty('photo');
  });

  it('mantém face_descriptor quando definido', () => {
    expect(mapInternToDb({ faceDescriptor: '[1]' }).face_descriptor).toBe('[1]');
    expect(mapInternToDb({ faceDescriptor: '' }).face_descriptor).toBeNull();
  });
});
