package com.voltbill.pro.ui.products

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddBox
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voltbill.pro.data.Product
import com.voltbill.pro.domain.inr
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.EmptyState
import com.voltbill.pro.ui.components.LabeledField
import com.voltbill.pro.ui.components.SearchBar
import com.voltbill.pro.ui.invoices.trim
import com.voltbill.pro.ui.theme.GreenOk
import com.voltbill.pro.ui.theme.RedDue

private val CATEGORIES = listOf("All", "Battery", "Inverter", "Solar", "Stabilizer", "Accessory", "Service")

@Composable
fun ProductScreen(vm: AppViewModel, editing: Product?, onEdit: (Product?) -> Unit) {
    val products by vm.products.collectAsStateWithLifecycle()
    val query by vm.productQuery.collectAsStateWithLifecycle()
    var category by remember { mutableStateOf("All") }
    var restocking by remember { mutableStateOf<Product?>(null) }
    var deleting by remember { mutableStateOf<Product?>(null) }

    val filtered = products.filter { category == "All" || it.category == category }

    Column(Modifier.fillMaxSize()) {
        SearchBar(query, { vm.setProductQuery(it) }, "Search product, brand, capacity")
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                .padding(horizontal = 14.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            CATEGORIES.forEach { cat ->
                FilterChip(
                    selected = category == cat,
                    onClick = { category = cat },
                    label = { Text(cat, style = MaterialTheme.typography.labelSmall) }
                )
            }
        }

        if (filtered.isEmpty()) {
            EmptyState(Icons.Default.Inventory2, "No products", "Add stock items with +")
        } else {
            LazyColumn {
                items(filtered, key = { it.id }) { p ->
                    val low = p.stockQty <= p.lowStockAlert && p.category != "Service"
                    Card(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp)
                            .clickable { onEdit(p) },
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(p.name, style = MaterialTheme.typography.titleSmall)
                                    Text(
                                        listOfNotNull(
                                            p.brand.ifBlank { null }, p.capacity.ifBlank { null },
                                            "HSN ${p.hsn}", "GST ${trim(p.gstRate)}%"
                                        ).joinToString(" • "),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    if (p.warrantyMonths > 0) {
                                        Text("Warranty ${p.warrantyMonths} months",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.primary)
                                    }
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(inr(p.sellingPrice),
                                        style = MaterialTheme.typography.titleSmall)
                                    if (p.category != "Service") {
                                        Surface(
                                            color = if (low) RedDue.copy(alpha = 0.12f)
                                            else GreenOk.copy(alpha = 0.12f),
                                            shape = RoundedCornerShape(5.dp)
                                        ) {
                                            Text(
                                                "Stock ${trim(p.stockQty)}",
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                color = if (low) RedDue else GreenOk,
                                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                            )
                                        }
                                    }
                                }
                                IconButton(onClick = { restocking = p }) {
                                    Icon(Icons.Default.AddBox, "Add stock",
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(20.dp))
                                }
                                IconButton(onClick = { deleting = p }) {
                                    Icon(Icons.Default.Delete, "Delete", tint = RedDue,
                                        modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }

    editing?.let { p ->
        ProductDialog(p, onDismiss = { onEdit(null) }, onSave = { vm.saveProduct(it); onEdit(null) })
    }

    restocking?.let { p ->
        var qty by remember { mutableStateOf("") }
        var reason by remember { mutableStateOf("Purchase") }
        AlertDialog(
            onDismissRequest = { restocking = null },
            title = { Text("Add stock — ${p.name}") },
            text = {
                Column {
                    Text("Current: ${trim(p.stockQty)} ${p.unit}",
                        style = MaterialTheme.typography.bodyMedium)
                    LabeledField("Quantity received", qty, { qty = it }, numeric = true)
                    LabeledField("Reason / Bill no", reason, { reason = it })
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    vm.receiveStock(p, qty.toDoubleOrNull() ?: 0.0, reason)
                    restocking = null
                }) { Text("Add") }
            },
            dismissButton = { TextButton(onClick = { restocking = null }) { Text("Cancel") } }
        )
    }

    deleting?.let { p ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Remove ${p.name}?") },
            text = { Text("The item is archived and hidden from new bills.") },
            confirmButton = {
                TextButton(onClick = { vm.deleteProduct(p.id); deleting = null }) {
                    Text("Remove", color = RedDue)
                }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } }
        )
    }
}

@Composable
fun ProductDialog(product: Product, onDismiss: () -> Unit, onSave: (Product) -> Unit) {
    var name by remember { mutableStateOf(product.name) }
    var category by remember { mutableStateOf(product.category) }
    var brand by remember { mutableStateOf(product.brand) }
    var model by remember { mutableStateOf(product.model) }
    var hsn by remember { mutableStateOf(product.hsn) }
    var unit by remember { mutableStateOf(product.unit) }
    var capacity by remember { mutableStateOf(product.capacity) }
    var purchase by remember { mutableStateOf(if (product.purchasePrice == 0.0) "" else trim(product.purchasePrice)) }
    var selling by remember { mutableStateOf(if (product.sellingPrice == 0.0) "" else trim(product.sellingPrice)) }
    var gst by remember { mutableStateOf(trim(product.gstRate)) }
    var stock by remember { mutableStateOf(trim(product.stockQty)) }
    var lowAlert by remember { mutableStateOf(trim(product.lowStockAlert)) }
    var warranty by remember { mutableStateOf(product.warrantyMonths.toString()) }
    var exchange by remember { mutableStateOf(trim(product.exchangeValue)) }
    var trackSerial by remember { mutableStateOf(product.trackSerial) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (product.id == 0L) "New Product" else "Edit Product") },
        text = {
            Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState())) {
                LabeledField("Name *", name, { name = it })
                Text("CATEGORY", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    CATEGORIES.drop(1).forEach {
                        FilterChip(
                            selected = category == it, onClick = { category = it },
                            label = { Text(it, style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }
                Row {
                    LabeledField("Brand", brand, { brand = it }, Modifier.weight(1f))
                    Spacer(Modifier.width(8.dp))
                    LabeledField("Model", model, { model = it }, Modifier.weight(1f))
                }
                Row {
                    LabeledField("Capacity", capacity, { capacity = it }, Modifier.weight(1f))
                    Spacer(Modifier.width(8.dp))
                    LabeledField("Unit", unit, { unit = it }, Modifier.weight(1f))
                }
                Row {
                    LabeledField("HSN", hsn, { hsn = it }, Modifier.weight(1f), numeric = true)
                    Spacer(Modifier.width(8.dp))
                    LabeledField("GST %", gst, { gst = it }, Modifier.weight(1f), numeric = true)
                }
                Row {
                    LabeledField("Purchase ₹", purchase, { purchase = it }, Modifier.weight(1f), numeric = true)
                    Spacer(Modifier.width(8.dp))
                    LabeledField("Selling ₹", selling, { selling = it }, Modifier.weight(1f), numeric = true)
                }
                Row {
                    LabeledField("Stock", stock, { stock = it }, Modifier.weight(1f), numeric = true)
                    Spacer(Modifier.width(8.dp))
                    LabeledField("Low alert", lowAlert, { lowAlert = it }, Modifier.weight(1f), numeric = true)
                }
                Row {
                    LabeledField("Warranty (months)", warranty, { warranty = it }, Modifier.weight(1f), numeric = true)
                    Spacer(Modifier.width(8.dp))
                    LabeledField("Exchange ₹", exchange, { exchange = it }, Modifier.weight(1f), numeric = true)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = trackSerial, onCheckedChange = { trackSerial = it })
                    Text("Track serial numbers", style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank(),
                onClick = {
                    onSave(
                        product.copy(
                            name = name.trim(), category = category, brand = brand.trim(),
                            model = model.trim(), hsn = hsn.trim(), unit = unit.trim().ifBlank { "Nos" },
                            capacity = capacity.trim(),
                            purchasePrice = purchase.toDoubleOrNull() ?: 0.0,
                            sellingPrice = selling.toDoubleOrNull() ?: 0.0,
                            gstRate = gst.toDoubleOrNull() ?: 18.0,
                            stockQty = stock.toDoubleOrNull() ?: 0.0,
                            lowStockAlert = lowAlert.toDoubleOrNull() ?: 3.0,
                            warrantyMonths = warranty.toIntOrNull() ?: 0,
                            exchangeValue = exchange.toDoubleOrNull() ?: 0.0,
                            trackSerial = trackSerial
                        )
                    )
                }
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
