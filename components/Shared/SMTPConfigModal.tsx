import React from 'react';
import { Mail, CheckCircle2, ShieldAlert, ArrowRight, ExternalLink } from 'lucide-react';

interface SMTPConfigModalProps {
  onClose: () => void;
}

const SMTPConfigModal: React.FC<SMTPConfigModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1e293b] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col max-h-[90vh]">
        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner border border-emerald-500/30">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">SMTP CONFIGURATION GUIDE</h2>
              <p className="text-xs font-medium text-slate-400 mt-1">How to setup Google App Passwords for Mail Access</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            ✖
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          
          <div className="bg-amber-900/20 border border-amber-900/50 rounded-xl p-4 flex gap-4 text-amber-200 text-sm">
            <ShieldAlert className="shrink-0 mt-0.5 text-amber-500" size={18} />
            <div>
              <strong className="block text-amber-500 mb-1">Important Notice:</strong>
              Google no longer allows signing in with just your primary password for 3rd-party apps. You must generate a dedicated <span className="font-bold underline decoration-amber-500/50">App Password</span> specifically to send mail through BharatPayPro. 
            </div>
          </div>

          <div className="space-y-6">
            <div className="relative pl-10">
              <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">1</div>
              <h3 className="font-bold text-white mb-2">Enable 2-Step Verification</h3>
              <p className="text-slate-400 text-sm">App Passwords are only available if 2-Step Verification is turned on for your Google Account.</p>
              <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-blue-400 text-xs font-bold hover:text-blue-300">
                Go to Google Security <ExternalLink size={12} />
              </a>
            </div>

            <div className="relative pl-10">
              <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">2</div>
              <h3 className="font-bold text-white mb-2">Generate App Password</h3>
              <div className="text-slate-400 text-sm space-y-2">
                <p>1. In Google Account settings, go to <strong className="text-slate-300">Security</strong>.</p>
                <p>2. Under "Signing in to Google", select <strong className="text-slate-300">App Passwords</strong> (you may need to search for it).</p>
                <p>3. At the bottom, click <strong>Select app</strong> and choose <strong>Other (Custom name)</strong>.</p>
                <p>4. Type "BharatPayPro" and click <strong>Generate</strong>.</p>
              </div>
            </div>

            <div className="relative pl-10">
              <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">3</div>
              <h3 className="font-bold text-white mb-2">Configure in App</h3>
              <p className="text-slate-400 text-sm mb-4">You will receive a 16-character code (e.g., <code className="bg-slate-900 px-2 py-1 rounded text-emerald-400">abcd efgh ijkl mnop</code>). Fill the settings in BharatPayPro exactly like this:</p>
              
              <div className="bg-[#0f172a] rounded-lg border border-slate-800 p-4 font-mono text-sm grid grid-cols-2 gap-x-4 gap-y-3">
                 <div className="text-slate-500 text-right">SMTP HOST :</div>
                 <div className="text-emerald-400">smtp.gmail.com</div>
                 <div className="text-slate-500 text-right">PORT :</div>
                 <div className="text-emerald-400">465</div>
                 <div className="text-slate-500 text-right">USER / EMAIL :</div>
                 <div className="text-emerald-400">your.email@gmail.com</div>
                 <div className="text-slate-500 text-right">PASSWORD :</div>
                 <div className="text-amber-400">abcdefghijklmnop <span className="text-slate-500 text-xs italic">(no spaces)</span></div>
              </div>
            </div>
          </div>

        </div>

        <div className="p-6 bg-[#0f172a] border-t border-slate-800 flex justify-end shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2">
            Understood <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SMTPConfigModal;
