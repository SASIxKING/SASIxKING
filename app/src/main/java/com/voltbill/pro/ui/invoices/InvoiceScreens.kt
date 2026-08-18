package com.voltbill.pro.ui.invoices

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voltbill.pro.data.Invoice
import com.voltbill.pro.data.InvoiceItem
import com.voltbill.pro.data.Payment
import com.voltbill.pro.domain.amountInWords
import com.voltbill.pro.domain.fmtDate
import com.voltbill.pro.domain.inr
import com.voltbill.pro.domain.money
import com.voltbill.pro.pdf.InvoicePdf
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.EmptyState
import com.voltbill.pro.ui.components.LabeledField
import com.voltbill.pro.ui.components.MoneyRow
import com.voltbill.pro.ui.components.SearchBar
import com.voltbill.pro.ui.components.StatusChip
import com.voltbill.pro.ui.dashboard.InvoiceRow
import com.voltbill.pro.ui.theme.GreenOk
import com.voltbill.pro.ui.theme.RedDue
import kotlinx.coroutines.launch

@Composable
fun InvoiceListScreen(vm: AppViewModel, onOpen: (Long) -> Unit) {
    val invoices by vm.invoices.collectAsStateWithLifecycle()
    val query by vm.invoiceQuery.collectAsStateWithLifecycle()

    Column(Modifier.fillMaxSize()) {
        SearchBar(query, { vm.setInvoiceQuery(it) }, "Search invoice no, customer, phone")
        if (invoices.isEmpty()) {
            EmptyState(
                Icons.AutoMirrored.Filled.ReceiptLong,
                "No invoices found",
                "Create a bill with the + button"
            )
        } else {
            LazyColumn {
                items(invoices, key = { it.id }) { inv -> InvoiceRow(inv) { onOpen(inv.id) } }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceDetailScreen(vm: AppViewModel, invoiceId: Long, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val profile by vm.profile.collectAsStateWithLifecycle()

    var invoice by remember { mutableStateOf<Invoice?>(null) }
    var items by remember { mutableStateOf<List<InvoiceItem>>(emptyList()) }
    var showPayment by remember { mutableStateOf(false) }
    var showDelete by remember { mutableStateOf(false) }
    var refresh by remember { mutableStateOf(0) }

    LaunchedEffect(invoiceId, refresh) {
        invoice = vm.invoiceById(invoiceId)
        items = vm.invoiceItems(invoiceId)
    }

    val inv = invoice

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(inv?.invoiceNo ?: "Invoice", style = MaterialTheme.typography.titleMedium) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showDelete = true }) {
                        Icon(Icons.Default.Delete, "Delete")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { pad ->
        if (inv == null) return@Scaffold

        LazyColumn(Modifier.fillMaxSize().padding(pad)) {
            item {
                Card(
                    Modifier.fillMaxWidth().padding(14.dp),
                    shape = RoundedCornerShape(12.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(inv.customerName, style = MaterialTheme.typography.titleMedium)
                                if (inv.customerPhone.isNotBlank()) {
                                    Text(inv.customerPhone,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                if (inv.customerGstin.isNotBlank()) {
                                    Text("GSTIN ${inv.customerGstin}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            StatusChip(inv.status)
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("${fmtDate(inv.date)}  •  ${inv.paymentMode}  •  ${inv.placeOfSupply}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            item {
                Text("ITEMS", Modifier.padding(start = 16.dp, bottom = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            items(items, key = { it.id }) { it2 ->
                Card(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 3.dp),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(it2.name, style = MaterialTheme.typography.titleSmall)
                            Text(
                                "${trim(it2.qty)} ${it2.unit} × ${inr(it2.rate)}  •  GST ${trim(it2.gstRate)}%" +
                                    if (it2.hsn.isNotBlank()) "  •  HSN ${it2.hsn}" else "",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (it2.serials.isNotBlank()) {
                                Text("S/N ${it2.serials}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary)
                            }
                        }
                        Text(inr(it2.lineTotal), style = MaterialTheme.typography.titleSmall)
                    }
                }
            }

            item {
                Card(
                    Modifier.fillMaxWidth().padding(14.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                ) {
                    Column(Modifier.padding(14.dp)) {
                        MoneyRow("Taxable Value", inv.taxableValue)
                        if (inv.interState) MoneyRow("IGST", inv.igst) else {
                            MoneyRow("CGST", inv.cgst); MoneyRow("SGST", inv.sgst)
                        }
                        if (inv.exchangeDeduction > 0) MoneyRow("Exchange", -inv.exchangeDeduction)
                        if (inv.roundOff != 0.0) MoneyRow("Round Off", inv.roundOff)
                        Divider(Modifier.padding(vertical = 7.dp))
                        MoneyRow("Grand Total", inv.grandTotal, bold = true,
                            color = MaterialTheme.colorScheme.primary)
                        MoneyRow("Paid", inv.paidAmount, color = GreenOk)
                        val bal = money(inv.grandTotal - inv.paidAmount)
                        if (bal > 0.01) MoneyRow("Balance Due", bal, bold = true, color = RedDue)
                        Spacer(Modifier.height(8.dp))
                        Text(amountInWords(inv.grandTotal),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                val file = InvoicePdf.generate(context, inv, items, profile)
                                InvoicePdf.share(context, file, "Invoice ${inv.invoiceNo}")
                            }
                        },
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(11.dp)
                    ) {
                        Icon(Icons.Default.Share, null, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(7.dp))
                        Text("Share PDF")
                    }
                    Spacer(Modifier.width(10.dp))
                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                val file = InvoicePdf.generate(context, inv, items, profile)
                                Toast.makeText(
                                    context, "Saved: ${file.name}", Toast.LENGTH_SHORT
                                ).show()
                            }
                        },
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(11.dp)
                    ) {
                        Icon(Icons.Default.PictureAsPdf, null, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(7.dp))
                        Text("Save PDF")
                    }
                }
            }

            if (inv.status != "PAID") {
                item {
                    Button(
                        onClick = { showPayment = true },
                        modifier = Modifier.fillMaxWidth().padding(14.dp).height(46.dp),
                        shape = RoundedCornerShape(11.dp)
                    ) {
                        Icon(Icons.Default.Payments, null, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(7.dp))
                        Text("Record Payment")
                    }
                }
            }
            item { Spacer(Modifier.height(60.dp)) }
        }
    }

    if (showPayment && inv != null) {
        val balance = money(inv.grandTotal - inv.paidAmount)
        var amount by remember(inv.id, balance) { mutableStateOf(trim(balance)) }
        var mode by remember { mutableStateOf("Cash") }
        var ref by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showPayment = false },
            title = { Text("Record Payment") },
            text = {
                Column {
                    Text("Balance due ${inr(balance)}",
                        style = MaterialTheme.typography.bodyMedium, color = RedDue)
                    LabeledField("Amount (₹)", amount, { amount = it }, numeric = true)
                    LabeledField("Mode", mode, { mode = it })
                    LabeledField("Reference / UTR", ref, { ref = it })
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    vm.recordPayment(
                        Payment(
                            invoiceId = inv.id,
                            customerId = inv.customerId,
                            customerName = inv.customerName,
                            invoiceNo = inv.invoiceNo,
                            amount = amount.toDoubleOrNull() ?: 0.0,
                            mode = mode,
                            reference = ref
                        )
                    )
                    showPayment = false
                    refresh++
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { showPayment = false }) { Text("Cancel") } }
        )
    }

    if (showDelete && inv != null) {
        AlertDialog(
            onDismissRequest = { showDelete = false },
            title = { Text("Delete invoice?") },
            text = { Text("${inv.invoiceNo} will be permanently removed. Stock is not restored automatically.") },
            confirmButton = {
                TextButton(onClick = {
                    vm.deleteInvoice(inv); showDelete = false; onBack()
                }) { Text("Delete", color = RedDue) }
            },
            dismissButton = { TextButton(onClick = { showDelete = false }) { Text("Cancel") } }
        )
    }
}
