import React, { useState } from 'react';
import {
  BookmarkCheck,
  Car,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  LogOut,
  Plus,
  ShieldCheck,
  Star,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { DriverAccount } from '../types/driver';
import { RememberedLogin } from '../utils/authStorage';

interface AccountModalProps {
  accounts: DriverAccount[];
  activeAccount: DriverAccount | null;
  rememberedLogin?: RememberedLogin | null;
  isSignedOutGate?: boolean;
  onSelectAccount: (accountId: string, rememberMe?: boolean) => void;
  onSignInCredentials: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => { ok: boolean; error?: string };
  onRegisterAccount: (payload: {
    name: string;
    email: string;
    password: string;
    city: string;
    vehicle: string;
    licensePlate: string;
    phvBadge: string;
    rememberMe?: boolean;
  }) => { ok: boolean; error?: string };
  onExportBackupCode?: (account: DriverAccount) => string;
  onRestoreBackupCode?: (code: string) => { ok: boolean; error?: string };
  onSignOut: () => void;
  onClose?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  accounts,
  activeAccount,
  rememberedLogin = null,
  isSignedOutGate = false,
  onSelectAccount,
  onSignInCredentials,
  onRegisterAccount,
  onExportBackupCode,
  onRestoreBackupCode,
  onSignOut,
  onClose,
}) => {
  const {
    user: googleUser,
    authLoading,
    authError,
    syncStatus,
    signInWithGoogle,
    signOutGoogle,
    clearAuthError,
  } = useFirebase();
  const [mode, setMode] = useState<'list' | 'signin' | 'register'>(
    isSignedOutGate ? 'signin' : 'list'
  );
  const [email, setEmail] = useState(() => (isSignedOutGate && rememberedLogin?.email) || '');
  const [password, setPassword] = useState(
    () => (isSignedOutGate && rememberedLogin?.password) || ''
  );
  const [rememberMe, setRememberMe] = useState<boolean>(
    () => rememberedLogin?.rememberMe ?? true
  );
  const [name, setName] = useState('');
  const [city, setCity] = useState('London');
  const [vehicle, setVehicle] = useState('2024 Hyundai Ioniq 5');
  const [licensePlate, setLicensePlate] = useState('LN24 EVU');
  const [phvBadge, setPhvBadge] = useState('TfL-PHV-91204');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backupCopied, setBackupCopied] = useState(false);
  const [generatedBackupCode, setGeneratedBackupCode] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');

  const handleGoogleSyncClick = async () => {
    clearAuthError();
    setErrorMsg(null);
    const signedUser = await signInWithGoogle();
    if (signedUser && isSignedOutGate) {
      onClose?.();
    }
  };

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = onSignInCredentials(email.trim(), password, rememberMe);
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
      rememberMe,
    });
    if (!res.ok) {
      setErrorMsg(res.error || 'Could not create driver account.');
    } else {
      onClose?.();
    }
  };

  const handleCopyBackup = async () => {
    if (!activeAccount || !onExportBackupCode) return;
    const code = onExportBackupCode(activeAccount);
    setGeneratedBackupCode(code);
    try {
      await navigator.clipboard.writeText(code);
      setBackupCopied(true);
      setTimeout(() => setBackupCopied(false), 2400);
    } catch {
      try {
        const tmp = document.createElement('textarea');
        tmp.value = code;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
        setBackupCopied(true);
        setTimeout(() => setBackupCopied(false), 2400);
      } catch {
        setErrorMsg('Select and copy the UBR1 key shown below.');
      }
    }
  };

  const handleRestoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!onRestoreBackupCode) return;
    const res = onRestoreBackupCode(restoreCode);
    if (!res.ok) {
      setErrorMsg(res.error || 'Invalid backup code.');
    } else {
      setRestoreCode('');
      setRestoreOpen(false);
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
            Remembered on this device · Separate profile, vehicle & ledger
          </p>
        </div>
        {!isSignedOutGate && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center shrink-0"
            aria-label="Close accounts"
          >
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        )}
      </div>

      {/* Google Cloud Sync Card */}
      <div className="mb-4 p-3.5 rounded-2xl border border-[#276EF1]/25 bg-[#F4F8FF] dark:bg-[#161F33] space-y-2.5">
        {googleUser ? (
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google Driver'}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-black/10"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#276EF1] text-white flex items-center justify-center shrink-0">
                  <Cloud className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13.5px] font-bold text-black dark:text-white truncate">
                    {googleUser.displayName || 'Google Driver Sync'}
                  </p>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      syncStatus === 'error'
                        ? 'bg-[#FEECEB] text-[#E11900]'
                        : 'bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F]'
                    }`}
                  >
                    {syncStatus === 'syncing'
                      ? 'Syncing…'
                      : syncStatus === 'error'
                      ? 'Sync Retry'
                      : 'Cloud Synced'}
                  </span>
                </div>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate">
                  {googleUser.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void signOutGoogle()}
              className="px-2.5 h-8 rounded-lg bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[11.5px] font-bold text-[#E11900] dark:text-red-300 hover:bg-[#FEECEB] shrink-0"
            >
              Unlink
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CloudOff className="w-4 h-4 text-[#276EF1] shrink-0" />
                <span className="text-[13px] font-bold text-black dark:text-white truncate">
                  Cloud Sync & Cross-Device Profile
                </span>
              </div>
              <span className="text-[10.5px] font-bold text-[#276EF1] shrink-0">Firestore</span>
            </div>
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void handleGoogleSyncClick()}
              className="w-full h-10 rounded-xl bg-white dark:bg-[#22242A] border border-black/15 dark:border-white/15 hover:bg-[#F3F3F3] dark:hover:bg-[#2B2E36] text-[13.5px] font-bold text-black dark:text-white flex items-center justify-center gap-2 shadow-2xs transition-colors disabled:opacity-60"
            >
              <span className="w-4 h-4 rounded-full bg-[#276EF1] text-white text-[10px] font-extrabold flex items-center justify-center">
                G
              </span>
              <span>{authLoading ? 'Connecting Google...' : 'Continue with Google (Cloud Sync)'}</span>
            </button>
          </>
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
          className={`min-h-[40px] rounded-lg text-[12.5px] font-bold transition-colors ${
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
          className={`min-h-[40px] rounded-lg text-[12.5px] font-bold transition-colors ${
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
          className={`min-h-[40px] rounded-lg text-[12.5px] font-bold transition-colors ${
            mode === 'register'
              ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
              : 'text-[#545454] dark:text-neutral-400'
          }`}
        >
          New Driver
        </button>
      </div>

      {(errorMsg || authError) && (
        <div className="mb-3 p-3 rounded-xl bg-[#FEECEB] dark:bg-red-950/50 text-[#E11900] dark:text-red-300 text-[12.5px] font-semibold">
          {errorMsg || authError}
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
                  onSelectAccount(acct.id, rememberMe);
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
            className="w-full min-h-[44px] rounded-xl border border-dashed border-black/20 dark:border-white/20 text-[13.5px] font-bold text-black dark:text-white hover:bg-[#F6F6F6] dark:hover:bg-white/5 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New UK Driver Account
          </button>

          {/* Device Remembrance & Cross-Device Backup Transfer */}
          <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-[#1B1D22] border border-[#E6E6E6] dark:border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BookmarkCheck className="w-4 h-4 text-[#05944F] shrink-0" />
                <span className="text-[12.5px] font-bold text-black dark:text-white truncate">
                  Account Remembrance & Transfer
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRestoreOpen((v) => !v)}
                className="text-[12px] font-bold text-[#276EF1] hover:underline shrink-0"
              >
                {restoreOpen ? 'Hide Restore' : 'Restore Code'}
              </button>
            </div>
            <p className="text-[11.5px] text-[#545454] dark:text-neutral-400">
              Your profile and ledger stay saved automatically on this device. Copy a backup key to move to another device or APK install.
            </p>
            {activeAccount && onExportBackupCode && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCopyBackup}
                  className="w-full min-h-[40px] rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[12.5px] font-bold text-black dark:text-white flex items-center justify-center gap-1.5 hover:bg-[#F3F3F3] dark:hover:bg-white/15 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{backupCopied ? 'Backup Key Copied!' : `Copy Backup Key (${activeAccount.name.split(' ')[0]})`}</span>
                </button>
                {generatedBackupCode && (
                  <input
                    type="text"
                    readOnly
                    value={generatedBackupCode}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-black/30 border border-black/10 dark:border-white/15 text-[11px] font-mono text-[#545454] dark:text-neutral-300 select-all"
                  />
                )}
              </div>
            )}
            {restoreOpen && onRestoreBackupCode && (
              <form onSubmit={handleRestoreSubmit} className="space-y-2 pt-1">
                <input
                  type="text"
                  value={restoreCode}
                  onChange={(e) => setRestoreCode(e.target.value)}
                  placeholder="Paste UBR1:... backup key"
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-black/30 border border-black/10 dark:border-white/15 text-[12.5px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
                />
                <button
                  type="submit"
                  className="w-full min-h-[40px] rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Restore Saved Driver</span>
                </button>
              </form>
            )}
          </div>

          {activeAccount && !isSignedOutGate && (
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose?.();
              }}
              className="w-full min-h-[44px] rounded-xl bg-[#FEECEB] dark:bg-red-950/40 hover:bg-[#FDD8D5] text-[#E11900] dark:text-red-300 text-[13.5px] font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out ({activeAccount.name})
            </button>
          )}
        </div>
      )}

      {mode === 'signin' && (
        <form onSubmit={handleSignInSubmit} className="space-y-3">
          {rememberedLogin && rememberedLogin.rememberMe && (
            <button
              type="button"
              onClick={() => {
                onSelectAccount(rememberedLogin.accountId, true);
                onClose?.();
              }}
              className="w-full p-3.5 rounded-2xl bg-[#F4F8FF] dark:bg-[#192338] border border-[#276EF1]/30 flex items-center justify-between gap-3 text-left hover:bg-[#EAF1FE] dark:hover:bg-[#1F2C45] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#276EF1] text-white flex items-center justify-center shrink-0">
                  <BookmarkCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-black dark:text-white truncate">
                    Continue as {rememberedLogin.name}
                  </p>
                  <p className="text-[12px] text-[#545454] dark:text-neutral-300 truncate">
                    {rememberedLogin.email} · {rememberedLogin.city}
                  </p>
                </div>
              </div>
              <span className="text-[12px] font-bold text-[#276EF1] shrink-0">Resume</span>
            </button>
          )}

          <div>
            <label className="block text-[12px] font-bold text-[#545454] dark:text-neutral-300 mb-1">
              Driver Email
            </label>
            <input
              type="email"
              name="email"
              autoComplete="email"
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
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[14px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
            />
          </div>

          <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-[#276EF1]"
            />
            <span className="text-[13px] font-semibold text-black dark:text-white">
              Remember my account & stay signed in
            </span>
          </label>

          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-white text-[15px] font-bold transition-colors"
          >
            Sign In to Driver Account
          </button>

          <div className="pt-2 border-t border-[#EEEEEE] dark:border-white/10">
            <p className="text-[11.5px] font-semibold text-[#757575] dark:text-neutral-400 mb-2">
              Quick 1-Tap Saved Accounts:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {accounts.slice(0, 4).map((acct) => (
                <button
                  key={acct.id}
                  type="button"
                  onClick={() => {
                    onSelectAccount(acct.id, rememberMe);
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
                name="name"
                autoComplete="name"
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
              name="email"
              autoComplete="email"
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
              name="password"
              autoComplete="new-password"
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

          <label className="flex items-center gap-2.5 py-0.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-[#276EF1]"
            />
            <span className="text-[12.5px] font-semibold text-black dark:text-white">
              Remember account on this device
            </span>
          </label>

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
