
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { IndianRupee, Users, Building, ShieldCheck, TrendingUp, Database, Calendar, Calculator, ArrowRight, ExternalLink, Sparkles } from 'lucide-react';
import { Employee, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger, View, CompanyProfile } from '../types';
import { calculatePayroll } from '../services/payrollEngine';

interface DashboardProps {
  employees: Employee[];
  config: StatutoryConfig;
  companyProfile: CompanyProfile;
  attendances: Attendance[];
  leaveLedgers: LeaveLedger[];
  advanceLedgers: AdvanceLedger[];
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  onNavigate: (view: View, tab?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ employees, config, companyProfile, attendances, leaveLedgers, advanceLedgers, month, year, setMonth, setYear, onNavigate }) => {
  
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const QuickLinks = ({ centered = false }: { centered?: boolean }) => (
    <div className={`grid grid-cols-1 ${centered ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'} gap-4 w-full`}>
         <button 
            onClick={() => onNavigate(View.PFCalculator)}
            className="col-span-1 bg-gradient-to-r from-blue-900/30 to-[#1e293b] p-4 rounded-xl border border-blue-800/30 flex items-center justify-between group hover:border-blue-500/50 transition-all shadow-lg cursor-pointer text-left"
         >
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-900/50 group-hover:scale-110 transition-transform">
                    <Calculator size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">PF ECR Calculator</h3>
                    <p className="text-[10px] text-blue-200/70">Generate Challan & Returns</p>
                </div>
            </div>
            <div className="p-2 bg-slate-800 rounded-full text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ArrowRight size={16} />
            </div>
         </button>

         <a 
            href={companyProfile.externalAppUrl || '#'} 
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-1 bg-gradient-to-r from-purple-900/30 to-[#1e293b] p-4 rounded-xl border border-purple-800/30 flex items-center justify-between group hover:border-purple-500/50 transition-all shadow-lg cursor-pointer text-left"
         >
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600 rounded-xl text-white shadow-lg shadow-purple-900/50 group-hover:scale-110 transition-transform">
                    <Sparkles size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">Launch AI Studio App</h3>
                    <p className="text-[10px] text-purple-200/70">External Comprehensive Calc</p>
                </div>
            </div>
            <div className="p-2 bg-slate-800 rounded-full text-slate-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <ExternalLink size={16} />
            </div>
         </a> 
    </div>
  );

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] space-y-8 animate-in fade-in duration-700 py-10">
        <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
            <div className="relative p-8 bg-[#1e293b] rounded-full border border-slate-700 shadow-2xl">
                <Database size={64} className="text-slate-500" />
            </div>
        </div>
        
        <div className="text-center space-y-4 max-w-xl px-4">
            <h2 className="text-3xl font-black text-white tracking-tight">System Ready</h2>
            <div className="p-6 bg-[#1e293b]/50 border border-slate-800 rounded-xl shadow-xl backdrop-blur-sm">
                <div className="text-slate-300 text-lg font-medium leading-relaxed">
                    Data is empty. Go to Data Management under <button onClick={() => onNavigate(View.Settings, 'DATA')} className="text-blue-400 font-bold hover:text-blue-300 border-b border-blue-500/50 hover:border-blue-400 transition-colors inline-block cursor-pointer">Configuration</button> section to restore Data else <button onClick={() => onNavigate(View.Employees)} className="text-emerald-400 font-bold hover:text-emerald-300 border-b border-emerald-500/50 hover:border-emerald-400 transition-colors inline-block cursor-pointer">start afresh</button>.
                </div>
            </div>
        </div>

        <div className="w-full flex flex-col items-center gap-4 mt-8 pt-8 border-t border-slate-800/50">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quick Access Tools</h3>
            <QuickLinks centered={true} />
        </div>
      </div>
    );
  }

  const payrollResults = employees.map(emp => {
    const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { employeeId: emp.id, month, year, presentDays: 31, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
    const leave = leaveLedgers.find(l => l.employeeId === emp.id) || {
      employeeId: emp.id,
      el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
      sl: { eligible: 0, availed: 0, balance: 0 },
      cl: { availed: 0, accumulation: 0, balance: 0 }
    };
    const advance = advanceLedgers.find(a => a.employeeId === emp.id) || {
      employeeId: emp.id,
      opening: 0,
      totalAdvance: 0,
      monthlyInstallment: 0,
      paidAmount: 0,
      balance: 0
    };
    
    return calculatePayroll(emp, config, att, leave, advance, month, year);
  });
  
  const totalGross = payrollResults.reduce((acc, curr) => acc + (curr?.earnings?.total || 0), 0);
  const totalEPF = payrollResults.reduce((acc, curr) => acc + (curr?.deductions?.epf || 0) + (curr?.employerContributions?.epf || 0) + (curr?.employerContributions?.eps || 0), 0);
  const totalLOP = payrollResults.reduce((acc, emp) => {
      const att = attendances.find(a => a.employeeId === emp.employeeId && a.month === month && a.year === year);
      return acc + (att ? att.lopDays : 0);
  }, 0);

  const stats = [
    { label: 'Total Payroll Cost', value: `₹${(totalGross/100000).toFixed(2)}L`, icon: IndianRupee, color: 'text-blue-400', bg: 'bg-blue-900/30' },
    { label: 'Total Employees Enrolled', value: employees.length, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
    { label: 'EPF Pool', value: `₹${totalEPF.toLocaleString()}`, icon: Building, color: 'text-amber-400', bg: 'bg-amber-900/30' },
    { label: 'Total LOP Days', value: totalLOP, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-900/30' },
  ];

  const chartData = payrollResults.map(res => ({
    name: employees.find(e => e.id === res.employeeId)?.name.split(' ')[0] || 'Emp',
    Net: res?.netPay || 0,
    Deductions: res?.deductions?.total || 0,
  }));

  const pieData = [
    { name: 'EPF', value: totalEPF },
    { name: 'ESI', value: payrollResults.reduce((a,c) => a + (c?.deductions?.esi || 0), 0) },
    { name: 'PT/Tax', value: payrollResults.reduce((a,c) => a + (c?.deductions?.pt || 0) + (c?.deductions?.it || 0), 0) },
    { name: 'Bonus/Prov', value: payrollResults.reduce((a,c) => a + (c?.earnings?.bonus || 0) + (c?.gratuityAccrual || 0), 0) },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Overview <span className="text-slate-500 text-sm font-normal">for {month} {year}</span>
         </h2>
         <div className="flex items-center gap-2">
             <div className="flex items-center gap-2 bg-[#1e293b] p-1 rounded-lg border border-slate-700">
                 <select 
                    value={month} 
                    onChange={e => setMonth(e.target.value)} 
                    className="bg-[#0f172a] border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none font-bold"
                 >
                    {months.map(m => (<option key={m} value={m}>{m}</option>))}
                 </select>
                 <select 
                    value={year} 
                    onChange={e => setYear(+e.target.value)} 
                    className="bg-[#0f172a] border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none font-bold"
                 >
                    {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                 </select>
                 <div className="px-2 text-slate-500">
                     <Calendar size={14} />
                 </div>
             </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-[#1e293b] p-4 rounded-xl border border-slate-800 shadow-lg hover:bg-slate-800/80 transition-all">
            <div className="flex items-center gap-3">
              <div className={`${stat.bg} ${stat.color} p-2.5 rounded-lg border border-white/5`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-lg font-black text-white">{stat.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      <QuickLinks />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-lg">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Net Pay vs Deductions per Employee</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#334155' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="Net" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar dataKey="Deductions" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-lg">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Statutory Breakdown</h3>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                  itemStyle={{ color: '#ffffff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] px-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                  <span className="text-slate-400 font-medium">{d.name}</span>
                </div>
                <span className="font-bold text-white">₹{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
