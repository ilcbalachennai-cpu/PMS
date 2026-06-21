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
            const path = await generateExcelWorkbook(wb, fileName);
            return path;
        }

        // Template Download
        const templateHeaders = [
            "Employee ID", "Full Name", "Gender", "Date of Birth (DD-MM-YYYY)", "Designation",
            "Department/Division", "Branch", "Site", "Date of Joining (DD-MM-YYYY)",
            "Mobile Number", "mail_id", "Father or Spouse Name", "Relationship",
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
            "EL Opening Balance", "SL Opening Balance", "CL Opening Balance",
            "Date of Leaving (DD-MM-YYYY)", "Reason for Leaving"
        ];

        const sampleRow = [
            "AUTO-GEN", "John Doe", "Male", "15-05-1990", "Software Engineer",
            "Engineering", "Chennai", "Main Plant", "01-01-2024",
            "9876543210", "john.doe@example.com", "Jane Doe", "Spouse",
            "Yes", "Jane Doe", "Female", "999988887777",
            "12A", "Sun Villa", "Main Road", "Guindy", "Chennai", "Tamil Nadu", "600032",
            "ABCDE1234F", "123456789012", "100234567890", "TN/MAS/0012345/000/0000101", "3112345678",
            "50100012345678", "HDFC Bank", "Adyar", "HDFC0000123",
            "15000", "5000", "0", "8000", "1600",
            "0", "0", "0", "0", "0",
            "No", "No",
            "No", "No", "", "Regular", "Regular", "No",
            "0", "0", "0",
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
 * Security: Sanitizes data to prevent Prototype Pollution attacks
 * Strips dangerous keys like __proto__, constructor, and prototype.
 */
const sanitizeData = (data: any): any => {
    if (Array.isArray(data)) {
        return data.map(sanitizeData);
    } else if (data instanceof Date || Object.prototype.toString.call(data) === '[object Date]') {
        return data;
    } else if (data !== null && typeof data === 'object') {
        const sanitized: any = {};
        for (const key in data) {
            if (['__proto__', 'constructor', 'prototype'].includes(key.toLowerCase())) continue;
            sanitized[key] = sanitizeData(data[key]);
        }
        return sanitized;
    }
    return data;
};

/**
 * Unified Date Parser for Excel Import
 * Handles Date objects, string dates (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, text dates), 
 * and Excel serial numbers. Returns 'YYYY-MM-DD' formatted string.
 */
const parseExcelDate = (val: any): string => {
    if (val === undefined || val === null) return '';
    
    // 1. Native Date objects (SheetJS cellDates path)
    const isDateObject = val && (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]');
    if (isDateObject) {
        if (!isNaN(val.getTime())) {
            // Adjust for local timezone offset
            const offset = val.getTimezoneOffset() * 60000;
            const localTime = val.getTime() - offset;
            // Add a 12 hour buffer to push any "almost midnight" times (like 23:59:50) safely into the middle of the correct day
            const adjusted = new Date(localTime + 12 * 60 * 60 * 1000);
            
            const y = adjusted.getUTCFullYear();
            const m = String(adjusted.getUTCMonth() + 1).padStart(2, '0');
            const d = String(adjusted.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return '';
    }

    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '';

    // 2. Excel numeric date serials check (e.g. "29029", 46113)
    // Must run BEFORE general text parsing because pure numeric strings like "46113" 
    // are parsed by Date.parse as valid year values (e.g. year 46113).
    if (/^\d+(\.\d+)?$/.test(str)) {
        const num = parseFloat(str);
        if (num > 20000) {
            const excelDate = new Date(Math.round((num - 25569) * 86400 * 1000));
            if (!isNaN(excelDate.getTime())) {
                const y = excelDate.getUTCFullYear();
                const m = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
                const d = String(excelDate.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
    }

    // 3. Format DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
    const matchDMY = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
    if (matchDMY) {
        const d = matchDMY[1].padStart(2, '0');
        const m = matchDMY[2].padStart(2, '0');
        const y = matchDMY[3];
        return `${y}-${m}-${d}`;
    }

    // 4. Format DD-MM-YY, DD/MM/YY, DD.MM.YY (2-digit year)
    const matchDMY2 = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2})$/);
    if (matchDMY2) {
        const d = matchDMY2[1].padStart(2, '0');
        const m = matchDMY2[2].padStart(2, '0');
        const yy = parseInt(matchDMY2[3]);
        const y = yy >= 80 ? `19${yy}` : `20${String(yy).padStart(2, '0')}`;
        return `${y}-${m}-${d}`;
    }

    // 5. Format YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
    const matchYMD = str.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
    if (matchYMD) {
        const y = matchYMD[1];
        const m = matchYMD[2].padStart(2, '0');
        const d = matchYMD[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 6. Text dates (e.g. "23-Jun-1979", "01 Apr 2026")
    const cleanDateStr = str.replace(/[-\/\.]/g, ' ');
    const parsedTime = Date.parse(cleanDateStr);
    if (!isNaN(parsedTime)) {
        const dateObj = new Date(parsedTime);
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return '';
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
                
                // Security: Sanitize the raw data produced by XLSX to prevent Prototype Pollution
                const rawData = XLSX.utils.sheet_to_json(ws);
                const data = sanitizeData(rawData);

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

                const tempEmps: Employee[] = [];

                data.forEach((row: any, rowIndex: number) => {
                    const rowNum = rowIndex + 2;
                    const getVal = (keys: string[]) => {
                        for (const k of keys) {
                            const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) return row[foundKey];
                        }
                        return null;
                    };

                    const excelId = String(getVal(['Employee ID', 'ID', 'Emp ID', 'Employee ID (LOCKED)', 'Employee ID (LOCKED) ']) || '').trim();
                    const name = String(getVal(['Full Name', 'Name', 'Employee Name', 'Full Name (LOCKED)']) || '').trim();
                    if (!name || name === 'Unknown') {
                        rejectedRecords.push({ row: rowNum, name: 'Unknown', id: excelId, reason: "Missing 'Full Name'. Skipped." });
                        return;
                    }

                    const uan = String(getVal(['UAN Number', 'UAN', 'UAN No', 'UAN Number (LOCKED)']) || '').trim();
                    const aadhaar = String(getVal(['Aadhaar Number', 'Aadhaar', 'Aadhaar No', 'Aadhaar Number (LOCKED)']) || '').trim();
                    const pan = String(getVal(['PAN Number', 'PAN', 'PAN No', 'PAN Number (LOCKED)']) || '').trim().toLowerCase();
                    const esi = String(getVal(['ESI Number', 'ESI IP Number', 'ESI No', 'ESI Number (LOCKED)']) || '').trim();
                    const pf = String(getVal(['PF Member ID', 'PF ID', 'PF Number', 'PF Member ID (LOCKED)']) || '').trim();

                    if (!aadhaar) {
                        rejectedRecords.push({ row: rowNum, name, id: excelId, reason: "Missing 'Aadhaar Number'. Skipped." });
                        return;
                    }

                    const duplicateReasons: string[] = [];
                    if (uan) { if (existingUAN.has(uan) || batchUAN.has(uan)) duplicateReasons.push(`Duplicate UAN (${uan})`); }
                    if (aadhaar) { if (existingAadhaar.has(aadhaar) || batchAadhaar.has(aadhaar)) duplicateReasons.push(`Duplicate Aadhaar (${aadhaar})`); }
                    if (pan) { if (existingPAN.has(pan) || batchPAN.has(pan)) duplicateReasons.push(`Duplicate PAN (${pan.toUpperCase()})`); }
                    if (esi) { if (existingESI.has(esi) || batchESI.has(esi)) duplicateReasons.push(`Duplicate ESI (${esi})`); }
                    if (pf) { if (existingPF.has(pf) || batchPF.has(pf)) duplicateReasons.push(`Duplicate PF (${pf})`); }

                    if (duplicateReasons.length > 0) {
                        rejectedRecords.push({ row: rowNum, name, id: excelId, reason: duplicateReasons.join(', ') });
                        return;
                    }

                    batchUAN.add(uan);
                    batchAadhaar.add(aadhaar);
                    batchPAN.add(pan);
                    batchESI.add(esi);
                    batchPF.add(pf);

                    const parseIndDate = (val: any) => parseExcelDate(val);

                    const isTrue = (val: any) => String(val).trim().toUpperCase() === 'TRUE' || String(val).trim().toUpperCase() === 'YES';

                    const parsedDoj = parseIndDate(getVal(['Date of Joining (DD-MM-YYYY)', 'Date of Joining (LOCKED)', 'Date of Joining', 'DOJ', 'Joining Date', 'Date of Join', 'Date of Joining (DD/MM/YYYY)', 'Date of Joining (DD.MM.YYYY)', 'DateofJoining', 'Date of Appointment'])) || '';

                    const importedEmp: Employee = {
                        ...getEmptyForm() as Employee,
                        id: '', // Will be assigned later
                        name,
                        gender: (getVal(['Gender', 'Gender (LOCKED)']) as any) || 'Male',
                        dob: parseIndDate(getVal(['Date of Birth (DD-MM-YYYY)', 'Date of Birth (LOCKED)', 'Date of Birth', 'DOB', 'Birth Date', 'Date of Birth (DD/MM/YYYY)', 'Date of Birth (DD.MM.YYYY)', 'BirthDate'])),
                        designation: String(getVal(['Designation', 'Designations', 'Desingation', 'Desg', 'Desig', 'Job Title', 'Role']) || designations[0] || ''),
                        division: String(getVal(['Department/Division', 'Department', 'Division', 'Department/Division (LOCKED)']) || divisions[0] || ''),
                        department: String(getVal(['Department/Division', 'Department', 'Division', 'Department/Division (LOCKED)']) || divisions[0] || ''),
                        branch: String(getVal(['Branch', 'Branch (LOCKED)']) || branches[0] || ''),
                        site: String(getVal(['Site', 'Site (LOCKED)']) || sites[0] || ''),
                        doj: parsedDoj,
                        mobile: String(getVal(['Mobile Number', 'Mobile', 'Mobile No']) || ''),
                        email: String(getVal(['mail_id', 'Mail ID', 'mailDI', 'Email', 'Email ID']) || ''),
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
                        initialOpeningBalances: {
                            el: Number(getVal(['EL Opening Balance', 'EL Opening', 'EL Balance']) || 0),
                            sl: Number(getVal(['SL Opening Balance', 'SL Opening', 'SL Balance']) || 0),
                            cl: Number(getVal(['CL Opening Balance', 'CL Opening', 'CL Balance']) || 0)
                        },
                        serviceRecords: [{ date: parsedDoj, type: 'Appointment', description: 'Imported from Excel' }]
                    };

                    tempEmps.push(importedEmp);
                });

                // Sort by DOJ ascending
                tempEmps.sort((a, b) => {
                    const dateA = new Date(a.doj).getTime();
                    const dateB = new Date(b.doj).getTime();
                    return dateA - dateB;
                });

                // Assign IDs
                tempEmps.forEach(emp => {
                    currentMaxId++;
                    emp.id = `EMP${String(currentMaxId).padStart(4, '0')}`;
                    validNewEmployees.push(emp);
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

/**
 * Generates an Excel Template for Master Data Import (Designations, Sites, etc.)
 */
export const generateMasterTemplateXLSX = async (company?: CompanyProfile) => {
    try {
        const headers = ["Master Type", "Item Name"];
        const samples = [
            ["Designation", "Software Engineer"],
            ["Division", "Engineering"],
            ["Branch", "Chennai"],
            ["Site", "Main Plant"]
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...samples]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MasterTemplate");
        
        const fileName = getStandardFileName('Master_Data_Template', company || {} as any, 'Any', 2024);
        await generateTemplateWorkbook(wb, fileName, company?.establishmentName);
    } catch (err) {
        console.error("Master Template Error:", err);
    }
};

/**
 * Parses Master Data XLSX
 */
export const parseMasterXLSX = async (file: File): Promise<{
    designations: string[],
    divisions: string[],
    branches: string[],
    sites: string[]
}> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);

                const masters = {
                    designations: [] as string[],
                    divisions: [] as string[],
                    branches: [] as string[],
                    sites: [] as string[]
                };

                data.forEach((row: any) => {
                    const type = String(row['Master Type'] || '').trim().toLowerCase();
                    const name = String(row['Item Name'] || '').trim();
                    if (!name) return;

                    if (type === 'designation') masters.designations.push(name);
                    else if (type === 'division' || type === 'department') masters.divisions.push(name);
                    else if (type === 'branch') masters.branches.push(name);
                    else if (type === 'site') masters.sites.push(name);
                });

                resolve(masters);
            } catch (err) { reject(err); }
        };
        reader.readAsBinaryString(file);
    });
};

/**
 * Generates an Excel Template for Updating Existing Employees
 */
export const generateEmployeeUpdateTemplateXLSX = async (employees: Employee[], company?: CompanyProfile) => {
    try {
        const templateHeaders = [
            "Employee ID (LOCKED)", "Full Name (LOCKED)", "Gender (LOCKED)", "Date of Birth (LOCKED)", "Designation",
            "Department/Division", "Branch", "Site", "Date of Joining (LOCKED)",
            "Mobile Number", "mail_id", "Father or Spouse Name", "Relationship",
            "Married (Yes/No)", "Spouse Name", "Spouse Gender", "Spouse Aadhaar Number",
            "Door No", "Building Name", "Street", "Area", "City", "State", "Pincode",
            "PAN Number", "Aadhaar Number", "UAN Number (LOCKED)", "PF Member ID", "ESI Number (LOCKED)",
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
            "EL Opening Balance", "SL Opening Balance", "CL Opening Balance",
            "Date of Leaving (LOCKED)", "Reason for Leaving (LOCKED)"
        ];

        const formatDate = (dateStr?: string) => {
            if (!dateStr) return '';
            const matchYMD = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (matchYMD) {
                return `${matchYMD[3]}-${matchYMD[2]}-${matchYMD[1]}`;
            }
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            const offset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() - offset);
            const d = String(localDate.getUTCDate()).padStart(2, '0');
            const m = String(localDate.getUTCMonth() + 1).padStart(2, '0');
            const y = localDate.getUTCFullYear();
            return `${d}-${m}-${y}`;
        };

        const rows = employees.map(emp => [
            emp.id,
            emp.name,
            emp.gender || 'Male',
            formatDate(emp.dob),
            emp.designation || '',
            emp.division || emp.department || '',
            emp.branch || '',
            emp.site || '',
            formatDate(emp.doj),
            emp.mobile || '',
            emp.email || '',
            emp.fatherSpouseName || '',
            emp.relationship || 'Father',
            emp.maritalStatus || 'No',
            emp.spouseName || '',
            emp.spouseGender || '',
            emp.spouseAadhaar || '',
            emp.doorNo || '',
            emp.buildingName || '',
            emp.street || '',
            emp.area || '',
            emp.city || '',
            emp.state || 'Tamil Nadu',
            emp.pincode || '',
            emp.pan || '',
            emp.aadhaarNumber || '',
            emp.uanc || '',
            emp.pfNumber || '',
            emp.esiNumber || '',
            emp.bankAccount || '',
            emp.bankName || '',
            emp.bankBranch || '',
            emp.ifsc || '',
            emp.basicPay || 0,
            emp.da || 0,
            emp.retainingAllowance || 0,
            emp.hra || 0,
            emp.conveyance || 0,
            emp.washing || 0,
            emp.attire || 0,
            emp.specialAllowance1 || 0,
            emp.specialAllowance2 || 0,
            emp.specialAllowance3 || 0,
            emp.isPFExempt ? 'Yes' : 'No',
            emp.isESIExempt ? 'Yes' : 'No',
            emp.pfHigherPension?.enabled ? 'Yes' : 'No',
            emp.pfHigherPension?.contributedBefore2014 || 'No',
            formatDate(emp.epfMembershipDate),
            emp.pfHigherPension?.employeeContribution || 'Regular',
            emp.pfHigherPension?.employerContribution || 'Regular',
            emp.pfHigherPension?.isHigherPensionOpted || 'No',
            emp.initialOpeningBalances?.el || 0,
            emp.initialOpeningBalances?.sl || 0,
            emp.initialOpeningBalances?.cl || 0,
            formatDate(emp.dol),
            emp.leavingReason || ''
        ]);

        const ws = XLSX.utils.aoa_to_sheet([templateHeaders, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "EmployeeUpdateTemplate");

        const now = new Date();
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const fileName = getStandardFileName('Employee_Update_Template', company || {} as any, months[now.getMonth()], now.getFullYear());
        const path = await generateTemplateWorkbook(wb, fileName, company?.establishmentName);
        return path;
    } catch (err: any) {
        console.error("Update Template Error:", err);
        alert("Failed to process Excel file.");
    }
};

/**
 * Parses Employee Update XLSX and updates existing employees
 */
export const parseEmployeeUpdateXLSX = async (
    file: File,
    existingEmployees: Employee[]
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                const rawData = XLSX.utils.sheet_to_json(ws);
                const data = sanitizeData(rawData);

                if (data.length === 0) {
                    alert("No data found in the Excel sheet.");
                    resolve({ total: 0, success: 0, failed: 0, errors: [] });
                    return;
                }

                const updatedEmployees: Employee[] = [...existingEmployees];
                const rejectedRecords: { row: number; name: string; id: string; reason: string }[] = [];
                let successCount = 0;

                const parseIndDate = (val: any) => parseExcelDate(val);

                const isTrue = (val: any) => String(val).trim().toUpperCase() === 'TRUE' || String(val).trim().toUpperCase() === 'YES';

                data.forEach((row: any, rowIndex: number) => {
                    const rowNum = rowIndex + 2;
                    const getVal = (keys: string[]) => {
                        for (const k of keys) {
                            const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) return row[foundKey];
                        }
                        return null;
                    };

                    const excelId = String(getVal(['Employee ID (LOCKED)', 'Employee ID', 'ID', 'Emp ID', 'Employee ID (LOCKED) ']) || '').trim();
                    if (!excelId) {
                        rejectedRecords.push({ row: rowNum, name: 'Unknown', id: '', reason: "Missing 'Employee ID'. Skipped." });
                        return;
                    }

                    const empIndex = updatedEmployees.findIndex(e => e.id === excelId);
                    if (empIndex === -1) {
                        rejectedRecords.push({ row: rowNum, name: 'Unknown', id: excelId, reason: `Employee with ID ${excelId} not found.` });
                        return;
                    }

                    const existingEmp = updatedEmployees[empIndex];

                    // Update allowed fields
                    const updatedEmp: Employee = {
                        ...existingEmp,
                        gender: (getVal(['Gender', 'Gender (LOCKED)']) as any) || existingEmp.gender,
                        dob: parseIndDate(getVal(['Date of Birth (DD-MM-YYYY)', 'Date of Birth (LOCKED)', 'Date of Birth', 'DOB', 'Birth Date', 'Date of Birth (DD/MM/YYYY)', 'Date of Birth (DD.MM.YYYY)', 'BirthDate'])) || existingEmp.dob,
                        doj: parseIndDate(getVal(['Date of Joining (DD-MM-YYYY)', 'Date of Joining (LOCKED)', 'Date of Joining', 'DOJ', 'Joining Date', 'Date of Join', 'Date of Joining (DD/MM/YYYY)', 'Date of Joining (DD.MM.YYYY)', 'DateofJoining', 'Date of Appointment'])) || existingEmp.doj,
                        dol: parseIndDate(getVal(['Date of Leaving (DD-MM-YYYY)', 'Date of Leaving (LOCKED)', 'Date of Leaving', 'DOL'])) || existingEmp.dol,
                        leavingReason: String(getVal(['Reason for Leaving', 'Reason']) || existingEmp.leavingReason),
                        designation: String(getVal(['Designation', 'Designations', 'Desingation', 'Desg', 'Desig', 'Job Title', 'Role']) || existingEmp.designation),
                        division: String(getVal(['Department/Division', 'Department', 'Division', 'Department/Division (LOCKED)']) || existingEmp.division),
                        department: String(getVal(['Department/Division', 'Department', 'Division', 'Department/Division (LOCKED)']) || existingEmp.department),
                        branch: String(getVal(['Branch', 'Branch (LOCKED)']) || existingEmp.branch),
                        site: String(getVal(['Site', 'Site (LOCKED)']) || existingEmp.site),
                        mobile: String(getVal(['Mobile Number', 'Mobile', 'Mobile No']) || existingEmp.mobile),
                        email: String(getVal(['mail_id', 'Mail ID', 'Email', 'Email ID']) || existingEmp.email),
                        fatherSpouseName: String(getVal(['Father or Spouse Name', 'Father Name', 'Spouse Name']) || existingEmp.fatherSpouseName),
                        relationship: String(getVal(['Relationship']) || existingEmp.relationship),
                        maritalStatus: String(getVal(['Married (Yes/No)', 'Married', 'Marital Status']) || existingEmp.maritalStatus) === 'Yes' ? 'Yes' : 'No',
                        spouseName: String(getVal(['Spouse Name', 'Wife Name', 'Husband Name']) || existingEmp.spouseName),
                        spouseGender: (getVal(['Spouse Gender']) as any) || existingEmp.spouseGender,
                        spouseAadhaar: String(getVal(['Spouse Aadhaar Number', 'Spouse Aadhaar', 'Spouse UID']) || existingEmp.spouseAadhaar),
                        doorNo: String(getVal(['Door No', 'House No', 'Flat No']) || existingEmp.doorNo),
                        buildingName: String(getVal(['Building Name', 'Building']) || existingEmp.buildingName),
                        street: String(getVal(['Street']) || existingEmp.street),
                        area: String(getVal(['Area']) || existingEmp.area),
                        city: String(getVal(['City']) || existingEmp.city),
                        state: String(getVal(['State']) || existingEmp.state),
                        pincode: String(getVal(['Pincode', 'Pin Code']) || existingEmp.pincode),
                        pan: String(getVal(['PAN Number', 'PAN', 'PAN No', 'PAN Number (LOCKED)']) || existingEmp.pan).toUpperCase(),
                        aadhaarNumber: String(getVal(['Aadhaar Number', 'Aadhaar', 'Aadhaar No', 'Aadhaar Number (LOCKED)']) || existingEmp.aadhaarNumber),
                        bankAccount: String(getVal(['Bank Account Number', 'Bank Account', 'Account No', 'Account Number']) || existingEmp.bankAccount),
                        bankName: String(getVal(['Bank Name', 'Bank']) || existingEmp.bankName),
                        bankBranch: String(getVal(['Bank Branch', 'Branch Name']) || existingEmp.bankBranch),
                        ifsc: String(getVal(['IFSC Code', 'IFSC']) || existingEmp.ifsc),
                        basicPay: Number(getVal(['Basic Pay', 'Basic']) || existingEmp.basicPay),
                        da: Number(getVal(['DA']) || existingEmp.da),
                        retainingAllowance: Number(getVal(['Retaining Allowance']) || existingEmp.retainingAllowance),
                        hra: Number(getVal(['HRA']) || existingEmp.hra),
                        conveyance: Number(getVal(['Conveyance']) || existingEmp.conveyance),
                        washing: Number(getVal(['Washing Allowance']) || existingEmp.washing),
                        attire: Number(getVal(['Attire Allowance']) || existingEmp.attire),
                        specialAllowance1: Number(getVal(['Special Allowance 1']) || existingEmp.specialAllowance1),
                        specialAllowance2: Number(getVal(['Special Allowance 2']) || existingEmp.specialAllowance2),
                        specialAllowance3: Number(getVal(['Special Allowance 3']) || existingEmp.specialAllowance3),
                        isPFExempt: isTrue(getVal(['PF Exempt (Yes/No)'])) || existingEmp.isPFExempt,
                        isESIExempt: isTrue(getVal(['ESI Exempt (Yes/No)'])) || existingEmp.isESIExempt,
                        pfHigherPension: {
                            ...existingEmp.pfHigherPension,
                            enabled: isTrue(getVal(['Higher Pension Enabled (Yes/No)'])) || existingEmp.pfHigherPension?.enabled || false,
                            contributedBefore2014: (getVal(['HP: Pre-2014 Contrib (Yes/No)']) as any) || existingEmp.pfHigherPension?.contributedBefore2014,
                            employeeContribution: (getVal(['HP: EE Contrib (Regular/Higher)']) as any) || existingEmp.pfHigherPension?.employeeContribution,
                            employerContribution: (getVal(['HP: ER Contrib (Regular/Higher)']) as any) || existingEmp.pfHigherPension?.employerContribution,
                            isHigherPensionOpted: (getVal(['HP: Joint Option (Yes/No)']) as any) || existingEmp.pfHigherPension?.isHigherPensionOpted,
                            dojImpact: existingEmp.pfHigherPension?.dojImpact || ''
                        },
                        epfMembershipDate: parseIndDate(getVal(['HP: EPF Membership Date (DD-MM-YYYY)'])) || existingEmp.epfMembershipDate
                    };

                    updatedEmployees[empIndex] = updatedEmp;
                    successCount++;
                });

                resolve({
                    total: data.length,
                    success: successCount,
                    failed: rejectedRecords.length,
                    errors: rejectedRecords,
                    updatedEmployees
                });

            } catch (err: any) {
                console.error("Excel Update Import Error:", err);
                alert(`Error parsing file: ${err.message || 'Unknown error'}.`);
                reject(err);
            }
        };

        reader.onerror = (err) => {
            alert("Failed to read file.");
            reject(err);
        };

        reader.readAsBinaryString(file);
    });
};

