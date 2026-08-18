package com.voltbill.pro.ui.reports

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Percent
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voltbill.pro.domain.fmtShort
import com.voltbill.pro.domain.inr
import com.voltbill.pro.domain.money
import com.voltbill.pro.domain.startOfDay
import com.voltbill.pro.domain.startOfFinancialYear
import com.voltbill.pro.domain.startOfMonth
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.MoneyRow
import com.voltbill.pro.ui.components.SectionHeader
import com.voltbill.pro.ui.components.StatCard
import com.voltbill.pro.ui.components.StatusChip
import com.voltbill.pro.ui.theme.Amber
import com.voltbill.pro.ui.theme.GreenOk
import com.voltbill.pro.ui.theme.Navy
import com.voltbill.pro.ui.theme.RedDue

@Composable
fun ReportsScreen(vm: AppViewModel) {
    val invoices by vm.invoices.collectAsStateWithLifecycle()
    val outstanding by vm.outstanding.collectAsStateWithLifecycle()
    val products by vm.products.collectAsStateWithLifecycle()

    var range by remember { mutableStateOf("Month") }
    val from = when (range) {
        "Today" -> startOfDay()
        "Month" -> startOfMonth()
        else -> startOfFinancialYear()
    }
    val period = invoices.filter { it.date >= from }

    val sales = money(period.sumOf { it.grandTotal })
    val taxable = money(period.sumOf { it.taxableValue })
    val cgst = money(period.sumOf { it.cgst })
    val sgst = money(period.sumOf { it.sgst })
    val igst = money(period.sumOf { it.igst })
    val collected = money(period.sumOf { it.paidAmount })
    val due = money(outstanding.sumOf { it.grandTotal - it.paidAmount })

    // gross profit estimate using purchase price
    val costMap = products.associate { it.id to it.purchasePrice }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            Row(
                Modifier.fillMaxWidth().padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("Today", "Month", "FY").forEach {
                    FilterChip(
                        selected = range == it, onClick = { range = it },
                        label = { Text(it) }
                    )
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp)) {
                StatCard("Sales", inr(sales), Icons.Default.TrendingUp, Navy,
                    Modifier.weight(1f), "${period.size} invoices")
                Spacer(Modifier.width(10.dp))
                StatCard("Collected", inr(collected), Icons.Default.AccountBalanceWallet,
                    GreenOk, Modifier.weight(1f), "received")
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 10.dp)) {
                StatCard("Total Tax", inr(cgst + sgst + igst), Icons.Default.Percent, Amber,
                    Modifier.weight(1f), "payable")
                Spacer(Modifier.width(10.dp))
                StatCard("Receivables", inr(due), Icons.Default.Receipt, RedDue,
                    Modifier.weight(1f), "${outstanding.size} bills")
            }
        }

        item { SectionHeader("GSTR-1 summary ($range)") }
        item {
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                shape = RoundedCornerShape(12.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(Modifier.padding(14.dp)) {
                    MoneyRow("Taxable Value", taxable)
                    MoneyRow("CGST", cgst)
                    MoneyRow("SGST", sgst)
                    MoneyRow("IGST", igst)
                    Divider(Modifier.padding(vertical = 7.dp))
                    MoneyRow("Total Tax Liability", money(cgst + sgst + igst), bold = true,
                        color = MaterialTheme.colorScheme.primary)
                    MoneyRow("Invoice Value", sales, bold = true)
                }
            }
        }

        item { SectionHeader("Sales by category") }
        item {
            val byCat = products.groupBy { it.category }
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(Modifier.padding(14.dp)) {
                    byCat.forEach { (cat, list) ->
                        val stockVal = money(list.sumOf { it.stockQty * it.purchasePrice })
                        MoneyRow("$cat  (${list.size} items)", stockVal)
                    }
                    Divider(Modifier.padding(vertical = 7.dp))
                    MoneyRow("Total Stock at Cost",
                        money(products.sumOf { it.stockQty * it.purchasePrice }), bold = true)
                }
            }
        }

        item { SectionHeader("Outstanding receivables") }
        if (outstanding.isEmpty()) {
            item {
                Card(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("All bills are settled 🎉", Modifier.padding(18.dp),
                        style = MaterialTheme.typography.bodyMedium)
                }
            }
        } else {
            items(outstanding, key = { it.id }) { inv ->
                Card(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 3.dp),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(inv.customerName, style = MaterialTheme.typography.titleSmall)
                            Text("${inv.invoiceNo} • ${fmtShort(inv.date)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Column(horizontalAlignment = androidx.compose.ui.Alignment.End) {
                            Text(inr(inv.grandTotal - inv.paidAmount),
                                style = MaterialTheme.typography.titleSmall,
                                color = RedDue, fontWeight = FontWeight.Bold)
                            StatusChip(inv.status)
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(80.dp)) }
    }
}
