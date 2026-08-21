'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

const initialForm = {
  name: '',
  primarySocialPlatform: '',
  socialProfile: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function AffiliateApplicationPage() {
  const [form, setForm] = useState(initialForm);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data?.user || null;
      setUser(currentUser);
    });
  }, []);

  const update = (field) => (event) => setForm((current) => ({
    ...current,
    [field]: event.target.value,
  }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!user && form.password !== form.confirmPassword) {
      setError('As palavras-passe nao coincidem.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/affiliate-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionData.session?.access_token
            ? { Authorization: `Bearer ${sessionData.session.access_token}` }
            : {}),
        },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Nao foi possivel enviar a candidatura.');
      setMessage('Candidatura recebida. A nossa equipa vai analisar e enviar o link do portal depois da aprovacao.');
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-12 text-white">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-amber-400/20 bg-stone-900 shadow-2xl md:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-gradient-to-br from-amber-400 to-orange-600 p-8 text-stone-950 md:p-12">
          <p className="text-sm font-black uppercase tracking-[0.25em]">NawaBus Afiliados</p>
          <h1 className="mt-5 text-4xl font-black leading-tight">Ganhe por cada passageiro que indicar.</h1>
          <p className="mt-5 text-lg leading-relaxed">
            Receba uma comissao por cada bilhete vendido com o seu codigo. O passageiro tambem recebe desconto.
          </p>
          <div className="mt-8 rounded-2xl bg-stone-950/90 p-5 text-white">
            <p className="font-bold">Como funciona</p>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Envie a candidatura, aguarde a aprovacao e receba o link do portal. La podera consultar o seu codigo, vendas, saldo e pagamentos.
            </p>
          </div>
        </section>

        <section className="p-8 md:p-12">
          <h2 className="text-2xl font-black">Candidatura</h2>
          <p className="mt-2 text-sm text-stone-400">
            {user ? 'Vamos usar a conta em que ja entrou.' : 'Crie as credenciais que usara no portal de afiliados.'}
          </p>

          <form onSubmit={submit} className="mt-8 grid gap-5 sm:grid-cols-2">
            <Field label="Nome completo" value={form.name} onChange={update('name')} placeholder="Ex.: Ana Manuel" autoComplete="name" className="sm:col-span-2" />
            <label className="grid gap-2 text-sm font-semibold">
              Rede social principal
              <select required value={form.primarySocialPlatform} onChange={update('primarySocialPlatform')} className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3">
                <option value="" disabled>Escolha uma rede social</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="youtube">YouTube</option>
                <option value="other">Outra</option>
              </select>
            </label>
            <Field label="Perfil ou nome na rede" value={form.socialProfile} onChange={update('socialProfile')} placeholder="Ex.: @seuperfil" />
            <Field label="Telefone" value={form.phone} onChange={update('phone')} type="tel" inputMode="tel" placeholder="Ex.: 923 000 000" autoComplete="tel" />
            <Field label="Email" value={form.email} onChange={update('email')} type="email" placeholder="Ex.: nome@email.com" autoComplete="email" />
            {!user && (
              <>
                <Field label="Palavra-passe" value={form.password} onChange={update('password')} type="password" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" />
                <Field label="Confirmar palavra-passe" value={form.confirmPassword} onChange={update('confirmPassword')} type="password" placeholder="Repita a palavra-passe" autoComplete="new-password" />
              </>
            )}
            {error && <p className="sm:col-span-2 rounded-xl bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
            {message && <p className="sm:col-span-2 rounded-xl bg-emerald-950/60 p-3 text-sm text-emerald-200">{message}</p>}
            <button disabled={loading || Boolean(message)} className="sm:col-span-2 rounded-xl bg-amber-400 px-5 py-3 font-black text-stone-950 transition hover:bg-amber-300 disabled:opacity-50">
              {loading ? 'A enviar...' : 'Enviar candidatura'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({ label, className = '', ...props }) {
  return (
    <label className={`grid gap-2 text-sm font-semibold ${className}`}>
      {label}
      <input required {...props} className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 outline-none transition focus:border-amber-400" />
    </label>
  );
}
