import * as XLSX from 'xlsx';
import { Employee, CompanyProfile } from '../types';
import { generateExcelReport, generateExcelWorkbook, generateTemplateWorkbook, generatePDFTableReport, getStandardFileName } from './reportService';

/**
 * Generates an Excel Template for Employee Import
 * If data is provided, it exports that data instead.
 */
export const generateEmployeeXLSX = async (data?: any[], company?: CompanyProfile) => {
    try {
        if (data && data.length > 0) {
            // Data Export
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Employees");

            // Construct filename with Trade Name and Current Month/Year
            const now = new Date();
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const fileName = getStandardFileName('Employee_Export', company || {} as any, months[now.getMonth()], now.getFullYear());
            await generateExcelWorkbook(wb, fileName);
            return;
        }

        // Template Download
        const templateHeaders = [
            "Employee ID", "Full Name", "Gender", "Date of Birth (DD-MM-YYYY)", "Designation",
            "Department/Division", "Branch", "Site", "Date of Joining (DD-MM-YYYY)",
            "Mobile Number", "Father or Spouse Name", "Relationship",
            "Married (Yes/No)", "Spouse Name", "Spouse Gender", "Spouse Aadhaar Number",
            "Door No", "Building Name", "Street", "Area", "City", "State", "Pincode",
            "PAN Number", "Aadhaar Number", "UAN Number", "PF Member ID", "ESI Number",
            "Bank Account Number", "Bank Name", "Bank Branch", "IFSC Code",
            "Basic Pay", "DA", "Retaining Allowance", "HRA", "Conveyance",
            "Washing Allowance", "Attire Allowance", "Special Allowance 1",
            "Special Allowance 2", "Special Allowance 3",
            "PF Exempt (Yes/No)", "ESI Exempt (Yes/No)",
            "Higher Pension Enabled (Yes/No)",
            "HP: Pre-2014 Contrib (Yes/No)",
            "HP: EPF Membership Date (DD-MM-YYYY)",
            "HP: EE Contrib (Regular/Higher)",
            "HP: ER Contrib (Regular/Higher)",
            "HP: Joint Option (Yes/No)",
            "Date of Leaving (DD-MM-YYYY)", "Reason for Leaving"
        ];

        const sampleRow = [
            "AUTO-GEN", "John Doe", "Male", "15-05-1990", "Software Engineer",
            "Engineering", "Chennai", "Main Plant", "01-01-2024",
            "9876543210", "Jane Doe", "Spouse",
            "Yes", "Jane Doe", "Female", "999988887777",
            "12A", "Sun Villa", "Main Road", "Guindy", "Chennai", "Tamil Nadu", "600032",
            "ABCDE1234F", "123456789012", "100234567890", "TN/MAS/0012345/000/0000101", "3112345678",
            "50100012345678", "HDFC Bank", "Adyar", "HDFC0000123",
            "15000", "5000", "0", "8000", "1600",
            "0", "0", "0", "0", "0",
            "No", "No",
            "No", "No", "", "Regular", "Regular", "No",
            "", ""
        ];

        const ws = XLSX.utils.aoa_to_sheet([templateHeaders, sampleRow]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "EmployeeMasterTemplate");
        await generateTemplateWorkbook(wb, "BharatPay_Employee_Master_Template");
    } catch (err: any) {
        console.error("Template/Export Error:", err);
        alert("Failed to process Excel file. Please check file permissions.");
    }
};

/**
 * Parses Employee XLSX data and validates against existing employees
 */
