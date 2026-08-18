package com.voltbill.pro.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Percent
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voltbill.pro.data.Invoice
import com.voltbill.pro.domain.fmtShort
import com.voltbill.pro.domain.inr
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.SectionHeader
import com.voltbill.pro.ui.components.StatCard
import com.voltbill.pro.ui.components.StatusChip
import com.voltbill.pro.ui.theme.Amber
import com.voltbill.pro.ui.theme.GreenOk
import com.voltbill.pro.ui.theme.Navy
import com.voltbill.pro.ui.theme.NavyDark
import com.voltbill.pro.ui.theme.RedDue

@Composable
fun DashboardScreen(vm: AppViewModel, onOpenInvoice: (Long) -> Unit, onNewInvoice: () -> Unit) {
    val stats by vm.stats.collectAsStateWithLifecycle()
    val profile by vm.profile.collectAsStateWithLifecycle()
    val invoices by vm.invoices.collectAsStateWithLifecycle()
    val lowStock by vm.lowStock.collectAsStateWithLifecycle()

    LazyColumn(Modifier.fillMaxWidth()) {
        item {
            // hero
            Box(
                Modifier.fillMaxWidth().background(
                    Brush.linearGradient(listOf(Navy, NavyDark))
                ).padding(18.dp)
            ) {
                Column {
                    Text(
                        profile.name,
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White
                    )
                    Text(
                        "GSTIN ${profile.gstin}",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.75f)
                    )
                    Spacer(Modifier.height(16.dp))
                    Text(
                        "Sales this month",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.75f)
                    )
                    Text(
                        inr(stats.monthSales),
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.White
                    )
                    Spacer(Modifier.height(10.dp))
                    Row {
                        HeroPill("${stats.monthInvoices} invoices")
                        Spacer(Modifier.width(8.dp))
                        HeroPill("Today ${inr(stats.todaySales)}")
                    }
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 14.dp)) {
                StatCard(
                    "Outstanding", inr(stats.totalDue), Icons.Default.AccountBalanceWallet,
                    RedDue, Modifier.weight(1f), "to be collected"
                )
                Spacer(Modifier.width(10.dp))
                StatCard(
                    "Stock Value", inr(stats.stockValue), Icons.Default.Inventory2,
                    Navy, Modifier.weight(1f), "at cost"
                )
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 10.dp)) {
                StatCard(
                    "GST Payable", inr(stats.fyTax), Icons.Default.Percent,
                    Amber, Modifier.weight(1f), "this FY"
                )
                Spacer(Modifier.width(10.dp))
                StatCard(
                    "Customers", "${stats.customers}", Icons.Default.Groups,
                    GreenOk, Modifier.weight(1f), "active"
                )
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 10.dp)) {
                StatCard(
                    "Open Jobs", "${stats.openJobs}", Icons.Default.Build,
                    Color(0xFF7C3AED), Modifier.weight(1f), "service / AMC"
                )
                Spacer(Modifier.width(10.dp))
                StatCard(
                    "Warranty Alerts", "${stats.expiringWarranties}", Icons.Default.Shield,
                    Color(0xFF0891B2), Modifier.weight(1f), "expiring in 30d"
                )
            }
        }

        if (lowStock.isNotEmpty()) {
            item { SectionHeader("Low stock alert") }
            item {
                Card(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                    colors = CardDefaults.cardColors(containerColor = RedDue.copy(alpha = 0.07f)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(Modifier.padding(12.dp)) {
                        lowStock.take(4).forEach { p ->
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.Warning, null, tint = RedDue,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Spacer(Modifier.width(7.dp))
                                    Text(p.name, style = MaterialTheme.typography.bodyMedium)
                                }
                                Text(
                                    "${p.stockQty.toInt()} left",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = RedDue, fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            SectionHeader("Recent invoices") {
                Text(
                    "New +",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable { onNewInvoice() }
                )
            }
        }

        if (invoices.isEmpty()) {
            item {
                Card(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.ReceiptLong, null,
                            modifier = Modifier.size(40.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("No invoices yet", style = MaterialTheme.typography.titleSmall)
                        Text(
                            "Tap the + button to create your first bill",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        } else {
            items(invoices.take(6), key = { it.id }) { inv ->
                InvoiceRow(inv) { onOpenInvoice(inv.id) }
            }
        }

        item { Spacer(Modifier.height(80.dp)) }
    }
}

@Composable
private fun HeroPill(text: String) {
    Surface(color = Color.White.copy(alpha = 0.16f), shape = RoundedCornerShape(20.dp)) {
        Text(
            text, color = Color.White,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
        )
    }
}

@Composable
fun InvoiceRow(inv: Invoice, onClick: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp).clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier.size(38.dp).background(
                    MaterialTheme.colorScheme.primaryContainer, CircleShape
                ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    inv.customerName.take(1).uppercase(),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    inv.customerName,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1
                )
                Text(
                    "${inv.invoiceNo}  •  ${fmtShort(inv.date)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(inr(inv.grandTotal), style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(3.dp))
                StatusChip(inv.status)
            }
        }
    }
}
