import React, { useMemo } from 'react';
import { COURSES_BY_AREA, INTERNSHIP_TYPES, normalizeCourseValue } from '../config/academicCourses';
import { PROFESSIONS_BY_AREA, normalizeProfessionValue } from '../config/professions';

/**
 * Campo fechado de Curso Acadêmico: o usuário só escolhe valores do catálogo
 * (src/config/academicCourses.js), agrupados por área de conhecimento.
 *
 * Cadastros antigos com texto livre fora do catálogo continuam visíveis numa
 * opção separada, para que editar o estagiário não apague o dado existente.
 */
export function CourseSelect({
  value = '',
  onChange,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Selecione o curso',
  id,
}) {
  const legacyValue = useMemo(() => {
    if (!value) return '';
    return normalizeCourseValue(value) === value ? '' : value;
  }, [value]);

  return (
    <select
      id={id}
      required={required}
      disabled={disabled}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    >
      <option value="">{placeholder}</option>
      {legacyValue && (
        <optgroup label="Cadastro antigo (fora do catálogo)">
          <option value={legacyValue}>{legacyValue}</option>
        </optgroup>
      )}
      {COURSES_BY_AREA.map(group => (
        <optgroup key={group.area} label={group.area}>
          {group.courses.map(c => (
            <option key={c.slug} value={c.value}>{c.value}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Tipo de estágio: escolha única entre "Obrigatório" e "Não obrigatório".
 */
export function InternshipTypeField({
  value = '',
  onChange,
  name = 'internshipType',
  disabled = false,
  layout = 'cards',
}) {
  if (layout === 'select') {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
      >
        <option value="">Selecione o tipo de estágio</option>
        {INTERNSHIP_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {INTERNSHIP_TYPES.map(t => {
        const selected = value === t.value;
        return (
          <label
            key={t.value}
            title={t.description}
            className={`flex items-start gap-2 border rounded-lg p-2 cursor-pointer transition-colors ${
              selected
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-300 bg-white hover:bg-slate-50'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={t.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(t.value)}
              className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="leading-tight">
              <span className="block font-semibold text-gray-700">{t.label}</span>
              <span className="block text-[10px] text-gray-500">{t.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Campo fechado de Profissão dos Profissionais PJ: mesma mecânica do
 * CourseSelect, com o catálogo de src/config/professions.js agrupado por área.
 *
 * Cadastros antigos com texto livre fora do catálogo continuam visíveis numa
 * opção separada, para que editar o prestador não apague o dado existente.
 */
export function ProfessionSelect({
  value = '',
  onChange,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Selecione a profissão',
  id,
}) {
  const legacyValue = useMemo(() => {
    if (!value) return '';
    return normalizeProfessionValue(value) === value ? '' : value;
  }, [value]);

  return (
    <select
      id={id}
      required={required}
      disabled={disabled}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    >
      <option value="">{placeholder}</option>
      {legacyValue && (
        <optgroup label="Cadastro antigo (fora do catálogo)">
          <option value={legacyValue}>{legacyValue}</option>
        </optgroup>
      )}
      {PROFESSIONS_BY_AREA.map(group => (
        <optgroup key={group.area} label={group.area}>
          {group.professions.map(p => (
            <option key={p.slug} value={p.value}>{p.value}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