export const parseEmployeeXLSX = async (
    file: File,
    existingEmployees: Employee[],
    designations: string[],
    divisions: string[],
    branches: string[],
    sites: string[]
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert("No data found in the Excel sheet.");
                    resolve({ total: 0, success: 0, failed: 0, errors: [], successfulEmployees: [] });
                    return;
                }

                let currentMaxId = 0;
                existingEmployees.forEach(e => {
                    const match = e.id.match(/^EMP(\d+)$/i);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (!isNaN(num) && num > currentMaxId) currentMaxId = num;
                    }
                });

                const validNewEmployees: Employee[] = [];
                const rejectedRecords: { row: number; name: string; id: string; reason: string }[] = [];

                const existingUAN = new Set(existingEmployees.filter(e => e.uanc).map(e => String(e.uanc).trim()));
                const existingAadhaar = new Set(existingEmployees.filter(e => e.aadhaarNumber).map(e => String(e.aadhaarNumber).trim()));
                const existingPAN = new Set(existingEmployees.filter(e => e.pan).map(e => String(e.pan).trim().toLowerCase()));
                const existingESI = new Set(existingEmployees.filter(e => e.esiNumber).map(e => String(e.esiNumber).trim()));
                const existingPF = new Set(existingEmployees.filter(e => e.pfNumber).map(e => String(e.pfNumber).trim()));

                const batchUAN = new Set();
                const batchAadhaar = new Set();
                const batchPAN = new Set();
                const batchESI = new Set();
                const batchPF = new Set();

                const getEmptyForm = (): Partial<Employee> => ({
                    id: '', name: '', gender: 'Male', dob: '',
                    doj: new Date().toISOString().split('T')[0], dol: '', leavingReason: '',
                    designation: '', division: '', branch: '', site: '',
                    pan: '', aadhaarNumber: '', uanc: '', pfNumber: '', esiNumber: '',
                    fatherSpouseName: '', relationship: 'Father', maritalStatus: 'No', spouseName: '', spouseGender: '', spouseAadhaar: '',
                    doorNo: '', buildingName: '', street: '', area: '', city: '', state: 'Tamil Nadu', pincode: '',
                    mobile: '', bankAccount: '', bankName: '', bankBranch: '', ifsc: '',
                    basicPay: 0, da: 0, retainingAllowance: 0, hra: 0, conveyance: 0, washing: 0, attire: 0,
                    specialAllowance1: 0, specialAllowance2: 0, specialAllowance3: 0,
                    isPFExempt: false, isESIExempt: false, employeeVPFRate: 0, isPFHigherWages: false, isEmployerPFHigher: false,
                    epfMembershipDate: '', jointDeclaration: false,
                    pfHigherPension: {
                        enabled: false, contributedBefore2014: 'No', dojImpact: '',
                        employeeContribution: 'Regular', employerContribution: 'Regular', isHigherPensionOpted: 'No'
                    },
                    epsMaturityConfigured: false, isDeferredPension: false, deferredPensionOption: 'WithEPS',
                    photoUrl: '', employeeDocuments: {}, serviceRecords: []
                });

                data.forEach((row: any, rowIndex: number) => {
                    const rowNum = rowIndex + 2;
                    const getVal = (keys: string[]) => {
                        for (const k of keys) {
                            const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) return row[foundKey];
                        }
                        return null;
                    };

                    currentMaxId++;
                    const id = `EMP${String(currentMaxId).padStart(4, '0')}`;

                    const name = String(getVal(['Full Name', 'Name', 'Employee Name']) || '').trim();
                    if (!name || name === 'Unknown') {
                        rejectedRecords.push({ row: rowNum, name: 'Unknown', id: '', reason: "Missing 'Full Name'. Skipped." });
                        return;
                    }

                    const uan = String(getVal(['UAN Number', 'UAN', 'UAN No']) || '').trim();
                    const aadhaar = String(getVal(['Aadhaar Number', 'Aadhaar', 'Aadhaar No']) || '').trim();
                    const pan = String(getVal(['PAN Number', 'PAN', 'PAN No']) || '').trim().toLowerCase();
                    const esi = String(getVal(['ESI Number', 'ESI IP Number', 'ESI No']) || '').trim();
                    const pf = String(getVal(['PF Member ID', 'PF ID', 'PF Number']) || '').trim();

                    const duplicateReasons: string[] = [];
                    if (uan) { if (existingUAN.has(uan) || batchUAN.has(uan)) duplicateReasons.push(`Duplicate UAN (${uan})`); }
                    if (aadhaar) { if (existingAadhaar.has(aadhaar) || batchAadhaar.has(aadhaar)) duplicateReasons.push(`Duplicate Aadhaar (${aadhaar})`); }
                    if (pan) { if (existingPAN.has(pan) || batchPAN.has(pan)) duplicateReasons.push(`Duplicate PAN (${pan.toUpperCase()})`); }
                    if (esi) { if (existingESI.has(esi) || batchESI.has(esi)) duplicateReasons.push(`Duplicate ESI (${esi})`); }
                    if (pf) { if (existingPF.has(pf) || batchPF.has(pf)) duplicateReasons.push(`Duplicate PF (${pf})`); }

                    if (duplicateReasons.length > 0) {
                        rejectedRecords.push({ row: rowNum, name, id, reason: duplicateReasons.join(', ') });
                        currentMaxId--;
                        return;
                    }

                    if (uan) batchUAN.add(uan);
                    if (aadhaar) batchAadhaar.add(aadhaar);
                    if (pan) batchPAN.add(pan);
                    if (esi) batchESI.add(esi);
                    if (pf) batchPF.add(pf);

                    const parseIndDate = (val: any) => {
                        if (!val) return '';
                        if (val instanceof Date) {
                            const offset = val.getTimezoneOffset() * 60000;
                            const localDate = new Date(val.getTime() - offset);
                            return localDate.toISOString().split('T')[0];
                        }
                        const str = String(val).trim();
                        if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
                            const [d, m, y] = str.split('-');
                            return `${y}-${m}-${d}`;
                        }
                        if (/^\d+$/.test(str) && Number(str) > 20000) {
                            const excelDate = new Date((Number(str) - 25569) * 86400 * 1000);
                            return excelDate.toISOString().split('T')[0];
                        }
                        return str;
                    };

                    const isTrue = (val: any) => String(val).trim().toUpperCase() === 'TRUE' || String(val).trim().toUpperCase() === 'YES';

                    const importedEmp: Employee = {
                        ...getEmptyForm() as Employee,
                        id,
                        name,
                        gender: (getVal(['Gender']) as any) || 'Male',
                        dob: parseIndDate(getVal(['Date of Birth (DD-MM-YYYY)', 'Date of Birth', 'DOB'])),
                        designation: String(getVal(['Designation']) || designations[0]),
                        division: String(getVal(['Department/Division', 'Department', 'Division']) || divisions[0]),
                        department: String(getVal(['Department/Division', 'Department', 'Division']) || divisions[0]),
                        branch: String(getVal(['Branch']) || branches[0]),
                        site: String(getVal(['Site']) || sites[0]),
                        doj: parseIndDate(getVal(['Date of Joining (DD-MM-YYYY)', 'Date of Joining', 'DOJ', 'Joining Date'])) || new Date().toISOString().split('T')[0],
                        mobile: String(getVal(['Mobile Number', 'Mobile', 'Mobile No']) || ''),
                        fatherSpouseName: String(getVal(['Father or Spouse Name', 'Father Name', 'Spouse Name']) || ''),
                        relationship: String(getVal(['Relationship']) || 'Father'),
                        maritalStatus: String(getVal(['Married (Yes/No)', 'Married', 'Marital Status']) || 'No') === 'Yes' ? 'Yes' : 'No',
                        spouseName: String(getVal(['Spouse Name', 'Wife Name', 'Husband Name']) || ''),
                        spouseGender: String(getVal(['Spouse Gender']) || '') as any,
                        spouseAadhaar: String(getVal(['Spouse Aadhaar Number', 'Spouse Aadhaar', 'Spouse UID']) || ''),

                        doorNo: String(getVal(['Door No', 'House No', 'Flat No']) || ''),
                        buildingName: String(getVal(['Building Name', 'Apartment']) || ''),
                        street: String(getVal(['Street']) || ''),
                        area: String(getVal(['Area', 'Locality']) || ''),
                        city: String(getVal(['City', 'Town']) || ''),
                        state: String(getVal(['State']) || 'Tamil Nadu'),
                        pincode: String(getVal(['Pincode', 'Zip']) || ''),
                        pan: pan.toUpperCase(),
                        aadhaarNumber: aadhaar,
                        uanc: uan,
                        pfNumber: pf,
                        esiNumber: esi,
                        bankAccount: String(getVal(['Bank Account Number', 'Account No', 'Bank A/c']) || ''),
                        bankName: String(getVal(['Bank Name', 'Bank']) || ''),
                        bankBranch: String(getVal(['Bank Branch', 'Branch Name']) || ''),
                        ifsc: String(getVal(['IFSC Code', 'IFSC']) || ''),
                        basicPay: Number(getVal(['Basic Pay', 'Basic']) || 0),
                        da: Number(getVal(['DA', 'Dearness Allowance']) || 0),
                        retainingAllowance: Number(getVal(['Retaining Allowance', 'RA']) || 0),
                        hra: Number(getVal(['HRA', 'House Rent Allowance']) || 0),
                        conveyance: Number(getVal(['Conveyance']) || 0),
                        washing: Number(getVal(['Washing Allowance', 'Washing']) || 0),
                        attire: Number(getVal(['Attire Allowance', 'Attire']) || 0),
                        specialAllowance1: Number(getVal(['Special Allowance 1', 'Special 1']) || 0),
                        specialAllowance2: Number(getVal(['Special Allowance 2', 'Special 2']) || 0),
                        specialAllowance3: Number(getVal(['Special Allowance 3', 'Special 3']) || 0),

                        isPFExempt: isTrue(getVal(['PF Exempt', 'PF Exempted'])),
                        isESIExempt: isTrue(getVal(['ESI Exempt', 'ESI Exempted'])),

                        pfHigherPension: {
                            enabled: isTrue(getVal(['Higher Pension Enabled', 'HP Enabled'])),
                            contributedBefore2014: isTrue(getVal(['HP: Pre-2014 Contrib'])) ? 'Yes' : 'No',
                            dojImpact: '',
                            employeeContribution: (String(getVal(['HP: EE Contrib'])).includes('Higher') ? 'Higher' : 'Regular'),
                            employerContribution: (String(getVal(['HP: ER Contrib'])).includes('Higher') ? 'Higher' : 'Regular'),
                            isHigherPensionOpted: isTrue(getVal(['HP: Joint Option'])) ? 'Yes' : 'No'
                        },
                        epfMembershipDate: parseIndDate(getVal(['HP: EPF Membership Date'])),

                        dol: parseIndDate(getVal(['Date of Leaving', 'Date of Leaving (DD-MM-YYYY)', 'DOL'])),
                        leavingReason: String(getVal(['Reason for Leaving', 'Reason']) || ''),
                        serviceRecords: [{ date: parseIndDate(getVal(['Date of Joining', 'DOJ'])) || new Date().toISOString().split('T')[0], type: 'Appointment', description: 'Imported from Excel' }]
                    };

                    validNewEmployees.push(importedEmp);
                });

                resolve({
                    total: data.length,
                    success: validNewEmployees.length,
                    failed: rejectedRecords.length,
                    errors: rejectedRecords,
                    successfulEmployees: validNewEmployees
                });

            } catch (err: any) {
                console.error("Excel Import Error:", err);
                alert(`Error parsing file: ${err.message || 'Unknown error'}. Please ensure you are using the correct template.`);
                reject(err);
            }
        };

        reader.onerror = (err) => {
            console.error("FileReader Error:", err);
            alert("Failed to read file.");
            reject(err);
        };

        reader.readAsBinaryString(file);
    });
};

