
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { IndianRupee, Users, Building, ShieldCheck, TrendingUp } from 'lucide-react';
import { Employee, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger } from '../types';
import { calculatePayroll } from '../services/payrollEngine';

interface DashboardProps {
  employees: Employee[];
  config: StatutoryConfig;
  attendances: Attendance[];
  leaveLedgers: LeaveLedger[];
  advanceLedgers: AdvanceLedger[];
  month: string;
  year: number;
}

const Dashboard: React.FC<DashboardProps> = ({ employees, config, attendances, leaveLedgers, advanceLedgers, month, year }) => {
  const payrollResults = employees.map(emp => {
    const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { employeeId: emp.id, month, year, presentDays: 31, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
    
    // SAFE ACCESS: Defaults for missing ledgers to prevent crash
    const leave = leaveLedgers.find(l => l.employeeId === emp.id) || {
      employeeId: emp.id,
      el: { opening: 0, eligible: 0, encashed: 0, balance: 0 },
      sl: { eligible: 0, availed: 0, balance: 0 },
      cl: { availed: 0, accumulation: 0, balance: 0 }
    };
    const advance = advanceLedgers.find(a => a.employeeId === emp.id) || {
      employeeId: emp.id,
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
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      
      {/* Date Header for Dashboard */}
      <div className="flex items-center justify-between">
         <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Overview <span className="text-slate-500 text-sm font-normal">for {month} {year}</span>
         </h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl hover:bg-slate-800/80 transition-all">
            <div className="flex items-center gap-4">
              <div className={`${stat.bg} ${stat.color} p-4 rounded-xl border border-white/5`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-2xl font-black text-white">{stat.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#1e293b] p-8 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Net Pay vs Deductions per Employee</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#334155' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#fff' }}
                />
                <Bar dataKey="Net" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="Deductions" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1e293b] p-8 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Statutory Breakdown</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#ffffff' }}
                  itemStyle={{ color: '#ffffff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 space-y-3">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
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
