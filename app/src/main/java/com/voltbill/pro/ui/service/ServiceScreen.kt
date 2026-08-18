package com.voltbill.pro.ui.service

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voltbill.pro.data.Customer
import com.voltbill.pro.data.ServiceJob
import com.voltbill.pro.domain.fmtDate
import com.voltbill.pro.domain.inr
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.EmptyState
import com.voltbill.pro.ui.components.LabeledField
import com.voltbill.pro.ui.components.StatusChip
import com.voltbill.pro.ui.invoices.trim
import com.voltbill.pro.ui.theme.RedDue

private val STATUSES = listOf("All", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED")
private val TYPES = listOf("Installation", "Service", "AMC", "Complaint", "Battery Water Top-up")

@Composable
fun ServiceScreen(vm: AppViewModel, editing: ServiceJob?, onEdit: (ServiceJob?) -> Unit) {
    val jobs by vm.serviceJobs.collectAsStateWithLifecycle()
    val customers by vm.customers.collectAsStateWithLifecycle()
    var status by remember { mutableStateOf("All") }

    val filtered = jobs.filter { status == "All" || it.status == status }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                .padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            STATUSES.forEach {
                FilterChip(
                    selected = status == it, onClick = { status = it },
                    label = { Text(it.replace('_', ' '), style = MaterialTheme.typography.labelSmall) }
                )
            }
        }

        if (filtered.isEmpty()) {
            EmptyState(Icons.Default.Build, "No job cards",
                "Log installations, service visits and AMCs with +")
        } else {
            LazyColumn {
                items(filtered, key = { it.id }) { j ->
                    Card(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp)
                            .clickable { onEdit(j) },
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(j.customerName, style = MaterialTheme.typography.titleSmall)
                                    Text("${j.jobNo} • ${j.type}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary)
                                }
                                StatusChip(j.status)
                            }
                            if (j.description.isNotBlank()) {
                                Spacer(Modifier.height(4.dp))
                                Text(j.description, style = MaterialTheme.typography.bodySmall)
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                listOfNotNull(
                                    fmtDate(j.scheduledDate),
                                    j.technician.ifBlank { null },
                                    if (j.charges > 0) inr(j.charges) else null
                                ).joinToString("  •  "),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }

    editing?.let { j ->
        ServiceDialog(
            job = j,
            customers = customers,
            onDismiss = { onEdit(null) },
            onSave = { vm.saveService(it); onEdit(null) },
            onDelete = { vm.deleteService(j); onEdit(null) }
        )
    }
}

@Composable
fun ServiceDialog(
    job: ServiceJob,
    customers: List<Customer>,
    onDismiss: () -> Unit,
    onSave: (ServiceJob) -> Unit,
    onDelete: () -> Unit
) {
    var customerId by remember { mutableStateOf(job.customerId) }
    var customerName by remember { mutableStateOf(job.customerName) }
    var phone by remember { mutableStateOf(job.customerPhone) }
    var address by remember { mutableStateOf(job.address) }
    var type by remember { mutableStateOf(job.type) }
    var desc by remember { mutableStateOf(job.description) }
    var tech by remember { mutableStateOf(job.technician) }
    var charges by remember { mutableStateOf(if (job.charges == 0.0) "" else trim(job.charges)) }
    var status by remember { mutableStateOf(job.status) }
    var pickCustomer by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (job.id == 0L) "New Job Card" else job.jobNo) },
        text = {
            Column(Modifier.heightIn(max = 450.dp).verticalScroll(rememberScrollState())) {
                Card(
                    Modifier.fillMaxWidth().clickable { pickCustomer = !pickCustomer },
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(Modifier.padding(11.dp)) {
                        Text(customerName.ifBlank { "Select customer" },
                            style = MaterialTheme.typography.titleSmall)
                        Text("Tap to change", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (pickCustomer) {
                    Column(Modifier.heightIn(max = 160.dp).verticalScroll(rememberScrollState())) {
                        customers.forEach { c ->
                            Text(
                                "${c.name}${if (c.phone.isNotBlank()) " • ${c.phone}" else ""}",
                                Modifier.fillMaxWidth().clickable {
                                    customerId = c.id; customerName = c.name; phone = c.phone
                                    address = listOf(c.address, c.city).filter { it.isNotBlank() }
                                        .joinToString(", ")
                                    pickCustomer = false
                                }.padding(vertical = 8.dp),
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Divider()
                        }
                    }
                }
                LabeledField("Phone", phone, { phone = it }, numeric = true)
                LabeledField("Address", address, { address = it }, singleLine = false)
                Spacer(Modifier.height(4.dp))
                Text("TYPE", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    TYPES.forEach {
                        FilterChip(
                            selected = type == it, onClick = { type = it },
                            label = { Text(it, style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }
                LabeledField("Description", desc, { desc = it }, singleLine = false)
                LabeledField("Technician", tech, { tech = it })
                LabeledField("Charges (₹)", charges, { charges = it }, numeric = true)
                Spacer(Modifier.height(4.dp))
                Text("STATUS", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    STATUSES.drop(1).forEach {
                        FilterChip(
                            selected = status == it, onClick = { status = it },
                            label = { Text(it.replace('_', ' '),
                                style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = customerName.isNotBlank(),
                onClick = {
                    onSave(
                        job.copy(
                            customerId = customerId, customerName = customerName,
                            customerPhone = phone, address = address, type = type,
                            description = desc, technician = tech,
                            charges = charges.toDoubleOrNull() ?: 0.0,
                            status = status,
                            completedDate = if (status == "COMPLETED")
                                (job.completedDate ?: System.currentTimeMillis()) else null
                        )
                    )
                }
            ) { Text("Save") }
        },
        dismissButton = {
            Row {
                if (job.id != 0L) {
                    TextButton(onClick = onDelete) { Text("Delete", color = RedDue) }
                }
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        }
    )
}
