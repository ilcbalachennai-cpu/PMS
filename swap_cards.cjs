const fs = require('fs');
let c = fs.readFileSync('components/Settings.tsx', 'utf8');

const purgeBlock = `                            {/* Deep Reset Card */}
                            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-pink-900/20 text-pink-500 rounded-lg group-hover:scale-110 transition-transform">
                                            <ShieldAlert size={18} />
                                        </div>
                                        <h5 className="text-xs font-black text-pink-400 uppercase tracking-tighter">PURGE COMPANY</h5>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Permanently <span className="text-pink-500 font-bold underline underline-offset-2">REMOVE</span> the organization <span className="text-white font-bold">{companyProfile.establishmentName}</span> <span className="text-blue-400 font-mono">({activeCompanyId})</span>. Click <span className="text-pink-500 font-black">Initiate Purge</span> to choose between removing the company from the registry list only or completely deleting its physical data folder from disk.</p>
                                </div>
                                <button
                                    onClick={() => requireAuth(() => { setShowResetModal(true); setResetMode('DEEP'); setResetPassword(''); setResetError(''); })}
                                    className="mt-4 py-2.5 px-4 bg-pink-900/20 hover:bg-pink-600 text-pink-500 hover:text-white border border-pink-900/50 hover:border-pink-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Initiate Purge
                                </button>
                            </div>`;

const factoryBlock = `                            {/* Factory Reset Card */}
                            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-red-900/20 text-red-500 rounded-lg group-hover:scale-110 transition-transform">
                                            <Trash2 size={18} />
                                        </div>
                                        <h5 className="text-xs font-black text-red-400 uppercase tracking-tighter">Factory Reset - full reset</h5>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Perform a full <span className="text-red-500 font-bold underline underline-offset-2">Wipe-Out</span> of ALL data across ALL companies, identities, and settings. Used for system decommissioning.</p>
                                </div>
                                <button
                                    onClick={() => requireAuth(() => { setShowResetModal(true); setResetMode('FACTORY'); setResetPassword(''); setResetError(''); })}
                                    className="mt-4 py-2.5 px-4 bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 hover:border-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Initiate Factory Reset
                                </button>
                            </div>`;

const rescueBlock = `                            {/* Organization Rescue Card */}
                            <div className="p-5 rounded-2xl border border-emerald-900/30 bg-emerald-900/5 hover:bg-emerald-900/10 transition-colors flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-emerald-900/20 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                                            <FolderOpen size={18} />
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-black text-white uppercase tracking-tighter">Organization Rescue & Recovery</h5>
                                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">Data Re-linking</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">"Lost an organization after an update? This tool scans your storage for orphaned data folders and re-links them to your registry."</p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (onRescueOrganizations) {
                                            showAlert('confirm', 'Start Rescue Operation?', 'The system will scan for unlinked company folders. Found items will be added back to your organization list.', () => {
                                                onRescueOrganizations();
                                            });
                                        }
                                    }}
                                    className="mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={14} /> Scan & Rescue Orphans
                                </button>
                            </div>`;


const oldRegex = /\{\/\* Deep Reset Card \*\/\}[\s\S]*?Scan & Rescue Orphans\s*<\/button>\s*<\/div>/;

const newString = [rescueBlock, factoryBlock, purgeBlock].join('\n\n');

c = c.replace(oldRegex, newString);

// Also need to fix the PURG COMPANY text in the modal header
c = c.replace(/'PURG COMPANY'/g, "'PURGE COMPANY'");

fs.writeFileSync('components/Settings.tsx', c);
console.log('Successfully swapped cards and fixed typo');
