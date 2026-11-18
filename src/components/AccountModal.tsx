import React, { useState } from 'react';
import {
  Car,
  Check,
  LogOut,
  Plus,
  ShieldCheck,
  Star,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { DriverAccount } from '../types/driver';

interface AccountModalProps {
  accounts: DriverAccount[];
  activeAccount: DriverAccount | null;
  isSignedOutGate?: boolean;
  onSelectAccount: (accountId: string) => void;
  onSignInCredentials: (email: string, password: string) => { ok: boolean; error?: string };
  onRegisterAccount: (payload: {
    name: string;
    email: string;
    password: string;
    city: string;
    vehicle: string;
    licensePlate: string;
    phvBadge: string;
  }) => { ok: boolean; error?: string };
  onSignOut: () => void;
  onClose?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  accounts,
  activeAccount,
  isSignedOutGate = false,
  onSelectAccount,
  onSignInCredentials,
  onRegisterAccount,
  onSignOut,
  onClose,
}) => {
  const [mode, setMode] = useState<'list' | 'signin' | 'register'>(
    isSignedOutGate ? 'signin' : 'list'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('London');
  const [vehicle, setVehicle] = useState('2024 Hyundai Ioniq 5');
  const [licensePlate, setLicensePlate] = useState('LN24 EVU');
  const [phvBadge, setPhvBadge] = useState('TfL-PHV-91204');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = onSignInCredentials(email.trim(), password);
    if (!res.ok) {
      setErrorMsg(res.error || 'Invalid email or password');
    } else {
      onClose?.();
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim() || !email.trim() || password.length < 4) {
      setErrorMsg('Enter your full name, valid email, and a password (4+ chars).');
      return;
    }
    const res = onRegisterAccount({
      name: name.trim(),
      email: email.trim(),
      password,
      city: city.trim() || 'London',
      vehicle: vehicle.trim() || '2024 Toyota Corolla Hybrid',
      licensePlate: licensePlate.trim().toUpperCase() || 'UK24 DRV',
      phvBadge: phvBadge.trim().toUpperCase() || 'UK-PHV-10294',
    });
    if (!res.ok) {
      setErrorMsg(res.error || 'Could not create driver account.');
    } else {
      onClose?.();
    }
  };

  const content = (
    <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[92vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[20px] font-extrabold text-black dark:text-white">
            {isSignedOutGate ? 'Uber Driver UK Sign In' : 'Driver Accounts'}
          </h3>
          <p className="text-[12.5px] text-[#545454] dark:text-neutral-400">
            Separate profile, vehicle, ledger & face verification per driver
          </p>
        </div>
        {!isSignedOutGate && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center shrink-0"
            aria-label="Close accounts"
          >
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        )}
      </div>

      {/* Segmented Mode Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F3F3F3] dark:bg-white/10 mb-4">
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setMode('list');
          }}
          className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors ${
            mode === 'list'
              ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
              : 'text-[#545454] dark:text-neutral-400'
          }`}
        >
          Saved ({accounts.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setMode('signin');
          }}
          className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors ${
            mode === 'signin'
              ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
              : 'text-[#545454] dark:text-neutral-400'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setMode('register');
          }}
          className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors ${
            mode === 'register'
              ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
              : 'text-[#545454] dark:text-neutral-400'
          }`}
        >
          New Driver
        </button>
      </div>

      {errorMsg && (
        <div className="mb-3 p-3 rounded-xl bg-[#FEECEB] dark:bg-red-950/50 text-[#E11900] dark:text-red-300 text-[12.5px] font-semibold">
          {errorMsg}
        </div>
      )}

      {mode === 'list' && (
        <div className="space-y-2.5">
          {accounts.map((acct) => {
            const isCurrent = activeAccount?.id === acct.id;
            return (
              <button
                key={acct.id}
                type="button"
                onClick={() => {
                  onSelectAccount(acct.id);
                  onClose?.();
                }}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                  isCurrent
                    ? 'border-black dark:border-[#276EF1] bg-[#FAFAFA] dark:bg-[#1D2230]'
                    : 'border-[#E6E6E6] dark:border-white/10 hover:bg-[#FAFAFA] dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-black dark:bg-[#276EF1] text-white flex items-center justify-center shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-bold text-black dark:text-white truncate">
                        {acct.name}
                      </p>
                      {acct.lastFaceVerifiedAt && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[#05944F] shrink-0" />
                      )}
                    </div>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate">
                      {acct.city} · {acct.vehicle} ({acct.licensePlate})
                    </p>
                    <p className="text-[11.5px] text-[#757575] dark:text-neutral-500 flex items-center gap-1.5 mt-0.5 tabular-nums">
                      <Star className="w-3 h-3 fill-current" />
                      {acct.rating.toFixed(2)} · {acct.tier} · {acct.phvBadge}
                    </p>
                  </div>
                </div>
                {isCurrent ? (
                  <span className="w-7 h-7 rounded-full bg-[#05944F] text-white flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </span>
                ) : (
                  <span className="text-[12px] font-bold text-[#276EF1] shrink-0">
                    Switch
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMode('register')}
            className="w-full h-11 rounded-xl border border-dashed border-black/20 dark:border-white/20 text-[13.5px] font-bold text-black dark:text-white hover:bg-[#F6F6F6] dark:hover:bg-white/5 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New UK Driver Account
          </button>

          {activeAccount && !isSignedOutGate && (
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose?.();
              }}
              className="w-full h-11 rounded-xl bg-[#FEECEB] dark:bg-red-950/40 hover:bg-[#FDD8D5] text-[#E11900] dark:text-red-300 text-[13.5px] font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out ({activeAccount.name})
            </button>
          )}
        </div>
      )}

      {mode === 'signin' && (
        <form onSubmit={handleSignInSubmit} className="space-y-3">
          <div>
            <label className="block text-[12px] font-bold text-[#545454] dark:text-neutral-300 mb-1">
              Driver Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex.rivera@uberuk.demo"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[14px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#545454] dark:text-neutral-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[14px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
            />
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-white text-[15px] font-bold transition-colors"
          >
            Sign In to Driver Account
          </button>

          <div className="pt-2 border-t border-[#EEEEEE] dark:border-white/10">
            <p className="text-[11.5px] font-semibold text-[#757575] dark:text-neutral-400 mb-2">
              Quick 1-Tap Demo Sign In:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {accounts.slice(0, 2).map((acct) => (
                <button
                  key={acct.id}
                  type="button"
                  onClick={() => {
                    onSelectAccount(acct.id);
                    onClose?.();
                  }}
                  className="p-2.5 rounded-xl bg-[#F6F6F6] dark:bg-white/10 hover:bg-[#EAEAEA] dark:hover:bg-white/15 text-left"
                >
                  <p className="text-[13px] font-bold text-black dark:text-white truncate">
                    {acct.name}
                  </p>
                  <p className="text-[11px] text-[#545454] dark:text-neutral-400 truncate">
                    {acct.city} · {acct.tier}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </form>
      )}

      {mode === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11.5px] font-bold text-[#545454] dark:text-neutral-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Hughes"
                className="w-full h-10 px-3 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[13.5px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-[#545454] dark:text-neutral-300 mb-1">
                UK City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="London"
                className="w-full h-10 px-3 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[13.5px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-[#545454] dark:text-neutral-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan.hughes@driver.co.uk"
              className="w-full h-10 px-3 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[13.5px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-[#545454] dark:text-neutral-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create password"
              className="w-full h-10 px-3 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[13.5px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
            />
          </div>

          <div className="p-3 rounded-2xl bg-[#F6F6F6] dark:bg-white/5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-black dark:text-white">
              <Car className="w-4 h-4 text-[#276EF1]" />
              <span>Vehicle & PHV Licence</span>
            </div>
            <input
              type="text"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Vehicle make & model"
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-white/10 text-[13px] text-black dark:text-white border border-black/5 dark:border-white/10 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="UK Plate"
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-white/10 text-[13px] text-black dark:text-white border border-black/5 dark:border-white/10 focus:outline-none uppercase"
              />
              <input
                type="text"
                value={phvBadge}
                onChange={(e) => setPhvBadge(e.target.value)}
                placeholder="PHV Badge #"
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-white/10 text-[13px] text-black dark:text-white border border-black/5 dark:border-white/10 focus:outline-none uppercase"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[15px] font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Create UK Driver Account
          </button>
        </form>
      )}
    </div>
  );

  if (isSignedOutGate) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F6F6F6] dark:bg-[#0B0C0E] flex flex-col items-center justify-center p-4">
        <div className="mb-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-black dark:bg-[#276EF1] text-white font-extrabold text-[18px] flex items-center justify-center mx-auto mb-2 shadow-lg">
            Uber
          </div>
          <p className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400">
            United Kingdom · Private Hire Partner
          </p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {content}
    </div>
  );
};
