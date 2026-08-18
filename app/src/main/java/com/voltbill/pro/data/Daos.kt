package com.voltbill.pro.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers WHERE active = 1 ORDER BY name COLLATE NOCASE")
    fun all(): Flow<List<Customer>>

    @Query("SELECT * FROM customers WHERE active = 1 AND (name LIKE '%' || :q || '%' OR phone LIKE '%' || :q || '%' OR city LIKE '%' || :q || '%') ORDER BY name COLLATE NOCASE")
    fun search(q: String): Flow<List<Customer>>

    @Query("SELECT * FROM customers WHERE id = :id")
    suspend fun byId(id: Long): Customer?

    @Query("SELECT COUNT(*) FROM customers WHERE active = 1")
    fun count(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(c: Customer): Long

    @Update
    suspend fun update(c: Customer)

    @Query("UPDATE customers SET active = 0 WHERE id = :id")
    suspend fun softDelete(id: Long)
}

@Dao
interface ProductDao {
    @Query("SELECT * FROM products WHERE active = 1 ORDER BY category, name COLLATE NOCASE")
    fun all(): Flow<List<Product>>

    @Query("SELECT * FROM products WHERE active = 1 AND (name LIKE '%' || :q || '%' OR brand LIKE '%' || :q || '%' OR model LIKE '%' || :q || '%' OR capacity LIKE '%' || :q || '%') ORDER BY name COLLATE NOCASE")
    fun search(q: String): Flow<List<Product>>

    @Query("SELECT * FROM products WHERE active = 1 AND stockQty <= lowStockAlert ORDER BY stockQty")
    fun lowStock(): Flow<List<Product>>

    @Query("SELECT * FROM products WHERE id = :id")
    suspend fun byId(id: Long): Product?

    @Query("SELECT IFNULL(SUM(stockQty * purchasePrice), 0) FROM products WHERE active = 1")
    fun stockValue(): Flow<Double>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(p: Product): Long

    @Update
    suspend fun update(p: Product)

    @Query("UPDATE products SET stockQty = stockQty + :delta WHERE id = :id")
    suspend fun adjustStock(id: Long, delta: Double)

    @Query("UPDATE products SET active = 0 WHERE id = :id")
    suspend fun softDelete(id: Long)
}

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM invoices ORDER BY date DESC, id DESC")
    fun all(): Flow<List<Invoice>>

    @Query("SELECT * FROM invoices WHERE invoiceNo LIKE '%' || :q || '%' OR customerName LIKE '%' || :q || '%' OR customerPhone LIKE '%' || :q || '%' ORDER BY date DESC")
    fun search(q: String): Flow<List<Invoice>>

    @Query("SELECT * FROM invoices WHERE customerId = :cid ORDER BY date DESC")
    fun forCustomer(cid: Long): Flow<List<Invoice>>

    @Query("SELECT * FROM invoices WHERE status != 'PAID' ORDER BY dueDate")
    fun outstanding(): Flow<List<Invoice>>

    @Query("SELECT * FROM invoices WHERE id = :id")
    suspend fun byId(id: Long): Invoice?

    @Query("SELECT * FROM invoices WHERE id = :id")
    fun byIdFlow(id: Long): Flow<Invoice?>

    @Query("SELECT * FROM invoice_items WHERE invoiceId = :id")
    fun itemsFor(id: Long): Flow<List<InvoiceItem>>

    @Query("SELECT * FROM invoice_items WHERE invoiceId = :id")
    suspend fun itemsForOnce(id: Long): List<InvoiceItem>

    @Query("SELECT invoiceNo FROM invoices ORDER BY id DESC LIMIT 1")
    suspend fun lastInvoiceNo(): String?

    @Query("SELECT IFNULL(SUM(grandTotal), 0) FROM invoices WHERE date BETWEEN :from AND :to")
    fun salesBetween(from: Long, to: Long): Flow<Double>

    @Query("SELECT IFNULL(SUM(grandTotal - paidAmount), 0) FROM invoices WHERE status != 'PAID'")
    fun totalDue(): Flow<Double>

    @Query("SELECT IFNULL(SUM(cgst + sgst + igst), 0) FROM invoices WHERE date BETWEEN :from AND :to")
    fun taxBetween(from: Long, to: Long): Flow<Double>

    @Query("SELECT COUNT(*) FROM invoices WHERE date BETWEEN :from AND :to")
    fun countBetween(from: Long, to: Long): Flow<Int>

    @Query("SELECT * FROM invoices WHERE date BETWEEN :from AND :to ORDER BY date DESC")
    fun between(from: Long, to: Long): Flow<List<Invoice>>

    @Insert suspend fun insert(inv: Invoice): Long
    @Insert suspend fun insertItems(items: List<InvoiceItem>)
    @Update suspend fun update(inv: Invoice)
    @Delete suspend fun delete(inv: Invoice)

    @Query("DELETE FROM invoice_items WHERE invoiceId = :id")
    suspend fun deleteItems(id: Long)

    @Transaction
    suspend fun deleteFully(inv: Invoice) {
        deleteItems(inv.id)
        delete(inv)
    }
}

