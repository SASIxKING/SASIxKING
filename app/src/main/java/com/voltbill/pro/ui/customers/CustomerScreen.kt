package com.voltbill.pro.ui.customers

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import com.voltbill.pro.data.Customer
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.EmptyState
import com.voltbill.pro.ui.components.LabeledField
import com.voltbill.pro.ui.components.SearchBar
import com.voltbill.pro.ui.theme.RedDue

@Composable
fun CustomerScreen(vm: AppViewModel, editing: Customer?, onEdit: (Customer?) -> Unit) {
    val customers by vm.customers.collectAsStateWithLifecycle()
    val query by vm.customerQuery.collectAsStateWithLifecycle()
    var deleting by remember { mutableStateOf<Customer?>(null) }

    Column(Modifier.fillMaxSize()) {
        SearchBar(query, { vm.setCustomerQuery(it) }, "Search customer, phone, city")
        if (customers.isEmpty()) {
            EmptyState(Icons.Default.Groups, "No customers", "Add your first customer with +")
        } else {
            LazyColumn {
                items(customers, key = { it.id }) { c ->
                    Card(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp)
                            .clickable { onEdit(c) },
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier.size(40.dp).background(
                                    MaterialTheme.colorScheme.primaryContainer, CircleShape
                                ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    c.name.take(1).uppercase(),
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(c.name, style = MaterialTheme.typography.titleSmall)
                                    Spacer(Modifier.width(6.dp))
                                    Surface(
                                        color = MaterialTheme.colorScheme.secondaryContainer,
                                        shape = RoundedCornerShape(5.dp)
                                    ) {
                                        Text(
                                            c.type,
                                            style = MaterialTheme.typography.labelSmall,
                                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                        )
                                    }
                                }
                                Text(
                                    listOfNotNull(
                                        c.phone.ifBlank { null }, c.city.ifBlank { null }
                                    ).joinToString(" • "),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (c.gstin.isNotBlank()) {
                                    Text(
                                        "GSTIN ${c.gstin}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                            IconButton(onClick = { deleting = c }) {
                                Icon(Icons.Default.Delete, "Delete", tint = RedDue,
                                    modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }

    editing?.let { c -> CustomerDialog(c, onDismiss = { onEdit(null) }, onSave = {
        vm.saveCustomer(it); onEdit(null)
    }) }

    deleting?.let { c ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Remove ${c.name}?") },
            text = { Text("The customer is archived; existing invoices are kept.") },
            confirmButton = {
                TextButton(onClick = { vm.deleteCustomer(c.id); deleting = null }) {
                    Text("Remove", color = RedDue)
                }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } }
        )
    }
}

@Composable
fun CustomerDialog(customer: Customer, onDismiss: () -> Unit, onSave: (Customer) -> Unit) {
    var name by remember(customer.id) { mutableStateOf(customer.name) }
    var phone by remember(customer.id) { mutableStateOf(customer.phone) }
    var email by remember(customer.id) { mutableStateOf(customer.email) }
    var gstin by remember(customer.id) { mutableStateOf(customer.gstin) }
    var address by remember(customer.id) { mutableStateOf(customer.address) }
    var city by remember(customer.id) { mutableStateOf(customer.city) }
    var state by remember(customer.id) { mutableStateOf(customer.state) }
    var stateCode by remember(customer.id) { mutableStateOf(customer.stateCode) }
    var pincode by remember(customer.id) { mutableStateOf(customer.pincode) }
    var type by remember(customer.id) { mutableStateOf(customer.type) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (customer.id == 0L) "New Customer" else "Edit Customer") },
        text = {
            Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState())) {
                LabeledField("Name *", name, { name = it })
                LabeledField("Phone", phone, { phone = it }, numeric = true)
                LabeledField("Email", email, { email = it })
                LabeledField("GSTIN", gstin, { gstin = it })
                LabeledField("Address", address, { address = it }, singleLine = false)
                Row {
                    LabeledField("City", city, { city = it }, Modifier.weight(1f))
                    Spacer(Modifier.width(8.dp))
                    LabeledField("Pincode", pincode, { pincode = it }, Modifier.weight(1f), numeric = true)
                }
                Row {
                    LabeledField("State", state, { state = it }, Modifier.weight(2f))
                    Spacer(Modifier.width(8.dp))
                    LabeledField("Code", stateCode, { stateCode = it }, Modifier.weight(1f), numeric = true)
                }
                Spacer(Modifier.height(6.dp))
                Text("TYPE", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Retail", "Dealer", "Corporate", "AMC").forEach {
                        FilterChip(
                            selected = type == it, onClick = { type = it },
                            label = { Text(it, style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank(),
                onClick = {
                    onSave(
                        customer.copy(
                            name = name.trim(), phone = phone.trim(), email = email.trim(),
                            gstin = gstin.trim().uppercase(), address = address.trim(),
                            city = city.trim(), state = state.trim(), stateCode = stateCode.trim(),
                            pincode = pincode.trim(), type = type
                        )
                    )
                }
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
