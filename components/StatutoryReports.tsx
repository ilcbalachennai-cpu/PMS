import React, { useMemo, useState, useEffect } from 'react';
import { ShieldCheck, Landmark, X, FileText, AlertTriangle, CheckCircle, BookOpen, ScrollText, ReceiptText, Info } from 'lucide-react';
import { PayrollResult, Employee, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, ArrearBatch } from '../types';
import { INDIAN_STATES } from '../constants';
import {
    generatePFECR,
    generateArrearECRText,
    generateArrearECRExcel,
    generatePFForm12A,
    generateESIReturn,
    generateESIChallanPDF,
    generateESIForm5,
    generateESIExitReport,
    generateJoinedEmployeesReport,
    generateLeftEmployeesReport,
    generateJoinedEmployeesPDF,
    generateEmployeesLeftPDF,
    generatePTReport,
    generateTDSReport,
    generateGratuityReport,
    generateBonusReport,
    generateFormB,
    generateFormC,
    generateFormI,
    generateFormIV,
    generateFormIX,
    generateStateWageRegister,
    generateStatePaySlip,
    generateStateAdvanceRegister,
    getStandardFileName,
    openSavedReport,
    generatePFForm3A,
    generatePFForm6A,
    generateConsolidatedPTReport,
    generateConsolidatedTDSReport,
    generateConsolidatedBonusReport,
    generateConsolidatedGratuityReport,
    generateLWFReport,
    generateConsolidatedLWFReport,
    generateContractorMappingText,
    generateContractorMappingPDF,
    generatePrincipalMappingText,
    generatePrincipalMappingPDF,
    generateESIIPMappingText,
    generateESIIPMappingPDF
} from '../services/reportService';

const isWin7 = /Windows NT 6.1/.test(window.navigator.userAgent);

const CALENDAR_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface StatutoryReportsProps {
    payrollHistory: PayrollResult[];
    employees: Employee[];
    config: StatutoryConfig;
    companyProfile: CompanyProfile;
    globalMonth: string;
    setGlobalMonth: (m: string) => void;
    globalYear: number;
    setGlobalYear: (y: number) => void;
    attendances?: Attendance[];
    leaveLedgers?: LeaveLedger[];
    advanceLedgers?: AdvanceLedger[];
    arrearHistory?: ArrearBatch[];
    latestFrozenPeriod: { month: string; year: number } | null;
    showAlert: any;
    activeFinancialYear?: string;
}

const STATE_FORM_MAPPINGS: Record<string, { wage: string; slip: string; advance: string }> = {
    'Tamil Nadu': { wage: 'Form R - Wage Register', slip: 'Form T - Wage Slip', advance: 'Form P - Advances' },
    'Karnataka': { wage: 'Form T - Wage Register', slip: 'Form V - Wage Slip', advance: 'Form XXII - Advances' },
    'Maharashtra': { wage: 'Form II - Wage Register', slip: 'Form III - Wage Slip', advance: 'Form IV - Advances' },
    'Andhra Pradesh': { wage: 'Form XXIII - Wage Register', slip: 'Form XXIV - Wage Slip', advance: 'Form XXII - Advances' },
    'Telangana': { wage: 'Form XXIII - Wage Register', slip: 'Form XXIV - Wage Slip', advance: 'Form XXII - Advances' },
    'West Bengal': { wage: 'Form J - Register of Wages', slip: 'Form H - Pay Slip', advance: 'Form M - Advances' },
    'Default': { wage: 'Wage Register', slip: 'Pay Slip', advance: 'Advance Register' }
};

