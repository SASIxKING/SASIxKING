package com.voltbill.pro.ui.settings

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voltbill.pro.data.BusinessProfile
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.components.LabeledField
import com.voltbill.pro.ui.components.SectionHeader

@Composable
fun SettingsScreen(vm: AppViewModel) {
    val context = LocalContext.current
    val profile by vm.profile.collectAsStateWithLifecycle()
    val dark by vm.darkMode.collectAsStateWithLifecycle()

    var draft by remember(profile) { mutableStateOf(profile) }

    LazyColumn(Modifier.fillMaxSize()) {
        item { SectionHeader("Business profile") }
        item {
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                shape = RoundedCornerShape(12.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(Modifier.padding(14.dp)) {
                    LabeledField("Business name", draft.name) { draft = draft.copy(name = it) }
                    LabeledField("Tagline", draft.tagline) { draft = draft.copy(tagline = it) }
                    LabeledField("GSTIN", draft.gstin) { draft = draft.copy(gstin = it) }
                    LabeledField("Phone", draft.phone) { draft = draft.copy(phone = it) }
                    LabeledField("Email", draft.email) { draft = draft.copy(email = it) }
                    LabeledField("Address", draft.address, singleLine = false) {
                        draft = draft.copy(address = it)
                    }
                    Row {
                        LabeledField("State", draft.state, modifier = Modifier.weight(2f)) {
                            draft = draft.copy(state = it)
                        }
                        Spacer(Modifier.width(8.dp))
                        LabeledField("Code", draft.stateCode, modifier = Modifier.weight(1f),
                            numeric = true) { draft = draft.copy(stateCode = it) }
                    }
                }
            }
        }

        item { SectionHeader("Invoice settings") }
        item {
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(Modifier.padding(14.dp)) {
                    LabeledField("Invoice prefix", draft.invoicePrefix) {
                        draft = draft.copy(invoicePrefix = it)
                    }
                    Text(
                        "Bills are numbered ${draft.invoicePrefix}/2025-26/0001 and reset each financial year.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    LabeledField("Default GST %", draft.defaultGst, numeric = true) {
                        draft = draft.copy(defaultGst = it)
                    }
                    LabeledField("Authorised signatory", draft.signatory) {
                        draft = draft.copy(signatory = it)
                    }
                    LabeledField("Terms & conditions", draft.terms, singleLine = false) {
                        draft = draft.copy(terms = it)
                    }
                }
            }
        }

        item { SectionHeader("Payment details") }
        item {
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(Modifier.padding(14.dp)) {
                    LabeledField("Bank name", draft.bankName) { draft = draft.copy(bankName = it) }
                    LabeledField("Account number", draft.accountNo) {
                        draft = draft.copy(accountNo = it)
                    }
                    LabeledField("IFSC", draft.ifsc) { draft = draft.copy(ifsc = it) }
                    LabeledField("UPI ID", draft.upiId) { draft = draft.copy(upiId = it) }
                }
            }
        }

        item { SectionHeader("Appearance") }
        item {
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Dark theme", style = MaterialTheme.typography.titleSmall)
                        Text("Easier on the eyes in low light",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = dark, onCheckedChange = { vm.setDark(it) })
                }
            }
        }

        item {
            Button(
                onClick = {
                    vm.saveProfile(draft)
                    Toast.makeText(context, "Settings saved", Toast.LENGTH_SHORT).show()
                },
                modifier = Modifier.fillMaxWidth().padding(14.dp).height(48.dp),
                shape = RoundedCornerShape(12.dp)
            ) { Text("Save Settings") }
        }

        item {
            Text(
                "VoltBill Pro v1.0.0  •  Offline GST billing for inverter & battery dealers",
                Modifier.fillMaxWidth().padding(16.dp),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        item { Spacer(Modifier.height(70.dp)) }
    }
}
