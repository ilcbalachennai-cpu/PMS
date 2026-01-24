
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { IndianRupee, Users, Building, ShieldCheck, TrendingUp, Database } from 'lucide-react';
import { Employee, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger, View } from '../types';
import { calculatePayroll } from '../services/payrollEngine';

interface DashboardProps {
  employees: Employee[];
  config: StatutoryConfig;
  attendances: Attendance[];
  leaveLedgers: LeaveLedger[];
  advanceLedgers: AdvanceLedger[];
  month: string;
  year: number;
  onNavigate: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ employees, config, attendances, leaveLedgers, advanceLedgers, month, year, onNavigate }) => {
  
  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] space-y-8 animate-in fade-in duration-700">
        <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
            <div className="relative p-8 bg-[#1e293b] rounded-full border border-slate-700 shadow-2xl">
                <Database size={64} className="text-slate-500" />
            </div>
        </div>
        
        <div className="text-center space-y-4 max-w-lg px-4">
            <h2 className="text-3xl font-black text-white tracking-tight">System Ready</h2>
            <div className="p-6 bg-[#1e293b]/50 border border-slate-800 rounded-xl shadow-xl backdrop-blur-sm">
                <p className="text-slate-300 text-lg font-medium leading-relaxed">
                    Data is empty. Go to <button onClick={() => onNavigate(View.Settings)} className="text-blue-400 font-bold bg-blue-900/20 px-2 py-0.5 rounded border border-blue-900/50 hover:bg-blue-900/40 hover:text-blue-300 transition-colors cursor-pointer inline-flex items-center gap-1">Configuration</button> section to import data, else start afresh.
                </p>
            </div>
        </div>
      </div>
    );
  }

  const payrollResults = employees.map(emp => {
    const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { employeeId: emp.id, month, year, presentDays: 31, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
    
    // SAFE ACCESS: Defaults for missing ledgers to prevent crash
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
  
  const totalGross = payrollResults.reduce((acc, curr) => acc + curr.earnings.total, 0);
  const totalEPF = payrollResults.reduce((acc, curr) => acc + curr.deductions.epf + curr.employerContributions.epf + curr.employerContributions.eps, 0);
  const totalLOP = payrollResults.reduce((acc, emp) => {
      const att = attendances.find(a => a.employeeId === emp.employeeId && a.month === month && a.year === year);
      return acc + (att ? att.lopDays : 0);
  }, 0);

  const stats = [
    { label: 'Total Payroll Cost', value: `₹${(totalGross/100000).toFixed(2)}L`, icon: IndianRupee, color: 'text-blue-400', bg: 'bg-blue-900/30' },
    { label: 'Active Employees', value: employees.length, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
    { label: 'EPF Pool', value: `₹${totalEPF.toLocaleString()}`, icon: Building, color: 'text-amber-400', bg: 'bg-amber-900/30' },
    { label: 'Total LOP Days', value: totalLOP, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-900/30' },
  ];

  const chartData = payrollResults.map(res => ({
    name: employees.find(e => e.id === res.employeeId)?.name.split(' ')[0],
    Net: res.netPay,
    Deductions: res.deductions.total,
  }));

  const pieData = [
    { name: 'EPF', value: totalEPF },
    { name: 'ESI', value: payrollResults.reduce((a,c) => a+c.deductions.esi, 0) },
    { name: 'PT/Tax', value: payrollResults.reduce((a,c) => a+c.deductions.pt + c.deductions.it, 0) },
    { name: 'Bonus/Prov', value: payrollResults.reduce((a,c) => a+c.earnings.bonus + c.gratuityAccrual, 0) },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      
      {/* Date Header for Dashboard */}
      <div className="flex items-center justify-between">
         <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Overview <span className="text-slate-500 text-sm font-normal">for {month} {year}</span>
         </h2>
      </div>

      {/* Stats Grid */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-lg">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Net Pay vs Deductions per Employee</h3>
          {/* Reduced height from h-64 to h-56 to make it very compact */}
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
