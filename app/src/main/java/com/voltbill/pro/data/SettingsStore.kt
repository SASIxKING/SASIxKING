package com.voltbill.pro.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("voltbill_settings")

/** The shop's own details, printed on every invoice. */
data class BusinessProfile(
    val name: String = "VoltBill Power Solutions",
    val tagline: String = "Inverters • Batteries • Solar • Service",
    val gstin: String = "33ABCDE1234F1Z5",
    val phone: String = "98430 12345",
    val email: String = "sales@voltbill.in",
    val address: String = "No. 24, Bharathi Street, Puducherry - 605001",
    val state: String = "Puducherry",
    val stateCode: String = "34",
    val bankName: String = "State Bank of India",
    val accountNo: String = "3812 4567 8901",
    val ifsc: String = "SBIN0001234",
    val upiId: String = "voltbill@sbi",
    val invoicePrefix: String = "VB",
    val terms: String = "1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms; battery warranty is pro-rata after 24 months.\n3. Interest @18% p.a. charged on bills unpaid beyond 15 days.\n4. Subject to Puducherry jurisdiction.",
    val defaultGst: String = "28",
    val signatory: String = "Authorised Signatory"
)

class SettingsStore(private val context: Context) {

    private object K {
        val name = stringPreferencesKey("biz_name")
        val tagline = stringPreferencesKey("biz_tagline")
        val gstin = stringPreferencesKey("biz_gstin")
        val phone = stringPreferencesKey("biz_phone")
        val email = stringPreferencesKey("biz_email")
        val address = stringPreferencesKey("biz_address")
        val state = stringPreferencesKey("biz_state")
        val stateCode = stringPreferencesKey("biz_state_code")
        val bankName = stringPreferencesKey("bank_name")
        val accountNo = stringPreferencesKey("bank_acc")
        val ifsc = stringPreferencesKey("bank_ifsc")
        val upiId = stringPreferencesKey("upi")
        val prefix = stringPreferencesKey("inv_prefix")
        val terms = stringPreferencesKey("terms")
        val defaultGst = stringPreferencesKey("default_gst")
        val signatory = stringPreferencesKey("signatory")
        val dark = booleanPreferencesKey("dark_mode")
    }

    val profile: Flow<BusinessProfile> = context.dataStore.data.map { p ->
        val d = BusinessProfile()
        BusinessProfile(
            name = p[K.name] ?: d.name,
            tagline = p[K.tagline] ?: d.tagline,
            gstin = p[K.gstin] ?: d.gstin,
            phone = p[K.phone] ?: d.phone,
            email = p[K.email] ?: d.email,
            address = p[K.address] ?: d.address,
            state = p[K.state] ?: d.state,
            stateCode = p[K.stateCode] ?: d.stateCode,
            bankName = p[K.bankName] ?: d.bankName,
            accountNo = p[K.accountNo] ?: d.accountNo,
            ifsc = p[K.ifsc] ?: d.ifsc,
            upiId = p[K.upiId] ?: d.upiId,
            invoicePrefix = p[K.prefix] ?: d.invoicePrefix,
            terms = p[K.terms] ?: d.terms,
            defaultGst = p[K.defaultGst] ?: d.defaultGst,
            signatory = p[K.signatory] ?: d.signatory
        )
    }

    val darkMode: Flow<Boolean> = context.dataStore.data.map { it[K.dark] ?: false }

    suspend fun save(b: BusinessProfile) {
        context.dataStore.edit { p ->
            p[K.name] = b.name; p[K.tagline] = b.tagline; p[K.gstin] = b.gstin
            p[K.phone] = b.phone; p[K.email] = b.email; p[K.address] = b.address
            p[K.state] = b.state; p[K.stateCode] = b.stateCode
            p[K.bankName] = b.bankName; p[K.accountNo] = b.accountNo; p[K.ifsc] = b.ifsc
            p[K.upiId] = b.upiId; p[K.prefix] = b.invoicePrefix; p[K.terms] = b.terms
            p[K.defaultGst] = b.defaultGst; p[K.signatory] = b.signatory
        }
    }

    suspend fun setDark(v: Boolean) {
        context.dataStore.edit { it[K.dark] = v }
    }

    private fun <T> Preferences.getOr(key: Preferences.Key<T>, def: T): T = this[key] ?: def
}
