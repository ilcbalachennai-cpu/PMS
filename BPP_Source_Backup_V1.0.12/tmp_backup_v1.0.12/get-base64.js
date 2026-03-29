const fs = require('fs');
const imageBuffer = fs.readFileSync('D:/ILCBala/ILCBala_Payroll/BPP_Master/App_Template/BPP_Logo2.jpg');
console.log(`data:image/jpeg;base64,${imageBuffer.toString('base64')}`);
