package com.voltbill.pro.ui.warranty

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import com.voltbill.pro.domain.daysBetween
import com.voltbill.pro.domain.fmtDate
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.EmptyState
import com.voltbill.pro.ui.components.LabeledField
import com.voltbill.pro.ui.components.SearchBar
import com.voltbill.pro.ui.theme.Amber
import com.voltbill.pro.ui.theme.GreenOk
import com.voltbill.pro.ui.theme.RedDue

@Composable
fun WarrantyScreen(vm: AppViewModel) {
    val warranties by vm.warranties.collectAsStateWithLifecycle()
    val query by vm.warrantyQuery.collectAsStateWithLifecycle()
    var claiming by remember { mutableStateOf<com.voltbill.pro.data.Warranty?>(null) }
    val now = System.currentTimeMillis()

    Column(Modifier.fillMaxSize()) {
        SearchBar(query, { vm.setWarrantyQuery(it) }, "Search serial, customer or product")

        if (warranties.isEmpty()) {
            EmptyState(
                Icons.Default.Shield, "No warranty cards",
                "Cards are created automatically when you bill a serialised item"
            )
        } else {
            LazyColumn {
                items(warranties, key = { it.id }) { w ->
                    val days = daysBetween(now, w.expiryDate)
                    val (label, color) = when {
                        w.claimed -> "CLAIMED" to MaterialTheme.colorScheme.onSurfaceVariant
                        days < 0 -> "EXPIRED" to RedDue
                        days <= 30 -> "$days DAYS LEFT" to Amber
                        else -> "ACTIVE" to GreenOk
                    }
                    Card(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp)
                            .clickable { claiming = w },
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
                                    Text(w.productName, style = MaterialTheme.typography.titleSmall)
                                    Text(
                                        "S/N ${w.serial}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Surface(
                                    color = color.copy(alpha = 0.13f),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        label, color = color,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                                    )
                                }
                            }
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "${w.customerName}${if (w.customerPhone.isNotBlank()) " • ${w.customerPhone}" else ""}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                "${w.months} months  •  ${fmtDate(w.startDate)} → ${fmtDate(w.expiryDate)}  •  ${w.invoiceNo}",
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

    claiming?.let { w ->
        var notes by remember { mutableStateOf(w.claimNotes) }
        AlertDialog(
            onDismissRequest = { claiming = null },
            title = { Text("Warranty — ${w.serial}") },
            text = {
                Column {
                    Text("${w.productName} • ${w.customerName}",
                        style = MaterialTheme.typography.bodyMedium)
                    Text("Valid till ${fmtDate(w.expiryDate)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    LabeledField("Claim notes", notes, { notes = it }, singleLine = false)
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    vm.updateWarranty(w.copy(claimed = !w.claimed, claimNotes = notes))
                    claiming = null
                }) { Text(if (w.claimed) "Reopen" else "Mark Claimed") }
            },
            dismissButton = { TextButton(onClick = { claiming = null }) { Text("Close") } }
        )
    }
}
