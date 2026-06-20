import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomSelect } from '../components/ui/Select';
import { useNavigate } from 'react-router-dom';
import { Key, ArrowRight, ShieldCheck, Sparkles, Building, Mail, User, Info } from 'lucide-react';

export function AuthPage() {
  const { login, signup, error, setError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<'Founder' | 'Accountant' | 'Viewer'>('Founder');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePreFill = (roleType: 'Founder' | 'Accountant' | 'Viewer') => {
    setError(null);
    if (roleType === 'Founder') {
      setEmail('arjun@vriddhicapital.com');
      setName('Arjun Sharma');
      setCompanyName('Vriddhi AI Ltd');
      setRole('Founder');
    } else if (roleType === 'Accountant') {
      setEmail('sanjana@vriddhicapital.com');
      setName('Sanjana Iyer');
      setCompanyName('Vriddhi AI Ltd');
      setRole('Accountant');
    } else {
      setEmail('neha@vriddhicapital.com');
      setName('Neha Patil');
      setCompanyName('Vriddhi AI Ltd');
      setRole('Viewer');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        // If email isn't in database, we automatically sign them up with pre-filled default data to keep it robust and prevent errors.
        try {
          await login(email, 'password123', role);
        } catch (err: any) {
          if (err.message.includes("User not found") || err.message.includes("No account found")) {
            // Auto signup to prevent blocker!
            const defaultName = email.split('@')[0];
            const cleanName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
            await signup(email, cleanName, 'My Startup Pvt Ltd', role);
          } else {
            throw err;
          }
        }
      } else {
        await signup(email, name, companyName, role);
      }
      navigate('/app');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background neon green glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#22C55E]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 bg-gradient-to-tr from-[#22C55E] to-black border border-[#22C55E]/20 rounded-2xl items-center justify-center font-bold text-white text-xl shadow-xl shadow-[#22C55E]/10 mb-2">V</div>
          <h2 className="text-3xl font-heading font-extrabold tracking-tight">
            Vriddhi<span className="text-[#22C55E]">.Ai</span>
          </h2>
          <p className="text-zinc-400 text-sm">
            AI-powered financial operating system & GST invoicing
          </p>
        </div>

        {/* Quick Demo Login Buttons for Judges */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 backdrop-blur-xl">
          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mb-3 text-center">Quick Demo Access (Pre-filled Credentials)</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { handlePreFill('Founder'); setIsLogin(true); }}
              className="bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] rounded-xl py-2.5 px-2 text-[10px] font-bold hover:bg-[#22C55E]/20 transition-all cursor-pointer"
            >
              <span className="block text-xs font-extrabold">Founder</span>
              <span className="text-zinc-400 text-[9px]">Full Admin</span>
            </button>
            <button
              onClick={() => { handlePreFill('Accountant'); setIsLogin(true); }}
              className="bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl py-2.5 px-2 text-[10px] font-bold hover:bg-blue-500/20 transition-all cursor-pointer"
            >
              <span className="block text-xs font-extrabold">Accountant</span>
              <span className="text-zinc-400 text-[9px]">Read/Write</span>
            </button>
            <button
              onClick={() => { handlePreFill('Viewer'); setIsLogin(true); }}
              className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl py-2.5 px-2 text-[10px] font-bold hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <span className="block text-xs font-extrabold">Viewer</span>
              <span className="text-zinc-400 text-[9px]">Read-Only</span>
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Form Switcher */}
          <div className="flex bg-black rounded-xl p-1 mb-6 border border-zinc-800">
            <button
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                isLogin ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                !isLogin ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Register Workspace
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-2">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Arjun Sharma"
                      className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:ring-1 focus:ring-[#22C55E] focus:border-[#22C55E] outline-none text-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Company / Entity Name</label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme FinTech Pvt Ltd"
                      className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:ring-1 focus:ring-[#22C55E] focus:border-[#22C55E] outline-none text-white transition-all"
                    />
                  </div>
                </div>

              </>
            )}

            <div>
              <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Select Access Role</label>
              <CustomSelect
                value={role}
                onChange={(value) => setRole(value as any)}
                options={[
                  { value: 'Founder', label: 'Founder (Full Admin Access)' },
                  { value: 'Accountant', label: 'Accountant (Add/Edit Permitted)' },
                  { value: 'Viewer', label: 'Viewer (Read-Only Mode)' }
                ]}
                darkAuthMode={true}
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Corporate Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. arjun@vriddhicapital.com"
                  className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:ring-1 focus:ring-[#22C55E] focus:border-[#22C55E] outline-none text-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  defaultValue="password123"
                  placeholder="••••••••"
                  className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:ring-1 focus:ring-[#22C55E] focus:border-[#22C55E] outline-none text-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#22C55E] text-black font-bold py-3.5 rounded-xl text-xs hover:opacity-90 shadow-lg shadow-[#22C55E]/10 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isLogin ? 'Sign In Securely' : 'Generate Workspace'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
