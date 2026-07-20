import React, { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { Search, User, FileText, X, AlertTriangle } from 'lucide-react';

export default function Omnibar({ isOpen, setIsOpen, interns, onSelectAction }) {
  const [search, setSearch] = useState('');

  // Toggle with Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setIsOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <Command label="Busca Global" className="flex flex-col w-full h-full max-h-[60vh]">
          <div className="flex items-center border-b px-4 py-3">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              className="flex-1 outline-none bg-transparent text-lg placeholder:text-gray-400"
              placeholder="Buscar estagiário ou ação rápida..."
            />
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded-md">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <Command.List className="overflow-y-auto p-2">
            <Command.Empty className="p-6 text-center text-gray-500">
              Nenhum resultado encontrado.
            </Command.Empty>

            <Command.Group heading="Estagiários">
              {interns.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5).map(intern => (
                <Command.Item
                  key={intern.id}
                  onSelect={() => {
                    onSelectAction('view_dossie', intern.id);
                    setIsOpen(false);
                  }}
                  className="flex items-center p-3 rounded-lg hover:bg-indigo-50 cursor-pointer aria-selected:bg-indigo-50"
                >
                  <User className="w-5 h-5 text-indigo-500 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">{intern.name}</div>
                    <div className="text-sm text-gray-500">{intern.unitId === 'antonio-barreto' ? 'Antônio Barreto' : 'Generalíssimo'}</div>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Ações Rápidas">
              <Command.Item
                onSelect={() => {
                  onSelectAction('new_occurrence');
                  setIsOpen(false);
                }}
                className="flex items-center p-3 rounded-lg hover:bg-amber-50 cursor-pointer aria-selected:bg-amber-50"
              >
                <AlertTriangle className="w-5 h-5 text-amber-500 mr-3" />
                <span className="font-medium text-gray-900">Lançar Nova Ocorrência</span>
              </Command.Item>
              
              <Command.Item
                onSelect={() => {
                  onSelectAction('view_reports');
                  setIsOpen(false);
                }}
                className="flex items-center p-3 rounded-lg hover:bg-emerald-50 cursor-pointer aria-selected:bg-emerald-50"
              >
                <FileText className="w-5 h-5 text-emerald-500 mr-3" />
                <span className="font-medium text-gray-900">Ver Relatórios Financeiros</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
