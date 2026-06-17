import sys
import re

with open('d:/ILCBala/PMS/App.tsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

blocker_ui = '''<div className="flex-1 flex flex-col items-center justify-center text-rose-500 bg-slate-950 p-10 text-center"><AlertTriangle size={64} className="mb-6 opacity-80" /><h2 className="text-3xl font-black uppercase tracking-widest mb-2">Access Denied</h2><p className="text-slate-400 max-w-md">Your license has expired. Data entry and processing are locked. You can only generate previously confirmed reports.</p></div>'''

views_to_block = ['Utilities', 'AIAssistant']
for view in views_to_block:
    if view == 'Utilities':
        app_content = re.sub(
            r'\{activeView === View\.Utilities && <Utilities.*?/>\}',
            f'{{activeView === View.Utilities && (isLicenseExpired ? {blocker_ui} : <Utilities designations={{designations}} setDesignations={{setDesignations}} divisions={{divisions}} setDivisions={{setDivisions}} branches={{branches}} setBranches={{setBranches}} sites={{sites}} setSites={{setSites}} showAlert={{showAlert}} />)}}',
            app_content
        )
    elif view == 'AIAssistant':
        app_content = re.sub(
            r'\{activeView === View\.AI_Assistant && <AIAssistant />\}',
            f'{{activeView === View.AI_Assistant && (isLicenseExpired ? {blocker_ui} : <AIAssistant />)}}',
            app_content
        )

with open('d:/ILCBala/PMS/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_content)
