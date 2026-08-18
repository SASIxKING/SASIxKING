/**
 * Starter data for C.R.S Power Solution.
 * Catalogue reflects a real inverter & battery dealership: 28% on batteries,
 * 18% on inverters, solar, stabilizers, accessories and services.
 */

export const business = {
  name: 'C.R.S Power Solution',
  tagline: 'Inverters • Batteries • Solar • Sales & Service',
  addressLine: 'No.16, ECR Main Road, Pillaichavady',
  city: 'Pondicherry',
  state: 'Puducherry',
  stateCode: '34',
  pincode: '605014',
  gstin: '34ABCDE1234F1Z5',
  phone: '+91 98430 12345',
  email: 'crspowersolution@gmail.com',
  bankName: 'State Bank of India',
  accountNo: '3812 4567 8901',
  ifsc: 'SBIN0001234',
  upiId: 'crspower@sbi',
  invoicePrefix: 'CRS',
  terms: [
    'Goods once sold will not be taken back.',
    'Warranty as per manufacturer terms; battery warranty is pro-rata after 24 months.',
    'Interest @18% p.a. is charged on bills unpaid beyond 15 days.',
    'Subject to Puducherry jurisdiction.',
  ],
};

export const products = [
  { id: 'p1', name: 'Tall Tubular Battery 150Ah', category: 'Battery', brand: 'Exide', model: 'IT500', hsn: '8507', unit: 'Nos', capacity: '150Ah', purchasePrice: 11500, sellingPrice: 14500, gstRate: 28, stockQty: 12, reorderLevel: 4, warrantyMonths: 48, exchangeValue: 1200, trackSerial: true },
  { id: 'p2', name: 'Tall Tubular Battery 200Ah', category: 'Battery', brand: 'Amaron', model: 'AAM-CR-I20', hsn: '8507', unit: 'Nos', capacity: '200Ah', purchasePrice: 15200, sellingPrice: 18900, gstRate: 28, stockQty: 7, reorderLevel: 3, warrantyMonths: 48, exchangeValue: 1600, trackSerial: true },
  { id: 'p3', name: 'Tubular Battery 100Ah', category: 'Battery', brand: 'Luminous', model: 'RC18000', hsn: '8507', unit: 'Nos', capacity: '100Ah', purchasePrice: 8200, sellingPrice: 10400, gstRate: 28, stockQty: 3, reorderLevel: 4, warrantyMonths: 36, exchangeValue: 900, trackSerial: true },
  { id: 'p4', name: 'Sine Wave Inverter 900VA', category: 'Inverter', brand: 'Luminous', model: 'Zelio 1100', hsn: '8504', unit: 'Nos', capacity: '900VA', purchasePrice: 6200, sellingPrice: 8200, gstRate: 18, stockQty: 10, reorderLevel: 3, warrantyMonths: 24, exchangeValue: 0, trackSerial: true },
  { id: 'p5', name: 'Sine Wave Inverter 1500VA', category: 'Inverter', brand: 'Microtek', model: 'UPS SEBz 1600', hsn: '8504', unit: 'Nos', capacity: '1500VA', purchasePrice: 9800, sellingPrice: 12500, gstRate: 18, stockQty: 5, reorderLevel: 2, warrantyMonths: 24, exchangeValue: 0, trackSerial: true },
  { id: 'p6', name: 'Inverter 2.5KVA MPPT', category: 'Inverter', brand: 'Smarten', model: 'Superb 2500', hsn: '8504', unit: 'Nos', capacity: '2.5KVA', purchasePrice: 17500, sellingPrice: 21900, gstRate: 18, stockQty: 2, reorderLevel: 2, warrantyMonths: 24, exchangeValue: 0, trackSerial: true },
  { id: 'p7', name: 'Solar Panel 330W Poly', category: 'Solar', brand: 'Vikram Solar', model: 'ELDORA', hsn: '8541', unit: 'Nos', capacity: '330W', purchasePrice: 7400, sellingPrice: 9500, gstRate: 18, stockQty: 6, reorderLevel: 2, warrantyMonths: 60, exchangeValue: 0, trackSerial: false },
  { id: 'p8', name: 'Solar Charge Controller 40A', category: 'Solar', brand: 'Smarten', model: 'MPPT-40', hsn: '8504', unit: 'Nos', capacity: '40A', purchasePrice: 3200, sellingPrice: 4400, gstRate: 18, stockQty: 7, reorderLevel: 3, warrantyMonths: 12, exchangeValue: 0, trackSerial: false },
  { id: 'p9', name: 'Digital Voltage Stabilizer 5KVA', category: 'Stabilizer', brand: 'V-Guard', model: 'VG-500', hsn: '8504', unit: 'Nos', capacity: '5KVA', purchasePrice: 4100, sellingPrice: 5600, gstRate: 18, stockQty: 4, reorderLevel: 2, warrantyMonths: 36, exchangeValue: 0, trackSerial: false },
  { id: 'p10', name: 'Battery Trolley (Double)', category: 'Accessory', brand: 'Generic', model: '', hsn: '7326', unit: 'Nos', capacity: '', purchasePrice: 900, sellingPrice: 1450, gstRate: 18, stockQty: 15, reorderLevel: 5, warrantyMonths: 0, exchangeValue: 0, trackSerial: false },
  { id: 'p11', name: 'Inverter Cable Set 25 sq mm', category: 'Accessory', brand: 'Polycab', model: '', hsn: '8544', unit: 'Set', capacity: '', purchasePrice: 420, sellingPrice: 750, gstRate: 18, stockQty: 28, reorderLevel: 8, warrantyMonths: 0, exchangeValue: 0, trackSerial: false },
  { id: 'p12', name: 'Distilled Water 5L', category: 'Accessory', brand: 'Generic', model: '', hsn: '2853', unit: 'Can', capacity: '5L', purchasePrice: 60, sellingPrice: 120, gstRate: 18, stockQty: 40, reorderLevel: 10, warrantyMonths: 0, exchangeValue: 0, trackSerial: false },
  { id: 'p13', name: 'Installation & Wiring Charges', category: 'Service', brand: '', model: '', hsn: '9987', unit: 'Job', capacity: '', purchasePrice: 0, sellingPrice: 800, gstRate: 18, stockQty: 0, reorderLevel: 0, warrantyMonths: 0, exchangeValue: 0, trackSerial: false },
  { id: 'p14', name: 'Annual Maintenance Contract', category: 'Service', brand: '', model: '', hsn: '9987', unit: 'Year', capacity: '', purchasePrice: 0, sellingPrice: 2400, gstRate: 18, stockQty: 0, reorderLevel: 0, warrantyMonths: 0, exchangeValue: 0, trackSerial: false },
];

