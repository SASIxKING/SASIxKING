package com.voltbill.pro.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.voltbill.pro.data.BusinessProfile
import com.voltbill.pro.data.Customer
import com.voltbill.pro.data.Invoice
import com.voltbill.pro.data.InvoiceItem
import com.voltbill.pro.data.Payment
import com.voltbill.pro.data.Product
import com.voltbill.pro.data.Repository
import com.voltbill.pro.data.ServiceJob
import com.voltbill.pro.data.Warranty
import com.voltbill.pro.domain.endOfDay
import com.voltbill.pro.domain.endOfMonth
import com.voltbill.pro.domain.startOfDay
import com.voltbill.pro.domain.startOfFinancialYear
import com.voltbill.pro.domain.startOfMonth
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class DashboardStats(
    val todaySales: Double = 0.0,
    val monthSales: Double = 0.0,
    val fyTax: Double = 0.0,
    val totalDue: Double = 0.0,
    val monthInvoices: Int = 0,
    val customers: Int = 0,
    val stockValue: Double = 0.0,
    val openJobs: Int = 0,
    val expiringWarranties: Int = 0
)

class AppViewModel(app: Application) : AndroidViewModel(app) {

    val repo = Repository(app)

    private val now get() = System.currentTimeMillis()

    // ---------- search queries ----------
    private val _customerQuery = MutableStateFlow("")
    val customerQuery = _customerQuery.asStateFlow()
    fun setCustomerQuery(q: String) { _customerQuery.value = q }

    private val _productQuery = MutableStateFlow("")
    val productQuery = _productQuery.asStateFlow()
    fun setProductQuery(q: String) { _productQuery.value = q }

    private val _invoiceQuery = MutableStateFlow("")
    val invoiceQuery = _invoiceQuery.asStateFlow()
    fun setInvoiceQuery(q: String) { _invoiceQuery.value = q }

    private val _warrantyQuery = MutableStateFlow("")
    val warrantyQuery = _warrantyQuery.asStateFlow()
    fun setWarrantyQuery(q: String) { _warrantyQuery.value = q }

    // ---------- lists ----------
    @OptIn(ExperimentalCoroutinesApi::class)
    val customers: StateFlow<List<Customer>> = _customerQuery
        .flatMapLatest { q -> if (q.isBlank()) repo.customers.all() else repo.customers.search(q) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val products: StateFlow<List<Product>> = _productQuery
        .flatMapLatest { q -> if (q.isBlank()) repo.products.all() else repo.products.search(q) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val invoices: StateFlow<List<Invoice>> = _invoiceQuery
        .flatMapLatest { q -> if (q.isBlank()) repo.invoices.all() else repo.invoices.search(q) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val warranties: StateFlow<List<Warranty>> = _warrantyQuery
        .flatMapLatest { q -> if (q.isBlank()) repo.warranties.all() else repo.warranties.search(q) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val payments: StateFlow<List<Payment>> = repo.payments.all()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val serviceJobs: StateFlow<List<ServiceJob>> = repo.services.all()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val lowStock: StateFlow<List<Product>> = repo.products.lowStock()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val outstanding: StateFlow<List<Invoice>> = repo.invoices.outstanding()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val profile: StateFlow<BusinessProfile> = repo.settings.profile
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), BusinessProfile())

    val darkMode: StateFlow<Boolean> = repo.settings.darkMode
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    // ---------- dashboard ----------
    val stats: StateFlow<DashboardStats> = combine(
        combine(
            repo.invoices.salesBetween(startOfDay(), endOfDay()),
            repo.invoices.salesBetween(startOfMonth(), endOfMonth()),
            repo.invoices.taxBetween(startOfFinancialYear(), now + 31_536_000_000L),
            repo.invoices.totalDue(),
            repo.invoices.countBetween(startOfMonth(), endOfMonth())
        ) { today, month, tax, due, count -> listOf(today, month, tax, due, count.toDouble()) },
        repo.customers.count(),
        repo.products.stockValue(),
        repo.services.openCount(),
        repo.warranties.expiringCount(now, now + 30L * 86_400_000L)
    ) { sales, custCount, stockVal, jobs, expiring ->
        DashboardStats(
            todaySales = sales[0],
            monthSales = sales[1],
            fyTax = sales[2],
            totalDue = sales[3],
            monthInvoices = sales[4].toInt(),
            customers = custCount,
            stockValue = stockVal,
            openJobs = jobs,
            expiringWarranties = expiring
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DashboardStats())

    // ---------- mutations ----------
    fun saveCustomer(c: Customer) = viewModelScope.launch {
        if (c.id == 0L) repo.customers.insert(c) else repo.customers.update(c)
    }

    fun deleteCustomer(id: Long) = viewModelScope.launch { repo.customers.softDelete(id) }

    fun saveProduct(p: Product) = viewModelScope.launch {
        if (p.id == 0L) repo.products.insert(p) else repo.products.update(p)
    }

    fun deleteProduct(id: Long) = viewModelScope.launch { repo.products.softDelete(id) }

    fun receiveStock(p: Product, qty: Double, reason: String) = viewModelScope.launch {
        repo.receiveStock(p, qty, reason)
    }

    fun saveInvoice(invoice: Invoice, items: List<InvoiceItem>, onDone: (Long) -> Unit) =
        viewModelScope.launch { onDone(repo.saveInvoice(invoice, items)) }

    fun deleteInvoice(inv: Invoice) = viewModelScope.launch { repo.invoices.deleteFully(inv) }

    fun recordPayment(p: Payment) = viewModelScope.launch { repo.recordPayment(p) }

    fun saveService(j: ServiceJob) = viewModelScope.launch {
        if (j.id == 0L) repo.services.insert(j) else repo.services.update(j)
    }

    fun deleteService(j: ServiceJob) = viewModelScope.launch { repo.services.delete(j) }

    fun updateWarranty(w: Warranty) = viewModelScope.launch { repo.warranties.update(w) }

    fun saveProfile(b: BusinessProfile) = viewModelScope.launch { repo.settings.save(b) }

    fun setDark(v: Boolean) = viewModelScope.launch { repo.settings.setDark(v) }

    suspend fun nextInvoiceNo() = repo.generateInvoiceNo()
    suspend fun nextJobNo() = repo.generateJobNo()
    suspend fun invoiceItems(id: Long) = repo.invoices.itemsForOnce(id)
    suspend fun invoiceById(id: Long) = repo.invoices.byId(id)
}