const StatutoryReports: React.FC<StatutoryReportsProps> = ({
    payrollHistory,
    employees,
    config,
    companyProfile,
    globalMonth,
    setGlobalMonth,
    globalYear,
    setGlobalYear,
    attendances = [],
    advanceLedgers = [],
    arrearHistory = [],
    showAlert: _showAlert,
    latestFrozenPeriod,
    activeFinancialYear
}) => {
    const monthsArr = useMemo(() => ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'], []);

    const selectableMonths = useMemo(() => {
        if (payrollHistory.length === 0) return monthsArr;
        const unique = Array.from(new Set(payrollHistory.map(r => r.month)));
        return unique.sort((a, b) => monthsArr.indexOf(a) - monthsArr.indexOf(b));
    }, [payrollHistory, monthsArr]);

    const [startYear, endYear] = useMemo(() => {
        if (!activeFinancialYear) return [new Date().getFullYear(), new Date().getFullYear()];
        const match = activeFinancialYear.match(/FY(\d{2})-(\d{2})/);
        if (match) {
            return [2000 + parseInt(match[1], 10), 2000 + parseInt(match[2], 10)];
        }
        return [new Date().getFullYear(), new Date().getFullYear()];
    }, [activeFinancialYear]);

    const yearOptions = useMemo(() => {
        if (payrollHistory.length === 0) {
            if (startYear === endYear) return [startYear];
            return [startYear, endYear];
        }
        const uniqueYears = Array.from(new Set(payrollHistory.map(r => r.year)));
        return uniqueYears.sort((a, b) => a - b);
    }, [payrollHistory, startYear, endYear]);

    useEffect(() => {
        if (latestFrozenPeriod) {
            setGlobalMonth(latestFrozenPeriod.month);
            setGlobalYear(latestFrozenPeriod.year);
        }
    }, []); // Initialize to latest frozen period on mount

    useEffect(() => {
        const isMonthValid = selectableMonths.length === 0 || selectableMonths.includes(globalMonth);
        const isYearValid = yearOptions.length === 0 || yearOptions.includes(globalYear);

        if (!isMonthValid || !isYearValid) {
            if (payrollHistory.length > 0) {
                const autoMonth = selectableMonths[0];
                const match = payrollHistory.find(r => r.month === autoMonth);
                if (match) {
                    setGlobalMonth(match.month);
                    setGlobalYear(match.year);
                }
            }
        }
    }, [selectableMonths, yearOptions, globalMonth, globalYear, payrollHistory, setGlobalMonth, setGlobalYear]);

    const handleMonthChange = (selectedMonth: string) => {
        setGlobalMonth(selectedMonth);
        const match = payrollHistory.find(r => r.month === selectedMonth);
        if (match) {
            setGlobalYear(match.year);
        } else {
            const isNextYear = ['January', 'February', 'March'].includes(selectedMonth);
            setGlobalYear(isNextYear ? endYear : startYear);
        }
    };

    const [selectedState, setSelectedState] = useState<string>(companyProfile.state || 'Tamil Nadu');
    const [rangeModal, setRangeModal] = useState({ isOpen: false, reportType: '', fromMonth: globalMonth, fromYear: globalYear, toMonth: globalMonth, toYear: globalYear });
    const [mappingModal, setMappingModal] = useState({ isOpen: false, type: 'Contractor' as 'Contractor' | 'Principal' | 'ESI', format: 'Text' as 'Text' | 'PDF', siteFilter: '', estCode: '', empType: 'Contract Employee' });
    const [msgModal, setMsgModal] = useState({ isOpen: false, title: '', message: '', type: 'error' as 'error' | 'success' | 'info', onConfirm: null as any });
    const uniqueSites = useMemo(() => 
        Array.from(new Set(employees.map(e => e.site).filter(Boolean)))
            .filter(site => site !== 'Contract Employee' && site !== 'Contractor Employee'),
        [employees]
    );

    const [taxReportMode, setTaxReportMode] = useState<'Month' | 'Period'>('Month');
    const [taxFromMonth, setTaxFromMonth] = useState(globalMonth);
    const [taxFromYear, setTaxFromYear] = useState(globalYear);
    const [taxToMonth, setTaxToMonth] = useState(globalMonth);
    const [taxToYear, setTaxToYear] = useState(globalYear);

    const currentForms = useMemo(() => STATE_FORM_MAPPINGS[selectedState] || STATE_FORM_MAPPINGS['Default'], [selectedState]);

    const isCurrentPeriodConfirmed = useMemo(() => {
        if (!latestFrozenPeriod) return false;
        const currentVal = (globalYear * 12) + CALENDAR_MONTHS.indexOf(globalMonth);
        const frozenVal = (latestFrozenPeriod.year * 12) + CALENDAR_MONTHS.indexOf(latestFrozenPeriod.month);
        return currentVal <= frozenVal;
    }, [globalMonth, globalYear, latestFrozenPeriod]);

    // Sync tax period with global period when global period changes
    useEffect(() => {
        setTaxFromMonth(globalMonth);
        setTaxToMonth(globalMonth);
        setTaxFromYear(globalYear);
        setTaxToYear(globalYear);
    }, [globalMonth, globalYear]);

    const openRangeModal = (reportType: string) => {
        const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
        const startYear = isJanToMar ? globalYear - 1 : globalYear;
        setRangeModal({ isOpen: true, reportType, fromMonth: 'April', fromYear: startYear, toMonth: globalMonth, toYear: globalYear });
    };

    const handleDownload = async (reportName: string, format: 'PDF' | 'Excel' | 'Text') => {
        const isPeriodConfirmed = (m: string, y: number): boolean => {
            if (!latestFrozenPeriod) return false;
            const currentVal = (y * 12) + CALENDAR_MONTHS.indexOf(m);
            const frozenVal = (latestFrozenPeriod.year * 12) + CALENDAR_MONTHS.indexOf(latestFrozenPeriod.month);
            return currentVal <= frozenVal;
        };

        if (taxReportMode === 'Period' && ['PT Report', 'TDS Report', 'Gratuity', 'Bonus', 'LWF Report'].includes(reportName)) {
            if (!isPeriodConfirmed(taxToMonth, taxToYear)) {
                setMsgModal({ 
                    isOpen: true, 
                    title: 'Draft Period Blocked', 
                    message: `Consolidated statutory reports can only be generated up to frozen/confirmed periods. The target end period ${taxToMonth} ${taxToYear} is currently in draft (not finalized).`, 
                    type: 'error', 
                    onConfirm: null 
                });
                return;
            }
        } else {
            if (!isPeriodConfirmed(globalMonth, globalYear)) {
                setMsgModal({ 
                    isOpen: true, 
                    title: 'Draft Period Blocked', 
                    message: `Statutory reports can only be generated for frozen/confirmed periods. The period ${globalMonth} ${globalYear} is currently in draft (not finalized). Please finalize the payroll for this period first.`, 
                    type: 'error', 
                    onConfirm: null 
                });
                return;
            }
        }

        const currentData = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
        const fileName = getStandardFileName(reportName, companyProfile, globalMonth, globalYear);
        let savedPath: string | null = null;

        try {
            if (taxReportMode === 'Period' && ['PT Report', 'TDS Report', 'Gratuity', 'Bonus', 'LWF Report'].includes(reportName)) {
                if (reportName === 'PT Report') {
                    const hasPT = payrollHistory.some(r => (r.deductions?.pt || 0) > 0);
                    if (!hasPT) { _showAlert('error', 'No Data Available', 'There is no Professional Tax data for this period.'); return; }
                    savedPath = await generateConsolidatedPTReport(payrollHistory, employees, taxFromMonth, taxFromYear, taxToMonth, taxToYear, companyProfile, format as any);
                }
                else if (reportName === 'TDS Report') {
                    const hasTDS = payrollHistory.some(r => (r.deductions?.it || 0) > 0);
                    if (!hasTDS) { _showAlert('error', 'No Data Available', 'There is no TDS data for this period.'); return; }
                    savedPath = await generateConsolidatedTDSReport(payrollHistory, employees, taxFromMonth, taxFromYear, taxToMonth, taxToYear, companyProfile, format as any);
                }
                else if (reportName === 'Bonus') savedPath = await generateConsolidatedBonusReport(payrollHistory, employees, config, taxFromMonth, taxFromYear, taxToMonth, taxToYear, companyProfile, format as any);
                else if (reportName === 'Gratuity') savedPath = await generateConsolidatedGratuityReport(payrollHistory, employees, config, taxFromMonth, taxFromYear, taxToMonth, taxToYear, companyProfile);
                else if (reportName === 'LWF Report') {
                    const hasLWF = payrollHistory.some(r => (r.deductions?.lwf || 0) > 0 || (r.employerContributions?.lwf || 0) > 0);
                    if (!hasLWF) { _showAlert('error', 'No Data Available', 'There is no LWF data for this period.'); return; }
                    savedPath = await generateConsolidatedLWFReport(payrollHistory, employees, taxFromMonth, taxFromYear, taxToMonth, taxToYear, companyProfile, format as any);
                }
            } else {
                if (currentData.length === 0 && !['Employees Joined', 'Employees Left'].includes(reportName)) {
                    setMsgModal({ isOpen: true, title: 'No Data Found', message: `No payroll records found for ${globalMonth} ${globalYear}.`, type: 'error', onConfirm: null });
                    return;
                }
                if (reportName.includes('PF ECR')) {
                    const hasPFData = currentData.some(r => (r.deductions?.epf || 0) > 0 || (r.employerContributions?.epf || 0) > 0 || (r.employerContributions?.eps || 0) > 0);
                    if (!hasPFData) {
                        _showAlert('error', 'No Data Available', `There is no PF Contribution data for ${globalMonth} ${globalYear}.`);
                        return;
                    }
                    savedPath = await generatePFECR(currentData, employees, config, format as 'Excel' | 'Text', fileName, companyProfile);
                } else if (reportName === 'PF ECR Arrears') {
                    const batch = arrearHistory?.find(b => b.month === globalMonth && b.year === globalYear);
                    if (!batch) throw new Error(`No arrears processed for ${globalMonth} ${globalYear}`);
                    savedPath = format === 'Excel' ? await generateArrearECRExcel(batch, payrollHistory, employees, config, fileName, companyProfile) : await generateArrearECRText(batch, payrollHistory, employees, config, fileName, companyProfile);
                } else if (reportName === 'ESI Monthly' || reportName === 'ESI Challan') {
                    const hasESIData = currentData.some(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        return emp && !emp.isESIExempt && (r.deductions.esi > 0 || r.employerContributions.esi > 0);
                    });
                    if (!hasESIData) {
                        setMsgModal({ isOpen: true, title: 'Info', message: `There is no ESI Contribution data for ${globalMonth} ${globalYear}.`, type: 'info', onConfirm: null });
                        return;
                    }
                    if (reportName === 'ESI Monthly') {
                        savedPath = await generateESIReturn(currentData, employees, 'Excel', fileName, companyProfile, config);
                    } else {
                        savedPath = await generateESIChallanPDF(currentData, employees, config, companyProfile, globalMonth, globalYear, fileName);
                    }
                } else if (reportName.includes('Form 12A')) {
                    savedPath = await generatePFForm12A(currentData, employees, config, companyProfile, globalMonth, globalYear);
                } else if (reportName === 'Employees Joined') {
                    const monthIdx = CALENDAR_MONTHS.indexOf(globalMonth);
                    const hasData = employees.some(emp => emp.doj && new Date(emp.doj).getMonth() === monthIdx && new Date(emp.doj).getFullYear() === globalYear);
                    if (!hasData) {
                        setMsgModal({ isOpen: true, title: 'Info', message: `There are no Employees Joined During : ${globalMonth} , ${globalYear}`, type: 'info', onConfirm: null });
                        return;
                    }
                    savedPath = format === 'PDF' ? await generateJoinedEmployeesPDF(employees, globalMonth, globalYear, companyProfile, payrollHistory) : await generateJoinedEmployeesReport(employees, globalMonth, globalYear, companyProfile, payrollHistory);
                } else if (reportName === 'Employees Left') {
                    const monthIdx = CALENDAR_MONTHS.indexOf(globalMonth);
                    const hasData = employees.some(emp => emp.dol && new Date(emp.dol).getMonth() === monthIdx && new Date(emp.dol).getFullYear() === globalYear);
                    if (!hasData) {
                        setMsgModal({ isOpen: true, title: 'Info', message: `There are no Employees Left During : ${globalMonth} , ${globalYear}`, type: 'info', onConfirm: null });
                        return;
                    }
                    savedPath = format === 'PDF' ? await generateEmployeesLeftPDF(employees, globalMonth, globalYear, companyProfile) : await generateLeftEmployeesReport(employees, globalMonth, globalYear, companyProfile);
                } else if (reportName.includes('Gratuity')) {
                    savedPath = await generateGratuityReport(employees, companyProfile);
                } else if (reportName.includes('Bonus')) {
                    savedPath = await generateBonusReport(payrollHistory, employees, config, globalMonth, globalYear, globalMonth, globalYear, companyProfile, format as 'PDF' | 'Excel');
                } else if (reportName.includes('PT Report')) {
                    const hasPTData = currentData.some(r => (r.deductions?.pt || 0) > 0);
                    if (!hasPTData) {
                        _showAlert('error', 'No Data Available', `There is no Professional Tax data for ${globalMonth} ${globalYear}.`);
                        return;
                    }
                    savedPath = await generatePTReport(currentData, employees, fileName, companyProfile, globalMonth, globalYear, format as any);
                } else if (reportName.includes('TDS Report')) {
                    const hasTDSData = currentData.some(r => (r.deductions?.it || 0) > 0);
                    if (!hasTDSData) {
                        _showAlert('error', 'No Data Available', `There is no TDS data for ${globalMonth} ${globalYear}.`);
                        return;
                    }
                    savedPath = await generateTDSReport(currentData, employees, fileName, companyProfile, globalMonth, globalYear, format as any);
                } else if (reportName === 'LWF Report') {
                    const hasLWFData = currentData.some(r => (r.deductions?.lwf || 0) > 0 || (r.employerContributions?.lwf || 0) > 0);
                    if (!hasLWFData) {
                        _showAlert('error', 'No Data Available', `There is no LWF data for ${globalMonth} ${globalYear}.`);
                        return;
                    }
                    savedPath = await generateLWFReport(currentData, employees, fileName, companyProfile, format as any);
                } else if (reportName.includes('ESI Exit')) {
                    savedPath = await generateESIExitReport(currentData, employees, globalMonth, globalYear, companyProfile);
                } else if (reportName.includes('Form B')) {
                    savedPath = await generateFormB(currentData, employees, globalMonth, globalYear, companyProfile);
                } else if (reportName.includes('Form C')) {
                    savedPath = await generateFormC(currentData, employees, attendances, globalMonth, globalYear, companyProfile);
                } else if (reportName === 'Form I') {
                    savedPath = await generateFormI(currentData, employees, globalMonth, globalYear, companyProfile);
                } else if (reportName === 'Form IV') {
                    savedPath = await generateFormIV(currentData, employees, globalMonth, globalYear, companyProfile);
                } else if (reportName === 'Form IX') {
                    savedPath = await generateFormIX(currentData, employees, attendances, globalMonth, globalYear, companyProfile);
                } else if (reportName === 'Wage Register') {
                    savedPath = await generateStateWageRegister(currentData, employees, globalMonth, globalYear, companyProfile, selectedState, currentForms.wage);
                } else if (reportName === 'Wage Slip') {
                    savedPath = await generateStatePaySlip(currentData, employees, globalMonth, globalYear, companyProfile, selectedState, currentForms.slip);
                } else if (reportName === 'Advance Register') {
                    let hasAdvanceData = false;
                    currentData.forEach(r => {
                        const ledger = advanceLedgers?.find(a => a.employeeId === r.employeeId);
                        const recoveryThisMonth = r.deductions?.advanceRecovery || 0;
                        if (recoveryThisMonth > 0 || (ledger && ledger.totalAdvance > 0)) {
                            hasAdvanceData = true;
                        }
                    });
                    
                    if (!hasAdvanceData) {
                        _showAlert('error', 'No Data Available', 'There is no data for advance for the selected period.');
                        return;
                    }

                    savedPath = await generateStateAdvanceRegister(currentData, employees, advanceLedgers || [], globalMonth, globalYear, companyProfile, selectedState, currentForms.advance);
                } else if (reportName === 'PF 3A') {
                    savedPath = await generatePFForm3A(payrollHistory, employees, config, globalMonth, globalYear, globalMonth, globalYear, undefined, companyProfile);
                } else if (reportName === 'PF 6A') {
                    savedPath = await generatePFForm6A(payrollHistory, employees, config, globalMonth, globalYear, globalMonth, globalYear, companyProfile);
                }
            }

            if (savedPath) {
                _showAlert('success', 'Report Generated', `Saved as ${fileName}`, () => openSavedReport(savedPath), undefined, 'Open Report', undefined, undefined, 2);
            } else {
                const filename = (window as any).lastGeneratedFileName || 'the file';
                _showAlert('error', 'Generation Failed', `Similar file is already open, close "${filename}" to generate the new report`);
            }
        } catch (e: any) { setMsgModal({ isOpen: true, title: 'Error', message: e.message, type: 'error', onConfirm: null }); }
    };

    const handleGenerateRange = async () => {
        setRangeModal(p => ({ ...p, isOpen: false }));

        const isPeriodConfirmed = (m: string, y: number): boolean => {
            if (!latestFrozenPeriod) return false;
            const currentVal = (y * 12) + CALENDAR_MONTHS.indexOf(m);
            const frozenVal = (latestFrozenPeriod.year * 12) + CALENDAR_MONTHS.indexOf(latestFrozenPeriod.month);
            return currentVal <= frozenVal;
        };

        if (!isPeriodConfirmed(rangeModal.toMonth, rangeModal.toYear)) {
            setMsgModal({ 
                isOpen: true, 
                title: 'Draft Period Blocked', 
                message: `Range-based statutory reports can only be generated up to frozen/confirmed periods. The target end period ${rangeModal.toMonth} ${rangeModal.toYear} is currently in draft (not finalized).`, 
                type: 'error', 
                onConfirm: null 
            });
            return;
        }

        let savedPath: string | null = null;
        try {
            if (rangeModal.reportType === 'Form 5') {
                const season = rangeModal.fromMonth === 'April' ? 'Apr-Sep' : 'Oct-Mar';
                savedPath = await generateESIForm5(payrollHistory, employees, season as any, rangeModal.fromYear, companyProfile);
            } else if (rangeModal.reportType === 'Form 3A') {
                savedPath = await generatePFForm3A(payrollHistory, employees, config, rangeModal.fromMonth, rangeModal.fromYear, rangeModal.toMonth, rangeModal.toYear, undefined, companyProfile);
            } else if (rangeModal.reportType === 'Form 6A') {
                savedPath = await generatePFForm6A(payrollHistory, employees, config, rangeModal.fromMonth, rangeModal.fromYear, rangeModal.toMonth, rangeModal.toYear, companyProfile);
            }
            if (savedPath) {
                _showAlert('success', 'Range Report Generated', 'Saved to your reports folder.', () => openSavedReport(savedPath));
            } else {
                const filename = (window as any).lastGeneratedFileName || 'the file';
                _showAlert('error', 'Generation Failed', `Similar file is already open, close "${filename}" to generate the new report`);
            }
        } catch (err: any) { setMsgModal({ isOpen: true, title: 'Error', message: err.message, type: 'error', onConfirm: null }); }
    };

    const handleGenerateMapping = async () => {
        setMappingModal(p => ({ ...p, isOpen: false }));

        const isPeriodConfirmed = (m: string, y: number): boolean => {
            if (!latestFrozenPeriod) return false;
            const currentVal = (y * 12) + CALENDAR_MONTHS.indexOf(m);
            const frozenVal = (latestFrozenPeriod.year * 12) + CALENDAR_MONTHS.indexOf(latestFrozenPeriod.month);
            return currentVal <= frozenVal;
        };

        if (!isPeriodConfirmed(globalMonth, globalYear)) {
            setMsgModal({ 
                isOpen: true, 
                title: 'Draft Period Blocked', 
                message: `${mappingModal.type} Mapping can only be generated for frozen/confirmed periods. The period ${globalMonth} ${globalYear} is currently in draft (not finalized).`, 
                type: 'error', 
                onConfirm: null 
            });
            return;
        }

        try {
            const currentData = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
            let savedPath: string | null = null;
            if (mappingModal.type === 'Contractor') {
                if (mappingModal.format === 'PDF') {
                    savedPath = await generateContractorMappingPDF(currentData, employees, mappingModal.siteFilter, companyProfile, globalMonth, globalYear);
                } else {
                    savedPath = await generateContractorMappingText(currentData, employees, mappingModal.siteFilter, companyProfile, globalMonth, globalYear);
                }
            } else if (mappingModal.type === 'ESI') {
                if (mappingModal.format === 'PDF') {
                    savedPath = await generateESIIPMappingPDF(currentData, employees, mappingModal.siteFilter, mappingModal.estCode, mappingModal.empType, companyProfile, globalMonth, globalYear);
                } else {
                    savedPath = await generateESIIPMappingText(currentData, employees, mappingModal.siteFilter, mappingModal.estCode, mappingModal.empType, companyProfile, globalMonth, globalYear);
                }
            } else {
                if (mappingModal.format === 'PDF') {
                    savedPath = await generatePrincipalMappingPDF(currentData, employees, mappingModal.siteFilter, mappingModal.estCode, mappingModal.empType, companyProfile, globalMonth, globalYear);
                } else {
                    savedPath = await generatePrincipalMappingText(currentData, employees, mappingModal.siteFilter, mappingModal.estCode, mappingModal.empType, companyProfile, globalMonth, globalYear);
                }
            }
            if (savedPath) {
                const extension = mappingModal.format === 'PDF' ? 'pdf' : 'txt';
                const fileLabel = mappingModal.type === 'ESI' ? 'ESI IP Mapping' : `${mappingModal.type} Mapping`;
                const fileName = getStandardFileName(fileLabel.replace(/\s+/g, '_'), companyProfile, globalMonth, globalYear) + '.' + extension;
                _showAlert('success', `${mappingModal.type === 'ESI' ? 'ESI IP' : mappingModal.type} Mapping Generated`, `Saved as ${fileName}`, () => openSavedReport(savedPath), undefined, 'Open Report', undefined, undefined, 2);
                
                // Reset/clear modal fields and close
                setMappingModal({
                    isOpen: false,
                    type: 'Contractor',
                    format: 'Text',
                    siteFilter: '',
                    estCode: '',
                    empType: 'Contract Employee'
                });
            } else {
                const filename = (window as any).lastGeneratedFileName || 'the file';
                _showAlert('error', 'Generation Failed', `Similar file is already open, close "${filename}" to generate the new report`);
            }
        } catch (err: any) { setMsgModal({ isOpen: true, title: 'Error', message: err.message, type: 'error', onConfirm: null }); }
    };

    const ReportCard = ({ title, icon: Icon, color, reports, headerAction, subHeader }: { 
        title: string, 
        icon: any, 
        color: string, 
        reports: { label: string, action: (format?: any) => void, format?: string, textColor?: string }[], 
        headerAction?: React.ReactNode,
        subHeader?: React.ReactNode 
    }) => (
        <div className={`bg-[#1e293b] rounded-xl border border-slate-800 shadow-lg overflow-hidden group transition-all h-full ${isWin7 ? `hover:border-${color}-500/50` : 'hover:border-slate-700'}`}>
            <div className={`p-4 flex items-center justify-between border-b border-slate-800 ${isWin7 ? `bg-gradient-to-r from-[#0f172a] to-[#1e293b]` : 'bg-[#0f172a]'}`}>
                <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${isWin7 ? `bg-${color}-900/30 text-${color}-400 border border-${color}-400/20` : `bg-${color}-900/20 text-${color}-400`}`}><Icon size={18} /></div>
                    <h3 className={`uppercase font-bold text-xs tracking-widest text-${color}-400`}>{title}</h3>
                </div>
                {headerAction}
            </div>
            {subHeader && (
                <div className="px-4 py-2 border-b border-slate-800/50 bg-[#0f1728]/30 animate-in slide-in-from-top-2 duration-300">
                    {subHeader}
                </div>
            )}
            <div className="p-3 grid grid-cols-1 gap-2">
                {reports.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/50 transition-all text-left">
                        <span className={`text-[11px] font-bold ${r.textColor || 'text-slate-300'}`}>{r.label}</span>
                        <div className="flex gap-1.5">
                            {r.format === 'BOTH' ? (
                                <>
                                    <button onClick={() => r.action('Excel')} className="text-[9px] font-black text-slate-400 hover:text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 hover:border-slate-600 transition-colors" title="Download XLSX">XLSX</button>
                                    <button onClick={() => r.action('PDF')} className="text-[9px] font-black text-slate-400 hover:text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 hover:border-slate-600 transition-colors" title="Download PDF">PDF</button>
                                </>
                            ) : r.format === 'TXT_PDF' ? (
                                <>
                                    <button onClick={() => r.action('Text')} className="text-[9px] font-black text-slate-400 hover:text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 hover:border-slate-600 transition-colors" title="Download TXT">TXT</button>
                                    <button onClick={() => r.action('PDF')} className="text-[9px] font-black text-slate-400 hover:text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 hover:border-slate-600 transition-colors" title="Download PDF">PDF</button>
                                </>
                            ) : (
                                <button onClick={() => r.action()} className="text-[9px] font-black text-slate-400 hover:text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 hover:border-slate-600 transition-colors ">{r.format || 'PDF'}</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
            {/* Header / Filter Section */}
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
                        <ShieldCheck className="text-blue-400" size={28} /> Statutory Compliance
                    </h2>
                    <p className="text-slate-400 text-xs mt-1 font-medium">Official PF, ESI, and Labour Law Returns.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                        isCurrentPeriodConfirmed 
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isCurrentPeriodConfirmed ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                        {isCurrentPeriodConfirmed ? 'Frozen / Confirmed' : 'Draft Period'}
                    </div>
                    <select title="Select Month" value={globalMonth} onChange={e => handleMonthChange(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500">
                        {selectableMonths.map(m => (<option key={m} value={m}>{m}</option>))}
                    </select>
                    <select title="Select Year" value={globalYear} onChange={e => setGlobalYear(+e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500">
                        {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                </div>
            </div>

            {/* Main Compliance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ReportCard title="EPF & MP Act, 1952" icon={Landmark} color="blue" reports={[
                    { label: 'PF ECR (Electronic Challan Return)', action: () => handleDownload('PF ECR', 'Text'), format: 'TXT' },
                    { label: 'PF ECR (Excel Backup)', action: () => handleDownload('PF ECR', 'Excel'), format: 'XLSX' },
                    { label: 'PF ECR Arrear (Text Format)', action: () => handleDownload('PF ECR Arrears', 'Text'), format: 'TXT', textColor: 'text-amber-400' },
                    { label: 'PF ECR Arear ( Excel Backup)', action: () => handleDownload('PF ECR Arrears', 'Excel'), format: 'XLSX', textColor: 'text-amber-400' },
                    { label: 'Form 12A', action: () => handleDownload('Form 12A', 'PDF') },
                    { label: 'Form 3A', action: () => openRangeModal('Form 3A'), format: 'PDF' },
                    { label: 'Form 6A', action: () => openRangeModal('Form 6A'), format: 'PDF' },
                    { label: 'Contractor Mapping', action: (fmt) => setMappingModal(p => ({ ...p, isOpen: true, type: 'Contractor', format: fmt })), format: 'TXT_PDF', textColor: 'text-indigo-400' },
                    { label: 'Principal Employer Mapping', action: (fmt) => setMappingModal(p => ({ ...p, isOpen: true, type: 'Principal', format: fmt, empType: 'Contract Employee' })), format: 'TXT_PDF', textColor: 'text-indigo-400' }
                ]} />

                <ReportCard title="ESI Act, 1948" icon={ShieldCheck} color="pink" reports={[
                    { label: 'ESI Monthly Return', action: () => handleDownload('ESI Monthly', 'Excel'), format: 'XLSX' },
                    { label: 'ESI Monthly Contribution Challan', action: () => handleDownload('ESI Challan', 'PDF'), format: 'PDF' },
                    { label: 'Form 5 (Contribution)', action: () => openRangeModal('Form 5'), format: 'PDF' },
                    { label: 'ESI Exit/OoC IP', action: () => handleDownload('ESI Exit', 'Excel'), format: 'XLSX' },
                    { label: 'Employees Joined During the Month', action: (fmt) => handleDownload('Employees Joined', fmt), format: 'BOTH', textColor: 'text-sky-400' },
                    { label: 'Employees Left During the Month', action: (fmt) => handleDownload('Employees Left', fmt), format: 'BOTH', textColor: 'text-rose-400' },
                    { label: 'IP Mapping with Contractor/Principal Employer', action: (fmt) => setMappingModal({ isOpen: true, type: 'ESI', format: fmt, siteFilter: '', estCode: '', empType: companyProfile.establishmentName || '' }), format: 'TXT_PDF', textColor: 'text-indigo-400' }
                ]} />

                <ReportCard 
                    title="Taxes & Benefits" 
                    icon={FileText} 
                    color="amber" 
                    headerAction={
                        <div className="flex bg-slate-900/80 rounded-lg p-0.5 border border-slate-700 mx-1 shadow-inner">
                            {['Month', 'Period'].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setTaxReportMode(m as any)}
                                    className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-tighter transition-all ${taxReportMode === m ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    }
                    subHeader={taxReportMode === 'Period' ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">From:</span>
                                  <select title="From Month" value={taxFromMonth} onChange={e => setTaxFromMonth(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] font-bold text-slate-300 outline-none hover:border-slate-500 transition-colors">
                                    {selectableMonths.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
                                </select>
                                <select title="From Year" value={taxFromYear} onChange={e => setTaxFromYear(+e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] font-bold text-slate-300 outline-none hover:border-slate-500 transition-colors">
                                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="w-4 h-[1px] bg-slate-700"></div>
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">To:</span>
                                <select title="To Month" value={taxToMonth} onChange={e => setTaxToMonth(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] font-bold text-amber-500 outline-none hover:border-amber-500/50 transition-colors">
                                    {selectableMonths.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
                                </select>
                                <select title="To Year" value={taxToYear} onChange={e => setTaxToYear(+e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] font-bold text-amber-500 outline-none hover:border-amber-500/50 transition-colors">
                                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : null}
                    reports={[
                    { label: 'Professional Tax Report', action: (fmt) => handleDownload('PT Report', fmt), format: 'BOTH' },
                    { label: 'TDS (Income Tax) Report', action: (fmt) => handleDownload('TDS Report', fmt), format: 'BOTH' },
                    { label: 'Labour Welfare Fund', action: (fmt) => handleDownload('LWF Report', fmt), format: 'BOTH' },
                    { label: 'Gratuity Statement', action: (fmt) => handleDownload('Gratuity', fmt), format: 'BOTH', textColor: 'text-fuchsia-400' },
                    { label: 'Bonus Statement', action: (fmt) => handleDownload('Bonus', fmt), format: 'BOTH', textColor: 'text-lime-400' }
                ]} />
            </div>

            {/* Registers Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportCard title="Central Labour Registers" icon={BookOpen} color="emerald" reports={[
                    { label: 'Form I - Employee Register', action: () => handleDownload('Form I', 'PDF') },
                    { label: 'Form IX - Attendance Register', action: () => handleDownload('Form IX', 'PDF') },
                    { label: 'Form IV - Wages, Overtime, Advance, Fine & Damages', action: () => handleDownload('Form IV', 'PDF') },
                    { label: 'Form B - Register of Wages (Legacy)', action: () => handleDownload('Form B', 'PDF'), textColor: 'text-rose-400' },
                    { label: 'Form C - Muster Roll (Legacy)', action: () => handleDownload('Form C', 'PDF'), textColor: 'text-rose-400' }
                ]} />

                <ReportCard
                    title="State Labour Registers"
                    icon={ScrollText}
                    color="teal"
                    headerAction={
                        <select
                            title="Filter by State"
                            value={selectedState}
                            onChange={e => setSelectedState(e.target.value)}
                            className="bg-slate-900 border border-teal-500/30 text-teal-400 text-[10px] font-bold rounded px-1.5 py-0.5 outline-none"
                        >
                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    }
                    reports={[
                        { label: currentForms.wage, action: () => handleDownload('Wage Register', 'PDF') },
                        { label: currentForms.slip, action: () => handleDownload('Wage Slip', 'PDF') },
                        { label: currentForms.advance, action: () => handleDownload('Advance Register', 'PDF') }
                    ]}
                />
            </div>

            {rangeModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 p-8 shadow-2xl relative">
                        <button title="Close" onClick={() => setRangeModal(p => ({ ...p, isOpen: false }))} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <ReceiptText className="text-blue-500" size={24} /> Range: {rangeModal.reportType}
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <select title="From Month" value={rangeModal.fromMonth} onChange={e => setRangeModal(p => ({ ...p, fromMonth: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                    {selectableMonths.map(m => (<option key={m} value={m}>{m}</option>))}
                                </select>
                                <select title="From Year" value={rangeModal.fromYear} onChange={e => setRangeModal(p => ({ ...p, fromYear: +e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                    {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                                </select>
                            </div>
                            <div className="text-center text-[10px] font-black text-slate-600 uppercase tracking-widest">To</div>
                            <div className="grid grid-cols-2 gap-3">
                                <select title="To Month" value={rangeModal.toMonth} onChange={e => setRangeModal(p => ({ ...p, toMonth: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                    {selectableMonths.map(m => (<option key={m} value={m}>{m}</option>))}
                                </select>
                                <select title="To Year" value={rangeModal.toYear} onChange={e => setGlobalYear(+e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                    {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                                </select>
                            </div>
                        </div>
                        <button onClick={handleGenerateRange} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-6">Generate</button>
                    </div>
                </div>
            )}

            {msgModal.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-[#1e293b] max-w-sm w-full rounded-2xl border border-slate-700 p-8 text-center space-y-4 shadow-2xl">
                         <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                            msgModal.type === 'error' ? 'bg-red-950 text-red-500' : 
                            msgModal.type === 'info' ? 'bg-sky-950 text-sky-500' :
                            'bg-emerald-950 text-emerald-500'
                        }`}>
                            {msgModal.type === 'error' ? <AlertTriangle size={32} /> : 
                             msgModal.type === 'info' ? <Info size={32} /> :
                             <CheckCircle size={32} />}
                        </div>
                        <h3 className="text-lg font-bold text-white uppercase">{msgModal.title}</h3>
                        <p className="text-slate-400 text-sm">{msgModal.message}</p>
                        <button onClick={() => setMsgModal(p => ({ ...p, isOpen: false }))} className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all">Dismiss</button>
                    </div>
                </div>
            )}

            {mappingModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 p-8 shadow-2xl relative">
                        <button title="Close" onClick={() => setMappingModal(p => ({ ...p, isOpen: false, siteFilter: '', estCode: '', empType: 'Contract Employee' }))} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <ShieldCheck className="text-indigo-500" size={24} /> {mappingModal.type === 'ESI' ? 'ESI IP Mapping' : `${mappingModal.type} Mapping`}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Site of Deployment</label>
                                <select 
                                    title="Site"
                                    value={mappingModal.siteFilter} 
                                    onChange={e => {
                                        const site = e.target.value;
                                        setMappingModal(p => ({ ...p, siteFilter: site }));
                                    }} 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                >
                                    <option value="">-- All Sites --</option>
                                    {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            
                            {mappingModal.type === 'Principal' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Establishment Code (EST_CODE)</label>
                                        <input 
                                            type="text" 
                                            value={mappingModal.estCode} 
                                            onChange={e => setMappingModal(p => ({ ...p, estCode: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                            placeholder="e.g. TNMAS000000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Employee Type (EMP_TYPE)</label>
                                        <select 
                                            title="Employee Type"
                                            value={mappingModal.empType} 
                                            onChange={e => setMappingModal(p => ({ ...p, empType: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                        >
                                            <option value="Direct Employee">Direct Employee</option>
                                            <option value="Contract Employee">Contract Employee</option>
                                        </select>
                                    </div>
                                </>
                            )}
                            {mappingModal.type === 'ESI' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contractor Code (ContractorCode)</label>
                                        <input 
                                            type="text" 
                                            value={mappingModal.estCode} 
                                            onChange={e => setMappingModal(p => ({ ...p, estCode: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                            placeholder="e.g. Contractor Subcode"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contractor Name</label>
                                        <input 
                                            type="text" 
                                            value={mappingModal.empType} 
                                            onChange={e => setMappingModal(p => ({ ...p, empType: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                            placeholder="e.g. Company Name"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={handleGenerateMapping} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl mt-6 transition-colors">Generate Mapping File</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatutoryReports;