@Dao
interface PaymentDao {
    @Query("SELECT * FROM payments ORDER BY date DESC, id DESC")
    fun all(): Flow<List<Payment>>

    @Query("SELECT * FROM payments WHERE invoiceId = :id ORDER BY date DESC")
    fun forInvoice(id: Long): Flow<List<Payment>>

    @Query("SELECT IFNULL(SUM(amount), 0) FROM payments WHERE date BETWEEN :from AND :to")
    fun collectedBetween(from: Long, to: Long): Flow<Double>

    @Query("SELECT IFNULL(SUM(amount), 0) FROM payments WHERE invoiceId = :id")
    suspend fun paidForInvoice(id: Long): Double

    @Insert suspend fun insert(p: Payment): Long
    @Delete suspend fun delete(p: Payment)
}

@Dao
interface WarrantyDao {
    @Query("SELECT * FROM warranties ORDER BY expiryDate")
    fun all(): Flow<List<Warranty>>

    @Query("SELECT * FROM warranties WHERE serial LIKE '%' || :q || '%' OR customerName LIKE '%' || :q || '%' OR productName LIKE '%' || :q || '%' ORDER BY expiryDate")
    fun search(q: String): Flow<List<Warranty>>

    @Query("SELECT * FROM warranties WHERE expiryDate BETWEEN :now AND :soon AND claimed = 0 ORDER BY expiryDate")
    fun expiringSoon(now: Long, soon: Long): Flow<List<Warranty>>

    @Query("SELECT COUNT(*) FROM warranties WHERE expiryDate BETWEEN :now AND :soon AND claimed = 0")
    fun expiringCount(now: Long, soon: Long): Flow<Int>

    @Insert suspend fun insert(w: Warranty): Long
    @Insert suspend fun insertAll(w: List<Warranty>)
    @Update suspend fun update(w: Warranty)
    @Delete suspend fun delete(w: Warranty)
}

@Dao
interface ServiceDao {
    @Query("SELECT * FROM service_jobs ORDER BY scheduledDate DESC")
    fun all(): Flow<List<ServiceJob>>

    @Query("SELECT * FROM service_jobs WHERE status = :s ORDER BY scheduledDate")
    fun byStatus(s: String): Flow<List<ServiceJob>>

    @Query("SELECT COUNT(*) FROM service_jobs WHERE status IN ('OPEN','IN_PROGRESS')")
    fun openCount(): Flow<Int>

    @Query("SELECT * FROM service_jobs WHERE amcEnd IS NOT NULL AND amcEnd BETWEEN :now AND :soon ORDER BY amcEnd")
    fun amcRenewals(now: Long, soon: Long): Flow<List<ServiceJob>>

    @Query("SELECT jobNo FROM service_jobs ORDER BY id DESC LIMIT 1")
    suspend fun lastJobNo(): String?

    @Insert suspend fun insert(j: ServiceJob): Long
    @Update suspend fun update(j: ServiceJob)
    @Delete suspend fun delete(j: ServiceJob)
}

@Dao
interface StockMoveDao {
    @Query("SELECT * FROM stock_moves ORDER BY date DESC LIMIT 200")
    fun recent(): Flow<List<StockMove>>

    @Insert suspend fun insert(m: StockMove): Long
}
