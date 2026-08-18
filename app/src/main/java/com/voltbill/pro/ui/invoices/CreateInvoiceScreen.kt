package com.voltbill.pro.ui.invoices

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voltbill.pro.data.Customer
import com.voltbill.pro.data.Invoice
import com.voltbill.pro.data.InvoiceItem
import com.voltbill.pro.data.Product
import com.voltbill.pro.domain.LineTax
import com.voltbill.pro.domain.computeLine
import com.voltbill.pro.domain.computeTotals
import com.voltbill.pro.domain.fmtDate
import com.voltbill.pro.domain.inr
import com.voltbill.pro.domain.money
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.LabeledField
import com.voltbill.pro.ui.components.MoneyRow
import com.voltbill.pro.ui.components.SearchBar
import com.voltbill.pro.ui.theme.GreenOk
import com.voltbill.pro.ui.theme.RedDue
import kotlinx.coroutines.launch
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope

/** Editable cart line held in UI state before persisting. */
data class CartLine(
    val product: Product,
    var qty: Double = 1.0,
    var rate: Double = product.sellingPrice,
    var discountPct: Double = 0.0,
    var serials: String = ""
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateInvoiceScreen(vm: AppViewModel, onBack: () -> Unit, onSaved: (Long) -> Unit) {
    val customers by vm.customers.collectAsStateWithLifecycle()
    val products by vm.products.collectAsStateWithLifecycle()
    val profile by vm.profile.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    var invoiceNo by remember { mutableStateOf("...") }
    LaunchedEffect(Unit) { invoiceNo = vm.nextInvoiceNo() }

    var customer by remember { mutableStateOf<Customer?>(null) }
    val cart = remember { mutableStateListOf<CartLine>() }
    var interState by remember { mutableStateOf(false) }
    var exchange by remember { mutableStateOf("") }
    var paid by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("Cash") }
    var notes by remember { mutableStateOf("") }

    var showCustomerPicker by remember { mutableStateOf(false) }
    var showProductPicker by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Int?>(null) }

    val lines: List<LineTax> = cart.map {
        computeLine(it.qty, it.rate, it.discountPct, it.product.gstRate, interState)
    }
    val gross = cart.sumOf { it.qty * it.rate }
    val totals = computeTotals(lines, gross, exchange.toDoubleOrNull() ?: 0.0)
    val discountTotal = money(gross - totals.taxable)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("New Invoice", style = MaterialTheme.typography.titleMedium)
                        Text(
                            invoiceNo,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        bottomBar = {
            Surface(shadowElevation = 12.dp) {
                Column(Modifier.padding(14.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Grand Total", style = MaterialTheme.typography.titleMedium)
                        Text(
                            inr(totals.grandTotal),
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = {
                            val c = customer ?: return@Button
                            val paidAmt = paid.toDoubleOrNull() ?: 0.0
                            val status = when {
                                paidAmt >= totals.grandTotal - 0.01 -> "PAID"
                                paidAmt > 0 -> "PARTIAL"
                                else -> "UNPAID"
                            }
                            val inv = Invoice(
                                invoiceNo = invoiceNo,
                                customerId = c.id,
                                customerName = c.name,
                                customerPhone = c.phone,
                                customerGstin = c.gstin,
                                customerAddress = listOf(c.address, c.city, c.pincode)
                                    .filter { it.isNotBlank() }.joinToString(", "),
                                placeOfSupply = "${c.stateCode}-${c.state}",
                                interState = interState,
                                subTotal = totals.subTotal,
                                discount = discountTotal,
                                taxableValue = totals.taxable,
                                cgst = totals.cgst, sgst = totals.sgst, igst = totals.igst,
                                exchangeDeduction = totals.exchange,
                                roundOff = totals.roundOff,
                                grandTotal = totals.grandTotal,
                                paidAmount = paidAmt,
                                status = status,
                                paymentMode = mode,
                                notes = notes
                            )
                            val items = cart.mapIndexed { i, l ->
                                val t = lines[i]
                                InvoiceItem(
                                    invoiceId = 0,
                                    productId = l.product.id,
                                    name = l.product.name,
                                    hsn = l.product.hsn,
                                    serials = l.serials,
                                    qty = l.qty,
                                    unit = l.product.unit,
                                    rate = l.rate,
                                    discountPct = l.discountPct,
                                    gstRate = l.product.gstRate,
                                    taxable = t.taxable,
                                    cgst = t.cgst, sgst = t.sgst, igst = t.igst,
                                    lineTotal = t.total,
                                    warrantyMonths = l.product.warrantyMonths
                                )
                            }
                            vm.saveInvoice(inv, items) { id -> onSaved(id) }
                        },
                        enabled = customer != null && cart.isNotEmpty(),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Check, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Save Invoice")
                    }
                }
            }
        }
    ) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad)) {
            // customer selector
            item {
                Card(
                    Modifier.fillMaxWidth().padding(14.dp).clickable { showCustomerPicker = true },
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (customer == null)
                            MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.25f)
                        else MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
                    )
                ) {
                    Row(
                        Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Person, null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                customer?.name ?: "Select customer",
                                style = MaterialTheme.typography.titleSmall
                            )
                            Text(
                                customer?.let {
                                    listOfNotNull(
                                        it.phone.ifBlank { null },
                                        it.gstin.ifBlank { null } ?: it.city.ifBlank { null }
                                    ).joinToString(" • ")
                                } ?: "Required to save the bill",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Text("Change", color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.labelLarge)
                    }
                }
            }

            // items
            item {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("ITEMS (${cart.size})", style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TextButton(onClick = { showProductPicker = true }) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Add item")
                    }
                }
            }

            if (cart.isEmpty()) {
                item {
                    Card(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp)
                            .clickable { showProductPicker = true },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            Modifier.fillMaxWidth().padding(22.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(Icons.Default.Add, null,
                                tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(6.dp))
                            Text("Add batteries, inverters or services",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            itemsIndexed(cart) { i, line ->
                val t = lines[i]
                Card(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp)
                        .clickable { editing = i },
                    shape = RoundedCornerShape(12.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(line.product.name,
                                    style = MaterialTheme.typography.titleSmall)
                                Text(
                                    "${trim(line.qty)} ${line.product.unit} × ${inr(line.rate)}" +
                                        (if (line.discountPct > 0) "  −${trim(line.discountPct)}%" else "") +
                                        "   GST ${trim(line.product.gstRate)}%",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (line.serials.isNotBlank()) {
                                    Text("S/N ${line.serials}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary)
                                }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(inr(t.total), style = MaterialTheme.typography.titleSmall)
                                Text("incl. tax", style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            IconButton(onClick = { cart.removeAt(i) }) {
                                Icon(Icons.Default.Delete, "Remove",
                                    tint = RedDue, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }

            // tax + payment options
            item {
                Card(
                    Modifier.fillMaxWidth().padding(14.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = interState, onCheckedChange = { interState = it })
                            Column {
                                Text("Inter-state supply (IGST)",
                                    style = MaterialTheme.typography.bodyMedium)
                                Text("Tick when customer is outside ${profile.state}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        LabeledField("Old battery exchange (₹)", exchange, { exchange = it },
                            numeric = true)
                        LabeledField("Amount received (₹)", paid, { paid = it }, numeric = true)
                        Spacer(Modifier.height(6.dp))
                        Text("PAYMENT MODE", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("Cash", "UPI", "Card", "Bank", "Credit").forEach { m ->
                                FilterChip(
                                    selected = mode == m,
                                    onClick = { mode = m },
                                    label = { Text(m, style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                        LabeledField("Notes", notes, { notes = it })
                    }
                }
            }

            // totals summary
            item {
                Card(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                ) {
                    Column(Modifier.padding(14.dp)) {
                        MoneyRow("Sub Total", totals.subTotal)
                        if (discountTotal > 0) MoneyRow("Discount", -discountTotal)
                        MoneyRow("Taxable Value", totals.taxable)
                        if (interState) MoneyRow("IGST", totals.igst)
                        else {
                            MoneyRow("CGST", totals.cgst)
                            MoneyRow("SGST", totals.sgst)
                        }
                        if (totals.exchange > 0) MoneyRow("Exchange", -totals.exchange)
                        if (totals.roundOff != 0.0) MoneyRow("Round Off", totals.roundOff)
                        Divider(Modifier.padding(vertical = 7.dp))
                        MoneyRow("Grand Total", totals.grandTotal, bold = true,
                            color = MaterialTheme.colorScheme.primary)
                        val paidAmt = paid.toDoubleOrNull() ?: 0.0
                        if (paidAmt > 0) {
                            MoneyRow("Paid", paidAmt, color = GreenOk)
                            val bal = money(totals.grandTotal - paidAmt)
                            if (bal > 0) MoneyRow("Balance", bal, bold = true, color = RedDue)
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(20.dp)) }
        }
    }

    if (showCustomerPicker) {
        PickerDialog(
            title = "Select Customer",
            onDismiss = { showCustomerPicker = false }
        ) {
            SearchBar(vm.customerQuery.collectAsStateWithLifecycle().value,
                { vm.setCustomerQuery(it) }, "Search name or phone")
            LazyColumn(Modifier.heightIn(max = 380.dp)) {
                items(customers, key = { it.id }) { c ->
                    Column(
                        Modifier.fillMaxWidth().clickable {
                            customer = c
                            interState = c.stateCode != profile.stateCode && c.stateCode.isNotBlank()
                            showCustomerPicker = false
                        }.padding(horizontal = 16.dp, vertical = 11.dp)
                    ) {
                        Text(c.name, style = MaterialTheme.typography.titleSmall)
                        Text(
                            listOfNotNull(
                                c.phone.ifBlank { null }, c.city.ifBlank { null },
                                c.gstin.ifBlank { null }
                            ).joinToString(" • "),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Divider()
                }
            }
        }
    }

    if (showProductPicker) {
        PickerDialog(title = "Add Item", onDismiss = { showProductPicker = false }) {
            SearchBar(vm.productQuery.collectAsStateWithLifecycle().value,
                { vm.setProductQuery(it) }, "Search product, brand, capacity")
            LazyColumn(Modifier.heightIn(max = 380.dp)) {
                items(products, key = { it.id }) { p ->
                    Row(
                        Modifier.fillMaxWidth().clickable {
                            cart.add(CartLine(product = p))
                            showProductPicker = false
                        }.padding(horizontal = 16.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(p.name, style = MaterialTheme.typography.titleSmall)
                            Text(
                                listOfNotNull(
                                    p.brand.ifBlank { null }, p.capacity.ifBlank { null },
                                    "GST ${trim(p.gstRate)}%",
                                    if (p.category != "Service") "Stock ${trim(p.stockQty)}" else null
                                ).joinToString(" • "),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (p.stockQty <= 0 && p.category != "Service") RedDue
                                else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Text(inr(p.sellingPrice), style = MaterialTheme.typography.titleSmall)
                    }
                    Divider()
                }
            }
        }
    }

    editing?.let { idx ->
        if (idx < cart.size) {
            EditLineDialog(
                line = cart[idx],
                onDismiss = { editing = null },
                onSave = { q, r, d, s ->
                    cart[idx] = cart[idx].copy(qty = q, rate = r, discountPct = d, serials = s)
                    editing = null
                }
            )
        }
    }
}

@Composable
private fun PickerDialog(title: String, onDismiss: () -> Unit, content: @Composable () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Column { content() } },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } }
    )
}

@Composable
private fun EditLineDialog(
    line: CartLine,
    onDismiss: () -> Unit,
    onSave: (Double, Double, Double, String) -> Unit
) {
    var qty by remember { mutableStateOf(trim(line.qty)) }
    var rate by remember { mutableStateOf(trim(line.rate)) }
    var disc by remember { mutableStateOf(trim(line.discountPct)) }
    var serials by remember { mutableStateOf(line.serials) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(line.product.name, style = MaterialTheme.typography.titleSmall) },
        text = {
            Column {
                LabeledField("Quantity", qty, { qty = it }, numeric = true)
                LabeledField("Rate (₹)", rate, { rate = it }, numeric = true)
                LabeledField("Discount %", disc, { disc = it }, numeric = true)
                if (line.product.trackSerial || line.product.warrantyMonths > 0) {
                    LabeledField(
                        "Serial numbers (comma separated)", serials, { serials = it },
                        placeholder = "EX150-2291, EX150-2292"
                    )
                    Text(
                        "Warranty ${line.product.warrantyMonths} months — a warranty card is created per serial.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onSave(
                    qty.toDoubleOrNull() ?: 1.0,
                    rate.toDoubleOrNull() ?: line.rate,
                    disc.toDoubleOrNull() ?: 0.0,
                    serials
                )
            }) { Text("Update") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

fun trim(v: Double): String =
    if (v == v.toLong().toDouble()) v.toLong().toString() else String.format("%.2f", v)
