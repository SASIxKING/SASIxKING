package com.voltbill.pro

import com.voltbill.pro.domain.addMonths
import com.voltbill.pro.domain.amountInWords
import com.voltbill.pro.domain.computeLine
import com.voltbill.pro.domain.computeTotals
import com.voltbill.pro.domain.daysBetween
import com.voltbill.pro.domain.inr
import com.voltbill.pro.domain.nextInvoiceNo
import com.voltbill.pro.domain.wordsFor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the money maths. A billing app that computes GST wrongly is worse
 * than no billing app, so these cases are locked down.
 */
class GstEngineTest {

    @Test
    fun `intra-state battery splits tax into equal CGST and SGST`() {
        val line = computeLine(qty = 1.0, rate = 14500.0, discountPct = 0.0, gstRate = 28.0, interState = false)
        assertEquals(14500.0, line.taxable, 0.001)
        assertEquals(2030.0, line.cgst, 0.001)
        assertEquals(2030.0, line.sgst, 0.001)
        assertEquals(0.0, line.igst, 0.001)
        assertEquals(18560.0, line.total, 0.001)
    }

    @Test
    fun `old battery exchange is deducted from the grand total`() {
        val line = computeLine(1.0, 14500.0, 0.0, 28.0, false)
        val totals = computeTotals(listOf(line), grossBeforeDiscount = 14500.0, exchange = 1200.0)
        assertEquals(17360.0, totals.grandTotal, 0.001)
        assertEquals(1200.0, totals.exchange, 0.001)
    }

    @Test
    fun `inter-state supply uses IGST only`() {
        val line = computeLine(1.0, 12500.0, 0.0, 18.0, interState = true)
        assertEquals(2250.0, line.igst, 0.001)
        assertEquals(0.0, line.cgst, 0.001)
        assertEquals(0.0, line.sgst, 0.001)
        val totals = computeTotals(listOf(line), 12500.0, 0.0)
        assertEquals(14750.0, totals.grandTotal, 0.001)
    }

    @Test
    fun `line discount reduces the taxable value before tax`() {
        val line = computeLine(qty = 2.0, rate = 14500.0, discountPct = 5.0, gstRate = 28.0, interState = false)
        assertEquals(27550.0, line.taxable, 0.001)
    }

    @Test
    fun `multiple lines aggregate correctly`() {
        val inverter = computeLine(1.0, 8200.0, 0.0, 18.0, false)
        val battery = computeLine(2.0, 14500.0, 5.0, 28.0, false)
        val totals = computeTotals(listOf(inverter, battery), 8200.0 + 29000.0, 0.0)
        assertEquals(35750.0, totals.taxable, 0.001)
        assertEquals(totals.cgst, totals.sgst, 0.001)
    }

    @Test
    fun `grand total is always rounded to the nearest rupee`() {
        val line = computeLine(3.0, 1449.50, 0.0, 18.0, false)
        val totals = computeTotals(listOf(line), 4348.5, 0.0)
        assertEquals(Math.round(totals.grandTotal).toDouble(), totals.grandTotal, 0.0001)
        assertTrue(kotlin.math.abs(totals.roundOff) <= 0.5)
    }

    @Test
    fun `currency uses Indian digit grouping`() {
        assertEquals("₹1,23,456.78", inr(123456.78))
        assertEquals("₹999.50", inr(999.5))
        assertEquals("₹1,23,45,678.00", inr(12345678.0))
    }

    @Test
    fun `amount in words uses lakh and crore`() {
        assertEquals("One Lakh Twenty Three Thousand Four Hundred Fifty Six", wordsFor(123456L))
        assertEquals("One Crore", wordsFor(10000000L))
        assertTrue(amountInWords(17360.0).startsWith("Rupees Seventeen Thousand Three Hundred Sixty"))
    }

    @Test
    fun `invoice numbers increment within the financial year`() {
        val first = nextInvoiceNo(null, "VB")
        val second = nextInvoiceNo(first, "VB")
        assertTrue(first.endsWith("/0001"))
        assertTrue(second.endsWith("/0002"))
        assertTrue(first.startsWith("VB/"))
    }

    @Test
    fun `warranty expiry is computed in whole months`() {
        val start = System.currentTimeMillis()
        val days = daysBetween(start, addMonths(start, 48))
        assertTrue("48 months should be ~1461 days but was $days", days in 1400..1500)
    }
}