export const customers = [
  { id: 'c1', name: 'Sri Balaji Electricals', type: 'Dealer', phone: '9843012345', email: 'balaji.elec@gmail.com', gstin: '34ABCDE1234F1Z5', address: '12, Mission Street', city: 'Pondicherry', state: 'Puducherry', stateCode: '34', pincode: '605001', creditDays: 15, notes: 'Regular dealer, bulk battery orders' },
  { id: 'c2', name: 'Ramesh Kumar', type: 'Retail', phone: '9791045678', email: '', gstin: '', address: '45, Gandhi Nagar', city: 'Villupuram', state: 'Tamil Nadu', stateCode: '33', pincode: '605602', creditDays: 0, notes: '' },
  { id: 'c3', name: 'Anitha Textiles', type: 'Corporate', phone: '9500123456', email: 'accounts@anithatextiles.in', gstin: '33AACCT1234M1ZP', address: 'Plot 8, SIDCO Industrial Estate', city: 'Cuddalore', state: 'Tamil Nadu', stateCode: '33', pincode: '607005', creditDays: 30, notes: 'Inter-state, IGST applies' },
  { id: 'c4', name: 'Hotel Surguru', type: 'Corporate', phone: '9865432109', email: 'maint@surguru.com', gstin: '34AABCH5678K1Z2', address: '104, Mission Street', city: 'Pondicherry', state: 'Puducherry', stateCode: '34', pincode: '605001', creditDays: 30, notes: 'AMC customer' },
  { id: 'c5', name: 'Lakshmi Stores', type: 'Retail', phone: '9994567812', email: '', gstin: '', address: 'ECR Main Road, Kottakuppam', city: 'Pondicherry', state: 'Puducherry', stateCode: '34', pincode: '605104', creditDays: 0, notes: '' },
];
