package com.voltbill.pro.data

import android.content.Context
import com.voltbill.pro.domain.addMonths
import com.voltbill.pro.domain.money
import com.voltbill.pro.domain.nextInvoiceNo
import kotlinx.coroutines.flow.first

/** Single access point to all persistence for the ViewModels. */
class Repository(context: Context) {

    private val db = AppDatabase.get(context)
    val settings = SettingsStore(context)

    val customers = db.customerDao()
    val products = db.productDao()
    val invoices = db.invoiceDao()
    val payments = db.paymentDao()
    val warranties = db.warrantyDao()
    val services = db.serviceDao()
    val stockMoves = db.stockMoveDao()

    suspend fun generateInvoiceNo(): String {
        val prefix = settings.profile.first().invoicePrefix
        return nextInvoiceNo(invoices.lastInvoiceNo(), prefix)
    }

    suspend fun generateJobNo(): String {
        val last = services.lastJobNo()?.substringAfterLast('-')?.toIntOrNull() ?: 0
        return "JOB-${(last + 1).toString().padStart(4, '0')}"
    }

    /**
     * Persists an invoice atomically-ish: header, lines, stock deduction,
     * warranty cards for serialised items and an auto-payment when settled.
     */
    suspend fun saveInvoice(invoice: Invoice, items: List<InvoiceItem>): Long {
        val id = invoices.insert(invoice)
        invoices.insertItems(items.map { it.copy(invoiceId = id) })

        val warrantyCards = mutableListOf<Warranty>()
        items.forEach { item ->
            if (item.productId > 0) {
                val product = products.byId(item.productId)
                if (product != null && product.category != "Service") {
                    products.adjustStock(item.productId, -item.qty)
                    stockMoves.insert(
                        StockMove(
                            productId = item.productId,
                            productName = item.name,
                            type = "OUT",
                            qty = item.qty,
                            reason = "Sold on ${invoice.invoiceNo}"
                        )
                    )
                }
                if (item.warrantyMonths > 0 && item.serials.isNotBlank()) {
                    item.serials.split(",").map { it.trim() }.filter { it.isNotEmpty() }.forEach { sn ->
                        warrantyCards += Warranty(
                            serial = sn,
                            productName = item.name,
                            brand = product?.brand ?: "",
                            customerId = invoice.customerId,
                            customerName = invoice.customerName,
                            customerPhone = invoice.customerPhone,
                            invoiceId = id,
                            invoiceNo = invoice.invoiceNo,
                            startDate = invoice.date,
                            expiryDate = addMonths(invoice.date, item.warrantyMonths),
                            months = item.warrantyMonths
                        )
                    }
                }
            }
        }
        if (warrantyCards.isNotEmpty()) warranties.insertAll(warrantyCards)

        if (invoice.paidAmount > 0) {
            payments.insert(
                Payment(
                    invoiceId = id,
                    customerId = invoice.customerId,
                    customerName = invoice.customerName,
                    invoiceNo = invoice.invoiceNo,
                    amount = invoice.paidAmount,
                    mode = invoice.paymentMode,
                    date = invoice.date,
                    notes = "Recorded with invoice"
                )
            )
        }
        return id
    }

    /** Records a receipt and re-derives the invoice's paid/partial status. */
    suspend fun recordPayment(p: Payment) {
        payments.insert(p)
        val inv = invoices.byId(p.invoiceId) ?: return
        val paid = money(payments.paidForInvoice(p.invoiceId))
        val status = when {
            paid >= inv.grandTotal - 0.01 -> "PAID"
            paid > 0 -> "PARTIAL"
            else -> "UNPAID"
        }
        invoices.update(inv.copy(paidAmount = paid, status = status))
    }

    suspend fun receiveStock(product: Product, qty: Double, reason: String) {
        products.adjustStock(product.id, qty)
        stockMoves.insert(
            StockMove(productId = product.id, productName = product.name, type = "IN", qty = qty, reason = reason)
        )
    }
}
