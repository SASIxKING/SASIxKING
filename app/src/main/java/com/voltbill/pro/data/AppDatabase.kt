package com.voltbill.pro.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@Database(
    entities = [
        Customer::class, Product::class, Invoice::class, InvoiceItem::class,
        Payment::class, Warranty::class, ServiceJob::class, StockMove::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun customerDao(): CustomerDao
    abstract fun productDao(): ProductDao
    abstract fun invoiceDao(): InvoiceDao
    abstract fun paymentDao(): PaymentDao
    abstract fun warrantyDao(): WarrantyDao
    abstract fun serviceDao(): ServiceDao
    abstract fun stockMoveDao(): StockMoveDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun get(context: Context): AppDatabase = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                "voltbill.db"
            )
                .fallbackToDestructiveMigration()
                .addCallback(object : RoomDatabase.Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        super.onCreate(db)
                        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
                            INSTANCE?.let { seed(it) }
                        }
                    }
                })
                .build().also { INSTANCE = it }
        }

        /** Seed a realistic starter catalogue so the app is usable on first launch. */
        private suspend fun seed(db: AppDatabase) {
            val p = db.productDao()
            listOf(
                Product(name = "Tall Tubular Battery 150Ah", category = "Battery", brand = "Exide",
                    model = "IT500", hsn = "8507", capacity = "150Ah", purchasePrice = 11500.0,
                    sellingPrice = 14500.0, gstRate = 28.0, stockQty = 12.0, warrantyMonths = 48,
                    exchangeValue = 1200.0, trackSerial = true),
                Product(name = "Tall Tubular Battery 200Ah", category = "Battery", brand = "Amaron",
                    model = "AAM-CR-I20", hsn = "8507", capacity = "200Ah", purchasePrice = 15200.0,
                    sellingPrice = 18900.0, gstRate = 28.0, stockQty = 8.0, warrantyMonths = 48,
                    exchangeValue = 1600.0, trackSerial = true),
                Product(name = "Sine Wave Inverter 900VA", category = "Inverter", brand = "Luminous",
                    model = "Zelio 1100", hsn = "8504", capacity = "900VA", purchasePrice = 6200.0,
                    sellingPrice = 8200.0, gstRate = 18.0, stockQty = 10.0, warrantyMonths = 24,
                    trackSerial = true),
                Product(name = "Sine Wave Inverter 1500VA", category = "Inverter", brand = "Microtek",
                    model = "UPS SEBz 1600", hsn = "8504", capacity = "1500VA", purchasePrice = 9800.0,
                    sellingPrice = 12500.0, gstRate = 18.0, stockQty = 5.0, warrantyMonths = 24,
                    trackSerial = true),
                Product(name = "Solar Panel 330W Poly", category = "Solar", brand = "Vikram Solar",
                    model = "ELDORA", hsn = "8541", capacity = "330W", purchasePrice = 7400.0,
                    sellingPrice = 9500.0, gstRate = 12.0, stockQty = 6.0, warrantyMonths = 60),
                Product(name = "Solar Charge Controller 40A", category = "Solar", brand = "Smarten",
                    model = "MPPT-40", hsn = "8504", capacity = "40A", purchasePrice = 3200.0,
                    sellingPrice = 4400.0, gstRate = 18.0, stockQty = 7.0, warrantyMonths = 12),
                Product(name = "Digital Voltage Stabilizer 5KVA", category = "Stabilizer", brand = "V-Guard",
                    model = "VG-500", hsn = "8504", capacity = "5KVA", purchasePrice = 4100.0,
                    sellingPrice = 5600.0, gstRate = 18.0, stockQty = 4.0, warrantyMonths = 36),
                Product(name = "Battery Trolley (Double)", category = "Accessory", brand = "Generic",
                    hsn = "7326", purchasePrice = 900.0, sellingPrice = 1450.0, gstRate = 18.0,
                    stockQty = 15.0),
                Product(name = "Inverter Cable Set 25 sq mm", category = "Accessory", brand = "Polycab",
                    hsn = "8544", unit = "Set", purchasePrice = 420.0, sellingPrice = 750.0,
                    gstRate = 18.0, stockQty = 30.0),
                Product(name = "Distilled Water 5L", category = "Accessory", brand = "Generic",
                    hsn = "2853", unit = "Can", purchasePrice = 60.0, sellingPrice = 120.0,
                    gstRate = 18.0, stockQty = 40.0),
                Product(name = "Installation & Wiring Charges", category = "Service", hsn = "9987",
                    unit = "Job", purchasePrice = 0.0, sellingPrice = 800.0, gstRate = 18.0,
                    stockQty = 0.0),
                Product(name = "Annual Maintenance Contract", category = "Service", hsn = "9987",
                    unit = "Year", purchasePrice = 0.0, sellingPrice = 2400.0, gstRate = 18.0,
                    stockQty = 0.0)
            ).forEach { p.insert(it) }

            val c = db.customerDao()
            listOf(
                Customer(name = "Sri Balaji Electricals", phone = "9843012345", city = "Puducherry",
                    state = "Puducherry", stateCode = "34", type = "Dealer", gstin = "34ABCDE1234F1Z5",
                    address = "12, Mission Street"),
                Customer(name = "Ramesh Kumar", phone = "9791045678", city = "Villupuram",
                    address = "45, Gandhi Nagar"),
                Customer(name = "Anitha Textiles", phone = "9500123456", city = "Cuddalore",
                    type = "Corporate", gstin = "33AACCT1234M1ZP", address = "Plot 8, SIDCO Estate")
            ).forEach { c.insert(it) }
        }
    }
}
