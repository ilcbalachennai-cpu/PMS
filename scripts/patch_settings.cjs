const fs = require('fs');
const file = 'd:/ILCBala/PMS/components/Settings.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('APP_PATCH_TIMESTAMP')) {
    content = content.replace(
      /} from '\.\.\/services\/licenseService';/,
      ', APP_VERSION, APP_PATCH_TIMESTAMP } from \'../services/licenseService\';'
    );
}

const uiStr = `
                      {/* --- V05.02.10: Dev Diagnostic Timestamps --- */}
                      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl relative mt-8">
                          <div className="p-4 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-b border-slate-700/50 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                                      <Info size={20} />
                                  </div>
                                  <div>
                                      <h3 className="text-white font-black tracking-tight text-sm">App Patch Diagnostics</h3>
                                      <p className="text-[10px] text-slate-400">Live Timestamp Validation Variables</p>
                                  </div>
                              </div>
                          </div>
                          <div className="p-6">
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                      <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Compiled Executable Version</p>
                                      <p className="text-amber-400 font-mono font-bold">{APP_VERSION}</p>
                                  </div>
                                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                      <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Cloud App_Config Version</p>
                                      <p className="text-amber-400 font-mono font-bold">{localStorage.getItem('app_latest_version') || 'Unknown'}</p>
                                  </div>
                                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                      <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Compiled Baseline Timestamp</p>
                                      <p className="text-blue-400 font-mono font-bold">{APP_PATCH_TIMESTAMP}</p>
                                  </div>
                                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                      <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Local Active Timestamp (activeTs)</p>
                                      <p className="text-blue-400 font-mono font-bold">{localStorage.getItem('app_active_patch_ts') || 'Unknown'}</p>
                                  </div>
                                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 col-span-2">
                                      <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Cloud Live Timestamp (latestTs)</p>
                                      <p className="text-emerald-400 font-mono font-bold">{localStorage.getItem('app_latest_patch_timestamp') || 'Unknown'}</p>
                                  </div>
                              </div>
                              <p className="mt-4 text-[10px] text-slate-500 leading-relaxed text-center">
                                  For a patch to trigger, <strong className="text-slate-300">Cloud Live Timestamp</strong> must be strictly newer than <strong className="text-slate-300">Local Active Timestamp</strong>.<br/>
                                  Additionally, <strong className="text-slate-300">Compiled Executable Version</strong> must not be higher than <strong className="text-slate-300">Cloud App_Config Version</strong>.
                              </p>
                          </div>
                      </div>
`;

if (!content.includes('Dev Diagnostic Timestamps')) {
    content = content.replace(
      /{activeTab === 'DEVELOPER'/g,
      uiStr + '\n              {activeTab === \'DEVELOPER\''
    );
}

fs.writeFileSync(file, content);
console.log('Patch complete!');
