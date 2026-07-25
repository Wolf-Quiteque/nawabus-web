'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getLuandaTodayDateKey } from '@/lib/purchase-date';

const INITIAL_FORM = {
  tipoCliente: 'individual',
  nome: '',
  nif: '',
  telefone: '',
  email: '',
  origem: '',
  destino: '',
  pessoas: '',
  dataPartida: '',
  horaPartida: '',
  idaEVolta: false,
  dataRegresso: '',
  horaRegresso: '',
  detalhes: '',
};

const inputClass =
  'w-full h-11 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-3 text-sm text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-colors';

const labelClass =
  'block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-1.5';

export default function FreteModal({ open, onOpenChange }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const today = getLuandaTodayDateKey();
  const isEmpresa = form.tipoCliente === 'empresa';

  const setField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && status === 'success') {
      setForm(INITIAL_FORM);
      setStatus('idle');
      setErrorMsg('');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/frete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível enviar o pedido.');
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Não foi possível enviar o pedido. Tente novamente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-2xl max-h-[92svh] overflow-y-auto rounded-2xl border-amber-200 dark:border-stone-700 p-0 gap-0">
        <div className="samakaka-strip rounded-t-2xl"></div>

        {status === 'success' ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <DialogTitle className="text-2xl font-black text-stone-900 dark:text-white mb-2">
              Pedido recebido!
            </DialogTitle>
            <DialogDescription className="text-stone-600 dark:text-stone-300 text-base mb-8">
              A nossa equipa vai analisar o teu pedido de frete e entrar em contacto
              no <strong className="text-amber-600">máximo em 24 horas</strong>.
            </DialogDescription>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3 font-black text-stone-950 shadow-lg hover:scale-105 transition-transform duration-300"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            <DialogTitle className="text-2xl md:text-3xl font-black text-stone-900 dark:text-white mb-1">
              Aluguer de <span className="text-amber-600">Frete</span>
            </DialogTitle>
            <DialogDescription className="text-stone-600 dark:text-stone-300 mb-6">
              Conta-nos os detalhes da viagem e respondemos no{' '}
              <strong className="text-amber-600">máximo em 24 horas</strong>.
            </DialogDescription>

            {/* Tipo de cliente */}
            <div className="mb-5">
              <span className={labelClass}>Tipo de cliente</span>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'individual', label: 'Pessoa individual' },
                  { value: 'empresa', label: 'Empresa' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center justify-center gap-2 h-11 rounded-lg border-2 cursor-pointer text-sm font-bold transition-all duration-200 ${
                      form.tipoCliente === opt.value
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                        : 'border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:border-amber-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoCliente"
                      value={opt.value}
                      checked={form.tipoCliente === opt.value}
                      onChange={setField('tipoCliente')}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className={isEmpresa ? '' : 'md:col-span-2'}>
                <label htmlFor="frete-nome" className={labelClass}>
                  {isEmpresa ? 'Nome da empresa / responsável *' : 'Nome completo *'}
                </label>
                <input
                  id="frete-nome"
                  type="text"
                  value={form.nome}
                  onChange={setField('nome')}
                  className={inputClass}
                  placeholder={isEmpresa ? 'Ex: Empresa XYZ, Lda' : 'Ex: João dos Santos'}
                  required
                />
              </div>

              {isEmpresa && (
                <div>
                  <label htmlFor="frete-nif" className={labelClass}>
                    NIF da empresa *
                  </label>
                  <input
                    id="frete-nif"
                    type="text"
                    value={form.nif}
                    onChange={setField('nif')}
                    className={inputClass}
                    placeholder="Ex: 5000000000"
                    required
                  />
                </div>
              )}

              <div>
                <label htmlFor="frete-telefone" className={labelClass}>
                  Telefone *
                </label>
                <input
                  id="frete-telefone"
                  type="tel"
                  value={form.telefone}
                  onChange={setField('telefone')}
                  className={inputClass}
                  placeholder="Ex: 923 456 789"
                  required
                />
              </div>

              <div>
                <label htmlFor="frete-email" className={labelClass}>
                  Email (opcional)
                </label>
                <input
                  id="frete-email"
                  type="email"
                  value={form.email}
                  onChange={setField('email')}
                  className={inputClass}
                  placeholder="Ex: nome@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div>
                <label htmlFor="frete-origem" className={labelClass}>
                  Origem *
                </label>
                <input
                  id="frete-origem"
                  type="text"
                  value={form.origem}
                  onChange={setField('origem')}
                  className={inputClass}
                  placeholder="Ex: Luanda"
                  required
                />
              </div>
              <div>
                <label htmlFor="frete-destino" className={labelClass}>
                  Destino *
                </label>
                <input
                  id="frete-destino"
                  type="text"
                  value={form.destino}
                  onChange={setField('destino')}
                  className={inputClass}
                  placeholder="Ex: Benguela"
                  required
                />
              </div>
              <div>
                <label htmlFor="frete-pessoas" className={labelClass}>
                  Nº de pessoas *
                </label>
                <input
                  id="frete-pessoas"
                  type="number"
                  min="1"
                  value={form.pessoas}
                  onChange={setField('pessoas')}
                  className={inputClass}
                  placeholder="Ex: 40"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="frete-data-partida" className={labelClass}>
                  Data de partida *
                </label>
                <input
                  id="frete-data-partida"
                  type="date"
                  min={today}
                  value={form.dataPartida}
                  onChange={setField('dataPartida')}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="frete-hora-partida" className={labelClass}>
                  Hora de partida
                </label>
                <input
                  id="frete-hora-partida"
                  type="time"
                  value={form.horaPartida}
                  onChange={setField('horaPartida')}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Ida e volta */}
            <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.idaEVolta}
                onChange={setField('idaEVolta')}
                className="w-5 h-5 accent-amber-500"
              />
              <span className="text-sm font-bold text-stone-700 dark:text-stone-200">
                Com regresso (ida e volta)
              </span>
            </label>

            {form.idaEVolta && (
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label htmlFor="frete-data-regresso" className={labelClass}>
                    Data de regresso *
                  </label>
                  <input
                    id="frete-data-regresso"
                    type="date"
                    min={form.dataPartida || today}
                    value={form.dataRegresso}
                    onChange={setField('dataRegresso')}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="frete-hora-regresso" className={labelClass}>
                    Hora de regresso
                  </label>
                  <input
                    id="frete-hora-regresso"
                    type="time"
                    value={form.horaRegresso}
                    onChange={setField('horaRegresso')}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="frete-detalhes" className={labelClass}>
                Detalhes adicionais (opcional)
              </label>
              <textarea
                id="frete-detalhes"
                rows={3}
                value={form.detalhes}
                onChange={setField('detalhes')}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-colors resize-none"
                placeholder="Ex: evento de empresa, precisamos de 2 autocarros, bagagem extra..."
              />
            </div>

            {status === 'error' && (
              <div className="mb-5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 font-black text-stone-950 text-base shadow-lg hover:shadow-amber-500/40 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {status === 'sending' ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  A enviar...
                </>
              ) : (
                <>
                  Pedir orçamento
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>

            <p className="mt-4 text-center text-xs text-stone-500 dark:text-stone-400">
              Respondemos no máximo em 24 horas. Urgente? Liga{' '}
              <a href="tel:+244930533405" className="font-bold text-amber-600 hover:underline">
                +244 930 533 405
              </a>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
