import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, TrendingUp, Package, ShieldCheck, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { useLabelT } from '../../components/kit';

export const MOCK_MOBILE = '9078802278';

const STATS = [
  ['145', 'Mobile screens matched'],
  ['23', 'Inventory views'],
  ['91', 'Web routes'],
];

const FEATURES = [
  [TrendingUp, 'Registers, day book and drill-downs'],
  [Package, 'Stock across 23 inventory screens'],
  [ShieldCheck, 'GST, e-invoice and e-way bill'],
];

const OTP_LENGTH = 4;

export default function Login() {
  const lt = useLabelT();
  const navigate = useNavigate();
  const { login } = useAuth();
  // 'mobile' | 'otp' | 'pin' | 'resetotp' | 'newpin' | 'profile'
  const [step, setStep] = useState('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');             // OTP echoed by the API in non-production
  const [pin, setPin] = useState('');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [pendingSession, setPendingSession] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef(null);

  useEffect(() => {
    if (!resendIn) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => { if (step === 'otp') otpRef.current?.focus(); }, [step]);

  const cleanMobile = mobile.replace(/\D/g, '');

  const sendOtp = async e => {
    e?.preventDefault();
    setError('');
    if (cleanMobile.length !== 10) { setError(lt('Enter a valid 10-digit mobile number')); return; }
    setLoading(true);
    try {
      const res = await api.sendOtp(cleanMobile);
      if (res?.status === false) throw new Error(res?.message || lt('Failed to send OTP'));
      setDevOtp(res?.data?.otp ? String(res.data.otp) : '');
      setInfo(res?.message || lt('OTP sent to your WhatsApp number'));
      setOtp('');
      setStep('otp');
      setResendIn(30);
    } catch (err) {
      setError(err?.message || lt('Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  const verify = async e => {
    e?.preventDefault();
    setError('');
    if (otp.replace(/\D/g, '').length < OTP_LENGTH) { setError(lt('Enter the 4-digit OTP')); return; }
    setLoading(true);
    try {
      const forReset = step === 'resetotp';
      const res = await api.verifyOtp(cleanMobile, otp.trim(), '+91', forReset ? { reset_pin: true } : {});
      if (res?.status === false) throw new Error(res?.message || lt('Verification failed'));
      if (forReset) {
        setPreAuthToken(res?.data?.pre_auth_token || res?.data?.token);
        setPin('');
        setStep('newpin');
        setLoading(false);
        return;
      }
      if (res?.data?.requires2FA) {
        setPreAuthToken(res?.data?.pre_auth_token);
        setPin('');
        setStep('pin');
        setLoading(false);
        return;
      }
      await finishLogin(res?.data);
    } catch (err) {
      setError(err?.message || lt('Verification failed'));
    } finally {
      setLoading(false);
    }
  };

  // For new users, hold the session until the profile step is done — committing the
  // token to AuthContext immediately would redirect away from /login.
  const finishLogin = async (data) => {
    if (data?.isNewUser || !data?.user?.name) {
      setPendingSession({ token: data?.token, user: data?.user });
      setStep('profile');
      setLoading(false);
      return;
    }
    await login(data?.token, data?.user);
    navigate('/', { replace: true });
  };

  const submitPin = async e => {
    e?.preventDefault();
    setError('');
    if (pin.replace(/\D/g, '').length < 4) { setError(lt('Enter your 4-digit PIN')); return; }
    setLoading(true);
    try {
      const isReset = step === 'newpin';
      const res = isReset ? await api.resetPin(pin.trim(), preAuthToken) : await api.verifyPin(pin.trim(), preAuthToken);
      if (res?.status === false) throw new Error(res?.message || lt('Incorrect PIN'));
      await finishLogin(res?.data);
    } catch (err) {
      setError(err?.message || lt('PIN verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const startPinReset = async () => {
    setError(''); setInfo('');
    setLoading(true);
    try {
      const res = await api.sendOtp(cleanMobile);
      if (res?.status === false) throw new Error(res?.message || lt('Failed to send OTP'));
      setDevOtp(res?.data?.otp ? String(res.data.otp) : '');
      setInfo(lt('We sent a fresh OTP to verify it\u2019s you before resetting the PIN.'));
      setOtp('');
      setStep('resetotp');
      setResendIn(30);
    } catch (err) {
      setError(err?.message || lt('Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async e => {
    e?.preventDefault();
    setError('');
    if (!profile.name.trim()) { setError(lt('Please enter your name')); return; }
    setLoading(true);
    try {
      const res = await api.submitOnboardingWithToken(
        { name: profile.name.trim(), email: profile.email.trim(), language: 'English' },
        pendingSession?.token,
      );
      if (res?.status === false) throw new Error(res?.message || lt('Failed to save profile'));
      await login(pendingSession?.token, { ...pendingSession?.user, name: profile.name.trim() });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || lt('Failed to save profile'));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'h-12 w-full rounded-xl border border-line bg-cream px-4 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink focus:bg-surface';

  return (
    <div className="min-h-screen bg-paper p-4 lg:p-6" data-testid="login-page">
      <div className="grid min-h-[calc(100vh-3rem)] grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden rounded-3xl bg-ink p-12 lg:flex">
          <div className="flex items-center justify-between">
            <p className="display text-[20px] font-bold text-white">{lt('TallyDekho')}</p>
             <span className="rounded-md bg-white/10 px-3 py-1 text-[11px] text-white/70">{lt('Web portal')}</span>
          </div>

          <div>
            <h1 className="display text-[36px] font-bold leading-[1.02] text-white">
               {lt('Every ledger,')}<br />{lt('one calm view.')}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/55">
               {lt('Registers, stock, compliance and reports from Tally Prime — on a desktop surface built for accountants.')}
            </p>

            <div className="mt-9 space-y-3.5">
              {FEATURES.map(([Icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                    <Icon size={15} strokeWidth={1.75} className="text-white" />
                  </span>
                   <span className="text-[13px] text-white/65">{lt(text)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {STATS.map(([n, l]) => (
              <div key={l} className="rounded-2xl bg-white/[0.07] px-4 py-4">
                <p className="display text-[30px] font-bold leading-none text-white tabular">{n}</p>
                 <p className="mt-2 text-[11px] leading-tight text-white/45">{lt(l)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center rounded-3xl border border-line bg-surface px-6 py-12 sm:px-12">
          {step === 'pin' || step === 'newpin' ? (
            <form onSubmit={submitPin} className="rise w-full max-w-[380px]">
              <p className="display mb-8 text-[20px] font-bold text-ink lg:hidden">{lt('TallyDekho')}</p>
               <h2 className="display text-[36px] font-bold leading-none text-ink">{step === 'newpin' ? lt('Set a new PIN') : lt('Enter your PIN')}</h2>
              <p className="mt-3 text-[13px] text-ink-soft">
                {step === 'newpin'
                   ? lt('Choose a new 4-digit security PIN for your account.')
                   : lt('This account is protected with a security PIN (same PIN as the mobile app).')}
              </p>
              <div className="mt-8 space-y-4">
                <label className="block">
                   <span className="mb-2 block text-[11px] font-medium text-ink-soft">{step === 'newpin' ? lt('New 4-digit PIN') : lt('Security PIN')}</span>
                  <input
                    data-testid="login-pin-input"
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder="••••"
                    className={inputCls + ' text-center text-[18px] tracking-[0.5em] tabular'}
                  />
                </label>
                {error && <p data-testid="login-error" className="rounded-xl bg-neg-bg px-3.5 py-2.5 text-[13px] text-neg">{error}</p>}
                <button type="submit" data-testid="login-pin-submit" disabled={loading}
                  className="group flex h-12 w-full items-center justify-center gap-2.5 rounded-md bg-ink text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-[#2E2E2B] active:scale-[0.99] disabled:opacity-40">
                   {loading ? lt('Verifying…') : <>{step === 'newpin' ? lt('Save PIN & sign in') : lt('Unlock')} <ArrowRight size={15} strokeWidth={1.75} className="transition-transform group-hover:translate-x-1" /></>}
                </button>
                {step === 'pin' && (
                  <button type="button" data-testid="login-forgot-pin" disabled={loading} onClick={startPinReset}
                    className="h-9 w-full rounded-md text-[12px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40">
                     {lt('Forgot PIN? Reset with OTP')}
                  </button>
                )}
              </div>
            </form>
          ) : step === 'profile' ? (
            <form onSubmit={saveProfile} className="rise w-full max-w-[380px]">
              <p className="display mb-8 text-[20px] font-bold text-ink lg:hidden">{lt('TallyDekho')}</p>
               <h2 className="display text-[36px] font-bold leading-none text-ink">{lt('Welcome!')}</h2>
               <p className="mt-3 text-[13px] text-ink-soft">{lt('Tell us who you are — this appears on your profile and shared documents.')}</p>
              <div className="mt-8 space-y-4">
                <label className="block">
                   <span className="mb-2 block text-[11px] font-medium text-ink-soft">{lt('Your name')}</span>
                  <input data-testid="register-name-input" autoFocus type="text" maxLength={80} value={profile.name}
                    onChange={e => { setProfile(p => ({ ...p, name: e.target.value })); setError(''); }}
                     placeholder={lt('e.g. Yash Agarwal')} className={inputCls} />
                </label>
                <label className="block">
                   <span className="mb-2 block text-[11px] font-medium text-ink-soft">{lt('Email (optional)')}</span>
                  <input data-testid="register-email-input" type="email" maxLength={120} value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    placeholder={lt('you@business.com')} className={inputCls} />
                </label>
                {error && <p data-testid="login-error" className="rounded-xl bg-neg-bg px-3.5 py-2.5 text-[13px] text-neg">{error}</p>}
                <button type="submit" data-testid="register-submit" disabled={loading}
                  className="group flex h-12 w-full items-center justify-center gap-2.5 rounded-md bg-ink text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-[#2E2E2B] active:scale-[0.99] disabled:opacity-40">
                   {loading ? lt('Saving…') : <>{lt('Continue to dashboard')} <ArrowRight size={15} strokeWidth={1.75} className="transition-transform group-hover:translate-x-1" /></>}
                </button>
                <button type="button" data-testid="register-skip" disabled={loading}
                  onClick={async () => { await login(pendingSession?.token, pendingSession?.user); navigate('/', { replace: true }); }}
                  className="h-9 w-full rounded-md text-[12px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40">
                   {lt('Skip for now')}
                </button>
              </div>
            </form>
          ) : step === 'mobile' ? (
            <form onSubmit={sendOtp} className="rise w-full max-w-[380px]">
              <p className="display mb-8 text-[20px] font-bold text-ink lg:hidden">{lt('TallyDekho')}</p>

               <h2 className="display text-[36px] font-bold leading-none text-ink">{lt('Sign in')}</h2>
               <p className="mt-3 text-[13px] text-ink-soft">{lt("We'll send a one-time password to your WhatsApp.")}</p>

              <div className="mt-8 space-y-4">
                <label className="block">
                   <span className="mb-2 block text-[11px] font-medium text-ink-soft">{lt('Mobile number')}</span>
                  <div className="flex gap-2">
                    <span className="flex h-12 items-center rounded-xl border border-line bg-cream px-3.5 text-[13px] text-ink-soft tabular">+91</span>
                    <input
                      data-testid="login-mobile-input"
                      autoFocus
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      value={mobile}
                      onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                      placeholder="98765 43210"
                      className={inputCls + ' tabular'}
                    />
                  </div>
                </label>

                {error && <p data-testid="login-error" className="rounded-xl bg-neg-bg px-3.5 py-2.5 text-[13px] text-neg">{error}</p>}

                <button
                  type="submit"
                  data-testid="login-send-otp-button"
                  disabled={loading}
                  className="group flex h-12 w-full items-center justify-center gap-2.5 rounded-md bg-ink text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-[#2E2E2B] active:scale-[0.99] disabled:opacity-40"
                >
                   {loading ? lt('Sending OTP…') : <>{lt('Send OTP')} <ArrowRight size={15} strokeWidth={1.75} className="transition-transform group-hover:translate-x-1" /></>}
                </button>

                <div className="flex items-center gap-2.5 rounded-xl bg-cream/60 px-3.5 py-3">
                  <MessageCircle size={15} strokeWidth={1.75} className="shrink-0 text-pos" />
                   <p className="text-[12px] leading-snug text-ink-soft">{lt('Same login as the TallyDekho mobile app — your OTP arrives on WhatsApp.')}</p>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={verify} className="rise w-full max-w-[380px]">
              <p className="display mb-8 text-[20px] font-bold text-ink lg:hidden">{lt('TallyDekho')}</p>

               <h2 className="display text-[36px] font-bold leading-none text-ink">{lt('Enter OTP')}</h2>
              <p className="mt-3 text-[13px] text-ink-soft">
                 {lt('Sent to WhatsApp on')} <span className="font-medium text-ink tabular">+91 {cleanMobile}</span>
                <button
                  type="button"
                  data-testid="login-change-number-button"
                  onClick={() => { setStep('mobile'); setError(''); setInfo(''); }}
                  className="ml-2 inline-flex items-center gap-1 text-[12px] font-medium text-ink underline underline-offset-2 hover:opacity-70"
                >
                   <ArrowLeft size={11} strokeWidth={2} /> {lt('Change')}
                </button>
              </p>

              <div className="mt-8 space-y-4">
                <label className="block">
                   <span className="mb-2 block text-[11px] font-medium text-ink-soft">{lt('One-time password')}</span>
                  <input
                    ref={otpRef}
                    data-testid="login-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder="••••"
                    className={inputCls + ' text-center text-[18px] tracking-[0.5em] tabular'}
                  />
                </label>

                {info && !error && <p data-testid="login-info" className="rounded-xl bg-pos-bg px-3.5 py-2.5 text-[13px] text-pos">{info}</p>}
                {error && <p data-testid="login-error" className="rounded-xl bg-neg-bg px-3.5 py-2.5 text-[13px] text-neg">{error}</p>}

                <button
                  type="submit"
                  data-testid="login-verify-button"
                  disabled={loading}
                  className="group flex h-12 w-full items-center justify-center gap-2.5 rounded-md bg-ink text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-[#2E2E2B] active:scale-[0.99] disabled:opacity-40"
                >
                   {loading ? lt('Verifying…') : <>{lt('Verify & sign in')} <ArrowRight size={15} strokeWidth={1.75} className="transition-transform group-hover:translate-x-1" /></>}
                </button>

                <button
                  type="button"
                  data-testid="login-resend-button"
                  disabled={loading || resendIn > 0}
                  onClick={() => sendOtp()}
                  className="h-9 w-full rounded-md text-[12px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
                >
                   {resendIn > 0 ? <>{lt('Resend OTP in')} {resendIn}s</> : lt('Resend OTP')}
                </button>
              </div>

              {devOtp && (
                <div className="mt-8 rounded-2xl border border-line bg-cream/60 p-5" data-testid="login-dev-otp">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-pos-bg">
                      <Check size={11} strokeWidth={2.5} className="text-pos" />
                    </span>
                     <p className="text-[11px] font-medium text-ink">{lt('Development OTP (WhatsApp not configured)')}</p>
                  </div>
                  <p className="mt-3 text-[18px] font-bold tracking-[0.35em] text-ink tabular">{devOtp}</p>
                  <button
                    type="button"
                    data-testid="login-autofill-button"
                    onClick={() => { setOtp(devOtp); setError(''); }}
                    className="mt-4 h-9 rounded-md border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong"
                  >
                     {lt('Fill for me')}
                  </button>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