/**
 * Downloads Import Failure Report
 */
export const generateImportFailureReport = (importSummary: any, format: 'PDF' | 'Excel', companyProfile?: CompanyProfile) => {
    if (!importSummary) return;

    const data = importSummary.errors.map((err: any) => ({
        'Row No': err.row,
        'Employee Name': err.name,
        'Employee ID': err.id,
        'Reason for Rejection': err.reason
    }));

    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const fileName = getStandardFileName('Import_Rejection_Report', companyProfile || {} as any, months[now.getMonth()], now.getFullYear());

    if (format === 'Excel') {
        generateExcelReport(data, 'Import Errors', fileName);
    } else {
        const headers = ['Row', 'Employee Name', 'ID', 'Reason for Rejection'];
        const rows = data.map((d: any) => [d['Row No'], d['Employee Name'], d['Employee ID'], d['Reason for Rejection']]);
        const summaryText = `Total Processed: ${importSummary.total} | Successful: ${importSummary.success} | Failed: ${importSummary.failed}`;

        // Just mock the company profile if undefined to avoid breaking the reportService
        const cp = companyProfile || { name: 'Unknown Company', pan: '', email: '', phone: '', addressText: '' } as unknown as CompanyProfile;

        generatePDFTableReport(
            'Import Exception Report',
            headers,
            rows,
            fileName,
            'p',
            summaryText,
            cp
        );
    }
};
