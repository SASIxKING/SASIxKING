package com.voltbill.pro.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** A customer / dealer / institution the shop bills to. */
@Entity(tableName = "customers", indices = [Index("name"), Index("phone")])
data class Customer(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val phone: String = "",
    val email: String = "",
    val gstin: String = "",
    val address: String = "",
    val city: String = "",
    val state: String = "Tamil Nadu",
    val stateCode: String = "33",
    val pincode: String = "",
    val type: String = "Retail",           // Retail | Dealer | Corporate | AMC
    val openingBalance: Double = 0.0,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val active: Boolean = true
)

/**
 * Stock item. Covers inverters, batteries, stabilizers, solar panels, wiring
 * and services. Batteries additionally carry warranty months + exchange value.
 */
@Entity(tableName = "products", indices = [Index("name"), Index("category")])
data class Product(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val category: String = "Battery",      // Inverter | Battery | Solar | Stabilizer | Accessory | Service
    val brand: String = "",
    val model: String = "",
    val hsn: String = "8507",
    val unit: String = "Nos",
    val capacity: String = "",             // 150Ah / 900VA / 320W
    val purchasePrice: Double = 0.0,
    val sellingPrice: Double = 0.0,
    val gstRate: Double = 28.0,
    val stockQty: Double = 0.0,
    val lowStockAlert: Double = 3.0,
    val warrantyMonths: Int = 0,
    val exchangeValue: Double = 0.0,       // buy-back allowance for old battery
    val trackSerial: Boolean = false,
    val active: Boolean = true
)

/** Invoice header. */
@Entity(tableName = "invoices", indices = [Index("invoiceNo"), Index("customerId"), Index("date")])
data class Invoice(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceNo: String,
    val date: Long = System.currentTimeMillis(),
    val dueDate: Long = System.currentTimeMillis(),
    val customerId: Long,
    val customerName: String,
    val customerPhone: String = "",
    val customerGstin: String = "",
    val customerAddress: String = "",
    val placeOfSupply: String = "33-Tamil Nadu",
    val interState: Boolean = false,
    val subTotal: Double = 0.0,
    val discount: Double = 0.0,
    val taxableValue: Double = 0.0,
    val cgst: Double = 0.0,
    val sgst: Double = 0.0,
    val igst: Double = 0.0,
    val exchangeDeduction: Double = 0.0,   // old battery buy-back
    val roundOff: Double = 0.0,
    val grandTotal: Double = 0.0,
    val paidAmount: Double = 0.0,
    val status: String = "UNPAID",         // PAID | PARTIAL | UNPAID
    val paymentMode: String = "Cash",      // Cash | UPI | Card | Bank | Credit
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

/** Invoice line item, with per-line serials + warranty snapshot. */
@Entity(tableName = "invoice_items", indices = [Index("invoiceId")])
data class InvoiceItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceId: Long,
    val productId: Long,
    val name: String,
    val hsn: String = "",
    val serials: String = "",              // comma separated
    val qty: Double = 1.0,
    val unit: String = "Nos",
    val rate: Double = 0.0,
    val discountPct: Double = 0.0,
    val gstRate: Double = 28.0,
    val taxable: Double = 0.0,
    val cgst: Double = 0.0,
    val sgst: Double = 0.0,
    val igst: Double = 0.0,
    val lineTotal: Double = 0.0,
    val warrantyMonths: Int = 0
)

/** Money received against an invoice (or on account). */
@Entity(tableName = "payments", indices = [Index("invoiceId"), Index("customerId")])
data class Payment(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceId: Long,
    val customerId: Long,
    val customerName: String = "",
    val invoiceNo: String = "",
    val amount: Double,
    val mode: String = "Cash",
    val reference: String = "",
    val date: Long = System.currentTimeMillis(),
    val notes: String = ""
)

/** Warranty card generated per serialised unit sold. */
@Entity(tableName = "warranties", indices = [Index("serial"), Index("customerId"), Index("expiryDate")])
data class Warranty(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val serial: String,
    val productName: String,
    val brand: String = "",
    val customerId: Long,
    val customerName: String,
    val customerPhone: String = "",
    val invoiceId: Long = 0,
    val invoiceNo: String = "",
    val startDate: Long = System.currentTimeMillis(),
    val expiryDate: Long = System.currentTimeMillis(),
    val months: Int = 0,
    val claimed: Boolean = false,
    val claimNotes: String = ""
)

/** Installation / service visit / AMC job card. */
@Entity(tableName = "service_jobs", indices = [Index("customerId"), Index("status"), Index("scheduledDate")])
data class ServiceJob(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val jobNo: String,
    val customerId: Long,
    val customerName: String,
    val customerPhone: String = "",
    val address: String = "",
    val type: String = "Service",          // Installation | Service | AMC | Complaint | Battery Water Top-up
    val description: String = "",
    val technician: String = "",
    val scheduledDate: Long = System.currentTimeMillis(),
    val completedDate: Long? = null,
    val status: String = "OPEN",           // OPEN | IN_PROGRESS | COMPLETED | CANCELLED
    val charges: Double = 0.0,
    val amcStart: Long? = null,
    val amcEnd: Long? = null,
    val notes: String = ""
)

/** Stock movement audit trail. */
@Entity(tableName = "stock_moves", indices = [Index("productId"), Index("date")])
data class StockMove(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val productId: Long,
    val productName: String = "",
    val type: String = "IN",               // IN | OUT | ADJUST
    val qty: Double = 0.0,
    val reason: String = "",
    val date: Long = System.currentTimeMillis()
)
